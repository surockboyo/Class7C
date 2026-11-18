/**
 * tests/clock.test.js
 * Deterministic tests for the single date/time formatter and minute alignment
 * in assets/js/utils.js.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateWIB,
  formatTimeWIB,
  formatDateTimeWIB,
  toWIBISOString,
  msUntilNextMinute,
  getWIBParts,
  toValidDate
} from '../assets/js/utils.js';

test('formatDateWIB and formatDateTimeWIB format Indonesian dates in Asia/Jakarta (24h)', () => {
  // 2026-10-12 07:05 WIB = 2026-10-12 00:05 UTC (Senin)
  const sample = '2026-10-12T00:05:00Z';
  assert.equal(formatDateWIB(sample), 'Senin, 12 Oktober 2026');
  assert.equal(formatTimeWIB(sample), '07.05');
  assert.equal(formatDateTimeWIB(sample), 'Senin, 12 Oktober 2026 pukul 07.05');
  assert.equal(toWIBISOString(sample), '2026-10-12T07:05+07:00');

  // Minggu, 1 November 2026 pukul 22.17 WIB = 2026-11-01 15:17 UTC
  const heroExample = '2026-11-01T15:17:42Z';
  assert.equal(formatDateTimeWIB(heroExample), 'Minggu, 1 November 2026 pukul 22.17');
  assert.equal(toWIBISOString(heroExample), '2026-11-01T22:17+07:00');
});

test('WIB midnight rollover converts UTC evening into the next day in Jakarta', () => {
  // 2026-10-11 16:59 UTC = Minggu, 11 Oktober 2026 pukul 23.59 WIB
  const beforeMidnight = '2026-10-11T16:59:59Z';
  assert.equal(formatDateTimeWIB(beforeMidnight), 'Minggu, 11 Oktober 2026 pukul 23.59');

  // 1 second later: 2026-10-11 17:00 UTC = Senin, 12 Oktober 2026 pukul 00.00 WIB
  const atMidnight = '2026-10-11T17:00:00Z';
  assert.equal(formatDateTimeWIB(atMidnight), 'Senin, 12 Oktober 2026 pukul 00.00');
  assert.equal(toWIBISOString(atMidnight), '2026-10-12T00:00+07:00');
});

test('Timestamps with other timezone offsets convert explicitly to WIB (+07:00)', () => {
  // New York (-04:00): 2026-06-15 13:30 EDT = 2026-06-15 17:30 UTC = Selasa, 16 Juni 2026 pukul 00.30 WIB
  const fromNY = '2026-06-15T13:30:00-04:00';
  assert.equal(formatDateTimeWIB(fromNY), 'Selasa, 16 Juni 2026 pukul 00.30');
  assert.equal(toWIBISOString(fromNY), '2026-06-16T00:30+07:00');

  // Tokyo (+09:00): 2026-12-31 01:15 JST = 2026-12-30 23:15 WIB
  const fromTokyo = '2026-12-31T01:15:00+09:00';
  assert.equal(formatDateTimeWIB(fromTokyo), 'Rabu, 30 Desember 2026 pukul 23.15');
});

test('Manual fallback (useIntl: false) matches the Intl output across months and weekdays', () => {
  const instants = [
    '2026-01-01T00:00:00+07:00',
    '2026-02-28T23:59:00+07:00',
    '2026-05-17T12:04:00+07:00',
    '2026-08-17T07:00:00+07:00',
    '2026-11-01T22:17:00+07:00',
    '2026-12-31T23:59:00+07:00'
  ];
  for (const iso of instants) {
    assert.equal(
      formatDateTimeWIB(iso, { useIntl: false }),
      formatDateTimeWIB(iso, { useIntl: true }),
      `Fallback mismatch for ${iso}`
    );
  }
  const parts = getWIBParts('2026-08-17T07:00:00+07:00');
  assert.deepEqual(parts, { year: 2026, month: 8, day: 17, weekday: 1, hour: 7, minute: 0 });
});

test('msUntilNextMinute aligns strictly to the next minute boundary (1..60000 ms)', () => {
  const base = Date.UTC(2026, 10, 1, 15, 17, 0, 0);
  assert.equal(msUntilNextMinute(base), 60_000);
  assert.equal(msUntilNextMinute(base + 1), 59_999);
  assert.equal(msUntilNextMinute(base + 15_250), 44_750);
  assert.equal(msUntilNextMinute(base + 59_999), 1);
  assert.throws(() => msUntilNextMinute(NaN), TypeError);
});

test('Invalid date inputs throw a clear Indonesian TypeError', () => {
  assert.throws(() => toValidDate('bukan-tanggal'), /Tanggal atau waktu tidak valid/);
  assert.throws(() => formatDateTimeWIB(new Date('invalid')), /Tanggal atau waktu tidak valid/);
});
