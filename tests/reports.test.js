/**
 * tests/reports.test.js
 * Deterministic tests for assets/js/reports.js covering:
 * - Approved multi-line WhatsApp report message format
 * - Generated https://wa.me/<number>?text=... URL with emoji, newlines, and special characters
 * - Invalid / empty WhatsApp destination numbers
 * - Report status is always 'Dibuka di WhatsApp' (never 'Terkirim')
 * - Exact attachment notice text
 * - Suggestion formatting and per-browser cooldown calculation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACHMENT_NOTICE_TEXT,
  REPORT_STATUS_LABEL,
  validateWhatsAppNumber,
  formatReportMessage,
  buildWhatsAppReportUrl,
  formatSuggestionText,
  getCooldownStatus
} from '../assets/js/reports.js';

const SAMPLE_NOW = '2026-11-17T10:05:00+07:00'; // Selasa, 17 November 2026 pukul 10.05 WIB

test('formatReportMessage produces the exact multi-line message with emoji, bullets, and WIB time', () => {
  const text = formatReportMessage({
    name: 'Siswa Contoh 01',
    message: 'Spidol papan tulis habis & penghapus hilang.',
    now: SAMPLE_NOW
  });

  const expected = [
    '📢 LAPORAN BARU',
    '• Nama : Siswa Contoh 01',
    '• Pesan : Spidol papan tulis habis & penghapus hilang.',
    '• Waktu : Selasa, 17 November 2026 pukul 10.05 WIB'
  ].join('\n');

  assert.equal(text, expected);
});

test('buildWhatsAppReportUrl encodes emoji, newlines, and special characters and sets status to Dibuka di WhatsApp', () => {
  const { url, text, status } = buildWhatsAppReportUrl('6281234567890', {
    name: 'Raka & Dito',
    message: 'Baris 1: lampu berkedip 💡\nBaris 2: apakah ada cadangan? (50% redup) #kelas',
    now: SAMPLE_NOW
  });

  assert.equal(status, 'Dibuka di WhatsApp');
  assert.notEqual(status, 'Terkirim');
  assert.equal(REPORT_STATUS_LABEL, 'Dibuka di WhatsApp');
  assert.ok(url.startsWith('https://wa.me/6281234567890?text='));

  const encodedPart = url.slice('https://wa.me/6281234567890?text='.length);
  assert.equal(decodeURIComponent(encodedPart), text);
  assert.ok(encodedPart.includes('%0A'), 'Newlines must be percent-encoded as %0A');
  assert.ok(encodedPart.includes('%F0%9F%93%A2'), 'Emoji 📢 must be percent-encoded');
});

test('validateWhatsAppNumber and buildWhatsAppReportUrl reject empty and invalid numbers with Indonesian messages', () => {
  assert.equal(validateWhatsAppNumber('').valid, false);
  assert.match(validateWhatsAppNumber('').reason, /belum diisi/);

  const invalidNumbers = [
    '+6281234567890', // contains +
    '081234567890',   // starts with 0 instead of country code
    '62812-3456-789', // contains dashes
    '628123',         // too short (< 10 digits)
    '628123456789012345', // too long (> 15 digits)
    '6281234abc890'   // contains letters
  ];

  for (const bad of invalidNumbers) {
    const res = validateWhatsAppNumber(bad);
    assert.equal(res.valid, false, `Expected "${bad}" to be rejected`);
    assert.throws(
      () => buildWhatsAppReportUrl(bad, { name: 'Tes', message: 'Pesan', now: SAMPLE_NOW }),
      /belum valid/
    );
  }

  assert.equal(validateWhatsAppNumber('6281234567890').valid, true);
});

test('Missing report or suggestion fields throw clear Indonesian validation errors, and attachment notice matches spec', () => {
  assert.equal(
    ATTACHMENT_NOTICE_TEXT,
    'Lampiran gambar akan diunduh; silakan kirim manual di WhatsApp.'
  );

  assert.throws(
    () => formatReportMessage({ name: '   ', message: 'Ada isi', now: SAMPLE_NOW }),
    /Nama pelapor wajib diisi/
  );
  assert.throws(
    () => formatReportMessage({ name: 'Budi', message: '', now: SAMPLE_NOW }),
    /Isi pesan laporan wajib diisi/
  );

  assert.throws(
    () => formatSuggestionText({ title: '', message: 'Usul', now: SAMPLE_NOW }),
    /Judul saran wajib diisi/
  );
  assert.throws(
    () => formatSuggestionText({ title: 'Judul', message: '  ', now: SAMPLE_NOW }),
    /Isi saran wajib diisi/
  );

  const suggestion = formatSuggestionText({
    title: 'Pojok Baca',
    message: 'Tambah rak buku cerita di belakang kelas.',
    name: '',
    now: SAMPLE_NOW
  });
  assert.ok(suggestion.includes('• Dari : Anonim'));
  assert.ok(suggestion.includes('• Judul : Pojok Baca'));
});

test('getCooldownStatus calculates remaining seconds accurately', () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(getCooldownStatus(0, now), { active: false, remainingSeconds: 0 });
  assert.deepEqual(getCooldownStatus(now - 500, now), { active: false, remainingSeconds: 0 });
  assert.deepEqual(getCooldownStatus(now + 15_200, now), { active: true, remainingSeconds: 16 });
});
