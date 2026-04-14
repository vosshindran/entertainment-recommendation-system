import db from './db.js';
import dotenv from 'dotenv';
dotenv.config();

export const TMDB_GENRES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
    10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

function parseExtra(extra) {
    try { return JSON.parse(extra || '{}'); } catch { return {}; }
}

// Save API items to DB (skip duplicates by external_id) and return rows with DB ids.
function upsertItems(items) {
    return items.map(item => {
        const existing = db.prepare(
            'SELECT * FROM entertainment WHERE type = ? AND external_id = ?'
        ).get(item.type, String(item.external_id));

        if (existing) {
            return existing;
        }

        const info = db.prepare(`
            INSERT INTO entertainment (type, external_id, title, description, poster_url, release_year, genre, extra)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            item.type,
            String(item.external_id),
            item.title,
            item.description || null,
            item.poster_url || null,
            item.release_year || null,
            item.genre || null,
            JSON.stringify(item.extra || {})
        );

        return { ...item, id: info.lastInsertRowid, extra: JSON.stringify(item.extra || {}) };
    });
}

// TMDB /movie/{id}/recommendations or /tv/{id}/recommendations
async function fetchTMDBRecommendations(type, externalId) {
    const fetch = (await import('node-fetch')).default;
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const url = `https://api.themoviedb.org/3/${mediaType}/${externalId}/recommendations?api_key=${process.env.TMDB_API_KEY}&page=1`;

    const res  = await fetch(url);
    const data = await res.json();

    const mapped = (data.results || []).slice(0, 15).map(m => ({
        type,
        external_id: String(m.id),
        title:        m.title || m.name,
        description:  m.overview || null,
        poster_url:   m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
        release_year: (m.release_date || m.first_air_date)
            ? String(new Date(m.release_date || m.first_air_date).getFullYear())
            : null,
        genre: m.genre_ids
            ? m.genre_ids.map(id => TMDB_GENRES[id]).filter(Boolean).join(', ')
            : null,
        extra: {
            vote_average: m.vote_average || 0,
            popularity:   m.popularity   || 0
        }
    }));

    return upsertItems(mapped);
}

// Last.fm track.getSimilar
async function fetchMusicRecommendations(item) {
    const extra  = parseExtra(item.extra);
    const artist = extra.artist;
    const track  = extra.track;
    if (!artist || !track) return [];

    const fetch = (await import('node-fetch')).default;
    const url = `http://ws.audioscrobbler.com/2.0/?method=track.getSimilar` +
                `&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}` +
                `&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=12`;

    const res  = await fetch(url);
    const data = await res.json();

    const mapped = (data.similartracks?.track || []).slice(0, 15).map(t => ({
        type:         'music',
        external_id:  t.mbid || `${t.artist.name}-${t.name}`,
        title:        `${t.artist.name} - ${t.name}`,
        description:  null,
        poster_url:   t.image?.[2]?.['#text'] || null,
        release_year: null,
        genre:        null,
        extra: {
            artist: t.artist.name,
            track:  t.name,
            match:  parseFloat(t.match) || 0     // similarity score 0–1
        }
    }));

    return upsertItems(mapped);
}

// Google Books — search by same genre/subject
async function fetchBookRecommendations(item) {
    const extra      = parseExtra(item.extra);
    const searchTerm = item.genre || extra.authors || item.title.split(' ')[0];

    const fetch = (await import('node-fetch')).default;
    const url = `https://www.googleapis.com/books/v1/volumes` +
                `?q=subject:${encodeURIComponent(searchTerm)}` +
                `&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=15&orderBy=relevance`;

    const res  = await fetch(url);
    const data = await res.json();

    const mapped = (data.items || [])
        .filter(b => b.volumeInfo.title !== item.title)
        .map(b => ({
            type:         'book',
            external_id:  b.id,
            title:        b.volumeInfo.title,
            description:  b.volumeInfo.description || null,
            poster_url:   b.volumeInfo.imageLinks?.thumbnail || null,
            release_year: b.volumeInfo.publishedDate?.split('-')[0] || null,
            genre:        b.volumeInfo.categories?.[0] || null,
            extra: {
                authors:        b.volumeInfo.authors?.[0] || null,
                average_rating: b.volumeInfo.averageRating || 0
            }
        }));

    return upsertItems(mapped);
}

// Returns up to 15 recommended items, sorted by rating.
// Uses content-based API recommendations (TMDB / Last.fm / Google Books)
// and falls back to same-genre DB items when the API returns nothing.
export async function getRecommendations(entertainmentId, userId) {
    const item = db.prepare('SELECT * FROM entertainment WHERE id = ?').get(entertainmentId);
    if (!item) return [];

    const watchlistIds = new Set(
        db.prepare('SELECT entertainment_id FROM watchlist WHERE user_id = ?')
          .all(userId)
          .map(r => r.entertainment_id)
    );

    // ── 1. Content-based recommendations from external API ────────
    let recommendations = [];
    try {
        if ((item.type === 'movie' || item.type === 'show') && item.external_id) {
            recommendations = await fetchTMDBRecommendations(item.type, item.external_id);
        } else if (item.type === 'music') {
            recommendations = await fetchMusicRecommendations(item);
        } else if (item.type === 'book') {
            recommendations = await fetchBookRecommendations(item);
        }
    } catch (err) {
        // API error — fall through to DB fallback below
        console.error('Error fetching recommendations:', err);
    }

    // ── 2. DB fallback — same genre if API returned nothing ───────
    try {
    if (recommendations.length === 0 && item.genre) {
        const firstGenre = item.genre.split(',')[0].trim();
        recommendations = db.prepare(`
            SELECT * FROM entertainment
            WHERE type = ? AND genre LIKE ? AND id != ?
            ORDER BY id DESC LIMIT 15
        `).all(item.type, `%${firstGenre}%`, entertainmentId);
    }
    } catch (err) {
        console.error('DB fallback error:', err);
    }

    // ── 3. Filter out current item and watchlist entries ──────────
    const currentId = parseInt(entertainmentId);
    recommendations = recommendations.filter(
        r => r.id !== currentId && !watchlistIds.has(r.id)
    );

    // ── 4. Sort by rating score (highest first) ───────────────────
    // vote_average (movies/shows), average_rating (books), match (music)
    recommendations.sort((a, b) => {
        const aEx = parseExtra(a.extra);
        const bEx = parseExtra(b.extra);
        const aScore = aEx.vote_average ?? aEx.average_rating ?? aEx.match ?? 0;
        const bScore = bEx.vote_average ?? bEx.average_rating ?? bEx.match ?? 0;
        if (bScore !== aScore) return bScore - aScore;
        // secondary sort by popularity when scores are equal
        return (bEx.popularity || 0) - (aEx.popularity || 0);
    });

    return recommendations.slice(0, 15);
}
