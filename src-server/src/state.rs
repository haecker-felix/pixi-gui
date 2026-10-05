use std::{collections::HashMap, sync::Arc};

use log::warn;
use tokio::sync::Mutex;

use crate::frontend::Frontend;
use crate::pty::{PtyExitEvent, PtyHandle};
use crate::watcher::Watcher;

/// Everything the backend keeps in memory: running PTYs, their exit records,
/// the manifest watchers, and the [`Frontend`] used to reach the frontend.
#[derive(Clone)]
pub struct State {
    frontend: Arc<dyn Frontend>,
    ptys: Arc<Mutex<HashMap<String, Arc<PtyHandle>>>>,
    exited_ptys: Arc<Mutex<HashMap<String, PtyExitEvent>>>,
    watcher: Arc<Mutex<Watcher>>,
}

impl State {
    pub fn new(frontend: Arc<dyn Frontend>) -> Self {
        Self {
            frontend,
            ptys: Default::default(),
            exited_ptys: Default::default(),
            watcher: Default::default(),
        }
    }

    pub fn frontend(&self) -> &Arc<dyn Frontend> {
        &self.frontend
    }

    pub async fn pty(&self, id: &str) -> Option<Arc<PtyHandle>> {
        self.ptys.lock().await.get(id).cloned()
    }

    pub async fn ptys(&self) -> Vec<Arc<PtyHandle>> {
        self.ptys.lock().await.values().cloned().collect()
    }

    pub async fn add_pty(&self, id: String, pty: Arc<PtyHandle>) {
        let mut ptys = self.ptys.lock().await;
        if ptys.contains_key(&id) {
            warn!("A PTY with that id is already registered: {id} ");
            return;
        }
        ptys.insert(id.clone(), pty);

        // Clear any saved exit event from a previous run
        self.exited_ptys.lock().await.remove(&id);
    }

    pub async fn remove_pty(&self, id: &str, exit_event: PtyExitEvent) -> Option<Arc<PtyHandle>> {
        // Save last buffer so it can be retrieved again
        // afterwards even if the PTY itself no longer exists
        self.exited_ptys
            .lock()
            .await
            .insert(id.to_string(), exit_event);

        self.ptys.lock().await.remove(id)
    }

    pub async fn exit_event(&self, id: &str) -> Option<PtyExitEvent> {
        self.exited_ptys.lock().await.get(id).cloned()
    }

    pub fn watcher(&self) -> &Arc<Mutex<Watcher>> {
        &self.watcher
    }
}
