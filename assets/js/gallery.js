/**
 * gallery.js - UI and interaction for "Piringan Momen" (draggable disc gallery,
 * accessible list/grid fallback, filters, local likes, and full-screen viewer).
 *
 * Rules (Part 4.4):
 * - All disc math lives in pure module `assets/js/disc-math.js`.
 * - Pointer Events: drag to rotate (`setPointerCapture`, `touch-action: pan-y`),
 *   mouse wheel / trackpad, inertia with exponential friction, spring snap to
 *   nearest item, drag under ~6px counts as a tap.
 * - Tap front photo -> open full-screen viewer; tap side photo -> rotate it to front.
 * - Keyboard Left/Right/Home/End, visible 'Sebelumnya' and 'Berikutnya' buttons,
 *   aria-live text like 'Foto 3 dari 12: caption', persisted toggle 'Piringan | Daftar'.
 * - `prefers-reduced-motion`: no inertia, instant snapping.
 * - Animate only `transform` and `opacity` in ONE `requestAnimationFrame` loop
 *   that stops when idle.
 */

import {
  getDiscGeometry,
  normalizeRotation,
  snapRotationToNearest,
  rotationForIndex,
  getVisibleDiscItems,
  stepDiscInertia
} from './disc-math.js';
import { getPref, setPref, getLocalState, setLocalState } from './storage.js';
import { formatCalendarDateWIB } from './utils.js';
import { showToast } from './ui.js';

const TAP_SLOP_PX = 6;
const DEG_PER_PX = 0.28;
const DISC_RADIUS_PX = 250;
const SVG_NS = 'http://www.w3.org/2000/svg';

let allPosts = [];
let filteredPosts = [];
let viewMode = 'disc'; // 'disc' | 'list'
let rotation = 0;
let velocity = 0;
let activeIndex = 0;
let rafId = null;
let lastFrameMs = 0;
let initialized = false;
let lastFocusBeforeModal = null;
let modalZoomed = false;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getLikesMap() {
  return getLocalState('galleryLikes', {});
}

function isLiked(postId) {
  const map = getLikesMap();
  return Boolean(postId && map && map[postId]);
}

function toggleLike(postId) {
  if (!postId) return false;
  const map = getLikesMap();
  if (map[postId]) {
    delete map[postId];
  } else {
    map[postId] = true;
  }
  const saved = setLocalState('galleryLikes', map);
  if (!saved) {
    showToast('Status suka tidak bisa disimpan di browser ini.');
  }
  return Boolean(map[postId]);
}

function createIcon(symbolId, extraClass = 'icon--sm') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', extraClass ? `icon ${extraClass}` : 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${symbolId}`);
  svg.appendChild(use);
  return svg;
}

function stopAnimationLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastFrameMs = 0;
}

function updateLiveAnnouncement(index) {
  const live = document.getElementById('momen-live');
  const post = filteredPosts[index];
  if (!live || !post) return;
  live.textContent = `Foto ${index + 1} dari ${filteredPosts.length}: ${post.caption}`;
}

function renderHubAndControls(index) {
  const post = filteredPosts[index];
  const metaEl = document.getElementById('disc-hub-meta');
  const capEl = document.getElementById('disc-hub-caption');
  const infoEl = document.getElementById('disc-hub-info');
  const likeBtn = document.getElementById('disc-like-btn');
  const likeLabel = document.getElementById('disc-like-label');
  const posText = document.getElementById('disc-pos-text');
  const prevBtn = document.getElementById('disc-prev-btn');
  const nextBtn = document.getElementById('disc-next-btn');

  if (!post) return;

  const metaParts = [post.album, post.event, post.month].filter(Boolean);
  if (metaEl) metaEl.textContent = metaParts.join(' · ') || 'Galeri Kelas';
  if (capEl) capEl.textContent = post.caption || 'Momen kelas';

  const formattedDate = formatCalendarDateWIB(post.date || '');
  const infoParts = [];
  if (post.uploader) infoParts.push(`Diunggah oleh ${post.uploader}`);
  if (formattedDate) infoParts.push(formattedDate);
  if (infoEl) infoEl.textContent = infoParts.join(' · ');

  const liked = isLiked(post.id);
  if (likeBtn) likeBtn.setAttribute('aria-pressed', String(liked));
  if (likeLabel) likeLabel.textContent = liked ? 'Disukai' : 'Suka';

  if (posText) {
    posText.textContent = `Foto ${index + 1} dari ${filteredPosts.length}`;
  }

  const singleOnly = filteredPosts.length <= 1;
  if (prevBtn) prevBtn.disabled = singleOnly;
  if (nextBtn) nextBtn.disabled = singleOnly;
}

