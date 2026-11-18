/**
 * wheel.js - fair Spin Wheel ("Roda Putar Siswa") pure math + Canvas UI.
 *
 * Rules (Part 4.5):
 * - Student names are defined in `data/class-data.js` (`students`).
 * - The winner is chosen FIRST with `crypto.getRandomValues` (unbiased rejection
 *   sampling) from the eligible list, then the wheel animation lands on that
 *   exact slice so the shown winner always equals the calculated winner.
 * - Pure selection & angle-to-index functions are exported at the top so
 *   `tests/wheel.test.js` can test them for N = 1, 2, 5, and 40 names without DOM.
 * - Tick sound uses the Web Audio API (no audio files), with persisted mute toggle
 *   and optional vibration toggle (`rk.wheelMuted`, `rk.wheelVibrate`).
 * - Confetti, large winner name, and a focus-trapped 'Selamat!' popup modal,
 *   plus history (view, clear with confirmation, reset picked with confirmation)
 *   and option to exclude already-picked students (`rk.wheelExcludePicked`).
 * - Handles empty and single-name lists; honors `prefers-reduced-motion`.
 */

import { getPref, setPref, getLocalState, setLocalState } from './storage.js';
import { formatDateTimeWIB } from './utils.js';
import { showToast } from './ui.js';
import { launchConfetti, stopConfetti } from './confetti.js';

const TWO_PI = Math.PI * 2;
const FULL_TURN_DEG = 360;

/**
 * Positive modulo in `[0, m)`.
 */
export function modWheel(value, m = FULL_TURN_DEG) {
  if (!(m > 0) || !Number.isFinite(value)) return 0;
  return ((value % m) + m) % m;
}

/**
 * Picks a uniform random integer in `[0, count - 1]` using `crypto.getRandomValues`
 * with rejection sampling so there is zero modulo bias.
 *
 * @param {number} count - Number of eligible items (`>= 1`).
 * @param {(buf: Uint32Array) => Uint32Array} [fillRandom] - Optional injectable RNG for tests.
 */
export function pickRandomIndexCrypto(count, fillRandom) {
  const n = Math.floor(Number(count) || 0);
  if (n <= 0) {
    throw new RangeError('Daftar siswa yang bisa dipilih kosong.');
  }
  if (n === 1) return 0;

  const getRandom =
    typeof fillRandom === 'function'
      ? fillRandom
      : (buf) => globalThis.crypto.getRandomValues(buf);

  const maxUint32PlusOne = 0x1_0000_0000;
  const limit = maxUint32PlusOne - (maxUint32PlusOne % n);
  const buf = new Uint32Array(1);

  for (let attempt = 0; attempt < 128; attempt++) {
    getRandom(buf);
    const val = buf[0] >>> 0;
    if (val < limit) {
      return val % n;
    }
  }
  return buf[0] % n;
}

/**
 * Filters the raw `students` list into eligible students based on `active !== false`
 * and the optional `pickedIds` exclusion set.
 */
export function getEligibleStudents(students, { excludePicked = false, pickedIds = [] } = {}) {
  if (!Array.isArray(students)) return [];
  const pickedSet = new Set(Array.isArray(pickedIds) ? pickedIds : []);
  return students.filter((st) => {
    if (!st || typeof st.name !== 'string' || !st.name.trim()) return false;
    if (st.active === false) return false;
    if (excludePicked && st.id && pickedSet.has(st.id)) return false;
    return true;
  });
}

/**
 * Chooses the winning student FIRST from the eligible list using `pickRandomIndexCrypto`.
 * Returns `{ winner, winnerIndex, eligible }` or `{ winner: null, winnerIndex: -1, eligible: [] }`
 * when the eligible list is empty.
 */
export function chooseWheelWinner(students, options = {}) {
  const eligible = getEligibleStudents(students, options);
  if (eligible.length === 0) {
    return { winner: null, winnerIndex: -1, eligible: [] };
  }
  const winnerIndex = pickRandomIndexCrypto(eligible.length, options.fillRandom);
  return {
    winner: eligible[winnerIndex],
    winnerIndex,
    eligible
  };
}

/**
 * Convention for the wheel canvas:
 * - The pointer sits at 12 o'clock (top of the wheel).
 * - In local wheel coordinates (when `rotationDeg = 0`), slice `i` spans
 *   `[i * sliceDeg, (i + 1) * sliceDeg)` clockwise from 12 o'clock.
 * - When the wheel is rotated clockwise by `rotationDeg` degrees, the wheel angle
 *   currently under the 12 o'clock pointer is `modWheel(-rotationDeg, 360)`.
 * - Therefore the slice under the pointer is `Math.floor(pointerAngle / sliceDeg)`.
 */
