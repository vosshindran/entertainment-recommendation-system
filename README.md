# StreamFlix — Entertainment Recommendation System

## 1. Project Overview

- **Project name:** StreamFlix — Entertainment Recommendation System
- **Purpose / Objective:** Build a university-level web programming system that recommends entertainment content across movies, TV shows, books, and music by combining user activity signals with external API data.
- **Short description:**
  StreamFlix is a client-server application that enables browsing of entertainment content, user authentication, watchlist management, reviews, search, and personalized recommendations. It uses a Node.js + Express backend, MongoDB via Mongoose, and a responsive vanilla JavaScript frontend.
- **Main target users:**
  - Students and evaluators reviewing a web programming project.
  - General entertainment consumers wanting discovery and recommendations.
  - Registered users who want personalized watchlists and review history.

## 2. Tech Stack

| Layer | Technologies / Packages | Files / Locations |
|---|---|---|
| Frontend | HTML5, CSS3, Bootstrap 5.3, Vanilla JavaScript | `frontend/index.html`, `frontend/pages/*.html`, `frontend/js/*.js` |
| Backend | Node.js, Express.js, express-session, bcrypt, node-fetch | `backend/server.js`, `backend/*` |
| Database | MongoDB, Mongoose | `backend/db.js`, `backend/models.js` |
| API Integration | TMDB, Google Books, Last.fm | `backend/recommendation.js`, `frontend/js/api.js` |
| State Management | Browser `localStorage` | `frontend/js/storage.js` |

## 3. Complete Feature List

| Feature | Description | User Role | Main Files | API Endpoints | Database Models |
|---|---|---|---|---|---|
| User Register | Create new account with hashed password | Guest | `frontend/pages/register.html`, `frontend/js/auth.js`, `backend/server.js` | `POST /api/auth/register` | `User` |
| User Login | Authenticate and create server session | Guest | `frontend/pages/login.html`, `frontend/js/auth.js`, `backend/server.js` | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | `User` |
| Home Browse | Browse trending/top-rated/action/comedy content | Guest/User | `frontend/index.html`, `frontend/js/main.js`, `frontend/js/api.js` | `GET /api/tmdb/*` | None |
| Search | Search content by type and keyword | Guest/User | `frontend/pages/search.html`, `frontend/js/search.js` | `GET /api/search` | `Entertainment`, `SearchHistory` |
| Watchlist | Add/remove backend items to watchlist | User | `frontend/pages/watchlist.html`, `frontend/js/watchlist.js`, `frontend/js/movie.js` | `GET /api/watchlist`, `POST /api/watchlist`, `DELETE /api/watchlist/:id` | `Watchlist` |
| Item Detail | View item detail and poster | Guest/User | `frontend/pages/movie.html`, `frontend/js/movie.js` | `GET /api/item/:id` | `Entertainment` |
| Submit Review | Leave rating and comment on backend item | User | `frontend/pages/movie.html`, `frontend/js/movie.js` | `GET /api/reviews/:entertainment_id`, `POST /api/reviews` | `Review` |
| Personalized Feed | Personalized recommendations for logged-in users | User | `frontend/pages/recommendations.html`, `frontend/js/recommendation.js`, `frontend/js/main.js` | `GET /api/for-you` | `Entertainment`, `Watchlist`, `UserEvent` |
| Similar Recommendation | "More Like This" recommendations on details page | User | `frontend/js/movie.js`, `backend/recommendation.js` | `GET /api/recommend/:id` | `Entertainment`, `Watchlist`, `UserEvent` |
| Event Tracking | Record view, watchlist add, like events | User | `frontend/js/movie.js`, `backend/server.js` | `POST /api/events` | `UserEvent` |
| Theme Toggle | Dark/light mode persisted in browser storage | Guest/User | `frontend/js/app.js`, `frontend/js/storage.js` | None | None |

