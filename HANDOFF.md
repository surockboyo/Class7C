# HANDOFF - Ruang Kelas

Last updated: Tuesday, 17 November 2026, 18:18 WIB · Phase completed: **9 (Bonus features + Day/Night Sun->Moon switch + Official 7C Schedule)** · Next phase: **10 (Full QA, README, GitHub release prep, final Indonesian report)**.

Read `PROJECT_SPEC.md` for the full requirements. This file tracks status only.

---

## 1. Status

- **Phase 0 - Plan: COMPLETE.**
- **Phase 1 - Foundation and look: COMPLETE.**
- **Phase 2 - File-based data & photo storage: COMPLETE.**
- **Phase 3 - Owner login & Dashboard: SKIPPED** (per Farsky's 17 Nov 2026 architecture decision to manage everything via `data/class-data.js` and `assets/photos/`).
- **Phase 4 - Class information and custom sections: COMPLETE.**
- **Phase 5 - Smart daily schedule: COMPLETE.**
- **Phase 6 - Gallery disc ("Piringan Momen"): COMPLETE.**
- **Phase 7 - Spin wheel ("Roda Putar Siswa"): COMPLETE.**
- **Phase 8 - Reports via WhatsApp & Suggestions: COMPLETE.**
- **Phase 9 - Bonus features, Day-to-Night switch, & Kelas 7C schedule: COMPLETE.**
  - **Official Kelas 7C Semester Ganjil 2026/2027 Schedule (`data/class-data.js` & `data/default-data.json`):**
    - Extracted the **7C** column and exact time slots from the SMPN 62 Surabaya schedule spreadsheet for Monday through Friday (`Senin`–`Jumat`), including morning character-building activities (`Upacara Bendera`, `Asmaul Husna & Mengaji`, `Literasi`, `Sholat Dhuha`, `Jum'at Berseri`), exact lesson times and teachers (`PAI/P. Misbah`, `PKN/B. Desi`, `SBK/B. Kis`, `PJOK/P. Hasan`, `IPS/B. Desi`, `MTK/P. Mulyadi`, `BIN/B. Naila`, `IPA/B. Nia`, `TIK/B. Linda`, `BING/B. Amel`, `BJ/B. Mei`, `Koding/B. Linda`), break gaps (`Istirahat 20 menit`), and `Sholat Dhuhur Berjamaah`.
  - **Day-to-Night (`Siang` / `Malam`) Sun-to-Moon Theme Switch (`index.html`, `assets/css/styles.css`, `assets/js/theme.js`):**
    - Replaced the switch graphic with a sky-pill control (`.sky-switch`) where the sliding orb morphs and rotates smoothly from a **Sun** icon (`#i-sun`) in `Siang` (Day) mode to a **Moon** icon (`#i-moon`) with twinkling stars in `Malam` (Night) mode, paired with the circular `document.startViewTransition` reveal (and instant fallback under `prefers-reduced-motion`).
  - **Bonus Features Status (Part 4.9 — all 5 Completed):**
    1. **Homework checklist (per browser):** **Completed** (`rk.homeworkDone`, interactive checkbox on every active PR in `Beranda` and `Kelas`).
    2. **Birthdays with days remaining:** **Completed** (`getBirthdayCountdown` & `sortBirthdaysByUpcoming` in `assets/js/utils.js`, rendered in `#kelas-bday-section`).
    3. **Piket roster:** **Completed** (rendered in `#kelas-piket-section` with today's day card highlighted with a `'Hari ini'` stamp badge).
    4. **Install-as-app guidance:** **Completed** (`#install-app-section` in `Lainnya` with Android/iOS instructions + automatic `beforeinstallprompt` button).
    5. **New-content dots on tabs:** **Completed** (`[data-nav-dot]` on `Kelas`, `Jadwal`, and `Momen`, persisted per browser in `rk.seenTimestamps` and cleared when visiting the tab).

## 2. Completed phases

| Phase | Result | Date |
|---|---|---|
| 0 - Plan | COMPLETE | 16 Nov 2026 |
| 1 - Foundation and look | COMPLETE | 17 Nov 2026 |
| 2 - File-based data & photo storage | COMPLETE | 17 Nov 2026 |
| 3 - Owner login & Dashboard | SKIPPED (by Farsky's architecture change) | 17 Nov 2026 |
| 4 - Class information and custom sections | COMPLETE | 17 Nov 2026 |
| 5 - Smart schedule with tests | COMPLETE | 17 Nov 2026 |
| 6 - Gallery disc ("Piringan Momen") | COMPLETE | 17 Nov 2026 |
| 7 - Spin wheel ("Roda Putar Siswa") | COMPLETE | 17 Nov 2026 |
| 8 - Reports via WhatsApp & Suggestions | COMPLETE | 17 Nov 2026 |
| 9 - Bonus features + Day/Night switch + 7C schedule | COMPLETE | 17 Nov 2026 |

## 3. Files created / changed in Phase 9

| File | Purpose |
|---|---|
| `data/class-data.js`, `data/default-data.json` | Populated the official Kelas 7C Semester Ganjil 2026/2027 schedule, teachers, and exact period times |
| `index.html` | Added `#i-sun`, `#i-moon`, `#i-gift`, `#i-users`, `#i-download` icons, `.sky-switch` Sun->Moon control, Piket & Birthday sections, PWA install guide, and new-content tab dots |
| `assets/css/styles.css` | Added `--sky-track`, `--sky-orb`, `--sky-icon` tokens, `.sky-switch` Sun->Moon + stars transition styles, `.pr-check`, `.piket-grid`, and `.nav-item__dot` |
| `assets/js/theme.js` | Updated switch labels (`Siang` / `Malam`), toast messages (`Mode malam aktif.` / `Mode siang aktif.`), and pointer drag travel (`28px`) |
| `assets/js/utils.js` | Added `getBirthdayCountdown()` and `sortBirthdaysByUpcoming()` |
| `assets/js/class-info.js` | Added per-browser PR checklist toggle (`rk.homeworkDone`), Piket roster renderer, and Birthdays renderer |
| `assets/js/app.js` | Added `computeContentStamps()`, `updateNewContentDots()`, `markTabSeen()`, and `initInstallGuide()` |
| `sw.js` | Bumped `CACHE_VERSION` to `v8` |
| `tests/schedule.test.js`, `tests/class-info.test.js` | Updated Monday schedule test expectations for 7C times and added unit tests for `getBirthdayCountdown` & `sortBirthdaysByUpcoming` |
| `PROJECT_SPEC.md`, `README.md`, `HANDOFF.md` | Updated decision log, status, and test output |

## 4. Pending work

- **Phase 10:** Full QA across viewports/themes, complete beginner-friendly Indonesian `README.md` (running locally, GitHub Pages deployment, editing `data/class-data.js` & `assets/photos/`, backups, PWA install, limits, troubleshooting), scan the whole project for real phone numbers, real student names, plaintext secrets and keys, and deliver the final Indonesian report.

## 5. Known bugs / open issues

- None in code.

## 6. Test results (real output from this session)

### 6.1 `node --test` (39 passed, 0 failed)
```
✔ getDeadlineBadge returns exact Indonesian stamp badges for H-7, H-3, H-1, Hari ini, Terlambat, Selesai (5.2665ms)
✔ getDeadlineBadge never produces a countdown badge for missing or invalid dates (0.6521ms)
✔ formatCalendarDateWIB formats YYYY-MM-DD in Asia/Jakarta and returns empty string for invalid dates (56.2934ms)
✔ sortRecordsByNearest orders upcoming by nearest date first, then undated, overdue, and completed last (1.2552ms)
✔ getBirthdayCountdown and sortBirthdaysByUpcoming compute WIB days remaining and roll over past dates to next year (1.4281ms)
✔ formatDateWIB and formatDateTimeWIB format Indonesian dates in Asia/Jakarta (24h) (59.0535ms)
✔ WIB midnight rollover converts UTC evening into the next day in Jakarta (1.963ms)
✔ Timestamps with other timezone offsets convert explicitly to WIB (+07:00) (0.6334ms)
✔ Manual fallback (useIntl: false) matches the Intl output across months and weekdays (2.9183ms)
✔ msUntilNextMinute aligns strictly to the next minute boundary (1..60000 ms) (1.3974ms)
✔ Invalid date inputs throw a clear Indonesian TypeError (0.5917ms)
✔ WCAG contrast ratios for light theme (6.1727ms)
✔ WCAG contrast ratios for dark theme (1.5677ms)
✔ No hardcoded hex colors outside the :root[data-theme] token blocks (0.7812ms)
✔ Component tokens use color-mix() in both themes (0.5575ms)
✔ N = 1 and N = 2 have no wrap-around and no overlap (3.4318ms)
✔ Index/angle mapping, snapping, and wrap-around in both directions for N = 5 and N = 40 (1.2281ms)
✔ Visible set is strictly within +/-70 degrees and bounded for N = 1, 2, 5, 40 (3.4795ms)
✔ stepDiscInertia always terminates in a finite number of steps and honors reducedMotion (4.6159ms)
✔ formatReportMessage produces the exact multi-line message with emoji, bullets, and WIB time (59.0383ms)
✔ buildWhatsAppReportUrl encodes emoji, newlines, and special characters and sets status to Dibuka di WhatsApp (0.7325ms)
✔ validateWhatsAppNumber and buildWhatsAppReportUrl reject empty and invalid numbers with Indonesian messages (0.9807ms)
✔ Missing report or suggestion fields throw clear Indonesian validation errors, and attachment notice matches spec (0.6162ms)
✔ getCooldownStatus calculates remaining seconds accurately (1.3411ms)
✔ Weekdays Mon-Fri before switch time S (00:00 up to 19:59 WIB) show single mode for today (6.3696ms)
✔ Switch-time boundary: S minus 1 minute (19:59) vs S (20:00) on Mon-Thu and Friday (3.62ms)
✔ Midnight transitions: Mon 23:59 -> Tue 00:00, and Fri 23:59 -> Sat 00:00 (1.7764ms)
✔ Saturday all day shows full week; Sunday all day shows full week with Monday pinned on top (0.8329ms)
✔ Highlighting: before school, in-lesson, gap between lessons, last lesson, and after school (2.6041ms)
✔ Custom switch time, empty schedule, and invalid schedule entries are handled safely (2.3875ms)
✔ data/class-data.js passes validation and every referenced photo exists in assets/photos/ (10.1193ms)
✔ data/default-data.json is valid JSON and stays in sync with data/class-data.js (8029.1226ms)
✔ resolvePhotoPath maps filenames to ./assets/photos/ and rejects unsafe paths (1.2579ms)
✔ validateClassData reports clear Indonesian errors on bad input (1.0729ms)
✔ loadClassData caches valid data and falls back to cache when file data has an error (4.8315ms)
✔ getPref/setPref and getLocalState/setLocalState validate keys and persist values (1.1717ms)
✔ Angle-to-index mapping and target-angle landing match for N = 1, 2, 5, and 40 names (6.9157ms)
✔ chooseWheelWinner selects uniformly for N = 1, 2, 5, 40 and handles rejection sampling (1.1601ms)
✔ Empty list, single-name list, and excludePicked filtering work cleanly (0.8006ms)
ℹ tests 39 | pass 39 | fail 0
```

### 6.2 Headless Google Chrome verification under subpath (`/ruang-kelas/`)
- `PHASE9_DOM`:
  - `labelBefore`: `"Siang"`, `hasSunIcon`: `true`, `hasMoonIcon`: `true`
  - `labelAfter`: `"Malam"`, `toastAfterSwitch`: `"Mode malam aktif."`
  - `kelasDotBefore`: `true`, `kelasDotAfter`: `false` (clears when visiting `Kelas`)
  - `prCheckedCount`: `1` (after clicking the PR checklist checkbox)
  - `piketDays`: `["Senin","Selasa","Rabu","Kamis","Jumat"]`
  - `bdayCount`: `2`
  - `scheduleSubjectsCount`: `31` (full 7C schedule), `firstMondaySubject`: `"Upacara Bendera / Apel"`, `secondMondaySubject`: `"PAI (Jam ke-1–3)"`
  - `installTitle`: `"Pasang sebagai Aplikasi"`
- `OVERFLOW_FAILURES`: `[]` across widths `360`, `375`, `390`, `430`, `768`, `1280` across all 5 views.
- `CONSOLE_ERRORS`: `[]`, `EXCEPTIONS`: `[]`.

## 7. QA checklist

| # | Item | Status | Evidence |
|---|---|---|---|
| 0.1-0.6 | Git hygiene, `.gitignore`, `.gitattributes`, `.nojekyll`, `LICENSE`, secret scan | PASS | Verified in Phase 0 |
| 1.1-1.8 | Phase 1 foundation, contrast, WIB clock, Day/Night switch, responsive widths, touch targets, SW subpath, banned-list check | PASS | Verified in Phase 1 & re-verified in Phase 9 |
| 1.9 | Firefox manual check & offline reload check in a desktop browser window | NOT TESTED | Manual steps for Farsky in Section 8 |
| 2.1-2.4 | File-based `data/class-data.js`, `default-data.json`, `assets/photos/` existence check, cache fallback | PASS | `tests/storage.test.js` |
| 4.1-4.4 | Class information, custom sections, `H-x` stamp badges, nearest-date sorting | PASS | `tests/class-info.test.js` |
| 5.1-5.2 | Smart schedule `getScheduleView()` and UI with official Kelas 7C schedule | PASS | `tests/schedule.test.js` & `PHASE9_DOM` |
| 6.1-6.2 | Piringan Momen `disc-math.js` and interactive disc/list gallery | PASS | `tests/disc-math.test.js` |
| 7.1-7.2 | Spin wheel crypto winner-first selection, angle mapping, and Canvas UI | PASS | `tests/wheel.test.js` |
| 8.1-8.2 | WhatsApp report URL generator, attachment download notice, cooldown, and Kotak Saran | PASS | `tests/reports.test.js` |
| 9.1 | All 5 Bonus features (PR checklist, birthdays countdown, piket roster, install-as-app guide, new-content dots) + Day/Night Sun->Moon switch | PASS | `tests/class-info.test.js` & Headless Chrome `PHASE9_DOM` |

## 8. How to run

```
cd "C:\workspace\Class website Project2"
python -m http.server 8080
```
Tests:
```
cd "C:\workspace\Class website Project2"
node --test
```

## 9. Next steps

- Farsky: say **Start Phase 10** (or "continue on the next phase") for the final QA pass, complete Indonesian `README.md`, privacy/secret scan, and the final Indonesian project report.
