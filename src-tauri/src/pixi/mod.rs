use tauri::Runtime;
use tauri::Window;

pub mod workspace;

#[tauri::command]
pub async fn pixi_version<R: Runtime>(window: Window<R>) -> String {
    pixi_api::PIXI_VERSION.to_string()
}
#[tauri::command]
pub fn app_version() -> &'static str {
    option_env!("PIXI_GUI_VERSION").unwrap_or(env!("CARGO_PKG_VERSION"))
}
