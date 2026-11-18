/**
 * confetti.js - full-screen canvas confetti for the 'Selamat!' winner popup.
 *
 * - Uses ONE requestAnimationFrame loop that stops as soon as every particle is gone.
 * - Colours come from the site's CSS tokens (accent options + status colours), so
 *   confetti matches both Siang and Malam themes and the visitor's chosen accent.
 * - Three emitters: two cannons from the bottom corners plus a ribbon shower from the
 *   top, mixing paper rectangles, round dots, and long curly streamers.
 * - Skipped entirely under prefers-reduced-motion.
 * - `stepParticle` is a pure function so it can be tested with node --test.
 */

const GRAVITY = 980;       // px / s^2
const AIR_DRAG = 1.6;      // higher = slows down faster
const MAX_PARTICLES = 520;
const TOKEN_NAMES = [
  '--accent',
  '--acc-red',
  '--acc-periwinkle',
  '--acc-green',
  '--acc-teal',
  '--acc-orange',
  '--success',
  '--warning'
];

let canvas = null;
let ctx = null;
let particles = [];
let emitters = [];
let rafId = null;
let lastMs = 0;
let viewW = 0;
let viewH = 0;

/**
 * Advances one particle by `dt` seconds. Pure: returns the same object, mutated,
 * so tests can check the physics without a DOM.
 */
export function stepParticle(p, dt) {
  const drag = Math.exp(-AIR_DRAG * dt);
  p.vx *= drag;
  p.vy = p.vy * drag + GRAVITY * dt;
  p.x += p.vx * dt + Math.sin(p.wobble) * p.sway * dt;
  p.y += p.vy * dt;
  p.rot += p.vr * dt;
  p.wobble += p.wobbleSpeed * dt;
  p.life -= dt;
  return p;
}

export function isParticleAlive(p, height) {
  return p.life > 0 && p.y < height + 40;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const colors = TOKEN_NAMES.map((name) => style.getPropertyValue(name).trim()).filter(Boolean);
  return colors.length > 0 ? colors : ['#888888'];
}

function ensureCanvas() {
  canvas = document.getElementById('confetti-canvas');
  if (!canvas) return false;
  ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeParticle(x, y, angleDeg, speed, palette) {
  const angle = (angleDeg * Math.PI) / 180;
  const roll = Math.random();
  const shape = roll < 0.55 ? 'rect' : roll < 0.8 ? 'circle' : 'streamer';
  const size = shape === 'streamer' ? rand(14, 26) : rand(6, 11);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: -Math.sin(angle) * speed,
    size,
    rot: rand(0, Math.PI * 2),
    vr: rand(-9, 9),
    wobble: rand(0, Math.PI * 2),
    wobbleSpeed: rand(6, 14),
    sway: rand(10, 45),
    shape,
    color: palette[Math.floor(Math.random() * palette.length)],
    life: rand(2.6, 4.2)
  };
}

function drawParticle(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = Math.min(1, p.life / 0.7);
  ctx.fillStyle = p.color;
  const flip = Math.cos(p.wobble); // paper flutter: squash the piece as it tumbles

  if (p.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === 'streamer') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-p.size / 2, 0);
    ctx.quadraticCurveTo(0, p.size * 0.45 * flip, p.size / 2, 0);
    ctx.stroke();
  } else {
    ctx.scale(1, Math.max(0.15, Math.abs(flip)));
    ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5);
  }
  ctx.restore();
}

function frame(nowMs) {
  const dt = Math.min(0.05, (nowMs - lastMs) / 1000 || 0.016);
  lastMs = nowMs;
  const palette = readPalette();

  // Emitters release particles over time (cannons + top shower).
  for (const e of emitters) {
    if (e.remaining <= 0) continue;
    e.carry += e.rate * dt;
    while (e.carry >= 1 && e.remaining > 0 && particles.length < MAX_PARTICLES) {
      e.carry -= 1;
      e.remaining -= 1;
      const angle = e.angle + rand(-e.spread / 2, e.spread / 2);
      const speed = rand(e.speed * 0.6, e.speed * 1.15);
      const x = e.x + rand(-e.jitterX, e.jitterX);
      particles.push(makeParticle(x, e.y, angle, speed, palette));
    }
  }
  emitters = emitters.filter((e) => e.remaining > 0);

  ctx.clearRect(0, 0, viewW, viewH);
  const survivors = [];
  for (const p of particles) {
    stepParticle(p, dt);
    if (isParticleAlive(p, viewH)) {
      drawParticle(p);
      survivors.push(p);
    }
  }
  particles = survivors;

  if (particles.length > 0 || emitters.length > 0) {
    rafId = requestAnimationFrame(frame);
  } else {
    rafId = null;
    ctx.clearRect(0, 0, viewW, viewH);
  }
}

/** Clears any running confetti immediately (used when the popup closes). */
export function stopConfetti() {
  emitters = [];
  particles = [];
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (ctx) ctx.clearRect(0, 0, viewW, viewH);
}

/**
 * Fires the celebration: two bottom-corner cannons crossing in the middle plus a
 * ribbon shower from the top. Does nothing when the visitor prefers reduced motion.
 */
export function launchConfetti() {
  if (prefersReducedMotion()) return;
  if (!ensureCanvas()) return;

  stopConfetti();
  const w = viewW;
  const h = viewH;
  const power = Math.min(1, Math.max(0.65, h / 800));

  emitters = [
    { x: 0, y: h, angle: 62, spread: 28, speed: 1250 * power, rate: 150, remaining: 120, carry: 0, jitterX: 6 },
    { x: w, y: h, angle: 118, spread: 28, speed: 1250 * power, rate: 150, remaining: 120, carry: 0, jitterX: 6 },
    { x: w / 2, y: h * 0.55, angle: 90, spread: 70, speed: 900 * power, rate: 220, remaining: 70, carry: 0, jitterX: 30 },
    { x: w / 2, y: -20, angle: 270, spread: 140, speed: 160, rate: 60, remaining: 130, carry: 0, jitterX: w / 2 }
  ];

  lastMs = performance.now();
  rafId = requestAnimationFrame(frame);
}
