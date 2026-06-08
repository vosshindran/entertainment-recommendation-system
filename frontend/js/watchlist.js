document.addEventListener('DOMContentLoaded', () => {
    (async () => {
        const user = storage.getUser();

        // If logged in, prefer server-side watchlist (backend items)
        if (user) {
            try {
                const res = await fetch('/api/watchlist');
                if (res.ok) {
                    const data = await res.json();
                    const list = data.watchlist || [];
                    updateWatchlistCount(list.length);
                    if (list.length === 0) {
                        document.getElementById('empty-state').classList.remove('d-none');
                    } else {
                        const grid = document.getElementById('movies-grid');
                        grid.innerHTML = list.map(movie => window.createBackendCard(movie)).join('');
                    }
                    return;
                }
            } catch (e) {
                // If server unreachable or returns error, fall back to local storage below
                console.warn('Could not fetch server watchlist, falling back to local storage');
            }
        }

        // Not logged in or server fallback: use localStorage watchlist (TMDB items)
        const list = storage.getWatchlist();
        updateWatchlistCount(list.length);
        if (list.length === 0) {
            document.getElementById('empty-state').classList.remove('d-none');
        } else {
            const grid = document.getElementById('movies-grid');
            grid.innerHTML = list.map(movie => window.createMovieCard(movie)).join('');
        }
    })();
});

function updateWatchlistCount(count) {
    const countEl = document.getElementById('watchlist-count');
    if (!countEl) return;
    countEl.textContent = `${count} Movie Result${count === 1 ? '' : 's'} `;
}
