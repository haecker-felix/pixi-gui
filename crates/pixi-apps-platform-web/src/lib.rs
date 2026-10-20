//! Runs an app in the browser: an HTTP server that serves the frontend, and talks to
//! it over a WebSocket.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, ErrorKind, Write};
use std::net::{IpAddr, Ipv4Addr};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::Router;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State as AxumState, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use clap::Parser;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use listenfd::ListenFd;
use log::info;
use memory_serve::MemoryServe;
use pixi_apps_backend::app::{PathArg, path_route};
use pixi_apps_backend::event::Event;
use pixi_apps_backend::{SessionId, State, dispatch};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use subtle::ConstantTimeEq;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use uuid::Uuid;

pub use pixi_apps_backend::{AppInfo, app_info};

/// How long a browser stays logged in (30 days)
const LOGIN_DURATION: Duration = Duration::from_hours(30 * 24);

/// Length of the key that signs logins, in bytes
const KEY_LENGTH: usize = 32;

pub struct Config {
    pub app: AppInfo,
    pub open_path: &'static str,

    /// Port to listen on, unless set on the command line
    pub port: u16,
    /// Port of the Vite dev server, which serves the frontend in debug builds
    pub dev_server_port: u16,
    /// The bundled frontend
    pub assets: Option<MemoryServe>,
}

#[derive(Parser)]
struct Cli {
    #[command(flatten)]
    path: PathArg,
    /// Address to listen on
    #[arg(long, default_value_t = IpAddr::V4(Ipv4Addr::LOCALHOST))]
    host: IpAddr,
    /// Port to listen on
    #[arg(long)]
    port: Option<u16>,
}

pub fn run(config: Config) {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let cli: Cli = config.app.parse();
    let port = cli.port.unwrap_or(config.port);

    let route = match cli.path.absolute(None) {
        Some(path) => path_route(config.open_path, &path),
        None => "/".to_string(),
    };

    let runtime = tokio::runtime::Runtime::new().expect("Failed to start the tokio runtime");
    if let Err(err) = runtime.block_on(Server::start(config, cli.host, port, route)) {
        eprintln!("Failed to serve on port {port}: {err}");
        std::process::exit(1);
    }
}

/// Sent by the frontend
#[derive(Deserialize)]
struct FrontendMessage {
    id: u64,
    cmd: String,
    #[serde(default)]
    args: Value,
}

/// Sent by the server
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum ServerMessage {
    /// Result of the command with the same `id`
    Response {
        id: u64,
        result: Result<Value, String>,
    },
    Event(Event),
    /// Login for the browser to use instead of the token from now on. Gets
    /// sent once it connected successfully with the token.
    Login {
        login: String,
    },
}

/// Content of a login
#[derive(Serialize, Deserialize)]
struct LoginClaims {
    /// Expiry, in seconds since the Unix epoch
    exp: u64,
}

/// Access control: only browsers the user logged in can connect to the `/api/ws` endpoint.
///
/// All communication with the backend goes over that WebSocket, so it's the only thing
/// that needs protecting. The frontend files are served to anyone, as they contain no
/// data.
///
/// The WebSocket accepts a connection with either of two credentials:
///
/// - `?token=…`: a random token that the server makes on start and prints in the URL.
///   Only the user sees it. Each start makes a new one, so old URLs stop working.
/// - `?login=…`: a login that the server gave the browser before.
///
/// So the browser logs in like this:
///
/// 1. First visit: the browser has no login yet. It opens the printed URL and connects
///    with only `?token=…`. If the token is right, the server sends a login as the first
///    message over the WebSocket.
/// 2. The browser saves the login. From then on it connects with `?login=…`, and stays
///    logged in after reloads and server restarts, without the URL.
///
/// If the browser has both, the token is checked first and gives it a new login. A token
/// from an old URL is ignored, and the login is checked instead.
///
/// A new login replaces the old one in the browser, but the old one stays valid until it
/// expires: the server keeps no list of logins, it only checks their signature and
/// expiry. So the only way to invalidate logins is to delete the key file, which
/// invalidates all of them.
///
/// The login is a JWT (JSON Web Token): a bit of data, here only when it expires, plus a
/// signature made with a secret key. Only the server has the key, so only it can make
/// logins.
///
/// The key is stored in a file only the user can read, so logins stay valid after
/// restarts. Deleting the file logs out all browsers.
///
/// The browser saves the login in `localStorage`, not in a cookie: browsers send cookies
/// to every port of a host, so other servers there would get the login.
#[derive(Clone)]
struct Server {
    state: State,
    /// Messages for the WebSocket of each connected session
    sessions: Arc<Mutex<HashMap<SessionId, mpsc::UnboundedSender<String>>>>,
    /// Secret in the URL the server prints
    token: Arc<str>,
    /// Signs logins, is stored on disk so logins survive restarts
    key: Arc<[u8]>,
}

