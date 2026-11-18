/**
 * storage.js - the ONLY module that reads or writes data in Ruang Kelas.
 *
 * Architecture (approved by Farsky):
 * - All shared class data and photos are managed directly in files:
 *   - Data file: `data/class-data.js` (mirrored to `data/default-data.json`)
 *   - Photo folder: `assets/photos/` (and `assets/photos/kelas/` for class info/PR)
 * - Per-browser preferences and state stay in localStorage under the "rk." prefix:
 *   theme, accent, gallery view mode, likes, homework checklist, wheel settings/history,
 *   and WhatsApp report cooldown timestamp.
 * - Offline cache: a snapshot of the validated class data is cached in localStorage
 *   under "rk.cache.classData" so cached data is available immediately and offline.
 */

import { CLASS_DATA } from '../../data/class-data.js';

const PREFIX = 'rk.';
const CACHE_KEY = `${PREFIX}cache.classData`;

/** Allowed per-browser preference keys. */
const PREF_KEYS = new Set([
  'theme',
  'accent',
  'galleryView',
  'wheelMuted',
  'wheelVibrate',
  'wheelExcludePicked',
  'reportCooldownUntil'
]);

/** Allowed per-browser JSON state keys. */
const STATE_KEYS = new Set([
  'homeworkDone',
  'galleryLikes',
  'wheelPickedIds',
  'wheelHistory',
  'seenTimestamps'
]);

