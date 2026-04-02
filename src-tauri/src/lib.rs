mod config;
mod hit_test;
mod input_hook;
mod permissions;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let accessibility_ok = permissions::check_and_request_accessibility();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            hit_test::update_cat_bbox,
            config::get_config,
            config::set_config,
            config::update_position,
        ])
        .setup(move |app| {
            if accessibility_ok {
                input_hook::start_input_listener(app.handle().clone());
                log::info!("Input hook started");
            } else {
                log::warn!("Input hook skipped - no accessibility permission");
            }
            tray::setup_tray(app.handle())?;
            log::info!("Tray menu created");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
