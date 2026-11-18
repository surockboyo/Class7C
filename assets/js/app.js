/**
 * app.js - entry point: theme, in-page navigation, live clock,
 * connection status and service-worker updates.
 * There is only ONE page (index.html); views switch with JavaScript.
 */

import { initTheme } from './theme.js';
import { loadClassData, getPref, getLocalState, setLocalState } from './storage.js';
import { renderClassInfo } from './class-info.js';
import { renderSchedule } from './schedule.js';
import { initGallery } from './gallery.js';
import { initWheel } from './wheel.js';
import { initReports } from './reports.js';
import { formatDateTimeWIB, toWIBISOString, msUntilNextMinute } from './utils.js';
import { showToast } from './ui.js';

const VIEWS = ['beranda', 'kelas', 'jadwal', 'momen', 'lainnya'];

/* ------------------------------------------------------------------ */
/* In-page navigation                                                  */
/* ------------------------------------------------------------------ */

let activeView = 'beranda';
let contentStamps = { kelas: '', jadwal: '', momen: '' };

function computeContentStamps(data) {
  if (!data) return { kelas: '', jadwal: '', momen: '' };
  const stampVersion = data.meta?.updatedAt || '';
  const kelasIds = [
    ...(data.homework || []).map((x) => `${x.id}:${x.updatedAt || x.deadline || ''}`),
    ...(data.exams || []).map((x) => `${x.id}:${x.updatedAt || x.date || ''}`),
    ...(data.announcements || []).map((x) => `${x.id}:${x.updatedAt || x.date || ''}`)
  ].join('|');
  const jadwalStamp = `${data.scheduleSettings?.switchTime || ''}:${(data.schedule || []).length}:${stampVersion}`;
  const momenIds = (data.galleryPosts || []).map((p) => `${p.id}:${p.date || ''}`).join('|');

  return {
    kelas: kelasIds || stampVersion,
    jadwal: jadwalStamp,
    momen: momenIds || stampVersion
  };
}

function updateNewContentDots() {
  const seen = getLocalState('seenTimestamps', {});
  for (const tab of ['kelas', 'jadwal', 'momen']) {
    const dot = document.querySelector(`[data-nav-dot="${tab}"]`);
    if (!dot) continue;
    const currentStamp = contentStamps[tab] || '';
    const isUnseen = Boolean(currentStamp && seen[tab] !== currentStamp && activeView !== tab);
    dot.hidden = !isUnseen;
  }
}

function markTabSeen(tab) {
  if (!['kelas', 'jadwal', 'momen'].includes(tab)) return;
  const currentStamp = contentStamps[tab];
  if (!currentStamp) return;
  const seen = getLocalState('seenTimestamps', {});
  if (seen[tab] !== currentStamp) {
    seen[tab] = currentStamp;
    setLocalState('seenTimestamps', seen);
  }
  updateNewContentDots();
}

function showView(name, { moveFocus = true } = {}) {
  if (!VIEWS.includes(name) || name === activeView) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  for (const view of document.querySelectorAll('[data-view]')) {
    const isTarget = view.dataset.view === name;
    view.hidden = !isTarget;
    view.classList.remove('is-entering');
    if (isTarget && !reduceMotion) {
      void view.offsetWidth; // restart the enter animation
      view.classList.add('is-entering');
    }
  }

  for (const item of document.querySelectorAll('#bottom-nav [data-target]')) {
    if (item.dataset.target === name) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }

  activeView = name;
  markTabSeen(name);
  window.scrollTo({ top: 0, behavior: 'instant' });
  refreshScrollReveal();

  if (moveFocus) {
    const heading = document.querySelector(`[data-view="${name}"] [data-view-heading]`);
    if (heading) heading.focus({ preventScroll: true });
  }
}

function initNavigation() {
  // One delegated listener for all five tabs.
  document.getElementById('bottom-nav').addEventListener('click', (event) => {
    const item = event.target.closest('[data-target]');
    if (item) showView(item.dataset.target);
  });
  for (const view of document.querySelectorAll('[data-view]')) {
    view.addEventListener('animationend', () => view.classList.remove('is-entering'));
  }
}

/* ------------------------------------------------------------------ */
/* Live clock (one timer, aligned to the minute, paused when hidden)   */
/* ------------------------------------------------------------------ */

let clockTimer = null;
let forceFullWeekSchedule = false;

function refreshScheduleUI(now = new Date()) {
  if (!appDataResult || !appDataResult.data) return;
  renderSchedule(appDataResult.data, {
    now,
    forceFullWeek: forceFullWeekSchedule,
    onToggleFullWeek: (nextForce) => {
      forceFullWeekSchedule = Boolean(nextForce);
      refreshScheduleUI(new Date());
    },
    onOpenJadwal: () => {
      forceFullWeekSchedule = true;
      refreshScheduleUI(new Date());
      showView('jadwal');
    }
  });
}