/**
 * Renders only the visible subset of items on the disc rim (`|angle| <= 70 deg`)
 * and sets only `transform` and `opacity` on each card.
 */
function renderDiscRim() {
  const rim = document.getElementById('disc-rim');
  if (!rim) return;

  const count = filteredPosts.length;
  if (count === 0) {
    rim.replaceChildren();
    return;
  }

  const visible = getVisibleDiscItems(count, rotation, { radiusPx: DISC_RADIUS_PX });
  const visibleByIndex = new Map(visible.map((v) => [v.index, v]));

  // Remove DOM cards that left the visible arc
  for (const child of [...rim.children]) {
    const idx = Number(child.dataset.index);
    if (!visibleByIndex.has(idx)) {
      child.remove();
    }
  }

  const existingByIndex = new Map(
    [...rim.children].map((el) => [Number(el.dataset.index), el])
  );

  for (const v of visible) {
    const post = filteredPosts[v.index];
    if (!post) continue;

    let btn = existingByIndex.get(v.index);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'disc-card';
      btn.dataset.index = String(v.index);
      btn.dataset.postId = post.id;

      const img = document.createElement('img');
      img.src = post.imageUrl;
      img.alt = post.caption || `Foto ${v.index + 1}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => {
        btn.title = 'Gambar gagal dimuat';
      });
      btn.appendChild(img);
      rim.appendChild(btn);
    }

    btn.classList.toggle('disc-card--front', v.isFront);
    btn.setAttribute(
      'aria-label',
      v.isFront
        ? `Buka foto ${v.index + 1} dari ${count}: ${post.caption}`
        : `Putar ke foto ${v.index + 1}: ${post.caption}`
    );
    btn.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) rotate(${v.angleDeg}deg) scale(${v.scale})`;
    btn.style.opacity = String(v.opacity);
  }

  const snap = snapRotationToNearest(rotation, count);
  if (snap.index >= 0 && snap.index !== activeIndex) {
    activeIndex = snap.index;
    renderHubAndControls(activeIndex);
  }
}

