/**
 * reports.js - Report via WhatsApp (Part 4.6) and Suggestions / Kotak Saran (Part 4.7).
 *
 * Pure functions exported at the top for `tests/reports.test.js`:
 * - `validateWhatsAppNumber(rawNumber)`
 * - `formatReportMessage({ name, message, now })`
 * - `buildWhatsAppReportUrl(rawNumber, { name, message, now })`
 * - `formatSuggestionText({ title, message, name, now })`
 * - `getCooldownStatus(cooldownUntilMs, nowMs)`
 *
 * Rules (Part 4.6 & 4.7 + Farsky's approved multi-line message format):
 * - Owner sets `whatsappNumber` in `data/class-data.js` (`siteSettings.whatsappNumber`,
 *   empty by default, digits only, international format e.g. `628xxxxxxxxxx`, 10 to 15 digits).
 *   With no number or an invalid number, the send button is disabled and explains why.
 * - Exact approved report message (one item per line):
 *   📢 LAPORAN BARU
 *   • Nama : (name)
 *   • Pesan : (message)
 *   • Waktu : (date time WIB)
 * - Opens `https://wa.me/<number>?text=<encodeURIComponent(message)>` in a new tab
 *   with `rel="noopener noreferrer"`.
 * - When image attachments exist (max 3 images, max 3 MB each), show the exact text:
 *   "Lampiran gambar akan diunduh; silakan kirim manual di WhatsApp."
 *   and render one download button per image.
 * - A report's status is NEVER "Terkirim"; it is always "Dibuka di WhatsApp".
 * - Per-browser cooldown (default 60 seconds) with honest wording that it is stored
 *   per browser and does not stop determined abuse.
 * - Suggestions: title (required), message (required), optional name. Offers
 *   "Salin teks", "Unduh", and optional WhatsApp handoff when the number is set.
 */

import { formatDateTimeWIB } from './utils.js';
import { getPref, setPref } from './storage.js';
import { showToast } from './ui.js';

export const ATTACHMENT_NOTICE_TEXT =
  'Lampiran gambar akan diunduh; silakan kirim manual di WhatsApp.';
export const REPORT_STATUS_LABEL = 'Dibuka di WhatsApp';
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // 3 MB

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WA_NUMBER_RE = /^[1-9]\d{9,14}$/; // 10..15 digits, international format (e.g. 628xxxxxxxxxx)

/**
 * Validates the configured WhatsApp destination number.
 * Returns `{ valid: boolean, number: string, reason: string }`.
 */
export function validateWhatsAppNumber(rawNumber) {
  const cleaned = typeof rawNumber === 'string' ? rawNumber.trim() : '';
  if (!cleaned) {
    return {
      valid: false,
      number: '',
      reason:
        'Tombol kirim WhatsApp belum aktif karena nomor tujuan belum diisi di data/class-data.js (siteSettings.whatsappNumber).'
    };
  }
  if (!WA_NUMBER_RE.test(cleaned)) {
    return {
      valid: false,
      number: '',
      reason:
        'Nomor WhatsApp di data/class-data.js belum valid (gunakan angka saja 10–15 digit format internasional seperti 6281234567890, tanpa tanda + atau spasi).'
    };
  }
  return { valid: true, number: cleaned, reason: '' };
}

/**
 * Formats the exact WhatsApp report text approved by Farsky:
 * 📢 LAPORAN BARU
 * • Nama : (name)
 * • Pesan : (message)
 * • Waktu : (date time WIB)
 */
export function formatReportMessage({ name, message, now = new Date() } = {}) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (!cleanName) {
    throw new Error('Nama pelapor wajib diisi.');
  }
  if (!cleanMessage) {
    throw new Error('Isi pesan laporan wajib diisi.');
  }
  const timeWIB = `${formatDateTimeWIB(now)} WIB`;
  return [
    '📢 LAPORAN BARU',
    `• Nama : ${cleanName}`,
    `• Pesan : ${cleanMessage}`,
    `• Waktu : ${timeWIB}`
  ].join('\n');
}

/**
 * Builds the `https://wa.me/<number>?text=<encodeURIComponent(message)>` URL
 * after validating the destination number and the report fields.
 */
export function buildWhatsAppReportUrl(rawNumber, { name, message, now = new Date() } = {}) {
  const numCheck = validateWhatsAppNumber(rawNumber);
  if (!numCheck.valid) {
    throw new Error(numCheck.reason);
  }
  const text = formatReportMessage({ name, message, now });
  return {
    url: `https://wa.me/${numCheck.number}?text=${encodeURIComponent(text)}`,
    text,
    status: REPORT_STATUS_LABEL
  };
}

/**
 * Formats a suggestion (Kotak Saran) text block for "Salin teks" and "Unduh".
 */