function renderClock() {
  const el = document.getElementById('hero-clock');
  const now = new Date();
  el.dateTime = toWIBISOString(now);
  el.textContent = formatDateTimeWIB(now);
  refreshScheduleUI(now);
}

function stopClock() {
  clearTimeout(clockTimer);
  clockTimer = null;
}

function tickClock() {
  stopClock();
  renderClock();
  clockTimer = setTimeout(tickClock, msUntilNextMinute(Date.now()));
}

function initClock() {
  tickClock();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopClock();
    else tickClock();
  });
}

/* ------------------------------------------------------------------ */
/* Class data bootstrap (from data/class-data.js + local cache)        */
/* ------------------------------------------------------------------ */

let appDataResult = null;

function applySiteSettings(data) {
  if (!data || !data.siteSettings) return;
  const s = data.siteSettings;
  const sub = document.querySelector('.brand__sub');
  const eyebrow = document.getElementById('hero-eyebrow');
  const title = document.getElementById('hero-title');
  const text = document.getElementById('hero-text');

  if (sub && s.schoolSubtitle) sub.textContent = s.schoolSubtitle;
  if (eyebrow && s.heroEyebrow) eyebrow.textContent = s.heroEyebrow;
  if (title && s.heroTitle) title.textContent = s.heroTitle;
  if (text && s.heroSubtitle) text.textContent = s.heroSubtitle;

  // Apply defaultAccent from file only if the visitor has not picked their own accent.
  if (s.defaultAccent && getPref('accent') === null) {
    document.documentElement.dataset.accent = s.defaultAccent;
  }
}

function initClassData() {
  appDataResult = loadClassData();
  if (appDataResult.data) {
    applySiteSettings(appDataResult.data);
    contentStamps = computeContentStamps(appDataResult.data);
    updateNewContentDots();
    const now = new Date();
    renderClassInfo(appDataResult.data, {
      now,
      onOpenKelas: () => showView('kelas')
    });
    refreshScheduleUI(now);
    initGallery(appDataResult.data);
    initWheel(appDataResult.data);
    initReports(appDataResult.data);
  }
  if (!appDataResult.ok && appDataResult.errors.length > 0) {
    console.error('Ada kesalahan di data/class-data.js:', appDataResult.errors);
    showToast(`Periksa data/class-data.js: ${appDataResult.errors[0]}`);
  }
}

/* ------------------------------------------------------------------ */
/* Install-as-app prompt (Bonus 4.9)                                   */
/* ------------------------------------------------------------------ */

