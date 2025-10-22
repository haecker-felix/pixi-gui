use crate::TauriInterface;
use pixi_api::{WorkspaceContext, workspace::InitOptions};
use tauri::{Runtime, Window};

#[tauri::command]
pub async fn init<R: Runtime>(window: Window<R>, options: InitOptions) -> Result<(), String> {
    let interface = TauriInterface::new(window);
    let _ = WorkspaceContext::init(interface, options)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
