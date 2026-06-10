document.addEventListener('DOMContentLoaded', async () => {
    const user = storage.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch('/api/watchlist');
        if (!res.ok) {
            if (res.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`Watchlist request failed: ${res.status}`);
        }

        const data = await res.json();
        const list = data.watchlist || [];
        updateWatchlistCount(list.length);

        if (list.length === 0) {
            document.getElementById('empty-state').classList.remove('d-none');
        } else {
            const grid = document.getElementById('movies-grid');
            grid.innerHTML = list.map(movie => window.createBackendCard(movie)).join('');
        }
    } catch (err) {
        console.error('Failed to load watchlist:', err);
        document.getElementById('empty-state').classList.remove('d-none');
        updateWatchlistCount(0);
    }
});

function updateWatchlistCount(count) {
    const countEl = document.getElementById('watchlist-count');
    if (!countEl) return;
    countEl.textContent = `${count} Movie Result${count === 1 ? '' : 's'}`;
}