impl Server {
    async fn start(config: Config, host: IpAddr, port: u16, route: String) -> io::Result<()> {
        let listener = match ListenFd::from_env().take_tcp_listener(0)? {
            Some(listener) => {
                listener.set_nonblocking(true)?;
                TcpListener::from_std(listener)?
            }
            None => TcpListener::bind((host, port)).await?,
        };
        let address = listener.local_addr()?;
        let port = address.port();

        let data_dir = dirs::data_dir().unwrap().join(config.app.identifier);
        let key = Self::load_key(&data_dir.join("web-login-key"))?;

        let (state, mut events) = State::new(config.app);
        let server = Self {
            state,
            sessions: Default::default(),
            token: Uuid::new_v4().simple().to_string().into(),
            key: key.into(),
        };
        let token = server.token.clone();

        // Forwards events to the WebSockets of their sessions.
        let server_ = server.clone();
        tokio::spawn(async move {
            while let Some(event) = events.recv().await {
                server_.send_event(event);
            }
        });

        let app = Router::new().route("/api/ws", get(Self::handle_ws_upgrade));

        let (app, port) = match config.assets {
            Some(assets) => {
                let assets = assets
                    .fallback(Some("/index.html"))
                    .fallback_status(axum::http::StatusCode::OK)
                    // Vite puts a content hash into the names of the files in `assets/`
                    .html_cache_control(memory_serve::CacheControl::NoCache)
                    .cache_control(memory_serve::CacheControl::Long)
                    .into_router();
                (app.merge(assets), port)
            }
            // Without bundled frontend, it gets served by the Vite dev server
            None => (app, config.dev_server_port),
        };

        let app = app.with_state(server);
        let host = match address.ip() {
            ip if ip.is_loopback() => "localhost".to_string(),
            ip if ip.is_unspecified() => "<this host>".to_string(),
            IpAddr::V4(ip) => ip.to_string(),
            IpAddr::V6(ip) => format!("[{ip}]"),
        };
        let url = format!("http://{host}:{port}{route}?token={token}");

        println!();
        println!("{} is running. Open in your browser:", config.app.name);
        println!();
        println!("    {url}");
        println!();
        if address.ip().is_loopback() {
            println!("On another machine, forward the port first:");
            println!();
            println!("    ssh -L {port}:localhost:{port} <this host>");
        } else {
            println!("Warning: traffic is unencrypted. Only use this on trusted networks,");
            println!("or behind a TLS reverse proxy.");
        }
        println!();

        // Not during development, where the server restarts on every change
        if cfg!(not(debug_assertions)) && address.ip().is_loopback() {
            let _ = open::that_detached(url);
        }

        axum::serve(listener, app).await
    }

    /// Handler of `GET /api/ws` - upgrades the request to a WebSocket and starts a session,
    /// if it has a valid token or login
    async fn handle_ws_upgrade(
        AxumState(server): AxumState<Self>,
        Query(query): Query<HashMap<String, String>>,
        upgrade: WebSocketUpgrade,
    ) -> Response {
        let token = query.get("token");
        let login = query.get("login");

        // Browsers that connect with the token get a new login
        let new_login = if token.is_some_and(|token| server.is_valid_token(token)) {
            Some(server.new_login())
        } else if login.is_some_and(|login| server.is_valid_login(login)) {
            None
        } else {
            return StatusCode::UNAUTHORIZED.into_response();
        };

        upgrade.on_upgrade(move |socket| server.serve_session(socket, new_login))
    }

