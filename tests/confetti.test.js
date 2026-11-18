/**
 * tests/confetti.test.js
 * Pure physics checks for assets/js/confetti.js (no DOM needed).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepParticle, isParticleAlive } from '../assets/js/confetti.js';

function makeParticle(overrides = {}) {
  return {
    x: 100, y: 500, vx: 200, vy: -800,
    size: 8, rot: 0, vr: 3, wobble: 0, wobbleSpeed: 8, sway: 20,
    shape: 'rect', color: 'x', life: 3,
    ...overrides
  };
}

test('stepParticle: confetti rises first, then gravity pulls it down', () => {
  const p = makeParticle();
  const startY = p.y;
  stepParticle(p, 0.1);
  assert.ok(p.y < startY, 'particle should still be moving upward after 0.1s');

  for (let i = 0; i < 40; i++) stepParticle(p, 0.05);
  assert.ok(p.vy > 0, 'after 2s gravity must have reversed the vertical velocity');
});

test('stepParticle: air drag slows horizontal speed and life counts down', () => {
  const p = makeParticle({ vx: 600 });
  stepParticle(p, 0.2);
  assert.ok(p.vx < 600 && p.vx > 0);
  assert.ok(Math.abs(p.life - 2.8) < 1e-9);
});

test('isParticleAlive: every particle eventually dies (life or off-screen)', () => {
  const p = makeParticle();
  let steps = 0;
  while (isParticleAlive(p, 800) && steps < 1000) {
    stepParticle(p, 1 / 60);
    steps++;
  }
  assert.ok(steps < 1000, 'particle must expire so the animation loop can stop');
  assert.equal(isParticleAlive(makeParticle({ life: 0 }), 800), false);
  assert.equal(isParticleAlive(makeParticle({ y: 900 }), 800), false);
});
