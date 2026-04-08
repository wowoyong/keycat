// Orange cat sprites
import { drawChatBubble } from "./chat";

import orangeLeft from "./assets/cats/orange/left.png";
import orangeRight from "./assets/cats/orange/right.png";
import orangeBoth from "./assets/cats/orange/both.png";
import orangeIdle from "./assets/cats/orange/idle.png";

// Gray cat sprites
import grayLeft from "./assets/cats/gray/left.png";
import grayRight from "./assets/cats/gray/right.png";
import grayBoth from "./assets/cats/gray/both.png";
import grayIdle from "./assets/cats/gray/idle.png";

export interface CatState {
  leftHand: "up" | "down";
  rightHand: "up" | "down";
  isIdle: boolean;
  breathPhase: number;
  chatText: string | null;
}

export type EyeDir =
  | "center"
  | "up" | "up-right" | "right" | "down-right"
  | "down" | "down-left" | "left" | "up-left";

export type CatSkin = "orange" | "gray";

// ---------------------------------------------------------------------------
// Image preload
// ---------------------------------------------------------------------------
const skinSources: Record<CatSkin, Record<string, string>> = {
  orange: { left: orangeLeft, right: orangeRight, both: orangeBoth, idle: orangeIdle },
  gray: { left: grayLeft, right: grayRight, both: grayBoth, idle: grayIdle },
};

const skins: Record<CatSkin, Record<string, HTMLImageElement>> = {
  orange: {},
  gray: {},
};

let currentSkin: CatSkin = "orange";
let imagesLoaded = false;

function loadImage(key: string, src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.error(`Failed to load image: ${key}`);
      resolve(img);
    };
    img.src = src;
  });
}

export async function preloadImages(): Promise<void> {
  for (const skin of Object.keys(skinSources) as CatSkin[]) {
    const sources = skinSources[skin];
    for (const [key, src] of Object.entries(sources)) {
      skins[skin][key] = await loadImage(`${skin}/${key}`, src);
    }
  }
  imagesLoaded = true;
}

export function setSkin(skin: CatSkin) {
  currentSkin = skin;
}

export function getSkin(): CatSkin {
  return currentSkin;
}

export const AVAILABLE_SKINS: CatSkin[] = ["orange", "gray"];

// ---------------------------------------------------------------------------
// Pick the right sprite based on hand state
// ---------------------------------------------------------------------------
function getSpriteKey(state: CatState): string {
  const lDown = state.leftHand === "down";
  const rDown = state.rightHand === "down";

  if (lDown && rDown) return "both";
  if (lDown) return "left";
  if (rDown) return "right";
  return "idle";
}

// ---------------------------------------------------------------------------
// Main draw
// ---------------------------------------------------------------------------
export function drawCat(ctx: CanvasRenderingContext2D, state: CatState, size: number, skinOverride?: CatSkin) {
  ctx.clearRect(0, 0, size, size);

  // macOS transparent window click-through prevention
  ctx.fillStyle = "rgba(0,0,0,0.01)";
  ctx.fillRect(0, 0, size, size);

  if (!imagesLoaded) return;

  const key = getSpriteKey(state);
  const useSkin = skinOverride ?? currentSkin;
  const img = skins[useSkin][key];
  if (!img) return;

  // Subtle breathing scale effect
  const breath = Math.sin(state.breathPhase);
  const scale = 1 + breath * 0.008;

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);

  const imgAspect = img.width / img.height;
  let drawW: number, drawH: number;

  if (imgAspect > 1) {
    drawW = size;
    drawH = size / imgAspect;
  } else {
    drawH = size;
    drawW = size * imgAspect;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Chat bubble above cat
  if (state.chatText) {
    const bubbleY = (size - drawH) / 2 - 5;
    drawChatBubble(ctx, state.chatText, size / 2, bubbleY, size);
  }
}

export function createDefaultState(): CatState {
  return {
    leftHand: "up",
    rightHand: "up",
    isIdle: true,
    breathPhase: 0,
    chatText: null,
  };
}
