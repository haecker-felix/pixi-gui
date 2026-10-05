use crate::error::format_error_chain;
use crate::frontend::Ctx;
use pixi_api::{WorkspaceContext, workspace::InitOptions};
use pixi_gui_server_macros::command;

#[command]
pub async fn init(ctx: Ctx, options: InitOptions) -> Result<(), String> {
    let _ = WorkspaceContext::init(ctx, options)
        .await
        .map_err(|e| format_error_chain(&e))?;
    Ok(())
}
