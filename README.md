# StreamFlix — Entertainment Recommendation System

A full-stack web application for browsing and discovering entertainment content across movies, TV shows, books, and music. Users can search, manage watchlists, write reviews, and receive personalized recommendations based on their activity.

---

## Project Overview

**Objective:** Build a comprehensive web application that demonstrates modern full-stack development practices with a focus on user authentication, database management, API integration, and personalized recommendation algorithms.

**Target Users:**
- Entertainment enthusiasts seeking discovery tools
- Registered users wanting watchlist management and personalized recommendations
- Academic evaluators assessing web development competency

---

## Key Features

### Core Features
1. **User Authentication** – Register, login, logout with session management and bcrypt password hashing
2. **Content Discovery** – Browse trending, top-rated, action, and comedy content from TMDB
3. **Search** – Search across multiple content types (movies, TV shows, books, music) with local and external API fallback
4. **Watchlist Management** – Add, remove, and view saved entertainment items
5. **Reviews & Ratings** – Submit and view user reviews with 1-5 star ratings
6. **Personalized Recommendations** – Weighted algorithm using user watchlist, search history, and events
7. **Theme Persistence** – Dark/light mode toggle with local storage persistence
8. **Event Tracking** – Record user interactions (views, watchlist adds, likes) for recommendation scoring

### API Integrations
- **TMDB** – Movie and TV show data, images, and recommendations
- **Google Books API** – Book search and metadata
- **Last.fm** – Music recommendations and metadata

---

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | HTML5, CSS3, Bootstrap 5.3, Vanilla JavaScript |
| **Backend** | Node.js, Express.js, express-session |
| **Database** | MongoDB with Mongoose ODM |
| **Security** | bcrypt (password hashing), express-session (server-side sessions) |
| **External APIs** | TMDB, Google Books, Last.fm |

---

## Folder Structure

```
.
├── backend/
│   ├── server.js              # Express server, routes, and controllers
│   ├── db.js                  # MongoDB connection
│   ├── models.js              # Mongoose schemas and auto-increment logic
│   ├── recommendation.js      # External API connectors and recommendation algorithms
│   ├── migrate.js             # Legacy SQLite-to-MongoDB migration helper
│   ├── package.json           # Backend dependencies
│   └── package-lock.json      # Dependency lock file
├── frontend/
│   ├── index.html             # Home page with trending content
│   ├── css/
│   │   ├── styles.css         # Main stylesheet
│   │   └── darkmode.css       # Dark mode theme
│   ├── js/
│   │   ├── app.js             # Global app initialization and navbar
│   │   ├── api.js             # TMDB API client and image utilities
│   │   ├── auth.js            # Authentication UI handlers
│   │   ├── main.js            # Home page content loader
│   │   ├── search.js          # Search functionality
│   │   ├── movie.js           # Movie detail page and recommendations
│   │   ├── watchlist.js       # Watchlist page handler
│   │   ├── profile.js         # User profile page
│   │   ├── reviews.js         # Review listing
│   │   ├── recommendation.js  # Personalized recommendations page
│   │   └── storage.js         # LocalStorage wrapper for client-side state
│   └── pages/
│       ├── login.html
│       ├── register.html
│       ├── search.html
│       ├── movie.html
│       ├── watchlist.html
│       ├── profile.html
│       ├── reviews.html
│       └── recommendations.html
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

---

## Installation & Setup

### Prerequisites
- **Node.js** (v16+) – [Download](https://nodejs.org/)
- **MongoDB** (Community Edition) – [Download](https://www.mongodb.com/try/download/community)

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Environment Configuration
Copy the example environment file and configure your settings:
```bash
cp .env.example .env
```

Edit `.env` with the following variables:
```env
PORT=3000
SESSION_SECRET=your_secret_session_key_here
MONGODB_URI=mongodb://localhost:27017/streamflix

# External API Keys (required for recommendations and search fallback)
TMDB_API_KEY=your_tmdb_api_key_here
```

Obtain API keys from:
- [TMDB](https://www.themoviedb.org/settings/api)

### Step 3: Start MongoDB
Ensure MongoDB is running:
```bash
# Windows
net start MongoDB

# macOS / Linux
brew services start mongodb-community
# or
mongod
```

### Step 4: Start the Server
```bash
cd backend
npm start
```

The server will start at `http://localhost:3000` and display:
```
Connected to MongoDB at mongodb://localhost:27017/streamflix
Server running on http://localhost:3000
```