**User roles:**
- Guest: browse home, search, and view pages.
- Registered user: log in, watchlist, reviews, personalized recommendations.
- Admin: not implemented.

## 4. System Flow

### User flow
1. User opens the application at `http://localhost:3000`.
2. The frontend attempts to render the home page with trending and personalized content.
3. User visits `register.html` to create an account or `login.html` to sign in.
4. On successful login, the backend session is created and frontend user state is stored in `localStorage`.
5. The user performs a search on `search.html`, which calls `GET /api/search`.
6. If logged in, search history is recorded in `SearchHistory` and results may be served from local DB or external APIs.
7. User opens details on `movie.html` using either a backend item (`backendId`) or TMDB item ID (`id`).
8. User adds/removes backend watchlist items, calling `/api/watchlist` endpoints.
9. User submits reviews for backend items via `/api/reviews`.
10. The app records user events via `/api/events` and uses them when generating `/api/for-you` recommendations.

### Admin flow
- No admin flow is implemented in this project.

## 5. Backend Architecture

### Core files
- `backend/server.js` — main Express routes, session setup, search engine, recommendation route handlers.
- `backend/models.js` — Mongoose schemas and the auto-increment counter helper.
- `backend/db.js` — MongoDB connection initializer.
- `backend/recommendation.js` — external API connectors and recommendation helpers.
- `backend/migrate.js` — migration script from the original SQLite dataset.

### Routes and controllers
- `GET /api/tmdb/*` — TMDB proxy endpoint.
- `POST /api/auth/register` — register new users.
- `POST /api/auth/login` — login with credentials.
- `POST /api/auth/logout` — logout and destroy session.
- `GET /api/auth/me` — fetch current user session.
- `GET /api/search` — search backend local DB and external APIs.
- `GET /api/recommend/:id` — fetch "more like this" recommendations.
- `GET /api/watchlist` — fetch user watchlist.
- `POST /api/watchlist` — add item to watchlist.
- `DELETE /api/watchlist/:id` — remove item from watchlist.
- `GET /api/reviews/:entertainment_id` — fetch reviews for an item.
- `POST /api/reviews` — submit a review.
- `GET /api/for-you` — personalized recommendations.
- `POST /api/events` — record user interactions.
- `GET /api/item/:id` — fetch entertainment details.

### Authentication flow
- Sessions are established with `express-session` in `backend/server.js`.
- On login, `req.session.user = { id, username }`.
- Protected routes check `req.session.user` before performing actions.
- There is no separate authentication middleware function; checks are done inline.

### Frontend/backend/database communication
- Frontend pages call backend API endpoints using `fetch()`.
- Backend reads/writes MongoDB via Mongoose models.
- External APIs are accessed through backend proxy or fetch helper functions.

## 6. Database Information

### Models and schema fields

#### `User`
- Fields: `id`, `username`, `email`, `password`, `created_at`
- Validation: unique `username`, unique `email`, required password.
- Purpose: store registered user credentials.
- CRUD: creation via `POST /api/auth/register`; read via login and session validation.

#### `Entertainment`
- Fields: `id`, `type`, `external_id`, `title`, `description`, `poster_url`, `release_year`, `genre`, `extra`
- Validation: required `id`, `type`, `title`.
- Purpose: local cache of entertainment items to avoid repeated external fetches.
- CRUD: created by search fallback and recommendation ingestion; read in search, item detail, and recommendation routes.

#### `Watchlist`
- Fields: `id`, `user_id`, `entertainment_id`, `added_at`, `watched`
- Validation: required `user_id`, `entertainment_id`; unique index on `(user_id, entertainment_id)`.
- Purpose: store saved items for each user.
- CRUD: add via `POST /api/watchlist`, read via `GET /api/watchlist`, delete via `DELETE /api/watchlist/:id`.

