export interface CatState {
  leftHand: "up" | "down";
  rightHand: "up" | "down";
  eyeDir: EyeDir;
  isIdle: boolean;
  blinkFrame: number;
  bodyColor: string;
  accentColor: string;
  breathPhase: number;
}

export type EyeDir =
  | "center"
  | "up" | "up-right" | "right" | "down-right"
  | "down" | "down-left" | "left" | "up-left";

const EYE_DIR: Record<EyeDir, [number, number]> = {
  center: [0, 0],
  up: [0, -1], "up-right": [0.7, -0.7], right: [1, 0], "down-right": [0.7, 0.7],
  down: [0, 1], "down-left": [-0.7, 0.7], left: [-1, 0], "up-left": [-0.7, -0.7],
};

// Bongo Cat 스타일 — 진한 갈색 아웃라인
const OL = "#4a3728";

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill: string | CanvasGradient | null, stroke: string | null, lw = 1,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// ---------------------------------------------------------------------------
// 키보드
// ---------------------------------------------------------------------------
function drawKeyboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sc: number) {
  // 그림자
  roundedRect(ctx, x + 3 * sc, y + 3 * sc, w, h, 8 * sc, "rgba(0,0,0,0.12)", null);

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "#e2e6ee");
  grad.addColorStop(1, "#d0d4dc");
  roundedRect(ctx, x, y, w, h, 8 * sc, grad, OL, 3 * sc);

  // 키
  const rows = 3, cols = 9;
  const px = 10 * sc, pt = 10 * sc, gx = 5 * sc, gy = 5 * sc;
  const kw = (w - px * 2 - gx * (cols - 1)) / cols;
  const kh = (h - pt * 2 - gy * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const off = r % 2 === 1 ? 4 * sc : 0;
      const kx = x + px + c * (kw + gx) + off;
      const ky = y + pt + r * (kh + gy);
      if (kx + kw > x + w - px + 2 * sc) continue;
      roundedRect(ctx, kx, ky + 1 * sc, kw, kh, 3 * sc, "rgba(0,0,0,0.06)", null);
      roundedRect(ctx, kx, ky, kw, kh, 3 * sc, "#f0f2f6", "rgba(80,60,50,0.18)", 1 * sc);
    }
  }
}

// ---------------------------------------------------------------------------
// 머리 — Bongo Cat 스타일: 매우 넓고 납작한 둥근 사각형 (빵/베개 형태)
// ---------------------------------------------------------------------------
function drawHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number, sc: number, color: string) {
  const r = hh * 0.65; // 매우 둥근 모서리

  ctx.beginPath();
  ctx.moveTo(cx - hw + r, cy - hh);
  ctx.lineTo(cx + hw - r, cy - hh);
  ctx.arcTo(cx + hw, cy - hh, cx + hw, cy - hh + r, r);
  ctx.lineTo(cx + hw, cy + hh - r * 0.6);
  ctx.quadraticCurveTo(cx + hw, cy + hh, cx + hw - r, cy + hh);
  // 아래턱 — 약간 아래로 볼록
  ctx.quadraticCurveTo(cx, cy + hh + hh * 0.15, cx - hw + r, cy + hh);
  ctx.quadraticCurveTo(cx - hw, cy + hh, cx - hw, cy + hh - r * 0.6);
  ctx.lineTo(cx - hw, cy - hh + r);
  ctx.arcTo(cx - hw, cy - hh, cx - hw + r, cy - hh, r);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 4.5 * sc;
  ctx.lineJoin = "round";
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 귀 — 머리 위에 작게 올라앉은 삼각형
// ---------------------------------------------------------------------------
function drawEar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sc: number, color: string, accent: string) {
  // 외곽
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.quadraticCurveTo(x + w * 0.15, y + h * 0.1, x + w * 0.5, y);
  ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.1, x + w, y + h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 4 * sc;
  ctx.lineJoin = "round";
  ctx.stroke();

  // 안쪽 핑크
  const inset = w * 0.22;
  ctx.beginPath();
  ctx.moveTo(x + inset, y + h - inset * 0.3);
  ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.3, x + w * 0.5, y + h * 0.25);
  ctx.quadraticCurveTo(x + w * 0.8, y + h * 0.3, x + w - inset, y + h - inset * 0.3);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// 발 — 둥근 팔 + 핑크 패드 + 젤리빈
