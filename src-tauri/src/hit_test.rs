use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};

pub struct CatBBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub initialized: bool,
}

pub static CAT_BBOX: std::sync::OnceLock<Mutex<CatBBox>> = std::sync::OnceLock::new();

static WAS_INSIDE: AtomicBool = AtomicBool::new(true); // 시작 시 inside로 (드래그 가능)

fn get_bbox() -> &'static Mutex<CatBBox> {
    CAT_BBOX.get_or_init(|| Mutex::new(CatBBox {
        x: 0.0, y: 0.0, width: 200.0, height: 200.0, initialized: false,
    }))
}

#[tauri::command]
pub fn update_cat_bbox(x: f64, y: f64, width: f64, height: f64) {
    let mut bbox = get_bbox().lock().unwrap();
    bbox.x = x;
    bbox.y = y;
    bbox.width = width;
    bbox.height = height;
    bbox.initialized = true;
}

pub fn check_cursor_hit(handle: &AppHandle, cursor_x: f64, cursor_y: f64) {
    let bbox = get_bbox().lock().unwrap();
    // JS에서 bbox를 초기화하기 전엔 hit-test를 하지 않음
    if !bbox.initialized {
        return;
    }
    let inside = cursor_x >= bbox.x
        && cursor_x <= bbox.x + bbox.width
        && cursor_y >= bbox.y
        && cursor_y <= bbox.y + bbox.height;
    drop(bbox);

    let was = WAS_INSIDE.load(Ordering::Relaxed);
    if inside != was {
        WAS_INSIDE.store(inside, Ordering::Relaxed);
        if let Some(window) = handle.get_webview_window("main") {
            let _ = window.set_ignore_cursor_events(!inside);
        }
    }
}