function startInertiaLoop() {
  if (prefersReducedMotion()) {
    const snapped = stepDiscInertia({ rotation, velocity }, filteredPosts.length, 16.67, {
      reducedMotion: true
    });
    rotation = snapped.rotation;
    velocity = 0;
    activeIndex = snapped.activeIndex >= 0 ? snapped.activeIndex : 0;
    renderDiscRim();
    renderHubAndControls(activeIndex);
    updateLiveAnnouncement(activeIndex);
    return;
  }

  if (rafId !== null) return;
  lastFrameMs = performance.now();

  const tick = (nowMs) => {
    const dt = nowMs - lastFrameMs;
    lastFrameMs = nowMs;

    const step = stepDiscInertia({ rotation, velocity }, filteredPosts.length, dt, {
      reducedMotion: false
    });
    rotation = step.rotation;
    velocity = step.velocity;
    renderDiscRim();

    if (step.done) {
      rafId = null;
      lastFrameMs = 0;
      activeIndex = step.activeIndex >= 0 ? step.activeIndex : 0;
      renderHubAndControls(activeIndex);
      updateLiveAnnouncement(activeIndex);
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
}

/**
 * Rotates the disc to bring `targetIdx` (`0 .. count - 1`) to the front.
 */
function goToIndex(targetIdx, { announce = true } = {}) {
  const count = filteredPosts.length;
  if (count <= 0) return;

  stopAnimationLoop();
  const geo = getDiscGeometry(count);
  let nextIdx = targetIdx;
  if (geo.wraps) {
    nextIdx = ((targetIdx % count) + count) % count;
  } else {
    nextIdx = Math.max(0, Math.min(count - 1, targetIdx));
  }

  const targetRot = rotationForIndex(nextIdx, rotation, count);
  if (prefersReducedMotion()) {
    rotation = targetRot;
    velocity = 0;
    activeIndex = nextIdx;
    renderDiscRim();
    renderHubAndControls(activeIndex);
    if (announce) updateLiveAnnouncement(activeIndex);
    return;
  }

  // Nudge rotation past the midpoint towards targetRot so the single RAF inertia+spring
  // loop smoothly glides into targetRot's snap basin and lands on nextIdx.
  const diff = targetRot - rotation;
  rotation += diff * 0.55;
  velocity = diff * 6;
  startInertiaLoop();
}

function stepBy(deltaStep) {
  const count = filteredPosts.length;
  if (count <= 1) return;
  goToIndex(activeIndex + deltaStep, { announce: true });
}

/* ------------------------------------------------------------------ */
/* Accessible List / Grid View ("Daftar")                              */
/* ------------------------------------------------------------------ */

function renderListGrid() {
  const grid = document.getElementById('momen-list-grid');
  if (!grid) return;
  grid.replaceChildren();

  filteredPosts.forEach((post, idx) => {
    const card = document.createElement('article');
    card.className = 'momen-item';
    card.dataset.postId = post.id;

    const mediaBtn = document.createElement('button');
    mediaBtn.type = 'button';
    mediaBtn.className = 'momen-item__media';
    mediaBtn.setAttribute('aria-label', `Perbesar foto: ${post.caption}`);
    const img = document.createElement('img');
    img.src = post.imageUrl;
    img.alt = post.caption;
    img.loading = 'lazy';
    img.decoding = 'async';
    mediaBtn.appendChild(img);
    mediaBtn.addEventListener('click', () => openPhotoModal(idx, mediaBtn));
    card.appendChild(mediaBtn);

    const meta = document.createElement('p');
    meta.className = 'momen-item__meta';
    const dateStr = formatCalendarDateWIB(post.date || '');
    meta.textContent = [post.album, post.event, dateStr].filter(Boolean).join(' · ');
    card.appendChild(meta);

    const title = document.createElement('h3');
    title.className = 'momen-item__title';
    title.textContent = post.caption;
    card.appendChild(title);

    const foot = document.createElement('div');
    foot.className = 'momen-item__foot';

    const uploader = document.createElement('span');
    uploader.className = 'momen-item__meta';
    uploader.textContent = post.uploader ? `Oleh ${post.uploader}` : '';
    foot.appendChild(uploader);

    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'button momen-like-btn';
    const liked = isLiked(post.id);
    likeBtn.setAttribute('aria-pressed', String(liked));
    likeBtn.appendChild(createIcon('i-heart', 'icon--sm'));
    const likeSpan = document.createElement('span');
    likeSpan.textContent = liked ? 'Disukai' : 'Suka';
    likeBtn.appendChild(likeSpan);

    likeBtn.addEventListener('click', () => {
      const nowLiked = toggleLike(post.id);
      likeBtn.setAttribute('aria-pressed', String(nowLiked));
      likeSpan.textContent = nowLiked ? 'Disukai' : 'Suka';
      renderHubAndControls(activeIndex);
    });

    foot.appendChild(likeBtn);
    card.appendChild(foot);
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------------ */
/* Full-screen Photo Viewer Modal (focus trap + Escape + swipe/zoom)   */
/* ------------------------------------------------------------------ */

function syncModalContent() {
  const post = filteredPosts[activeIndex];
  if (!post) return;

  const metaEl = document.getElementById('photo-modal-meta');
  const imgEl = document.getElementById('photo-modal-img');
  const capEl = document.getElementById('photo-modal-caption');
  const subEl = document.getElementById('photo-modal-sub');
  const zoomBtn = document.getElementById('photo-modal-zoom');
  const zoomLabel = document.getElementById('photo-modal-zoom-label');

  modalZoomed = false;
  if (imgEl) {
    imgEl.classList.remove('is-zoomed');
    imgEl.src = post.imageUrl;
    imgEl.alt = post.caption;
  }
  if (zoomBtn) zoomBtn.setAttribute('aria-pressed', 'false');
  if (zoomLabel) zoomLabel.textContent = 'Perbesar 2x';

  if (metaEl) {
    metaEl.textContent = `Foto ${activeIndex + 1} dari ${filteredPosts.length} · ${post.album || 'Galeri'}`;
  }
  if (capEl) capEl.textContent = post.caption;
  if (subEl) {
    const d = formatCalendarDateWIB(post.date || '');
    subEl.textContent = [post.uploader ? `Oleh ${post.uploader}` : '', d].filter(Boolean).join(' · ');
  }
}

function openPhotoModal(index, triggerEl) {
  if (filteredPosts.length === 0) return;
  activeIndex = Math.max(0, Math.min(filteredPosts.length - 1, index));
  rotation = rotationForIndex(activeIndex, rotation, filteredPosts.length);
  renderDiscRim();
  renderHubAndControls(activeIndex);

  const modal = document.getElementById('photo-modal');
  if (!modal) return;
  lastFocusBeforeModal = triggerEl || document.activeElement;
  syncModalContent();
  modal.hidden = false;

  const closeBtn = document.getElementById('photo-modal-close');
  if (closeBtn) closeBtn.focus();
}

function closePhotoModal() {
  const modal = document.getElementById('photo-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  if (lastFocusBeforeModal && typeof lastFocusBeforeModal.focus === 'function') {
    lastFocusBeforeModal.focus();
  }
  lastFocusBeforeModal = null;
}

/* ------------------------------------------------------------------ */
/* Filters & View Mode Toggle ("Piringan | Daftar")                    */
/* ------------------------------------------------------------------ */

function populateFilters() {
  const albumSelect = document.getElementById('momen-filter-album');
  const monthSelect = document.getElementById('momen-filter-month');
  const tagSelect = document.getElementById('momen-filter-tag');
  if (!albumSelect || !monthSelect || !tagSelect) return;

  const albums = [...new Set(allPosts.map((p) => p.album).filter(Boolean))];
  const months = [...new Set(allPosts.map((p) => p.month).filter(Boolean))].sort().reverse();
  const tags = [
    ...new Set(
      allPosts.flatMap((p) => [p.event, ...(Array.isArray(p.tags) ? p.tags : [])]).filter(Boolean)
    )
  ];

  const fillSelect = (select, allLabel, values) => {
    const current = select.value || 'all';
    select.replaceChildren();
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = allLabel;
    select.appendChild(optAll);
    for (const val of values) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      select.appendChild(opt);
    }
    select.value = values.includes(current) ? current : 'all';
  };

  fillSelect(albumSelect, 'Semua album', albums);
  fillSelect(monthSelect, 'Semua bulan', months);
  fillSelect(tagSelect, 'Semua tag & acara', tags);
}

function applyFiltersAndRender() {
  stopAnimationLoop();
  const albumVal = document.getElementById('momen-filter-album')?.value || 'all';
  const monthVal = document.getElementById('momen-filter-month')?.value || 'all';
  const tagVal = document.getElementById('momen-filter-tag')?.value || 'all';

  filteredPosts = allPosts.filter((post) => {
    if (albumVal !== 'all' && post.album !== albumVal) return false;
    if (monthVal !== 'all' && post.month !== monthVal) return false;
    if (tagVal !== 'all') {
      const postTags = [post.event, ...(Array.isArray(post.tags) ? post.tags : [])].filter(Boolean);
      if (!postTags.includes(tagVal)) return false;
    }
    return true;
  });

  const discSection = document.getElementById('momen-disc-section');
  const listSection = document.getElementById('momen-list-section');
  const emptySection = document.getElementById('momen-empty-section');
  const emptyText = document.getElementById('momen-empty-text');

  if (filteredPosts.length === 0) {
    if (discSection) discSection.hidden = true;
    if (listSection) listSection.hidden = true;
    if (emptySection) emptySection.hidden = false;
    if (emptyText) {
      emptyText.textContent =
        allPosts.length === 0
          ? 'Belum ada foto di galeri.'
          : 'Belum ada foto yang cocok dengan filter yang dipilih.';
    }
    return;
  }

  if (emptySection) emptySection.hidden = true;
  if (discSection) discSection.hidden = viewMode !== 'disc';
  if (listSection) listSection.hidden = viewMode !== 'list';

  activeIndex = 0;
  rotation = 0;
  velocity = 0;

  renderDiscRim();
  renderHubAndControls(activeIndex);
  renderListGrid();
  updateLiveAnnouncement(activeIndex);
}

function setGalleryViewMode(mode, { persist = true } = {}) {
  viewMode = mode === 'list' ? 'list' : 'disc';
  const discBtn = document.getElementById('momen-mode-disc');
  const listBtn = document.getElementById('momen-mode-list');
  if (discBtn) discBtn.setAttribute('aria-pressed', String(viewMode === 'disc'));
  if (listBtn) listBtn.setAttribute('aria-pressed', String(viewMode === 'list'));

  if (persist) {
    setPref('galleryView', viewMode);
  }
  applyFiltersAndRender();
}

function bindInteractionsOnce() {
  if (initialized) return;
  initialized = true;

  const stage = document.getElementById('disc-stage');
  const prevBtn = document.getElementById('disc-prev-btn');
  const nextBtn = document.getElementById('disc-next-btn');
  const likeBtn = document.getElementById('disc-like-btn');
  const openBtn = document.getElementById('disc-open-btn');
  const modeDiscBtn = document.getElementById('momen-mode-disc');
  const modeListBtn = document.getElementById('momen-mode-list');

  // Pointer drag + tap on disc stage
  if (stage) {
    let dragState = null;

    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || filteredPosts.length === 0) return;
      stopAnimationLoop();
      const cardBtn = event.target.closest('.disc-card');
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        lastX: event.clientX,
        lastTime: performance.now(),
        moved: false,
        velocityDegPerSec: 0,
        tappedCardIndex: cardBtn ? Number(cardBtn.dataset.index) : null
      };
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const totalDx = event.clientX - dragState.startX;
      if (!dragState.moved && Math.abs(totalDx) > TAP_SLOP_PX) {
        dragState.moved = true;
      }
      if (!dragState.moved) return;

      const now = performance.now();
      const dt = Math.max(4, now - dragState.lastTime);
      const stepDx = event.clientX - dragState.lastX;
      const deltaDeg = stepDx * DEG_PER_PX;

      rotation = normalizeRotation(rotation + deltaDeg, filteredPosts.length);
      dragState.velocityDegPerSec = (deltaDeg / dt) * 1000;
      dragState.lastX = event.clientX;
      dragState.lastTime = now;
      renderDiscRim();
    });

    const finishPointer = (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const wasDrag = dragState.moved;
      const tappedIndex = dragState.tappedCardIndex;
      const releaseVelocity = dragState.velocityDegPerSec;
      dragState = null;

      if (!wasDrag) {
        // Under 6px counts as a tap:
        // - tap front photo -> open full-screen viewer
        // - tap side photo -> rotate it to the front
        if (tappedIndex !== null && Number.isFinite(tappedIndex)) {
          if (tappedIndex === activeIndex) {
            const frontBtn = stage.querySelector(`.disc-card[data-index="${tappedIndex}"]`);
            openPhotoModal(tappedIndex, frontBtn || stage);
          } else {
            goToIndex(tappedIndex, { announce: true });
          }
        }
        return;
      }

      velocity = releaseVelocity;
      startInertiaLoop();
    };

    stage.addEventListener('pointerup', finishPointer);
    stage.addEventListener('pointercancel', () => {
      dragState = null;
      startInertiaLoop();
    });

    // Mouse wheel / trackpad horizontal or vertical scroll on the disc
    stage.addEventListener(
      'wheel',
      (event) => {
        if (filteredPosts.length <= 1) return;
        event.preventDefault();
        stopAnimationLoop();
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        rotation = normalizeRotation(rotation - delta * 0.16, filteredPosts.length);
        velocity = -delta * 2.2;
        renderDiscRim();
        startInertiaLoop();
      },
      { passive: false }
    );

    // Keyboard Left / Right / Home / End on the disc stage
    stage.addEventListener('keydown', (event) => {
      if (filteredPosts.length === 0) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepBy(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepBy(-1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goToIndex(0, { announce: true });
      } else if (event.key === 'End') {
        event.preventDefault();
        goToIndex(filteredPosts.length - 1, { announce: true });
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPhotoModal(activeIndex, stage);
      }
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => stepBy(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => stepBy(1));

  if (likeBtn) {
    likeBtn.addEventListener('click', () => {
      const post = filteredPosts[activeIndex];
      if (!post) return;
      toggleLike(post.id);
      renderHubAndControls(activeIndex);
      renderListGrid();
    });
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => openPhotoModal(activeIndex, openBtn));
  }

  if (modeDiscBtn) modeDiscBtn.addEventListener('click', () => setGalleryViewMode('disc'));
  if (modeListBtn) modeListBtn.addEventListener('click', () => setGalleryViewMode('list'));

  for (const id of ['momen-filter-album', 'momen-filter-month', 'momen-filter-tag']) {
    const sel = document.getElementById(id);
    if (sel) sel.addEventListener('change', applyFiltersAndRender);
  }

  // Modal controls, focus trap, Escape, and swipe
  const modal = document.getElementById('photo-modal');
  const modalClose = document.getElementById('photo-modal-close');
  const modalPrev = document.getElementById('photo-modal-prev');
  const modalNext = document.getElementById('photo-modal-next');
  const modalZoom = document.getElementById('photo-modal-zoom');
  const modalImg = document.getElementById('photo-modal-img');
  const modalStage = document.getElementById('photo-modal-stage');

  if (modalClose) modalClose.addEventListener('click', closePhotoModal);
  if (modalPrev) {
    modalPrev.addEventListener('click', () => {
      stepBy(-1);
      syncModalContent();
    });
  }
  if (modalNext) {
    modalNext.addEventListener('click', () => {
      stepBy(1);
      syncModalContent();
    });
  }
  if (modalZoom && modalImg) {
    modalZoom.addEventListener('click', () => {
      modalZoomed = !modalZoomed;
      modalImg.classList.toggle('is-zoomed', modalZoomed);
      modalZoom.setAttribute('aria-pressed', String(modalZoomed));
      const lbl = document.getElementById('photo-modal-zoom-label');
      if (lbl) lbl.textContent = modalZoomed ? 'Ukuran normal' : 'Perbesar 2x';
    });
  }

  if (modalStage) {
    let swipeStartX = null;
    modalStage.addEventListener('pointerdown', (e) => {
      if (!modalZoomed) swipeStartX = e.clientX;
    });
    modalStage.addEventListener('pointerup', (e) => {
      if (swipeStartX === null || modalZoomed) return;
      const dx = e.clientX - swipeStartX;
      swipeStartX = null;
      if (dx <= -40) {
        stepBy(1);
        syncModalContent();
      } else if (dx >= 40) {
        stepBy(-1);
        syncModalContent();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePhotoModal();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepBy(1);
      syncModalContent();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepBy(-1);
      syncModalContent();
    } else if (event.key === 'Tab') {
      const focusables = [...modal.querySelectorAll('button:not([disabled])')];
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

/**
 * Initializes and renders the Piringan Momen gallery from `CLASS_DATA`.
 */
export function initGallery(data) {
  bindInteractionsOnce();
  allPosts = Array.isArray(data?.galleryPosts) ? [...data.galleryPosts] : [];
  populateFilters();

  const savedMode = getPref('galleryView', 'disc');
  setGalleryViewMode(savedMode === 'list' ? 'list' : 'disc', { persist: false });
}
