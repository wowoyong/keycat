export interface CatState {
  leftHand: "up" | "down";
  rightHand: "up" | "down";
  eyeDir: EyeDir;
  isIdle: boolean;
  blinkFrame: number;
}

export type EyeDir =
  | "center"
  | "up" | "up-right" | "right" | "down-right"
  | "down" | "down-left" | "left" | "up-left";

const EYE_OFFSETS: Record<EyeDir, [number, number]> = {
  center: [0, 0],
  up: [0, -3], "up-right": [3, -3], right: [3, 0], "down-right": [3, 3],
  down: [0, 3], "down-left": [-3, 3], left: [-3, 0], "up-left": [-3, -3],
};

export function drawCat(ctx: CanvasRenderingContext2D, state: CatState, size: number) {
  const s = size;
  const cx = s / 2;
  ctx.clearRect(0, 0, s, s);

  ctx.fillStyle = "#FF8C00";
  ctx.beginPath();
  ctx.ellipse(cx, s * 0.6, s * 0.35, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, s * 0.35, s * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, s * 0.18);
  ctx.lineTo(cx - s * 0.12, s * 0.05);
  ctx.lineTo(cx - s * 0.05, s * 0.18);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.05, s * 0.18);
  ctx.lineTo(cx + s * 0.12, s * 0.05);
  ctx.lineTo(cx + s * 0.2, s * 0.18);
  ctx.fill();

  const eyeY = s * 0.33;
  const leftEyeX = cx - s * 0.1;
  const rightEyeX = cx + s * 0.1;
  const [ox, oy] = EYE_OFFSETS[state.eyeDir];

  if (state.blinkFrame === 2) {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 4, eyeY);
    ctx.lineTo(leftEyeX + 4, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightEyeX - 4, eyeY);
    ctx.lineTo(rightEyeX + 4, eyeY);
    ctx.stroke();
  } else if (state.blinkFrame === 1) {
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(leftEyeX + ox, eyeY + oy, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightEyeX + ox, eyeY + oy, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(leftEyeX + ox, eyeY + oy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + ox, eyeY + oy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#FF69B4";
  ctx.beginPath();
  ctx.arc(cx, s * 0.39, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, s * 0.41);
  ctx.lineTo(cx - 4, s * 0.44);
  ctx.moveTo(cx, s * 0.41);
  ctx.lineTo(cx + 4, s * 0.44);
  ctx.stroke();

  const handY = s * 0.75;
  const leftHandX = cx - s * 0.25;
  const rightHandX = cx + s * 0.25;

  ctx.fillStyle = "#FF8C00";
  const leftHandYOffset = state.leftHand === "down" ? s * 0.08 : 0;
  ctx.beginPath();
  ctx.ellipse(leftHandX, handY + leftHandYOffset, s * 0.08, s * 0.06, -0.3, 0, Math.PI * 2);
  ctx.fill();

  const rightHandYOffset = state.rightHand === "down" ? s * 0.08 : 0;
  ctx.beginPath();
  ctx.ellipse(rightHandX, handY + rightHandYOffset, s * 0.08, s * 0.06, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

export function createDefaultState(): CatState {
  return {
    leftHand: "up",
    rightHand: "up",
    eyeDir: "center",
    isIdle: true,
    blinkFrame: 0,
  };
}
