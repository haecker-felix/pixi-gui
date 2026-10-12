use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as SyncMutex};

use log::warn;
use tokio::sync::{Mutex, mpsc, oneshot};

use crate::context::SessionId;
use crate::event::Event;
use crate::pty::{PtyExitEvent, PtyHandle};
use crate::watcher::Watcher;

/// Values that every session has its own set of
type PerSession<K, V> = HashMap<SessionId, HashMap<K, V>>;

/// Everything the backend keeps in memory
#[derive(Clone)]
pub struct State {
    /// Events for the frontend, which the transport delivers to their session
    event_sender: mpsc::UnboundedSender<Event>,

    /// The running processes of each session, by PTY id
    ptys: Arc<Mutex<PerSession<String, Arc<PtyHandle>>>>,
    /// The exit events of the last finished runs of each session, by PTY id
    exited_ptys: Arc<Mutex<PerSession<String, PtyExitEvent>>>,
    /// The confirms of each session that wait for the user's answer, by confirm id
    confirms: Arc<SyncMutex<PerSession<u64, oneshot::Sender<bool>>>>,
    next_confirm_id: Arc<AtomicU64>,

    /// The manifest file watchers, one per session
    watcher: Arc<Mutex<Watcher>>,
}

impl State {
    /// The transport is responsible to forward the events to the frontend session.
    pub fn new() -> (Self, mpsc::UnboundedReceiver<Event>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let state = Self {
            event_sender: tx,
            ptys: Default::default(),
            exited_ptys: Default::default(),
            watcher: Default::default(),
            confirms: Default::default(),
            next_confirm_id: Default::default(),
        };
        (state, rx)
    }

    pub fn event_sender(&self) -> &mpsc::UnboundedSender<Event> {
        &self.event_sender
    }

    pub async fn pty(&self, session: &SessionId, id: &str) -> Option<Arc<PtyHandle>> {
        self.ptys.lock().await.get(session)?.get(id).cloned()
    }

    pub async fn ptys(&self, session: &SessionId) -> Vec<Arc<PtyHandle>> {
        match self.ptys.lock().await.get(session) {
            Some(ptys) => ptys.values().cloned().collect(),
            None => Vec::new(),
        }
    }

    pub async fn add_pty(&self, session: &SessionId, pty: Arc<PtyHandle>) {
        let mut ptys = self.ptys.lock().await;
        let ptys = ptys.entry(session.clone()).or_default();

        if ptys.contains_key(&pty.id) {
            warn!("A PTY with that id is already registered: {} ", pty.id);
            return;
        }
        ptys.insert(pty.id.clone(), pty.clone());

        // Clear any saved exit event from a previous run
        if let Some(exited_ptys) = self.exited_ptys.lock().await.get_mut(session) {
            exited_ptys.remove(&pty.id);
        }
    }

    pub async fn remove_pty(&self, session: &SessionId, id: &str, exit_event: PtyExitEvent) {
        let mut ptys = self.ptys.lock().await;
        let Some(ptys) = ptys.get_mut(session) else {
            return;
        };
        ptys.remove(id);

        // Save last buffer so it can be retrieved again
        // afterwards even if the PTY itself no longer exists
        self.exited_ptys
            .lock()
            .await
            .entry(session.clone())
            .or_default()
            .insert(id.to_string(), exit_event);
    }

    pub async fn exit_event(&self, session: &SessionId, id: &str) -> Option<PtyExitEvent> {
        self.exited_ptys.lock().await.get(session)?.get(id).cloned()
    }

    pub fn watcher(&self) -> &Arc<Mutex<Watcher>> {
        &self.watcher
    }

    pub fn request_confirm(&self, session: &SessionId) -> (u64, oneshot::Receiver<bool>) {
        let id = self.next_confirm_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();

        self.confirms
            .lock()
            .unwrap()
            .entry(session.clone())
            .or_default()
            .insert(id, sender);

        (id, receiver)
    }

    pub fn answer_confirm(&self, session: &SessionId, id: u64, value: bool) {
        let mut confirms = self.confirms.lock().unwrap();
        if let Some(confirms) = confirms.get_mut(session)
            && let Some(sender) = confirms.remove(&id)
        {
            let _ = sender.send(value);
        }
    }

    /// Cleans up after a session has ended (e.g. its window was closed)
    pub async fn drop_session(&self, session: &SessionId) {
        // Terminate running processes of the session
        let ptys = self.ptys.lock().await.remove(session).unwrap_or_default();
        for pty in ptys.into_values() {
            tokio::spawn(async move { pty.kill().await });
        }
        self.exited_ptys.lock().await.remove(session);

        // Dropping the senders resolves the waiting commands with "no"
        self.confirms.lock().unwrap().remove(session);

        // Stop watching the filesystem
        self.watcher.lock().await.unwatch(session);
    }
}
