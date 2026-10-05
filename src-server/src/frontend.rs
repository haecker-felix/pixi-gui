use miette::Result;
use pixi_api::Interface;
use serde::Serialize;
use tokio::sync::oneshot;

use crate::state::State;
use crate::utils;

/// The name of one frontend instance, i.e. who called a command.
/// One exists per window. On desktop this is the Tauri window label.
pub type SessionId = String;

/// How the backend reaches the frontend. One exists per process, held by [`State`].
pub trait Frontend: Send + Sync + 'static {
    /// Sends an event to the given frontend session.
    fn emit_event(&self, session: &str, event: &str, payload: serde_json::Value);

    /// Asks the user of the given session to confirm a message.
    fn confirm(&self, session: &str, message: &str) -> oneshot::Receiver<bool>;
}

/// What a single command call gets: the [`State`] plus the [`SessionId`]
/// of the caller. One exists per command call.
#[derive(Clone)]
pub struct Ctx {
    pub state: State,
    pub session: SessionId,
}

impl Ctx {
    pub fn new(state: State, session: impl Into<SessionId>) -> Self {
        Self {
            state,
            session: session.into(),
        }
    }

    /// Sends an event to the session this context belongs to.
    pub fn emit(&self, event: &str, payload: impl Serialize) {
        match serde_json::to_value(payload) {
            Ok(payload) => self
                .state
                .frontend()
                .emit_event(&self.session, event, payload),
            Err(e) => log::error!("Failed to serialize payload for event {event}: {e}"),
        }
    }
}

/// Forwards messages from pixi_api to the session that called the command.
impl Interface for Ctx {
    async fn is_cli(&self) -> bool {
        false
    }

    async fn confirm(&self, msg: &str) -> Result<bool> {
        let answer = self
            .state
            .frontend()
            .confirm(&self.session, &utils::strip_ansi_escapes(msg));

        // A dropped sender (e.g. the window is gone) counts as "no"
        Ok(answer.await.unwrap_or(false))
    }

    async fn info(&self, msg: &str) {
        emit_notification(self, "info", msg);
    }

    async fn success(&self, msg: &str) {
        emit_notification(self, "success", msg);
    }

    async fn warning(&self, msg: &str) {
        emit_notification(self, "warning", msg);
    }

    async fn error(&self, msg: &str) {
        emit_notification(self, "error", msg);
    }
}

fn emit_notification(ctx: &Ctx, level: &str, message: &str) {
    let payload = serde_json::json!({
        "level": level,
        "message": utils::strip_ansi_escapes(message),
    });

    ctx.emit("pixi-api-notification", payload);
}
