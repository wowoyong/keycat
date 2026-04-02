mod input_hook;
mod permissions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let accessibility_ok = permissions::check_and_request_accessibility();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            if accessibility_ok {
                input_hook::start_input_listener(app.handle().clone());
                log::info!("Input hook started");
            } else {
                log::warn!("Input hook skipped - no accessibility permission");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
