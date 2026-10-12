fn main() {
    // Don't rerun build script on every change
    println!("cargo::rerun-if-changed=build.rs");

    // Release builds of the server embed the frontend
    let is_server = std::env::var_os("CARGO_FEATURE_SERVER").is_some();
    let is_release = std::env::var_os("CARGO_CFG_DEBUG_ASSERTIONS").is_none();
    if !is_server || !is_release {
        return;
    }

    #[cfg(feature = "server")]
    memory_serve::load_directory("../dist");
}
