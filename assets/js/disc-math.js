/**
 * disc-math.js - pure math for the "Piringan Momen" draggable disc gallery.
 * Zero DOM access (safe to import directly in node --test).
 *
 * Geometry & rules (Part 4.4):
 * - A large circle whose center sits below the visible stage, so the top arc
 *   (around angle 0 deg at 12 o'clock) shows like half a record platter.
 * - Photos sit on the rim at `angle = i * step + rotation` (wrapped for N >= 3,
 *   clamped without wrap for N = 1 or N = 2 so 1 or 2 items never wrap or overlap).
 * - Only items within `VISIBLE_ARC_DEG` (70 degrees) of the top are rendered;
 *   moreover the visible set is bounded to at most `MAX_VISIBLE_ITEMS` nearest
 *   to the front.
 * - Front item (angle 0) is larger (`scale = 1`) and fully opaque (`opacity = 1`);
 *   side items are smaller and dimmer.
 * - Inertia uses exponential friction and spring snap to the nearest item, and
 *   always terminates in a finite number of steps (`done = true`).
 */

export const VISIBLE_ARC_DEG = 70;
export const DEFAULT_STEP_DEG = 28;
export const MAX_VISIBLE_ITEMS = 7;

/**
 * Positive modulo in `[0, m)`.
 */
export function modPositive(value, m) {
  if (!(m > 0) || !Number.isFinite(value)) return 0;
  return ((value % m) + m) % m;
}

/**
 * Wraps `value` symmetrically into `[-period / 2, period / 2)`.
 */
export function wrapSymmetric(value, period = 360) {
  if (!(period > 0) || !Number.isFinite(value)) return 0;
  const half = period / 2;
  return modPositive(value + half, period) - half;
}

/**
 * Angular spacing (in degrees) between adjacent items on the disc rim,
 * plus the total virtual ring circumference `ringPeriod` in degrees.
 *
 * - For `count <= 1`: `{ step: 0, wraps: false, ringPeriod: 360 }`
 * - For `count === 2`: `{ step: 36, wraps: false, ringPeriod: 360 }` (no wrap or overlap)
 * - For `count >= 3`: `{ step, wraps: true, ringPeriod: count * step }` where `step` is
 *   chosen so adjacent cards on the visible top arc never overlap (`24..36` deg),
 *   and `ringPeriod = count * step` is the full loop of all `count` items.
 */
export function getDiscGeometry(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 1) {
    return { count: n, step: 0, wraps: false, minRotation: 0, maxRotation: 0, ringPeriod: 360 };
  }
  if (n === 2) {
    const step = 36;
    return {
      count: 2,
      step,
      wraps: false,
      minRotation: -step,
      maxRotation: 0,
      ringPeriod: 360
    };
  }
  // For N >= 3, keep step between 24° and 36° so photos on the visible +/-70° arc
  // have comfortable spacing regardless of whether N is 5 or 40.
  const naturalStep = 360 / n;
  const step = Math.min(36, Math.max(24, naturalStep > 28 ? 32 : DEFAULT_STEP_DEG));
  const ringPeriod = n * step;
  return {
    count: n,
    step,
    wraps: true,
    minRotation: -Infinity,
    maxRotation: Infinity,
    ringPeriod
  };
}

/**
 * Clamps or normalizes a rotation angle (degrees) for `count` items.
 * For `count === 1`, rotation is clamped to `0`.
 * For `count === 2`, rotation is clamped softly around `[-step, 0]` (no wrap).
 */
export function normalizeRotation(rotation, count) {
  if (!Number.isFinite(rotation)) return 0;
  const geo = getDiscGeometry(count);
  if (geo.count <= 1) return 0;
  if (!geo.wraps) {
    const pad = geo.step * 0.25;
    return Math.max(geo.minRotation - pad, Math.min(geo.maxRotation + pad, rotation));
  }
  return modPositive(rotation, geo.ringPeriod);
}

/**
 * Returns the nearest item index `0 .. count - 1` at the front (top = 0 deg)
 * for a given `rotation`, together with the snap target rotation.
 */
export function snapRotationToNearest(rotation, count) {
  const geo = getDiscGeometry(count);
  if (geo.count <= 0) {
    return { index: -1, targetRotation: 0, delta: 0 };
  }
  if (geo.count === 1) {
    return { index: 0, targetRotation: 0, delta: -rotation };
  }
  if (!geo.wraps) {
    // N = 2: index 0 is at rotation 0, index 1 is at rotation -step
    const rawIdx = Math.round(-rotation / geo.step);
    const index = Math.max(0, Math.min(geo.count - 1, rawIdx));
    const targetRotation = -index * geo.step;
    return { index, targetRotation, delta: targetRotation - rotation };
  }

  // N >= 3 with wrap-around over ringPeriod = count * step:
  // Item i is at the top (0 deg) when `i * step + rotation === 0 (mod ringPeriod)`,
  // i.e. `i === -rotation / step (mod count)`.
  const floatIndex = -rotation / geo.step;
  const rounded = Math.round(floatIndex);
  const index = modPositive(rounded, geo.count);
  const targetRotation = -rounded * geo.step;
  const delta = targetRotation - rotation;
  return { index, targetRotation, delta };
}

/**
 * Computes the shortest rotation target to bring `targetIndex` (`0 .. count - 1`)
 * to the front (0 deg) from `currentRotation`.
 */
