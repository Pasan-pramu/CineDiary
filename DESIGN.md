# CineDiary — Design System

> Read this before any UI work. Mockups live in `docs/designs/` — open them for the screen you're building.
> The app should feel like a **personal cinema**: poster-rich, cinematic, warm and calm.
> A mix of streaming app + mood journal + entertainment dashboard. **Never an admin panel.**

---

## 1. Visual feel

- **Dark by default, light available.** Deep navy backgrounds, slightly lighter panels, subtle
  borders. Light mode: soft off-white background, white panels, the same purple/blue accents.
- **Posters are the hero.** Large, sharp, rounded corners, soft shadow, gentle hover lift.
- **Cinematic moments:** a wide hero banner on the dashboard (sunset / silhouette style),
  backdrop images on details pages with a dark gradient fade into the background.
- **Calm, not busy.** Generous spacing, clear hierarchy, one focal point per section.
- **Color carries meaning:** purple/blue = primary & navigation, green = mood improved / positive,
  amber = ratings & stars, red/rose = favorites. Don't use color for decoration only.
- **Motion:** subtle and quick (150–250ms): card hover lift, fade-in on page change,
  number count-up on stat cards. Respect `prefers-reduced-motion`.

## 2. Color tokens (starting point — tune in `index.css`)

All colors are CSS variables in `src/renderer/src/styles/index.css`. Components never hard-code
hex values, `rgb()`, or Tailwind color classes (`text-white`, `bg-black/60`, `shadow-black/40`…).
Dark is the default (`:root`); `:root[data-theme="light"]` overrides every token. The theme
(Settings → Appearance: System / Light / Dark) is applied before the first paint.

**Contrast rules (WCAG AA):** text tokens reach 4.5:1 on background, panel and panel-elevated,
and on their own 15% tint (chips, callouts). `*-icon` tokens are for icon fills and need 3:1;
in light mode the gold star fill keeps a `--color-rating` outline.

| Token (`--color-…` unless noted) | Use | Dark | Light |
|---|---|---|---|
| `background` | app background | `#0B1020` | `#F6F5FB` |
| `sidebar` | sidebar | `#0B1020` | `#FFFFFF` |
| `panel` | cards, panels | `#121A2E` | `#FFFFFF` |
| `panel-elevated` | hover / nested panels | `#18223A` | `#F1F0F8` |
| `input` | form fields | `#18223A` | `#F4F3FA` |
| `border` | subtle borders | `rgba(255,255,255,0.06)` | `rgba(22,26,46,0.10)` |
| `text-primary` | headings, body | `#E8ECF5` | `#161A2E` |
| `text-secondary` | secondary text | `#B1B9CC` | `#3F4660` |
| `text-muted` | metadata, hints | `#8A94AD` | `#5C6480` |
| `accent` | primary purple (buttons, active nav) | `#7656FA` | `#6A4CF0` |
| `accent-hover` | hover on accent buttons | `#6847F0` | `#5536D6` |
| `accent-light` | purple as text / links | `#A895FF` | `#5536D6` |
| `accent-muted` | purple tint behind active items | `rgba(124,92,255,0.18)` | `rgba(106,76,240,0.12)` |
| `accent-blue` | blue icons and bars (not text) | `#3B82F6` | `#2563EB` |
| `on-accent` | text/icons on accent or favorite fills | `#FFFFFF` | `#FFFFFF` |
| `positive` / `positive-icon` | mood up, success (text / icon) | `#22C55E` / `#22C55E` | `#116C31` / `#15963F` |
| `rating` / `rating-icon` | ratings (text, star outline / star fill) | `#F5B932` / `#F5B932` | `#954C09` / `#F2B31B` |
| `favorite` / `favorite-icon` | favorites, mood down (text / heart) | `#F86B86` / `#F43F5E` | `#B50D36` / `#E11D48` |
| `danger` / `danger-surface` | errors, destructive actions | `#FCA5A5` / red 10% | `#B91C1C` / red 8% |
| `overlay` | dialog backdrop | `rgba(4,7,18,0.72)` | `rgba(22,24,48,0.45)` |
| `image-scrim` / `on-image` | controls laid over a poster or photo | navy 72% / white | same (fixed) |
| `--backdrop-opacity` | Title Details backdrop strength | `0.6` | `0.35` |
| `--shadow-poster` / `--shadow-raised` | poster / dialog shadows | black, strong | violet-grey, soft |
| `--lift-hover` | poster hover lift | `-4px` | `-2px` |
| `placeholder-from/via/to/text/subtext` | poster placeholder gradient | violet → navy | light violet → deep violet |
| `logo-surface` | chip behind the TMDB logo | transparent | `#0D253F` |
| `hero-*` | built-in Home banner scene, fade, text | sunset, white text | dawn, dark text |
| `hero-image-*` | fade + text over a custom banner image | dark fade, white text (both themes) | |
| `chart-*` | Recharts series, 8 genre slots, grid | see `index.css` | CVD-checked per theme |
| `chapter-*`, `highlight-*`, `milestone-*` | Timeline (built from the palette above) | | `chapter-teal` set per theme |

Chapter colors used as text go through `chapterTextColor()` (`src/shared/timeline.ts`), which
mixes 20% of `text-primary` in so chips stay readable on their tint.

## 3. Typography

Fonts: **DM Serif Display** (cinematic, for titles) + **Manrope** (everything else).

**Fonts must be bundled locally** (the app works offline): install via npm
`@fontsource/dm-serif-display` and `@fontsource-variable/manrope`. Never load from Google Fonts CDN.

