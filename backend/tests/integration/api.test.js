/**
 * Integration Tests — API Routes
 *
 * Tests HTTP endpoints directly using supertest against a dedicated test
 * MongoDB database. Each test group registers its own user for isolation.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../server.js';
import { Entertainment, User, Watchlist, Review, UserEvent, SearchHistory, Counter, getNextSequenceValue } from '../../models.js';

const request = supertest(app);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function registerAndLogin(username) {
    const email = `${username}@test.com`;
    await request.post('/api/auth/register').send({ username, email, password: 'Password1!' });
    const res = await request.post('/api/auth/login').send({ username, password: 'Password1!' });
    const cookie = res.headers['set-cookie']?.[0]?.split(';')[0];
    return cookie;
}

async function insertMovie({ title, genre, external_id, rating = 7.0, popularity = 100, release_year = '2020' }) {
    const id = await getNextSequenceValue('entertainment');
    const item = new Entertainment({
        id,
        type: 'movie',
        external_id: external_id || `i_ext_${id}`,
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

async function clearCollections() {
    await Entertainment.deleteMany({});
    await User.deleteMany({});
    await Watchlist.deleteMany({});
    await Review.deleteMany({});
    await UserEvent.deleteMany({});
    await SearchHistory.deleteMany({});
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

// ─── /api/for-you ────────────────────────────────────────────────────────────

describe('GET /api/for-you', () => {
    test('returns 401 when not logged in', async () => {
        const res = await request.get('/api/for-you?type=movie');
        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
    });

    test('returns success with empty results when DB has no movies', async () => {
        const cookie = await registerAndLogin('integration_user_1');
        const res = await request
            .get('/api/for-you?type=movie')
            .set('Cookie', cookie);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.rows), 'rows should be an array');
    });

    test('returns results when user has watchlist items', async () => {
        const cookie = await registerAndLogin('integration_user_2');

        const movieId = await insertMovie({ title: 'Interstellar', genre: 'Sci-Fi, Drama', external_id: 'i_int_1' });
        await insertMovie({ title: 'The Martian', genre: 'Sci-Fi', external_id: 'i_int_2' });
        await insertMovie({ title: 'Gravity', genre: 'Sci-Fi', external_id: 'i_int_3' });

        await request
            .post('/api/watchlist')
            .set('Cookie', cookie)
            .send({ entertainment_id: movieId });

        const res = await request
            .get('/api/for-you?type=movie')
            .set('Cookie', cookie);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.rows), 'rows should be an array');
        const allResults = res.body.rows.flatMap(r => r.results);
        assert.ok(allResults.length > 0, 'should return at least one result');
    });

    test('excludes watchlisted items from results', async () => {
        const cookie = await registerAndLogin('integration_user_3');

        const anchorId = await insertMovie({ title: 'Action Base', genre: 'Action', external_id: 'i_ab' });
        const watchlistedId = await insertMovie({ title: 'Action Sequel', genre: 'Action', external_id: 'i_as' });
        await insertMovie({ title: 'Action Three', genre: 'Action', external_id: 'i_a3' });

        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: anchorId });
        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: watchlistedId });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);

        const resultIds = res.body.rows.flatMap(r => r.results).map(m => m.id);
        assert.ok(!resultIds.includes(anchorId), 'anchor item should not appear in results');
        assert.ok(!resultIds.includes(watchlistedId), 'watchlisted item should not appear in results');
    });

    test('returns at most 20 results per row', async () => {
        const cookie = await registerAndLogin('integration_user_4');

        const anchorId = await insertMovie({ title: 'Fantasy Anchor', genre: 'Fantasy', external_id: 'i_fan_a' });
        for (let i = 0; i < 25; i++) {
            await insertMovie({ title: `Fantasy ${i}`, genre: 'Fantasy', external_id: `i_fan_${i}` });
        }

        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: anchorId });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);
        for (const row of res.body.rows) {
            assert.ok(row.results.length <= 20, `expected ≤20 results per row, got ${row.results.length}`);
        }
    });
});

// ─── /api/recommend/:id ──────────────────────────────────────────────────────

describe('GET /api/recommend/:id', () => {
    test('returns 401 when not logged in', async () => {
        const res = await request.get('/api/recommend/1');
        assert.equal(res.status, 401);
    });

    test('returns 404 for non-existent item', async () => {
        const cookie = await registerAndLogin('integration_user_5');
        const res = await request
            .get('/api/recommend/99999')
            .set('Cookie', cookie);
        assert.equal(res.status, 404);
    });

    test('returns recommendations array for a valid item', async () => {
        const cookie = await registerAndLogin('integration_user_6');
        const movieId = await insertMovie({ title: 'Comedy King', genre: 'Comedy', external_id: 'i_ck' });
        await insertMovie({ title: 'Comedy Two', genre: 'Comedy', external_id: 'i_c2' });

        const res = await request
            .get(`/api/recommend/${movieId}`)
            .set('Cookie', cookie);

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body), 'should return an array');
        assert.ok(!res.body.find(r => r.id === movieId), 'source movie should not appear in recommendations');
    });
});

// ─── /api/events ─────────────────────────────────────────────────────────────

describe('POST /api/events', () => {
    test('returns 401 when not logged in', async () => {
        const res = await request.post('/api/events').send({ entertainment_id: 1, event_type: 'view' });
        assert.equal(res.status, 401);
    });

    test('records a valid event', async () => {
        const cookie = await registerAndLogin('integration_user_7');
        const movieId = await insertMovie({ title: 'Event Movie', genre: 'Drama', external_id: 'i_ev' });

        const res = await request
            .post('/api/events')
            .set('Cookie', cookie)
            .send({ entertainment_id: movieId, event_type: 'like' });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
    });

    test('rejects invalid event_type', async () => {
        const cookie = await registerAndLogin('integration_user_8');
        const movieId = await insertMovie({ title: 'Event Movie 2', genre: 'Drama', external_id: 'i_ev2' });

        const res = await request
            .post('/api/events')
            .set('Cookie', cookie)
            .send({ entertainment_id: movieId, event_type: 'invalid_type' });

        assert.equal(res.status, 400);
    });
});
