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
            // 투명 창에서 마우스 이벤트를 받으려면 명시적으로 설정 필요
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(false);
            }

            // 접근성 권한이 있으면 바로 시작, 없으면 백그라운드에서 대기 후 재시도
            let handle_for_hook = app.handle().clone();
            if accessibility_ok {
                input_hook::start_input_listener(handle_for_hook);
                log::info!("Input hook started");
            } else {
                log::warn!("Accessibility not granted yet, will retry in background");
                std::thread::spawn(move || {
                    // 5초마다 권한 체크, 최대 120초 대기
                    for _ in 0..24 {
                        std::thread::sleep(std::time::Duration::from_secs(5));
                        if permissions::check_accessibility_silent() {
                            log::info!("Accessibility granted! Starting input hook");
                            input_hook::start_input_listener(handle_for_hook);
                            return;
                        }
                    }
                    log::warn!("Gave up waiting for accessibility permission");
                });
            }
            tray::setup_tray(app.handle())?;
            log::info!("Tray menu created");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