#### `Review`
- Fields: `id`, `user_id`, `entertainment_id`, `rating`, `comment`, `created_at`
- Validation: `rating` must be integer between 1 and 5.
- Purpose: store user reviews for entertainment.
- CRUD: add via `POST /api/reviews`, read via `GET /api/reviews/:entertainment_id`.

#### `SearchHistory`
- Fields: `id`, `user_id`, `type`, `keyword`, `searched_at`
- Purpose: store user search activity for personalization.
- CRUD: created in `GET /api/search` for logged-in users.

#### `UserEvent`
- Fields: `id`, `user_id`, `entertainment_id`, `event_type`, `created_at`
- Validation: `event_type` must be `view`, `watchlist_add`, or `like`.
- Purpose: capture user behavior for recommendation scoring.
- CRUD: created via `POST /api/events`; read in `GET /api/for-you`.

#### `Counter`
- Fields: `_id`, `seq`
- Purpose: auto-increment IDs for all other collections.
- CRUD: incremented by `getNextSequenceValue` in `backend/models.js`.

### CRUD operations in code
- Create: `register`, `watchlist`, `review`, `event`, `recommendation` ingestion, `search_history`
- Read: `auth/me`, `item/:id`, `search`, `reviews`, `watchlist`, `for-you`
- Update: `Counter` sequences and session state.
- Delete: `DELETE /api/watchlist/:id`

## 7. Testing Support Documentation

### 7.1 Unit Testing Candidates

1. `getNextSequenceValue`
   - File: `backend/models.js`
   - Test: verify sequence increments and returns correct next value.

2. Search query builder logic in `/api/search`
   - File: `backend/server.js`
   - Test: ensure query object contains type, title regex, and optional genre regex.

3. Password hashing and comparison
   - File: `backend/server.js`
   - Test: `bcrypt.hash` / `bcrypt.compare` success for matching password.

4. `fetchFromAPI()` external URL builder
   - File: `backend/server.js`
   - Test: verify correct TMDB / Google Books / Last.fm endpoint chosen based on type.

5. `upsertItems()` insertion logic
   - File: `backend/recommendation.js`
   - Test: existing `external_id` returns existing item; new item creates a record.

6. Genre scoring formula in `/api/for-you`
   - File: `backend/server.js`
   - Test: genre weights vary with watchlist and event data.

7. `localStorage` wrapper functions
   - File: `frontend/js/storage.js`
   - Test: add/remove watchlist, add reviews, set theme mode.

8. Navbar render selection
   - File: `frontend/js/app.js`
   - Test: logged-in vs guest HTML contains correct links.

9. Review validation on backend
   - File: `backend/server.js`
   - Test: invalid rating values return HTTP 400.

10. Movie detail loader selector
    - File: `frontend/js/movie.js`
    - Test: loading by `backendId` triggers backend item fetch; loading by `id` triggers TMDB fetch.

### 7.2 Functional Testing Candidates

| Test Case | Feature | Steps | Input | Expected Result |
|---|---|---|---|---|
| 1 | Register user | Open register page, fill form, submit | username/email/password | Success response and redirect to homepage/login |
| 2 | Login user | Open login page, submit credentials | username/password | Session established, navbar shows username |
| 3 | Search content | Open search page with query and type | `q=matrix`, `type=movie` | Results grid displays items |
| 4 | Add backend watchlist item | Open backend item detail, click watchlist | `backendId` | Added message and item returned by `/api/watchlist` |
| 5 | Remove watchlist item | On detail page click remove | backend item id | Item removed and watchlist count updates |
| 6 | Submit review | In detail page submit rating/comment | rating 4, comment text | Review appears in review list |
| 7 | Load personalized recommendations | Logged-in user open recommendations page | none | Items displayed or fallback message |
| 8 | Theme switching | Click theme toggle | toggle button | Dark/light theme changes and persists |
| 9 | Logout | Click logout | none | Session ends and navbar changes to Sign In |
| 10 | Invalid search handling | Call search without `q` | missing query | 400 error response |
| 11 | Event tracking | Open backend detail page | backend item id | `UserEvent` created with `view` |
| 12 | TMDB proxy | Load homepage or `api.js` call | trending request | Backend proxies TMDB response successfully |
| 13 | Local review page | After review open `reviews.html` | logged-in user | review appears from localStorage |
| 14 | Watchlist page display | Open `/pages/watchlist.html` | logged-in user | items from localStorage display |
| 15 | Item detail load fallback | Open `/pages/movie.html?id=...` | TMDB ID | page displays external movie details |

