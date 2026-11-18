/**
 * tests/class-info.test.js
 * Deterministic unit tests for PR / Ulangan stamp badges (H-7, H-3, H-1,
 * Hari ini, Terlambat, Selesai), missing/invalid date handling, nearest-date
 * sorting, and WIB calendar date formatting.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCalendarDateWIB,
  formatCalendarDateWIB,
  getDeadlineBadge,
  sortRecordsByNearest,
  getBirthdayCountdown,
  sortBirthdaysByUpcoming
} from '../assets/js/utils.js';

// Reference time: Selasa, 17 November 2026 pukul 10.00 WIB
const NOW = '2026-11-17T10:00:00+07:00';

test('getDeadlineBadge returns exact Indonesian stamp badges for H-7, H-3, H-1, Hari ini, Terlambat, Selesai', () => {
  assert.deepEqual(getDeadlineBadge({ deadline: '2026-11-17', status: 'aktif' }, NOW), {
    kind: 'today',
    label: 'Hari ini',
    icon: 'i-clock',
    daysDiff: 0
  });

  assert.deepEqual(getDeadlineBadge({ deadline: '2026-11-18', status: 'aktif' }, NOW), {
    kind: 'urgent',
    label: 'H-1',
    icon: 'i-clock',
    daysDiff: 1
  });

  assert.deepEqual(getDeadlineBadge({ deadline: '2026-11-19', status: 'aktif' }, NOW), {
    kind: 'soon',
    label: 'H-3',
    icon: 'i-clock',
    daysDiff: 2
  });

  assert.deepEqual(getDeadlineBadge({ deadline: '2026-11-20', status: 'aktif' }, NOW), {
    kind: 'soon',
    label: 'H-3',
    icon: 'i-clock',
    daysDiff: 3
  });

  assert.deepEqual(getDeadlineBadge({ date: '2026-11-24', status: 'aktif' }, NOW), {
    kind: 'upcoming',
    label: 'H-7',
    icon: 'i-calendar',
    daysDiff: 7
  });

  assert.deepEqual(getDeadlineBadge({ deadline: '2026-11-16', status: 'aktif' }, NOW), {
    kind: 'overdue',
    label: 'Terlambat',
    icon: 'i-alert',
    daysDiff: -1
  });

  assert.deepEqual(getDeadlineBadge({ deadline: '2026-11-16', status: 'selesai' }, NOW), {
    kind: 'done',
    label: 'Selesai',
    icon: 'i-check',
    daysDiff: -1
  });

  // More than 7 days away: no urgency stamp yet
  assert.equal(getDeadlineBadge({ date: '2026-11-30', status: 'aktif' }, NOW), null);
});

test('getDeadlineBadge never produces a countdown badge for missing or invalid dates', () => {
  assert.equal(getDeadlineBadge({ title: 'Tanpa tanggal', status: 'aktif' }, NOW), null);
  assert.equal(getDeadlineBadge({ deadline: '', status: 'aktif' }, NOW), null);
  assert.equal(getDeadlineBadge({ deadline: '2026-02-30', status: 'aktif' }, NOW), null);
  assert.equal(getDeadlineBadge({ deadline: 'bukan-tanggal', status: 'aktif' }, NOW), null);

  // Completed item without a date still gets Selesai badge with daysDiff = null
  assert.deepEqual(getDeadlineBadge({ deadline: '', status: 'selesai' }, NOW), {
    kind: 'done',
    label: 'Selesai',
    icon: 'i-check',
    daysDiff: null
  });
});

test('formatCalendarDateWIB formats YYYY-MM-DD in Asia/Jakarta and returns empty string for invalid dates', () => {
  assert.equal(formatCalendarDateWIB('2026-10-12'), 'Senin, 12 Oktober 2026');
  assert.equal(formatCalendarDateWIB('2026-11-20'), 'Jumat, 20 November 2026');
  assert.equal(formatCalendarDateWIB(''), '');
  assert.equal(formatCalendarDateWIB('2026-02-29'), '');
  assert.equal(parseCalendarDateWIB('invalid'), null);
});

test('sortRecordsByNearest orders upcoming by nearest date first, then undated, overdue, and completed last', () => {
  const items = [
    { id: 'done-1', title: 'Sudah selesai', deadline: '2026-11-17', status: 'selesai' },
    { id: 'overdue-1', title: 'Kemarin', deadline: '2026-11-15', status: 'aktif' },
    { id: 'upcoming-far', title: 'Minggu depan', deadline: '2026-11-24', status: 'aktif' },
    { id: 'undated-1', title: 'Catatan umum', deadline: '', status: 'aktif' },
    { id: 'upcoming-near', title: 'Besok', deadline: '2026-11-18', status: 'aktif' },
    { id: 'upcoming-today', title: 'Hari ini', deadline: '2026-11-17', status: 'aktif' }
  ];

  const sortedIds = sortRecordsByNearest(items, NOW).map((x) => x.id);
  assert.deepEqual(sortedIds, [
    'upcoming-today',
    'upcoming-near',
    'upcoming-far',
    'undated-1',
    'overdue-1',
    'done-1'
  ]);
});

test('getBirthdayCountdown and sortBirthdaysByUpcoming compute WIB days remaining and roll over past dates to next year', () => {
  // Reference NOW = 2026-11-17
  const todayBday = getBirthdayCountdown('11-17', NOW);
  assert.equal(todayBday.daysRemaining, 0);
  assert.equal(todayBday.label, 'Hari ini!');
  assert.equal(todayBday.formattedDate, '17 November');

  const tomorrowBday = getBirthdayCountdown('11-18', NOW);
  assert.equal(tomorrowBday.daysRemaining, 1);
  assert.equal(tomorrowBday.label, 'Besok');

  const eightDays = getBirthdayCountdown('11-25', NOW);
  assert.equal(eightDays.daysRemaining, 8);
  assert.equal(eightDays.label, '8 hari lagi');

  // Already passed this year (11-16) -> rolls to 2027-11-16 (364 days away)
  const passed = getBirthdayCountdown('11-16', NOW);
  assert.equal(passed.daysRemaining, 364);

  const sorted = sortBirthdaysByUpcoming(
    [
      { id: '1', name: 'Caca', dayMonth: '11-16' },
      { id: '2', name: 'Andi', dayMonth: '11-25' },
      { id: '3', name: 'Budi', dayMonth: '11-17' }
    ],
    NOW
  );
  assert.deepEqual(
    sorted.map((b) => b.name),
    ['Budi', 'Andi', 'Caca']
  );
});
