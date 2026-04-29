// Recommendation logic for entertainment items


// The recommendation function that generates recommendations based on the genre and type of search results
// The user will also be able to see the recommendations in search.html for everytime search result

// Import necessary modules and database connection
import db from './db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const TMDB_GENRES = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
    10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

// Everytime user get recommendation, we upsert, if the user has already get recommendation for the same genre and type, we update the recommendation, otherwise we insert a new recommendation
// we find through db else we insert a new one

function upsertItems(item){
    return item.map(item => {
        // Search for existing item with the same external_id and type
        const existing = db.prepare(
            'SELECT * FROM entertainment WHERE external_id = ? AND type = ?'
        ).get(String(item.external_id), String(item.type));


        if (existing) {
            // return if found, otherwise insert a new one
            return existing;
        }

        // insert new one if not found
        const info = db.prepare(
            'INSERT INTO entertainment (type, external_id, title, description, poster_url, release_year, genre, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
            item.type,
            String(item.external_id),
            item.title,
            item.description,
            item.poster_url,
            item.release_year,
            item.genre,
            JSON.stringify(item.extra)
        );
        return {...item, id: info.lastInsertRowid, extra: JSON.stringify(item.extra)};
    });
}

/**
 * TMDB API - Movie & TV Search Documentation
 *
 * API Base URL:
 * https://api.themoviedb.org/3
 *
 * Authentication:
 * - api_key
 *
 * Endpoint:
 * https://api.themoviedb.org/3/search/movie
 *
 * Example:
 * /search/movie?api_key=KEY&query=avengers
 *
 * Params:
 * - query (string): movie title
 * - api_key (string): API key
 *
 * Endpoint:
 * https://api.themoviedb.org/3/search/tv
 *
 * Example:
 * /search/tv?api_key=KEY&query=friends
 *
 * Params:
 * - query (string): show title
 * - api_key (string): API key
 *
 * Movie details 
 * Endpoint:
 * https://api.themoviedb.org/3/movie/{movie_id}
 *
 * Example:
 * /movie/550?api_key=KEY
 *
 * Tv detgails
 * Endpoint:
 * https://api.themoviedb.org/3/tv/{tv_id}
 *
 *
 * Endpoint:
 * https://api.themoviedb.org/3/movie/popular
 *
 * -----------------------------
 * IMAGE BASE URL
 * -----------------------------
 * https://image.tmdb.org/t/p/{size}/{image_path}
 *
 * {
 *   "results": [
 *     {
 *       "id": 123,
 *       "title": "Movie Title",
 *       "overview": "..."
 *     }
 *   ]
 * }
 *
 * Fields Used:
 * - id : unique movie/show ID
 * - title / name : content title
 * - overview : description
 * - poster_path : image path
 */
async function getTMDBRecommendations(type, externalID) {
    // Get the user's search history for the specified genre and type
    const fetch = await import('node-fetch');
    const apiKey = process.env.TMDB_API_KEY;
    // 'show' is stored in our DB but TMDB endpoint uses 'tv'
    const tmdbType = type === 'show' ? 'tv' : type;
    const url = `https://api.themoviedb.org/3/${tmdbType}/${externalID}/recommendations?api_key=${apiKey}&language=en-US&page=1`;

    const res = await fetch.default(url);
    const data = await res.json();

    const mappedResults = (data.results || []).map(m => ({
        type: type, // preserve 'show' so it stays consistent with our DB
        external_id: m.id,
        title: m.title || m.name,
        description: m.overview,
        poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
        release_year : String(m.release_date || m.first_air_date || '').split('-')[0] || null,
        genre: m.genre_ids.map(id => TMDB_GENRES[id]).filter(Boolean).join(', ') || null,
        extra: {
            tmdb_rating: m.vote_average,
            tmdb_popularity: m.popularity
        }
    }));
    return upsertItems(mappedResults);
}


/**
 * Fetch music recommendations from Last.fm API
 * 
 * API Documentation:
 * Base URL: https://ws.audioscrobbler.com/2.0/
 * Method: track.getSimilar
 * 
 * Endpoint:
 * https://ws.audioscrobbler.com/2.0/?method=track.getSimilar
 *   &artist=Coldplay
 *   &track=Yellow
 *   &api_key=api key
 *   &format=json
 * 
 * Parameters:
 * - artist: Name of the artist
 * - track: Track name
 * - api_key: Last.fm API key
 * - format: json
 * - limit: Number of recommendations
 * 
 * {
 *   "similartracks": {
 *     "track": [
 *       {
 *         "name": "Fix You",
 *         "match": "0.89",
 *         "artist": { "name": "Coldplay" },
 *         "image": [...]
 *       }
 *     ]
 *   }
 * }
 * 
 * Fields Used:
 * - track.name : song title
 * - artist.name : artist name
 * - match : similarity score
 * - image : album artwork
 */