// ---------------------------------------------------------------------------
function drawPaw(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sc: number,
  side: -1 | 1, // -1 = left, 1 = right
  color: string,
  showPad: boolean, // 발바닥 보이는 각도인지
  accent: string,
) {
  ctx.save();
  ctx.translate(x, y);

  const armW = 28 * sc;
  const armH = 38 * sc;

  // 팔 (둥근 타원형)
  ctx.beginPath();
  ctx.ellipse(0, 0, armW * 0.5, armH * 0.5, side * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 4 * sc;
  ctx.stroke();

  if (showPad) {
    // 큰 패드
    ctx.beginPath();
    ctx.ellipse(side * 2 * sc, 4 * sc, 10 * sc, 9 * sc, 0, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();

    // 젤리빈 3개
    const beans: [number, number][] = [
      [side * -6, -6],
      [side * 2, -9],
      [side * 10, -6],
    ];
    for (const [bx, by] of beans) {
      ctx.beginPath();
      ctx.ellipse(bx * sc, by * sc, 3.5 * sc, 4.5 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 얼굴 — 눈(갈색 점), 입(ω), 볼
// ---------------------------------------------------------------------------
function drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, sc: number, state: CatState) {
  const [dx, dy] = EYE_DIR[state.eyeDir];
  const em = 5 * sc;
  const ox = dx * em;
  const oy = dy * em;

  const eyeY = cy + 2 * sc;
  const leftX = cx - 22 * sc;
  const rightX = cx + 22 * sc;

  if (state.blinkFrame === 2) {
    // 감은 눈 — 작은 곡선
    ctx.strokeStyle = OL;
    ctx.lineWidth = 3.5 * sc;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(leftX, eyeY, 4 * sc, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightX, eyeY, 4 * sc, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  } else if (state.blinkFrame === 1) {
    ctx.fillStyle = OL;
    ctx.beginPath();
    ctx.ellipse(leftX + ox * 0.3, eyeY, 4.5 * sc, 2 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(rightX + ox * 0.3, eyeY, 4.5 * sc, 2 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 열린 눈 — 진한 갈색 원
    ctx.fillStyle = OL;
    ctx.beginPath();
    ctx.arc(leftX + ox, eyeY + oy, 5 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightX + ox, eyeY + oy, 5 * sc, 0, Math.PI * 2);
    ctx.fill();
  }

  // 볼 블러시 — 숨쉬기 애니메이션 (부풀었다 줄어듦)
  const breath = Math.sin(state.breathPhase);
  const cheekRx = (10 + breath * 1.5) * sc;
  const cheekRy = (7 + breath * 1.0) * sc;
  const cheekAlpha = 0.30 + breath * 0.08;
  ctx.globalAlpha = cheekAlpha;
  ctx.fillStyle = state.accentColor;
  ctx.beginPath();
  ctx.ellipse(cx - 42 * sc, cy + 10 * sc, cheekRx, cheekRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 42 * sc, cy + 10 * sc, cheekRx, cheekRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // ω 입 — Bongo Cat 특유의 물결 입
  const mY = cy + 12 * sc;
  ctx.strokeStyle = OL;
  ctx.lineWidth = 3.5 * sc;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 12 * sc, mY);
  ctx.quadraticCurveTo(cx - 7 * sc, mY + 7 * sc, cx - 1 * sc, mY + 2 * sc);
  ctx.quadraticCurveTo(cx, mY, cx + 1 * sc, mY + 2 * sc);
  ctx.quadraticCurveTo(cx + 7 * sc, mY + 7 * sc, cx + 12 * sc, mY);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export function drawCat(ctx: CanvasRenderingContext2D, state: CatState, size: number) {
  const s = size;
  const cx = s / 2;
  const sc = s / 300;

  ctx.clearRect(0, 0, s, s);

  // macOS 투명 창 클릭 가능하도록
  ctx.fillStyle = "rgba(0,0,0,0.01)";
  ctx.fillRect(0, 0, s, s);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const fur = state.bodyColor;

  // 레이아웃 — 숨쉬기: 머리가 살짝 커졌다 줄어듦
  const breath = Math.sin(state.breathPhase);
  const breathScale = 1 + breath * 0.02; // ±2% 크기 변화
  const headCy = s * 0.36;
  const headHW = s * 0.42 * breathScale;
  const headHH = s * 0.17 * breathScale;
  const kbY = s * 0.60;           // 키보드 Y

  // === 1. 키보드 ===
  const kbW = s * 0.92;
  const kbH = s * 0.19;
  drawKeyboard(ctx, (s - kbW) / 2, kbY, kbW, kbH, sc);

  // === 2. 머리 ===
  drawHead(ctx, cx, headCy, headHW, headHH, sc, fur);

  // === 3. 귀 (머리 위에) ===
  const earW = 26 * sc;
  const earH = 22 * sc;
  const earY = headCy - headHH - earH * 0.6;
  const accent = state.accentColor;
  drawEar(ctx, cx - headHW * 0.6 - earW * 0.2, earY, earW, earH, sc, fur, accent);
  drawEar(ctx, cx + headHW * 0.6 - earW * 0.8, earY, earW, earH, sc, fur, accent);

  // === 4. 얼굴 ===
  drawFace(ctx, cx, headCy + headHH * 0.15, sc, state);

  // === 5. 발 (맨 앞 — 키보드 위로) ===
  const pawBaseY = headCy + headHH + 10 * sc;
  const pawDownOff = 16 * sc;
  const pawUpOff = -4 * sc;
  const lDown = state.leftHand === "down";
  const rDown = state.rightHand === "down";

  // 왼발 — 바닥이 보이는 각도 (올라갔을 때)
  drawPaw(ctx,
    cx - headHW * 0.75,
    pawBaseY + (lDown ? pawDownOff : pawUpOff),
    sc, -1, fur, !lDown, accent,
  );

  // 오른발
  drawPaw(ctx,
    cx + headHW * 0.75,
    pawBaseY + (rDown ? pawDownOff : pawUpOff),
    sc, 1, fur, !rDown, accent,
  );
}

export function createDefaultState(): CatState {
  return {
    leftHand: "up",
    rightHand: "up",
    eyeDir: "center",
    isIdle: true,
    blinkFrame: 0,
    bodyColor: "hsl(0, 0%, 100%)",
    accentColor: "hsl(12, 71%, 78%)",
    breathPhase: 0,
  };
}
