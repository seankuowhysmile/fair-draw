interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
}

/** Fires a burst of falling confetti rectangles from the given origin rect. Purely decorative — never touches draw state. */
export function fireConfetti(canvas: HTMLCanvasElement, origin: DOMRect, reducedMotion: boolean): void {
  if (reducedMotion) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = innerWidth;
  const h = innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = ['#e4c780', '#f7edcc', '#9cb6a2', '#c89956'];
  const pieces: Piece[] = Array.from({ length: 105 }, () => ({
    x: origin.left + origin.width / 2,
    y: origin.top + origin.height * 0.35,
    vx: (Math.random() - 0.5) * 15,
    vy: -Math.random() * 10 - 3,
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.12,
    size: Math.random() * 5 + 3,
    color: colors[Math.floor(Math.random() * colors.length)]!,
  }));

  let start = 0;
  let last = 0;
  let frameId = 0;
  function frame(t: number) {
    if (!start) start = t;
    const dt = Math.min((t - last) / 16.667 || 1, 2);
    last = t;
    ctx!.clearRect(0, 0, w, h);
    const alpha = Math.min(1, (4200 - (t - start)) / 900);
    if (alpha <= 0) return;
    for (const p of pieces) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.095 * dt;
      p.vx *= 0.995;
      p.rot += p.vr * dt;
      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.48);
      ctx!.restore();
    }
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  setTimeout(() => cancelAnimationFrame(frameId), 4300);
}
