use pixi_gui_server::Frontend;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tokio::sync::oneshot;

/// Delivers backend events and questions to Tauri windows. The session id is the window label.
pub struct TauriFrontend {
    app: AppHandle,
}

impl TauriFrontend {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl Frontend for TauriFrontend {
    fn emit_event(&self, session: &str, event: &str, payload: serde_json::Value) {
        if let Err(e) = self.app.emit_to(session, event, payload) {
            log::error!("Failed to emit {event} to {session}: {e}");
        }
    }

    fn confirm(&self, session: &str, message: &str) -> oneshot::Receiver<bool> {
        let (tx, rx) = oneshot::channel();

        let mut dialog = self
            .app
            .dialog()
            .message(message)
            .title("Confirm")
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::YesNo);

        if let Some(window) = self.app.get_webview_window(session) {
            dialog = dialog.parent(&window);
        }

        dialog.show(move |result| {
            let _ = tx.send(result);
        });

        rx
    }
}
