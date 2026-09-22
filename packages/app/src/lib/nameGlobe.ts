import type { Person } from '@fairdraw/core';

export type GlobePhase = 'idle' | 'spinning' | 'slowing' | 'revealed';

interface Point3 {
  x: number;
  y: number;
  z: number;
  i: number;
}

export interface NameGlobeOptions {
  getPhase: () => GlobePhase;
  /** Vertical band (in canvas-local px) the sphere is allowed to occupy. */
  getBounds: () => { top: number; bottom: number };
  reducedMotion: boolean;
}

interface Mote {
  angle: number;
  radiusFactor: number;
  speed: number;
  size: number;
  phase: number;
}

function readAccentRgb(): string {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e3c383';
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '227,195,131';
  return [m[1]!, m[2]!, m[3]!].map((h) => parseInt(h, 16)).join(',');
}

/** Canvas-drawn pseudo-3D sphere of rotating names. Purely presentational — never the source of the actual draw. */
export class NameGlobe {
  private ctx: CanvasRenderingContext2D;
  private pool: Person[] = [];
  private points: Point3[] = [];
  private rotation = 0.3;
  private speed = 0.1;
  private last = 0;
  private width = 0;
  private height = 0;
  private stars = Array.from({ length: 85 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.2 + 0.3, phase: Math.random() * 6 }));
  private motes: Mote[] = Array.from({ length: 46 }, () => ({
    angle: Math.random() * Math.PI * 2,
    radiusFactor: 1.08 + Math.random() * 0.4,
    speed: (Math.random() * 0.35 + 0.08) * (Math.random() < 0.5 ? -1 : 1),
    size: Math.random() * 1.6 + 0.5,
    phase: Math.random() * 6,
  }));
  private accentRgb = '227,195,131';
  private frameId = 0;
  private resizeHandler = () => this.resize();

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: NameGlobeOptions,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法取得畫布內容，請改用支援 Canvas 2D 的瀏覽器。');
    this.ctx = ctx;
    this.accentRgb = readAccentRgb();
    this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.frameId = requestAnimationFrame((t) => this.frame(t));
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resizeHandler);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = r.width;
    this.height = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setPool(pool: Person[]): void {
    this.pool = pool;
    const n = Math.min(260, pool.length);
    if (this.points.length !== n) {
      this.points = Array.from({ length: n }, (_, i) => {
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const theta = i * Math.PI * (3 - Math.sqrt(5));
        return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r, i };
      });
    }
  }

  private frame(t: number): void {
    this.frameId = requestAnimationFrame((x) => this.frame(x));
    if (document.hidden) {
      this.last = t;
      return;
    }
    const dt = Math.min((t - this.last) / 1000 || 0.016, 0.06);
    this.last = t;
    if (!this.width || !this.height) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    for (const s of this.stars) {
      const a = 0.12 + 0.15 * (0.5 + 0.5 * Math.sin(t * 0.0005 + s.phase));
      ctx.fillStyle = 'rgba(218,207,167,' + a + ')';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.s, 0, Math.PI * 2);
      ctx.fill();
    }

    const { top, bottom } = this.opts.getBounds();
    const available = Math.max(bottom - top, 100);
    // Radius is a distance from the vertical center, so it must be bounded by HALF the
    // available band (not the full band) — plus headroom for the 1.2x near-point scale
    // and text/halo overflow, so the sphere never gets hard-clipped by the canvas edge.
    const radius = Math.min(w * 0.42, available * 0.5 * 0.98);
    const cx = w * 0.5;
    const cy = top + available * 0.5;

    const phase = this.opts.getPhase();
    const target = phase === 'spinning' ? (this.opts.reducedMotion ? 0.45 : 3.5) : phase === 'slowing' ? 0.008 : this.opts.reducedMotion ? 0 : 0.09;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt * (phase === 'slowing' ? 3.0 : 1.7)));
    this.rotation += dt * this.speed;

    const breathe = this.opts.reducedMotion ? 0 : Math.sin(t * 0.0009) * 0.02;
    const pulse = phase === 'spinning' ? 1 + Math.min(this.speed / 3.5, 1) * 0.03 : 1 + breathe;

    // Soft outer aura, tinted with the active accent color so re-skinned brands stay coherent.
    // Capped by the canvas's own bounds so it never gets clipped into a flat-edged box shape.
    const auraR = Math.min(radius * 1.75 * pulse, Math.min(cy - top, bottom - cy) - 2, w * 0.48);
    const aura = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, Math.max(auraR, radius * 1.05));
    aura.addColorStop(0, 'rgba(' + this.accentRgb + ',.16)');
    aura.addColorStop(0.55, 'rgba(' + this.accentRgb + ',.06)');
    aura.addColorStop(1, 'rgba(' + this.accentRgb + ',0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.75 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Drifting sparkle motes orbiting just outside the sphere surface.
    for (const m of this.motes) {
      if (!this.opts.reducedMotion) m.angle += m.speed * dt;
      const mr = radius * m.radiusFactor;
      const mx = cx + Math.cos(m.angle) * mr;
      const my = cy + Math.sin(m.angle) * mr * 0.62;
      const twinkle = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.0022 + m.phase));
      ctx.fillStyle = 'rgba(' + this.accentRgb + ',' + twinkle.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(mx, my, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(209,190,135,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.1 * pulse, radius * 1.1 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(139,191,177,.035)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.2, radius * 1.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(209,190,135,.075)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * 0.93, radius * 0.76, radius * 0.115, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Two counter-rotating comet-trail rings; the spin ring brightens and thickens with speed.
    const spinT = Math.min(this.speed / 3.5, 1);
    ctx.strokeStyle = 'rgba(' + this.accentRgb + ',' + (0.12 + spinT * 0.35).toFixed(3) + ')';
    ctx.lineWidth = 1.2 + spinT * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.12, t * 0.0016, t * 0.0016 + 0.55 + spinT * 0.5);
    ctx.stroke();
    if (spinT > 0.05) {
      ctx.strokeStyle = 'rgba(' + this.accentRgb + ',' + (spinT * 0.2).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.22, -t * 0.0011, -t * 0.0011 + 0.4);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, 'rgba(50,90,92,.10)');
    glow.addColorStop(1, 'rgba(50,90,92,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const a = this.rotation;
    const b = 0.14 + Math.sin(t * 0.00014) * 0.07;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    const points = this.points
      .map((p) => {
        const x = p.x * ca + p.z * sa;
        const z0 = p.z * ca - p.x * sa;
        const y = p.y * cb - z0 * sb;
        const z = p.y * sb + z0 * cb;
        return { x, y, z, i: p.i };
      })
      .sort((a, b) => a.z - b.z);

    const cycle = this.pool.length > 260 ? Math.floor(t / 4600) * 37 : 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontFamily = getComputedStyle(document.body).fontFamily;
    for (const p of points) {
      const d = (p.z + 1) / 2;
      const scale = 6 / (6 - p.z);
      const index = (Math.floor((p.i * this.pool.length) / Math.max(1, points.length)) + cycle) % this.pool.length;
      const person = this.pool[index];
      if (!person) continue;
      const name = Array.from(person.name).length > 9 ? Array.from(person.name).slice(0, 8).join('') + '…' : person.name;
      const fs = (10 + 8 * d) * Math.max(0.72, Math.min(1.3, radius / 190));
      ctx.font = (d > 0.7 ? '500 ' : '400 ') + fs.toFixed(1) + 'px ' + fontFamily;
      const alpha = 0.16 + 0.81 * Math.pow(d, 1.8);
      const px = cx + p.x * radius * scale;
      const py = cy + p.y * radius * scale;
      // Frontmost names get a soft glow behind them so the sphere reads as more than flat text.
      if (d > 0.86) {
        const haloR = fs * 1.4;
        const halo = ctx.createRadialGradient(px, py, 0, px, py, haloR);
        halo.addColorStop(0, 'rgba(' + this.accentRgb + ',' + (0.22 * (d - 0.86) * 7).toFixed(3) + ')');
        halo.addColorStop(1, 'rgba(' + this.accentRgb + ',0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, py, haloR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = p.i % 8 === 0 ? 'rgba(228,205,153,' + alpha + ')' : 'rgba(224,237,227,' + alpha + ')';
      ctx.fillText(name, px, py);
    }
  }
}
