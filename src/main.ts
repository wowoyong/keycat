import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { drawCat, createDefaultState, preloadImages, setSkin, getSkin } from "./sprites";
import { getEyeDirection } from "./eye-consumer";
import { AnimationLoop, BlinkScheduler } from "./animation";
import { WsClient } from "./ws-client";
import { addChatBubble } from "./chat";
import type { CatSkin } from "./sprites";
import type { ServerMessage } from "./ws-client";

const WS_URL = "ws://192.168.0.22:8765";

const canvas = document.getElementById("cat-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const state = createDefaultState();
const appWindow = getCurrentWindow();

let currentSize = 200;
let windowX = 0;
let windowY = 0;
let scaleFactor = 1;

// --- Peer state ---
interface PeerState {
  skin: CatSkin;
  x: number;
  y: number;
  active: boolean;
  name: string;
}
const peers = new Map<string, PeerState>();

// --- Chat input ---
let chatMode = false;
const chatOverlay = document.getElementById("chat-overlay") as HTMLDivElement;
const chatInputEl = document.getElementById("chat-input") as HTMLInputElement;

// --- WebSocket ---
let wsClient: WsClient | null = null;

function handleServerMessage(msg: ServerMessage) {
  switch (msg.type) {
    case "joined":
      for (const user of msg.users) {
        peers.set(user.userId, {
          skin: (user.skin || "orange") as CatSkin,
          x: user.x,
          y: user.y,
          active: user.active,
          name: user.name,
        });
      }
      break;
    case "user_joined":
      peers.set(msg.userId, {
        skin: (msg.skin || "orange") as CatSkin,
        x: 0.85,
        y: 0.85,
        active: false,
        name: msg.name,
      });
      break;
    case "user_left":
      peers.delete(msg.userId);
      break;
    case "state":
      if (peers.has(msg.userId)) {
        const peer = peers.get(msg.userId)!;
        peer.x = msg.x;
        peer.y = msg.y;
        peer.active = msg.active;
        if (msg.skin) peer.skin = msg.skin as CatSkin;
      }
      break;
    case "chat":
      addChatBubble(msg.userId, msg.name, msg.text);
      // Show own chat bubble too
      if (wsClient && msg.userId === wsClient.getUserId()) {
        state.chatText = msg.text;
        setTimeout(() => { state.chatText = null; }, 5000);
      }
      break;
  }
}

// --- Window position ---
async function updateWindowPosition() {
  const pos = await appWindow.outerPosition();
  windowX = pos.x;
  windowY = pos.y;
}

async function updateBbox() {
  await invoke("update_cat_bbox", {
    x: windowX / scaleFactor,
    y: windowY / scaleFactor,
    width: currentSize,
    height: currentSize,
  });
}

// --- Send position to server ---
function sendPositionToServer() {
  if (!wsClient?.isConnected()) return;
  const x = windowX / scaleFactor;
  const y = windowY / scaleFactor;
  wsClient.sendState(x, y, !state.isIdle);
}

// --- Init ---
async function init() {
  const config = await invoke<{
    cat_skin: string;
    size: string;
    position: [number, number];
  }>("get_config");

  const sizeMap: Record<string, number> = { small: 150, medium: 200, large: 300 };
  currentSize = sizeMap[config.size] ?? 200;
  canvas.width = currentSize;
  canvas.height = currentSize;
  await appWindow.setSize(new LogicalSize(currentSize, currentSize));

  const { currentMonitor, primaryMonitor, availableMonitors } = await import("@tauri-apps/api/window");
  let monitor = await currentMonitor();
  if (!monitor) monitor = await primaryMonitor();
  if (!monitor) {
    const all = await availableMonitors();
    if (all.length > 0) monitor = all[0];
  }
  let posX = config.position[0];
  let posY = config.position[1];
  if (monitor) {
    scaleFactor = monitor.scaleFactor ?? 1;
    const scale = scaleFactor;
    const maxX = monitor.size.width / scale - currentSize;
    const maxY = monitor.size.height / scale - currentSize;
    if (posX < 0 || posY < 0 || posX > maxX || posY > maxY) {
      posX = maxX - 20;
      posY = maxY - 60;
    }
  } else {
    posX = 1200;
    posY = 700;
  }
  await appWindow.setPosition(new LogicalPosition(posX, posY));
  await updateWindowPosition();

  const skin = (config.cat_skin || "orange") as CatSkin;
  setSkin(skin);

  await updateBbox();
  await preloadImages();
  drawCat(ctx, state, currentSize);
}

// --- Animation ---
const loop = new AnimationLoop(() => {
  state.breathPhase += 0.08;
  drawCat(ctx, state, currentSize);

});
loop.start();
loop.setFps(12);

const blinker = new BlinkScheduler(() => {});
blinker.start();

// --- Activity tracking ---
let idleTimeout: number | null = null;

function onActivity() {
  state.isIdle = false;
  loop.setFps(30);

  if (idleTimeout) clearTimeout(idleTimeout);
  idleTimeout = window.setTimeout(() => {
    state.isIdle = true;
    state.leftHand = "up";
    state.rightHand = "up";
    loop.setFps(12);
    sendPositionToServer();
  }, 3000);
}

// --- Keyboard events ---
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
  sendPositionToServer();
});

