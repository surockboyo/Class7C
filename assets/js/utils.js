/**
 * utils.js - shared helpers with NO DOM access (safe to import in node --test).
 *
 * This is the ONLY place in the project that formats dates and times.
 * All output is Bahasa Indonesia, timezone Asia/Jakarta (WIB), 24-hour clock,
 * e.g. "Senin, 12 Oktober 2026 pukul 07.05".
 */

export const LOCALE = 'id-ID';
export const TIME_ZONE = 'Asia/Jakarta';

/** WIB is UTC+7 all year. Indonesia has no daylight saving time. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Turns a Date, timestamp or date string into a valid Date.
 * @throws {TypeError} when the input is not a valid date.
 */
export function toValidDate(input) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Tanggal atau waktu tidak valid.');
  }
  return date;
}

/**
 * WIB calendar parts computed with plain arithmetic (no Intl needed).
 * Used for the ISO string and as the fallback when Intl is unavailable.
 */
export function getWIBParts(input) {
  const shifted = new Date(toValidDate(input).getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0 = Minggu ... 6 = Sabtu
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes()
  };
}

/* ---- Intl path (preferred). Created once; null when unsupported. ---- */
let intlFormatter;

function getIntlFormatter() {
  if (intlFormatter !== undefined) return intlFormatter;
  try {
    const formatter = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
    intlFormatter = formatter.resolvedOptions().timeZone === TIME_ZONE ? formatter : null;
  } catch (err) {
    // RangeError: this engine does not know Asia/Jakarta or id-ID.
    console.warn('Intl id-ID/Asia/Jakarta tidak tersedia, memakai perhitungan WIB manual.', err);
    intlFormatter = null;
  }
  return intlFormatter;
}

/** Reads display text parts from Intl. Returns null if the result looks wrong. */
function getIntlTextParts(date) {
  const formatter = getIntlFormatter();
  if (!formatter) return null;
  const parts = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const valid =
    DAY_NAMES.includes(parts.weekday) &&
    MONTH_NAMES.includes(parts.month) &&
    /^\d{1,2}$/.test(parts.day || '') &&
    /^\d{4}$/.test(parts.year || '') &&
    /^\d{2}$/.test(hour || '') &&
    /^\d{2}$/.test(parts.minute || '');
  if (!valid) return null; // e.g. engine fell back to another locale
  return { weekday: parts.weekday, day: String(Number(parts.day)), month: parts.month, year: parts.year, hour, minute: parts.minute };
}

function getManualTextParts(date) {
  const p = getWIBParts(date);
  return {
    weekday: DAY_NAMES[p.weekday],
    day: String(p.day),
    month: MONTH_NAMES[p.month - 1],
    year: String(p.year),
    hour: pad2(p.hour),
    minute: pad2(p.minute)
  };
}

/**
 * @param {Date|number|string} input
 * @param {{ useIntl?: boolean }} [options] useIntl=false forces the manual fallback (used by tests).
 */
function getTextParts(input, { useIntl = true } = {}) {
  const date = toValidDate(input);
  return (useIntl && getIntlTextParts(date)) || getManualTextParts(date);
}

