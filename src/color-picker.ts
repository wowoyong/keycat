// src/color-picker.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

const hueInput = document.getElementById("hue") as HTMLInputElement;
const satInput = document.getElementById("sat") as HTMLInputElement;
const brightInput = document.getElementById("bright") as HTMLInputElement;
const hueVal = document.getElementById("hue-val")!;
const satVal = document.getElementById("sat-val")!;
const brightVal = document.getElementById("bright-val")!;

// Which target this picker is editing: "color_cat" | "color_bg"
let pickerTarget = "color_cat";

function emitPreview() {
  emit("color-preview", {
    target: pickerTarget,
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
    target: pickerTarget,
    hue: Number(hueInput.value),
    saturate: Number(satInput.value),
    brightness: Number(brightInput.value),
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
});

// Load current config values into sliders
async function init() {
  const config = await invoke<{
    cat_hue: number;
    cat_saturate: number;
    cat_brightness: number;
    background_color: string;
  }>("get_config");

  // Default to cat color values; bg picker will use hue/sat/bright
  // mapped from background_color if needed — for now load cat values
  // as bg color is stored as a CSS hex string, not HSB sliders.
  // Both pickers start from the cat color sliders; bg applies differently.
  hueInput.value = String(config.cat_hue);
  satInput.value = String(config.cat_saturate);
  brightInput.value = String(config.cat_brightness);
  hueVal.textContent = String(config.cat_hue);
  satVal.textContent = String(config.cat_saturate);
  brightVal.textContent = String(config.cat_brightness);
}

init();
