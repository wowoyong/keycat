// src/color-picker.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

const hueInput = document.getElementById("hue") as HTMLInputElement;
const satInput = document.getElementById("sat") as HTMLInputElement;
const lightInput = document.getElementById("light") as HTMLInputElement;
const hueVal = document.getElementById("hue-val")!;
const satVal = document.getElementById("sat-val")!;
const lightVal = document.getElementById("light-val")!;
const previewCircle = document.getElementById("preview-circle") as HTMLDivElement;

// Which target this picker is editing: "color_cat" | "color_bg"
let pickerTarget = "color_cat";

function updatePreviewCircle() {
  previewCircle.style.background = `hsl(${hueInput.value}, ${satInput.value}%, ${lightInput.value}%)`;
}

function emitPreview() {
  updatePreviewCircle();
  emit("color-preview", {
    target: pickerTarget,
    hue: Number(hueInput.value),
    saturation: Number(satInput.value),
    lightness: Number(lightInput.value),
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
lightInput.addEventListener("input", () => {
  lightVal.textContent = lightInput.value;
  emitPreview();
});

document.getElementById("btn-ok")!.addEventListener("click", async () => {
  await emit("color-apply", {
    target: pickerTarget,
    hue: Number(hueInput.value),
    saturation: Number(satInput.value),
    lightness: Number(lightInput.value),
  });
  await getCurrentWindow().close();
});

document.getElementById("btn-cancel")!.addEventListener("click", async () => {
  await emit("color-cancel", { target: pickerTarget });
  await getCurrentWindow().close();
});

// Listen for which target this picker is editing
listen<string>("color-picker-target", (e) => {
  pickerTarget = e.payload;
  init(); // target 결정 후 해당 값으로 슬라이더 초기화
});

// Load current config values into sliders
async function init() {
  const config = await invoke<{
    cat_hue: number;
    cat_saturation: number;
    cat_lightness: number;
    accent_hue: number;
    accent_saturation: number;
    accent_lightness: number;
  }>("get_config");

  // color_bg = accent color, color_cat = body color
  const h = pickerTarget === "color_bg" ? config.accent_hue : config.cat_hue;
  const s = pickerTarget === "color_bg" ? config.accent_saturation : config.cat_saturation;
  const l = pickerTarget === "color_bg" ? config.accent_lightness : config.cat_lightness;
  hueInput.value = String(h);
  satInput.value = String(s);
  lightInput.value = String(l);
  hueVal.textContent = String(h);
  satVal.textContent = String(s);
  lightVal.textContent = String(l);
  updatePreviewCircle();
}

init();
