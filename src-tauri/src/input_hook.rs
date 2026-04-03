use serde::Serialize;
use tauri::{AppHandle, Emitter};
use std::sync::atomic::{AtomicU64, Ordering};

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

static LAST_CURSOR_EMIT: AtomicU64 = AtomicU64::new(0);
const CURSOR_THROTTLE_MS: u64 = 33;

fn classify_keycode_side(keycode: u16) -> &'static str {
    // macOS virtual keycodes
    // Left side: Q(12) W(13) E(14) R(15) T(17) A(0) S(1) D(2) F(3) G(5)
    //            Z(6) X(7) C(8) V(9) B(11) 1(18) 2(19) 3(20) 4(21) 5(23)
    //            Tab(48) CapsLock(57) LShift(56) LCtrl(59) LAlt(58) `(50)
    // Right side: Y(16) U(32) I(34) O(31) P(35) [(33) ](30) \(42)
    //             H(4) J(38) K(40) L(37) ;(41) '(39)
    //             N(45) M(46) ,(43) .(47) /(44)
    //             6(22) 7(26) 8(28) 9(25) 0(29) -(27) =(24)
    //             Delete(51) Return(36) RShift(60)
    match keycode {
        12 | 13 | 14 | 15 | 17 |     // Q W E R T
        0 | 1 | 2 | 3 | 5 |          // A S D F G
        6 | 7 | 8 | 9 | 11 |         // Z X C V B
        18 | 19 | 20 | 21 | 23 |     // 1 2 3 4 5
        48 | 57 | 56 | 59 | 58 | 50  // Tab Caps LShift LCtrl LAlt `
        => "left",

        16 | 32 | 34 | 31 | 35 | 33 | 30 | 42 | // Y U I O P [ ] backslash
        4 | 38 | 40 | 37 | 41 | 39 |              // H J K L ; '
        45 | 46 | 43 | 47 | 44 |                   // N M , . /
        22 | 26 | 28 | 25 | 29 | 27 | 24 |        // 6 7 8 9 0 - =
        51 | 36 | 117 | 60 | 61 | 62               // Del Return Fn RShift RCtrl RAlt
        => "right",

        49 => "both", // Space
        _ => "right",
    }
}

pub fn start_input_listener(handle: AppHandle) {
    std::thread::spawn(move || {
        unsafe {
            use core_foundation::runloop::{CFRunLoop, kCFRunLoopCommonModes};
            use core_graphics::event::{
                CGEventTap, CGEventTapLocation, CGEventTapPlacement,
                CGEventTapOptions, CGEventType,
            };

            let handle_clone = handle.clone();

            let tap = CGEventTap::new(
                CGEventTapLocation::HID,
                CGEventTapPlacement::HeadInsertEventTap,
                CGEventTapOptions::ListenOnly,
                vec![
                    CGEventType::KeyDown,
                    CGEventType::KeyUp,
                    CGEventType::LeftMouseDown,
                    CGEventType::LeftMouseUp,
                    CGEventType::RightMouseDown,
                    CGEventType::RightMouseUp,
                    CGEventType::MouseMoved,
                    CGEventType::FlagsChanged,
                ],
                move |_proxy, event_type, event| {
                    let h = &handle_clone;
                    match event_type {
                        CGEventType::KeyDown => {
                            let keycode = event.get_integer_value_field(
                                core_graphics::event::EventField::KEYBOARD_EVENT_KEYCODE
                            ) as u16;
                            let _ = h.emit("key-event", KeyEvent {
                                event_type: "keydown".into(),
                                key: format!("kc{}", keycode),
                                side: classify_keycode_side(keycode).into(),
                            });
                        }
                        CGEventType::KeyUp => {
                            let keycode = event.get_integer_value_field(
                                core_graphics::event::EventField::KEYBOARD_EVENT_KEYCODE
                            ) as u16;
                            let _ = h.emit("key-event", KeyEvent {
                                event_type: "keyup".into(),
                                key: format!("kc{}", keycode),
                                side: classify_keycode_side(keycode).into(),
                            });
                        }
                        CGEventType::LeftMouseDown | CGEventType::RightMouseDown => {
                            let _ = h.emit("mouse-event", MouseEvent {
                                event_type: "mousedown".into(),
                                button: "left".into(),
                            });
                        }
                        CGEventType::LeftMouseUp | CGEventType::RightMouseUp => {
                            let _ = h.emit("mouse-event", MouseEvent {
                                event_type: "mouseup".into(),
                                button: "left".into(),
                            });
                        }
                        CGEventType::MouseMoved => {
                            let loc = event.location();
                            let now = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64;
                            let last = LAST_CURSOR_EMIT.load(Ordering::Relaxed);
                            if now - last >= CURSOR_THROTTLE_MS {
                                LAST_CURSOR_EMIT.store(now, Ordering::Relaxed);
                                let _ = h.emit("cursor-event", CursorEvent {
                                    x: loc.x, y: loc.y,
                                });
                                crate::hit_test::check_cursor_hit(h, loc.x, loc.y);
                            }
                        }
                        _ => {}
                    }
                    None // don't modify the event (listen-only)
                },
            );

            match tap {
                Ok(tap) => {
                    let loop_source = tap.mach_port
                        .create_runloop_source(0)
                        .expect("Failed to create runloop source");
                    let run_loop = CFRunLoop::get_current();
                    run_loop.add_source(&loop_source, kCFRunLoopCommonModes);
                    tap.enable();
                    log::info!("CGEventTap started successfully");
                    CFRunLoop::run_current();
                }
                Err(()) => {
                    log::error!("Failed to create CGEventTap — accessibility permission?");
                    let _ = handle.emit("input-hook-failed", "CGEventTap creation failed");
                }
            }
        }
    });
}