async function getMusicRecommendations(item) {
    const fetch = (await import('node-fetch')).default;
    const apiKey = process.env.LASTFM_API_KEY;
    // extra stores { artist, track } — use the real artist/track names, not the combined "Artist - Track" title
    const extra = typeof item.extra === 'string' ? JSON.parse(item.extra || '{}') : (item.extra || {});
    const artist = extra.artist || item.title;
    const track  = extra.track  || '';
    const url = `http://ws.audioscrobbler.com/2.0/?method=track.getSimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${apiKey}&format=json&limit=20`;

    const res  = await fetch(url);
    const data = await res.json();

    // Last.fm deprecated image hosting — images are always empty strings.
    // Fall back to iTunes Search API (free, no key needed) for album artwork.
    async function getArtwork(trackArtist, trackName) {
        try {
            const q = encodeURIComponent(`${trackArtist} ${trackName}`);
            const r = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&entity=musicTrack&limit=1`);
            const d = await r.json();
            const art = d.results?.[0]?.artworkUrl100;
            return art ? art.replace('100x100bb', '500x500bb') : null;
        } catch {
            return null;
        }
    }

    const mappedResults = await Promise.all(
        (data.similartracks?.track || []).map(async t => ({
            type: 'music',
            external_id: t.mbid || `${t.artist?.name}-${t.name}`,
            title: `${t.artist?.name} - ${t.name}`,
            description: null,
            poster_url: await getArtwork(t.artist?.name, t.name),
            release_year: null,
            genre: null,
            extra: {
                artist: t.artist?.name || null,
                track: t.name,
                match: parseFloat(t.match) || 0
            }
        }))
    );
    return upsertItems(mappedResults);
}

/**
 * Google Books API - Book Search Documentation
 *
 * API Base URL:
 * https://www.googleapis.com/books/v1
 *
 * Endpoint:
 * https://www.googleapis.com/books/v1/volumes
 *
 * Example:
 * /volumes?q=harry+potter
 *
 * Params:
 * - q (string): search query
 * - key (string, optional): API key
 * - startIndex (number): pagination offset
 * - maxResults (number): limit results
 *
 * {
 *   "items": [
 *     {
 *       "id": "abc123",
 *       "volumeInfo": {
 *         "title": "Book Title",
 *         "authors": ["Author Name"],
 *         "publishedDate": "2000-01-01",
 *         "description": "...",
 *         "categories": ["Fiction"],
 *         "imageLinks": {
 *           "thumbnail": "url"
 *         }
 *       }
 *     }
 *   ]
 * }
 *
 * Fields Used:
 * - volumeInfo.title : book title
 * - volumeInfo.authors : author list
 * - volumeInfo.description : summary
 * - volumeInfo.publishedDate : release year
 * - volumeInfo.categories : genre
 * - volumeInfo.imageLinks.thumbnail : cover image
 */
async function getBookRecommendations(item) {
    const fetch = await import('node-fetch');
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(item.title)}&key=${apiKey}&maxResults=20`;
    
    const res = await fetch.default(url);
    const data = await res.json();

    const mappedResults = (data.items || []).map(b => ({
        type: 'book',
        external_id: b.id,
        title: b.volumeInfo.title,
        description: b.volumeInfo.description || null,
        poster_url: b.volumeInfo.imageLinks ? b.volumeInfo.imageLinks.thumbnail : null,
        release_year: b.volumeInfo.publishedDate ? String(b.volumeInfo.publishedDate).split('-')[0] : null,
        genre: b.volumeInfo.categories ? b.volumeInfo.categories.join(', ') : null,
        extra: {
            authors: b.volumeInfo.authors || [],
            average_rating: b.volumeInfo.averageRating || null,
        }
    }));
    return upsertItems(mappedResults);
}

export async function getRecommendations(entertainmentID, userID) {
    const item = db.prepare('SELECT * FROM entertainment WHERE id = ?').get(entertainmentID);
    if (!item) {
        throw new Error('Entertainment item not found');
    }
    
    const watchlistIDs = db.prepare('SELECT entertainment_id FROM watchlist WHERE user_id = ?').all(userID).map(row => row.entertainment_id);

    // 1. Using external APIs
    let recommendations = [];
    try{
        if (item.type === 'movie' || item.type === 'show') {
            recommendations = await getTMDBRecommendations(item.type, item.external_id);
        } else if (item.type === 'music') {
            recommendations = await getMusicRecommendations(item);
        } else if (item.type === 'book') {
            recommendations = await getBookRecommendations(item);
        }
    } catch (error) {
        console.error('Error fetching recommendations:', error);
    }

    // 2. Using local db when external API is not working
    try{
        if(recommendations.length === 0 && item.genre){
            const genre = item.genre.split(',')[0].trim(); // Get the first genre for simplicity
            recommendations = db.prepare(
                'SELECT * FROM entertainment WHERE type = ? AND genre LIKE ? AND id != ?'
            ).all(item.type, `%${genre}%`, entertainmentID);
        }
    } catch (error) {
        console.error('Error fetching local recommendations:', error);
    }

    // 3. Filter out current item, watchlist items, and duplicates (by id)
    const seenIds = new Set();
    const filteredRecommendations = recommendations.filter(rec => {
        if (rec.id === parseInt(entertainmentID)) return false;
        if (watchlistIDs.includes(rec.id)) return false;
        if (seenIds.has(rec.id)) return false;
        seenIds.add(rec.id);
        return true;
    });

    // 4. Sort by rating — extra may be a JSON string (from DB) or an object (freshly mapped)
    filteredRecommendations.sort((a, b) => {
        const aExtra = typeof a.extra === 'string' ? JSON.parse(a.extra || '{}') : (a.extra || {});
        const bExtra = typeof b.extra === 'string' ? JSON.parse(b.extra || '{}') : (b.extra || {});
        const aScore = aExtra.tmdb_rating || aExtra.average_rating || aExtra.match || 0;
        const bScore = bExtra.tmdb_rating || bExtra.average_rating || bExtra.match || 0;
        return bScore - aScore;
    });

    return filteredRecommendations.slice(0, 30);
}