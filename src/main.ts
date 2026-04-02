import { listen } from "@tauri-apps/api/event";

const canvas = document.getElementById("cat-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

ctx.fillStyle = "#FF8C00";
ctx.beginPath();
ctx.arc(100, 100, 80, 0, Math.PI * 2);
ctx.fill();

listen<{ event_type: string; key: string; side: string }>("key-event", (e) => {
  console.log("KEY:", e.payload.event_type, e.payload.key, e.payload.side);
});

listen<{ event_type: string; button: string }>("mouse-event", (e) => {
  console.log("MOUSE:", e.payload.event_type, e.payload.button);
});

listen<{ x: number; y: number }>("cursor-event", (e) => {
  console.log("CURSOR:", e.payload.x, e.payload.y);
});
