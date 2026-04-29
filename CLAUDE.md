# StreamFlix — Recommendation System Architecture

## System Overview

StreamFlix is a movie recommendation web app. The recommendation engine has two layers:

1. **For-You feed** (`/api/for-you`) — personalised homepage row scored from the user's watchlist genres and view/watchlist-add event history against the local `entertainment` DB table.
2. **More Like This** (`/api/recommend/:id`) — item-level recommendations fetched live from TMDB's own recommendation API, upserted into the local DB, then filtered and re-ranked by rating.

All TMDB API calls from the frontend are proxied through `/api/tmdb/*` — the API key never reaches the client.

---

## File Map (Recommendation-Relevant Only)

```
backend/
  db.js                — SQLite schema; creates all tables and indexes on startup
  recommendation.js    — getRecommendations() + TMDB_GENRES map; powers /api/recommend/:id
  server.js            — all API routes including /api/for-you, /api/events, /api/tmdb/*

frontend/
  js/api.js            — client TMDB wrapper; all calls go to /api/tmdb/* proxy
  js/main.js           — home page logic; loads for-you row + TMDB rows
  js/movie.js          — movie detail page; handles both ?id= (TMDB) and ?backendId= (local DB)
  js/recommendation.js — recommendations.html page logic; for-you section + genre browser
  js/app.js            — shared navbar, createBackendCard, createMovieCard helpers
```

---

## Database Schema (Recommendation-Relevant Tables)

### `entertainment`
The local item catalogue. Populated on-demand by search and recommendation upserts.
```sql
id           INTEGER PRIMARY KEY
type         TEXT              -- 'movie' | 'show' | 'music' | 'book'
external_id  TEXT              -- TMDB id (movies/shows), mbid (music), Google Books id
title        TEXT
description  TEXT
poster_url   TEXT
release_year TEXT
genre        TEXT              -- comma-separated, e.g. "Action, Adventure, Sci-Fi"
extra        TEXT              -- JSON blob: { tmdb_rating, tmdb_popularity, vote_average, ... }
```

### `watchlist`
User-saved items. Genre tokens from joined `entertainment` rows are weighted ×2 in for-you scoring.
```sql
user_id          INTEGER  -- FK → users
entertainment_id INTEGER  -- FK → entertainment
watched          INTEGER DEFAULT 0
added_at         TEXT
```

### `user_events`
Behavioural signals. Genre tokens weighted ×1 in for-you scoring (30-day rolling window).
```sql
user_id          INTEGER  -- FK → users
entertainment_id INTEGER  -- FK → entertainment
event_type       TEXT     -- 'view' | 'watchlist_add' | 'like'
created_at       TEXT
```

### `search_history`
Raw keyword log. Used as a secondary signal in the legacy for-you path.
```sql
user_id     INTEGER
type        TEXT     -- 'movie' | 'show' | 'music' | 'book'
keyword     TEXT
searched_at TEXT
```

### Indexes
```sql
idx_user_events_user          ON user_events(user_id)
idx_entertainment_type_genre  ON entertainment(type, genre)
idx_search_history_user       ON search_history(user_id)
```

---

## How the `entertainment` Table Gets Populated

The table starts empty. Rows are added in two ways:

**1. User searches (`/api/search`)**
```
User submits search on search.html
  → GET /api/search?type=movie&q=<query>
  → server checks session cache → local DB (title LIKE) → TMDB search API
  → TMDB results mapped and upserted into entertainment table
  → keyword recorded in search_history
```

**2. "More Like This" recommendations (`/api/recommend/:id`)**
```
User opens movie.html?backendId=<id>
  → GET /api/recommend/:id
  → getRecommendations() calls TMDB /{type}/{externalId}/recommendations
  → results upserted into entertainment via upsertItems()
  → newly upserted items now available for future for-you scoring
```

---

## For-You Feed (`/api/for-you`)

### Signal Collection
```
Watchlist genres  →  JOIN watchlist + entertainment  →  each genre token += 2
Event genres      →  JOIN user_events + entertainment (last 30 days)  →  each genre token += 1
```

Example: user has "Inception" (Action, Sci-Fi) on watchlist and viewed "The Matrix" (Action, Sci-Fi):
```
Action: 2 (watchlist) + 1 (view) = 3
Sci-Fi: 2 (watchlist) + 1 (view) = 3
```

### Scoring
```
genre_score  = Σ(genre_weights for item's genres) / (max_weight × 2)   → clamped [0, 1]
rating_score = extra.tmdb_rating / 10                                    → clamped [0, 1]

final_score  = genre_score × 0.6 + rating_score × 0.4    (when preferences exist)
             = rating_score                                (cold start: no prefs yet)
```

### Candidate Selection
- Pulls up to 300 rows from `entertainment` matching requested `type`
- Excludes all items already in the user's watchlist
- Filters out items with score = 0 when preferences exist
- Falls back to pure rating sort if genre filter eliminates all candidates
- Returns top 20, `_score` field stripped before response