listen<{ event_type: string; button: string }>("mouse-event", (e) => {
  if (e.payload.event_type === "mousedown") {
    state.rightHand = "down";
  } else {
    state.rightHand = "up";
  }
  onActivity();
  sendPositionToServer();
});

listen<{ x: number; y: number }>("cursor-event", (e) => {
  const catCenterX = windowX / scaleFactor + currentSize / 2;
  const catCenterY = windowY / scaleFactor + currentSize * 0.35;
  getEyeDirection(e.payload.x, e.payload.y, catCenterX, catCenterY);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    loop.stop();
  } else {
    loop.start();
  }
});

// Drag support (single click = drag, double click = chat)
canvas.addEventListener("mousedown", async (e) => {
  if (e.button === 0 && !chatMode) {
    await appWindow.startDragging();
  }
});

canvas.addEventListener("dblclick", () => {
  if (!wsClient?.isConnected()) return;
  openChatInput();
});

function openChatInput() {
  chatMode = true;
  chatOverlay.style.display = "block";
  chatInputEl.value = "";
  chatInputEl.focus();
}

function closeChatInput() {
  chatMode = false;
  chatOverlay.style.display = "none";
  chatInputEl.blur();
}

chatInputEl.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") {
    const text = chatInputEl.value.trim();
    if (text && wsClient?.isConnected()) {
      wsClient.sendChat(text);
    }
    closeChatInput();
  } else if (e.key === "Escape") {
    closeChatInput();
  }
});

chatInputEl.addEventListener("blur", () => {
  closeChatInput();
});

// Window moved
appWindow.onMoved(async () => {
  await updateWindowPosition();
  await updateBbox();
  await invoke("update_position", { x: windowX / scaleFactor, y: windowY / scaleFactor });
  sendPositionToServer();
});

// --- Tray menu events ---
listen<string>("tray-action", async (e) => {
  const action = e.payload;
  switch (action) {
    case "reset_position": {
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
      const config = await invoke<any>("get_config");
      config.size = sizeNameMap[action];
      await invoke("set_config", { config });
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
    case "skin_orange":
    case "skin_gray": {
      const skin = action.replace("skin_", "") as CatSkin;
      setSkin(skin);
      if (wsClient) wsClient.updateSkin(skin);
      drawCat(ctx, state, currentSize);
      const cfg = await invoke<any>("get_config");
      cfg.cat_skin = skin;
      await invoke("set_config", { config: cfg });
      break;
    }
    default:
      break;
  }
});

// --- Room events from tray ---
listen<string>("room-join", (e) => {
  const roomCode = e.payload;
  if (!roomCode) return;

  const userName = "KeyCat User";
  wsClient = new WsClient(WS_URL, handleServerMessage);
  wsClient.join(roomCode, userName, getSkin());

  // Periodically send position
  setInterval(() => sendPositionToServer(), 2000);
});

listen<string>("room-leave", () => {
  if (wsClient) {
    wsClient.leave();
    wsClient = null;
    peers.clear();
  }
});

// Input hook failure
listen<string>("input-hook-failed", () => {
  console.error("Input hook failed - cat will be idle only");
});

init();
