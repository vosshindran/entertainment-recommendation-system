import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dbConnection from './db.js'; // MongoDB connection
import { 
    User, 
    Entertainment, 
    Watchlist, 
    Review, 
    SearchHistory, 
    UserEvent, 
    getNextSequenceValue 
} from './models.js';
import { getRecommendations, TMDB_GENRES } from './recommendation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key-streamflix-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 15 * 60 * 1000 }
}));

// ============================
// TMDB Proxy Route
// ============================
app.get('/api/tmdb/*', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;

        const endpoint = req.params[0];

        const params = new URLSearchParams(req.query);

        // Add TMDB API key
        params.set('api_key', process.env.TMDB_API_KEY);

        // Default language
        if (!params.has('language')) {
            params.set('language', 'en-US');
        }

        const tmdbUrl =
            `https://api.themoviedb.org/3/${endpoint}?${params.toString()}`;

        const tmdbRes = await fetch(tmdbUrl);

        const data = await tmdbRes.json();

        return res.json(data);

    } catch (err) {
        console.error('TMDB proxy error:', err);

        return res.status(500).json({
            error: 'TMDB proxy failed',
            detail: err.message
        });
    }
});



// Handle user registration
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const nextId = await getNextSequenceValue('users');
        const user = new User({
            id: nextId,
            username,
            email,
            password: hash
        });
        await user.save();
        res.json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
});

// Handle user login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        req.session.user = { id: user.id, username: user.username };
        res.json({ success: true, username: user.username, message: 'Login successful' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server login error' });
    }
});

// Terminate user session
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logout successful' });
    });
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    res.json({ success: true, username: req.session.user.username });
});

// Search for entertainment content
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

    try {
        // Save search to history if user is logged in
        if (req.session.user) {
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
            const recent = await SearchHistory.findOne({
                user_id: req.session.user.id,
                type,
                keyword: q,
                searched_at: { $gt: oneMinuteAgo }
            });
            if (!recent) {
                const nextHistId = await getNextSequenceValue('search_history');
                const newHistory = new SearchHistory({
                    id: nextHistId,
                    user_id: req.session.user.id,
                    type,
                    keyword: q
                });
                await newHistory.save();
            }
        }

        // Query entertainment by type and title
        const queryObj = {
            type,
            title: { $regex: q, $options: 'i' }
        };
        if (genre) {
            queryObj.genre = { $regex: genre, $options: 'i' };
        }
        
        const rows = await Entertainment.find(queryObj).limit(8).lean();

        if (rows.length >= 3){
            req.session[cacheKey] = { data: rows, timestamp: Date.now() };
            return res.json({ success: true, results: rows, source: 'local_db' });
        }

        // Fetch from external API if no local results
        const apiResults = await fetchFromAPI(type, q);

        for (const item of apiResults){
            let existing = await Entertainment.findOne({ type: item.type, external_id: String(item.external_id) });

            if (existing) {
                item.id = existing.id;
            } else {
                const nextEntId = await getNextSequenceValue('entertainment');
                const newItem = new Entertainment({
                    id: nextEntId,
                    type: item.type,
                    external_id: String(item.external_id),
                    title: item.title,
                    description: item.description,
                    poster_url: item.poster_url,
                    release_year: item.release_year ? Number(item.release_year) : null,
                    genre: item.genre,
                    extra: item.extra || {}
                });
                await newItem.save();
                item.id = nextEntId;
            }
        }

        req.session[cacheKey] = { data: apiResults, timestamp: Date.now() };
        res.json({ success: true, results: apiResults, source: 'external_api' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Search execution error', error: err.message });
    }
});