    /// Whether the token is the one printed on start. Compares in constant time, so the
    /// response time doesn't tell how much of it is right.
    fn is_valid_token(&self, token: &str) -> bool {
        token.as_bytes().ct_eq(self.token.as_bytes()).into()
    }

    /// Whether the login has a valid signature, and isn't expired
    fn is_valid_login(&self, login: &str) -> bool {
        let key = DecodingKey::from_secret(&self.key);
        jsonwebtoken::decode::<LoginClaims>(login, &key, &Validation::default()).is_ok()
    }

    /// Creates a login: a JWT that expires after `LOGIN_DURATION`. The browser keeps it in
    /// `localStorage`, which is separate per port.
    fn new_login(&self) -> String {
        let claims = LoginClaims {
            exp: jsonwebtoken::get_current_timestamp() + LOGIN_DURATION.as_secs(),
        };
        let key = EncodingKey::from_secret(&self.key);
        jsonwebtoken::encode(&Header::default(), &claims, &key).unwrap()
    }

    /// Sends an event to a WebSocket session
    fn send_event(&self, event: Event) {
        let sessions = self.sessions.lock().unwrap();
        let Some(socket) = sessions.get(&event.session) else {
            info!("Dropped event {} of closed session", event.name);
            return;
        };
        let _ = socket.send(serde_json::to_string(&ServerMessage::Event(event)).unwrap());
    }

    /// Serves the WebSocket of a new session until it closes. A session lives as long as
    /// its WebSocket. When the connection closes, the session is gets dropped as well.
    /// The frontend reloads the page when it reconnects, which starts a new session.
    async fn serve_session(self, mut socket: WebSocket, login: Option<String>) {
        let session: SessionId = Uuid::new_v4().to_string();
        let (sender, mut receiver) = mpsc::unbounded_channel();
        self.sessions
            .lock()
            .unwrap()
            .insert(session.clone(), sender.clone());
        info!("Session {session} connected");

        if let Some(login) = login {
            let _ = sender.send(serde_json::to_string(&ServerMessage::Login { login }).unwrap());
        }

        loop {
            tokio::select! {
                Some(message) = receiver.recv() => {
                    if socket.send(Message::Text(message.into())).await.is_err() {
                        break;
                    }
                }
                incoming = socket.recv() => match incoming {
                    Some(Ok(Message::Text(text))) => match serde_json::from_str(&text) {
                        Ok(message) => self.spawn_command(&session, &sender, message),
                        Err(err) => info!("Invalid message of session {session}: {err}"),
                    },
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => {}
                },
            }
        }

        info!("Session {session} disconnected");
        self.sessions.lock().unwrap().remove(&session);
        self.state.close_session(&session).await;
    }

    /// Runs a command in the background, so long commands don't block other commands
    fn spawn_command(
        &self,
        session: &SessionId,
        sender: &mpsc::UnboundedSender<String>,
        message: FrontendMessage,
    ) {
        let session = self.state.session(session);
        let sender = sender.clone();
        tokio::spawn(async move {
            let result = dispatch(session, &message.cmd, message.args)
                .await
                .map_err(|err| err.to_string());
            let response = ServerMessage::Response {
                id: message.id,
                result,
            };
            let _ = sender.send(serde_json::to_string(&response).unwrap());
        });
    }

    /// Loads the key which signs logins, or creates it on first start
    fn load_key(path: &Path) -> io::Result<Vec<u8>> {
        if let Ok(key) = fs::read(path)
            && key.len() == KEY_LENGTH
        {
            return Ok(key);
        }

        fs::create_dir_all(path.parent().unwrap())?;

        let mut key = vec![0; KEY_LENGTH];
        getrandom::fill(&mut key).map_err(io::Error::other)?;

        // Removes an old file first, so the new one gets the permissions below
        if let Err(err) = fs::remove_file(path)
            && err.kind() != ErrorKind::NotFound
        {
            return Err(err);
        }
        let mut options = File::options();
        options.write(true).create_new(true);

        // Only readable by the user
        #[cfg(unix)]
        std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);

        options.open(path)?.write_all(&key)?;

        Ok(key)
    }
}
