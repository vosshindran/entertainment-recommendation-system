import Database from 'better-sqlite3';

const db = new Database(process.env.NODE_ENV === 'test' ? ':memory:' : 'entertainment.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS entertainment (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        type        TEXT NOT NULL,
        external_id TEXT,
        title       TEXT NOT NULL,
        description TEXT,
        poster_url  TEXT,
        release_year YEAR,
        genre       TEXT,
        extra       TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT UNIQUE NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watchlist (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id          INTEGER NOT NULL,
        entertainment_id INTEGER NOT NULL,
        added_at         TEXT DEFAULT (datetime('now')),
        watched          INTEGER DEFAULT 0,
        UNIQUE (user_id, entertainment_id),
        FOREIGN KEY (user_id)          REFERENCES users(id),
        FOREIGN KEY (entertainment_id) REFERENCES entertainment(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id          INTEGER NOT NULL,
        entertainment_id INTEGER NOT NULL,
        rating           INTEGER CHECK (rating BETWEEN 1 AND 5),
        comment          TEXT,
        created_at       TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id)          REFERENCES users(id),
        FOREIGN KEY (entertainment_id) REFERENCES entertainment(id)
    );

    CREATE TABLE IF NOT EXISTS search_history (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        type       TEXT,
        keyword    TEXT,
        searched_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_events (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id          INTEGER NOT NULL,
        entertainment_id INTEGER NOT NULL,
        event_type       TEXT NOT NULL CHECK (event_type IN ('view', 'watchlist_add', 'like')),
        created_at       TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id)          REFERENCES users(id),
        FOREIGN KEY (entertainment_id) REFERENCES entertainment(id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_events_user  ON user_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_entertainment_type_genre ON entertainment(type, genre);
    CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
`);

export default db;