/**
 * schedule.js - smart daily schedule logic and safe DOM renderer.
 *
 * ONE authoritative pure function `getScheduleView(now, schedule, settings)`
 * computes `{ mode, shownDay, shownDayLabel, isShownDayToday, pinnedDay,
 * currentPeriod, nextPeriod, periodsByDay, shownPeriods, daysOrder, switchTime }`.
 *
 * Rules (Part 4.2):
 * - Current time `now` is injected and converted to Asia/Jakarta (WIB, UTC+7)
 *   explicitly.
 * - Default switch time S = "20:00", default school days = Senin..Jumat.
 * - Authoritative mode / shownDay table (WIB):
 *   - Mon–Fri, 00:00 up to S  (nowMin < S)  -> mode: 'single', shownDay: today
 *   - Mon–Thu, S up to 24:00  (nowMin >= S) -> mode: 'single', shownDay: tomorrow
 *   - Friday,  S up to 24:00  (nowMin >= S) -> mode: 'single', shownDay: 'Senin', shownDayLabel: 'Senin depan'
 *   - Saturday, all day                     -> mode: 'full',   shownDay: null, pinnedDay: null
 *   - Sunday, all day                       -> mode: 'full',   shownDay: null, pinnedDay: 'Senin'
 * - Highlight 'Sedang berlangsung' (`currentPeriod`) and 'Selanjutnya' (`nextPeriod`)
 *   ONLY when `shownDay` is today (`isShownDayToday === true`).
 *   - When time is inside a period (`start <= nowMin < end`): `currentPeriod` is
 *     that period and `nextPeriod` is the next period after it (or `null` if last).
 *   - When in a gap between lessons or before the first lesson (`nowMin < next.start`):
 *     `currentPeriod` is `null` and `nextPeriod` is the upcoming period.
 *   - When after the last lesson of the day (`nowMin >= last.end`):
 *     both `currentPeriod` and `nextPeriod` are `null`.
 */

import { getWIBParts } from './utils.js';

export const DEFAULT_SWITCH_TIME = '20:00';
export const DEFAULT_SCHOOL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

const WIB_WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const TIME_RE = /^([01]\d|2[0-3])[:.]([0-5]\d)$/;

/**
 * Parses a "HH:MM" or "HH.MM" 24-hour string into minutes since 00:00 (0..1439),
 * or returns `null` if invalid.
 */
export function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== 'string') return null;
  const m = timeStr.trim().match(TIME_RE);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function normalizeTimeDisplay(timeStr) {
  const m = String(timeStr || '').trim().match(TIME_RE);
  return m ? `${m[1]}.${m[2]}` : '';
}

function sanitizePeriods(rawSchedule) {
  if (!Array.isArray(rawSchedule)) return [];
  const valid = [];
  rawSchedule.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const day = typeof item.day === 'string' ? item.day.trim() : '';
    const subject = typeof item.subject === 'string' ? item.subject.trim() : '';
    const startMin = parseTimeToMinutes(item.start);
    const endMin = parseTimeToMinutes(item.end);
    if (!WIB_WEEKDAYS.includes(day) || !subject || startMin === null || endMin === null || endMin <= startMin) {
      return;
    }
    valid.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `${day.toLowerCase()}-${idx + 1}`,
      day,
      subject,
      start: `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`,
      end: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
      startDisplay: normalizeTimeDisplay(item.start),
      endDisplay: normalizeTimeDisplay(item.end),
      teacher: typeof item.teacher === 'string' ? item.teacher.trim() : '',
      classroom: typeof item.classroom === 'string' ? item.classroom.trim() : '',
      startMin,
      endMin
    });
  });

  valid.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return valid;
}

/**
 * The SINGLE schedule computation function for the entire project.
 *
 * @param {Date|string|number} now - Current instant (converted explicitly to WIB).
 * @param {Array} schedule - Array of period objects.
 * @param {{ switchTime?: string, schoolDays?: string[] }} [settings]
 */
