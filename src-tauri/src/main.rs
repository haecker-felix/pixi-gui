// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{env, path::PathBuf};

use clap::Parser;

#[derive(Parser)]
#[command(version = option_env!("PIXI_GUI_VERSION").unwrap_or(env!("CARGO_PKG_VERSION")))]
#[command(about = env!("CARGO_PKG_DESCRIPTION"))]
struct Cli {
    /// Path to the Pixi workspace directory
    #[arg()]
    workspace: Option<PathBuf>,

    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    /// Disables automatic app relaunch using macOS LaunchServices
    #[arg(long)]
    no_relaunch: bool,
}

fn main() {
    // Disable DMA-BUF renderer for WebKit on Linux to avoid graphics glitches with AMDGPU drivers
    #[cfg(target_os = "linux")]
    unsafe {
        // Called before any threads are spawned and only set once -> safe.
        env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let cli = Cli::parse();

    // Ensure that workspace path is always absolute
    let workspace = cli.workspace.map(|path| {
        if path.is_absolute() {
            path.to_string_lossy().to_string()
        } else {
            let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            let absolute = cwd.join(&path);
            dunce::canonicalize(&absolute)
                .unwrap_or(absolute)
                .to_string_lossy()
                .to_string()
        }
    });

    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    if pixi_gui_lib::utils::launched_via_terminal()
        && !cli.no_relaunch
        && pixi_gui_lib::platform::osx::relaunch_via_launchd(workspace.as_deref())
    {
        return;
    }

    // See https://github.com/prefix-dev/pixi/blob/7a53925d6fa0bdc1019d17648f6e6aaa3ee02c9b/crates/pixi/src/main.rs#L7
    let main_stack_size = std::env::var("RUST_MIN_STACK")
        .ok()
        .and_then(|var| var.parse::<usize>().ok())
        .unwrap_or(0)
        .max(4 * 1024 * 1024);

    std::thread::Builder::new()
        .name("main2".to_string())
        .stack_size(main_stack_size)
        .spawn(move || pixi_gui_lib::run(workspace))
        .expect("Failed to spawn main thread")
        .join()
        .expect("Main thread panicked");
}
