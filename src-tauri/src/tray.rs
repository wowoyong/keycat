// src-tauri/src/tray.rs
use tauri::{
    tray::TrayIconBuilder,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem},
    AppHandle, Emitter, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Character selection
    let skin_orange = MenuItemBuilder::with_id("skin_orange", "\u{1F7E0} Orange Cat").build(app)?;
    let skin_gray = MenuItemBuilder::with_id("skin_gray", "\u{1F504} Gray Cat").build(app)?;
    let skin_menu = SubmenuBuilder::with_id(app, "skin", "Character")
        .items(&[&skin_orange, &skin_gray])
        .build()?;

    let sep1 = PredefinedMenuItem::separator(app)?;

    // Room
    let room_join = MenuItemBuilder::with_id("room_join", "Join Room...").build(app)?;
    let room_leave = MenuItemBuilder::with_id("room_leave", "Leave Room").build(app)?;
    let room_menu = SubmenuBuilder::with_id(app, "room", "Room")
        .items(&[&room_join, &room_leave])
        .build()?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    // Size
    let size_small = MenuItemBuilder::with_id("size_small", "Small (150px)").build(app)?;
    let size_medium = MenuItemBuilder::with_id("size_medium", "Medium (200px)").build(app)?;
    let size_large = MenuItemBuilder::with_id("size_large", "Large (300px)").build(app)?;
    let size_menu = SubmenuBuilder::with_id(app, "size", "Size")
        .items(&[&size_small, &size_medium, &size_large])
        .build()?;

    let reset_pos = MenuItemBuilder::with_id("reset_position", "Reset Position").build(app)?;

    let sep3 = PredefinedMenuItem::separator(app)?;

    let auto_start = MenuItemBuilder::with_id("auto_start", "Start at Login").build(app)?;

    let sep4 = PredefinedMenuItem::separator(app)?;

    let toggle = MenuItemBuilder::with_id("toggle_visibility", "Show/Hide").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &skin_menu, &sep1,
            &room_menu, &sep2,
            &size_menu, &reset_pos, &sep3,
            &auto_start, &sep4,
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
                "skin_orange" => { let _ = app.emit("tray-action", "skin_orange"); }
                "skin_gray" => { let _ = app.emit("tray-action", "skin_gray"); }
                "auto_start" => { let _ = app.emit("tray-action", "auto_start"); }
                "room_join" => {
                    // Open a small input window for room code
                    let window_label = "room-input";
                    if let Some(win) = app.get_webview_window(window_label) {
                        let _ = win.set_focus();
                        return;
                    }
                    let _ = tauri::WebviewWindowBuilder::new(
                        app,
                        window_label,
                        tauri::WebviewUrl::App("room-input.html".into()),
                    )
                    .title("Join Room")
                    .inner_size(280.0, 150.0)
                    .resizable(false)
                    .build();
                }
                "room_leave" => {
                    let _ = app.emit("room-leave", "");
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
