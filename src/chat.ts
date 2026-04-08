export interface ChatBubble {
  text: string;
  name: string;
  expiresAt: number;
}

const BUBBLE_DURATION = 5000; // 5초 후 사라짐

// userId -> ChatBubble
const bubbles = new Map<string, ChatBubble>();

export function addChatBubble(userId: string, name: string, text: string) {
  bubbles.set(userId, {
    text,
    name,
    expiresAt: Date.now() + BUBBLE_DURATION,
  });
}

export function getChatBubble(userId: string): ChatBubble | null {
  const bubble = bubbles.get(userId);
  if (!bubble) return null;
  if (Date.now() > bubble.expiresAt) {
    bubbles.delete(userId);
    return null;
  }
  return bubble;
}

export function drawChatBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
) {
  const sc = size / 300;
  const fontSize = Math.max(11, 14 * sc);
  ctx.font = `bold ${fontSize}px -apple-system, "Segoe UI", sans-serif`;

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const padX = 8 * sc;
  const padY = 5 * sc;
  const bubbleW = textW + padX * 2;
  const bubbleH = fontSize + padY * 2;
  const tailH = 6 * sc;
  const radius = 8 * sc;

  const bx = x - bubbleW / 2;
  const by = y - bubbleH - tailH;

  // Bubble background
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.moveTo(bx + radius, by);
  ctx.lineTo(bx + bubbleW - radius, by);
  ctx.arcTo(bx + bubbleW, by, bx + bubbleW, by + radius, radius);
  ctx.lineTo(bx + bubbleW, by + bubbleH - radius);
  ctx.arcTo(bx + bubbleW, by + bubbleH, bx + bubbleW - radius, by + bubbleH, radius);
  // Tail
  ctx.lineTo(x + 6 * sc, by + bubbleH);
  ctx.lineTo(x, by + bubbleH + tailH);
  ctx.lineTo(x - 6 * sc, by + bubbleH);
  ctx.lineTo(bx + radius, by + bubbleH);
  ctx.arcTo(bx, by + bubbleH, bx, by + bubbleH - radius, radius);
  ctx.lineTo(bx, by + radius);
  ctx.arcTo(bx, by, bx + radius, by, radius);
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1 * sc;
  ctx.stroke();

  // Text
  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, by + bubbleH / 2);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}
