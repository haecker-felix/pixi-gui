//! Tauri itself is cross-platform, but sometimes we need additional platform specific code for a better integration.

#[cfg(target_os = "macos")]
pub mod osx;
