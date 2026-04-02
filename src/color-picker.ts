// src/color-picker.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";

const hueInput = document.getElementById("hue") as HTMLInputElement;
const satInput = document.getElementById("sat") as HTMLInputElement;
const brightInput = document.getElementById("bright") as HTMLInputElement;
const hueVal = document.getElementById("hue-val")!;
const satVal = document.getElementById("sat-val")!;
const brightVal = document.getElementById("bright-val")!;

function emitPreview() {
  emit("color-preview", {
    hue: Number(hueInput.value),
    saturate: Number(satInput.value),
    brightness: Number(brightInput.value),
  });
}

hueInput.addEventListener("input", () => {
  hueVal.textContent = hueInput.value;
  emitPreview();
});
satInput.addEventListener("input", () => {
  satVal.textContent = satInput.value;
  emitPreview();
});
brightInput.addEventListener("input", () => {
  brightVal.textContent = brightInput.value;
  emitPreview();
});

document.getElementById("btn-ok")!.addEventListener("click", async () => {
  await emit("color-apply", {
    hue: Number(hueInput.value),
    saturate: Number(satInput.value),
    brightness: Number(brightInput.value),
  });
  await getCurrentWindow().close();
});

document.getElementById("btn-cancel")!.addEventListener("click", async () => {
  await emit("color-cancel", {});
  await getCurrentWindow().close();
});
