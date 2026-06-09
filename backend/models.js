import mongoose from 'mongoose';

// Counter schema for auto-incrementing integer IDs
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});
export const Counter = mongoose.model('Counter', counterSchema);

// Helper function to get next sequence ID
export async function getNextSequenceValue(sequenceName) {
    const doc = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return doc.seq;
}

// User Schema
const userSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});
export const User = mongoose.model('User', userSchema);

// Entertainment: movies, TV shows, books, music items
const entertainmentSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    type: { type: String, required: true }, // 'movie', 'show', 'book', 'music'
    external_id: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    poster_url: { type: String },
    release_year: { type: Number },
    genre: { type: String },
    extra: { type: mongoose.Schema.Types.Mixed, default: {} }
});
// Create index for type and genre searching
entertainmentSchema.index({ type: 1, genre: 1 });
export const Entertainment = mongoose.model('Entertainment', entertainmentSchema);

// Watchlist Schema
const watchlistSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    user_id: { type: Number, required: true },
    entertainment_id: { type: Number, required: true },
    added_at: { type: Date, default: Date.now },
    watched: { type: Number, default: 0 } // 0 or 1
});
// Ensure unique combination of user and entertainment
watchlistSchema.index({ user_id: 1, entertainment_id: 1 }, { unique: true });
export const Watchlist = mongoose.model('Watchlist', watchlistSchema);

// Review Schema
const reviewSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    user_id: { type: Number, required: true },
    entertainment_id: { type: Number, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    created_at: { type: Date, default: Date.now }
});
export const Review = mongoose.model('Review', reviewSchema);

// Search History Schema
const searchHistorySchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    user_id: { type: Number, required: true },
    type: { type: String },
    keyword: { type: String },
    searched_at: { type: Date, default: Date.now }
});
searchHistorySchema.index({ user_id: 1 });
export const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

// User Events Schema (for recommendations)
const userEventSchema = new mongoose.Schema({
    id: { type: Number, unique: true, required: true },
    user_id: { type: Number, required: true },
    entertainment_id: { type: Number, required: true },
    event_type: { type: String, required: true, enum: ['view', 'watchlist_add', 'like'] },
    created_at: { type: Date, default: Date.now }
});
userEventSchema.index({ user_id: 1 });
export const UserEvent = mongoose.model('UserEvent', userEventSchema);
