/**
 * theme.js - light (whiteboard) / dark (chalkboard) theme, the eraser switch,
 * and the accent colour picker. Preferences are stored per browser only.
 */

import { getPref, setPref } from './storage.js';
import { showToast } from './ui.js';

export const THEMES = ['light', 'dark'];
export const ACCENTS = ['red', 'periwinkle', 'green', 'teal', 'orange'];

/** Horizontal drag distance (px) needed to flip the sky orb. Track travel is 28px. */
const DRAG_THRESHOLD = 16;
/** Movement below this (px) is treated as a tap, not a drag. */
const TAP_SLOP = 6;
const REVEAL_MS = 250;

const root = document.documentElement;
let initialized = false;

function currentTheme() {
  return root.dataset.theme === 'dark' ? 'dark' : 'light';
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function syncSwitch() {
  const button = document.getElementById('theme-switch');
  const label = document.getElementById('theme-switch-label');
  const dark = currentTheme() === 'dark';
  button.setAttribute('aria-checked', String(dark));
  label.textContent = dark ? 'Malam' : 'Siang';
}

function syncMetaThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (meta && bg) meta.setAttribute('content', bg);
}

function applyThemeAttributes(theme) {
  root.dataset.theme = theme;
  syncSwitch();
  syncMetaThemeColor();
}

function animateReveal(origin) {
  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: REVEAL_MS, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
  );
}

/**
 * Changes the theme.
 * @param {'light'|'dark'} theme
 * @param {{ origin?: {x:number,y:number}|null, persist?: boolean, announce?: boolean }} [options]
 */
export function setTheme(theme, { origin = null, persist = true, announce = true } = {}) {
  if (!THEMES.includes(theme)) throw new Error(`Tema tidak dikenal: ${theme}`);

  if (theme !== currentTheme()) {
    const change = () => applyThemeAttributes(theme);
    if (origin && typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
      const transition = document.startViewTransition(change);
      transition.ready
        .then(() => animateReveal(origin))
        .catch((err) => {
          // The theme is already applied; only the animation was skipped.
          console.info('Animasi pergantian tema dilewati:', err && err.name);
        });
    } else {
      change();
    }
  }

  let saved = true;
  if (persist) saved = setPref('theme', theme);

  if (announce) {
    const message = theme === 'dark' ? 'Mode malam aktif.' : 'Mode siang aktif.';
    showToast(saved ? message : `${message} Pilihan ini tidak bisa disimpan di browser ini.`);
  }
}

function buttonCenter(button) {
  const rect = button.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function initSkySwitch() {
  const button = document.getElementById('theme-switch');
  const orb = button.querySelector('.sky-switch__orb');
  let drag = null;           // { id, startX, moved }
  let suppressClick = false; // set after a drag so the following click is ignored

  const resetDrag = () => {
    drag = null;
    button.classList.remove('is-dragging');
    if (orb) orb.style.removeProperty('--drag');
  };

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, startX: event.clientX, moved: false };
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > TAP_SLOP) {
      drag.moved = true;
      button.classList.add('is-dragging');
    }
    if (drag.moved && orb) {
      // Day (light): orb can move right 0..28px. Night (dark): left -28..0px.
      const clamped = currentTheme() === 'dark' ? Math.min(0, Math.max(-28, dx)) : Math.max(0, Math.min(28, dx));
      orb.style.setProperty('--drag', `${clamped}px`);
    }
  });

  button.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const wasDrag = drag.moved;
    resetDrag();
    if (!wasDrag) return; // a tap: the click handler below does the toggle
    suppressClick = true;
    const dark = currentTheme() === 'dark';
    if ((!dark && dx >= DRAG_THRESHOLD) || (dark && dx <= -DRAG_THRESHOLD)) {
      setTheme(dark ? 'light' : 'dark', { origin: { x: event.clientX, y: event.clientY } });
    }
  });

  button.addEventListener('pointercancel', resetDrag);

  // Tap, mouse click, Enter and Space all arrive here (native <button> behaviour).
  button.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const fromKeyboard = event.detail === 0;
    const origin = fromKeyboard ? buttonCenter(button) : { x: event.clientX, y: event.clientY };
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark', { origin });
  });
}

function initSystemThemeFollow() {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', (event) => {
    // Only follow the system while the user has never chosen manually.
    if (getPref('theme') === null) {
      setTheme(event.matches ? 'dark' : 'light', { persist: false, announce: false });
    }
  });
}

function initAccentPicker() {
  const picker = document.getElementById('accent-picker');
  const current = ACCENTS.includes(root.dataset.accent) ? root.dataset.accent : 'red';
  const checked = picker.querySelector(`input[value="${current}"]`);
  if (checked) checked.checked = true;

  picker.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== 'accent') return;
    if (!ACCENTS.includes(input.value)) {
      showToast('Warna aksen tidak dikenal.');
      return;
    }
    root.dataset.accent = input.value;
    const saved = setPref('accent', input.value);
    showToast(saved ? 'Warna aksen disimpan.' : 'Warna aksen berganti, tapi tidak bisa disimpan di browser ini.');
  });
}

/** Wires up all theme controls. Safe to call once; repeated calls do nothing. */
export function initTheme() {
  if (initialized) return;
  initialized = true;
  syncSwitch();
  syncMetaThemeColor();
  initSkySwitch();
  initSystemThemeFollow();
  initAccentPicker();
}
