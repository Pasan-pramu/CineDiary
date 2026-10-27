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
- The database file lives in Electron's `app.getPath('userData')/cinediary.db`.
- Posters live in `userData/posters/<titleId>.jpg` and are served to the UI through a custom
  protocol `poster://<titleId>` (registered with `protocol.handle` in main), so the renderer
  never needs `file://` access.
- A custom Home banner (chosen in Settings) lives in `userData/banners/` and is served the same
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
│  │  ├─ index.ts              # app lifecycle, window, poster:// protocol
│  │  ├─ db/
│  │  │  ├─ client.ts          # opens SQLite, runs migrations
│  │  │  ├─ schema.ts          # Drizzle schema (single source of truth)
│  │  │  ├─ seed.ts            # default reasons
│  │  │  └─ migrations/        # generated by drizzle-kit
│  │  ├─ services/
│  │  │  ├─ titles.ts
│  │  │  ├─ watchEntries.ts
│  │  │  ├─ stats.ts
│  │  │  ├─ posters.ts         # save/download/delete local poster files
│  │  │  ├─ dashboard.ts       # Home lists: recent, current, added, favorites, memory, timeline
│  │  │  ├─ recommendations.ts # rule-based suggestions: Home's "What should I watch?" + Discover
│  │  │  ├─ settings.ts        # display name, Home banner image
│  │  │  ├─ tmdb.ts            # TMDB client (injected fetch; tested in tmdb.test.ts)
│  │  │  ├─ tmdbSync.ts        # re-sync logic, no Electron/DB imports (tested)
│  │  │  ├─ tmdbLibrary.ts     # app TMDB client, DB side of sync, cast/crew, Link to TMDB
│  │  │  ├─ tmdbBackground.ts  # background re-sync + "Refresh all" with progress
│  │  │  ├─ connectivity.ts    # online/offline state, pushed to the renderer
│  │  │  ├─ backup.ts          # backup zip, verify, restore + rollback (no Electron; tested)
│  │  │  ├─ backupManager.ts   # automatic backups, restore orchestration, settings
│  │  │  └─ export.ts          # JSON + CSV exports (tested)
│  │  └─ ipc/
│  │     ├─ index.ts           # registers all handlers
│  │     ├─ titles.ipc.ts
│  │     ├─ watchEntries.ipc.ts
│  │     ├─ stats.ipc.ts
│  │     ├─ dashboard.ipc.ts   # dashboard + recommendations
│  │     ├─ settings.ipc.ts
│  │     ├─ tmdb.ipc.ts        # search, thumbnails, pick (details + poster), test connection
│  │     ├─ connectivity.ipc.ts
│  │     └─ backup.ipc.ts      # backup, restore, exports, open folders (native dialogs)
│  ├─ preload/
│  │  └─ index.ts              # exposes window.api via contextBridge
│  ├─ shared/
│  │  ├─ types.ts              # Title, WatchEntry, DTOs
│  │  ├─ tmdbFields.ts         # TMDB field rules: link defaults, snapshot comparison
│  │  ├─ constants.ts          # MOODS, STATUSES, DEFAULT_REASONS
│  │  ├─ discoverPrompts.ts    # Discover prompts → moods, reasons, genres (tune it here)
│  │  ├─ genres.ts             # genre matching key (case, punctuation, Sci-Fi aliases)
│  │  └─ api.ts                # the typed shape of window.api
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx            # router + layout
│        ├─ layout/            # Sidebar, TopBar, AppLayout
│        ├─ pages/
│        │  ├─ Dashboard.tsx
│        │  ├─ Library.tsx
│        │  ├─ AddTitle.tsx
│        │  ├─ TitleDetails.tsx
│        │  ├─ WatchHistory.tsx
│        │  ├─ Insights.tsx
│        │  ├─ Discover.tsx      # /discover — For My Mood
│        │  └─ Settings.tsx
│        ├─ components/        # PosterCard, MoodPicker, ReasonChips, StatCard, RatingStars…
│        ├─ hooks/             # useTitles, useStats, useOnlineStatus…
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
| poster_file | text | local filename in `userData/posters`, nullable |
| backdrop_file | text | TMDB backdrop in `userData/backdrops` (served as `poster://backdrops/<id>`), nullable |
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
| created_at / updated_at | text (ISO) | |

Mood change is **derived** (`mood_after_score - mood_before_score`), never stored.

### `reasons` and `watch_entry_reasons`
- `reasons(id, key unique, label, is_custom)` — seeded with the defaults below.
- `watch_entry_reasons(watch_entry_id, reason_id)`, composite pk — multiple reasons per watch.

### `title_cast` and `title_crew` (from TMDB)
- `title_cast(id, title_id → titles cascade, name, character, order)` — top ~10 billed cast.
- `title_crew(id, title_id → titles cascade, name, role 'director' | 'creator', order)`.

### `settings`
- `settings(key text pk, value text)` — e.g. `tmdb_api_key`, `theme`.

### Constants (`src/shared/constants.ts`)
```ts
export const MOODS = [
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
      pick poster from disk → copied to `userData/posters`.
- [x] **M3 – Library:** poster grid, search by title, filters (type, status, genre, favorite, rating).
- [ ] **M4a – Title Details + watch logging:** details page, start/finish a watch, mood before/after,
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

**Later:** timeline/diary view, advanced filters
("watched when stressed and mood improved"), import, animations polish.

---

## Gotchas

- `better-sqlite3` is a native module: run `electron-builder install-app-deps`
  (add it as a `postinstall` script) so it is rebuilt for Electron's Node version.
- Use HashRouter, not BrowserRouter, in Electron.
- `npm test` runs vitest under **Electron's Node** (`scripts/test.mjs`, `ELECTRON_RUN_AS_NODE`),
  because better-sqlite3 is compiled for Electron.
- **Backups:** never copy `cinediary.db` while it's open (WAL mode); use `db.backup()`. A restore
  only swaps `cinediary.db*` and `posters/`, `backdrops/`, `banners/`; it never touches
  `safety-backups/`. Settings live in the database, so a restore brings back the backup's
  settings too (the TMDB token may need re-entering on another computer).
- Store dates as ISO strings; format them in the UI only.
