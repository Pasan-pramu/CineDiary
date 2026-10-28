# CineDiary — Project Guide for Claude Code

For all UI work, follow DESIGN.md.

> A private, local-first desktop app that tracks every movie and TV series I watch:
> **what I watched, why I watched it, and how it made me feel.**
> (Working name "CineDiary" — rename everywhere if I pick a different name.)

This is a personal project, not a commercial product. I am a JavaScript/TypeScript developer
and I want to understand and modify every part of this codebase myself. Keep it simple.

---

## How we work (rules for Claude)

1. **One milestone at a time.** Only work on the milestone I ask for (see "Milestones" below).
2. **Plan before coding.** For each milestone, first list the files you will create/change and
   wait for my OK, unless I say "go ahead".
3. **Don't overengineer.** No extra state libraries, no abstractions "for later", no ML.
   Ask before adding any new npm dependency not listed in the stack below.
4. **Explain as you go.** After a milestone, give me a short summary of what was built and
   where to look, so I can learn the codebase.
5. **TypeScript strict mode.** No `any` unless justified in a comment.
6. **Commit per milestone** with a clear message (e.g. `feat: M2 add-title form`).
7. **Never commit secrets.** The TMDB API Read Access Token is entered through the Settings
   screen and stored in the `settings` table encrypted with Electron's `safeStorage` — never
   hard-coded, never in git, never sent to the renderer.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Electron** via **electron-vite** | Whole project stays in TypeScript |