export function getIndexFromWheelAngle(rotationDeg, count) {
  const n = Math.floor(Number(count) || 0);
  if (n <= 0) return -1;
  if (n === 1) return 0;
  const sliceDeg = FULL_TURN_DEG / n;
  const pointerAngle = modWheel(-rotationDeg, FULL_TURN_DEG);
  const idx = Math.floor(pointerAngle / sliceDeg);
  return Math.max(0, Math.min(n - 1, idx));
}

/**
 * Computes the target wheel rotation (in degrees, clockwise) that is guaranteed
 * to land inside `winnerIndex`'s slice after `extraSpins` full turns.
 *
 * `sliceOffsetRatio` (`0.2 .. 0.8`, default `0.5` = dead center of the slice)
 * controls where inside the winning slice the pointer stops.
 */
export function getTargetAngleForWinner(
  winnerIndex,
  count,
  currentRotationDeg = 0,
  { extraSpins = 5, sliceOffsetRatio = 0.5 } = {}
) {
  const n = Math.floor(Number(count) || 0);
  if (n <= 0) return currentRotationDeg;
  if (n === 1) {
    return currentRotationDeg + Math.max(1, extraSpins) * FULL_TURN_DEG;
  }

  const idx = modWheel(Math.floor(winnerIndex), n);
  const clampedOffset = Math.min(0.8, Math.max(0.2, Number(sliceOffsetRatio) || 0.5));
  const sliceDeg = FULL_TURN_DEG / n;

  // We want `modWheel(-targetRotation, 360) === (idx + clampedOffset) * sliceDeg`
  const desiredPointerAngle = (idx + clampedOffset) * sliceDeg;
  const desiredMod = modWheel(-desiredPointerAngle, FULL_TURN_DEG);
  const currentMod = modWheel(currentRotationDeg, FULL_TURN_DEG);
  const forwardDelta = modWheel(desiredMod - currentMod, FULL_TURN_DEG);

  return currentRotationDeg + Math.max(1, extraSpins) * FULL_TURN_DEG + forwardDelta;
}

/* ==========================================================================
   DOM + Canvas + Web Audio UI (only used in the browser)
   ========================================================================== */

let rawStudents = [];
let rotationDeg = 0;
let spinning = false;
let spinRafId = null;
let audioCtx = null;
let boundOnce = false;
let lastFocusBeforePopup = null;
let pendingConfirmAction = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMuted() {
  return getPref('wheelMuted', 'false') === 'true';
}

function isVibrationEnabled() {
  return getPref('wheelVibrate', 'false') === 'true';
}

function isExcludePickedEnabled() {
  return getPref('wheelExcludePicked', 'true') !== 'false';
}

function getPickedIds() {
  return getLocalState('wheelPickedIds', []);
}

function getHistoryList() {
  return getLocalState('wheelHistory', []);
}

/**
 * Plays a short wooden peg tick sound using the Web Audio API (no external files).
 */
function playTickSound(frequencyHz = 540, durationSec = 0.028) {
  if (isMuted()) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequencyHz, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + durationSec);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
  } catch {
    // Audio blocked or unsupported: ignore quietly.
  }
}

function playWinChime() {
  if (isMuted()) return;
  playTickSound(587.33, 0.09); // D5
  setTimeout(() => playTickSound(880, 0.16), 95); // A5
}

function triggerVibration(pattern) {
  if (!isVibrationEnabled()) return;
  if (typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore if unsupported on desktop
    }
  }
}

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    surface1: style.getPropertyValue('--surface-1').trim(),
    surface2: style.getPropertyValue('--surface-2').trim(),
    surface3: style.getPropertyValue('--surface-3').trim(),
    text: style.getPropertyValue('--text').trim(),
    textMuted: style.getPropertyValue('--text-muted').trim(),
    border: style.getPropertyValue('--border-strong').trim(),
    accent: style.getPropertyValue('--accent').trim(),
    onAccent: style.getPropertyValue('--on-accent').trim()
  };
}

