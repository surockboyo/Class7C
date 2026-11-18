/**
 * class-info.js - renders Deskripsi Kelas, PR, Jadwal Ulangan, Kisi-kisi Ulangan,
 * Pengumuman, custom sections, and the Beranda summary cards from CLASS_DATA.
 *
 * Security & DOM rule:
 * - Never put untrusted/data strings into innerHTML. Every element is built with
 *   document.createElement / createElementNS and populated with textContent.
 */

import {
  formatCalendarDateWIB,
  getDeadlineBadge,
  sortRecordsByNearest,
  sortBirthdaysByUpcoming,
  getWIBParts
} from './utils.js';
import { getLocalState, setLocalState } from './storage.js';
import { showToast } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIB_WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getHomeworkDoneMap() {
  return getLocalState('homeworkDone', {});
}

function isHomeworkChecked(id) {
  const map = getHomeworkDoneMap();
  return Boolean(id && map && map[id]);
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

function createEmptyState(iconId, message) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  wrap.appendChild(createIcon(iconId, 'icon--sm'));
  const p = document.createElement('p');
  p.textContent = message;
  wrap.appendChild(p);
  return wrap;
}

function createStampBadge(badge) {
  const span = document.createElement('span');
  span.className = 'stamp-badge';
  span.dataset.kind = badge.kind;
  span.appendChild(createIcon(badge.icon, ''));
  const text = document.createElement('span');
  text.textContent = badge.label;
  span.appendChild(text);
  return span;
}

function createPhotoFigure(imageUrl, altText) {
  if (!imageUrl) return null;
  const figure = document.createElement('figure');
  figure.className = 'record-photo';
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = altText || 'Lampiran gambar kelas';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => {
    figure.hidden = true;
  });
  figure.appendChild(img);
  return figure;
}

/**
 * Builds one ledger row (`<li class="ledger-row">`) for a PR, ulangan, kisi-kisi,
 * pengumuman, or custom section item.
 */
function createRecordRow(record, {
  now = new Date(),
  showBadge = true,
  typeLabel = '',
  enableChecklist = false,
  onToggleDone = null
} = {}) {
  const li = document.createElement('li');
  li.className = 'ledger-row';
  if (record.id) li.dataset.recordId = record.id;

  const checkedLocally = enableChecklist && isHomeworkChecked(record.id);
  const effectiveRecord = checkedLocally ? { ...record, status: 'selesai' } : record;

  const badge = showBadge ? getDeadlineBadge(effectiveRecord, now) : null;
  if (String(effectiveRecord.status || '').toLowerCase() === 'selesai') {
    li.classList.add('ledger-row--done');
  } else if (badge && badge.kind === 'overdue') {
    li.classList.add('ledger-row--overdue');
  }

  // Top line: subject / type tags on the left, stamp badge on the right
  const hasSubject = typeof record.subject === 'string' && record.subject.trim() !== '';
  if (typeLabel || hasSubject || badge) {
    const top = document.createElement('div');
    top.className = 'ledger-row__top';

    const tags = document.createElement('div');
    tags.className = 'ledger-row__tags';

    if (typeLabel) {
      const kindTag = document.createElement('span');
      kindTag.className = 'subject-tag';
      kindTag.textContent = typeLabel;
      tags.appendChild(kindTag);
    }
    if (hasSubject) {
      const subj = document.createElement('span');
      subj.className = 'subject-tag';
      subj.textContent = record.subject.trim();
      tags.appendChild(subj);
    }
    top.appendChild(tags);

    if (badge) {
      top.appendChild(createStampBadge(badge));
    }
    li.appendChild(top);
  }

  // Title
  const title = document.createElement('h4');
  title.className = 'ledger-row__title';
  title.textContent = record.title || 'Tanpa judul';
  li.appendChild(title);

  // Description
  if (typeof record.description === 'string' && record.description.trim() !== '') {
    const desc = document.createElement('p');
    desc.className = 'ledger-row__desc';
    desc.textContent = record.description.trim();
    li.appendChild(desc);
  }

  // Optional image attachment from assets/photos/
  const figure = createPhotoFigure(record.imageUrl, record.title);
  if (figure) li.appendChild(figure);

  // Per-browser homework checklist toggle (Bonus 4.9)
  if (enableChecklist && record.id) {
    const checkLabel = document.createElement('label');
    checkLabel.className = 'pr-check';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'pr-check__input';
    chk.checked = checkedLocally || String(record.status || '').toLowerCase() === 'selesai';
    chk.disabled = String(record.status || '').toLowerCase() === 'selesai';
    const span = document.createElement('span');
    span.textContent = chk.checked
      ? 'Sudah selesai dikerjakan (tersimpan di perangkat ini)'
      : 'Tandai sudah selesai dikerjakan';
    chk.addEventListener('change', () => {
      const map = getHomeworkDoneMap();
      if (chk.checked) {
        map[record.id] = true;
      } else {
        delete map[record.id];
      }
      const saved = setLocalState('homeworkDone', map);
      showToast(
        saved
          ? chk.checked
            ? 'PR ditandai selesai di browser ini.'
            : 'Tanda selesai PR dibatalkan.'
          : 'Status ceklis PR tidak bisa disimpan di browser ini.'
      );
      if (typeof onToggleDone === 'function') onToggleDone();
    });
    checkLabel.append(chk, span);
    li.appendChild(checkLabel);
  }

  // Footer: formatted WIB date + author role
  const rawDate = record.deadline || record.date || '';
  const formattedDate = formatCalendarDateWIB(rawDate);
  const hasAuthor = typeof record.author === 'string' && record.author.trim() !== '';

  if (formattedDate || hasAuthor) {
    const foot = document.createElement('div');
    foot.className = 'ledger-row__foot';
    if (formattedDate) {
      const dateSpan = document.createElement('span');
      const prefix = record.deadline ? 'Tenggat: ' : 'Tanggal: ';
      dateSpan.textContent = `${prefix}${formattedDate}`;
      foot.appendChild(dateSpan);
    }
    if (hasAuthor) {
      const authorSpan = document.createElement('span');
      authorSpan.textContent = `Oleh: ${record.author.trim()}`;
      foot.appendChild(authorSpan);
    }
    li.appendChild(foot);
  }

  return li;
}