| UI | **React 18 + TypeScript** | |
| Styling | **Tailwind CSS**, dark mode by default | |
| Routing | **react-router-dom** (HashRouter — works with Electron's file loading) | |
| Database | **SQLite** via **better-sqlite3** | Single local file, easy backup |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Typed queries, readable schema |
| Charts | **Recharts** | |
| Icons | **lucide-react** | |
| Validation | **zod** (for IPC inputs and forms) | |
| Packaging | **electron-builder** | |
| Tests | **vitest** (`npm test`) | Main-process logic, e.g. TMDB client with mocked responses |
| Zip | **fflate** | Backups (streaming zip/unzip, no dependencies) |

Package manager: **npm**.

---

## Architecture

```
┌──────────────── Renderer (React UI) ────────────────┐
│ Pages, components, hooks. NO direct DB or network.  │
│ Calls window.api.* only.                            │
└───────────────▲─────────────────────────────────────┘
                │ typed IPC (contextBridge in preload)
┌───────────────┴──────── Main process (Node) ────────┐
│ db/        SQLite + Drizzle, migrations              │
│ services/  titles, watchEntries, stats, posters,     │
│            dashboard, recommendations, settings,     │
│            tmdb, connectivity, backup                │
│ ipc/       one handler file per domain               │
└──────────────────────────────────────────────────────┘
```

- **Security:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where possible.
  The preload script exposes a small typed `window.api` object — nothing else.
- **Shared types** live in `src/shared/` and are imported by main, preload and renderer.
- **Data folder:** all CineDiary data (database, `posters/`, `backdrops/`, `banners/`,
  `safety-backups/`, `logs/`) lives in one data folder, returned by `dataFolder()`
  (`src/main/dataFolder.ts`). By default it is Electron's `userData`; Settings → About →
  "Change data folder…" moves it (e.g. to `D:\CineDiary`). Electron's `userData` always keeps
  Chromium's own files, `window-state.json` and the pointer file `data-location.json`.
- The database file is `<data folder>/cinediary.db`.
- Posters live in `<data folder>/posters/<titleId>.jpg` and are served to the UI through a custom
  protocol `poster://<titleId>` (registered with `protocol.handle` in main), so the renderer
  never needs `file://` access.
- A custom Home banner (chosen in Settings) lives in `<data folder>/banners/` and is served the same
  way through `banner://current`.

### Online / offline mode (local-first)

The local database is **always** the source of truth. The internet only adds data, never holds it.

- **Connectivity:** main process checks `net.isOnline()` plus a lightweight request to
  `api.themoviedb.org` every ~30s and on window focus; it pushes `online`/`offline` events
  to the renderer. The UI shows a small status badge in the top bar.
- **Works offline (everything core):** library, posters (already downloaded), details, watch
  entries, moods, reasons, reflections, stats, dashboard, manual add/edit, export.
- **Needs online:** TMDB search & autofill, downloading a poster from TMDB, metadata refresh.
  When offline, these buttons are disabled with a tooltip ("You're offline").
- **Posters are downloaded once** when a title is added (from TMDB or a local file the user
  picks) and stored locally. Never hot-link TMDB image URLs in the UI.
- **Background refresh (online only):** titles with `tmdb_synced_at` older than ~5 months are
  re-synced quietly, one title every ~20s while the app is open (TMDB terms reportedly limit
  caching to 6 months). It pauses on errors/rate limits and can be turned off in Settings.
- **My edits win:** `titles.tmdb_snapshot` stores the (mapped) TMDB values from the last sync; a
  field that differs from it is mine and is never overwritten. Personal data (status, rating,
  favorite, watch entries, moods, reasons, reflections) is never touched by TMDB code.
  Posters are not re-synced; backdrops are only downloaded when missing.
- **Attribution:** Settings → About shows the TMDB logo and:
  "This product uses the TMDB API but is not endorsed or certified by TMDB."

---

## Folder structure

```
cinediary/
├─ CLAUDE.md
├─ electron.vite.config.ts
├─ drizzle.config.ts
├─ package.json
├─ src/
│  ├─ main/
│  │  ├─ index.ts              # app lifecycle, window (remembers its place), poster:// protocol
│  │  ├─ logs.ts               # logError() + handle(): every IPC handler logs its failures
│  │  ├─ dataFolder.ts          # dataFolder(): where the data lives (every data path uses it)
│  │  ├─ test/memoryDb.ts      # tests: in-memory SQLite with the real migrations + sample inserts
│  │  ├─ db/
│  │  │  ├─ client.ts          # opens SQLite, runs migrations
│  │  │  ├─ schema.ts          # Drizzle schema (single source of truth)
│  │  │  ├─ seed.ts            # default reasons
│  │  │  ├─ like.ts            # escaped LIKE patterns (%, _ and \ taken literally)
│  │  │  └─ migrations/        # generated by drizzle-kit
│  │  ├─ services/
│  │  │  ├─ titles.ts
│  │  │  ├─ watchEntries.ts
│  │  │  ├─ stats.ts           # stats engine: periods → date ranges, Insights aggregates
│  │  │  ├─ feelings.ts        # feelings & reasons distributions, over time, chapter analysis
│  │  │  ├─ posters.ts         # save/download/delete local poster files
│  │  │  ├─ dashboard.ts       # Home lists: recent, current, added, favorites, memory, timeline
│  │  │  ├─ recommendations.ts # rule-based suggestions: Home's "What should I watch?" + Discover
│  │  │  ├─ moods.ts           # moods table: list (with uses), add, rename, hide, reorder, delete
│  │  │  ├─ reasons.ts         # reasons: the same rules as moods
│  │  │  ├─ settings.ts        # display name, Home banner image
│  │  │  ├─ tmdb.ts            # TMDB client (injected fetch; tested in tmdb.test.ts)
│  │  │  ├─ tmdbSync.ts        # re-sync logic, no Electron/DB imports (tested)
│  │  │  ├─ tmdbLibrary.ts     # app TMDB client, DB side of sync, cast/crew, Link to TMDB
│  │  │  ├─ tmdbBackground.ts  # background re-sync + "Refresh all" with progress
│  │  │  ├─ connectivity.ts    # online/offline state, pushed to the renderer
│  │  │  ├─ backup.ts          # backup zip, verify, restore + rollback (no Electron; tested)
│  │  │  ├─ backupManager.ts   # automatic backups, restore orchestration, settings
│  │  │  ├─ export.ts          # JSON + CSV exports (tested)
│  │  │  ├─ timeline.ts        # My Timeline: month pages, chapters (life_periods), summaries
│  │  │  ├─ search.ts          # top-bar search: titles, journal text, chapters (tested)
│  │  │  ├─ errorLog.ts        # <data folder>/logs/cinediary.log: message + stack only (tested)
│  │  │  ├─ dataLocation.ts    # pointer file, startup check (ok / missing / unreadable) (tested)
│  │  │  ├─ dataMove.ts        # move: check target, copy, verify, delete old copy (tested)
│  │  │  ├─ dataMoveManager.ts # the move: pause, safety backup, freeze, copy, verify, restart
│  │  │  └─ windowState.ts     # window size/position in userData/window-state.json (tested)
│  │  └─ ipc/
│  │     ├─ index.ts           # registers all handlers
│  │     ├─ titles.ipc.ts
│  │     ├─ watchEntries.ipc.ts
│  │     ├─ moods.ipc.ts       # moods:* and reasons:*
│  │     ├─ stats.ipc.ts
│  │     ├─ dashboard.ipc.ts   # dashboard + recommendations
│  │     ├─ settings.ipc.ts
│  │     ├─ tmdb.ipc.ts        # search, thumbnails, pick (details + poster), test connection
│  │     ├─ connectivity.ipc.ts
│  │     ├─ backup.ipc.ts      # backup, restore, exports, open folders (native dialogs)
│  │     ├─ timeline.ipc.ts    # timeline pages, overview, chapter CRUD
│  │     ├─ search.ipc.ts      # global search
│  │     ├─ app.ipc.ts         # app info (version, data folder), open logs, renderer errors
│  │     └─ dataLocation.ipc.ts # move, old copy, and the "Can't find your diary" screen
│  ├─ preload/
│  │  └─ index.ts              # exposes window.api via contextBridge
│  ├─ shared/
│  │  ├─ types.ts              # Title, WatchEntry, DTOs
│  │  ├─ tmdbFields.ts         # TMDB field rules: link defaults, snapshot comparison
│  │  ├─ constants.ts          # MOODS, STATUSES, DEFAULT_REASONS
│  │  ├─ discoverPrompts.ts    # Discover prompts → moods, reasons, genres (tune it here)
│  │  ├─ genres.ts             # genre matching key (case, punctuation, Sci-Fi aliases)
│  │  ├─ timeline.ts           # timeline date, chapter matching, milestones, chapter colors
│  │  ├─ shortcuts.ts          # the keyboard shortcuts list (handled in useShortcuts, shown in About)
│  │  └─ api.ts                # the typed shape of window.api
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx            # router + layout
│        ├─ errors.ts          # toasts + error reporting (toast for user actions, log for background)
│        ├─ format.ts          # date formatting for the UI
│        ├─ layout/            # Sidebar, TopBar, AppLayout
│        ├─ pages/
│        │  ├─ Dashboard.tsx
│        │  ├─ Library.tsx
│        │  ├─ AddTitle.tsx
│        │  ├─ TitleDetails.tsx
│        │  ├─ WatchHistory.tsx
│        │  ├─ Insights.tsx
│        │  ├─ Discover.tsx      # /discover — For My Mood
│        │  ├─ Timeline.tsx      # /timeline — My Timeline (chapters, highlights, milestones)
│        │  └─ Settings.tsx
│        ├─ components/        # PosterCard, StatCard, MoodPicker, MoodsSection…; insights/
│        ├─ hooks/             # useMoods (moods + reasons store), useSettings, useOnlineStatus…
│        └─ styles/index.css   # Tailwind + design tokens
```

---

## Data model

Key idea: **a Title is the thing; a WatchEntry is one time I watched it.**
Moods, reasons and reflections belong to the WatchEntry, so rewatches and long series runs
each keep their own feelings.

### `titles`
| column | type | notes |
|---|---|---|
| id | integer pk | |
| type | text | `'movie' \| 'series'` |
| title | text, required | |
| original_title | text | |
| year | integer | release year |
| overview | text | |
| country | text | |
| language | text | |
| runtime_minutes | integer | movie runtime, or average **episode** runtime for series |
| total_seasons | integer | series only |
| total_episodes | integer | series only |
| status | text | `'planned' \| 'watching' \| 'completed' \| 'dropped' \| 'rewatching'` |
| rating | integer | personal rating 1–10, nullable |
| is_favorite | integer (bool) | default 0 |
| poster_file | text | local filename in `<data folder>/posters`, nullable |
| backdrop_file | text | TMDB backdrop in `<data folder>/backdrops` (served as `poster://backdrops/<id>`), nullable |
| tmdb_id | integer | nullable, unique together with `type` |
| imdb_id | text | nullable |
| tmdb_synced_at | text (ISO) | nullable |
| tmdb_snapshot | text (JSON) | TMDB values from the last sync (see "My edits win"), nullable |
| created_at / updated_at | text (ISO) | |

### `genres` and `title_genres`
- `genres(id, name unique)`
- `title_genres(title_id → titles, genre_id → genres)`, composite pk

### `watch_entries`
| column | type | notes |
|---|---|---|
| id | integer pk | |
| title_id | integer → titles | cascade delete |
| started_at | text (ISO date) | |
| completed_at | text (ISO date) | nullable while watching |
| is_rewatch | integer (bool) | |
| episodes_watched | integer | series progress for this run |
| mood_before | text | key from `MOODS` |
| mood_before_score | integer | 1–10 |
| reason_note | text | "I was stressed about university…" |
| mood_after | text | key from `MOODS` |
| mood_after_score | integer | 1–10 |
| thoughts | text | what I thought about it |
| lessons | text | what I learned |
| favorite_character | text | |
| favorite_scene | text | |
| would_rewatch | integer (bool) | nullable |
| would_recommend | integer (bool) | nullable |
| notes | text | |
| is_highlight | integer (bool) | marked as a highlight on the timeline, default 0 |
| created_at / updated_at | text (ISO) | |

Mood change is **derived** (`mood_after_score - mood_before_score`), never stored.

### `moods`
- `moods(id, key unique, label, emoji, is_custom, is_hidden, sort_order)` — seeded with the 10
  built-in moods by migration 0005. `watch_entries.mood_before` / `mood_after` store the key,
  which never changes (renaming changes only the label).

### `reasons` and `watch_entry_reasons`
- `reasons(id, key unique, label, is_custom, is_hidden, sort_order)` — the defaults below are
  seeded at startup (`db/seed.ts`).
- **Moods and reasons** (Settings → Moods & reasons): add, rename, change emoji, reorder,
  hide/unhide. Anything a watch uses can only be hidden; unused custom ones can be deleted.
  Hidden ones leave the pickers but stay on old entries, in Insights, filters and exports.
- `watch_entry_reasons(watch_entry_id, reason_id)`, composite pk — multiple reasons per watch.

### `title_cast` and `title_crew` (from TMDB)
- `title_cast(id, title_id → titles cascade, name, character, order)` — top ~10 billed cast.
- `title_crew(id, title_id → titles cascade, name, role 'director' | 'creator', order)`.

### `life_periods` (timeline chapters)
- `life_periods(id, name, start_date, end_date nullable = ongoing, color, note, created_at, updated_at)`.
  `color` is a key (`violet`, `blue`, `green`, `amber`, `rose`, `teal`) mapped to a CSS token
  `--color-chapter-<key>`; chapters may overlap.

### `settings`
- `settings(key text pk, value text)` — e.g. `tmdb_api_key`, `theme`.

### Constants (`src/shared/constants.ts`)
`DEFAULT_MOODS` is only the starting list (and test fixture); the app reads moods from the
`moods` table. `MoodKey` is a `string`.
```ts
export const DEFAULT_MOODS = [
  { key: 'very_happy', label: 'Very happy', emoji: '😄' },
  { key: 'happy',      label: 'Happy',      emoji: '🙂' },
  { key: 'neutral',    label: 'Neutral',    emoji: '😐' },
  { key: 'sad',        label: 'Sad',        emoji: '😔' },
  { key: 'stressed',   label: 'Stressed',   emoji: '😩' },
  { key: 'demotivated',label: 'Demotivated',emoji: '😞' },
  { key: 'bored',      label: 'Bored',      emoji: '😴' },
  { key: 'lonely',     label: 'Lonely',     emoji: '❤️' },
  { key: 'overwhelmed',label: 'Overwhelmed',emoji: '🤯' },
  { key: 'calm',       label: 'Calm',       emoji: '😌' },
] as const;

export const DEFAULT_REASONS = [
  'Happy','Sad','Lonely','Stressed','Demotivated','Needed motivation','Needed relaxation',
  'Wanted to laugh','Wanted adrenaline','Needed an escape','Wanted something meaningful',
  'Wanted inspiration','Wanted adventure','Curious','Recommended by someone','Rewatch','Other',
];
```

### Derived stats (computed in `services/stats.ts`, not stored)
- Hours watched = movies: `runtime_minutes` per completed entry; series: `episodes_watched × runtime_minutes`.
- Avg mood before/after, mood change per title, per genre, per reason.
- Counts per month, top genres, top reasons.

---

## UX principles

- Dark mode first; poster-heavy cards; generous spacing; it should feel like a personal
  entertainment dashboard + mood journal, **not** an admin panel. Reference: my mockups.
- **Logging must be fast.** The after-watching form shows essentials first
  (mood after, score, rating, one-line note); everything else sits under "Add more reflection".
- Every screen needs a friendly **empty state** (new installs have no data).
- No login, no cloud. All personal data stays on this computer.

---

## Milestones

- [x] **M0 – Scaffold:** electron-vite React-TS app, Tailwind, ESLint/Prettier, folder structure
      above, HashRouter with empty pages, sidebar + top bar layout in dark theme matching mockups.
- [x] **M1 – Database & IPC:** Drizzle schema, migrations run on startup, seed reasons, typed
      `window.api`, `poster://` protocol. Rebuild better-sqlite3 for Electron.
- [x] **M2 – Add Title (manual):** form with all title fields, genre multi-select (create on the fly),
      pick poster from disk → copied to `<data folder>/posters`.
- [x] **M3 – Library:** poster grid, search by title, filters (type, status, genre, favorite, rating).
- [x] **M4a – Title Details + watch logging:** details page, start/finish a watch, mood before/after,
      reasons (multi), reflection fields, rewatch history.
- [x] **M4b – My Cinema Journal:** journal page with watch memories, mood changes, reasons, and reflections.
- [x] **M5a – Insights page + stats engine:** SQL aggregates in `services/stats.ts` for a
      selected period (totals, watches per month, genres, mood before/after/change by genre and
      reason, most effective titles per reason), `/insights` page with period selector,
      reusable `StatCard`, Recharts charts, sentence-style mood insights; empty states.
- [x] **M5b – Home / Dashboard:** greeting + hero banner (display name and optional banner
      image in Settings), stat cards, genres donut, mood trend, recently watched / currently
      watching / recently added, favorites carousel, "What should I watch?", "From your past",
      mini timeline; welcome state for new installs.
- [x] **M6a – TMDB search & autofill:** API token in Settings (masked, test connection),
      connectivity service + online badge, TMDB search & autofill in Add Title with local poster
      download, duplicate check, offline fallback to manual add, TMDB attribution in About.
- [x] **M6b – TMDB enrichment & re-sync:** backdrops, cast & directors, link existing titles to
      TMDB, background re-sync of stale titles.
- [x] **M7 – Backup, export & restore:** verified .zip backups (database via SQLite's backup
      API + images + manifest), automatic backups to a chosen folder, restore with safety backup
      and rollback, JSON and CSV exports, dashboard backup reminder.
- [x] **M8 – Discover / For My Mood:** mood prompt cards (config in `src/shared/discoverPrompts.ts`),
      filters in the URL, three groups (helped before / watchlist / haven't watched in a while)
      with "why" lines, not-enough-data guidance, Start watching with mood and reason pre-filled.
- [x] **M9 – My Timeline:** year/month timeline loaded by month pages, sticky headers, year jump
      list, life chapters (overlapping, ongoing) with summaries, highlights, automatic milestones,
      URL-backed search and filters; chapters and highlights in exports.
- [x] **M10a – Light theme + Appearance setting:** light values for every CSS token, Dark /
      Light / System in Settings (native title bar follows), no theme flash on startup, no
      hard-coded colors left in the renderer.
- [x] **M10b – Global search, Quick Add, shortcuts, Settings cleanup:** top-bar search
      (Ctrl+K) over titles, cast/crew, genres, journal text and chapters with keyboard
      navigation; Quick Add dialog (Ctrl+N, sidebar, hero) with TMDB and duplicate guard;
      Ctrl+1…6 / Ctrl+, / Esc; Settings sections with side navigation and About (version, data
      folder, shortcuts); window size/position remembered; Title Details resets per title.
- [x] **M10c – Feelings & life chapters analysis:** Insights periods for a life chapter or a
      custom range, Feelings section (mood before/after and reason distributions with "Not
      recorded", top 5 over time, sentences), Life chapters cards + side-by-side comparison,
      top reason/feeling on Timeline chapters, Journal total + chapter and feeling-or-reason
      filters, Timeline reason/feeling filters. Stats regression snapshots guard Insights and
      the dashboard (`stats.regression.test.ts`).
- [x] **M11 – Polish & quality:** shared control classes, two page widths, skeleton loaders,
      shared date formatting; motion (native `<dialog>` with open/close animation, page fade,
      hover lift, 250ms count-up, all off with reduced motion); error boundary, toasts and a local
      error log; tests for status recomputation, local dates (Asia/Colombo), stats averages,
      ranking and journal filters; visible focus, labels, alt text, contrast in both themes;
      perf check on 1,000 titles / 2,000 watches with indexes in migration 0004 and incremental
      lists.
- [x] **M11b – Custom moods & data location:** `moods` table (migration 0005, seeded with the
      built-in moods), hidden/ordered reasons, "+ New mood/reason" in the watch dialog,
      Settings → Moods & reasons, one "feeling or reason" Journal filter; a movable data folder
      (pointer in userData, verified copy with the database frozen, old copy deleted only when
      you confirm, "Can't find your diary" screen when the folder is missing).

**Later:** advanced filters
("watched when stressed and mood improved"), import.

---

## Gotchas

- `better-sqlite3` is a native module: run `electron-builder install-app-deps`
  (add it as a `postinstall` script) so it is rebuilt for Electron's Node version.
- Use HashRouter, not BrowserRouter, in Electron.
- `npm test` runs vitest under **Electron's Node** (`scripts/test.mjs`, `ELECTRON_RUN_AS_NODE`),
  because better-sqlite3 is compiled for Electron. Tests use an in-memory database
  (`src/main/test/memoryDb.ts`), never a real diary. Date tests run in `Asia/Colombo` around local
  midnight; "today" is always `getLocalDate()`, never the UTC date.
- **Backups:** never copy `cinediary.db` while it's open (WAL mode); use `db.backup()`. A restore
  only swaps `cinediary.db*` and `posters/`, `backdrops/`, `banners/`; it never touches
  `safety-backups/`. Settings live in the database, so a restore brings back the backup's
  settings too (the TMDB token may need re-entering on another computer).
- Store dates as ISO strings; format them in the UI only.
- **Never use `app.getPath('userData')` for data** — use `dataFolder()`. Only the pointer file
  and `window-state.json` belong in userData. Without a pointer the data folder *is* userData.
  If the pointer names a folder without `cinediary.db` (drive unplugged) or can't be read, the
  app opens no database and shows "Can't find your diary". During a move the database runs with
  `PRAGMA query_only = ON`, TMDB sync is suspended and backups are locked until the restart.
  Deleting an old copy removes only CineDiary's own items (`isCineDiaryItem`), never Chromium's.
- **Performance check:** `npm run seed:perf -- <new empty folder>` builds a made-up diary
  (1,000 titles, 2,000 watches; refuses a folder that isn't empty), then
  `npx electron . --user-data-dir=<that folder>`. M11 numbers on it: every page's data under 60 ms
  (Insights "All time" with feelings and chapters ~55 ms), pages ready in ~30–110 ms. Collection
  and Journal render 60/40 items and add more as you scroll (`useIncrementalList`).
- **Errors:** register IPC handlers with `handle()` from `main/logs.ts` (not `ipcMain.handle`), so
  failures land in `<data folder>/logs/cinediary.log`. In the renderer, never `.catch(() => undefined)`:
  use `failed('…')` (toast) for things the user did and `quietly('…')` (log only) for background
  work. The log holds channel, message and stack frames only — never arguments or input values.