function drawWheelCanvas(eligible, highlightIndex = -1) {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 300;
  if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 14;
  const colors = getThemeColors();
  const count = eligible.length;

  // Outer rim
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, TWO_PI);
  ctx.fillStyle = colors.surface3;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  if (count === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.fillStyle = colors.surface1;
    ctx.fill();
    ctx.strokeStyle = colors.border;
    ctx.stroke();

    ctx.fillStyle = colors.textMuted;
    ctx.font = '700 14px "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Semua siswa sudah terpilih', cx, cy - 8);
    ctx.font = '400 12px "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.fillText('Reset daftar terpilih untuk memutar lagi.', cx, cy + 12);
    ctx.restore();
    return;
  }

  const sliceRad = TWO_PI / count;
  const rotRad = (rotationDeg * Math.PI) / 180 - Math.PI / 2; // 0 deg starts at 12 o'clock

  for (let i = 0; i < count; i++) {
    const startAngle = rotRad + i * sliceRad;
    const endAngle = startAngle + sliceRad;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();

    const isHighlighted = i === highlightIndex;
    if (isHighlighted) {
      ctx.fillStyle = colors.accent;
    } else if (count % 2 === 1 && i === count - 1) {
      ctx.fillStyle = colors.surface3;
    } else {
      ctx.fillStyle = i % 2 === 0 ? colors.surface1 : colors.surface2;
    }
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = colors.border;
    ctx.stroke();

    // Label along slice bisector
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + sliceRad / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHighlighted ? colors.onAccent : colors.text;
    const fontSize = count > 24 ? 10 : count > 12 ? 12 : 13;
    ctx.font = `700 ${fontSize}px "Atkinson Hyperlegible", system-ui, sans-serif`;
    const rawName = eligible[i].name;
    const label = rawName.length > 16 ? `${rawName.slice(0, 15)}…` : rawName;
    ctx.fillText(label, radius - 14, 0);
    ctx.restore();
  }

  // Center cap
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, TWO_PI);
  ctx.fillStyle = colors.surface2;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, TWO_PI);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  // Top 12 o'clock pointer triangle
  ctx.beginPath();
  ctx.moveTo(cx, 18);
  ctx.lineTo(cx - 11, 3);
  ctx.lineTo(cx + 11, 3);
  ctx.closePath();
  ctx.fillStyle = colors.accent;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  ctx.restore();
}

function renderHistoryAndCounts() {
  const pickedIds = getPickedIds();
  const excludePicked = isExcludePickedEnabled();
  const eligible = getEligibleStudents(rawStudents, { excludePicked, pickedIds });
  const activeTotal = getEligibleStudents(rawStudents, { excludePicked: false }).length;

  const statusText = document.getElementById('wheel-status-text');
  const spinBtn = document.getElementById('wheel-spin-btn');
  const resetPickedBtn = document.getElementById('wheel-reset-picked-btn');
  const clearHistBtn = document.getElementById('wheel-clear-history-btn');
  const histBody = document.getElementById('wheel-history-body');

  if (statusText) {
    if (activeTotal === 0) {
      statusText.textContent = 'Daftar siswa di data/class-data.js masih kosong.';
    } else if (eligible.length === 0) {
      statusText.textContent = `Semua ${activeTotal} siswa sudah terpilih. Tekan "Reset siswa terpilih" untuk mengulang.`;
    } else if (eligible.length === 1) {
      statusText.textContent = `Tersisa 1 siswa yang belum terpilih (${eligible[0].name}).`;
    } else {
      statusText.textContent = `${eligible.length} dari ${activeTotal} siswa siap diundi.`;
    }
  }

  if (spinBtn) {
    spinBtn.disabled = spinning || eligible.length === 0;
  }
  if (resetPickedBtn) {
    resetPickedBtn.disabled = spinning || pickedIds.length === 0;
  }

  const history = getHistoryList();
  if (clearHistBtn) {
    clearHistBtn.disabled = spinning || history.length === 0;
  }

  if (histBody) {
    histBody.replaceChildren();
    if (history.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'field-hint';
      empty.textContent = 'Belum ada riwayat putaran di browser ini.';
      histBody.appendChild(empty);
    } else {
      const ol = document.createElement('ol');
      ol.className = 'ledger-list';
      for (const entry of history.slice(0, 10)) {
        const li = document.createElement('li');
        li.className = 'ledger-row';
        const top = document.createElement('div');
        top.className = 'ledger-row__top';
        const nameEl = document.createElement('strong');
        nameEl.textContent = entry.name;
        const timeEl = document.createElement('span');
        timeEl.className = 'field-hint';
        timeEl.textContent = entry.timeWIB;
        top.append(nameEl, timeEl);
        li.appendChild(top);
        ol.appendChild(li);
      }
      histBody.appendChild(ol);
    }
  }

  const currentIdx = eligible.length > 0 ? getIndexFromWheelAngle(rotationDeg, eligible.length) : -1;
  drawWheelCanvas(eligible, spinning ? -1 : currentIdx);
}