export function getScheduleView(now = new Date(), schedule = [], settings = {}) {
  const wib = getWIBParts(now);
  const nowMinutes = wib.hour * 60 + wib.minute;
  const todayName = WIB_WEEKDAYS[wib.weekday];

  const switchMin =
    settings && typeof settings === 'object' && parseTimeToMinutes(settings.switchTime) !== null
      ? parseTimeToMinutes(settings.switchTime)
      : parseTimeToMinutes(DEFAULT_SWITCH_TIME);

  const switchTime = `${String(Math.floor(switchMin / 60)).padStart(2, '0')}:${String(switchMin % 60).padStart(2, '0')}`;

  const schoolDays =
    settings &&
    typeof settings === 'object' &&
    Array.isArray(settings.schoolDays) &&
    settings.schoolDays.length > 0 &&
    settings.schoolDays.every((d) => WIB_WEEKDAYS.includes(d))
      ? [...settings.schoolDays]
      : [...DEFAULT_SCHOOL_DAYS];

  const cleanPeriods = sanitizePeriods(schedule);
  const periodsByDay = {};
  for (const day of schoolDays) {
    periodsByDay[day] = [];
  }
  for (const p of cleanPeriods) {
    if (!periodsByDay[p.day]) periodsByDay[p.day] = [];
    periodsByDay[p.day].push(p);
  }

  let mode = 'single';
  let shownDay = null;
  let shownDayLabel = '';
  let pinnedDay = null;
  let isShownDayToday = false;

  if (wib.weekday === 6) {
    // Saturday, all day -> full week, all days
    mode = 'full';
    shownDay = null;
    shownDayLabel = 'Semua hari';
    pinnedDay = null;
  } else if (wib.weekday === 0) {
    // Sunday, all day -> full week, all days, Monday pinned on top
    mode = 'full';
    shownDay = null;
    shownDayLabel = 'Semua hari';
    pinnedDay = 'Senin';
  } else if (nowMinutes < switchMin) {
    // Mon-Fri, 00:00 up to S -> single, today
    mode = 'single';
    shownDay = todayName;
    shownDayLabel = todayName;
    isShownDayToday = true;
  } else if (wib.weekday === 5) {
    // Friday, S up to 24:00 -> single, Monday (label 'Senin depan')
    mode = 'single';
    shownDay = 'Senin';
    shownDayLabel = 'Senin depan';
    isShownDayToday = false;
  } else {
    // Mon-Thu, S up to 24:00 -> single, tomorrow
    mode = 'single';
    const tomorrowName = WIB_WEEKDAYS[wib.weekday + 1];
    shownDay = tomorrowName;
    shownDayLabel = tomorrowName;
    isShownDayToday = false;
  }

  let currentPeriod = null;
  let nextPeriod = null;

  if (mode === 'single' && isShownDayToday && shownDay) {
    const todayPeriods = periodsByDay[shownDay] || [];
    for (let i = 0; i < todayPeriods.length; i++) {
      const p = todayPeriods[i];
      if (nowMinutes >= p.startMin && nowMinutes < p.endMin) {
        currentPeriod = p;
        nextPeriod = todayPeriods[i + 1] || null;
        break;
      }
      if (nowMinutes < p.startMin) {
        // Before the first lesson or in a gap between lessons: show ONLY 'Selanjutnya'
        currentPeriod = null;
        nextPeriod = p;
        break;
      }
    }
  }

  // Order of days for full-week rendering (with pinnedDay first if set)
  const daysOrder = [...schoolDays];
  for (const extraDay of Object.keys(periodsByDay)) {
    if (!daysOrder.includes(extraDay) && periodsByDay[extraDay].length > 0) {
      daysOrder.push(extraDay);
    }
  }
  if (pinnedDay && daysOrder.includes(pinnedDay)) {
    const idx = daysOrder.indexOf(pinnedDay);
    daysOrder.splice(idx, 1);
    daysOrder.unshift(pinnedDay);
  }

  const shownPeriods = shownDay ? periodsByDay[shownDay] || [] : [];

  return {
    mode,
    shownDay,
    shownDayLabel,
    isShownDayToday,
    pinnedDay,
    currentPeriod,
    nextPeriod,
    shownPeriods,
    periodsByDay,
    daysOrder,
    switchTime,
    hasAnyPeriods: cleanPeriods.length > 0
  };
}

