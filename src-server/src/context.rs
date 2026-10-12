use miette::Result;
use pixi_api::Interface;

use crate::confirm::ConfirmRequest;
use crate::event::{Event, EventPayload};
use crate::notification::{Notification, NotificationLevel};
use crate::state::State;
use crate::utils;

/// The name of one frontend instance, i.e. who called a command.
/// One exists per window. On desktop this is the Tauri window label.
pub type SessionId = String;

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
    pub fn send_event(&self, payload: EventPayload) {
        let event = Event::new(&self.session, payload);
        let _ = self.state.event_sender().send(event);
    }
}

/// Forwards messages from pixi_api to the session that called the command.
impl Interface for Ctx {
    async fn is_cli(&self) -> bool {
        false
    }

    /// Asks the frontend with a `confirm-request` event; it answers with the
    /// `answer_confirm` command.
    async fn confirm(&self, msg: &str) -> Result<bool> {
        let (id, answer) = self.state.request_confirm(&self.session);

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
