# PROJECT_SPEC - Ruang Kelas (SMPN 62 Surabaya)

Owner: FarskyRF (Farsky) · Started: 16 November 2026 · Project folder: `C:\workspace\Class website Project2`

This is the single source of truth for WHAT we build and the rules for building it.
`HANDOFF.md` tracks the current status. If the two disagree, this file wins, and the conflict must be raised with Farsky.

---

## 1. Objectives

1. Give classmates one place on their phones to check class info, PR, exam dates, kisi-kisi, announcements and the day's schedule.
2. Let Farsky update everything directly in one commented file (`data/class-data.js`) and drop photos into `assets/photos/` in VS Code, with no Dashboard on the website and no external database setup.
3. Feel like a real mobile app made for this class (a whiteboard/chalkboard notice board), not a generic template or school assignment.
4. Stay 100% free and simple: static hosting on GitHub Pages, no external backend, no build tools.
5. Be honest: no fake success messages, fake sync, fake numbers or untested claims.

## 2. Architecture

```
Visitor's browser (phone / laptop)
 └─ index.html (the ONLY page, served by GitHub Pages under /<repo-name>/)
     ├─ assets/css/styles.css      design tokens + components
     ├─ assets/js/*.js             ES modules, no bundler
     ├─ data/class-data.js         commented file where Farsky edits all content
     ├─ data/default-data.json     JSON mirror of class-data.js
     ├─ assets/photos/             folder where Farsky drops gallery & class photos
     ├─ sw.js                      service worker (app shell cache, offline)
     └─ localStorage               offline cache + per-browser preferences
```

- **One page:** all views, tabs, and modals live in `index.html` and switch with JavaScript. No other HTML page; no `window.location` for internal navigation.
- **No Dashboard on the website:** per Farsky's decision on 17 Nov 2026, all content and settings are edited in `data/class-data.js` and photos are placed in `assets/photos/`.
- **Relative paths only** (`./assets/...`, `./data/...`) so the site works under `https://<username>.github.io/<repo-name>/`.

### Planned file structure (only created when needed)

```
index.html               the single page
README.md                Indonesian, beginner-friendly guide
PROJECT_SPEC.md          this file
HANDOFF.md               status, QA checklist, next steps
LICENSE                  All rights reserved, FarskyRF
manifest.webmanifest     PWA manifest (start_url and scope "./")
sw.js                    service worker
.gitignore .gitattributes .nojekyll
assets/css/styles.css
assets/js/app.js         startup, routing between views, theme
assets/js/storage.js     THE ONLY data-access module (Supabase + cache)
assets/js/schedule.js    getScheduleView() - the ONLY schedule logic
assets/js/dashboard.js   Owner Dashboard
assets/js/gallery.js     Piringan Momen UI
assets/js/disc-math.js   pure math for the disc (no DOM)
assets/js/wheel.js       spin wheel
assets/js/reports.js     WhatsApp reports + suggestions
assets/js/utils.js       date formatting (the ONLY one), validation, DOM helpers
assets/js/config.js      Supabase Project URL + PUBLIC publishable key only
assets/fonts/            self-hosted woff2 + OFL license
assets/icons/            PWA icons (192, 512, maskable)
assets/vendor/           pinned Supabase JS client + its license
data/default-data.json   clearly labelled seed data (no real names or numbers)
supabase/schema.sql      tables, RLS policies, buckets
supabase/README_SETUP.md Indonesian click-by-click setup
tests/*.test.js          node --test suites
package.json             ONLY to run `node --test`, no dependencies
```

Empty folders currently hold a `.gitkeep` file so Git keeps them. Each `.gitkeep` is removed when real files arrive.

## 3. Stack decision

| Need | Choice | Why |
|---|---|---|
| UI | Vanilla HTML/CSS/JS, ES modules | No build step; works on GitHub Pages; easy for a beginner to read |
| Hosting | GitHub Pages (branch `main`, root) | Free, static, already familiar |
| Shared data | Supabase Postgres + RLS | Real database the browser can call safely with a public key |
| Login | Supabase Auth (email + password) | Real Owner session; no homemade password checks |
| Images | Supabase Storage | Public gallery bucket; private report attachments |
| Live updates | Supabase Realtime + refetch on focus | Changes appear on open devices |
| Offline | Service worker + localStorage cache | Last data visible offline; writes blocked honestly |
| Tests | `node --test` (built into Node, zero deps) | Deterministic logic tests without installing anything |

Rejected: frameworks (React/Next), bundlers, npm dependencies, CDN scripts at runtime, any custom server, any password stored in the code.

## 4. Requirements

### 4.1 Language and format
- UI text: casual, polite Bahasa Indonesia for teenagers. English kept only for: Dashboard, Username, Password, Owner. Roles: Owner, Guru, Siswa.
- Dates: locale `id-ID`, timezone `Asia/Jakarta` set explicitly, 24-hour time, e.g. `Senin, 12 Oktober 2026`, time `22.17`.
- README in Indonesian. Developer chat in English.