/* ==========================================================================
   DOM Renderer for Beranda & Jadwal tab (textContent only, zero innerHTML)
   ========================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';

function createIcon(symbolId, extraClass = 'icon--sm') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', extraClass ? `icon ${extraClass}` : 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${symbolId}`);
  svg.appendChild(use);
  return svg;
}

function createEmptyState(message) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  wrap.appendChild(createIcon('i-calendar', 'icon--sm'));
  const p = document.createElement('p');
  p.textContent = message;
  wrap.appendChild(p);
  return wrap;
}

function createStatusStamp(kind, label, iconId) {
  const span = document.createElement('span');
  span.className = 'stamp-badge';
  span.dataset.kind = kind;
  span.appendChild(createIcon(iconId, ''));
  const txt = document.createElement('span');
  txt.textContent = label;
  span.appendChild(txt);
  return span;
}

function createPeriodRow(period, { isCurrent = false, isNext = false } = {}) {
  const li = document.createElement('li');
  li.className = 'schedule-row';
  if (period.id) li.dataset.periodId = period.id;
  if (isCurrent) li.classList.add('schedule-row--current');
  if (isNext) li.classList.add('schedule-row--next');

  const timeCol = document.createElement('div');
  timeCol.className = 'schedule-row__time';
  timeCol.textContent = `${period.startDisplay} – ${period.endDisplay}`;
  li.appendChild(timeCol);

  const mainCol = document.createElement('div');
  mainCol.className = 'schedule-row__main';

  const topLine = document.createElement('div');
  topLine.className = 'schedule-row__top';

  const subj = document.createElement('h4');
  subj.className = 'schedule-row__subject';
  subj.textContent = period.subject;
  topLine.appendChild(subj);

  if (isCurrent) {
    topLine.appendChild(createStatusStamp('urgent', 'Sedang berlangsung', 'i-clock'));
  } else if (isNext) {
    topLine.appendChild(createStatusStamp('soon', 'Selanjutnya', 'i-clock'));
  }

  mainCol.appendChild(topLine);

  const metaParts = [period.teacher, period.classroom].filter(Boolean);
  if (metaParts.length > 0) {
    const meta = document.createElement('p');
    meta.className = 'schedule-row__meta';
    meta.textContent = metaParts.join(' · ');
    mainCol.appendChild(meta);
  }

  li.appendChild(mainCol);
  return li;
}

function createDayCard(dayName, periods, {
  headingLabel = dayName,
  isPinned = false,
  currentPeriod = null,
  nextPeriod = null
} = {}) {
  const card = document.createElement('article');
  card.className = 'schedule-day';
  card.dataset.day = dayName;
  if (isPinned) card.classList.add('schedule-day--pinned');

  const head = document.createElement('header');
  head.className = 'schedule-day__head';

  const title = document.createElement('h3');
  title.className = 'schedule-day__title';
  title.textContent = headingLabel;
  head.appendChild(title);

  if (isPinned) {
    head.appendChild(createStatusStamp('urgent', 'Disematkan · Senin', 'i-pin'));
  } else {
    const count = document.createElement('span');
    count.className = 'schedule-day__count';
    count.textContent = periods.length > 0 ? `${periods.length} jam pelajaran` : 'Kosong';
    head.appendChild(count);
  }

  card.appendChild(head);

  if (!periods || periods.length === 0) {
    card.appendChild(createEmptyState(`Belum ada jadwal untuk hari ${dayName}.`));
    return card;
  }

  const ol = document.createElement('ol');
  ol.className = 'schedule-list';
  for (const p of periods) {
    ol.appendChild(
      createPeriodRow(p, {
        isCurrent: Boolean(currentPeriod && currentPeriod.id === p.id),
        isNext: Boolean(nextPeriod && nextPeriod.id === p.id)
      })
    );
  }
  card.appendChild(ol);
  return card;
}

/**
 * Renders both the Beranda schedule preview card and the full Jadwal tab.
 * Includes the "Lihat semua jadwal" toggle button so visitors on a single-day
 * view can inspect the full week (and switch back) at any time.
 */
