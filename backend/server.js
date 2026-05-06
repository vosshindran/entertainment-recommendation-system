import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import { getRecommendations, TMDB_GENRES } from './recommendation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

// ----------------- TMDB proxy -----------------
// Keeps the API key server-side; the client never sees it.
app.get('/api/tmdb/*', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const endpoint = req.params[0];
    const params = new URLSearchParams(req.query);
    params.set('api_key', process.env.TMDB_API_KEY);
    if (!params.has('language')) params.set('language', 'en-US');
    try {
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${endpoint}?${params}`);
        const data = await tmdbRes.json();
        res.json(data);
    } catch (err) {
        res.status(502).json({ error: 'TMDB proxy error', detail: err.message });
    }
});

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

    // Record search history when user is logged in — skip if same keyword was logged in the last minute
    if (req.session.user) {
        const recent = db.prepare(
            `SELECT id FROM search_history WHERE user_id = ? AND type = ? AND keyword = ?
             AND searched_at > datetime('now', '-1 minute')`
        ).get(req.session.user.id, type, q);
        if (!recent) {
            db.prepare('INSERT INTO search_history (user_id, type, keyword) VALUES (?, ?, ?)')
              .run(req.session.user.id, type, q);
        }
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
        const res  = await fetch(url);
        const data = await res.json();
        const tracks = (data.results?.trackmatches?.track || []).slice(0, 8);

        // Last.fm deprecated image hosting — images are always empty strings.
        // Fall back to iTunes Search API (free, no key needed) for album artwork.
        return await Promise.all(tracks.map(async t => {
            let posterUrl = null;
            try {
                const q = encodeURIComponent(`${t.artist} ${t.name}`);
                const ir = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&entity=musicTrack&limit=1`);
                const id = await ir.json();
                const art = id.results?.[0]?.artworkUrl100;
                if (art) posterUrl = art.replace('100x100bb', '500x500bb');
            } catch {}
            return {
                type,
                external_id: t.mbid || `${t.artist}-${t.name}`,
                title: `${t.artist} - ${t.name}`,
                description: null,
                poster_url: posterUrl,
                release_year: null,
                genre: null,
                extra: {
                    artist: t.artist,
                    track: t.name
                }
            };
        }));
    }

    return [];
}

// ----------------- For-you recommendations route -----------------
app.get('/api/for-you', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const { type } = req.query;
    const userId = req.session.user.id;

    // Build genre preference weights: watchlist=2pts, recent events=1pt each
    const watchlistGenreRows = db.prepare(`
        SELECT e.genre FROM watchlist w
        JOIN entertainment e ON w.entertainment_id = e.id
        WHERE w.user_id = ? AND e.genre IS NOT NULL AND (? IS NULL OR e.type = ?)
    `).all(userId, type || null, type || null);

    const eventGenreRows = db.prepare(`
        SELECT e.genre FROM user_events ue
        JOIN entertainment e ON ue.entertainment_id = e.id
        WHERE ue.user_id = ? AND e.genre IS NOT NULL AND (? IS NULL OR e.type = ?)
        AND ue.created_at > datetime('now', '-30 days')
    `).all(userId, type || null, type || null);

    const genreWeights = {};
    for (const { genre } of watchlistGenreRows) {
        for (const g of genre.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) {
            genreWeights[g] = (genreWeights[g] || 0) + 2;
        }
    }
    for (const { genre } of eventGenreRows) {
        for (const g of genre.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) {
            genreWeights[g] = (genreWeights[g] || 0) + 1;
        }
    }

    const watchlistIds = new Set(
        db.prepare('SELECT entertainment_id FROM watchlist WHERE user_id = ?')
          .all(userId).map(r => r.entertainment_id)
    );

    // Pull candidates (capped at 300 to keep scoring fast)
    let candidateQuery = 'SELECT * FROM entertainment WHERE 1=1';
    const candidateParams = [];
    if (type) { candidateQuery += ' AND type = ?'; candidateParams.push(type); }
    candidateQuery += ' LIMIT 300';
    const candidates = db.prepare(candidateQuery).all(...candidateParams);

    const hasPrefs = Object.keys(genreWeights).length > 0;
    const maxWeight = hasPrefs ? Math.max(...Object.values(genreWeights)) : 1;

    const scored = candidates
        .filter(item => !watchlistIds.has(item.id))
        .map(item => {
            // Genre overlap score (0–1)
            let genreScore = 0;
            if (hasPrefs && item.genre) {
                const itemGenres = item.genre.split(',').map(s => s.trim().toLowerCase());
                const totalWeight = itemGenres.reduce((sum, g) => sum + (genreWeights[g] || 0), 0);
                genreScore = Math.min(totalWeight / (maxWeight * 2), 1);
            }

            // Rating score (0–1)
            const extra = typeof item.extra === 'string' ? JSON.parse(item.extra || '{}') : (item.extra || {});
            const rating = extra.tmdb_rating || extra.vote_average || extra.average_rating || 0;
            const ratingScore = Math.min(Number(rating) / 10, 1);

            // Weighted final score; fall back to pure rating when no genre prefs
            const score = hasPrefs
                ? genreScore * 0.6 + ratingScore * 0.4
                : ratingScore;

            return { ...item, _score: score };
        })
        .filter(item => !hasPrefs || item._score > 0)
        .sort((a, b) => b._score - a._score);

    // If genre filter left nothing, fall back to top-rated across all candidates
    const results = scored.length > 0
        ? scored
        : candidates.filter(i => !watchlistIds.has(i.id)).sort((a, b) => {
            const aExtra = typeof a.extra === 'string' ? JSON.parse(a.extra || '{}') : (a.extra || {});
            const bExtra = typeof b.extra === 'string' ? JSON.parse(b.extra || '{}') : (b.extra || {});
            return (Number(bExtra.tmdb_rating || bExtra.vote_average || 0)) -
                   (Number(aExtra.tmdb_rating || aExtra.vote_average || 0));
        });

    // Strip internal _score field before sending
    res.json({ success: true, results: results.slice(0, 20).map(({ _score, ...item }) => item) });
});

// ----------------- Event tracking route -----------------
app.post('/api/events', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { entertainment_id, event_type } = req.body;
    if (!entertainment_id || !['view', 'watchlist_add', 'like'].includes(event_type)) {
        return res.status(400).json({ success: false, message: 'Invalid event' });
    }
    db.prepare(
        'INSERT INTO user_events (user_id, entertainment_id, event_type) VALUES (?, ?, ?)'
    ).run(req.session.user.id, Number(entertainment_id), event_type);
    res.json({ success: true });
});

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

