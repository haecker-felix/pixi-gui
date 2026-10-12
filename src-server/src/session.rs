use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as SyncMutex};

use log::{debug, warn};
use miette::Result;
use pixi_api::Interface;
use tokio::sync::{Mutex, mpsc, oneshot};

use crate::confirm::ConfirmRequest;
use crate::event::{Event, EventPayload};
use crate::notification::{Notification, NotificationLevel};
use crate::pty::{PtyExitEvent, PtyHandle};
use crate::utils;
use crate::watcher::{self, ManifestWatcher};

/// The name of one frontend instance, i.e. who called a command.
/// One exists per window. On desktop this is the Tauri window label.
pub type SessionId = String;

#[derive(Clone)]
pub struct Session {
    id: SessionId,
    /// Events for the frontend, which the transport delivers to this session
    event_sender: mpsc::UnboundedSender<Event>,

    /// The running processes, by PTY id
    ptys: Arc<Mutex<HashMap<String, Arc<PtyHandle>>>>,
    /// The exit events of the last finished runs, by PTY id
    exited_ptys: Arc<Mutex<HashMap<String, PtyExitEvent>>>,
    /// The confirms that wait for the user's answer, by confirm id
    confirms: Arc<SyncMutex<HashMap<u64, oneshot::Sender<bool>>>>,
    next_confirm_id: Arc<AtomicU64>,

    /// Watches the manifest file for changes
    watcher: Arc<Mutex<Option<ManifestWatcher>>>,

    /// Set once the session has ended, so commands that are still running can't
    /// start new processes or ask questions anymore
    closed: Arc<AtomicBool>,
}

impl Session {
    pub(crate) fn new(id: SessionId, event_sender: mpsc::UnboundedSender<Event>) -> Self {
        Self {
            id,
            event_sender,
            ptys: Default::default(),
            exited_ptys: Default::default(),
            confirms: Default::default(),
            next_confirm_id: Default::default(),
            watcher: Default::default(),
            closed: Default::default(),
        }
    }

    /// Sends an event to the frontend of this session.
    pub fn send_event(&self, payload: EventPayload) {
        let event = Event::new(&self.id, payload);
        let _ = self.event_sender.send(event);
    }

    pub(crate) async fn pty(&self, id: &str) -> Option<Arc<PtyHandle>> {
        self.ptys.lock().await.get(id).cloned()
    }

    pub(crate) async fn ptys(&self) -> Vec<Arc<PtyHandle>> {
        self.ptys.lock().await.values().cloned().collect()
    }

    pub(crate) async fn add_pty(&self, pty: Arc<PtyHandle>) -> Result<()> {
        // Checked while holding the lock, so it can't get added after `close` collected the PTYs
        let mut ptys = self.ptys.lock().await;
        if self.closed.load(Ordering::SeqCst) {
            miette::bail!("Session {} has ended", self.id);
        }

        if ptys.contains_key(&pty.id) {
            warn!("A PTY with that id is already registered: {} ", pty.id);
            return Ok(());
        }
        ptys.insert(pty.id.clone(), pty.clone());

        // Clear any saved exit event from a previous run
        self.exited_ptys.lock().await.remove(&pty.id);
        Ok(())
    }

    pub(crate) async fn remove_pty(&self, id: &str, exit_event: PtyExitEvent) {
        let mut ptys = self.ptys.lock().await;
        ptys.remove(id);

        // Save last buffer so it can be retrieved again
        // afterwards even if the PTY itself no longer exists
        self.exited_ptys
            .lock()
            .await
            .insert(id.to_string(), exit_event);
    }

    pub(crate) async fn exit_event(&self, id: &str) -> Option<PtyExitEvent> {
        self.exited_ptys.lock().await.get(id).cloned()
    }

    pub(crate) fn request_confirm(&self) -> (u64, oneshot::Receiver<bool>) {
        let id = self.next_confirm_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();

        // Dropping the sender of an ended session answers with "no"
        let mut confirms = self.confirms.lock().unwrap();
        if !self.closed.load(Ordering::SeqCst) {
            confirms.insert(id, sender);
        }

        (id, receiver)
    }

    pub(crate) fn answer_confirm(&self, id: u64, value: bool) {
        if let Some(sender) = self.confirms.lock().unwrap().remove(&id) {
            let _ = sender.send(value);
        }
    }

    pub(crate) async fn watch_manifest(&self, manifest: PathBuf) -> Result<()> {
        let mut watcher = self.watcher.lock().await;
        *watcher = None;

        *watcher = Some(watcher::watch(
            self.event_sender.clone(),
            self.id.clone(),
            manifest,
        )?);

        Ok(())
    }

    pub(crate) async fn unwatch_manifest(&self) {
        if self.watcher.lock().await.take().is_some() {
            debug!("Stopped watcher for session {}", self.id);
        }
    }

    /// Cleans up after the session has ended
    pub(crate) async fn close(&self) {
        // Set before the cleanup, so nothing gets added again afterwards
        self.closed.store(true, Ordering::SeqCst);

        // Terminate running processes
        let ptys = std::mem::take(&mut *self.ptys.lock().await);
        for pty in ptys.into_values() {
            tokio::spawn(async move { pty.kill().await });
        }
        self.exited_ptys.lock().await.clear();

        // Dropping the senders resolves the waiting commands with "no"
        self.confirms.lock().unwrap().clear();

        // Stop watching the filesystem
        self.unwatch_manifest().await;
    }
}

/// Forwards messages from pixi_api to the session that called the command.
impl Interface for Session {
    async fn is_cli(&self) -> bool {
        false
    }

    /// Asks the frontend with a `confirm-request` event; it answers with the
    /// `answer_confirm` command.
    async fn confirm(&self, msg: &str) -> Result<bool> {
        let (id, answer) = self.request_confirm();

        self.send_event(EventPayload::ConfirmRequest(ConfirmRequest {
            id,
            message: utils::strip_ansi_escapes(msg),
        }));

        // A dropped sender counts as "no"
        Ok(answer.await.unwrap_or(false))
    }

    async fn info(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Info,
            message: utils::strip_ansi_escapes(msg),
        }));
    }

    async fn success(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Success,
            message: utils::strip_ansi_escapes(msg),
        }));
    }

    async fn warning(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Warning,
            message: utils::strip_ansi_escapes(msg),
        }));
    }

    async fn error(&self, msg: &str) {
        self.send_event(EventPayload::Notification(Notification {
            level: NotificationLevel::Error,
            message: utils::strip_ansi_escapes(msg),
        }));
    }
}
