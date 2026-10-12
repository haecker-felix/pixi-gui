use pixi_gui_server_macros::command;
use serde::Serialize;

use crate::context::Ctx;

/// Gets sent when pixi asks the user a question
#[derive(Clone, Serialize)]
pub struct ConfirmRequest {
    pub id: u64,
    pub message: String,
}

/// Answers a `confirm-request` event.
#[command]
pub fn answer_confirm(ctx: Ctx, id: u64, value: bool) {
    ctx.state.answer_confirm(&ctx.session, id, value);
}
