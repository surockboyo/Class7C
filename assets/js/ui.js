/**
 * ui.js - small shared DOM helpers (toast messages).
 */

const TOAST_MS = 3200;
let toastTimer = null;

/**
 * Shows a short message in the polite aria-live toast.
 * One timer only: a new message replaces the previous one.
 */
export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.error('Elemen toast tidak ditemukan.');
    return;
  }
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toastTimer = setTimeout(() => {
      toast.textContent = '';
      toastTimer = null;
    }, 300);
  }, TOAST_MS);
}
