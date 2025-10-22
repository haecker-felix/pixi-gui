use log::error;

/// Relaunch via LaunchServices so the app inherits the bundle context (dock icon etc.)
/// and redirects the open event to the (possibly already running) app instance.
///
/// Returns true when the process got relaunched successfully.
pub fn relaunch_via_launchd(workspace: Option<&str>) -> bool {
    let mut command = std::process::Command::new("open");
    command.arg("-a").arg("Pixi GUI");

    if let Some(path) = workspace {
        command.arg(path);
    }

    if let Err(err) = command.status() {
        error!("Unable to start Pixi GUI via launchd: {err}");
        false
    } else {
        true
    }
}