export function renderSchedule(data, {
  now = new Date(),
  forceFullWeek = false,
  onToggleFullWeek,
  onOpenJadwal
} = {}) {
  if (!data) return;

  const view = getScheduleView(now, data.schedule || [], data.scheduleSettings || {});

  // 1. Beranda schedule card
  const homeEyebrow = document.getElementById('home-jadwal-eyebrow');
  const homeTitle = document.getElementById('h-home-jadwal');
  const homeBody = document.getElementById('home-jadwal-body');

  if (homeEyebrow && homeTitle && homeBody) {
    homeBody.replaceChildren();

    if (!view.hasAnyPeriods) {
      homeEyebrow.textContent = 'Jadwal';
      homeTitle.textContent = 'Jadwal pelajaran';
      homeBody.appendChild(createEmptyState('Jadwal pelajaran belum diisi.'));
    } else {
      const previewDay = view.mode === 'single' ? view.shownDay : view.pinnedDay || view.daysOrder[0];
      const previewLabel = view.mode === 'single' ? view.shownDayLabel : previewDay;
      const previewPeriods = view.periodsByDay[previewDay] || [];

      if (view.isShownDayToday && view.currentPeriod) {
        homeEyebrow.textContent = `Sekarang: ${view.currentPeriod.subject}`;
      } else if (view.isShownDayToday && view.nextPeriod) {
        homeEyebrow.textContent = `Selanjutnya pukul ${view.nextPeriod.startDisplay}`;
      } else if ( previewPeriods.length > 0 ) {
        homeEyebrow.textContent = `${previewLabel} · Mulai pukul ${previewPeriods[0].startDisplay}`;
      } else {
        homeEyebrow.textContent = `Jadwal · ${previewLabel}`;
      }

      homeTitle.textContent = `Jadwal ${previewLabel}`;

      if (previewPeriods.length === 0) {
        homeBody.appendChild(createEmptyState(`Belum ada jadwal untuk hari ${previewDay}.`));
      } else {
        const ol = document.createElement('ol');
        ol.className = 'schedule-list';
        for (const p of previewPeriods) {
          ol.appendChild(
            createPeriodRow(p, {
              isCurrent: Boolean(view.isShownDayToday && view.currentPeriod && view.currentPeriod.id === p.id),
              isNext: Boolean(view.isShownDayToday && view.nextPeriod && view.nextPeriod.id === p.id)
            })
          );
        }
        homeBody.appendChild(ol);
      }

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'button section-jump';
      jumpBtn.textContent = 'Lihat semua jadwal';
      jumpBtn.addEventListener('click', () => {
        if (typeof onOpenJadwal === 'function') onOpenJadwal();
      });
      homeBody.appendChild(jumpBtn);
    }
  }

  // 2. Jadwal tab
  const jadwalSub = document.getElementById('jadwal-mode-note');
  const jadwalToggleBtn = document.getElementById('jadwal-toggle-all');
  const jadwalBody = document.getElementById('jadwal-body');

  if (!jadwalBody) return;
  jadwalBody.replaceChildren();

  if (!view.hasAnyPeriods) {
    if (jadwalSub) jadwalSub.textContent = 'Jadwal pelajaran belum diisi di data/class-data.js.';
    if (jadwalToggleBtn) jadwalToggleBtn.hidden = true;
    jadwalBody.appendChild(createEmptyState('Jadwal pelajaran belum diisi.'));
    return;
  }

  const showAllDays = view.mode === 'full' || forceFullWeek;

  if (jadwalSub) {
    const switchDisplay = view.switchTime.replace(':', '.');
    if (view.mode === 'full') {
      jadwalSub.textContent = view.pinnedDay
        ? `Akhir pekan: menampilkan jadwal sepekan (${view.pinnedDay} disematkan di atas).`
        : 'Akhir pekan: menampilkan jadwal lengkap sepekan.';
    } else if (view.isShownDayToday) {
      jadwalSub.textContent = `Menampilkan jadwal hari ini (${view.shownDayLabel}). Otomatis berganti ke jadwal besok setelah pukul ${switchDisplay} WIB.`;
    } else {
      jadwalSub.textContent = `Sudah lewat pukul ${switchDisplay} WIB: menampilkan jadwal untuk ${view.shownDayLabel}.`;
    }
  }

  if (jadwalToggleBtn) {
    if (view.mode === 'full') {
      jadwalToggleBtn.hidden = true;
    } else {
      jadwalToggleBtn.hidden = false;
      jadwalToggleBtn.textContent = showAllDays ? `Tampilkan ${view.shownDayLabel} saja` : 'Lihat semua jadwal';
      jadwalToggleBtn.setAttribute('aria-pressed', String(showAllDays));
      jadwalToggleBtn.onclick = () => {
        if (typeof onToggleFullWeek === 'function') onToggleFullWeek(!showAllDays);
      };
    }
  }

  if (!showAllDays && view.shownDay) {
    jadwalBody.appendChild(
      createDayCard(view.shownDay, view.shownPeriods, {
        headingLabel: view.shownDayLabel,
        isPinned: false,
        currentPeriod: view.currentPeriod,
        nextPeriod: view.nextPeriod
      })
    );
  } else {
    const weekGrid = document.createElement('div');
    weekGrid.className = 'schedule-week';
    for (const dayName of view.daysOrder) {
      const isTodayInWeek = view.isShownDayToday && dayName === view.shownDay;
      weekGrid.appendChild(
        createDayCard(dayName, view.periodsByDay[dayName] || [], {
          headingLabel: dayName,
          isPinned: view.pinnedDay === dayName,
          currentPeriod: isTodayInWeek ? view.currentPeriod : null,
          nextPeriod: isTodayInWeek ? view.nextPeriod : null
        })
      );
    }
    jadwalBody.appendChild(weekGrid);
  }
}
