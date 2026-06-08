/**
 * Unit Tests — recommendation.js
 *
 * Tests pure logic in isolation using an in-memory SQLite database.
 * No HTTP, no sessions — just the recommendation functions directly.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../../db.js';
import { getRecommendations } from '../../recommendation.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function insertMovie({ title, genre, external_id = null, rating = 7.0, popularity = 100, release_year = '2020' }) {
    const info = db.prepare(
        'INSERT INTO entertainment (type, external_id, title, description, poster_url, release_year, genre, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('movie', external_id, title, null, null, release_year, genre, JSON.stringify({ tmdb_rating: rating, tmdb_popularity: popularity }));
    return info.lastInsertRowid;
}

function insertUser(username = 'testuser') {
    const info = db.prepare(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
    ).run(username, `${username}@test.com`, 'hashedpassword');
    return info.lastInsertRowid;
}

function addToWatchlist(userId, entertainmentId) {
    db.prepare('INSERT INTO watchlist (user_id, entertainment_id) VALUES (?, ?)').run(userId, entertainmentId);
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

before(() => {
    db.exec('DELETE FROM user_events; DELETE FROM watchlist; DELETE FROM entertainment; DELETE FROM users;');
});

after(() => {
    db.exec('DELETE FROM user_events; DELETE FROM watchlist; DELETE FROM entertainment; DELETE FROM users;');
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getRecommendations', () => {
    test('throws when entertainment item does not exist', async () => {
        const userId = insertUser('user_unit_1');
        await assert.rejects(
            () => getRecommendations(99999, userId),
            { message: 'Entertainment item not found' }
        );
    });

    test('returns an array of recommendations', async () => {
        const userId = insertUser('user_unit_2');
        const movieId = insertMovie({ title: 'Action Hero', genre: 'Action, Adventure', external_id: 'ext_unit_1' });

        // Seed some similar movies in the DB so the local fallback has candidates
        insertMovie({ title: 'Action Sequel', genre: 'Action', external_id: 'ext_unit_2' });
        insertMovie({ title: 'Epic Adventure', genre: 'Adventure', external_id: 'ext_unit_3' });

        const results = await getRecommendations(movieId, userId);

        assert.ok(Array.isArray(results), 'should return an array');
        assert.ok(results.length >= 0, 'array should be non-negative length');
    });

    test('excludes the source item from recommendations', async () => {
        const userId = insertUser('user_unit_3');
        const movieId = insertMovie({ title: 'Source Movie', genre: 'Drama', external_id: 'ext_unit_src' });
        insertMovie({ title: 'Drama Two', genre: 'Drama', external_id: 'ext_unit_d2' });

        const results = await getRecommendations(movieId, userId);
        const ids = results.map(r => r.id);

        assert.ok(!ids.includes(movieId), 'source item should not appear in recommendations');
    });

    test('excludes items already in the user watchlist', async () => {
        const userId = insertUser('user_unit_4');
        const movieId = insertMovie({ title: 'Crime Thriller', genre: 'Crime, Thriller', external_id: 'ext_unit_ct' });
        const watchlistedId = insertMovie({ title: 'Crime Story', genre: 'Crime', external_id: 'ext_unit_cs' });

        addToWatchlist(userId, watchlistedId);

        const results = await getRecommendations(movieId, userId);
        const ids = results.map(r => r.id);

        assert.ok(!ids.includes(watchlistedId), 'watchlisted item should be excluded');
    });

    test('returns no more than 30 results', async () => {
        const userId = insertUser('user_unit_5');
        const movieId = insertMovie({ title: 'Sci-Fi Epic', genre: 'Sci-Fi', external_id: 'ext_unit_sf' });

        // Insert 35 sci-fi movies
        for (let i = 0; i < 35; i++) {
            insertMovie({ title: `Sci-Fi ${i}`, genre: 'Sci-Fi', external_id: `ext_sf_${i}` });
        }

        const results = await getRecommendations(movieId, userId);
        assert.ok(results.length <= 30, `expected ≤30 results, got ${results.length}`);
    });

    test('results are sorted by rating descending', async () => {
        const userId = insertUser('user_unit_6');
        const movieId = insertMovie({ title: 'Horror Base', genre: 'Horror', external_id: 'ext_unit_hb' });
        insertMovie({ title: 'Horror Low', genre: 'Horror', rating: 4.0, external_id: 'ext_unit_hl' });
        insertMovie({ title: 'Horror High', genre: 'Horror', rating: 9.0, external_id: 'ext_unit_hh' });
        insertMovie({ title: 'Horror Mid', genre: 'Horror', rating: 6.5, external_id: 'ext_unit_hm' });

        const results = await getRecommendations(movieId, userId);
        // Filter to only our inserted horror movies
        const horrorResults = results.filter(r => ['Horror Low', 'Horror High', 'Horror Mid'].includes(r.title));

        for (let i = 0; i < horrorResults.length - 1; i++) {
            const aExtra = JSON.parse(horrorResults[i].extra || '{}');
            const bExtra = JSON.parse(horrorResults[i + 1].extra || '{}');
            const aRating = aExtra.tmdb_rating || aExtra.average_rating || aExtra.match || 0;
            const bRating = bExtra.tmdb_rating || bExtra.average_rating || bExtra.match || 0;
            assert.ok(aRating >= bRating, `results should be sorted by rating: ${aRating} >= ${bRating}`);
        }
    });
});