| Element | Font | Size / weight |
|---|---|---|
| Main page titles | DM Serif Display | 32–40px, regular |
| Featured movie title (hero, details page) | DM Serif Display | 28–36px, regular |
| Section headings | Manrope | 18–22px, semibold (600) |
| Body text | Manrope | 14–16px, regular (400) |
| Navigation | Manrope | 13–14px, medium (500) |
| Buttons and forms | Manrope | 14px, semibold (600) |
| Ratings and statistics | Manrope | 22–30px, semibold (600), tabular numbers |
| Metadata and timestamps | Manrope | 12–13px, regular, `--text-muted` |

Define these as reusable Tailwind classes / components (e.g. `PageTitle`, `SectionHeading`)
so sizes stay consistent. DM Serif Display is only used for titles — never body text or UI.

## 4. Shape & layout

- Corner radius: panels `16px`, cards/posters `12px`, buttons/inputs `10px`, chips `999px`.
- Poster aspect ratio: always **2:3**. Backdrops: **16:9**.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48. Panels use 24px padding.
- Sidebar fixed ~240px; content max-width ~1440px, centered on very wide screens.
- Must look good from 1100px window width up to large monitors.

## 5. Shared components (build once, reuse everywhere)

- `PosterCard` — poster (or placeholder), title, meta line, rating; hover lift.
- `PosterPlaceholder` — gradient + title initials, used whenever a poster is missing.
- `StatCard` — icon, label, big number, small trend line (e.g. "+3 this month").
- `MoodBadge` — emoji + label + optional score; `MoodChange` — "4 → 8" with green/red arrow.
- `ReasonChip` — pill for reasons; selectable variant for forms.
- `RatingStars` — display + input.
- `SectionPanel` — panel with heading + optional "View all →".
- `EmptyState` — friendly illustration/icon + one line + action button.

---

## 6. Page map

### Sidebar (main navigation)

| # | Page | Route | Milestone |
|---|---|---|---|
| 1 | Home / Dashboard | `/` | M5 |
| 2 | My Collection | `/collection` | M3 |
| 3 | My Cinema Journal | `/journal` | M4 |
| 4 | Insights | `/insights` | M5 |
| 5 | Discover / For My Mood | `/discover` | Later |
| 6 | My Timeline | `/timeline` | Later |

Plus: a prominent **"+ Add Title"** button in the sidebar (opens Quick Add; the full form is
`/add`), and **Settings** at the bottom of the sidebar. The top bar holds the global search
(Ctrl+K: titles, journal, chapters in a grouped dropdown), the online badge, the light/dark
switch and the avatar — no placeholder controls.
**Keyboard:** Ctrl+K search, Ctrl+N Quick Add, Ctrl+1…6 the sidebar pages, Ctrl+, Settings,
Esc closes dialogs and the search results (list in `src/shared/shortcuts.ts`).
Pages not built yet show a friendly "Coming soon" empty state — never a blank screen.

### Secondary pages & dialogs (not in the main sidebar)

| Page / dialog | Purpose | Where |
|---|---|---|
| Title Details | Full personal page for a title | `/title/:id` |
| Add / Edit Title | Full form | `/add`, `/title/:id/edit` |
| Quick Add | Add a title without leaving the current page | dialog |
| Watchlist | Titles with status Planned | filter view of My Collection |
| Series Progress | Seasons / episodes / completion | section on Title Details |
| Favorites | All-time favorites | filter view of My Collection |
| Settings | Profile, Appearance, TMDB, Backup & Export, About (side navigation) | `/settings` |
| Backup & Export | Export / restore data | section of Settings |

### What each page contains

**1. Home / Dashboard** — personal cinema overview: greeting + hero banner, stat cards,
continue watching / recently watched, recently added, quick-add button, viewing stats,
"a film from your past" memory card, mood-based recommendations.

**2. My Collection** — grid and list views; search by title, genre, year (actor after TMDB);
filter by status (watched/watching/planned/dropped) and Movies/Series; sort by rating,
date watched, recently added.

**3. Film / Series Details** — backdrop + poster, synopsis, genres, cast (after TMDB);
personal rating; status and dates; favorite scenes, characters and quotes; reflections and
lessons; full watch and rewatch history; series progress.

**4. Add / Edit Title** — quick and easy: type, title, poster, year, genres, synopsis,
status, dates, rating, season/episode progress for series, optional notes and mood.

**5. My Cinema Journal** — the unique feature: why I watched, mood before/after,
thoughts and emotional reactions, lessons and favorite moments; entries by date and title.
(This replaces the old "Watch History" page.)

**6. Insights** — totals, hours watched, monthly activity, favorite genres, ratings,
directors (after TMDB), most-watched years, rewatched titles, mood trends, which kinds
of stories I gravitate toward. Period: presets, one life chapter, or a custom date range.
**Feelings:** how I felt before / after and why I watched (count + %, "Not recorded"
always shown), top 5 per month or year as small multiples, sentence insights.
**Life chapters:** one card per chapter (top reasons and feelings, moods, genres, what
helped most) and a side-by-side comparison of 2–3 chapters.

**7. Discover / For My Mood** — "I'm feeling down", "I need motivation", "I want to laugh",
"I want adrenaline", "I want something peaceful", "I want a meaningful story".
Rule-based on my own history; every suggestion explains *why* it matches.

**8. My Timeline** — chronological diary grouped by month/year, life periods, rewatch
milestones and highlights, searchable.

---

## 7. Data implications (schema changes to make when the feature is built)

- `watch_entries.favorite_quote` (text) — for "favorite quotes".
- `titles.backdrop_file` (text) — local backdrop image, same pattern as posters.
- Cast and directors come from TMDB in M6 (store as simple tables or JSON then).
- Always add new columns via a Drizzle migration — never edit an existing migration.