function renderRecordSection(container, records, {
  emptyIcon = 'i-clipboard',
  emptyText = 'Belum ada data.',
  now = new Date(),
  showBadge = true,
  enableChecklist = false,
  onToggleDone = null
} = {}) {
  if (!container) return;
  container.replaceChildren();

  const effectiveRecords = enableChecklist
    ? (records || []).map((r) => (isHomeworkChecked(r.id) ? { ...r, status: 'selesai' } : r))
    : records || [];

  const sorted = sortRecordsByNearest(effectiveRecords, now);
  if (sorted.length === 0) {
    container.appendChild(createEmptyState(emptyIcon, emptyText));
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'ledger-list';
  for (const item of sorted) {
    ul.appendChild(
      createRecordRow(item, {
        now,
        showBadge,
        enableChecklist,
        onToggleDone
      })
    );
  }
  container.appendChild(ul);
}

function renderClassProfile(container, classInfo) {
  if (!container) return;
  container.replaceChildren();

  if (!classInfo || (!classInfo.title && !classInfo.description)) {
    container.appendChild(createEmptyState('i-info', 'Deskripsi kelas belum ditulis.'));
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'class-profile';

  if (classInfo.title) {
    const lead = document.createElement('p');
    lead.className = 'class-profile__lead';
    lead.textContent = classInfo.title;
    wrap.appendChild(lead);
  }

  if (classInfo.description) {
    const desc = document.createElement('p');
    desc.className = 'class-profile__desc';
    desc.textContent = classInfo.description;
    wrap.appendChild(desc);
  }

  const metaPairs = [
    ['Wali Kelas', classInfo.homeroomTeacher],
    ['Ketua Kelas', classInfo.classLeader],
    ['Ruang', classInfo.roomName],
    ['Tahun Ajaran', classInfo.schoolYear]
  ].filter(([, val]) => typeof val === 'string' && val.trim() !== '');

  if (metaPairs.length > 0) {
    const dl = document.createElement('dl');
    dl.className = 'class-profile__meta';
    for (const [label, val] of metaPairs) {
      const box = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = val.trim();
      box.append(dt, dd);
      dl.appendChild(box);
    }
    wrap.appendChild(dl);
  }

  const figure = createPhotoFigure(classInfo.imageUrl, classInfo.title);
  if (figure) wrap.appendChild(figure);

  container.appendChild(wrap);
}

function renderCustomSections(container, customSections, now) {
  if (!container) return;
  container.replaceChildren();
  if (!Array.isArray(customSections) || customSections.length === 0) return;

  for (const section of customSections) {
    if (!section || !section.title) continue;
    const block = document.createElement('section');
    block.className = 'board-block board-block--ledger';
    const headingId = `h-custom-${section.id || 'sec'}`;
    block.setAttribute('aria-labelledby', headingId);

    const head = document.createElement('header');
    head.className = 'board-block__head';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Bagian tambahan';
    const h3 = document.createElement('h3');
    h3.className = 'board-block__title';
    h3.id = headingId;
    h3.textContent = section.title;
    head.append(eyebrow, h3);
    block.appendChild(head);

    const body = document.createElement('div');
    renderRecordSection(body, section.items || [], {
      emptyIcon: 'i-pin',
      emptyText: 'Belum ada isi di bagian ini.',
      now,
      showBadge: true
    });
    block.appendChild(body);
    container.appendChild(block);
  }
}

function renderPiketSection(container, piketList, now) {
  if (!container) return;
  container.replaceChildren();

  if (!Array.isArray(piketList) || piketList.length === 0) {
    container.appendChild(createEmptyState('i-users', 'Jadwal piket belum diisi.'));
    return;
  }

  const todayName = WIB_WEEKDAYS[getWIBParts(now).weekday];
  const grid = document.createElement('div');
  grid.className = 'piket-grid';

  for (const row of piketList) {
    if (!row || !row.day) continue;
    const card = document.createElement('article');
    card.className = 'piket-card';
    if (row.day === todayName) card.classList.add('piket-card--today');

    const head = document.createElement('header');
    head.className = 'piket-card__head';
    const dayEl = document.createElement('h4');
    dayEl.className = 'piket-card__day';
    dayEl.textContent = row.day;
    head.appendChild(dayEl);

    if (row.day === todayName) {
      head.appendChild(createStampBadge({ kind: 'today', label: 'Hari ini', icon: 'i-clock' }));
    }
    card.appendChild(head);

    const members = Array.isArray(row.members) ? row.members.filter(Boolean) : [];
    if (members.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'field-hint';
      empty.textContent = 'Belum ada petugas.';
      card.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'piket-card__members';
      for (const m of members) {
        const li = document.createElement('li');
        li.textContent = m;
        ul.appendChild(li);
      }
      card.appendChild(ul);
    }
    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function renderBirthdaysSection(container, birthdays, now) {
  if (!container) return;
  container.replaceChildren();

  const sorted = sortBirthdaysByUpcoming(birthdays || [], now);
  if (sorted.length === 0) {
    container.appendChild(createEmptyState('i-gift', 'Daftar ulang tahun belum diisi.'));
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'ledger-list';
  for (const b of sorted) {
    const li = document.createElement('li');
    li.className = 'ledger-row';

    const top = document.createElement('div');
    top.className = 'ledger-row__top';

    const nameEl = document.createElement('h4');
    nameEl.className = 'ledger-row__title';
    nameEl.textContent = b.name;

    const kind = b.daysRemaining === 0 ? 'today' : b.daysRemaining <= 7 ? 'urgent' : 'upcoming';
    const stamp = createStampBadge({ kind, label: b.label, icon: 'i-gift' });
    top.append(nameEl, stamp);
    li.appendChild(top);

    const foot = document.createElement('div');
    foot.className = 'ledger-row__foot';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = `Tanggal lahir: ${b.formattedDate}`;
    foot.appendChild(dateSpan);
    li.appendChild(foot);

    ul.appendChild(li);
  }
  container.appendChild(ul);
}

function renderBerandaSummaries(data, now, onOpenKelas) {
  const tugasEyebrow = document.getElementById('home-tugas-eyebrow');
  const tugasBody = document.getElementById('home-tugas-body');
  const pengumumanBody = document.getElementById('home-pengumuman-body');

  const activeHomework = (data.homework || []).filter(
    (item) => String(item.status || '').toLowerCase() !== 'selesai' && !isHomeworkChecked(item.id)
  );
  const activeExams = (data.exams || []).filter(
    (item) => String(item.status || '').toLowerCase() !== 'selesai'
  );

  // Concrete, useful microcopy on Beranda (e.g. "PR aktif: 2 · Ulangan: 1")
  if (tugasEyebrow) {
    tugasEyebrow.textContent = `PR aktif: ${activeHomework.length} · Ulangan: ${activeExams.length}`;
  }

  if (tugasBody) {
    tugasBody.replaceChildren();
    const combined = [
      ...activeHomework.map((item) => ({ ...item, _typeLabel: 'PR', _isPr: true })),
      ...activeExams.map((item) => ({ ...item, _typeLabel: 'Ulangan', _isPr: false }))
    ];
    const sorted = sortRecordsByNearest(combined, now).slice(0, 3);

    if (sorted.length === 0) {
      tugasBody.appendChild(createEmptyState('i-clipboard', 'Semua PR dan ulangan terdekat sudah beres.'));
    } else {
      const ul = document.createElement('ul');
      ul.className = 'ledger-list';
      for (const item of sorted) {
        ul.appendChild(
          createRecordRow(item, {
            now,
            showBadge: true,
            typeLabel: item._typeLabel,
            enableChecklist: Boolean(item._isPr),
            onToggleDone: () => renderClassInfo(data, { now: new Date(), onOpenKelas })
          })
        );
      }
      tugasBody.appendChild(ul);

      if (typeof onOpenKelas === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'button section-jump';
        btn.textContent = 'Lihat semua PR & ulangan';
        btn.addEventListener('click', () => onOpenKelas());
        tugasBody.appendChild(btn);
      }
    }
  }

  if (pengumumanBody) {
    pengumumanBody.replaceChildren();
    const sortedAnnouncements = sortRecordsByNearest(data.announcements || [], now).slice(0, 2);
    if (sortedAnnouncements.length === 0) {
      pengumumanBody.appendChild(createEmptyState('i-megaphone', 'Belum ada pengumuman.'));
    } else {
      const ul = document.createElement('ul');
      ul.className = 'ledger-list';
      for (const item of sortedAnnouncements) {
        ul.appendChild(createRecordRow(item, { now, showBadge: false }));
      }
      pengumumanBody.appendChild(ul);
    }
  }
}

/**
 * Renders all Class Information sections in the Kelas tab and the summary cards
 * on Beranda.
 */
export function renderClassInfo(data, { now = new Date(), onOpenKelas } = {}) {
  if (!data) return;

  renderClassProfile(document.getElementById('kelas-deskripsi-body'), data.classInfo);

  const activePrCount = (data.homework || []).filter(
    (item) => String(item.status || '').toLowerCase() !== 'selesai' && !isHomeworkChecked(item.id)
  ).length;
  const prEyebrow = document.getElementById('kelas-pr-eyebrow');
  if (prEyebrow) {
    prEyebrow.textContent = `Pekerjaan rumah · ${activePrCount} belum selesai`;
  }

  renderRecordSection(document.getElementById('kelas-pr-body'), data.homework || [], {
    emptyIcon: 'i-clipboard',
    emptyText: 'Belum ada PR.',
    now,
    showBadge: true,
    enableChecklist: true,
    onToggleDone: () => renderClassInfo(data, { now: new Date(), onOpenKelas })
  });

  const activeExamCount = (data.exams || []).filter(
    (item) => String(item.status || '').toLowerCase() !== 'selesai'
  ).length;
  const ulanganEyebrow = document.getElementById('kelas-ulangan-eyebrow');
  if (ulanganEyebrow) {
    ulanganEyebrow.textContent = `Evaluasi · ${activeExamCount} terjadwal`;
  }

  renderRecordSection(document.getElementById('kelas-ulangan-body'), data.exams || [], {
    emptyIcon: 'i-calendar',
    emptyText: 'Belum ada jadwal ulangan.',
    now,
    showBadge: true
  });

  renderRecordSection(document.getElementById('kelas-kisi-body'), data.kisiKisi || [], {
    emptyIcon: 'i-list',
    emptyText: 'Belum ada kisi-kisi.',
    now,
    showBadge: true
  });

  renderRecordSection(document.getElementById('kelas-pengumuman-body'), data.announcements || [], {
    emptyIcon: 'i-megaphone',
    emptyText: 'Belum ada pengumuman.',
    now,
    showBadge: false
  });

  renderCustomSections(document.getElementById('kelas-custom-sections'), data.customSections || [], now);
  renderPiketSection(document.getElementById('kelas-piket-body'), data.piket || [], now);
  renderBirthdaysSection(document.getElementById('kelas-bday-body'), data.birthdays || [], now);
  renderBerandaSummaries(data, now, onOpenKelas);
}
