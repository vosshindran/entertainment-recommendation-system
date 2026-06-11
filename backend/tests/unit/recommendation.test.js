/**
 * Unit Tests — recommendation.js
 *
 * Tests pure logic in isolation using a dedicated test MongoDB database.
 * No HTTP, no sessions — just the recommendation functions directly.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Entertainment, Watchlist, User, Counter, getNextSequenceValue } from '../../models.js';
import { getRecommendations } from '../../recommendation.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function insertMovie({ title, genre, external_id, rating = 7.0, popularity = 100, release_year = '2020' }) {
    const id = await getNextSequenceValue('entertainment');
    const item = new Entertainment({
        id,
        type: 'movie',
        external_id: external_id || `test_ext_${id}`,
        title,
        description: null,
        poster_url: null,
        release_year: parseInt(release_year),
        genre,
        extra: { tmdb_rating: rating, tmdb_popularity: popularity }
    });
    await item.save();
    return id;
}

async function insertUser(username = 'testuser') {
    const id = await getNextSequenceValue('users');
    const user = new User({ id, username, email: `${username}@test.com`, password: 'hashedpassword' });
    await user.save();
    return id;
}

async function addToWatchlist(userId, entertainmentId) {
    const id = await getNextSequenceValue('watchlist');
    await new Watchlist({ id, user_id: userId, entertainment_id: entertainmentId }).save();
}

async function clearCollections() {
    await Entertainment.deleteMany({});
    await User.deleteMany({});
    await Watchlist.deleteMany({});
    await Counter.deleteMany({});
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

before(async () => {
    if (mongoose.connection.readyState !== 1) {
        await new Promise((resolve, reject) => {
            mongoose.connection.once('open', resolve);
            mongoose.connection.once('error', reject);
        });
    }
    await clearCollections();
});

after(async () => {
    await clearCollections();
    await mongoose.disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getRecommendations', () => {
    test('throws when entertainment item does not exist', async () => {
        const userId = await insertUser('user_unit_1');
        await assert.rejects(
            () => getRecommendations(99999, userId),
            { message: 'Entertainment item not found' }
        );
    });

    test('returns an array of recommendations', async () => {
        const userId = await insertUser('user_unit_2');
        const movieId = await insertMovie({ title: 'Action Hero', genre: 'Action, Adventure', external_id: 'u_ext_1' });

        await insertMovie({ title: 'Action Sequel', genre: 'Action', external_id: 'u_ext_2' });
        await insertMovie({ title: 'Epic Adventure', genre: 'Adventure', external_id: 'u_ext_3' });

        const results = await getRecommendations(movieId, userId);

        assert.ok(Array.isArray(results), 'should return an array');
        assert.ok(results.length >= 0, 'array should have non-negative length');
    });

    test('excludes the source item from recommendations', async () => {
        const userId = await insertUser('user_unit_3');
        const movieId = await insertMovie({ title: 'Source Movie', genre: 'Drama', external_id: 'u_ext_src' });
        await insertMovie({ title: 'Drama Two', genre: 'Drama', external_id: 'u_ext_d2' });

        const results = await getRecommendations(movieId, userId);
        const ids = results.map(r => r.id);

        assert.ok(!ids.includes(movieId), 'source item should not appear in recommendations');
    });

    test('excludes items already in the user watchlist', async () => {
        const userId = await insertUser('user_unit_4');
        const movieId = await insertMovie({ title: 'Crime Thriller', genre: 'Crime, Thriller', external_id: 'u_ext_ct' });
        const watchlistedId = await insertMovie({ title: 'Crime Story', genre: 'Crime', external_id: 'u_ext_cs' });

        await addToWatchlist(userId, watchlistedId);

        const results = await getRecommendations(movieId, userId);
        const ids = results.map(r => r.id);

        assert.ok(!ids.includes(watchlistedId), 'watchlisted item should be excluded');
    });

    test('returns no more than 30 results', async () => {
        const userId = await insertUser('user_unit_5');
        const movieId = await insertMovie({ title: 'Sci-Fi Epic', genre: 'Sci-Fi', external_id: 'u_ext_sf' });

        for (let i = 0; i < 35; i++) {
            await insertMovie({ title: `Sci-Fi ${i}`, genre: 'Sci-Fi', external_id: `u_sf_${i}` });
        }

        const results = await getRecommendations(movieId, userId);
        assert.ok(results.length <= 30, `expected ≤30 results, got ${results.length}`);
    });

    test('results are sorted by rating descending', async () => {
        const userId = await insertUser('user_unit_6');
        const movieId = await insertMovie({ title: 'Horror Base', genre: 'Horror', external_id: 'u_ext_hb' });
        await insertMovie({ title: 'Horror Low',  genre: 'Horror', rating: 4.0, external_id: 'u_ext_hl' });
        await insertMovie({ title: 'Horror High', genre: 'Horror', rating: 9.0, external_id: 'u_ext_hh' });
        await insertMovie({ title: 'Horror Mid',  genre: 'Horror', rating: 6.5, external_id: 'u_ext_hm' });

        const results = await getRecommendations(movieId, userId);
        const horrorResults = results.filter(r => ['Horror Low', 'Horror High', 'Horror Mid'].includes(r.title));

        for (let i = 0; i < horrorResults.length - 1; i++) {
            const aExtra = horrorResults[i].extra || {};
            const bExtra = horrorResults[i + 1].extra || {};
            const aRating = aExtra.tmdb_rating || aExtra.average_rating || aExtra.match || 0;
            const bRating = bExtra.tmdb_rating || bExtra.average_rating || bExtra.match || 0;
            assert.ok(aRating >= bRating, `results should be sorted by rating: ${aRating} >= ${bRating}`);
        }
    });
});
