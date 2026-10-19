/// The application the backend runs for, defined by the binary crates
#[derive(Debug, Clone, Copy)]
pub struct AppInfo {
    /// Human readable name, e.g. "Pixi GUI"
    pub name: &'static str,
    /// Reverse domain name, e.g. "dev.prefix.pixi-gui"
    pub identifier: &'static str,
}

#[macro_export]
macro_rules! app_info {
    () => {
        $crate::AppInfo {
            name: env!("DISPLAY_NAME"),
            identifier: concat!("dev.prefix.", env!("CARGO_PKG_NAME")),
        }
    };
}