### 7.3 Integration Testing Candidates

- **Frontend ↔ Backend**
  - Login form submits to `/api/auth/login`; backend session returns user and frontend sets local state.
  - Search page calls `/api/search` and renders results in `frontend/js/search.js`.
  - Watchlist add/remove calls backend endpoints and updates user-specific data.

- **Backend ↔ Database**
  - `/api/reviews` writes to `Review`; `/api/reviews/:entertainment_id` reads them.
  - `/api/for-you` reads `Watchlist`, `UserEvent`, and candidate `Entertainment`.
  - `/api/search` may save `SearchHistory`.

- **API ↔ Authentication**
  - Protected endpoints enforce `req.session.user` and return 401 for unauthenticated requests.

- **Multi-module workflows**
  - Search → DB fallback → external API fetch → `Entertainment` insertion → watchlist add → event creation → personalized recommendation generation.

### 7.4 Database Testing Candidates

- Validate `User` creation via registration.
- Verify `Watchlist` item creation and deletion.
- Confirm `Review` validations and retrieval.
- Ensure `SearchHistory` only stores records for logged-in searches.
- Ensure `UserEvent` only stores valid event types.
- Confirm `Counter` increments after each insert.
- Verify `Entertainment` fallback insertion from external APIs.

## 8. Screenshots Checklist

### Unit testing
- `getNextSequenceValue()` behavior.
- Search query builder logic.
- Password hashing and comparison.
- `storage.js` watchlist add/remove.
- Navbar render for authenticated/guest state.

### Functional testing
- Register page success.
- Login page success.
- Search results display.
- Watchlist add/remove.
- Review submission.
- Recommendations page.
- Theme toggle.
- Logout.
- Invalid input handling.

### Backend architecture
- `backend/server.js` route sections.
- `backend/models.js` schemas.
- `backend/recommendation.js` external API logic.
- `backend/migrate.js` migration operations.

### Database operations
- Collections visible in MongoDB.
- Exported JSON from `mongoexport`.
- Created `SearchHistory` and `UserEvent` documents.

### CRUD operations
- User creation.
- Watchlist creation.
- Review creation.
- Watchlist deletion.
- Item detail retrieval.

### Error handling
- `GET /api/search` with missing params.
- `POST /api/reviews` invalid rating.
- Unauthenticated `/api/watchlist` access.
- Root redirect bug evidence.

## 9. Environment Setup

### Installation
1. Clone repository.
2. Navigate to root.
3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
4. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
5. Populate `.env`:
   ```env
   PORT=3000
   SESSION_SECRET=your_secret_session_key
   MONGODB_URI=mongodb://localhost:27017/streamflix
   TMDB_API_KEY=your_tmdb_api_key_here
   GOOGLE_BOOKS_API_KEY=your_google_books_api_key_here
   LASTFM_API_KEY=your_lastfm_api_key_here
   ```

### Run backend
```bash
cd backend
npm start
```

### Run frontend
- The frontend is served by the backend from `frontend/`.
- Open `http://localhost:3000/index.html` in a browser.

### Run database
- Start MongoDB locally.
- Optional migration from SQLite dataset:
  ```bash
  cd backend
  node migrate.js
  ```

