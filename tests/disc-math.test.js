/**
 * tests/disc-math.test.js
 * Deterministic tests for assets/js/disc-math.js covering N = 1, 2, 5, 40,
 * both wrap directions, bounded visible set within +/-70 deg, no wrap/overlap
 * for N = 1 and N = 2, and inertia that always terminates.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VISIBLE_ARC_DEG,
  MAX_VISIBLE_ITEMS,
  getDiscGeometry,
  normalizeRotation,
  snapRotationToNearest,
  rotationForIndex,
  getVisibleDiscItems,
  stepDiscInertia
} from '../assets/js/disc-math.js';

test('N = 1 and N = 2 have no wrap-around and no overlap', () => {
  // N = 1
  const g1 = getDiscGeometry(1);
  assert.equal(g1.wraps, false);
  assert.equal(normalizeRotation(120, 1), 0);
  const v1 = getVisibleDiscItems(1, 45);
  assert.equal(v1.length, 1);
  assert.equal(v1[0].index, 0);
  assert.equal(v1[0].angleDeg, 0);
  assert.equal(v1[0].scale, 1);
  assert.equal(v1[0].opacity, 1);
  assert.equal(v1[0].isFront, true);

  // N = 2: index 0 at 0 deg, index 1 at +step (or at 0 deg when rotated to -step)
  const g2 = getDiscGeometry(2);
  assert.equal(g2.wraps, false);
  const v2At0 = getVisibleDiscItems(2, 0);
  assert.equal(v2At0.length, 2);
  assert.notEqual(v2At0[0].angleDeg, v2At0[1].angleDeg, 'Two items must never share the same angle');
  assert.equal(v2At0[0].index, 0);
  assert.equal(v2At0[0].isFront, true);

  // Dragging far past the ends for N = 2 clamps instead of wrapping around
  assert.equal(snapRotationToNearest(500, 2).index, 0);
  assert.equal(snapRotationToNearest(-500, 2).index, 1);
});

test('Index/angle mapping, snapping, and wrap-around in both directions for N = 5 and N = 40', () => {
  for (const N of [5, 40]) {
    const geo = getDiscGeometry(N);
    assert.equal(geo.wraps, true);

    // Every index 0 .. N-1 maps cleanly to its rotation and snaps back to itself
    for (let i = 0; i < N; i++) {
      const rot = rotationForIndex(i, 0, N);
      const snap = snapRotationToNearest(rot + 3, N); // perturbed by +3 deg
      assert.equal(snap.index, i, `N=${N}: expected snap index ${i}, got ${snap.index}`);
    }

    // Wrap forward: stepping past index N-1 wraps to index 0
    const rotAfterLast = -N * geo.step;
    assert.equal(snapRotationToNearest(rotAfterLast, N).index, 0);

    // Wrap backward: stepping +1 step before index 0 wraps to index N-1
    const rotBeforeFirst = +1 * geo.step;
    assert.equal(snapRotationToNearest(rotBeforeFirst, N).index, N - 1);
  }
});

test('Visible set is strictly within +/-70 degrees and bounded for N = 1, 2, 5, 40', () => {
  for (const N of [1, 2, 5, 40]) {
    for (const rot of [0, -28, -95, 140, -520]) {
      const items = getVisibleDiscItems(N, rot);
      assert.ok(items.length >= 1, `N=${N} rot=${rot}: at least 1 visible item`);
      assert.ok(
        items.length <= Math.min(N, MAX_VISIBLE_ITEMS),
        `N=${N}: visible items (${items.length}) exceeded bound ${MAX_VISIBLE_ITEMS}`
      );
      for (const item of items) {
        assert.ok(
          Math.abs(item.angleDeg) <= VISIBLE_ARC_DEG + 0.001,
          `Item ${item.index} angle ${item.angleDeg} outside +/-${VISIBLE_ARC_DEG} deg`
        );
      }
      // Front item must be first, with largest scale and opacity
      assert.equal(items[0].isFront, true);
      if (items.length > 1) {
        assert.ok(items[0].scale >= items[items.length - 1].scale);
        assert.ok(items[0].opacity >= items[items.length - 1].opacity);
      }
    }
  }
});

test('stepDiscInertia always terminates in a finite number of steps and honors reducedMotion', () => {
  for (const N of [1, 2, 5, 40]) {
    for (const initialVelocity of [-480, -90, 0, 110, 600]) {
      let state = { rotation: -17, velocity: initialVelocity };
      let steps = 0;
      let result = null;
      while (steps < 400) {
        result = stepDiscInertia(state, N, 16.67);
        state = { rotation: result.rotation, velocity: result.velocity };
        steps++;
        if (result.done) break;
      }
      assert.equal(result.done, true, `Inertia did not terminate for N=${N}, vel=${initialVelocity}`);
      assert.equal(result.velocity, 0);
      assert.ok(result.activeIndex >= 0 && result.activeIndex < N);
    }

    // Reduced motion terminates on the very first step
    const instant = stepDiscInertia({ rotation: -25, velocity: 500 }, N, 16.67, { reducedMotion: true });
    assert.equal(instant.done, true);
    assert.equal(instant.velocity, 0);
  }
});
