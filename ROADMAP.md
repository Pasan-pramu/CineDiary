# CineDiary — Roadmap to Finish

Copy-paste prompts for every remaining milestone, in order.
Before each one: `/clear` in Claude Code, paste the prompt, review the plan, then reply OK.
After each one: test it yourself → commit → tick it in CLAUDE.md → back up `%APPDATA%\cinediary`.

| # | Milestone | What you get |
|---|---|---|
| M5a | Insights + stats engine | Statistics page, mood insights |
| M5b | Home / Dashboard | Your designed dashboard, with real data → **MVP done** |
| M6a | TMDB search & autofill | Online mode: search a movie, fill everything, download poster |
| M6b | TMDB enrichment & re-sync | Backdrops, cast, directors, background refresh |
| M7 | Backup, export & restore | Never lose your memories |
| M8 | Discover / For My Mood | Mood-based recommendations from your history |
| M9 | My Timeline | Your life through movies, with life chapters |
| M10 | Global search, Quick Add, Settings, light theme | Everyday convenience |
| M11 | Polish & quality | Animations, tests, error handling, accessibility |
| M12 | Windows installer | Install CineDiary like a real app |

(M5a and M5b prompts are in the chat. Everything after that is below.)

---

## M6a — Online mode: TMDB search & autofill

Before starting: get your free TMDB API Read Access Token (themoviedb.org → Settings → API).
Paste it into the app's Settings page yourself — never into the chat, never into a committed file.

```
Read CLAUDE.md and DESIGN.md. First split M6 in CLAUDE.md into:
- M6a – TMDB search & autofill
- M6b – TMDB enrichment & re-sync
Then start M6a only.

1. Settings page: a "TMDB" section with a field for the API Read Access
   Token (stored in the settings table), a "Test connection" button, and
   a short how-to-get-a-key note. Mask the token after saving.
2. Connectivity service (main process): net.isOnline() plus a lightweight
   check against api.themoviedb.org every ~30s and on window focus; push
   online/offline events to the renderer. Add an online/offline badge to
   the top bar (useOnlineStatus hook).
3. TMDB service (main process only, src/main/services/tmdb.ts): search
   movies and TV, get details. Use the token as a Bearer header. Handle
   errors, timeouts (10s) and rate limits (HTTP 429, retry after delay)
   gracefully. The renderer never calls TMDB directly.
4. Add Title: a "Search TMDB" box at the top. Results show poster
   thumbnails, title, year, type. Picking one autofills title, original
   title, year, overview, genres (create missing ones), country, language,
   runtime (episode runtime for series), seasons, episodes, tmdb_id,
   imdb_id, and downloads the poster (w500) into the temp poster flow.
   Everything stays editable before saving.
5. Duplicate check: if tmdb_id + type already exists, show "Already in
   your collection" with a link instead of creating a duplicate.
6. Offline: TMDB search is disabled with "You're offline — add manually".
   Manual add always works.
7. Settings → About: TMDB logo and the notice "This product uses the TMDB
   API but is not endorsed or certified by TMDB."
8. Set tmdb_synced_at when data comes from TMDB.

Never hot-link TMDB image URLs in the UI; posters are always local files.
Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

## M6b — TMDB enrichment & background re-sync

```
Read CLAUDE.md and DESIGN.md. Start Milestone M6b.