export function formatSuggestionText({ title, message, name = '', now = new Date() } = {}) {
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanMsg = typeof message === 'string' ? message.trim() : '';
  const cleanName = typeof name === 'string' && name.trim() ? name.trim() : 'Anonim';

  if (!cleanTitle) {
    throw new Error('Judul saran wajib diisi.');
  }
  if (!cleanMsg) {
    throw new Error('Isi saran wajib diisi.');
  }

  const timeWIB = `${formatDateTimeWIB(now)} WIB`;
  return [
    '💡 SARAN KELAS',
    `• Judul : ${cleanTitle}`,
    `• Dari : ${cleanName}`,
    `• Isi : ${cleanMsg}`,
    `• Waktu : ${timeWIB}`
  ].join('\n');
}

/**
 * Computes whether the per-browser report cooldown is active.
 */
export function getCooldownStatus(cooldownUntilMs, nowMs = Date.now()) {
  const until = Number(cooldownUntilMs) || 0;
  const remainingMs = until - nowMs;
  if (remainingMs <= 0) {
    return { active: false, remainingSeconds: 0 };
  }
  return {
    active: true,
    remainingSeconds: Math.ceil(remainingMs / 1000)
  };
}

/* ==========================================================================
   DOM UI for Laporan via WhatsApp & Kotak Saran
   ========================================================================== */

let currentSettings = {};
let selectedFiles = [];
let activeObjectUrls = [];
let cooldownTimer = null;
let boundOnce = false;

function revokeAttachmentUrls() {
  for (const url of activeObjectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  }
  activeObjectUrls = [];
}

function getCooldownUntilMs() {
  return Number(getPref('reportCooldownUntil', '0')) || 0;
}

function setCooldownForSeconds(seconds) {
  const until = Date.now() + Math.max(10, Number(seconds) || 60) * 1000;
  setPref('reportCooldownUntil', String(until));
  return until;
}

function stopCooldownTicker() {
  if (cooldownTimer !== null) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
}

function syncReportButtonState() {
  const submitBtn = document.getElementById('report-submit-btn');
  const noteEl = document.getElementById('report-wa-note');
  if (!submitBtn || !noteEl) return;

  const numCheck = validateWhatsAppNumber(currentSettings.whatsappNumber || '');
  const cd = getCooldownStatus(getCooldownUntilMs());

  if (!numCheck.valid) {
    submitBtn.disabled = true;
    noteEl.textContent = numCheck.reason;
    stopCooldownTicker();
    return;
  }

  if (cd.active) {
    submitBtn.disabled = true;
    noteEl.textContent = `Jeda pengiriman aktif di browser ini (${cd.remainingSeconds} detik lagi). Catatan jujur: jeda ini disimpan per browser untuk mencegah klik berulang dan tidak menghentikan penyalahgunaan yang disengaja.`;
    if (cooldownTimer === null) {
      cooldownTimer = setInterval(syncReportButtonState, 1000);
    }
    return;
  }

  stopCooldownTicker();
  submitBtn.disabled = false;
  const cooldownSec = Number(currentSettings.reportCooldownSeconds) || 60;
  noteEl.textContent = `Laporan akan dibuka di WhatsApp (${numCheck.number}). Jeda antar laporan di browser ini adalah ${cooldownSec} detik (jeda lokal per browser, bukan penghalang penyalahgunaan penuh).`;
}

function renderAttachmentDownloads() {
  const box = document.getElementById('report-attachments-box');
  const noticeEl = document.getElementById('report-attachments-notice');
  const listEl = document.getElementById('report-attachments-list');
  if (!box || !noticeEl || !listEl) return;

  revokeAttachmentUrls();
  listEl.replaceChildren();

  if (selectedFiles.length === 0) {
    box.hidden = true;
    noticeEl.textContent = '';
    return;
  }

  box.hidden = false;
  noticeEl.textContent = ATTACHMENT_NOTICE_TEXT;

  selectedFiles.forEach((file, idx) => {
    const objUrl = URL.createObjectURL(file);
    activeObjectUrls.push(objUrl);

    const item = document.createElement('div');
    item.className = 'attachment-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'attachment-item__name';
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    nameSpan.textContent = `${idx + 1}. ${file.name} (${sizeKb} KB)`;

    const dlLink = document.createElement('a');
    dlLink.className = 'button';
    dlLink.href = objUrl;
    dlLink.download = file.name || `lampiran-${idx + 1}.jpg`;
    dlLink.textContent = `Unduh gambar ${idx + 1}`;

    item.append(nameSpan, dlLink);
    listEl.appendChild(item);
  });
}