### Localhost URLs
- Home: `http://localhost:3000/index.html`
- Login: `http://localhost:3000/pages/login.html`
- Register: `http://localhost:3000/pages/register.html`
- Search: `http://localhost:3000/pages/search.html?q=matrix&type=movie`
- Profile: `http://localhost:3000/pages/profile.html`
- Watchlist: `http://localhost:3000/pages/watchlist.html`
- Recommendations: `http://localhost:3000/pages/recommendations.html`

### Test credentials
- No default credentials are included. Create accounts through the register page.

## 10. Known Limitations and Missing Implementation

- The root route in `backend/server.js` redirects to `/pages/home.html`, but `frontend/pages/home.html` does not exist. The valid entry page is `frontend/index.html`.
- No admin dashboard or admin role exists.
- Profile and reviews pages use browser `localStorage` instead of backend-synced MongoDB state.
- Local storage watchlist functions are separate from backend watchlist endpoints, causing inconsistent state for TMDB versus backend items.
- `database/schema.sql` is empty and not used in the current implementation.
- No automated tests are present in the repository.

---

**This README is based exclusively on the actual codebase, dependencies, routes, models, frontend pages, and project structure present in this repository.**
- **Express.js**: Lightweight REST API builder and static file server.
- **MongoDB & Mongoose**: Document-oriented NoSQL database and Object Data Modeling (ODM) layer.
- **Express-Session**: Server-side user session management.
- **Bcrypt**: Salted password hashing.
- **Node-Fetch**: External API requests mapping.

---

## 4. Installation & Environment Setup

### Prerequisites
- Install [Node.js](https://nodejs.org/) (Version 16.x or higher).
- Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) locally.

### Step 1: Install Dependencies
Open your terminal, navigate to the `backend` directory, and install dependencies:
```bash
cd backend
npm install
```

### Step 2: Environment Configuration
1. Go to the project root directory.
2. Copy the `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open the `.env` file and configure your settings:
   ```env
   PORT=3000
   SESSION_SECRET=your_secret_session_key
   MONGODB_URI=mongodb://localhost:27017/streamflix
   
   # Optional: Configure API keys for live web fetches
   TMDB_API_KEY=your_tmdb_key_here
   GOOGLE_BOOKS_API_KEY=your_google_books_key_here
   LASTFM_API_KEY=your_lastfm_key_here
   ```

---

## 5. MongoDB Setup & Data Migration

### Step 1: Start MongoDB
Ensure that your MongoDB server is running. On Windows, it usually runs automatically as a system service. If not, start it manually:
```cmd
net start MongoDB
```
*(Or run `mongod` from your MongoDB bin directory).*

### Step 2: Execute SQLite-to-MongoDB Migration
We have provided a fully automated migration script to parse the seeded SQLite data (`backend/entertainment.db`) and transfer all records into MongoDB while maintaining original relational integrity:
```bash
cd backend
node migrate.js
```
The console will display migration counts for all collections:
```text
--- STARTING DATABASE MIGRATION (SQLite -> MongoDB) ---
Reading from SQLite database: .../backend/entertainment.db
Connecting to MongoDB at: mongodb://localhost:27017/streamflix
Clearing existing MongoDB collections to prevent duplicates...
Migrating "entertainment" table...
Migrated 138 entertainment items.
Migrating "users" table...
Migrated 4 users.
Migrating "watchlist" table...
Migrated 6 watchlist records.
Migrating "reviews" table...
Migrated 1 reviews.
Migrating "search_history" table...
Migrated 1 search history entries.
Migrating "user_events" table...
Migrated 15 user events.

Migration completed successfully. SQLite database converted to MongoDB.
```

---

## 6. Running the Project

To launch the Express.js server:
```bash
cd backend
npm start
```
The server will boot and display:
```text
Connected to MongoDB at mongodb://localhost:27017/streamflix
Server running on http://localhost:3000
```
Open your browser and navigate to `http://localhost:3000` to interact with the application.

---

## 7. API Documentation

