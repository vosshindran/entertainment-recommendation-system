/**
 * Integration Tests — API Routes
 *
 * Tests HTTP endpoints directly using supertest.
 * Uses an in-memory SQLite database — no real DB file is touched.
 * Each test group registers and logs in its own user to keep state isolated.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../../server.js';
import db from '../../db.js';

const request = supertest(app);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function registerAndLogin(username) {
    const email = `${username}@test.com`;
    await request.post('/api/auth/register').send({ username, email, password: 'Password1!' });
    const res = await request.post('/api/auth/login').send({ username, password: 'Password1!' });
    const cookie = res.headers['set-cookie']?.[0]?.split(';')[0];
    return cookie;
}

function insertMovie({ title, genre, external_id = null, rating = 7.0, popularity = 100, release_year = '2020' }) {
    const info = db.prepare(
        'INSERT INTO entertainment (type, external_id, title, description, poster_url, release_year, genre, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('movie', external_id, title, null, null, release_year, genre,
        JSON.stringify({ tmdb_rating: rating, tmdb_popularity: popularity }));
    return info.lastInsertRowid;
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

before(() => {
    db.exec('DELETE FROM user_events; DELETE FROM watchlist; DELETE FROM reviews; DELETE FROM search_history; DELETE FROM entertainment; DELETE FROM users;');
});

after(() => {
    db.exec('DELETE FROM user_events; DELETE FROM watchlist; DELETE FROM reviews; DELETE FROM search_history; DELETE FROM entertainment; DELETE FROM users;');
});

// ─── /api/for-you ────────────────────────────────────────────────────────────

describe('GET /api/for-you', () => {
    test('returns 401 when not logged in', async () => {
        const res = await request.get('/api/for-you?type=movie');
        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
    });

    test('returns success with empty rows when watchlist is empty', async () => {
        const cookie = await registerAndLogin('integration_user_1');
        const res = await request
            .get('/api/for-you?type=movie')
            .set('Cookie', cookie);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.rows), 'rows should be an array');
        assert.equal(res.body.rows.length, 0, 'no watchlist = no rows');
    });

    test('returns rows with anchorTitle when user has watchlist items', async () => {
        const cookie = await registerAndLogin('integration_user_2');

        // Seed movies
        const movieId = insertMovie({ title: 'Interstellar', genre: 'Sci-Fi, Drama', external_id: 'ext_int_1' });
        insertMovie({ title: 'The Martian', genre: 'Sci-Fi', external_id: 'ext_int_2' });
        insertMovie({ title: 'Gravity', genre: 'Sci-Fi', external_id: 'ext_int_3' });

        // Add anchor to watchlist
        await request
            .post('/api/watchlist')
            .set('Cookie', cookie)
            .send({ entertainment_id: movieId });

        const res = await request
            .get('/api/for-you?type=movie')
            .set('Cookie', cookie);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.rows.length > 0, 'should return at least one row');
        assert.equal(res.body.rows[0].anchorTitle, 'Interstellar');
        assert.ok(Array.isArray(res.body.rows[0].results), 'each row should have results array');
    });

    test('excludes watchlisted items from results', async () => {
        const cookie = await registerAndLogin('integration_user_3');

        const anchorId = insertMovie({ title: 'Action Base', genre: 'Action', external_id: 'ext_ab' });
        const watchlistedId = insertMovie({ title: 'Action Sequel', genre: 'Action', external_id: 'ext_as' });
        insertMovie({ title: 'Action Three', genre: 'Action', external_id: 'ext_a3' });

        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: anchorId });
        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: watchlistedId });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);

        const allResultIds = res.body.rows.flatMap(r => r.results.map(m => m.id));
        assert.ok(!allResultIds.includes(anchorId), 'anchor item should not appear in results');
        assert.ok(!allResultIds.includes(watchlistedId), 'watchlisted item should not appear in results');
    });
});

// ─── /api/recommend/:id ──────────────────────────────────────────────────────

describe('GET /api/recommend/:id', () => {
    test('returns 401 when not logged in', async () => {
        const res = await request.get('/api/recommend/1');
        assert.equal(res.status, 401);
    });

    test('returns 404 for non-existent item', async () => {
        const cookie = await registerAndLogin('integration_user_4');
        const res = await request
            .get('/api/recommend/99999')
            .set('Cookie', cookie);
        assert.equal(res.status, 404);
    });

    test('returns recommendations array for a valid item', async () => {
        const cookie = await registerAndLogin('integration_user_5');
        const movieId = insertMovie({ title: 'Comedy King', genre: 'Comedy', external_id: 'ext_ck' });
        insertMovie({ title: 'Comedy Two', genre: 'Comedy', external_id: 'ext_c2' });

        const res = await request
            .get(`/api/recommend/${movieId}`)
            .set('Cookie', cookie);

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body), 'should return an array');
        // No item should be the source movie itself
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
        const cookie = await registerAndLogin('integration_user_6');
        const movieId = insertMovie({ title: 'Event Movie', genre: 'Drama', external_id: 'ext_ev' });

        const res = await request
            .post('/api/events')
            .set('Cookie', cookie)
            .send({ entertainment_id: movieId, event_type: 'like' });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
    });

    test('rejects invalid event_type', async () => {
        const cookie = await registerAndLogin('integration_user_7');
        const movieId = insertMovie({ title: 'Event Movie 2', genre: 'Drama', external_id: 'ext_ev2' });

        const res = await request
            .post('/api/events')
            .set('Cookie', cookie)
            .send({ entertainment_id: movieId, event_type: 'invalid_type' });

        assert.equal(res.status, 400);
    });
});
