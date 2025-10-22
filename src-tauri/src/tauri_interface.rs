use miette::{IntoDiagnostic, Result};
use pixi_api::Interface;
use tauri::{Emitter, Manager, Runtime, Window};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tokio::sync::oneshot;

use crate::utils;

pub struct TauriInterface<R: Runtime> {
    window: Window<R>,
}

impl<R: Runtime> TauriInterface<R> {
    pub fn new(window: Window<R>) -> Self {
        Self { window }
    }
}

impl<R: Runtime> Interface for TauriInterface<R> {
    async fn is_cli(&self) -> bool {
        false
    }

    async fn confirm(&self, msg: &str) -> Result<bool> {
        let (tx, rx) = oneshot::channel();

        self.window
            .app_handle()
            .dialog()
            .message(utils::strip_ansi_escapes(msg))
            .title("Confirm")
            .parent(&self.window)
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::YesNo)
            .show(move |result| {
                let _ = tx.send(result);
            });

        let res = rx.await.into_diagnostic()?;
        Ok(res)
    }

    async fn info(&self, msg: &str) {
        self.emit_notification("info", msg);
    }

    async fn success(&self, msg: &str) {
        self.emit_notification("success", msg);
    }

    async fn warning(&self, msg: &str) {
        self.emit_notification("warning", msg);
    }

    async fn error(&self, msg: &str) {
        self.emit_notification("error", msg);
    }
}

impl<R: Runtime> TauriInterface<R> {
    fn emit_notification(&self, level: &str, message: &str) {
        let payload = serde_json::json!({
            "level": level,
            "message": utils::strip_ansi_escapes(message),
        });

        if let Err(e) = self
            .window
            .emit_to(self.window.label(), "pixi-api-notification", payload)
        {
            log::error!("Failed to emit notification: {}", e);
        }
    }
}