### Step 5: Access the Application
Open your browser and navigate to:
- **Home:** `http://localhost:3000`
- **Register:** `http://localhost:3000/pages/register.html`
- **Login:** `http://localhost:3000/pages/login.html`

---

## System Architecture

### Database Models

#### User
Stores user credentials and account information.
- Fields: `id`, `username`, `email`, `password`, `created_at`
- Validation: unique `username` and `email`, required password

#### Entertainment
Caches entertainment items to avoid repeated external API calls.
- Fields: `id`, `type` (movie/show/book/music), `external_id`, `title`, `description`, `poster_url`, `release_year`, `genre`, `extra` (JSON for ratings, votes, etc.)
- Used by: search, recommendations, watchlist, reviews

#### Watchlist
Stores user watchlist items.
- Fields: `id`, `user_id`, `entertainment_id`, `added_at`, `watched`
- Unique index on `(user_id, entertainment_id)` prevents duplicates

#### Review
Stores user reviews and ratings.
- Fields: `id`, `user_id`, `entertainment_id`, `rating` (1-5), `comment`, `created_at`
- Validation: rating must be between 1 and 5

#### SearchHistory
Tracks user searches for personalization.
- Fields: `id`, `user_id`, `type`, `keyword`, `searched_at`
- Indexed on `user_id` for fast lookups

#### UserEvent
Records user interactions for recommendation scoring.
- Fields: `id`, `user_id`, `entertainment_id`, `event_type` (view/watchlist_add/like), `created_at`
- Indexed on `user_id` for quick retrieval

#### Counter
Auto-increment helper for generating numeric IDs.
- Fields: `_id` (collection name), `seq` (current sequence value)

### API Endpoints

#### Authentication
- `POST /api/auth/register` – Create new user account
- `POST /api/auth/login` – Authenticate user and create session
- `POST /api/auth/logout` – Destroy session
- `GET /api/auth/me` – Get current user profile

#### Search & Discovery
- `GET /api/search` – Search local DB or external APIs by type and keyword
- `GET /api/item/:id` – Fetch entertainment item details
- `GET /api/tmdb/*` – TMDB proxy for direct API calls

#### Watchlist & Reviews
- `GET /api/watchlist` – Fetch user's watchlist
- `POST /api/watchlist` – Add item to watchlist
- `DELETE /api/watchlist/:id` – Remove item from watchlist
- `GET /api/reviews/:entertainment_id` – Fetch reviews for item
- `POST /api/reviews` – Submit review for item

#### Recommendations
- `GET /api/for-you` – Personalized recommendations based on user activity
- `GET /api/recommend/:id` – Similar items to given entertainment ID

#### Events
- `POST /api/events` – Track user interaction (view, watchlist_add, like)

---

## User Workflows

### Browsing & Discovery
1. User opens the home page and sees trending/top-rated content from TMDB
2. User can click on any item to view details or search by type and keyword
3. Search results come from local MongoDB cache or external APIs (TMDB, Google Books, Last.fm)

### Authentication & Session
1. User registers with username, email, and password (hashed with bcrypt)
2. User logs in with credentials; session is established server-side
3. Session persists across page refreshes; user is logged out on explicit logout or session expiry
4. Frontend tracks logged-in state in `localStorage`

### Watchlist Management
1. Logged-in user can add items to watchlist via `/api/watchlist`
2. Watchlist is fetched from MongoDB and displayed on watchlist page
3. User can remove items, which calls `DELETE /api/watchlist/:id`

### Reviews & Ratings
1. Logged-in user can submit a review (1-5 stars + comment) for backend items
2. Reviews are stored in MongoDB and displayed sorted by creation date
3. Usernames are resolved from the User collection for display

### Personalized Recommendations
1. System builds genre weights from user's watchlist and recent events (view, watchlist_add)
2. Candidates are scored based on genre match and rating
3. Top 20 items (excluding watchlist and current item) are returned
4. Fallback to rating-only sorting if no genre preferences exist

---

## Development Notes

### Running Locally

The application runs with the following default configuration:
- **Port:** 3000 (or next available if busy)
- **Database:** MongoDB at `mongodb://localhost:27017/streamflix`
- **Session Timeout:** 15 minutes

