mod config;
mod hit_test;
mod input_hook;
mod permissions;
mod tray;

#[tauri::command]
fn toggle_autostart(app: tauri::AppHandle, enabled: bool) {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    if enabled {
        let _ = autostart.enable();
        log::info!("Auto-start enabled");
    } else {
        let _ = autostart.disable();
        log::info!("Auto-start disabled");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let accessibility_ok = permissions::check_and_request_accessibility();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            hit_test::update_cat_bbox,
            config::get_config,
            config::set_config,
            config::update_position,
            toggle_autostart,
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
