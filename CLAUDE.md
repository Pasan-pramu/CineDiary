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
7. **Never commit secrets.** The TMDB API key is stored locally in the `settings` table,
   entered through the Settings screen — never hard-coded, never in git.

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
  re-synced quietly (TMDB terms reportedly limit caching to 6 months).
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
│  │  │  ├─ recommendations.ts # "What should I watch?" from my own history (reused by Discover)
│  │  │  ├─ settings.ts        # display name, Home banner image
│  │  │  ├─ tmdb.ts            # (M6) search + details + image URLs
│  │  │  ├─ connectivity.ts    # (M6)
│  │  │  └─ backup.ts          # (M7)
│  │  └─ ipc/
│  │     ├─ index.ts           # registers all handlers
│  │     ├─ titles.ipc.ts
│  │     ├─ watchEntries.ipc.ts
│  │     ├─ stats.ipc.ts
│  │     ├─ dashboard.ipc.ts   # dashboard + recommendations
│  │     └─ settings.ipc.ts
│  ├─ preload/
│  │  └─ index.ts              # exposes window.api via contextBridge
│  ├─ shared/
│  │  ├─ types.ts              # Title, WatchEntry, DTOs
│  │  ├─ constants.ts          # MOODS, STATUSES, DEFAULT_REASONS
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
| tmdb_id | integer | nullable, unique together with `type` |
| imdb_id | text | nullable |
| tmdb_synced_at | text (ISO) | nullable |
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
- [ ] **M6 – Online mode (TMDB):** API key in Settings, connectivity service + badge, search &
      autofill in Add Title, poster download, background re-sync, TMDB attribution in About.
- [ ] **M7 – Export & backup:** export all data to JSON, copy the `.db` file to a chosen folder.

**Later:** mood-based recommendations (rule-based), timeline/diary view, advanced filters
("watched when stressed and mood improved"), import, animations polish.

---

## Gotchas

- `better-sqlite3` is a native module: run `electron-builder install-app-deps`
  (add it as a `postinstall` script) so it is rebuilt for Electron's Node version.
- Use HashRouter, not BrowserRouter, in Electron.
- Store dates as ISO strings; format them in the UI only.
