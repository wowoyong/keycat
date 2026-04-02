mod permissions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let accessibility_ok = permissions::check_and_request_accessibility();
    if !accessibility_ok {
        log::warn!("Running without accessibility - input hooks will not work");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
