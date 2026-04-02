import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
