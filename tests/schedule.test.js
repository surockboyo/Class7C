/**
 * tests/schedule.test.js
 * Deterministic tests for getScheduleView(now, schedule, settings) in
 * assets/js/schedule.js covering every weekday, Saturday, Sunday, the switch-time
 * boundary (S - 1 minute and S), midnight rollover, Friday to Monday ("Senin depan"),
 * Sunday pinning, empty schedule, invalid data, custom switch time, and
 * in-lesson, gap, and after-school highlighting.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getScheduleView } from '../assets/js/schedule.js';
import { CLASS_DATA } from '../data/class-data.js';

const SAMPLE_SCHEDULE = CLASS_DATA.schedule;
const DEFAULT_SETTINGS = { switchTime: '20:00', schoolDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] };

test('Weekdays Mon-Fri before switch time S (00:00 up to 19:59 WIB) show single mode for today', () => {
  const cases = [
    ['2026-11-16T06:30:00+07:00', 'Senin'],
    ['2026-11-17T10:00:00+07:00', 'Selasa'],
    ['2026-11-18T12:00:00+07:00', 'Rabu'],
    ['2026-11-19T15:45:00+07:00', 'Kamis'],
    ['2026-11-20T19:59:00+07:00', 'Jumat']
  ];
  for (const [iso, expectedDay] of cases) {
    const res = getScheduleView(iso, SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
    assert.equal(res.mode, 'single', `Expected single mode at ${iso}`);
    assert.equal(res.shownDay, expectedDay, `Expected ${expectedDay} at ${iso}`);
    assert.equal(res.shownDayLabel, expectedDay);
    assert.equal(res.isShownDayToday, true);
    assert.equal(res.pinnedDay, null);
  }
});

test('Switch-time boundary: S minus 1 minute (19:59) vs S (20:00) on Mon-Thu and Friday', () => {
  // Monday 19:59 WIB -> still Monday (today)
  const monBefore = getScheduleView('2026-11-16T19:59:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(monBefore.mode, 'single');
  assert.equal(monBefore.shownDay, 'Senin');
  assert.equal(monBefore.isShownDayToday, true);

  // Monday 20:00 WIB -> switches to Tuesday (tomorrow), and isShownDayToday is false
  const monAtS = getScheduleView('2026-11-16T20:00:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(monAtS.mode, 'single');
  assert.equal(monAtS.shownDay, 'Selasa');
  assert.equal(monAtS.shownDayLabel, 'Selasa');
  assert.equal(monAtS.isShownDayToday, false);
  assert.equal(monAtS.currentPeriod, null);
  assert.equal(monAtS.nextPeriod, null);

  // Tuesday, Wednesday, Thursday at 20:00 WIB -> show tomorrow
  assert.equal(getScheduleView('2026-11-17T20:00:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS).shownDay, 'Rabu');
  assert.equal(getScheduleView('2026-11-18T20:00:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS).shownDay, 'Kamis');
  assert.equal(getScheduleView('2026-11-19T20:00:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS).shownDay, 'Jumat');

  // Friday 19:59 WIB -> still Friday
  const friBefore = getScheduleView('2026-11-20T19:59:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(friBefore.shownDay, 'Jumat');

  // Friday 20:00 WIB -> Monday with label 'Senin depan'
  const friAtS = getScheduleView('2026-11-20T20:00:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(friAtS.mode, 'single');
  assert.equal(friAtS.shownDay, 'Senin');
  assert.equal(friAtS.shownDayLabel, 'Senin depan');
  assert.equal(friAtS.isShownDayToday, false);
  assert.equal(friAtS.currentPeriod, null);
  assert.equal(friAtS.nextPeriod, null);
});

test('Midnight transitions: Mon 23:59 -> Tue 00:00, and Fri 23:59 -> Sat 00:00', () => {
  // Monday 23:59 WIB shows Tuesday (tomorrow)
  const mon2359 = getScheduleView('2026-11-16T23:59:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(mon2359.mode, 'single');
  assert.equal(mon2359.shownDay, 'Selasa');
  assert.equal(mon2359.isShownDayToday, false);

  // Tuesday 00:00 WIB shows Tuesday (now today!)
  const tue0000 = getScheduleView('2026-11-17T00:00:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(tue0000.mode, 'single');
  assert.equal(tue0000.shownDay, 'Selasa');
  assert.equal(tue0000.isShownDayToday, true);

  // Friday 23:59 WIB shows Monday ('Senin depan')
  const fri2359 = getScheduleView('2026-11-20T23:59:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(fri2359.mode, 'single');
  assert.equal(fri2359.shownDay, 'Senin');
  assert.equal(fri2359.shownDayLabel, 'Senin depan');

  // Saturday 00:00 WIB switches to full week, no pinned day
  const sat0000 = getScheduleView('2026-11-21T00:00:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(sat0000.mode, 'full');
  assert.equal(sat0000.shownDay, null);
  assert.equal(sat0000.pinnedDay, null);
});

test('Saturday all day shows full week; Sunday all day shows full week with Monday pinned on top', () => {
  const satEvening = getScheduleView('2026-11-21T21:30:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(satEvening.mode, 'full');
  assert.equal(satEvening.pinnedDay, null);
  assert.equal(satEvening.currentPeriod, null);
  assert.equal(satEvening.nextPeriod, null);

  const sunMorning = getScheduleView('2026-11-22T08:15:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(sunMorning.mode, 'full');
  assert.equal(sunMorning.pinnedDay, 'Senin');
  assert.equal(sunMorning.daysOrder[0], 'Senin');
  assert.equal(sunMorning.currentPeriod, null);
  assert.equal(sunMorning.nextPeriod, null);
});

test('Highlighting: before school, in-lesson, gap between lessons, last lesson, and after school', () => {
  // Monday 7C schedule in CLASS_DATA:
  // sen-0: 06:30 - 07:20 (Upacara Bendera / Apel)
  // sen-1: 07:20 - 09:20 (PAI / P. Misbah)
  // [Istirahat gap 09:20 - 09:40]
  // sen-2: 09:40 - 11:40 (PKN / B. Desi)
  // sen-3: 11:40 - 12:30 (Sholat Dhuhur Berjamaah)
  // sen-4: 12:30 - 14:15 (SBK / B. Kis)

  // 1. Before first lesson (06:15 WIB): current = null, next = sen-0
  const before = getScheduleView('2026-11-16T06:15:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(before.currentPeriod, null);
  assert.equal(before.nextPeriod?.id, 'sen-0');

  // 2. Inside first lesson (06:45 WIB): current = sen-0, next = sen-1
  const inFirst = getScheduleView('2026-11-16T06:45:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(inFirst.currentPeriod?.id, 'sen-0');
  assert.equal(inFirst.nextPeriod?.id, 'sen-1');

  // 3. Gap (Istirahat 09:20 - 09:40, tested at 09:30 WIB): current = null, next = sen-2
  const inGap = getScheduleView('2026-11-16T09:30:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(inGap.currentPeriod, null);
  assert.equal(inGap.nextPeriod?.id, 'sen-2');

  // 4. Inside last lesson (13:15 WIB): current = sen-4, next = null
  const inLast = getScheduleView('2026-11-16T13:15:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(inLast.currentPeriod?.id, 'sen-4');
  assert.equal(inLast.nextPeriod, null);

  // 5. After school (14:30 WIB, before switch time): both current and next are null
  const afterSchool = getScheduleView('2026-11-16T14:30:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(afterSchool.currentPeriod, null);
  assert.equal(afterSchool.nextPeriod, null);

  // 6. Tomorrow shown after switch time (Monday 20:30 WIB, even if Tuesday has a lesson at 06:30):
  // never highlight Sedang berlangsung or Selanjutnya when shownDay is not today
  const afterSwitch = getScheduleView('2026-11-16T20:30:00+07:00', SAMPLE_SCHEDULE, DEFAULT_SETTINGS);
  assert.equal(afterSwitch.shownDay, 'Selasa');
  assert.equal(afterSwitch.currentPeriod, null);
  assert.equal(afterSwitch.nextPeriod, null);
});

test('Custom switch time, empty schedule, and invalid schedule entries are handled safely', () => {
  // Custom switchTime 18:30 on Wednesday
  const customBefore = getScheduleView('2026-11-18T18:29:00+07:00', SAMPLE_SCHEDULE, { switchTime: '18:30' });
  assert.equal(customBefore.shownDay, 'Rabu');
  const customAt = getScheduleView('2026-11-18T18:30:00+07:00', SAMPLE_SCHEDULE, { switchTime: '18:30' });
  assert.equal(customAt.shownDay, 'Kamis');

  // Empty schedule
  const emptyRes = getScheduleView('2026-11-16T08:00:00+07:00', [], DEFAULT_SETTINGS);
  assert.equal(emptyRes.hasAnyPeriods, false);
  assert.deepEqual(emptyRes.shownPeriods, []);
  assert.equal(emptyRes.currentPeriod, null);
  assert.equal(emptyRes.nextPeriod, null);

  // Invalid data (non-array, malformed periods, end <= start)
  const messy = [
    null,
    { day: 'HariHantu', subject: 'X', start: '07:00', end: '08:00' },
    { day: 'Senin', subject: '', start: '07:00', end: '08:00' },
    { day: 'Senin', subject: 'Terbalik', start: '09:00', end: '08:00' },
    { id: 'valid-1', day: 'Senin', subject: 'IPA', start: '08:00', end: '09:00' }
  ];
  const cleaned = getScheduleView('2026-11-16T08:15:00+07:00', messy, { switchTime: 'bukan-jam' });
  assert.equal(cleaned.switchTime, '20:00');
  assert.equal(cleaned.shownPeriods.length, 1);
  assert.equal(cleaned.currentPeriod?.id, 'valid-1');
});