// Upsert a TMDB item into the local entertainment collection so server-side
// features (watchlist, reviews, events, recommendations) can be used.
app.post('/api/items/upsert_from_tmdb', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const { type = 'movie', tmdb_id } = req.body || {};
    if (!tmdb_id) return res.status(400).json({ success: false, message: 'Missing tmdb_id' });

    try {
        const endpoint = type === 'show' ? `tv/${encodeURIComponent(tmdb_id)}` : `movie/${encodeURIComponent(tmdb_id)}`;
        const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;
        const tmdbRes = await fetch(url);
        if (!tmdbRes.ok) return res.status(502).json({ success: false, message: 'TMDB error' });
        const data = await tmdbRes.json();

        const existing = await Entertainment.findOne({ type, external_id: String(tmdb_id) }).lean();
        if (existing) return res.json({ success: true, id: existing.id, item: existing });

        const nextId = await getNextSequenceValue('entertainment');
        const item = new Entertainment({
            id: nextId,
            type,
            external_id: String(tmdb_id),
            title: data.title || data.name || 'Untitled',
            description: data.overview || null,
            poster_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
            release_year: (data.release_date || data.first_air_date) ? String(new Date(data.release_date || data.first_air_date).getFullYear()) : null,
            genre: Array.isArray(data.genres) ? data.genres.map(g => g.name).join(', ') : null,
            extra: { tmdb_rating: data.vote_average || 0, popularity: data.popularity || 0 }
        });
        await item.save();
        res.json({ success: true, id: item.id, item: item.toObject() });
    } catch (err) {
        console.error('Upsert TMDB error:', err);
        res.status(500).json({ success: false, message: 'Failed to upsert TMDB item', error: err.message });
    }
});

// Get similar recommendations for an item
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

// Fetch user's watchlist
app.get('/api/watchlist', async (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    try {
        const watchlistItems = await Watchlist.find({ user_id: req.session.user.id }).sort({ added_at: -1 }).lean();
        const entIds = watchlistItems.map(w => w.entertainment_id);
        const items = await Entertainment.find({ id: { $in: entIds } }).lean();
        const itemsById = new Map(items.map(item => [item.id, item]));
        const orderedItems = entIds.map(id => itemsById.get(id)).filter(Boolean);
        res.json({ success: true, watchlist: orderedItems });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to get watchlist' });
    }
});

app.post('/api/watchlist', async (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const { entertainment_id } = req.body;
    if (!entertainment_id || !Number.isInteger(Number(entertainment_id))) {
        return res.status(400).json({ success: false, message: 'Invalid entertainment_id' });
    }
    try {
        const entertainmentId = Number(entertainment_id);
        const entertainmentExists = await Entertainment.exists({ id: entertainmentId });
        if (!entertainmentExists) {
            return res.status(404).json({ success: false, message: 'Entertainment item not found' });
        }

        const existing = await Watchlist.findOne({ user_id: req.session.user.id, entertainment_id: entertainmentId });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Already in watchlist' });
        }

        const nextWatchId = await getNextSequenceValue('watchlist');
        const newWatch = new Watchlist({
            id: nextWatchId,
            user_id: req.session.user.id,
            entertainment_id: entertainmentId
        });
        await newWatch.save();
        res.json({ success: true, message: 'Added to watchlist' });
    } catch (err) {
        console.error('Watchlist add error:', err);
        res.status(500).json({ success: false, message: 'Failed to add to watchlist' });
    }
});

