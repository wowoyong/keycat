import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { drawCat, createDefaultState } from "./sprites";
import { getEyeDirection } from "./eye-consumer";

const canvas = document.getElementById("cat-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const state = createDefaultState();
const SIZE = 200;

drawCat(ctx, state, SIZE);

let windowX = 0;
let windowY = 0;
const appWindow = getCurrentWindow();

async function updateWindowPosition() {
  const pos = await appWindow.outerPosition();
  windowX = pos.x;
  windowY = pos.y;
}
updateWindowPosition();

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
  state.isIdle = false;
  resetIdleTimer();
  drawCat(ctx, state, SIZE);
});

listen<{ event_type: string; button: string }>("mouse-event", (e) => {
  if (e.payload.event_type === "mousedown") {
    state.rightHand = "down";
  } else {
    state.rightHand = "up";
  }
  state.isIdle = false;
  resetIdleTimer();
  drawCat(ctx, state, SIZE);
});

listen<{ x: number; y: number }>("cursor-event", (e) => {
  const catCenterX = windowX + SIZE / 2;
  const catCenterY = windowY + SIZE * 0.35;
  state.eyeDir = getEyeDirection(e.payload.x, e.payload.y, catCenterX, catCenterY);
  drawCat(ctx, state, SIZE);
});

let idleTimeout: number | null = null;

function resetIdleTimer() {
  if (idleTimeout) clearTimeout(idleTimeout);
  idleTimeout = window.setTimeout(() => {
    state.isIdle = true;
    state.eyeDir = "center";
    drawCat(ctx, state, SIZE);
  }, 3000);
}
