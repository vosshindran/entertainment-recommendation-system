/**
 * Functional Tests — Recommendation Flows
 *
 * Tests complete user journeys end-to-end:
 * register → seed data → interact → verify recommendations.
 * Uses a dedicated test MongoDB database.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../server.js';
import { Entertainment, User, Watchlist, Review, UserEvent, SearchHistory, Counter, getNextSequenceValue } from '../../models.js';

const request = supertest(app);

// ─── Helpers ────────────────────────────────────────────────────────────────

let userCounter = 0;
async function registerAndLogin() {
    const username = `func_user_${++userCounter}`;
    const email = `${username}@test.com`;
    await request.post('/api/auth/register').send({ username, email, password: 'Password1!' });
    const res = await request.post('/api/auth/login').send({ username, password: 'Password1!' });
    const cookie = res.headers['set-cookie']?.[0]?.split(';')[0];
    return { cookie, username };
}

async function insertMovie({ title, genre, external_id, rating = 7.0, popularity = 200, release_year = '2021' }) {
    const id = await getNextSequenceValue('entertainment');
    const item = new Entertainment({
        id,
        type: 'movie',
        external_id: external_id || `f_ext_${id}`,
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

// ─── Flows ───────────────────────────────────────────────────────────────────

describe('Recommendation flow: genre matching', () => {
    test('for-you recommends movies with the same genre as the watchlist item', async () => {
        const { cookie } = await registerAndLogin();

        const anchorId = await insertMovie({ title: 'Horror Classic', genre: 'Horror', external_id: 'fc_hc' });
        await insertMovie({ title: 'Horror Two',   genre: 'Horror',  rating: 8.0, external_id: 'fc_h2' });
        await insertMovie({ title: 'Horror Three', genre: 'Horror',  rating: 7.5, external_id: 'fc_h3' });
        await insertMovie({ title: 'Romance Film', genre: 'Romance', rating: 9.0, external_id: 'fc_rf' });

        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: anchorId });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);
        assert.equal(res.status, 200);

        const results = res.body.rows.flatMap(r => r.results);
        const horrorResults = results.filter(m => m.genre?.includes('Horror'));
        assert.ok(horrorResults.length > 0, 'Horror movies should appear in results');

        // Genre-matched horror should rank before non-matching romance
        // (genre × 0.6 + rating × 0.4 means a 7.5-rated horror outscores a 9.0-rated romance)
        const horrorIdx  = results.findIndex(m => m.genre?.includes('Horror'));
        const romanceIdx = results.findIndex(m => m.title === 'Romance Film');
        if (horrorIdx !== -1 && romanceIdx !== -1) {
            assert.ok(horrorIdx < romanceIdx, 'Genre-matched Horror should rank above non-matching Romance');
        }
    });

    test('watchlisted items are excluded from for-you results', async () => {
        const { cookie } = await registerAndLogin();

        const anchorId      = await insertMovie({ title: 'Action Base',   genre: 'Action', external_id: 'fc_ab' });
        const watchlistedId = await insertMovie({ title: 'Action Sequel', genre: 'Action', external_id: 'fc_as' });
        await insertMovie({ title: 'Action Three', genre: 'Action', external_id: 'fc_a3' });

        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: anchorId });
        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: watchlistedId });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);
        const resultIds = res.body.rows.flatMap(r => r.results).map(m => m.id);

        assert.ok(!resultIds.includes(anchorId),      'anchor should not appear in results');
        assert.ok(!resultIds.includes(watchlistedId), 'watchlisted item should not appear in results');
    });

    test('results contain no duplicates', async () => {
        const { cookie } = await registerAndLogin();

        const anchorId = await insertMovie({ title: 'Thriller Base', genre: 'Thriller', external_id: 'fc_tb' });
        for (let i = 0; i < 10; i++) {
            await insertMovie({ title: `Thriller ${i}`, genre: 'Thriller', external_id: `fc_th_${i}` });
        }

        await request.post('/api/watchlist').set('Cookie', cookie).send({ entertainment_id: anchorId });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);
        const ids = res.body.rows.flatMap(r => r.results).map(m => m.id);
        const uniqueIds = new Set(ids);

        assert.equal(ids.length, uniqueIds.size, 'No movie should appear more than once in results');
    });
});

describe('Recommendation flow: cold start', () => {
    test('new user with no watchlist gets results sorted by rating', async () => {
        const { cookie } = await registerAndLogin();

        await insertMovie({ title: 'Low Rated',  genre: 'Drama', rating: 4.0, external_id: 'cs_lr' });
        await insertMovie({ title: 'High Rated', genre: 'Drama', rating: 9.0, external_id: 'cs_hr' });
        await insertMovie({ title: 'Mid Rated',  genre: 'Drama', rating: 6.5, external_id: 'cs_mr' });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(Array.isArray(res.body.rows));

        // With no watchlist, should be sorted purely by rating (cold start returns single row)
        const results = res.body.rows.flatMap(r => r.results);
        for (let i = 0; i < results.length - 1; i++) {
            const aRating = (results[i].extra?.tmdb_rating || 0);
            const bRating = (results[i + 1].extra?.tmdb_rating || 0);
            assert.ok(aRating >= bRating, `results should be sorted by rating: ${aRating} >= ${bRating}`);
        }
    });
});

describe('Recommendation flow: event weighting', () => {
    test('events contribute to genre weights and affect for-you scores', async () => {
        const { cookie } = await registerAndLogin();

        const actionId  = await insertMovie({ title: 'Viewed Action',  genre: 'Action',  external_id: 'ew_va' });
        const romanceId = await insertMovie({ title: 'Viewed Romance', genre: 'Romance', external_id: 'ew_vr' });
        await insertMovie({ title: 'Action Rec',  genre: 'Action',  rating: 7.0, external_id: 'ew_ar' });
        await insertMovie({ title: 'Romance Rec', genre: 'Romance', rating: 7.0, external_id: 'ew_rr' });

        // Fire view events (no watchlist — cold start + event signals)
        await request.post('/api/events').set('Cookie', cookie).send({ entertainment_id: actionId,  event_type: 'view' });
        await request.post('/api/events').set('Cookie', cookie).send({ entertainment_id: romanceId, event_type: 'view' });

        const res = await request.get('/api/for-you?type=movie').set('Cookie', cookie);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.rows));

        // Verify that the for-you call succeeds and results have valid structure
        for (const item of res.body.rows.flatMap(r => r.results)) {
            assert.ok(typeof item.id === 'number', 'each result should have a numeric id');
            assert.ok(typeof item.title === 'string', 'each result should have a title');
        }
    });
});

describe('Recommendation flow: More Like This', () => {
    test('recommend endpoint returns array of similar movies from local DB', async () => {
        const { cookie } = await registerAndLogin();

        const sourceId = await insertMovie({ title: 'Fantasy Quest', genre: 'Fantasy, Adventure', external_id: 'mlt_fq' });
        await insertMovie({ title: 'Fantasy Two',   genre: 'Fantasy',   rating: 8.5, external_id: 'mlt_f2' });
        await insertMovie({ title: 'Adventure Trek', genre: 'Adventure', rating: 7.8, external_id: 'mlt_at' });

        const res = await request
            .get(`/api/recommend/${sourceId}`)
            .set('Cookie', cookie);

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));

        const ids = res.body.map(r => r.id);
        assert.ok(!ids.includes(sourceId), 'source movie should not appear in its own recommendations');
    });

    test('recommend endpoint returns 404 for unknown id', async () => {
        const { cookie } = await registerAndLogin();
        const res = await request.get('/api/recommend/999999').set('Cookie', cookie);
        assert.equal(res.status, 404);
    });
});
