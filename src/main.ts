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
let windowX = 0;   // physical pixels (from outerPosition)
let windowY = 0;   // physical pixels
let scaleFactor = 1; // monitor scale (physical/logical)

// 이전 색상 (cancel 복원용)
let prevHue = 0;
let prevSat = 0;
let prevLight = 100;
let prevAccentHue = 12;
let prevAccentSat = 71;
let prevAccentLight = 78;

async function updateWindowPosition() {
  const pos = await appWindow.outerPosition();
  windowX = pos.x;
  windowY = pos.y;
}

// CGEventTap 좌표(논리 pixels)와 맞추기 위해 물리→논리 변환
async function updateBbox() {
  await invoke("update_cat_bbox", {
    x: windowX / scaleFactor,
    y: windowY / scaleFactor,
    width: currentSize,
    height: currentSize,
  });
}

// 설정 로드 및 적용
async function init() {
  const config = await invoke<{
    cat_hue: number;
    cat_saturation: number;
    cat_lightness: number;
    accent_hue: number;
    accent_saturation: number;
    accent_lightness: number;
    size: string;
    position: [number, number];
  }>("get_config");

  // 크기 적용
  const sizeMap: Record<string, number> = { small: 150, medium: 200, large: 300 };
  currentSize = sizeMap[config.size] ?? 200;
  canvas.width = currentSize;
  canvas.height = currentSize;
  await appWindow.setSize(new LogicalSize(currentSize, currentSize));

  // 위치 적용 — 기본값(-1,-1)이면 화면 우하단 자동 계산
  const { currentMonitor, primaryMonitor, availableMonitors } = await import("@tauri-apps/api/window");
  let monitor = await currentMonitor();
  if (!monitor) monitor = await primaryMonitor();
  if (!monitor) {
    const all = await availableMonitors();
    if (all.length > 0) monitor = all[0];
  }
  let posX = config.position[0];
  let posY = config.position[1];
  console.log("[KeyCat] monitor:", monitor?.name, monitor?.size, "scale:", monitor?.scaleFactor);
  console.log("[KeyCat] config position:", posX, posY, "size:", currentSize);
  if (monitor) {
    scaleFactor = monitor.scaleFactor ?? 1;
    const scale = scaleFactor;
    const maxX = monitor.size.width / scale - currentSize;
    const maxY = monitor.size.height / scale - currentSize;
    console.log("[KeyCat] maxX:", maxX, "maxY:", maxY);
    // 화면 밖이거나 기본값(-1)이면 우하단으로 재배치
    if (posX < 0 || posY < 0 || posX > maxX || posY > maxY) {
      posX = maxX - 20;
      posY = maxY - 60;
    }
  } else {
    // monitor를 못 가져온 경우 fallback
    posX = 1200;
    posY = 700;
  }
  console.log("[KeyCat] final position:", posX, posY);
  await appWindow.setPosition(new LogicalPosition(posX, posY));
  await updateWindowPosition();

  // 색상 적용
  prevHue = config.cat_hue;
  prevSat = config.cat_saturation;
  prevLight = config.cat_lightness;
  state.bodyColor = `hsl(${prevHue}, ${prevSat}%, ${prevLight}%)`;
  prevAccentHue = config.accent_hue;
  prevAccentSat = config.accent_saturation;
  prevAccentLight = config.accent_lightness;
  state.accentColor = `hsl(${prevAccentHue}, ${prevAccentSat}%, ${prevAccentLight}%)`;

  // bbox 등록
  await updateBbox();

  // 초기 렌더링
  drawCat(ctx, state, currentSize);
}

// 숨쉬기 애니메이션 때문에 매 프레임 렌더
const loop = new AnimationLoop(() => {
  state.breathPhase += 0.08;
  drawCat(ctx, state, currentSize);
});
loop.start();
loop.setFps(12);

const blinker = new BlinkScheduler((frame) => {
  if (state.isIdle) {
    state.blinkFrame = frame;

  }
});
blinker.start();

let idleTimeout: number | null = null;

function onActivity() {
  state.isIdle = false;
  state.blinkFrame = 0;
  loop.setFps(30);

  if (idleTimeout) clearTimeout(idleTimeout);
  idleTimeout = window.setTimeout(() => {
    state.isIdle = true;
    state.leftHand = "up";
    state.rightHand = "up";
    state.eyeDir = "center";
    loop.setFps(12);

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
  const catCenterX = windowX / scaleFactor + currentSize / 2;
  const catCenterY = windowY / scaleFactor + currentSize * 0.35;
  const newDir = getEyeDirection(e.payload.x, e.payload.y, catCenterX, catCenterY);
  if (newDir !== state.eyeDir) {
    state.eyeDir = newDir;

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
  }
});

// 창 이동 완료 후 bbox + 설정 업데이트
appWindow.onMoved(async () => {
  await updateWindowPosition();
  await updateBbox();
  await invoke("update_position", { x: windowX / scaleFactor, y: windowY / scaleFactor });
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
        const x = monitor.size.width / (monitor.scaleFactor ?? 1) - currentSize - 20;
        const y = monitor.size.height / (monitor.scaleFactor ?? 1) - currentSize - 60;
        await appWindow.setPosition(new LogicalPosition(x, y));
        await updateWindowPosition();
        await updateBbox();
        await invoke("update_position", { x: windowX / scaleFactor, y: windowY / scaleFactor });
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
      await updateBbox();
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
listen<{ target: string; hue: number; saturation: number; lightness: number }>("color-preview", (e) => {
  if (e.payload.target === "color_bg") {
    state.accentColor = `hsl(${e.payload.hue}, ${e.payload.saturation}%, ${e.payload.lightness}%)`;
  } else {
    state.bodyColor = `hsl(${e.payload.hue}, ${e.payload.saturation}%, ${e.payload.lightness}%)`;
  }

});

// 색상 적용
listen<{ target: string; hue: number; saturation: number; lightness: number }>("color-apply", async (e) => {
  const config = await invoke<any>("get_config");
  if (e.payload.target === "color_bg") {
    prevAccentHue = e.payload.hue;
    prevAccentSat = e.payload.saturation;
    prevAccentLight = e.payload.lightness;
    state.accentColor = `hsl(${prevAccentHue}, ${prevAccentSat}%, ${prevAccentLight}%)`;
    config.accent_hue = prevAccentHue;
    config.accent_saturation = prevAccentSat;
    config.accent_lightness = prevAccentLight;
  } else {
    prevHue = e.payload.hue;
    prevSat = e.payload.saturation;
    prevLight = e.payload.lightness;
    state.bodyColor = `hsl(${prevHue}, ${prevSat}%, ${prevLight}%)`;
    config.cat_hue = prevHue;
    config.cat_saturation = prevSat;
    config.cat_lightness = prevLight;
  }

  await invoke("set_config", { config });
});

// 색상 취소
listen<{ target: string }>("color-cancel", (e) => {
  if (e.payload.target === "color_bg") {
    state.accentColor = `hsl(${prevAccentHue}, ${prevAccentSat}%, ${prevAccentLight}%)`;
  } else {
    state.bodyColor = `hsl(${prevHue}, ${prevSat}%, ${prevLight}%)`;
  }

});

// 입력 훅 실패 시 알림
listen<string>("input-hook-failed", () => {
  console.error("Input hook failed - cat will be idle only");
  // 향후: 트레이 알림 표시
});

init();
