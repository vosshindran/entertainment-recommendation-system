document.addEventListener('DOMContentLoaded', () => {
    const user = storage.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const list = storage.getWatchlist();
    updateWatchlistCount(list.length);

    if (list.length === 0) {
        document.getElementById('empty-state').classList.remove('d-none');
    } else {
        const grid = document.getElementById('movies-grid');
        grid.innerHTML = list.map(movie => window.createMovieCard(movie)).join('');
    }
});

function updateWatchlistCount(count) {
    const countEl = document.getElementById('watchlist-count');
    if (!countEl) return;
    countEl.textContent = `${count} Movie Result${count === 1 ? '' : 's'} `;
}