### Frontend Behaviour (main.js)
```
GET /api/for-you?type=movie
  → results.length > 0  →  render "You May Like" using createBackendCard()
  → results.length === 0 (empty DB)  →  fetch TMDB trending, render "Popular Right Now"
  → results === null (not logged in)  →  section stays hidden
```

---

## More Like This (`/api/recommend/:id`)

Handled entirely in `backend/recommendation.js`.

```
GET /api/recommend/:id  (auth required)
  → fetch item from entertainment WHERE id = ?
  → call getTMDBRecommendations(item.type, item.external_id)
      → GET https://api.themoviedb.org/3/{type}/{externalId}/recommendations
      → map results to entertainment schema
      → upsertItems(): SELECT existing OR INSERT new → returns rows with DB ids
  → fallback if TMDB returns nothing:
      SELECT * FROM entertainment WHERE type = ? AND genre LIKE ? AND id != ?
  → filter: remove current item, user's watchlist items, duplicates
  → sort by tmdb_rating DESC
  → return top 30
```

`TMDB_GENRES` map (id → name string) is exported from `recommendation.js` and used in `server.js`'s `fetchFromAPI` to populate `entertainment.genre` during searches.

---

## Event Tracking (`/api/events`)

```
POST /api/events  { entertainment_id: int, event_type: "view"|"watchlist_add"|"like" }
  → auth required (session)
  → INSERT INTO user_events
```

Events fired from `movie.js`:
| Action | Event fired |
|---|---|
| Page load with `?backendId=` | `view` |
| Add to watchlist (backendId item) | `watchlist_add` |

Events are fire-and-forget (`catch(() => {})`). A failed event write does not surface to the user. Only events from the last 30 days count in for-you scoring.

---

## TMDB Proxy (`/api/tmdb/*`)

All frontend TMDB calls go through this wildcard proxy. The TMDB API key is injected server-side.

```
GET /api/tmdb/trending/movie/week
GET /api/tmdb/movie/top_rated
GET /api/tmdb/discover/movie?with_genres=28
GET /api/tmdb/genre/movie/list
GET /api/tmdb/movie/:id?append_to_response=credits,videos
```

`frontend/js/api.js` calls `fetchAPI(endpoint, params)` which builds `/api/tmdb${endpoint}?${params}`. No API key is ever sent from the client.

---

## Page-by-Page Recommendation Flow

### `index.html`
```
DOMContentLoaded (main.js)
  ├── loadForYouRow()          → GET /api/for-you?type=movie  (personalised or TMDB fallback)
  ├── getTrendingMovies()      → GET /api/tmdb/trending/movie/week
  ├── getTopRatedMovies()      → GET /api/tmdb/movie/top_rated
  ├── getActionMovies()        → GET /api/tmdb/discover/movie?with_genres=28
  └── getComedyMovies()        → GET /api/tmdb/discover/movie?with_genres=35
```
Cards from for-you use `createBackendCard()` → link to `pages/movie.html?backendId=<id>`.
Cards from TMDB rows use `createMovieCard()` → link to `pages/movie.html?id=<tmdbId>`.

### `pages/search.html`
```
User submits search form
  → GET /api/search?type=movie&q=<query>
  → results rendered with createBackendCard() → link to movie.html?backendId=<id>
  → side effect: entertainment table seeded, search_history recorded
```

### `pages/movie.html?backendId=<id>` (local DB item)
```
DOMContentLoaded (movie.js)
  ├── GET /api/item/:id                     → fetch item details from local DB
  ├── POST /api/events { event_type: view } → record view signal (fire-and-forget)
  ├── GET /api/watchlist                    → check if item is already in watchlist
  ├── GET /api/reviews/:id                  → load reviews from DB
  └── GET /api/recommend/:id               → load "More Like This" row (auth required)

Watchlist toggle:
  ├── POST /api/watchlist { entertainment_id }  + POST /api/events { watchlist_add }
  └── DELETE /api/watchlist/:id

Review submit:
  └── POST /api/reviews { entertainment_id, rating, comment }
```

### `pages/movie.html?id=<tmdbId>` (direct TMDB item)
```
DOMContentLoaded (movie.js)
  ├── GET /api/tmdb/movie/:id?append_to_response=credits,videos
  ├── Watchlist → localStorage only (item not in local DB)
  ├── Reviews   → localStorage only
  └── No event tracking, no "More Like This"
```

### `pages/recommendations.html`
```
DOMContentLoaded (recommendation.js)
  ├── GET /api/for-you?type=movie          → "Recommended For You" section (logged-in only)
  ├── GET /api/tmdb/genre/movie/list       → genre buttons
  └── GET /api/tmdb/discover/movie?with_genres=<id>  → genre movie grid (on button click)
```

---

## Cold Start Behaviour

| State | For-You result | UI shown |
|---|---|---|
| Not logged in | `null` (401) | Section hidden |
| Logged in, empty DB | `[]` | "Popular Right Now" (TMDB trending fallback) |
| Logged in, DB has items, no watchlist/events | Items sorted by rating | "You May Like" (rating-only score) |
| Logged in, watchlist + events present | Items scored by genre + rating | "You May Like" (full personalisation) |
