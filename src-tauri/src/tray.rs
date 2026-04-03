// src-tauri/src/tray.rs
use tauri::{
    tray::TrayIconBuilder,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem},
    AppHandle, Emitter, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let color_cat = MenuItemBuilder::with_id("color_cat", "Body Color...").build(app)?;
    let color_bg = MenuItemBuilder::with_id("color_bg", "Accent Color...").build(app)?;

    let sep1 = PredefinedMenuItem::separator(app)?;

    let size_small = MenuItemBuilder::with_id("size_small", "Small (150px)").build(app)?;
    let size_medium = MenuItemBuilder::with_id("size_medium", "Medium (200px)").build(app)?;
    let size_large = MenuItemBuilder::with_id("size_large", "Large (300px)").build(app)?;
    let size_menu = SubmenuBuilder::with_id(app, "size", "Size")
        .items(&[&size_small, &size_medium, &size_large])
        .build()?;

    let reset_pos = MenuItemBuilder::with_id("reset_position", "Reset Position").build(app)?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    let auto_start = MenuItemBuilder::with_id("auto_start", "Start at Login").build(app)?;

    let sep3 = PredefinedMenuItem::separator(app)?;

    let toggle = MenuItemBuilder::with_id("toggle_visibility", "Show/Hide").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &color_cat, &color_bg, &sep1,
            &size_menu, &reset_pos, &sep2,
            &auto_start, &sep3,
            &toggle, &quit,
        ])
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("KeyCat")
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "quit" => app.exit(0),
                "toggle_visibility" => {
                    if let Some(win) = app.get_webview_window("main") {
                        if win.is_visible().unwrap_or(false) {
                            let _ = win.hide();
                        } else {
                            let _ = win.show();
                        }
                    }
                }
                "reset_position" => {
                    let _ = app.emit("tray-action", "reset_position");
                }
                "size_small" => { let _ = app.emit("tray-action", "size_small"); }
                "size_medium" => { let _ = app.emit("tray-action", "size_medium"); }
                "size_large" => { let _ = app.emit("tray-action", "size_large"); }
                "color_cat" | "color_bg" => {
                    let picker_id = event.id().as_ref();
                    let window_label = format!("color-picker-{}", picker_id);
                    // 이미 열린 창이 있으면 포커스
                    if let Some(win) = app.get_webview_window(&window_label) {
                        let _ = win.set_focus();
                        return;
                    }
                    let title = if picker_id == "color_cat" {
                        "KeyCat - Body Color"
                    } else {
                        "KeyCat - Accent Color"
                    };
                    let _picker = tauri::WebviewWindowBuilder::new(
                        app,
                        &window_label,
                        tauri::WebviewUrl::App("color-picker.html".into()),
                    )
                    .title(title)
                    .inner_size(250.0, 280.0)
                    .resizable(false)
                    .build();
                    // 어떤 색상을 편집 중인지 WebView에 알림
                    let _ = app.emit("color-picker-target", picker_id);
                }
                "auto_start" => { let _ = app.emit("tray-action", "auto_start"); }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