/** "Senin, 12 Oktober 2026" */
export function formatDateWIB(input, options) {
  const p = getTextParts(input, options);
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

/** "07.05" (24-hour, dot separator as used in Indonesia) */
export function formatTimeWIB(input, options) {
  const p = getTextParts(input, options);
  return `${p.hour}.${p.minute}`;
}

/** "Senin, 12 Oktober 2026 pukul 07.05" */
export function formatDateTimeWIB(input, options) {
  const p = getTextParts(input, options);
  return `${p.weekday}, ${p.day} ${p.month} ${p.year} pukul ${p.hour}.${p.minute}`;
}

/** Machine-readable value for <time datetime>, minute precision: "2026-10-12T07:05+07:00" */
export function toWIBISOString(input) {
  const p = getWIBParts(input);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}+07:00`;
}

/**
 * Milliseconds until the next whole minute (1..60000).
 * WIB is a whole-hour offset, so UTC minute boundaries are WIB minute boundaries.
 */
export function msUntilNextMinute(nowMs) {
  if (!Number.isFinite(nowMs)) throw new TypeError('Waktu sekarang harus berupa angka.');
  const rest = ((nowMs % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
  return MINUTE_MS - rest;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const YMD_STRICT_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a "YYYY-MM-DD" date string (or ISO timestamp) into a WIB calendar date
 * (`{ year, month, day, utcDayMs }`) or returns `null` if missing/invalid.
 * `utcDayMs` is midnight UTC of that WIB calendar date for exact day-difference math.
 */
export function parseCalendarDateWIB(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const ymdMatch = trimmed.match(YMD_STRICT_RE);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() + 1 !== month ||
      probe.getUTCDate() !== day
    ) {
      return null;
    }
    // Noon WIB on that calendar day in UTC is (05:00 UTC), safe for formatDateWIB.
    const wibNoonDate = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
    return { year, month, day, utcDayMs: probe.getTime(), wibNoonDate };
  }

  try {
    const parts = getWIBParts(trimmed);
    const utcDayMs = Date.UTC(parts.year, parts.month - 1, parts.day);
    const wibNoonDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 5, 0, 0));
    return { year: parts.year, month: parts.month, day: parts.day, utcDayMs, wibNoonDate };
  } catch {
    return null;
  }
}

/**
 * Formats a "YYYY-MM-DD" calendar date (or timestamp) using the single WIB formatter.
 * Returns "" if the date is missing or invalid.
 */
export function formatCalendarDateWIB(dateStr, options) {
  const parsed = parseCalendarDateWIB(dateStr);
  if (!parsed) return '';
  return formatDateWIB(parsed.wibNoonDate, options);
}

/**
 * Computes the stamp badge and day difference for a PR / ulangan / record item.
 *
 * Badge rules (Part 4.1):
 * - If status === 'selesai': `{ kind: 'done', label: 'Selesai', icon: 'i-check', daysDiff }`
 * - If date is missing or invalid: `null` (never show a countdown for a missing/invalid date)
 * - If daysDiff < 0: `{ kind: 'overdue', label: 'Terlambat', icon: 'i-alert', daysDiff }`
 * - If daysDiff === 0: `{ kind: 'today', label: 'Hari ini', icon: 'i-clock', daysDiff }`
 * - If daysDiff === 1: `{ kind: 'urgent', label: 'H-1', icon: 'i-clock', daysDiff }`
 * - If 2 <= daysDiff <= 3: `{ kind: 'soon', label: 'H-3', icon: 'i-clock', daysDiff }`
 * - If 4 <= daysDiff <= 7: `{ kind: 'upcoming', label: 'H-7', icon: 'i-calendar', daysDiff }`
 * - If daysDiff > 7: `null` (date is shown, no urgency stamp yet)
 */
export function getDeadlineBadge(record, nowInput = new Date()) {
  if (!record || typeof record !== 'object') return null;
  const isDone = String(record.status || '').toLowerCase() === 'selesai';
  const rawDate = record.deadline || record.date || '';
  const target = parseCalendarDateWIB(rawDate);

  const nowParts = getWIBParts(nowInput);
  const todayUtcMs = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const daysDiff = target ? Math.round((target.utcDayMs - todayUtcMs) / DAY_MS) : null;

  if (isDone) {
    return { kind: 'done', label: 'Selesai', icon: 'i-check', daysDiff };
  }
  if (!target || daysDiff === null) {
    return null;
  }
  if (daysDiff < 0) {
    return { kind: 'overdue', label: 'Terlambat', icon: 'i-alert', daysDiff };
  }
  if (daysDiff === 0) {
    return { kind: 'today', label: 'Hari ini', icon: 'i-clock', daysDiff };
  }
  if (daysDiff === 1) {
    return { kind: 'urgent', label: 'H-1', icon: 'i-clock', daysDiff };
  }
  if (daysDiff <= 3) {
    return { kind: 'soon', label: 'H-3', icon: 'i-clock', daysDiff };
  }
  if (daysDiff <= 7) {
    return { kind: 'upcoming', label: 'H-7', icon: 'i-calendar', daysDiff };
  }
  return null;
}

/**
 * Sorts records for display:
 * 1. Active upcoming items (daysDiff >= 0) sorted by nearest date first.
 * 2. Active items without a date (sorted by newest createdAt/updatedAt).
 * 3. Overdue active items (daysDiff < 0) sorted by most recently overdue first.
 * 4. Completed items (status === 'selesai') at the bottom.
 */
export function sortRecordsByNearest(records, nowInput = new Date()) {
  if (!Array.isArray(records)) return [];
  const nowParts = getWIBParts(nowInput);
  const todayUtcMs = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);

  const decorated = records.map((item, index) => {
    const isDone = String(item?.status || '').toLowerCase() === 'selesai';
    const parsed = parseCalendarDateWIB(item?.deadline || item?.date || '');
    const daysDiff = parsed ? Math.round((parsed.utcDayMs - todayUtcMs) / DAY_MS) : null;

    let bucket = 1; // 0 = upcoming, 1 = undated active, 2 = overdue active, 3 = completed
    if (isDone) bucket = 3;
    else if (daysDiff !== null && daysDiff >= 0) bucket = 0;
    else if (daysDiff !== null && daysDiff < 0) bucket = 2;

    return { item, index, bucket, daysDiff, utcDayMs: parsed ? parsed.utcDayMs : 0 };
  });

  decorated.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (a.bucket === 0) {
      if (a.utcDayMs !== b.utcDayMs) return a.utcDayMs - b.utcDayMs;
    } else if (a.bucket === 2 || a.bucket === 3) {
      if (a.utcDayMs !== b.utcDayMs) return b.utcDayMs - a.utcDayMs;
    }
    return a.index - b.index;
  });

  return decorated.map((d) => d.item);
}

const DAY_MONTH_STRICT_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Computes the next occurrence and days remaining in WIB (`Asia/Jakarta`)
 * for a `"MM-DD"` birthday string relative to `nowInput`.
 * Handles Feb 29 on non-leap years by celebrating on Feb 28.
 * Returns `{ month, day, daysRemaining, formattedDate, label }` or `null` if invalid.
 */
export function getBirthdayCountdown(dayMonth, nowInput = new Date()) {
  if (typeof dayMonth !== 'string') return null;
  const m = dayMonth.trim().match(DAY_MONTH_STRICT_RE);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);

  const nowParts = getWIBParts(nowInput);
  const todayUtcMs = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);

  const buildCandidateUtc = (yr) => {
    let d = day;
    if (month === 2 && d === 29) {
      const feb29 = new Date(Date.UTC(yr, 1, 29));
      if (feb29.getUTCMonth() !== 1) d = 28;
    }
    const dt = new Date(Date.UTC(yr, month - 1, d));
    if (dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== d) return null;
    return dt.getTime();
  };

  let targetYear = nowParts.year;
  let targetUtcMs = buildCandidateUtc(targetYear);
  if (targetUtcMs === null) return null;

  if (targetUtcMs < todayUtcMs) {
    targetYear += 1;
    targetUtcMs = buildCandidateUtc(targetYear);
    if (targetUtcMs === null) return null;
  }

  const daysRemaining = Math.round((targetUtcMs - todayUtcMs) / DAY_MS);
  const formattedDate = `${day} ${MONTH_NAMES[month - 1]}`;
  let label = `${daysRemaining} hari lagi`;
  if (daysRemaining === 0) label = 'Hari ini!';
  else if (daysRemaining === 1) label = 'Besok';

  return {
    month,
    day,
    daysRemaining,
    formattedDate,
    label
  };
}

/**
 * Sorts a `birthdays` array by nearest upcoming birthday (`daysRemaining` ascending).
 */
export function sortBirthdaysByUpcoming(birthdays, nowInput = new Date()) {
  if (!Array.isArray(birthdays)) return [];
  const items = [];
  birthdays.forEach((b, idx) => {
    if (!b || typeof b.name !== 'string' || !b.name.trim()) return;
    const info = getBirthdayCountdown(b.dayMonth, nowInput);
    if (!info) return;
    items.push({
      id: b.id || `bday-${idx + 1}`,
      name: b.name.trim(),
      dayMonth: b.dayMonth.trim(),
      ...info
    });
  });
  items.sort((a, b) => a.daysRemaining - b.daysRemaining || a.name.localeCompare(b.name, 'id'));
  return items;
}


