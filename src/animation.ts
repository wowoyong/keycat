export type RenderCallback = () => void;

export class AnimationLoop {
  private rafId = 0;
  private lastTime = 0;
  private targetInterval = 1000 / 30;
  private running = false;
  private render: RenderCallback;

  constructor(render: RenderCallback) {
    this.render = render;
  }

  setFps(fps: number) {
    this.targetInterval = fps > 0 ? 1000 / fps : Infinity;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = (now: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(tick);
      if (now - this.lastTime < this.targetInterval) return;
      this.lastTime = now;
      this.render();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}

export class BlinkScheduler {
  private blinkTimer: number | null = null;
  private onBlink: (frame: number) => void;

  constructor(onBlink: (frame: number) => void) {
    this.onBlink = onBlink;
  }

  start() {
    this.scheduleBlink();
  }

  stop() {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
  }

  private scheduleBlink() {
    const delay = 2000 + Math.random() * 3000;
    this.blinkTimer = window.setTimeout(() => {
      this.doBlink();
    }, delay);
  }

  private doBlink() {
    const frames = [1, 2, 1, 0];
    let i = 0;
    const step = () => {
      this.onBlink(frames[i]);
      i++;
      if (i < frames.length) {
        setTimeout(step, 60);
      } else {
        this.scheduleBlink();
      }
    };
    step();
  }
}
