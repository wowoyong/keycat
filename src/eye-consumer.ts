import type { EyeDir } from "./sprites";

const DIRS: EyeDir[] = [
  "right", "down-right", "down", "down-left",
  "left", "up-left", "up", "up-right",
];

export function getEyeDirection(
  cursorX: number,
  cursorY: number,
  catCenterX: number,
  catCenterY: number,
): EyeDir {
  const dx = cursorX - catCenterX;
  const dy = cursorY - catCenterY;

  if (Math.abs(dx) < 50 && Math.abs(dy) < 50) return "center";

  const angle = Math.atan2(dy, dx);
  const idx = Math.round(angle / (Math.PI / 4)) & 7;
  return DIRS[idx];
}