### Authentication Endpoints
- **POST `/api/auth/register`**: Register a new user.
  - *Body*: `{ "username": "...", "email": "...", "password": "..." }`
- **POST `/api/auth/login`**: Authenticate credentials. Stores session details in cookied memory.
  - *Body*: `{ "username": "...", "password": "..." }`
- **POST `/api/auth/logout`**: Terminate active session and clear cookies.
- **GET `/api/auth/me`**: Get logged-in user profile name.
  - *Response*: `{ "success": true, "username": "..." }`

### Search & Details Endpoints
- **GET `/api/search`**: Search local MongoDB / fallback to APIs based on filter options.
  - *Query Params*: `type` (movie/show/book/music), `q` (keyword), `genre` (optional)
- **GET `/api/item/:id`**: Fetch specific entertainment details by numeric ID.

### Watchlist & Interactive Endpoints
- **GET `/api/watchlist`**: Fetch logged-in user's complete watchlist.
- **POST `/api/watchlist`**: Add an item to the user's watchlist.
  - *Body*: `{ "entertainment_id": 45 }`
- **DELETE `/api/watchlist/:id`**: Remove an item from the user's watchlist by ID.
- **GET `/api/reviews/:entertainment_id`**: Fetch all reviews for an item, sorted newest first.
- **POST `/api/reviews`**: Post a user review.
  - *Body*: `{ "entertainment_id": 45, "rating": 5, "comment": "Excellent!" }`
- **POST `/api/events`**: Track a user interaction (e.g. view, watchlist add, like).
  - *Body*: `{ "entertainment_id": 45, "event_type": "view" }`

### Personalization & Recommendations
- **GET `/api/for-you`**: Get weighted personalized recommendations.
- **GET `/api/recommend/:id`**: Fetch similar items to an ID.

---

## 8. Exporting MongoDB Collections to JSON

To satisfy university project guidelines requiring that MongoDB collections be exportable as JSON, execute the following commands in your shell using the `mongoexport` utility (bundled with [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools)):

```bash
# Export Users
mongoexport --db=streamflix --collection=users --out=users.json --pretty

# Export Entertainment Items
mongoexport --db=streamflix --collection=entertainments --out=entertainment.json --pretty

# Export Watchlist Records
mongoexport --db=streamflix --collection=watchlists --out=watchlist.json --pretty

# Export Reviews
mongoexport --db=streamflix --collection=reviews --out=reviews.json --pretty

# Export Search History
mongoexport --db=streamflix --collection=searchhistories --out=search_history.json --pretty

# Export User Events
mongoexport --db=streamflix --collection=userevents --out=user_events.json --pretty
```

---

## 9. Troubleshooting Guide

- **Error: "EADDRINUSE: port 3000 busy"**
  - Another process is occupying port 3000. StreamFlix will automatically fallback to port 3001, 3002, etc. Simply check your terminal logs for the running URL.
- **Error: "MongoDB connection error: MongooseServerSelectionError"**
  - MongoDB is not running locally. Make sure the service is started by running `net start MongoDB` (Windows CMD) or check your database server logs.
- **Search returns empty results or errors out**
  - Ensure your `.env` contains valid TMDB, Last.fm, and Google Books keys if querying items not already cached in the local database.

---

## 10. WIF2003 Academic Compliance Checklist

- **Client-Side Frontend & Server-Side Backend Split**: Verified. Client assets are hosted in `frontend/`, backend router handles requests in `backend/`.
- **Server-Side Scripting**: Yes, implemented using Node.js & Express.js.
- **Database Engine**: Yes, migrated from SQLite relational tables to MongoDB/Mongoose NoSQL collections.
- **Secure Password Hashing**: Implemented. User passwords are automatically salted and hashed using `bcrypt` (10 rounds) before insertion into MongoDB.
- **Session and Token Handling**: Checked. `express-session` handles active user sessions, verifying restricted routes securely.