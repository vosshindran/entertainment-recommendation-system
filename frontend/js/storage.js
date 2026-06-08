// LocalStorage wrapper
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

        // Start migration to server in background (fire-and-forget)
        // Uses session cookie — ensure requests include credentials
        (async () => {
            try {
                await this._migrateLocalDataToServer();
            } catch (e) {
                console.warn('Migration to server failed', e);
            }
        })();

        return user;
    },

    async _migrateLocalDataToServer() {
        const user = this.getUser();
        if (!user) return;

        // helper to upsert a TMDB item and return backend id
        const upsert = async (tmdbId) => {
            try {
                const res = await fetch('/api/items/upsert_from_tmdb', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'movie', tmdb_id: String(tmdbId) })
                });
                if (!res.ok) return null;
                const data = await res.json();
                return data && data.id ? Number(data.id) : null;
            } catch (e) {
                return null;
            }
        };

        // Migrate watchlist
        try {
            const list = this.getWatchlist();
            for (const item of list) {
                const backendId = await upsert(item.id);
                if (backendId) {
                    await fetch('/api/watchlist', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ entertainment_id: backendId })
                    }).catch(() => {});
                }
            }
            // remove local watchlist after attempting migration
            localStorage.removeItem('watchlist');
        } catch (e) {
            console.warn('Watchlist migration error', e);
        }

        // Migrate reviews
        try {
            const allReviews = this.getReviews();
            for (const movieId in allReviews) {
                const reviews = allReviews[movieId] || [];
                const backendId = await upsert(movieId);
                if (!backendId) continue;
                for (const r of reviews) {
                    try {
                        await fetch('/api/reviews', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ entertainment_id: backendId, rating: r.rating, comment: r.text || r.comment || '' })
                        });
                    } catch {}
                }
            }
            // remove local reviews after attempting migration
            localStorage.removeItem('reviews');
        } catch (e) {
            console.warn('Reviews migration error', e);
        }
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