1. Backdrops: add titles.backdrop_file via a NEW migration. Download the
   TMDB backdrop (w1280) for TMDB titles, serve it through the poster
   protocol (e.g. poster://backdrops/<id>), and use it on the Title Details
   header instead of the blurred poster when available.
2. Cast & crew: store the top ~10 cast (name, character, order) and
   directors/creators in simple new tables (NEW migration). Show cast on
   Title Details; add a "Top directors" card to Insights.
3. "Link to TMDB" on an existing manual title: search, pick a match, then
   show a side-by-side "keep mine / use TMDB" choice per field before
   overwriting anything. Never overwrite my personal data (rating, status,
   entries, notes).
4. Background re-sync (online only, low priority): titles with
   tmdb_synced_at older than ~5 months are refreshed quietly, a few per
   minute. Only refresh TMDB fields, never my personal fields.
5. Settings: "Refresh all TMDB data now" button with progress, and a
   toggle to turn background sync off.

Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

---

## M7 — Backup, export & restore

```
Read CLAUDE.md and DESIGN.md. Start Milestone M7 (Backup & export) as a
"Backup & Export" section in Settings.

1. Full backup: one .zip containing a consistent copy of the database
   (use better-sqlite3's backup API, not a raw file copy while open),
   all posters and backdrops, and a manifest.json (app version, schema
   version, date, counts). Save via a native save dialog.
2. Automatic backups: optional, to a folder I choose, on app start if the
   last backup is older than N days (default 7). Keep the last 10 and
   delete older ones. Show "Last backup: <date>" in Settings.
3. Restore: pick a backup .zip, show what it contains (date, counts),
   require a clear confirmation, automatically make a safety backup of the
   current data first, then restore and restart the app. Reject backups
   from a newer schema version with a friendly message.
4. Export to JSON: all titles, genres, watch entries, reasons and
   reflections in a readable, documented format (no images). Also a CSV
   export of watch entries for spreadsheets.
5. "Open data folder" button.

Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

---

## M8 — Discover / For My Mood

```
Read CLAUDE.md and DESIGN.md, and look at the Recommendations screen and
the "What should I watch?" panel in docs/designs/.
Start Milestone M8 – Discover / For My Mood at /discover.
Reuse the recommendation service built for the dashboard in M5b; extend
it rather than duplicating it. Rule-based only, no ML.

1. Mood prompts as large cards: "I'm feeling down", "I need motivation",
   "I want to laugh", "I want adrenaline and action", "I want something
   peaceful", "I want a meaningful story". Map each to MOODS keys,
   reasons and genres in one clearly documented config object in
   src/shared/ so I can tune it myself.
2. Filters: Movie / Series, max runtime ("I have 2 hours"), include
   rewatches yes/no.
3. Results in three groups:
   - "Helped you before": titles from my history with the best average
     mood change in similar situations
   - "From your watchlist": planned titles in genres that historically
     lifted my mood for this feeling
   - "Haven't watched in a while": favorites or highly rated titles not
     watched in 6+ months that match
4. Every result has a "why" explanation: the matching reason/mood, previous
   mood change (e.g. 4 → 8), sample size, and my own note if one exists.
5. "Not enough data yet" state that explains how to get better suggestions
   (log moods and reasons).
6. One-click "Start watching" from a result (opens the start dialog with
   the mood and reason prefilled).

Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

---

## M9 — My Timeline

```
Read CLAUDE.md and DESIGN.md, and look at the Timeline screens in
docs/designs/. Start Milestone M9 – My Timeline at /timeline.

1. Vertical chronological timeline, grouped by year then month, newest
   first, with a sticky year/month header and a year jump list.
2. Each item: date, poster thumbnail, title, reason, mood before → after,
   and a one-line note; clicking opens the title.
3. Life chapters: a new life_periods table (NEW migration): name, start
   date, optional end date, color, optional note, e.g. "Final year at
   university". Create/edit/delete them from the timeline; chapters show
   as colored bands or headers spanning their date range.
4. Highlights: mark a watch entry as a highlight (new boolean column, NEW
   migration) from its memory card; highlights are visually emphasized
   on the timeline. Also auto-label milestones: first watch of the year,
   10th/50th/100th title, first rewatch of a title.
5. Search and filter (text, type, chapter, highlights only), URL-backed.
6. Smooth scrolling that stays fast with 1,000+ entries (virtualize or
   paginate by month if needed).

Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

---

## M10 — Global search, Quick Add, Settings & light theme

```
Read CLAUDE.md and DESIGN.md, and look at the light-mode dashboard
mockup in docs/designs/. Start Milestone M10.

1. Global search: make the top-bar search work. Ctrl+K focuses it. It
   searches titles, genres and journal text, shows grouped results in a
   dropdown (Titles / Journal entries), and supports keyboard navigation.
2. Quick Add dialog (Ctrl+N and the Quick Add button): title, type, status
   and optional poster, plus "Search TMDB" when online. Saves without
   leaving the current page, with "Open details" after saving.
3. Light theme: implement the light mockup by redefining the CSS tokens
   for light mode. Settings → Appearance: Dark / Light / System. No
   component should need changes beyond token usage; fix any hard-coded
   colors you find.
4. Settings page: organize into Profile (display name, banner),
   Appearance, TMDB, Backup & Export, About. Remove or wire up any
   placeholder controls left from M0 (e.g. the top-bar bell/profile).
5. Keyboard shortcuts: Ctrl+K search, Ctrl+N quick add, Ctrl+1..6 sidebar
   pages, Esc closes dialogs. List them in Settings → About.
6. Remember window size/position between launches.

Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

---

## M11 — Polish & quality

```
Read CLAUDE.md and DESIGN.md. Start Milestone M11 (Polish & quality).
First review the whole app against DESIGN.md and my mockups and list the
visual inconsistencies you find, before fixing anything.

1. Visual consistency pass: typography, spacing, radius, colors, empty
   states and loading states on every page. Skeleton loaders instead of
   spinners for poster grids.
2. Motion: page fade-in, card hover lift, dialog open/close, stat
   count-up, all 150–250ms, respecting prefers-reduced-motion.
3. Error handling: a React error boundary with a friendly "Something went
   wrong" screen and a reload button; IPC errors shown as toast messages,
   never silent failures; a local error log file in userData/logs.
4. Tests with Vitest for the logic that must never break: title status
   recomputation, local-date validation, stats calculations (averages
   ignore missing scores), recommendation ranking, journal filters. Use an
   in-memory SQLite database. Add "npm test".
5. Accessibility: keyboard focus visible everywhere, dialogs trap focus,
   images have alt text, color contrast checked in both themes.
6. Performance check with ~1,000 generated titles and ~2,000 entries
   (a dev-only seed script): collection, journal, insights and dashboard
   must stay fast. Add SQL indexes where needed via a NEW migration.

Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

---

## M12 — Windows installer

```
Read CLAUDE.md. Start Milestone M12 (packaging for Windows).

1. App icon: create a proper icon set (.ico for Windows, plus .png) from
   a simple, original film-reel/diary design in the app's purple accent.
   Use it for the window, taskbar and installer.
2. electron-builder config: Windows NSIS installer, app name "CineDiary",
   productName, version from package.json, Start Menu and desktop
   shortcuts, install-per-user (no admin needed).
3. User data must survive reinstalls and updates (stays in
   %APPDATA%\cinediary). Uninstalling must NOT delete my data.
4. Verify the packaged app: migrations run, posters load, fonts load
   offline, TMDB works online, backup/restore works.
5. Add a "Releasing" section to CLAUDE.md: how to bump the version and
   build the installer (npm run build:win).
6. Tag the release as v1.0.0 in git.

Don't modify anything inside docs/. Show me your plan first and wait for my OK.
```

---

## Done = CineDiary v1.0 🎬

Ideas for after v1.0, only if you want them:
- Yearly "Wrapped" summary page (your year in movies and moods)
- Episode-level journal for series (mood per episode)
- Import from Letterboxd / IMDb CSV exports
- OMDb ratings (IMDb / Rotten Tomatoes) next to your own rating
- Sync between two of your own computers via a folder you choose (e.g. OneDrive)