function initInstallGuide() {
  const wrap = document.getElementById('install-prompt-wrap');
  const btn = document.getElementById('install-prompt-btn');
  if (!wrap || !btn) return;

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    wrap.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    wrap.hidden = true;
    if (choice && choice.outcome === 'accepted') {
      showToast('Aplikasi Ruang Kelas sedang dipasang.');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Connection / data status                                            */
/* ------------------------------------------------------------------ */

function renderConnectionStatus() {
  const pill = document.getElementById('data-status');
  const text = document.getElementById('data-status-text');
  const notice = document.getElementById('offline-notice');
  const online = navigator.onLine;

  if (!online) {
    pill.dataset.state = 'offline';
    text.textContent = 'Offline';
    pill.title = 'Perangkat ini sedang tidak terhubung ke internet. Menampilkan data yang tersimpan.';
  } else if (appDataResult && !appDataResult.ok) {
    pill.dataset.state = 'offline';
    text.textContent = 'Perlu Cek';
    pill.title = appDataResult.errors.join(' ');
  } else {
    pill.dataset.state = 'online';
    text.textContent = 'Siap';
    pill.title = 'Data kelas dimuat dari data/class-data.js.';
  }
  notice.hidden = online;
}

function initConnectionStatus() {
  renderConnectionStatus();
  window.addEventListener('online', renderConnectionStatus);
  window.addEventListener('offline', renderConnectionStatus);
}

/* ------------------------------------------------------------------ */
/* Service worker + "Versi baru tersedia" flow                         */
/* ------------------------------------------------------------------ */

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const banner = document.getElementById('update-banner');
  const reloadButton = document.getElementById('update-reload');
  let waitingWorker = null;
  let reloadRequested = false;

  const offerUpdate = (worker) => {
    waitingWorker = worker;
    banner.hidden = false;
  };

  reloadButton.addEventListener('click', () => {
    if (!waitingWorker) return;
    reloadRequested = true;
    reloadButton.disabled = true;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Reload only when the user asked for the update (not on first install).
    if (reloadRequested) window.location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
    })
    .catch((err) => {
      console.error('Service worker gagal didaftarkan:', err);
      showToast('Mode offline tidak aktif di browser ini.');
    });
}

/* ------------------------------------------------------------------ */
/* Scroll-triggered reveal animations                                  */
/* ------------------------------------------------------------------ */

let scrollObserver = null;

function refreshScrollReveal() {
  const targets = document.querySelectorAll(
    '.view:not([hidden]) .board-block, .view:not([hidden]) .record-card, .view:not([hidden]) .momen-item, .view:not([hidden]) .piket-card, .site-footer'
  );
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vh = window.innerHeight || 800;

  if (reduceMotion || typeof IntersectionObserver !== 'function') {
    for (const el of targets) {
      el.classList.add('scroll-reveal', 'is-revealed');
    }
    return;
  }

  if (!scrollObserver) {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            scrollObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -36px 0px' }
    );
  }

  for (const el of targets) {
    el.classList.add('scroll-reveal');
    const rect = el.getBoundingClientRect();
    if (rect.top < vh * 0.92) {
      el.classList.add('is-revealed');
    } else if (!el.classList.contains('is-revealed')) {
      scrollObserver.observe(el);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pull-the-tag physics + scroll-linked 3D depth (TikTok-inspired)     */
/* ------------------------------------------------------------------ */

function initPullTag() {
  const hero = document.getElementById('hero-stage');
  const stage = document.getElementById('pull-tag-stage');
  const tag = document.getElementById('pull-tag');
  const path = document.getElementById('pull-tag-path');
  if (!hero || !stage || !tag || !path) return;

  const SNAP_THRESHOLD = 95;
  let dragging = null;
  let snapped = false;
  let suppressClick = false;

  const setCordAndTag = (dx, dy) => {
    const pull = dy >= 0 ? dy / (1 + dy / 300) : dy * 0.2;
    const clampedX = Math.max(-28, Math.min(28, dx * 0.35));
    const rotate = Math.max(-15, Math.min(15, dx * 0.1));
    const endY = Math.max(20, 54 + pull);
    path.setAttribute('d', `M60 0 Q${60 + clampedX * 0.5} ${endY * 0.52} ${60 + clampedX} ${endY}`);
    tag.style.transform = `translate3d(${clampedX}px, ${pull}px, 0) rotate(${rotate}deg)`;
  };

  const snapAndReveal = () => {
    if (snapped) return;
    snapped = true;
    stage.classList.add('is-snapped');
    hero.classList.add('is-dropped');
    tag.disabled = true;
  };

  tag.addEventListener('pointerdown', (event) => {
    if (snapped || event.button !== 0) return;
    suppressClick = false;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    tag.classList.add('is-dragging');
    tag.setPointerCapture(event.pointerId);
  });

  tag.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    if (Math.hypot(dx, dy) > 5) dragging.moved = true;
    setCordAndTag(dx, dy);
  });

  const endDrag = (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const dy = event.clientY - dragging.y;
    const moved = dragging.moved;
    dragging = null;
    tag.classList.remove('is-dragging');
    if (dy >= SNAP_THRESHOLD || !moved) {
      suppressClick = true;
      snapAndReveal();
    } else {
      suppressClick = true;
      path.setAttribute('d', 'M60 0 Q60 28 60 54');
      tag.style.transform = '';
    }
  };

  tag.addEventListener('pointerup', endDrag);
  tag.addEventListener('pointercancel', () => {
    dragging = null;
    tag.classList.remove('is-dragging');
    path.setAttribute('d', 'M60 0 Q60 28 60 54');
    tag.style.transform = '';
  });

  tag.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    snapAndReveal();
  });
}

function initScrollDepth() {
  const bar = document.getElementById('scroll-progress');
  const rootStyle = document.documentElement.style;
  let ticking = false;

  const update = () => {
    ticking = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrollY = window.scrollY || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.max(0, Math.min(1, scrollY / maxScroll));
    if (bar) bar.style.transform = `scaleX(${ratio})`;
    if (!reduceMotion) {
      rootStyle.setProperty('--scroll-depth', `${Math.min(60, scrollY * 0.08).toFixed(1)}px`);
    }
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

/* ------------------------------------------------------------------ */

function start() {
  initClassData();
  initTheme();
  initNavigation();
  initClock();
  initConnectionStatus();
  initInstallGuide();
  initPullTag();
  initScrollDepth();
  refreshScrollReveal();
  initServiceWorker();
}

start();