const VALID_ACCENTS = new Set(['red', 'periwinkle', 'green', 'teal', 'orange']);
const VALID_DAYS = new Set(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']);
const SAFE_PHOTO_RE = /^(?:kelas\/)?[a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp|svg)$/i;
const DATE_YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY_MONTH_RE = /^(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function getLocalStorage(customStorage) {
  if (customStorage !== undefined) return customStorage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function assertPrefKey(key) {
  if (!PREF_KEYS.has(key)) throw new Error(`Kunci preferensi tidak dikenal: ${key}`);
}

function assertStateKey(key) {
  if (!STATE_KEYS.has(key)) throw new Error(`Kunci status lokal tidak dikenal: ${key}`);
}

/**
 * Reads a simple string preference from localStorage.
 * @returns {string|null}
 */
export function getPref(key, fallback = null, storage) {
  assertPrefKey(key);
  const store = getLocalStorage(storage);
  if (!store) return fallback;
  try {
    const value = store.getItem(PREFIX + key);
    return value === null ? fallback : value;
  } catch (err) {
    console.warn(`Preferensi "${key}" tidak bisa dibaca dari browser ini.`, err);
    return fallback;
  }
}

/**
 * Writes a simple string preference to localStorage and confirms the write.
 * @returns {boolean}
 */
export function setPref(key, value, storage) {
  assertPrefKey(key);
  const store = getLocalStorage(storage);
  if (!store) return false;
  try {
    const str = String(value);
    store.setItem(PREFIX + key, str);
    return store.getItem(PREFIX + key) === str;
  } catch (err) {
    console.warn(`Preferensi "${key}" tidak bisa disimpan di browser ini.`, err);
    return false;
  }
}

/**
 * Reads a structured JSON state value (checklist, likes, wheel history) from localStorage.
 */
export function getLocalState(key, fallback, storage) {
  assertStateKey(key);
  const store = getLocalStorage(storage);
  if (!store) return structuredClone(fallback);
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return structuredClone(fallback);
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Status lokal "${key}" tidak valid, memakai nilai awal.`, err);
    return structuredClone(fallback);
  }
}

/**
 * Writes a structured JSON state value to localStorage and confirms the write.
 */
export function setLocalState(key, value, storage) {
  assertStateKey(key);
  const store = getLocalStorage(storage);
  if (!store) return false;
  try {
    const serialized = JSON.stringify(value);
    store.setItem(PREFIX + key, serialized);
    return store.getItem(PREFIX + key) === serialized;
  } catch (err) {
    console.warn(`Status lokal "${key}" tidak bisa disimpan di browser ini.`, err);
    return false;
  }
}

/**
 * Resolves a photo filename from `data/class-data.js` into a relative path
 * under `./assets/photos/` so it works on any GitHub Pages repository subpath.
 *
 * Examples:
 * - resolvePhotoPath("momen-01.jpg") -> "./assets/photos/momen-01.jpg"
 * - resolvePhotoPath("kelas/info-01.jpg") -> "./assets/photos/kelas/info-01.jpg"
 * - resolvePhotoPath("") -> ""
 */
export function resolvePhotoPath(filename) {
  if (filename === undefined || filename === null) return '';
  const clean = String(filename).trim().replace(/^\.?\/?assets\/photos\//i, '');
  if (!clean) return '';
  if (clean.includes('..') || clean.startsWith('/') || /^[a-z]+:/i.test(clean)) {
    throw new Error(`Nama file foto tidak aman atau tidak valid: "${filename}". Gunakan nama file di dalam folder assets/photos/.`);
  }
  if (!SAFE_PHOTO_RE.test(clean)) {
    throw new Error(
      `Nama file foto "${filename}" belum sesuai aturan. Gunakan huruf/angka/tanda hubung (tanpa spasi) dengan akhiran .jpg, .jpeg, .png, .webp, atau .svg.`
    );
  }
  return `./assets/photos/${clean}`;
}

/**
 * Validates the entire class data object from `data/class-data.js` (or JSON)
 * and returns `{ ok: boolean, errors: string[], data: object }`.
 * All error messages are in clear Bahasa Indonesia for Farsky.
 */
export function validateClassData(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Data kelas harus berupa objek utama (CLASS_DATA).'], data: null };
  }

  // 1. siteSettings
  const s = raw.siteSettings;
  if (!s || typeof s !== 'object') {
    errors.push('Bagian "siteSettings" wajib ada di data/class-data.js.');
  } else {
    if (typeof s.heroTitle !== 'string' || !s.heroTitle.trim()) {
      errors.push('siteSettings.heroTitle tidak boleh kosong.');
    }
    if (typeof s.whatsappNumber === 'string' && s.whatsappNumber.trim() !== '') {
      if (!/^\d{10,15}$/.test(s.whatsappNumber.trim())) {
        errors.push('siteSettings.whatsappNumber harus berisi angka saja (10 sampai 15 digit, contoh "6281234567890") atau dikosongkan "".');
      }
    }
    if (typeof s.reportCooldownSeconds !== 'number' || s.reportCooldownSeconds < 10) {
      errors.push('siteSettings.reportCooldownSeconds harus berupa angka minimal 10.');
    }
    if (s.defaultAccent && !VALID_ACCENTS.has(s.defaultAccent)) {
      errors.push(`siteSettings.defaultAccent "${s.defaultAccent}" tidak dikenal.`);
    }
  }

  // 2. classInfo
  const ci = raw.classInfo;
  if (!ci || typeof ci !== 'object') {
    errors.push('Bagian "classInfo" wajib ada di data/class-data.js.');
  } else {
    if (typeof ci.title !== 'string' || !ci.title.trim()) {
      errors.push('classInfo.title tidak boleh kosong.');
    }
    if (ci.image) {
      try {
        resolvePhotoPath(ci.image);
      } catch (err) {
        errors.push(`classInfo.image: ${err.message}`);
      }
    }
  }

  // Helper for record lists (homework, exams, kisiKisi, announcements)
  const checkRecordList = (listName, list, dateField, dateRequired = false) => {
    if (!Array.isArray(list)) {
      errors.push(`Bagian "${listName}" harus berupa daftar/array [ ... ].`);
      return;
    }
    const ids = new Set();
    list.forEach((item, idx) => {
      const label = `${listName}[${idx}]`;
      if (!item || typeof item !== 'object') {
        errors.push(`${label} harus berupa objek { ... }.`);
        return;
      }
      if (typeof item.id !== 'string' || !item.id.trim()) {
        errors.push(`${label}.id tidak boleh kosong.`);
      } else if (ids.has(item.id)) {
        errors.push(`${label}.id "${item.id}" duplikat (setiap id harus unik).`);
      } else {
        ids.add(item.id);
      }
      if (typeof item.title !== 'string' || !item.title.trim()) {
        errors.push(`${label}.title tidak boleh kosong.`);
      }
      const dateVal = item[dateField];
      if (dateRequired && (!dateVal || typeof dateVal !== 'string')) {
        errors.push(`${label}.${dateField} wajib diisi dengan format YYYY-MM-DD.`);
      } else if (typeof dateVal === 'string' && dateVal.trim() !== '' && !DATE_YMD_RE.test(dateVal.trim())) {
        errors.push(`${label}.${dateField} "${dateVal}" harus berformat YYYY-MM-DD (contoh "2026-11-20").`);
      }
      if (item.image) {
        try {
          resolvePhotoPath(item.image);
        } catch (err) {
          errors.push(`${label}.image: ${err.message}`);
        }
      }
    });
  };

  checkRecordList('homework', raw.homework, 'deadline', true);
  checkRecordList('exams', raw.exams, 'date', true);
  checkRecordList('kisiKisi', raw.kisiKisi, 'date', false);
  checkRecordList('announcements', raw.announcements, 'date', false);

  // 3. customSections
  if (!Array.isArray(raw.customSections)) {
    errors.push('Bagian "customSections" harus berupa array [ ... ].');
  } else {
    raw.customSections.forEach((sec, idx) => {
      if (!sec || typeof sec !== 'object' || !sec.id || !sec.title) {
        errors.push(`customSections[${idx}] wajib memiliki id dan title.`);
        return;
      }
      checkRecordList(`customSections[${idx}].items`, sec.items || [], 'date', false);
    });
  }

  // 4. scheduleSettings & schedule
  const ss = raw.scheduleSettings;
  if (!ss || typeof ss !== 'object' || !TIME_HM_RE.test(ss.switchTime || '')) {
    errors.push('scheduleSettings.switchTime wajib berformat "HH:MM" 24 jam (contoh "20:00").');
  }
  if (!Array.isArray(raw.schedule)) {
    errors.push('Bagian "schedule" harus berupa array [ ... ].');
  } else {
    raw.schedule.forEach((p, idx) => {
      const label = `schedule[${idx}]`;
      if (!p || typeof p !== 'object') {
        errors.push(`${label} harus berupa objek.`);
        return;
      }
      if (!VALID_DAYS.has(p.day)) {
        errors.push(`${label}.day "${p.day}" harus nama hari bahasa Indonesia (Senin..Minggu).`);
      }
      if (typeof p.subject !== 'string' || !p.subject.trim()) {
        errors.push(`${label}.subject tidak boleh kosong.`);
      }
      if (!TIME_HM_RE.test(p.start || '') || !TIME_HM_RE.test(p.end || '')) {
        errors.push(`${label} start/end harus berformat "HH:MM" (contoh "07:00").`);
      }
    });
  }

  // 5. students
  if (!Array.isArray(raw.students)) {
    errors.push('Bagian "students" harus berupa array [ ... ].');
  } else {
    raw.students.forEach((st, idx) => {
      if (!st || typeof st.id !== 'string' || !st.id.trim() || typeof st.name !== 'string' || !st.name.trim()) {
        errors.push(`students[${idx}] wajib memiliki id dan name.`);
      }
    });
  }

  // 6. galleryPosts
  if (!Array.isArray(raw.galleryPosts)) {
    errors.push('Bagian "galleryPosts" harus berupa array [ ... ].');
  } else {
    const ids = new Set();
    raw.galleryPosts.forEach((post, idx) => {
      const label = `galleryPosts[${idx}]`;
      if (!post || typeof post !== 'object') {
        errors.push(`${label} harus berupa objek.`);
        return;
      }
      if (typeof post.id !== 'string' || !post.id.trim()) {
        errors.push(`${label}.id tidak boleh kosong.`);
      } else if (ids.has(post.id)) {
        errors.push(`${label}.id "${post.id}" duplikat.`);
      } else {
        ids.add(post.id);
      }
      if (typeof post.file !== 'string' || !post.file.trim()) {
        errors.push(`${label}.file wajib diisi nama file foto di folder assets/photos/.`);
      } else {
        try {
          resolvePhotoPath(post.file);
        } catch (err) {
          errors.push(`${label}.file: ${err.message}`);
        }
      }
      if (typeof post.caption !== 'string' || !post.caption.trim()) {
        errors.push(`${label}.caption tidak boleh kosong.`);
      }
      if (post.date && !DATE_YMD_RE.test(post.date)) {
        errors.push(`${label}.date "${post.date}" harus berformat YYYY-MM-DD.`);
      }
    });
  }

  // 7. birthdays & piket
  if (raw.birthdays !== undefined) {
    if (!Array.isArray(raw.birthdays)) {
      errors.push('Bagian "birthdays" harus berupa array [ ... ].');
    } else {
      raw.birthdays.forEach((b, idx) => {
        if (!b || !b.name || !DAY_MONTH_RE.test(b.dayMonth || '')) {
          errors.push(`birthdays[${idx}] wajib memiliki name dan dayMonth berformat "MM-DD" (contoh "11-25").`);
        }
      });
    }
  }

  if (raw.piket !== undefined && !Array.isArray(raw.piket)) {
    errors.push('Bagian "piket" harus berupa array [ ... ].');
  }

  if (errors.length > 0) {
    return { ok: false, errors, data: null };
  }

  // Normalize photo URLs onto a cloned copy so callers get ready-to-use relative paths.
  const normalized = structuredClone(raw);
  if (normalized.classInfo && normalized.classInfo.image) {
    normalized.classInfo.imageUrl = resolvePhotoPath(normalized.classInfo.image);
  }
  for (const col of ['homework', 'exams', 'kisiKisi', 'announcements']) {
    for (const item of normalized[col]) {
      item.imageUrl = item.image ? resolvePhotoPath(item.image) : '';
    }
  }
  for (const sec of normalized.customSections) {
    for (const item of sec.items || []) {
      item.imageUrl = item.image ? resolvePhotoPath(item.image) : '';
    }
  }
  for (const post of normalized.galleryPosts) {
    post.imageUrl = resolvePhotoPath(post.file);
  }

  return { ok: true, errors: [], data: normalized };
}

/**
 * Returns the cached class data snapshot from localStorage if available.
 */
export function getCachedClassData(storage) {
  const store = getLocalStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const res = validateClassData(parsed);
    return res.ok ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * Saves the validated class data snapshot to localStorage for instant/offline loads.
 */
export function setCachedClassData(data, storage) {
  const store = getLocalStorage(storage);
  if (!store) return false;
  try {
    const serialized = JSON.stringify(data);
    store.setItem(CACHE_KEY, serialized);
    return store.getItem(CACHE_KEY) === serialized;
  } catch {
    return false;
  }
}

/**
 * Loads the class data following the cache-then-fresh flow:
 * 1. Validates the file-based `CLASS_DATA` (or an injected data source for tests).
 * 2. Updates the per-browser offline cache when valid.
 * 3. If the file has an edit mistake, falls back to the last valid cached data
 *    and reports the exact validation errors in Indonesian.
 */
export function loadClassData({ sourceData = CLASS_DATA, storage } = {}) {
  const cached = getCachedClassData(storage);
  const validation = validateClassData(sourceData);

  if (validation.ok) {
    const changed = !cached || JSON.stringify(cached) !== JSON.stringify(validation.data);
    setCachedClassData(validation.data, storage);
    return {
      ok: true,
      source: 'file',
      changed,
      data: validation.data,
      cached,
      errors: []
    };
  }

  if (cached) {
    return {
      ok: false,
      source: 'cache',
      changed: false,
      data: cached,
      cached,
      errors: validation.errors
    };
  }

  return {
    ok: false,
    source: 'none',
    changed: false,
    data: null,
    cached: null,
    errors: validation.errors
  };
}