export function rotationForIndex(targetIndex, currentRotation, count) {
  const geo = getDiscGeometry(count);
  if (geo.count <= 0) return 0;
  const idx = modPositive(Math.floor(targetIndex), geo.count);
  if (geo.count === 1) return 0;
  if (!geo.wraps) {
    return -idx * geo.step;
  }
  const desiredMod = modPositive(-idx * geo.step, geo.ringPeriod);
  const diff = wrapSymmetric(desiredMod - currentRotation, geo.ringPeriod);
  return currentRotation + diff;
}

/**
 * Computes the bounded set of visible items on the top arc (`|angle| <= maxArcDeg`,
 * default 70 deg) for a given `rotation` and `count`.
 *
 * Each returned item has:
 * - `index`: item index `0 .. count - 1`
 * - `angleDeg`: tangential angle in degrees (`0` = top center, negative = left, positive = right)
 * - `x`, `y`: rim coordinates relative to the top center of the disc `(0, 0)` for `radiusPx`
 * - `scale`: `1` at front (`0 deg`), smoothly smaller towards the sides
 * - `opacity`: `1` at front (`0 deg`), smoothly dimmer towards the sides
 * - `isFront`: `true` for the single front-most item
 */
export function getVisibleDiscItems(
  count,
  rotation = 0,
  { radiusPx = 280, maxArcDeg = VISIBLE_ARC_DEG, maxItems = MAX_VISIBLE_ITEMS } = {}
) {
  const geo = getDiscGeometry(count);
  if (geo.count <= 0) return [];

  const effectiveRot = geo.wraps ? (Number(rotation) || 0) : normalizeRotation(rotation, geo.count);
  const snapped = snapRotationToNearest(effectiveRot, geo.count);
  const candidates = [];

  for (let i = 0; i < geo.count; i++) {
    let angleDeg;
    if (geo.count === 1) {
      angleDeg = 0;
    } else if (!geo.wraps) {
      angleDeg = i * geo.step + effectiveRot;
    } else {
      angleDeg = wrapSymmetric(i * geo.step + effectiveRot, geo.ringPeriod);
    }

    const absAngle = Math.abs(angleDeg);
    if (absAngle <= maxArcDeg + 0.001) {
      const t = Math.min(1, absAngle / maxArcDeg);
      const rad = (angleDeg * Math.PI) / 180;
      const x = Math.sin(rad) * radiusPx;
      const y = (1 - Math.cos(rad)) * radiusPx;
      const scale = Number((1 - 0.24 * t).toFixed(4));
      const opacity = Number((1 - 0.52 * t).toFixed(4));
      candidates.push({
        index: i,
        angleDeg: Number(angleDeg.toFixed(4)),
        absAngle,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        scale,
        opacity,
        isFront: i === snapped.index
      });
    }
  }

  candidates.sort((a, b) => a.absAngle - b.absAngle || a.index - b.index);
  const bounded = candidates.slice(0, Math.max(1, maxItems));
  return bounded;
}

/**
 * Advances one frame (`dtMs` milliseconds) of exponential inertia + spring snap
 * towards the nearest item.
 *
 * Always terminates (`done: true`, `velocity: 0`, `rotation: targetRotation`)
 * once both velocity and remaining snap distance fall below small thresholds.
 *
 * @param {{ rotation: number, velocity: number }} state - `velocity` in deg/second
 * @param {number} count - number of items in the gallery
 * @param {number} [dtMs=16.67] - frame delta in ms
 * @param {{ reducedMotion?: boolean, friction?: number, spring?: number }} [options]
 */
export function stepDiscInertia(
  state,
  count,
  dtMs = 16.67,
  { reducedMotion = false, friction = 7.5, spring = 14 } = {}
) {
  const geo = getDiscGeometry(count);
  if (geo.count <= 1) {
    return { rotation: 0, velocity: 0, targetRotation: 0, activeIndex: geo.count === 1 ? 0 : -1, done: true };
  }

  const curRot = Number.isFinite(state?.rotation) ? state.rotation : 0;
  const curVel = Number.isFinite(state?.velocity) ? state.velocity : 0;

  // Under prefers-reduced-motion, snap immediately without inertia.
  if (reducedMotion) {
    const snap = snapRotationToNearest(curRot, geo.count);
    return {
      rotation: snap.targetRotation,
      velocity: 0,
      targetRotation: snap.targetRotation,
      activeIndex: snap.index,
      done: true
    };
  }

  const dt = Math.min(0.064, Math.max(0.001, (Number(dtMs) || 16.67) / 1000));

  // Exponential friction decay on velocity
  const decay = Math.exp(-friction * dt);
  let nextVel = curVel * decay;
  let nextRot = curRot + nextVel * dt;

  if (!geo.wraps) {
    nextRot = normalizeRotation(nextRot, geo.count);
  }

  const snap = snapRotationToNearest(nextRot, geo.count);

  // Pull rotation smoothly towards the nearest item's snap angle
  const springPull = 1 - Math.exp(-spring * dt);
  nextRot += snap.delta * springPull;

  // Dampen velocity more strongly as it settles near the snap point
  if (Math.abs(nextVel) < 18) {
    nextVel *= 0.75;
  }

  const remaining = Math.abs(snap.targetRotation - nextRot);
  if (Math.abs(nextVel) < 0.8 && remaining < 0.15) {
    return {
      rotation: snap.targetRotation,
      velocity: 0,
      targetRotation: snap.targetRotation,
      activeIndex: snap.index,
      done: true
    };
  }

  return {
    rotation: nextRot,
    velocity: nextVel,
    targetRotation: snap.targetRotation,
    activeIndex: snap.index,
    done: false
  };
}