### 4.2 Design
- Identity: whiteboard (light) / chalkboard (dark) notice board + about 20% classic school layer (serif headings, small-caps eyebrows, inset double borders on key cards, diamond divider, stamp badges, ledger rows, max 4% paper grain in light mode only).
- Mobile first (360-430px), then tablet and desktop. Fixed bottom navigation: Beranda, Kelas, Jadwal, Momen, Lainnya (line icons, active state not by color alone, at least 44px).
- Header: rounded-square logo mark "rk", title "Ruang Kelas", subtitle "SMPN 62 - SURABAYA", data status pill (Online/Offline), eraser theme switch. Logo/title = hidden Dashboard gesture target.
- Hero card: eyebrow "Papan kabar kelas", serif heading, one line of text, live date/time line with an accent dot; 3-4 faint concentric rings bottom-right (aria-hidden, 6-12% opacity, from tokens).
- One inline-SVG line icon set, 1.75px stroke. Two radii only (about 8px and 20px). Spacing scale 4/8/12/16/24/32. 1px borders instead of shadows. Motion 80-250ms, only for real state changes, disabled under `prefers-reduced-motion`.
- Fonts: serif display face for headings (Source Serif 4 or Fraunces) + humanist sans for body (Atkinson Hyperlegible), self-hosted woff2, `font-display: swap`, precached, with fallback stacks. Digits use `tabular-nums`.
- **Banned:** purple/indigo default, gradient cards/text, glassmorphism, neon glows, emoji as icons, mixed icon styles, identical card stacks, generic slogans/filler, heavy shadows, pointless bounce, three identical feature cards, decorative blob hero, inverted dark mode.
- Theme tokens (CSS custom properties; components use tokens only):
  - Light (whiteboard): bg #F3F1EA, surface-1 #FBFAF6, surface-2 #FFFFFF, surface-3 #E9E6DC, border #D6D2C4, text #1C211F, text-muted #5B645F, accent #C8431F, on-accent #FFFFFF, success #1F7A4C, warning #8A5A00, danger #B3261E.
  - Dark (chalkboard): bg #0A0D0C, surface-1 #111615, surface-2 #181F1D, surface-3 #212A27, border #2A3532, text #E6ECE9, text-muted #9AA8A3, accent #E9C46A, on-accent #0A0D0C, success #7FD6A4, warning #F0C36B, danger #FF8A8A.
  - Accent options: marker red (default), periwinkle #6F7FE8, green, teal, orange; each with a light variant and a lightened dark variant; choice persisted locally.
  - Component tokens (`--ornament`, `--stamp-border`, `--hero-rings`, ...) built with `color-mix()` for both themes.
  - `tests/contrast.test.js` asserts WCAG: text 4.5:1, large text/UI 3:1 for the pairs listed in the brief. Failures are fixed by changing tokens, never by weakening the test.
- Theme switch: board-eraser `<button role="switch" aria-checked>`, label "Mode gelap", visible text "Terang"/"Gelap", 44px+, Space/Enter, tap or drag past a threshold, circular reveal via `document.startViewTransition` + clip-path (instant if unsupported or reduced motion), optional chalk dust, sound muted by default. First visit follows the system; a manual choice wins; no flash of the wrong theme; updates `<meta name="theme-color">`; polite toast "Tema gelap aktif." (surface-3, text, 1px border).

### 4.3 Features (core)
1. **Class information:** Deskripsi Kelas, PR, Jadwal Ulangan, Kisi-kisi, Pengumuman + Owner custom sections (add/rename/delete). Fields: id, title, description, subject, date/deadline, optional image, author, createdAt, updatedAt, status. Badges H-7, H-3, H-1, Hari ini, Terlambat, Selesai (text + icon; none for missing/invalid dates). Upcoming sorted by nearest date.
2. **Smart schedule:** one function `getScheduleView(now, schedule, settings)` → `{ mode, shownDay, pinnedDay, currentPeriod, nextPeriod }`, time injected, Asia/Jakarta explicit. Switch time S default 20:00. Authoritative table:

   | Now (WIB) | Mode | Day shown |
   |---|---|---|
   | Mon-Fri, 00:00 up to S | single | today |
   | Mon-Thu, S up to 24:00 | single | tomorrow |
   | Friday, S up to 24:00 | single | Monday ("Senin depan") |
   | Saturday, all day | full week | all days |
   | Sunday, all day | full week | all days, Monday pinned on top |

   "Sedang berlangsung"/"Selanjutnya" only when the shown day is today; gaps show only "Selanjutnya". Friendly empty state. "Lihat semua jadwal" button. Rule changes require asking Farsky.
