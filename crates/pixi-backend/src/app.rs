/// The application the backend runs for, defined by the binary crates
#[derive(Debug, Clone, Copy)]
pub struct AppInfo {
    /// Human readable name
    pub name: &'static str,
    /// Short description
    pub description: &'static str,
    /// Version
    pub version: &'static str,
    /// Reverse domain name
    pub identifier: &'static str,
}

#[macro_export]
macro_rules! app_info {
    () => {
        $crate::AppInfo {
            name: env!("DISPLAY_NAME"),
            description: env!("CARGO_PKG_DESCRIPTION"),
            version: match option_env!("PIXI_APPS_VERSION") {
                Some(version) => version,
                None => env!("CARGO_PKG_VERSION"),
            },
            identifier: concat!("dev.prefix.", env!("CARGO_PKG_NAME")),
        }
    };
}
