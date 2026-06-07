import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
    User, 
    Entertainment, 
    Watchlist, 
    Review, 
    SearchHistory, 
    UserEvent, 
    Counter 
} from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/streamflix';

async function runMigration() {
    console.log('--- STARTING DATABASE MIGRATION (SQLite -> MongoDB) ---');
    
    // 1. Open SQLite Connection
    const sqlitePath = path.join(__dirname, 'entertainment.db');
    console.log(`Reading from SQLite database: ${sqlitePath}`);
    const sqliteDb = new Database(sqlitePath);

    // 2. Connect to MongoDB
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // 3. Clear Existing MongoDB Collections
    console.log('Clearing existing MongoDB collections to prevent duplicates...');
    await Promise.all([
        User.deleteMany({}),
        Entertainment.deleteMany({}),
        Watchlist.deleteMany({}),
        Review.deleteMany({}),
        SearchHistory.deleteMany({}),
        UserEvent.deleteMany({}),
        Counter.deleteMany({})
    ]);
    console.log('MongoDB collections cleared.');

    // 4. Migrate Entertainment Items
    console.log('Migrating "entertainment" table...');
    const sqliteMovies = sqliteDb.prepare('SELECT * FROM entertainment').all();
    const mongoMovies = sqliteMovies.map(movie => {
        let parsedExtra = {};
        if (movie.extra) {
            try {
                parsedExtra = JSON.parse(movie.extra);
            } catch (err) {
                console.warn(`Could not parse JSON extra for movie ID ${movie.id}, inserting raw string:`, err.message);
                parsedExtra = { raw: movie.extra };
            }
        }
        return {
            id: movie.id,
            type: movie.type,
            external_id: movie.external_id,
            title: movie.title,
            description: movie.description,
            poster_url: movie.poster_url,
            release_year: movie.release_year ? Number(movie.release_year) : null,
            genre: movie.genre,
            extra: parsedExtra
        };
    });
    if (mongoMovies.length > 0) {
        await Entertainment.insertMany(mongoMovies);
        console.log(`Migrated ${mongoMovies.length} entertainment items.`);
        const maxMovieId = Math.max(...mongoMovies.map(m => m.id));
        await new Counter({ _id: 'entertainment', seq: maxMovieId }).save();
    }

    // 5. Migrate Users
    console.log('Migrating "users" table...');
    const sqliteUsers = sqliteDb.prepare('SELECT * FROM users').all();
    const mongoUsers = sqliteUsers.map(user => ({
        id: user.id,
        username: user.username?.trim() || user.email.split('@')[0],
        email: user.email,
        password: user.password,
        created_at: user.created_at ? new Date(user.created_at) : new Date()
    }));
    if (mongoUsers.length > 0) {
        await User.insertMany(mongoUsers);
        console.log(`Migrated ${mongoUsers.length} users.`);
        const maxUserId = Math.max(...mongoUsers.map(u => u.id));
        await new Counter({ _id: 'users', seq: maxUserId }).save();
    }

    // 6. Migrate Watchlist
    console.log('Migrating "watchlist" table...');
    const sqliteWatchlist = sqliteDb.prepare('SELECT * FROM watchlist').all();
    const mongoWatchlist = sqliteWatchlist.map(w => ({
        id: w.id,
        user_id: w.user_id,
        entertainment_id: w.entertainment_id,
        added_at: w.added_at ? new Date(w.added_at) : new Date(),
        watched: w.watched || 0
    }));
    if (mongoWatchlist.length > 0) {
        await Watchlist.insertMany(mongoWatchlist);
        console.log(`Migrated ${mongoWatchlist.length} watchlist records.`);
        const maxWatchlistId = Math.max(...mongoWatchlist.map(w => w.id));
        await new Counter({ _id: 'watchlist', seq: maxWatchlistId }).save();
    }

    // 7. Migrate Reviews
    console.log('Migrating "reviews" table...');
    const sqliteReviews = sqliteDb.prepare('SELECT * FROM reviews').all();
    const mongoReviews = sqliteReviews.map(r => ({
        id: r.id,
        user_id: r.user_id,
        entertainment_id: r.entertainment_id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at ? new Date(r.created_at) : new Date()
    }));
    if (mongoReviews.length > 0) {
        await Review.insertMany(mongoReviews);
        console.log(`Migrated ${mongoReviews.length} reviews.`);
        const maxReviewId = Math.max(...mongoReviews.map(r => r.id));
        await new Counter({ _id: 'reviews', seq: maxReviewId }).save();
    }

    // 8. Migrate Search History
    console.log('Migrating "search_history" table...');
    const sqliteSearchHist = sqliteDb.prepare('SELECT * FROM search_history').all();
    const mongoSearchHist = sqliteSearchHist.map(s => ({
        id: s.id,
        user_id: s.user_id,
        type: s.type,
        keyword: s.keyword,
        searched_at: s.searched_at ? new Date(s.searched_at) : new Date()
    }));
    if (mongoSearchHist.length > 0) {
        await SearchHistory.insertMany(mongoSearchHist);
        console.log(`Migrated ${mongoSearchHist.length} search history entries.`);
        const maxSearchHistId = Math.max(...mongoSearchHist.map(s => s.id));
        await new Counter({ _id: 'search_history', seq: maxSearchHistId }).save();
    }

    // 9. Migrate User Events
    console.log('Migrating "user_events" table...');
    const sqliteEvents = sqliteDb.prepare('SELECT * FROM user_events').all();
    const mongoEvents = sqliteEvents.map(e => ({
        id: e.id,
        user_id: e.user_id,
        entertainment_id: e.entertainment_id,
        event_type: e.event_type,
        created_at: e.created_at ? new Date(e.created_at) : new Date()
    }));
    if (mongoEvents.length > 0) {
        await UserEvent.insertMany(mongoEvents);
        console.log(`Migrated ${mongoEvents.length} user events.`);
        const maxEventId = Math.max(...mongoEvents.map(e => e.id));
        await new Counter({ _id: 'user_events', seq: maxEventId }).save();
    }

    // 10. Close Connections
    sqliteDb.close();
    await mongoose.connection.close();
    console.log('\nMigration completed successfully. SQLite database converted to MongoDB.');
}

runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
