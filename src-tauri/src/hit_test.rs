use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct CatBBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub static CAT_BBOX: std::sync::OnceLock<Mutex<CatBBox>> = std::sync::OnceLock::new();

fn get_bbox() -> &'static Mutex<CatBBox> {
    CAT_BBOX.get_or_init(|| Mutex::new(CatBBox {
        x: 0.0, y: 0.0, width: 200.0, height: 200.0,
    }))
}

#[tauri::command]
pub fn update_cat_bbox(x: f64, y: f64, width: f64, height: f64) {
    let mut bbox = get_bbox().lock().unwrap();
    bbox.x = x;
    bbox.y = y;
    bbox.width = width;
    bbox.height = height;
}

pub fn check_cursor_hit(handle: &AppHandle, cursor_x: f64, cursor_y: f64) {
    let bbox = get_bbox().lock().unwrap();
    let inside = cursor_x >= bbox.x
        && cursor_x <= bbox.x + bbox.width
        && cursor_y >= bbox.y
        && cursor_y <= bbox.y + bbox.height;

    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(!inside);
    }
}
