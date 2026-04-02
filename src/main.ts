import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { drawCat, createDefaultState } from "./sprites";
import { getEyeDirection } from "./eye-consumer";
import { AnimationLoop, BlinkScheduler } from "./animation";

const canvas = document.getElementById("cat-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const state = createDefaultState();
const appWindow = getCurrentWindow();

let currentSize = 200;
let windowX = 0;
let windowY = 0;

// 이전 색상 (cancel 복원용)
let prevHue = 0;
let prevSat = 100;
let prevBright = 100;

async function updateWindowPosition() {
  const pos = await appWindow.outerPosition();
  windowX = pos.x;
  windowY = pos.y;
}

// 설정 로드 및 적용
async function init() {
  const config = await invoke<{
    cat_hue: number;
    cat_saturate: number;
    cat_brightness: number;
    size: string;
    position: [number, number];
  }>("get_config");

  // 크기 적용
  const sizeMap: Record<string, number> = { small: 150, medium: 200, large: 300 };
  currentSize = sizeMap[config.size] ?? 200;
  canvas.width = currentSize;
  canvas.height = currentSize;
  await appWindow.setSize(new LogicalSize(currentSize, currentSize));

  // 위치 적용
  await appWindow.setPosition(new LogicalPosition(config.position[0], config.position[1]));
  await updateWindowPosition();

  // 색상 적용
  prevHue = config.cat_hue;
  prevSat = config.cat_saturate;
  prevBright = config.cat_brightness;
  canvas.style.filter = `hue-rotate(${prevHue}deg) saturate(${prevSat}%) brightness(${prevBright}%)`;

  // bbox 등록
  await invoke("update_cat_bbox", {
    x: windowX, y: windowY, width: currentSize, height: currentSize,
  });

  // 초기 렌더링
  drawCat(ctx, state, currentSize);
}

let dirty = true;
function markDirty() { dirty = true; }

const loop = new AnimationLoop(() => {
  if (!dirty) return;
  drawCat(ctx, state, currentSize);
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
  const catCenterX = windowX + currentSize / 2;
  const catCenterY = windowY + currentSize * 0.35;
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
      x: windowX, y: windowY, width: currentSize, height: currentSize,
    });
    await invoke("update_position", { x: windowX, y: windowY });
  }
});

// 트레이 메뉴 이벤트
listen<string>("tray-action", async (e) => {
  const action = e.payload;
  switch (action) {
    case "reset_position": {
      // 우하단으로 이동
      const { currentMonitor } = await import("@tauri-apps/api/window");
      const monitor = await currentMonitor();
      if (monitor) {
        const x = monitor.size.width - currentSize - 20;
        const y = monitor.size.height - currentSize - 60;
        await appWindow.setPosition(new LogicalPosition(x, y));
        await updateWindowPosition();
        await invoke("update_cat_bbox", { x: windowX, y: windowY, width: currentSize, height: currentSize });
        await invoke("update_position", { x: windowX, y: windowY });
      }
      break;
    }
    case "size_small":
    case "size_medium":
    case "size_large": {
      const sizeNameMap: Record<string, string> = {
        size_small: "small", size_medium: "medium", size_large: "large",
      };
      const pixelMap: Record<string, number> = {
        size_small: 150, size_medium: 200, size_large: 300,
      };
      currentSize = pixelMap[action];
      canvas.width = currentSize;
      canvas.height = currentSize;
      await appWindow.setSize(new LogicalSize(currentSize, currentSize));
      drawCat(ctx, state, currentSize);
      // 설정 저장
      const config = await invoke<any>("get_config");
      config.size = sizeNameMap[action];
      await invoke("set_config", { config });
      // bbox 업데이트
      await updateWindowPosition();
      await invoke("update_cat_bbox", {
        x: windowX, y: windowY, width: currentSize, height: currentSize,
      });
      break;
    }
    case "auto_start": {
      const cfg = await invoke<any>("get_config");
      cfg.auto_start = !cfg.auto_start;
      await invoke("set_config", { config: cfg });
      await invoke("toggle_autostart", { enabled: cfg.auto_start });
      break;
    }
    // color_cat, color_bg는 Rust 트레이에서 직접 팝업 창을 열음 (Task 10)
    default:
      break;
  }
});

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

// 입력 훅 실패 시 알림
listen<string>("input-hook-failed", () => {
  console.error("Input hook failed - cat will be idle only");
  // 향후: 트레이 알림 표시
});

init();
