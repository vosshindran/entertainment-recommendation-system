# StreamFlix — Entertainment Recommendation System
### WIF2003 Web Programming (Phase 2 Submission)

StreamFlix is a responsive client-server web application designed to recommend entertainment content (movies, TV shows, books, and music) using personalized user signals (watchlist, reviews, events) combined with external data engines (TMDB, Last.fm, Google Books). 

This version features a **Node.js/Express.js backend** integrated with **MongoDB (via Mongoose)** as the primary database, replacing the original SQLite stack. A complete migration utility is provided to ingest seeded data seamlessly.

---

## 1. Feature List

- **User Authentication**: Secure signup and signin with password hashing (`bcrypt`) and persistent session management.
- **Dynamic Content Discovery**: Unified search across multiple categories (Movies, TV Shows, Books, Music) with local caching.
- **Personalized Recommendations**: 
  - **"More Like This"**: Recommends items based on the current item's metadata (using TMDB, Last.fm, and Google Books APIs).
  - **"Recommended For You"**: Hybrid recommendation engine that scores candidates based on weighted genre preferences (Watchlist adds = 2pts, Views/Likes = 1pt each) and popularity/ratings.
- **Watchlist Manager**: Persist books, movies, music, and tv shows.
- **Interactive Review System**: Users can rate content (1 to 5 stars) and write comments, stored in MongoDB.
- **Activity & Search History**: Event tracking to build personalized recommendation profiles.
- **Dark/Light Mode**: Smooth client-side theme toggling.

---

## 2. Folder Structure Explanation

```text
entertainment-recommendation-system/
├── .env.example             # Template for local environment configuration
├── .env                     # Local active environment variables (Ignored by git)
├── .gitignore               # Excluded files list
├── README.md                # Submission & architectural documentation (This file)
├── database/
│   └── schema.sql           # Original SQLite schema reference
├── frontend/                # Client-Side Assets (HTML5, CSS, Vanilla JS, Bootstrap)
│   ├── css/
│   │   ├── styles.css       # Core layout styling
│   │   └── darkmode.css     # Dark mode styling tokens
│   ├── js/
│   │   ├── api.js           # Client-side TMDB proxy & recommendation API bindings
│   │   ├── app.js           # App shell (Theme, shared navigation navbar generator)
│   │   ├── auth.js          # Client-side user auth state handlers
│   │   ├── main.js          # Homepage carousel and card bindings
│   │   ├── movie.js         # Movie details, reviews, watchlist buttons
│   │   ├── profile.js       # Profile page metrics (watchlist count, review count)
│   │   ├── recommendation.js# Genre browsing & personalised recommendation layout
│   │   ├── reviews.js       # User review listings
│   │   ├── search.js        # Search page render grid
│   │   └── storage.js       # LocalStorage helper wrapper
│   ├── pages/               # Semantic HTML pages
│   │   ├── login.html
│   │   ├── movie.html
│   │   ├── profile.html
│   │   ├── recommendations.html
│   │   ├── register.html
│   │   ├── reviews.html
│   │   ├── search.html
│   │   └── watchlist.html
│   └── index.html           # Main application entrance
└── backend/                 # Server-Side Scripting & Database Layer (Express.js & MongoDB)
    ├── db.js                # MongoDB Mongoose database connection client
    ├── models.js            # Mongoose Schemas & Models (User, Watchlist, Review, Counter)
    ├── migrate.js           # SQLite-to-MongoDB data migration utility
    ├── recommendation.js    # Recommendation algorithms & TMDB/Last.fm API fetch client
    ├── server.js            # Express application routing, controllers, and proxy engine
    ├── package.json         # Node package configuration and server scripts
    └── entertainment.db     # Original SQLite database file (Used for migration)
```

---

## 3. Technology Stack

### Client-Side (Frontend)
- **HTML5**: Semantic web architecture.
- **Vanilla CSS3**: Layout, grid layouts, fluid transitions, and glassmorphism templates.
- **Bootstrap 5.3**: Layout grids, forms, responsive containers, and buttons.
- **Vanilla JavaScript (ES6+)**: Asynchronous fetch handlers, client-side caching, and dynamic DOM manipulation.

### Server-Side (Backend)
- **Node.js**: Asynchronous server environment.
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