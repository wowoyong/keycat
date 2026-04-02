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
        let mut retries = 0;
        const MAX_RETRIES: u32 = 3;

        loop {
            let handle_clone = handle.clone();
            let result = listen(move |event: Event| {
                match event.event_type {
                    EventType::KeyPress(key) => {
                        let payload = KeyEvent {
                            event_type: "keydown".into(),
                            key: format!("{:?}", key),
                            side: classify_key_side(&key).into(),
                        };
                        let _ = handle_clone.emit("key-event", payload);
                    }
                    EventType::KeyRelease(key) => {
                        let payload = KeyEvent {
                            event_type: "keyup".into(),
                            key: format!("{:?}", key),
                            side: classify_key_side(&key).into(),
                        };
                        let _ = handle_clone.emit("key-event", payload);
                    }
                    EventType::ButtonPress(btn) => {
                        let button = format!("{:?}", btn).to_lowercase();
                        let _ = handle_clone.emit("mouse-event", MouseEvent {
                            event_type: "mousedown".into(),
                            button,
                        });
                    }
                    EventType::ButtonRelease(btn) => {
                        let button = format!("{:?}", btn).to_lowercase();
                        let _ = handle_clone.emit("mouse-event", MouseEvent {
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
                            let _ = handle_clone.emit("cursor-event", CursorEvent { x, y });
                            crate::hit_test::check_cursor_hit(&handle_clone, x, y);
                        }
                    }
                    EventType::Wheel { .. } => {}
                }
            });

            // rdev::listen()은 성공 시 영원히 블로킹, Err만 반환됨
            if let Err(e) = result {
                retries += 1;
                log::error!("rdev listen error (attempt {}/{}): {:?}", retries, MAX_RETRIES, e);
                if retries >= MAX_RETRIES {
                    log::error!("Input hook failed after {} retries, giving up", MAX_RETRIES);
                    let _ = handle.emit("input-hook-failed", "max retries exceeded");
                    break;
                }
                std::thread::sleep(std::time::Duration::from_secs(1));
            }
        }
    });
}
