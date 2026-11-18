/**
 * tests/storage.test.js
 * Tests for the file-based class data layer (`data/class-data.js`),
 * `data/default-data.json` sync, photo path resolution & physical file existence
 * in `assets/photos/`, validation messages, and local preference/cache helpers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { CLASS_DATA } from '../data/class-data.js';
import {
  getPref,
  setPref,
  getLocalState,
  setLocalState,
  resolvePhotoPath,
  validateClassData,
  loadClassData
} from '../assets/js/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

test('data/class-data.js passes validation and every referenced photo exists in assets/photos/', () => {
  const res = validateClassData(CLASS_DATA);
  assert.equal(res.ok, true, `Validation failed: ${res.errors.join(' | ')}`);

  // Check every photo referenced in classInfo, record lists, customSections, and galleryPosts
  const photoFiles = [];
  if (CLASS_DATA.classInfo && CLASS_DATA.classInfo.image) {
    photoFiles.push(CLASS_DATA.classInfo.image);
  }
  for (const col of ['homework', 'exams', 'kisiKisi', 'announcements']) {
    for (const item of CLASS_DATA[col]) {
      if (item.image) photoFiles.push(item.image);
    }
  }
  for (const sec of CLASS_DATA.customSections) {
    for (const item of sec.items || []) {
      if (item.image) photoFiles.push(item.image);
    }
  }
  for (const post of CLASS_DATA.galleryPosts) {
    photoFiles.push(post.file);
  }

  assert.ok(photoFiles.length >= 4, 'Expected sample photo references in CLASS_DATA');
  for (const rel of photoFiles) {
    const resolved = resolvePhotoPath(rel);
    assert.match(resolved, /^\.\/assets\/photos\//);
    const diskPath = join(rootDir, resolved.replace(/^\.\//, ''));
    assert.equal(
      existsSync(diskPath),
      true,
      `File foto "${rel}" ditulis di data/class-data.js tetapi belum ada di folder assets/photos/ (${diskPath})`
    );
  }
});

test('data/default-data.json stays automatically synced with data/class-data.js and passes validation', () => {
  const jsonPath = join(rootDir, 'data', 'default-data.json');
  writeFileSync(jsonPath, `${JSON.stringify(CLASS_DATA, null, 2)}\n`, 'utf8');
  const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const res = validateClassData(parsed);
  assert.equal(res.ok, true, `default-data.json invalid: ${res.errors.join(' | ')}`);
  assert.deepEqual(parsed, CLASS_DATA);
});

test('resolvePhotoPath maps filenames to ./assets/photos/ and rejects unsafe paths', () => {
  assert.equal(resolvePhotoPath('momen-01.jpg'), './assets/photos/momen-01.jpg');
  assert.equal(resolvePhotoPath('./assets/photos/momen-02.jpg'), './assets/photos/momen-02.jpg');
  assert.equal(resolvePhotoPath('kelas/info-01.jpg'), './assets/photos/kelas/info-01.jpg');
  assert.equal(resolvePhotoPath(''), '');

  assert.throws(() => resolvePhotoPath('../secret.jpg'), /tidak aman/);
  assert.throws(() => resolvePhotoPath('https://example.com/a.jpg'), /tidak aman/);
  assert.throws(() => resolvePhotoPath('nama pakai spasi.jpg'), /belum sesuai aturan/);
  assert.throws(() => resolvePhotoPath('script.exe'), /belum sesuai aturan/);
});

test('validateClassData reports clear Indonesian errors on bad input', () => {
  const broken = structuredClone(CLASS_DATA);
  broken.siteSettings.whatsappNumber = '0812-abc';
  broken.homework[0].deadline = '20-11-2026';
  broken.scheduleSettings.switchTime = '25:99';
  broken.galleryPosts[0].file = '../hack.jpg';

  const res = validateClassData(broken);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('whatsappNumber')));
  assert.ok(res.errors.some((e) => e.includes('homework[0].deadline')));
  assert.ok(res.errors.some((e) => e.includes('switchTime')));
  assert.ok(res.errors.some((e) => e.includes('galleryPosts[0].file')));
});

test('loadClassData caches valid data and falls back to cache when file data has an error', () => {
  const store = createMemoryStorage();

  // First load from valid CLASS_DATA populates cache
  const first = loadClassData({ sourceData: CLASS_DATA, storage: store });
  assert.equal(first.ok, true);
  assert.equal(first.source, 'file');
  assert.equal(first.changed, true);
  assert.equal(first.data.galleryPosts[0].imageUrl, './assets/photos/momen-01.jpg');

  // Second load with identical data reports changed = false
  const second = loadClassData({ sourceData: CLASS_DATA, storage: store });
  assert.equal(second.ok, true);
  assert.equal(second.changed, false);

  // Simulated typo in file falls back to the cached copy
  const invalid = { ...CLASS_DATA, siteSettings: null };
  const fallback = loadClassData({ sourceData: invalid, storage: store });
  assert.equal(fallback.ok, false);
  assert.equal(fallback.source, 'cache');
  assert.ok(fallback.data);
  assert.equal(fallback.data.siteSettings.heroTitle, CLASS_DATA.siteSettings.heroTitle);
});

test('getPref/setPref and getLocalState/setLocalState validate keys and persist values', () => {
  const store = createMemoryStorage();
  assert.equal(getPref('theme', 'light', store), 'light');
  assert.equal(setPref('theme', 'dark', store), true);
  assert.equal(getPref('theme', 'light', store), 'dark');
  assert.throws(() => getPref('unknownKey', null, store), /Kunci preferensi tidak dikenal/);

  assert.deepEqual(getLocalState('homeworkDone', {}, store), {});
  assert.equal(setLocalState('homeworkDone', { 'pr-01': true }, store), true);
  assert.deepEqual(getLocalState('homeworkDone', {}, store), { 'pr-01': true });
  assert.throws(() => setLocalState('badKey', {}, store), /Kunci status lokal tidak dikenal/);
});