3. **Live clock:** minute-aligned `setTimeout` (one timer), paused when hidden, refresh on `visibilitychange`, `<time datetime="...+07:00">` without aria-live, safe fallback without Intl support.
4. **Piringan Momen gallery:** draggable half-disc (pointer events, wheel, inertia, spring snap, tap vs drag at about 6px), center hub label, full-screen viewer, keyboard + visible Sebelumnya/Berikutnya, aria-live position text, persisted Piringan/Daftar toggle. Pure math in `disc-math.js`. Uploads validated (MIME + signature), size-limited, resized to 1600px max, compressed on device, stored in Supabase Storage. Albums/tags/event/month filters, soft delete/restore, storage-usage warning, never auto-delete.
5. **Spin wheel:** Owner-managed names, canvas, winner chosen FIRST via `crypto.getRandomValues`, then the animation lands on that slice. Web Audio tick, mute, optional vibration, confetti, "Selamat!" popup, history, exclude already picked, empty/single-name handling, reduced motion.
6. **Report via WhatsApp:** name + message required, optional image attachments (count/size limits). Owner sets the number (digits only, 10-15, e.g. 628xxxxxxxxxx; empty by default → button disabled with an explanation). **Approved message format (Farsky, 16 Nov 2026): one item per line:**
   ```
   📢 LAPORAN BARU
   • Nama : (name)
   • Pesan : (message)
   • Waktu : (date time WIB)
   ```
   Opens `https://wa.me/<number>?text=<encodeURIComponent(message)>` in a new tab with `rel="noopener noreferrer"`. With attachments show exactly: "Lampiran gambar akan diunduh; silakan kirim manual di WhatsApp." + one download button per image. Saved to Supabase (visitors insert only). Status is "Dibuka di WhatsApp", never "Terkirim". Per-browser cooldown (default 60s), honestly described as not abuse-proof.
7. **Suggestions:** title, message, optional name; insert-only for visitors; "Salin teks" and "Unduh"; Owner inbox with read/unread, reply note, archive/restore, delete with confirmation.
8. **Dashboard:** hidden gesture (5 taps on logo/title within 3 seconds, sliding window, touch + mouse, never mentioned publicly) → Supabase Auth login (Username = email, Password), "Keluar Dashboard". Controls are not rendered without a valid Owner session. Sections: Overview (real counts), Class Information, Schedule, Spin Wheel, Gallery, Reports, Suggestions, Activity Log, Website Settings, Backup and Restore (export JSON; validated import with preview; all-or-nothing).

### 4.4 Bonus (only after all core QA passes)
Homework checklist (per browser), birthdays with days remaining, piket roster, install-as-app guidance, new-content dots. Each reported as Completed / Partial / Not implemented.

### 4.5 Code quality
- All user input is untrusted: `textContent` + DOM APIs, never user text in `innerHTML`.
- Validate → handle errors → confirm write → update UI → feedback (Indonesian, meaningful).
- No TODOs, placeholders, dead buttons, duplicated listeners/timers, unexplained globals or swallowed errors.
- One storage module, one schedule function, one date formatter.
- Destructive actions need a confirmation dialog; soft delete with restore by default.

## 5. Storage

### 5.1 Supabase (shared)
- Table `records(collection text, id uuid, data jsonb, version int, updated_at timestamptz, updated_by uuid, deleted_at timestamptz, primary key (collection, id))` for collections: classInfo, homework, exams, kisiKisi, announcements, schedule, scheduleSettings, students, galleryPosts, albums, birthdays, piket, siteSettings, wheelHistory.
- Separate tables: `reports`, `suggestions`, `activity_log`, `owners(user_id uuid primary key)`.
- Buckets: `gallery` (public read, Owner write), `report-attachments` (visitor insert with size/type limits, Owner read).
- RLS on every table, each policy commented in plain English. Anyone: SELECT non-deleted records. Owners only: INSERT/UPDATE/DELETE and see soft-deleted rows. Visitors: INSERT into reports/suggestions with length checks, never read them. activity_log: Owner only.
- Public sign-ups disabled; the single Owner user is created in the Supabase dashboard and its UUID inserted into `owners`.
- Concurrency: every update sends the version it was based on; conflicts show an Indonesian dialog (load latest / review and overwrite). Never overwrite silently.
- Realtime subscriptions (no duplicates) + refetch on focus.

### 5.2 Local per browser (on purpose)
Theme and accent, homework checklist state, likes state, mute and vibration, cooldown timestamps, Piringan/Daftar toggle, plus the offline cache of public data.

### 5.3 Load flow
Show cached data at once → fetch fresh data → re-render only what changed. Real loading/empty/error/offline states. Offline: last cached data + clear notice; Dashboard writes disabled with a message; never queue silent writes.

