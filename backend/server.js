import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { getRecommendations, TMDB_GENRES } from './recommendation.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/', (_req, res) => {
    res.redirect('/pages/home.html');
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 15 * 60 * 1000 }
}));

// ----------------- Authentication routes -----------------

app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hash);
        res.json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    req.session.user = { id: user.id, username: user.username };
    res.json({ success: true, username: user.username, message: 'Login successful' });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logout successful' });
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    res.json({ success: true, username: req.session.user.username });
});

// ----------------- Search route -----------------
app.get('/api/search', async (req, res) => {
    const { type, q, genre } = req.query;
    if(!type || !q){
        return res.status(400).json({ success: false, message: 'Missing type or query parameter' });
    }
    const cacheKey = `search_${type}_${q.toLowerCase()}_${(genre || '').toLowerCase()}`;

    // 1. Session cache
    if (req.session[cacheKey] && (Date.now() - req.session[cacheKey].timestamp < 15 * 60 * 1000)){
        return res.json({ success: true, results: req.session[cacheKey].data, source: 'session_cache' });
    }

    // Record search history when user is logged in
    if (req.session.user) {
        db.prepare('INSERT INTO search_history (user_id, type, keyword) VALUES (?, ?, ?)')
          .run(req.session.user.id, type, q);
    }

    // 2. Local DB — filter by title keyword and optionally by genre/category
    let query = 'SELECT * FROM entertainment WHERE type = ? AND LOWER(title) LIKE ?';
    let params = [type, `%${q.toLowerCase()}%`];
    if (genre) {
        query += ' AND LOWER(genre) LIKE ?';
        params.push(`%${genre.toLowerCase()}%`);
    }
    query += ' LIMIT 8';
    const rows = db.prepare(query).all(...params);
    if (rows.length >= 3){
        req.session[cacheKey] = { data: rows, timestamp: Date.now() };
        return res.json({ success: true, results: rows, source: 'local_db' });
    }

    // 3. External API
    try {
        const apiResults = await fetchFromAPI(type, q);

        for (const item of apiResults){
            const existing = db.prepare(
                'SELECT * FROM entertainment WHERE type = ? AND external_id = ?'
            ).get(item.type, String(item.external_id));

            if (existing) {
                item.id = existing.id;
            } else {
                const info = db.prepare(`
                    INSERT INTO entertainment (type, external_id, title, description, poster_url, release_year, genre, extra)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    item.type,
                    String(item.external_id),
                    item.title,
                    item.description,
                    item.poster_url,
                    item.release_year,
                    item.genre,
                    JSON.stringify(item.extra || {})
                );
                item.id = info.lastInsertRowid;
            }
        }

        req.session[cacheKey] = { data: apiResults, timestamp: Date.now() };
        res.json({ success: true, results: apiResults, source: 'external_api' });
    }catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching from external API', error: err.message });
    }
});

// ----------------- Recommendations route -----------------
app.get('/api/recommend/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    try {
        const results = await getRecommendations(req.params.id, req.session.user.id);
        res.json({ results });
    } catch (err) {
        console.error('Recommendation error:', err);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});


// ----------------- Watchlist route -----------------
app.get('/api/watchlist', (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const items = db.prepare(`
        SELECT e.* FROM watchlist w
        JOIN entertainment e ON w.entertainment_id = e.id
        WHERE w.user_id = ? 
    `).all(req.session.user.id);
    res.json({ success: true, watchlist: items });
});

app.post('/api/watchlist', (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const { entertainment_id } = req.body;
    try {
        db.prepare('INSERT OR IGNORE INTO watchlist (user_id, entertainment_id) VALUES (?, ?)'
        ).run(req.session.user.id, entertainment_id);
        res.json({ success: true, message: 'Added to watchlist' });
    }
    catch (err) {
        res.status(400).json({ success: false, message: 'Already in watchlist or invalid entertainment ID' });
    }
});

app.delete('/api/watchlist/:id', (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const { id } = req.params;
    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND entertainment_id = ?'
    ).run(req.session.user.id, id);
    res.json({ success: true, message: 'Removed from watchlist' });
});

// =----------------- Review route -----------------
app.get('/api/reviews/:entertainment_id', (req, res) => {
    const { entertainment_id } = req.params;
    const reviews = db.prepare(`
        SELECT r.*, u.username FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.entertainment_id = ?
        ORDER BY r.created_at DESC
    `).all(entertainment_id);
    res.json({ success: true, reviews });
});

app.post('/api/reviews', (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const { entertainment_id, rating, comment } = req.body;
    if (!entertainment_id || !Number.isInteger(Number(entertainment_id))) {
        return res.status(400).json({ success: false, message: 'Invalid entertainment_id' });
    }
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }
    db.prepare(`
        INSERT INTO reviews (user_id, entertainment_id, rating, comment)
        VALUES (?, ?, ?, ?)
    `).run(req.session.user.id, Number(entertainment_id), r, comment ?? null);
    res.json({ success: true, message: 'Review submitted' });
});

// ----------------- API Fetcher -----------------
async function fetchFromAPI(type, query){
    const fetch = (await import('node-fetch')).default;

    if (type === 'movie' || type === 'show'){
        const searchType = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.results || []).slice(0, 8).map(m => ({
            type,
            external_id: String(m.id),
            title: m.title || m.name,
            description: m.overview,
            poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
            release_year: (m.release_date || m.first_air_date) ? String(new Date(m.release_date || m.first_air_date).getFullYear()) : null,
            genre: m.genre_ids ? m.genre_ids.map(id => TMDB_GENRES[id]).filter(Boolean).join(', ') : null,
            extra: {
                vote_average: m.vote_average || 0,
                popularity:   m.popularity   || 0
            }
        }));
    }

    if (type === 'book'){
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&key=${process.env.GOOGLE_BOOKS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.items || []).slice(0, 8).map(b => ({
            type,
            external_id: b.id,
            title: b.volumeInfo.title,
            description: b.volumeInfo.description || null,
            poster_url: b.volumeInfo.imageLinks ? b.volumeInfo.imageLinks.thumbnail : null,
            release_year:b.volumeInfo.publishedDate?.split('-')[0] || null,
            genre:  b.volumeInfo.categories?.[0] || null,
            extra: {
                authors: b.volumeInfo.authors?.[0] || [],
            }
        }));
    }

    if (type === 'music'){
        const url = `http://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${process.env.LASTFM_API_KEY}&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.results?.trackmatches?.track || []).slice(0, 8).map(t => ({
            type,
            external_id: t.mbid || `${t.artist}-${t.name}`,
            title: `${t.artist} - ${t.name}`,
            description: null,
            poster_url: t.image?.[2]['#text'] || null,
            release_year: null,
            genre: null,
            extra: {
                artist: t.artist,
                track: t.name
            }
        }));
    }

    return [];
}

// ----------------- Detail route -----------------
app.get('/api/item/:id', (req, res) => {
    const item = db.prepare(
        'SELECT * FROM entertainment WHERE id = ?'
    ).get(req.params.id);

    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
});

// ----------------- Start server -----------------
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

