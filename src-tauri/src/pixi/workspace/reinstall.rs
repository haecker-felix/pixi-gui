use std::path::PathBuf;

use crate::{
    error::Error,
    utils::{self, spawn_local},
};
use pixi_api::{core::environment::LockFileUsage, workspace::ReinstallOptions};
use tauri::{Runtime, Window};

#[tauri::command]
pub async fn reinstall<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    options: ReinstallOptions,
    lock_file_usage: LockFileUsage,
) -> Result<(), Error> {
    spawn_local(move || async move {
        utils::workspace_context(window, workspace)?
            .reinstall(options, lock_file_usage)
            .await?;

        Ok(())
    })
    .await
}