### Building for Production

For production deployment:
1. Set `NODE_ENV=production`
2. Use environment variables for all secrets
3. Consider adding an authentication middleware wrapper
4. Implement rate limiting and CORS policies
5. Use MongoDB Atlas or managed database service

### Troubleshooting

**Port 3000 is in use:**
The application auto-detects the next available port (3001, 3002, etc.). Check terminal output for the actual running URL.

**MongoDB connection error:**
Ensure MongoDB is running locally:
```bash
# Check MongoDB service status (Windows)
net start MongoDB

# Check MongoDB process (macOS/Linux)
pgrep mongod
```

**Missing API keys:**
The application falls back gracefully if external API keys are missing. Search and recommendations will use cached local data only.

---

## Testing Checklist

### Functional Tests
- [ ] User registration and login
- [ ] User logout
- [ ] Search by content type (movie, show, book, music)
- [ ] Add/remove items from watchlist
- [ ] Submit and view reviews
- [ ] View personalized recommendations
- [ ] Theme toggle persists across sessions
- [ ] TMDB integration loads trending content
- [ ] Invalid inputs return appropriate errors

### Data Validation Tests
- [ ] Duplicate watchlist items are prevented
- [ ] Review ratings must be 1-5
- [ ] Search history recorded only for logged-in users
- [ ] Password hashing works correctly
- [ ] Session timeout works properly

### Browser Compatibility
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Known Limitations

1. **LocalStorage State Management:** Profile and reviews pages use browser `localStorage` instead of backend MongoDB for some local-only state, causing potential sync issues between pages.

2. **No Admin Dashboard:** Admin functionality is not implemented.

3. **Limited Personalization:** Recommendation algorithm uses simple genre matching and ratings; collaborative filtering not implemented.

4. **Single-User Sessions:** No support for concurrent sessions across devices.

5. **Rate Limiting:** No API rate limiting implemented; external APIs may throttle requests.

---

## Database Export (for Academic Submission)

To export MongoDB collections to JSON for submission:

```bash
# Ensure mongod is running, then:
mongoexport --db=streamflix --collection=users --out=users.json --pretty
mongoexport --db=streamflix --collection=entertainments --out=entertainment.json --pretty
mongoexport --db=streamflix --collection=watchlists --out=watchlist.json --pretty
mongoexport --db=streamflix --collection=reviews --out=reviews.json --pretty
mongoexport --db=streamflix --collection=searchhistories --out=search_history.json --pretty
mongoexport --db=streamflix --collection=userevents --out=user_events.json --pretty
```

---

## Academic Compliance

- ✅ **Client-Side Frontend:** Responsive HTML5/CSS3/JavaScript in `frontend/`
- ✅ **Server-Side Backend:** Node.js + Express.js in `backend/`
- ✅ **Database Engine:** MongoDB with Mongoose ODM
- ✅ **Secure Authentication:** bcrypt password hashing, express-session
- ✅ **API Integration:** TMDB, Google Books, Last.fm
- ✅ **Source Control:** Git repository with meaningful commit history

---

## Project Structure Rationale

- **Separation of Concerns:** Frontend (`/frontend`) and backend (`/backend`) are logically separated
- **Modular Backend:** Each function (auth, search, recommendations, etc.) is organized by feature
- **Responsive Frontend:** Bootstrap 5.3 ensures mobile and desktop compatibility
- **Stateless API:** Backend routes are RESTful and stateless (session stored server-side)
- **Scalable Database:** MongoDB allows flexible schema for diverse content types

---

## Future Enhancements

1. **Collaborative Filtering:** Implement user-to-user similarity recommendations
2. **Admin Dashboard:** Add admin panel for content moderation
3. **Advanced Search:** Filters for release date, language, runtime, etc.
4. **User Profiles:** Enhanced profile pages with user statistics
5. **API Authentication:** OAuth2 for third-party integrations
6. **Real-Time Notifications:** WebSocket updates for activity feeds
7. **Advanced Analytics:** Aggregate user behavior and recommendation effectiveness

---

## License

This project is created for academic purposes and is not licensed for commercial use.

---

## Contact & Support

For questions or issues, please refer to the project documentation or open an issue in the repository.

---

**Last Updated:** June 2026  
**Version:** 1.0.0 (Final Submission)
