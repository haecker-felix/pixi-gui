use std::{collections::HashMap, path::PathBuf, process::Command};

use which::which;

const KNOWN_EDITORS: &[(&str, &str)] = &[
    ("code", "Visual Studio Code"),
    ("cursor", "Cursor"),
    ("zed", "Zed"),
    ("subl", "Sublime Text"),
    ("charm", "PyCharm"),
    ("idea", "IntelliJ IDEA"),
    ("webstorm", "WebStorm"),
    ("rustrover", "RustRover"),
];

#[tauri::command]
pub fn list_available_editors() -> HashMap<String, String> {
    KNOWN_EDITORS
        .iter()
        .filter(|(command, _name)| which(command).is_ok())
        .map(|(command, name)| (command.to_string(), name.to_string()))
        .collect()
}

#[tauri::command]
pub fn open_in_editor(
    workspace: PathBuf,
    editor: String,
    environment: String,
) -> Result<(), String> {
    Command::new("pixi")
        .arg("run")
        .arg("--environment")
        .arg(&environment)
        .arg(&editor)
        .arg(".")
        .current_dir(&workspace)
        .spawn()
        .map_err(|e| format!("Failed to open editor: {}", e))?;

    Ok(())
}