### 5.4 Secrets
Only the Project URL and the PUBLIC publishable/anon key go in `assets/js/config.js`. Never ask for, print, store or commit the service_role/secret key, the database password or the Owner password.

## 6. Limitations (to be stated honestly in UI and README)
- Supabase free-tier projects can be paused after inactivity and have storage/bandwidth limits.
- This is a school project, not a place for sensitive data.
- Everything in a public GitHub repository is visible to everyone (the publishable key is meant to be public; RLS is the protection).
- The report cooldown is per browser and does not stop determined abuse.
- WhatsApp cannot receive attachments via a link; images must be sent manually.
- The folder name contains spaces; this is fine locally. The GitHub repository name should have no spaces (e.g. `ruang-kelas`) because it becomes part of the URL.

## 7. Stages

| Phase | Scope |
|---|---|
| 0 | Plan: PROJECT_SPEC, HANDOFF, Git hygiene files, folder structure. No feature code. |
| 1 | Foundation and look: index.html, tokens, themes, eraser switch, header, hero + rings + live clock, bottom nav + view switching, PWA shell, contrast test. |
| 2 | File-based data & photo system: `data/class-data.js`, `data/default-data.json`, `assets/photos/` convention, `PANDUAN_EDIT_DATA.md`, `assets/js/storage.js` (validation, photo path resolver, local cache & preferences), and `tests/storage.test.js`. |
| 3 | *(Skipped — Owner login & Dashboard removed per Farsky's 17 Nov 2026 decision to manage everything via files.)* |
| 4 | Class information and custom sections (rendered from `data/class-data.js`). |
| 5 | Smart schedule with tests. |
| 6 | Gallery disc ("Piringan Momen") using photos in `assets/photos/`. |
| 7 | Spin wheel. |
| 8 | Reports and suggestions (WhatsApp handoff + copy/download). |
| 9 | Bonus features (only if all earlier QA items pass). |
| 10 | Full QA, README, GitHub release prep, final report in Indonesian. |

One phase per request. Every phase ends with real test output, files changed, an updated HANDOFF.md and `PHASE N COMPLETE` or `PHASE N BLOCKED: <reason>`.

Conflict priority: 1 data integrity, 2 correctness, 3 static-hosting compatibility, 4 security and privacy honesty, 5 mobile usability and accessibility, 6 performance, 7 visual polish, 8 bonus features.

## 8. Definition of Done (whole project)
- [ ] Only `index.html` as a page; relative paths; works under a GitHub Pages subpath.
- [ ] `node --test` passes for: schedule, contrast, disc-math, wheel selection, WhatsApp URL, clock formatting, validation, import/export validation.
- [ ] RLS verified: an anonymous visitor cannot write records or read reports/suggestions/activity_log.
- [ ] A Dashboard change appears on a second browser/device.
- [ ] Offline shows cached data with a notice; Dashboard writes are blocked offline.
- [ ] No horizontal overflow at 360/375/390/430px, tablet, desktop; light and dark; Chromium and Firefox; console free of errors.
- [ ] Accessibility: landmarks, one h1, labelled inputs, focus trap + Escape + focus return in modals, visible focus, 44px targets, reduced motion.
- [ ] Banned-list check passed for the whole UI.
- [ ] Scan for real phone numbers, real student names, secrets and keys done before release.
- [ ] README (Indonesian), PROJECT_SPEC.md and HANDOFF.md up to date; every QA item PASS/FAIL/NOT TESTED with evidence.

## 9. Decision log
| Date | Decision | By |
|---|---|---|
| 16 Nov 2026 | License: All rights reserved, copyright holder FarskyRF | Farsky |
| 16 Nov 2026 | WhatsApp report message: one item per line (see 4.3.6) | Farsky |
| 16 Nov 2026 | Old folder `C:\workspace\class-website` holds a different project and is left untouched; this project lives in `C:\workspace\Class website Project2` | Farsky |
| 16 Nov 2026 | Git default branch is `main` (`git init -b main`) | Assistant (README instructions use `main`) |
| 16 Nov 2026 | Empty folders keep a `.gitkeep` until real files exist | Assistant |
| 17 Nov 2026 | Dark-theme `--border-strong` set to `#6A7A75` so UI control borders achieve >= 3.0:1 contrast even on `--surface-3` (`#212A27`) | Assistant |
| 17 Nov 2026 | Switched from Supabase + in-app Dashboard to 100% file-based editing (`data/class-data.js` + `assets/photos/`, Option A + Option 1). Phase 3 (Dashboard) is skipped. | Farsky |
| 17 Nov 2026 | Changed theme switch UI to a Day-to-Night (Sun -> Moon + twinkling stars) toggle with smooth icon rotation/morph and circular view transition; loaded official Kelas 7C Semester Ganjil 2026/2027 schedule and times into `data/class-data.js`. | Farsky |
