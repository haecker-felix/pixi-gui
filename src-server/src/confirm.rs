use pixi_gui_server_macros::command;
use serde::Serialize;

use crate::session::Session;

/// Gets sent when pixi asks the user a question
#[derive(Clone, Serialize)]
pub struct ConfirmRequest {
    pub id: u64,
    pub message: String,
}

/// Answers a `confirm-request` event.
#[command]
pub fn answer_confirm(session: Session, id: u64, value: bool) {
    session.answer_confirm(id, value);
}