app.delete('/api/watchlist/:id', async (req, res) => {
    if (!req.session.user){
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const { id } = req.params;
    try {
        await Watchlist.deleteOne({ user_id: req.session.user.id, entertainment_id: Number(id) });
        res.json({ success: true, message: 'Removed from watchlist' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to remove from watchlist' });
    }
});

// Get reviews for an item
app.get('/api/reviews/:entertainment_id', async (req, res) => {
    const { entertainment_id } = req.params;
    try {
        const reviews = await Review.find({ entertainment_id: Number(entertainment_id) }).sort({ created_at: -1 }).lean();
        const userIds = [...new Set(reviews.map(r => r.user_id))];
        const users = await User.find({ id: { $in: userIds } }).select('id username').lean();
        const userMap = new Map(users.map(u => [u.id, u.username]));

        const reviewsWithUsernames = reviews.map(r => ({
            id: r.id,
            user_id: r.user_id,
            entertainment_id: r.entertainment_id,
            rating: r.rating,
            comment: r.comment,
            username: userMap.get(r.user_id) || 'Unknown User',
            created_at: new Date(r.created_at).toISOString().replace('T', ' ').substring(0, 19)
        }));

        res.json({ success: true, reviews: reviewsWithUsernames });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load reviews' });
    }
});

app.post('/api/reviews', async (req, res) => {
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
    try {
        const nextReviewId = await getNextSequenceValue('reviews');
        const newReview = new Review({
            id: nextReviewId,
            user_id: req.session.user.id,
            entertainment_id: Number(entertainment_id),
            rating: r,
            comment: comment ?? null
        });
        await newReview.save();
        res.json({ success: true, message: 'Review submitted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to submit review' });
    }
});

// Get current user's reviews with entertainment details
app.get('/api/my-reviews', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Not logged in' });
    try {
        const reviews = await Review.find({ user_id: req.session.user.id }).sort({ created_at: -1 }).lean();
        const entIds = [...new Set(reviews.map(r => r.entertainment_id))];
        const items = await Entertainment.find({ id: { $in: entIds } }).lean();
        const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
        const result = reviews.map(r => ({
            review_id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            entertainment_id: r.entertainment_id,
            title: itemMap[r.entertainment_id]?.title,
            poster_url: itemMap[r.entertainment_id]?.poster_url,
            type: itemMap[r.entertainment_id]?.type,
            external_id: itemMap[r.entertainment_id]?.external_id
        }));
        res.json({ success: true, reviews: result });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
});

// Fetch recommendations from external APIs
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
                authors: b.volumeInfo.authors || [],
            }
        }));
    }

    if (type === 'music'){
        const url = `http://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${process.env.LASTFM_API_KEY}&format=json`;
        const res  = await fetch(url);
        const data = await res.json();
        const tracks = (data.results?.trackmatches?.track || []).slice(0, 8);

        // use last.fm first, if not fallback to itunes api
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

// Get personalized "For You" recommendations
app.get('/api/for-you', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    const { type } = req.query;
    const userId = req.session.user.id;

    try {
        // 1. Get user's watchlist item IDs and fetch their genres
        const watchlistItems = await Watchlist.find({ user_id: userId }).lean();
        const watchlistEntIds = watchlistItems.map(w => w.entertainment_id);

        const watchlistGenreQuery = { id: { $in: watchlistEntIds }, genre: { $ne: null } };
        if (type) watchlistGenreQuery.type = type;
        const watchlistGenreDocs = await Entertainment.find(watchlistGenreQuery).select('genre').lean();

        // 2. Get user's recent events in the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const eventItems = await UserEvent.find({ user_id: userId, created_at: { $gt: thirtyDaysAgo } }).lean();
        const eventEntIds = eventItems.map(e => e.entertainment_id);

        const eventGenreQuery = { id: { $in: eventEntIds }, genre: { $ne: null } };
        if (type) eventGenreQuery.type = type;
        const eventGenreDocs = await Entertainment.find(eventGenreQuery).select('genre').lean();

        // 3. Build genre preference weights: watchlist=2pts, recent events=1pt
        const genreWeights = {};
        for (const doc of watchlistGenreDocs) {
            if (doc.genre) {
                for (const g of doc.genre.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) {
                    genreWeights[g] = (genreWeights[g] || 0) + 2;
                }
            }
        }
        for (const doc of eventGenreDocs) {
            if (doc.genre) {
                for (const g of doc.genre.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) {
                    genreWeights[g] = (genreWeights[g] || 0) + 1;
                }
            }
        }

        const watchlistIdsSet = new Set(watchlistEntIds);
        const candidateQuery = type ? { type } : {};
        const candidates = await Entertainment.find(candidateQuery).limit(300).lean();

        const hasPrefs = Object.keys(genreWeights).length > 0;
        const maxWeight = hasPrefs ? Math.max(...Object.values(genreWeights)) : 1;

        const scored = candidates
            .filter(item => !watchlistIdsSet.has(item.id))
            .map(item => {
                let genreScore = 0;
                if (hasPrefs && item.genre) {
                    const itemGenres = item.genre.split(',').map(s => s.trim().toLowerCase());
                    const totalWeight = itemGenres.reduce((sum, g) => sum + (genreWeights[g] || 0), 0);
                    genreScore = Math.min(totalWeight / (maxWeight * 2), 1);
                }
                const extraObj = item.extra || {};
                const rating = extraObj.tmdb_rating || extraObj.vote_average || extraObj.average_rating || 0;
                const ratingScore = Math.min(Number(rating) / 10, 1);
                const score = hasPrefs ? genreScore * 0.6 + ratingScore * 0.4 : ratingScore;
                return { ...item, _score: score };
            })
            .filter(item => !hasPrefs || item._score > 0)
            .sort((a, b) => b._score - a._score);

        const results = scored.length > 0
            ? scored
            : candidates.filter(i => !watchlistIdsSet.has(i.id)).sort((a, b) => {
                const aRating = Number((a.extra || {}).tmdb_rating || (a.extra || {}).vote_average || 0);
                const bRating = Number((b.extra || {}).tmdb_rating || (b.extra || {}).vote_average || 0);
                return bRating - aRating;
            });

        res.json({ success: true, results: results.slice(0, 20).map(({ _score, ...item }) => item) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching personalised picks', error: err.message });
    }
});

// Track user interactions for recommendations
app.post('/api/events', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { entertainment_id, event_type } = req.body;
    if (!entertainment_id || !['view', 'watchlist_add', 'like'].includes(event_type)) {
        return res.status(400).json({ success: false, message: 'Invalid event' });
    }
    try {
        const nextId = await getNextSequenceValue('user_events');
        const newEvent = new UserEvent({
            id: nextId,
            user_id: req.session.user.id,
            entertainment_id: Number(entertainment_id),
            event_type
        });
        await newEvent.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to record event' });
    }
});

// Fetch entertainment item details by internal ID
app.get('/api/item/:id', async (req, res) => {
    try {
        const item = await Entertainment.findOne({ id: Number(req.params.id) }).lean();
        if (!item) return res.status(404).json({ error: 'Not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Database search error' });
    }
});

// Fetch entertainment item by external provider id
app.get('/api/item/external/:type/:external_id', async (req, res) => {
    try {
        const { type, external_id } = req.params;
        const item = await Entertainment.findOne({ type, external_id: String(external_id) }).lean();
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Database search error' });
    }
});

// Create a backend entertainment item if it does not exist
app.post('/api/item', async (req, res) => {
    const {
        type,
        external_id,
        title,
        description,
        poster_url,
        release_year,
        genre,
        extra
    } = req.body;

    if (!type || !external_id || !title) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        const existing = await Entertainment.findOne({ type, external_id: String(external_id) }).lean();
        if (existing) {
            return res.json(existing);
        }

        const nextEntId = await getNextSequenceValue('entertainment');
        const newItem = new Entertainment({
            id: nextEntId,
            type,
            external_id: String(external_id),
            title,
            description: description || '',
            poster_url: poster_url || null,
            release_year: release_year ? Number(release_year) : null,
            genre: genre || null,
            extra: extra || {}
        });
        await newItem.save();
        res.json(newItem.toObject());
    } catch (err) {
        console.error('Create entertainment item error:', err);
        res.status(500).json({ success: false, message: 'Failed to create entertainment item' });
    }
});

// start the server
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`Port ${port} busy, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });
}

startServer(DEFAULT_PORT);
