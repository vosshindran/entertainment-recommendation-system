// Client-side state management using localStorage
const storage = {
    // Watchlist
    getWatchlist() {
        const list = localStorage.getItem('watchlist');
        return list ? JSON.parse(list) : [];
    },

    addToWatchlist(movie) {
        const list = this.getWatchlist();
        if (!list.find(m => m.id === movie.id)) {
            list.push({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                vote_average: movie.vote_average
            });
            localStorage.setItem('watchlist', JSON.stringify(list));
            return true; // Added
        }
        return false; // Already exists
    },

    removeFromWatchlist(movieId) {
        let list = this.getWatchlist();
        list = list.filter(m => m.id != movieId);
        localStorage.setItem('watchlist', JSON.stringify(list));
    },

    isInWatchlist(movieId) {
        return this.getWatchlist().some(m => m.id == movieId);
    },

    // Reviews
    getReviews() {
        const reviews = localStorage.getItem('reviews');
        return reviews ? JSON.parse(reviews) : {};
    },

    getMovieReviews(movieId) {
        const allReviews = this.getReviews();
        return allReviews[movieId] || [];
    },

    addReview(movieId, reviewObj) {
        const allReviews = this.getReviews();
        if (!allReviews[movieId]) {
            allReviews[movieId] = [];
        }
        reviewObj.id = Date.now();
        reviewObj.date = new Date().toLocaleDateString();
        allReviews[movieId].push(reviewObj);
        localStorage.setItem('reviews', JSON.stringify(allReviews));
    },

    // Auth (Mock)
    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    login(username) {
        const user = { username, loggedInAt: new Date().toISOString() };
        localStorage.setItem('user', JSON.stringify(user));
        return user;
    },

    logout() {
        localStorage.removeItem('user');
    },

    // Settings
    getDarkMode() {
        // Default is dark (true). Light mode is false.
        const mode = localStorage.getItem('darkmode');
        return mode !== null ? JSON.parse(mode) : true;
    },

    setDarkMode(isDark) {
        localStorage.setItem('darkmode', JSON.stringify(isDark));
    }
};

window.storage = storage;
