/**
 * sw.js - service worker for Ruang Kelas.
 *
 * - Versioned cache: BUMP CACHE_VERSION whenever any file in APP_SHELL changes.
 * - App shell is precached (HTML, CSS, JS, fonts, icons, manifest).
 * - index.html / navigations: network first, cached copy when offline.
 * - Other same-origin static files: cache first.
 * - Never caches cross-origin requests (Supabase data, logins, uploads stay private and fresh).
 * - A new version waits until the user taps "Muat ulang" (SKIP_WAITING message).
 */

const CACHE_VERSION = 'v18';
const CACHE_PREFIX = 'ruang-kelas-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Relative to this file, so it works under a GitHub Pages repository subpath.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/class-info.js',
  './assets/js/confetti.js',
  './assets/js/disc-math.js',
  './assets/js/gallery.js',
  './assets/js/reports.js',
  './assets/js/schedule.js',
  './assets/js/theme.js',
  './assets/js/storage.js',
  './assets/js/ui.js',
  './assets/js/utils.js',
  './assets/js/wheel.js',
  './data/class-data.js',
  './data/default-data.json',
  './assets/fonts/atkinson-hyperlegible-400.woff2',
  './assets/fonts/atkinson-hyperlegible-700.woff2',
  './assets/fonts/source-serif-4-var.woff2',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

const INDEX_URL = new URL('./index.html', self.location).href;
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image', 'manifest']);

function isAlwaysFreshPath(pathname) {
  return (
    pathname.endsWith('/data/class-data.js') ||
    pathname.endsWith('/data/default-data.json') ||
    pathname.includes('/assets/photos/')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function offlineFallbackResponse() {
  return new Response(
    '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Offline</title><p style="font-family:system-ui,sans-serif;padding:16px">' +
      'Kamu sedang offline dan halaman ini belum pernah tersimpan di perangkat ini. Sambungkan internet lalu coba lagi.</p></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await cache.put(INDEX_URL, response.clone());
    }
    return response;
  } catch (err) {
    const cached = (await cache.match(INDEX_URL)) || (await cache.match(new URL('./', self.location).href));
    return cached || offlineFallbackResponse();
  }
}

async function networkFirstResource(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || offlineFallbackResponse();
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin requests

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Always fetch fresh class data and photos when online so Farsky's file edits
  // appear immediately on a normal refresh.
  if (isAlwaysFreshPath(url.pathname)) {
    event.respondWith(networkFirstResource(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(cacheFirstStatic(request));
  }
});
