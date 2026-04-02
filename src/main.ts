import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { drawCat, createDefaultState } from "./sprites";
import { getEyeDirection } from "./eye-consumer";
import { AnimationLoop, BlinkScheduler } from "./animation";

const canvas = document.getElementById("cat-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const state = createDefaultState();
const SIZE = 200;

let windowX = 0;
let windowY = 0;
const appWindow = getCurrentWindow();

async function updateWindowPosition() {
  const pos = await appWindow.outerPosition();
  windowX = pos.x;
  windowY = pos.y;
}
updateWindowPosition();

let dirty = true;
function markDirty() { dirty = true; }

const loop = new AnimationLoop(() => {
  if (!dirty) return;
  drawCat(ctx, state, SIZE);
  dirty = false;
});
loop.start();
loop.setFps(4);

const blinker = new BlinkScheduler((frame) => {
  if (state.isIdle) {
    state.blinkFrame = frame;
    markDirty();
  }
});
blinker.start();

let idleTimeout: number | null = null;

function onActivity() {
  state.isIdle = false;
  state.blinkFrame = 0;
  loop.setFps(30);
  markDirty();
  if (idleTimeout) clearTimeout(idleTimeout);
  idleTimeout = window.setTimeout(() => {
    state.isIdle = true;
    state.leftHand = "up";
    state.rightHand = "up";
    state.eyeDir = "center";
    loop.setFps(4);
    markDirty();
  }, 3000);
}

listen<{ event_type: string; key: string; side: string }>("key-event", (e) => {
  if (e.payload.event_type === "keydown") {
    if (e.payload.side === "left") state.leftHand = "down";
    else if (e.payload.side === "right") state.rightHand = "down";
    else { state.leftHand = "down"; state.rightHand = "down"; }
  } else {
    if (e.payload.side === "left") state.leftHand = "up";
    else if (e.payload.side === "right") state.rightHand = "up";
    else { state.leftHand = "up"; state.rightHand = "up"; }
  }
  onActivity();
});

listen<{ event_type: string; button: string }>("mouse-event", (e) => {
  if (e.payload.event_type === "mousedown") {
    state.rightHand = "down";
  } else {
    state.rightHand = "up";
  }
  onActivity();
});

listen<{ x: number; y: number }>("cursor-event", (e) => {
  const catCenterX = windowX + SIZE / 2;
  const catCenterY = windowY + SIZE * 0.35;
  const newDir = getEyeDirection(e.payload.x, e.payload.y, catCenterX, catCenterY);
  if (newDir !== state.eyeDir) {
    state.eyeDir = newDir;
    markDirty();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    loop.stop();
  } else {
    loop.start();
  }
});

// 드래그 지원
canvas.addEventListener("mousedown", async (e) => {
  if (e.button === 0) {
    await appWindow.startDragging();
    await updateWindowPosition();
    await invoke("update_cat_bbox", {
      x: windowX, y: windowY, width: SIZE, height: SIZE,
    });
    await invoke("update_position", { x: windowX, y: windowY });
  }
});

// 초기 bbox 등록
(async () => {
  await updateWindowPosition();
  await invoke("update_cat_bbox", {
    x: windowX, y: windowY, width: SIZE, height: SIZE,
  });
})();

// 트레이 메뉴 이벤트
listen<string>("tray-action", async (e) => {
  const action = e.payload;
  switch (action) {
    case "reset_position": {
      // 우하단으로 이동
      const { currentMonitor } = await import("@tauri-apps/api/window");
      const monitor = await currentMonitor();
      if (monitor) {
        const x = monitor.size.width - SIZE - 20;
        const y = monitor.size.height - SIZE - 60;
        await appWindow.setPosition(new (await import("@tauri-apps/api/dpi")).LogicalPosition(x, y));
        await updateWindowPosition();
        await invoke("update_cat_bbox", { x: windowX, y: windowY, width: SIZE, height: SIZE });
        await invoke("update_position", { x: windowX, y: windowY });
      }
      break;
    }
    case "size_small":
    case "size_medium":
    case "size_large": {
      const sizeMap: Record<string, number> = {
        size_small: 150,
        size_medium: 200,
        size_large: 300,
      };
      const newSize = sizeMap[action];
      canvas.width = newSize;
      canvas.height = newSize;
      const { LogicalSize } = await import("@tauri-apps/api/dpi");
      await appWindow.setSize(new LogicalSize(newSize, newSize));
      // SIZE는 현재 const이므로 향후 리팩토링에서 동적으로 변경
      markDirty();
      break;
    }
    // color_cat, color_bg는 Rust 트레이에서 직접 팝업 창을 열음 (Task 10)
    default:
      break;
  }
});

// 이전 색상 (cancel 복원용)
let prevHue = 0;
let prevSat = 100;
let prevBright = 100;

// 색상 프리뷰 (실시간 반영)
listen<{ hue: number; saturate: number; brightness: number }>("color-preview", (e) => {
  canvas.style.filter = `hue-rotate(${e.payload.hue}deg) saturate(${e.payload.saturate}%) brightness(${e.payload.brightness}%)`;
});

// 색상 적용
listen<{ hue: number; saturate: number; brightness: number }>("color-apply", async (e) => {
  prevHue = e.payload.hue;
  prevSat = e.payload.saturate;
  prevBright = e.payload.brightness;
  canvas.style.filter = `hue-rotate(${prevHue}deg) saturate(${prevSat}%) brightness(${prevBright}%)`;
  // 설정 저장
  const config = await invoke<any>("get_config");
  config.cat_hue = prevHue;
  config.cat_saturate = prevSat;
  config.cat_brightness = prevBright;
  await invoke("set_config", { config });
});

// 색상 취소
listen("color-cancel", () => {
  canvas.style.filter = `hue-rotate(${prevHue}deg) saturate(${prevSat}%) brightness(${prevBright}%)`;
});
