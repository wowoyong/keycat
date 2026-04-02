use rdev::{listen, Event, EventType, Key};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct KeyEvent {
    pub event_type: String,
    pub key: String,
    pub side: String,
}

#[derive(Clone, Serialize)]
pub struct MouseEvent {
    pub event_type: String,
    pub button: String,
}

#[derive(Clone, Serialize)]
pub struct CursorEvent {
    pub x: f64,
    pub y: f64,
}

fn classify_key_side(key: &Key) -> &'static str {
    match key {
        Key::KeyQ | Key::KeyW | Key::KeyE | Key::KeyR | Key::KeyT
        | Key::KeyA | Key::KeyS | Key::KeyD | Key::KeyF | Key::KeyG
        | Key::KeyZ | Key::KeyX | Key::KeyC | Key::KeyV | Key::KeyB
        | Key::Num1 | Key::Num2 | Key::Num3 | Key::Num4 | Key::Num5
        | Key::Tab | Key::CapsLock | Key::ShiftLeft | Key::ControlLeft
        | Key::Alt | Key::BackQuote => "left",

        Key::KeyY | Key::KeyU | Key::KeyI | Key::KeyO | Key::KeyP
        | Key::KeyH | Key::KeyJ | Key::KeyK | Key::KeyL
        | Key::KeyN | Key::KeyM
        | Key::Num6 | Key::Num7 | Key::Num8 | Key::Num9 | Key::Num0
        | Key::LeftBracket | Key::RightBracket | Key::BackSlash
        | Key::SemiColon | Key::Quote | Key::Comma | Key::Dot | Key::Slash
        | Key::ShiftRight | Key::ControlRight | Key::Backspace
        | Key::Return | Key::Delete => "right",

        Key::Space => "both",
        _ => "right",
    }
}

static LAST_CURSOR_EMIT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
const CURSOR_THROTTLE_MS: u64 = 33; // ~30Hz

pub fn start_input_listener(handle: AppHandle) {
    std::thread::spawn(move || {
        let result = listen(move |event: Event| {
            match event.event_type {
                EventType::KeyPress(key) => {
                    let payload = KeyEvent {
                        event_type: "keydown".into(),
                        key: format!("{:?}", key),
                        side: classify_key_side(&key).into(),
                    };
                    let _ = handle.emit("key-event", payload);
                }
                EventType::KeyRelease(key) => {
                    let payload = KeyEvent {
                        event_type: "keyup".into(),
                        key: format!("{:?}", key),
                        side: classify_key_side(&key).into(),
                    };
                    let _ = handle.emit("key-event", payload);
                }
                EventType::ButtonPress(btn) => {
                    let button = format!("{:?}", btn).to_lowercase();
                    let _ = handle.emit("mouse-event", MouseEvent {
                        event_type: "mousedown".into(),
                        button,
                    });
                }
                EventType::ButtonRelease(btn) => {
                    let button = format!("{:?}", btn).to_lowercase();
                    let _ = handle.emit("mouse-event", MouseEvent {
                        event_type: "mouseup".into(),
                        button,
                    });
                }
                EventType::MouseMove { x, y } => {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64;
                    let last = LAST_CURSOR_EMIT.load(std::sync::atomic::Ordering::Relaxed);
                    if now - last >= CURSOR_THROTTLE_MS {
                        LAST_CURSOR_EMIT.store(now, std::sync::atomic::Ordering::Relaxed);
                        let _ = handle.emit("cursor-event", CursorEvent { x, y });
                    }
                }
                EventType::Wheel { .. } => {}
            }
        });
        if let Err(e) = result {
            log::error!("rdev listen error: {:?}", e);
        }
    });
}
