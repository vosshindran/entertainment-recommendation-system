// Client-side state management using localStorage
const storage = {
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