function handleAttachmentChange(event) {
  const input = event.target;
  const errEl = document.getElementById('report-form-error');
  if (errEl) errEl.hidden = true;

  const files = Array.from(input.files || []);
  if (files.length === 0) {
    selectedFiles = [];
    renderAttachmentDownloads();
    return;
  }

  if (files.length > MAX_ATTACHMENTS) {
    input.value = '';
    selectedFiles = [];
    renderAttachmentDownloads();
    if (errEl) {
      errEl.textContent = `Maksimal ${MAX_ATTACHMENTS} gambar lampiran per laporan.`;
      errEl.hidden = false;
    }
    return;
  }

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      input.value = '';
      selectedFiles = [];
      renderAttachmentDownloads();
      if (errEl) {
        errEl.textContent = `File "${file.name}" bukan gambar JPG, PNG, atau WEBP.`;
        errEl.hidden = false;
      }
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      input.value = '';
      selectedFiles = [];
      renderAttachmentDownloads();
      if (errEl) {
        errEl.textContent = `Ukuran "${file.name}" melebihi batas 3 MB per gambar.`;
        errEl.hidden = false;
      }
      return;
    }
  }

  selectedFiles = files;
  renderAttachmentDownloads();
}

function handleReportSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById('report-name');
  const msgInput = document.getElementById('report-message');
  const errEl = document.getElementById('report-form-error');
  const resultBox = document.getElementById('report-result-box');
  const resultStatus = document.getElementById('report-result-status');
  const resultLink = document.getElementById('report-result-link');

  if (errEl) errEl.hidden = true;

  const cd = getCooldownStatus(getCooldownUntilMs());
  if (cd.active) {
    if (errEl) {
      errEl.textContent = `Tunggu ${cd.remainingSeconds} detik lagi sebelum membuka laporan berikutnya.`;
      errEl.hidden = false;
    }
    return;
  }

  let built;
  try {
    built = buildWhatsAppReportUrl(currentSettings.whatsappNumber || '', {
      name: nameInput ? nameInput.value : '',
      message: msgInput ? msgInput.value : '',
      now: new Date()
    });
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
    return;
  }

  // Start per-browser cooldown and update UI
  setCooldownForSeconds(currentSettings.reportCooldownSeconds || 60);
  syncReportButtonState();

  if (resultBox && resultStatus && resultLink) {
    resultStatus.textContent = built.status; // 'Dibuka di WhatsApp' (never 'Terkirim')
    resultLink.href = built.url;
    resultBox.hidden = false;
  }

  // Open https://wa.me/<number>?text=... in a new tab with rel="noopener noreferrer"
  const anchor = document.createElement('a');
  anchor.href = built.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  showToast('Laporan disiapkan. Status: Dibuka di WhatsApp.');
}

function readSuggestionFormOrReportError() {
  const titleInput = document.getElementById('suggestion-title');
  const msgInput = document.getElementById('suggestion-message');
  const nameInput = document.getElementById('suggestion-name');
  const errEl = document.getElementById('suggestion-form-error');
  if (errEl) errEl.hidden = true;

  try {
    const text = formatSuggestionText({
      title: titleInput ? titleInput.value : '',
      message: msgInput ? msgInput.value : '',
      name: nameInput ? nameInput.value : '',
      now: new Date()
    });
    return text;
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
    return null;
  }
}

async function handleSuggestionCopy() {
  const text = readSuggestionFormOrReportError();
  if (!text) return;

  const preview = document.getElementById('suggestion-preview');
  if (preview) {
    preview.textContent = text;
    preview.hidden = false;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Teks saran berhasil disalin.');
      return;
    } catch {
      // Fall through to toast notice
    }
  }
  showToast('Pratinjau teks saran ditampilkan di bawah untuk disalin.');
}

function handleSuggestionDownload() {
  const text = readSuggestionFormOrReportError();
  if (!text) return;

  const preview = document.getElementById('suggestion-preview');
  if (preview) {
    preview.textContent = text;
    preview.hidden = false;
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'saran-kelas.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('File saran-kelas.txt diunduh.');
}

function bindReportsOnce() {
  if (boundOnce) return;
  boundOnce = true;

  const reportForm = document.getElementById('report-form');
  const fileInput = document.getElementById('report-attachments');
  const copyBtn = document.getElementById('suggestion-copy-btn');
  const downloadBtn = document.getElementById('suggestion-download-btn');

  if (fileInput) {
    fileInput.addEventListener('change', handleAttachmentChange);
  }
  if (reportForm) {
    reportForm.addEventListener('submit', handleReportSubmit);
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', handleSuggestionCopy);
  }
  if (downloadBtn) {
    downloadBtn.addEventListener('click', handleSuggestionDownload);
  }
}

/**
 * Initializes the Report via WhatsApp and Kotak Saran forms in the Lainnya tab.
 */
export function initReports(data) {
  bindReportsOnce();
  currentSettings = data?.siteSettings || {};
  syncReportButtonState();
}