function openWinnerModal(winner, triggerEl) {
  const modal = document.getElementById('wheel-winner-modal');
  const nameEl = document.getElementById('wheel-winner-name');
  const closeBtn = document.getElementById('wheel-winner-close');

  if (!modal || !nameEl) return;
  lastFocusBeforePopup = triggerEl || document.activeElement;
  nameEl.textContent = winner.name;

  modal.hidden = false;
  if (closeBtn) closeBtn.focus();

  // Canvas confetti (skipped automatically under prefers-reduced-motion)
  launchConfetti();
}

function closeWinnerModal() {
  const modal = document.getElementById('wheel-winner-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  stopConfetti();
  if (lastFocusBeforePopup && typeof lastFocusBeforePopup.focus === 'function') {
    lastFocusBeforePopup.focus();
  }
  lastFocusBeforePopup = null;
}

function openConfirmModal(message, onConfirm, triggerEl) {
  const modal = document.getElementById('wheel-confirm-modal');
  const textEl = document.getElementById('wheel-confirm-text');
  const cancelBtn = document.getElementById('wheel-confirm-cancel');
  if (!modal || !textEl) return;

  lastFocusBeforePopup = triggerEl || document.activeElement;
  pendingConfirmAction = onConfirm;
  textEl.textContent = message;
  modal.hidden = false;
  if (cancelBtn) cancelBtn.focus();
}

function closeConfirmModal() {
  const modal = document.getElementById('wheel-confirm-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  pendingConfirmAction = null;
  if (lastFocusBeforePopup && typeof lastFocusBeforePopup.focus === 'function') {
    lastFocusBeforePopup.focus();
  }
  lastFocusBeforePopup = null;
}

function recordWinnerAndAnnounce(winner, spinBtn) {
  const nowStr = formatDateTimeWIB(new Date());
  const history = getHistoryList();
  history.unshift({
    id: winner.id || winner.name,
    name: winner.name,
    timeWIB: nowStr
  });
  setLocalState('wheelHistory', history.slice(0, 30));

  if (isExcludePickedEnabled() && winner.id) {
    const picked = getPickedIds();
    if (!picked.includes(winner.id)) {
      picked.push(winner.id);
      setLocalState('wheelPickedIds', picked);
    }
  }

  playWinChime();
  triggerVibration([40, 60, 90]);
  renderHistoryAndCounts();
  openWinnerModal(winner, spinBtn);
}

function startSpin() {
  if (spinning) return;
  const spinBtn = document.getElementById('wheel-spin-btn');
  const pickedIds = getPickedIds();
  const excludePicked = isExcludePickedEnabled();

  // 1. Choose winner FIRST using crypto.getRandomValues
  const choice = chooseWheelWinner(rawStudents, { excludePicked, pickedIds });
  if (!choice.winner) {
    showToast('Tidak ada siswa yang bisa diundi saat ini.');
    return;
  }

  const { winner, winnerIndex, eligible } = choice;

  // 2. Compute exact target angle that lands inside winnerIndex's slice
  const startAngle = rotationDeg;
  const extraSpins = prefersReducedMotion() || eligible.length === 1 ? 1 : 5;
  const targetAngle = getTargetAngleForWinner(winnerIndex, eligible.length, startAngle, {
    extraSpins,
    sliceOffsetRatio: 0.5
  });

  if (prefersReducedMotion()) {
    rotationDeg = modWheel(targetAngle, FULL_TURN_DEG);
    drawWheelCanvas(eligible, winnerIndex);
    recordWinnerAndAnnounce(winner, spinBtn);
    return;
  }

  spinning = true;
  if (spinBtn) spinBtn.disabled = true;

  const durationMs = eligible.length === 1 ? 750 : 3200;
  const startTime = performance.now();
  let lastSliceIdx = getIndexFromWheelAngle(startAngle, eligible.length);

  const animate = (nowMs) => {
    const elapsed = nowMs - startTime;
    const t = Math.min(1, elapsed / durationMs);
    // Cubic ease-out: 1 - (1 - t)^3
    const eased = 1 - (1 - t) ** 3;
    rotationDeg = startAngle + (targetAngle - startAngle) * eased;

    const currentSlice = getIndexFromWheelAngle(rotationDeg, eligible.length);
    if (currentSlice !== lastSliceIdx) {
      lastSliceIdx = currentSlice;
      playTickSound(520, 0.022);
      triggerVibration(10);
    }

    drawWheelCanvas(eligible, t >= 1 ? winnerIndex : -1);

    if (t < 1) {
      spinRafId = requestAnimationFrame(animate);
    } else {
      spinRafId = null;
      spinning = false;
      rotationDeg = modWheel(targetAngle, FULL_TURN_DEG);
      drawWheelCanvas(eligible, winnerIndex);
      recordWinnerAndAnnounce(winner, spinBtn);
    }
  };

  spinRafId = requestAnimationFrame(animate);
}

function bindWheelEventsOnce() {
  if (boundOnce) return;
  boundOnce = true;

  const spinBtn = document.getElementById('wheel-spin-btn');
  const excludeChk = document.getElementById('wheel-exclude-picked');
  const muteChk = document.getElementById('wheel-mute-toggle');
  const vibrateChk = document.getElementById('wheel-vibrate-toggle');
  const resetPickedBtn = document.getElementById('wheel-reset-picked-btn');
  const clearHistBtn = document.getElementById('wheel-clear-history-btn');
  const winnerCloseBtn = document.getElementById('wheel-winner-close');
  const confirmCancelBtn = document.getElementById('wheel-confirm-cancel');
  const confirmOkBtn = document.getElementById('wheel-confirm-ok');

  if (excludeChk) {
    excludeChk.checked = isExcludePickedEnabled();
    excludeChk.addEventListener('change', () => {
      setPref('wheelExcludePicked', String(excludeChk.checked));
      renderHistoryAndCounts();
    });
  }

  if (muteChk) {
    muteChk.checked = isMuted();
    muteChk.addEventListener('change', () => {
      setPref('wheelMuted', String(muteChk.checked));
      showToast(muteChk.checked ? 'Suara roda dimatikan.' : 'Suara roda dinyalakan.');
    });
  }

  if (vibrateChk) {
    vibrateChk.checked = isVibrationEnabled();
    vibrateChk.addEventListener('change', () => {
      setPref('wheelVibrate', String(vibrateChk.checked));
    });
  }

  if (spinBtn) {
    spinBtn.addEventListener('click', startSpin);
  }

  if (resetPickedBtn) {
    resetPickedBtn.addEventListener('click', () => {
      openConfirmModal(
        'Reset daftar siswa yang sudah terpilih agar semua siswa bisa diundi kembali?',
        () => {
          setLocalState('wheelPickedIds', []);
          renderHistoryAndCounts();
          showToast('Daftar siswa terpilih berhasil direset.');
        },
        resetPickedBtn
      );
    });
  }

  if (clearHistBtn) {
    clearHistBtn.addEventListener('click', () => {
      openConfirmModal(
        'Hapus seluruh riwayat putaran roda di browser ini?',
        () => {
          setLocalState('wheelHistory', []);
          renderHistoryAndCounts();
          showToast('Riwayat putaran dihapus.');
        },
        clearHistBtn
      );
    });
  }

  if (winnerCloseBtn) {
    winnerCloseBtn.addEventListener('click', closeWinnerModal);
  }

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', closeConfirmModal);
  }

  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', () => {
      const fn = pendingConfirmAction;
      closeConfirmModal();
      if (typeof fn === 'function') fn();
    });
  }

  // Redraw canvas when theme or accent changes so canvas colors match tokens
  const observer = new MutationObserver(() => {
    const eligible = getEligibleStudents(rawStudents, {
      excludePicked: isExcludePickedEnabled(),
      pickedIds: getPickedIds()
    });
    drawWheelCanvas(eligible, -1);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-accent']
  });

  document.addEventListener('keydown', (event) => {
    const winnerModal = document.getElementById('wheel-winner-modal');
    const confirmModal = document.getElementById('wheel-confirm-modal');
    const activeModal =
      winnerModal && !winnerModal.hidden
        ? winnerModal
        : confirmModal && !confirmModal.hidden
          ? confirmModal
          : null;

    if (!activeModal) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (activeModal === winnerModal) closeWinnerModal();
      else closeConfirmModal();
    } else if (event.key === 'Tab') {
      const focusables = [...activeModal.querySelectorAll('button:not([disabled])')];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

/**
 * Initializes the Spin Wheel in the Lainnya tab from `CLASS_DATA.students`.
 */
export function initWheel(data) {
  bindWheelEventsOnce();
  rawStudents = Array.isArray(data?.students) ? [...data.students] : [];
  renderHistoryAndCounts();
}
