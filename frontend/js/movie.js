let currentItem = null;
let currentBackendId = null; // set when loaded via ?backendId=

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const movieId   = params.get('id');
    const backendId = params.get('backendId');

    try {
        if (backendId) {
            await loadBackendItem(backendId);
        } else if (movieId) {
            await loadTMDBItem(movieId);
        } else {
            document.getElementById('content-container').innerHTML = '<h2>Item not found.</h2>';
        }
    } catch (error) {
        console.error(error);
        document.getElementById('content-container').innerHTML = '<h2>Error loading details. Check console.</h2>';
    }
});

// ─── Backend item (our DB) ────────────────────────────────────────────────────

async function loadBackendItem(backendId) {
    currentBackendId = parseInt(backendId, 10);

    const res = await fetch(`/api/item/${backendId}`);
    if (!res.ok) throw new Error('Item not found');
    currentItem = await res.json();

    const extra  = typeof currentItem.extra === 'string' ? JSON.parse(currentItem.extra || '{}') : (currentItem.extra || {});
    const rating = extra.tmdb_rating || extra.vote_average || extra.average_rating || null;
    const poster = currentItem.poster_url || 'https://via.placeholder.com/500x750?text=No+Image';

    document.getElementById('movie-title').textContent    = currentItem.title;
    document.getElementById('movie-date').textContent     = currentItem.release_year || 'N/A';
    document.getElementById('movie-rating').textContent   = rating ? Number(rating).toFixed(1) : 'NR';
    document.getElementById('movie-genres').textContent   = currentItem.genre || '';
    document.getElementById('movie-overview').textContent = currentItem.description || 'No overview available.';
    document.getElementById('movie-poster').src           = poster;
    document.getElementById('movie-poster').alt           = currentItem.title;
    document.getElementById('backdrop-container').style.backgroundImage = `url(${poster})`;

    document.getElementById('loader').classList.add('d-none');
    document.getElementById('movie-content').classList.remove('d-none');

    trackEvent(currentBackendId, 'view');
    await updateWatchlistButton();
    await renderReviews();
    setupReviewForm();
    await loadRecommendations(currentBackendId);
}

// ─── TMDB item (direct TMDB id) ───────────────────────────────────────────────

async function loadTMDBItem(movieId) {
    const movie = await api.getMovieDetails(movieId);
    if (!movie) throw new Error('Could not fetch movie');
    currentItem = movie;

    document.getElementById('movie-title').textContent    = movie.title || movie.name;
    document.getElementById('movie-date').textContent     = movie.release_date || 'N/A';
    document.getElementById('movie-rating').textContent   = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
    document.getElementById('movie-genres').textContent   = movie.genres ? movie.genres.map(g => g.name).join(', ') : '';
    document.getElementById('movie-overview').textContent = movie.overview;
    document.getElementById('movie-poster').src           = api.getImageUrl(movie.poster_path);
    document.getElementById('movie-poster').alt           = movie.title || movie.name;
    document.getElementById('backdrop-container').style.backgroundImage =
        `url(${api.getImageUrl(movie.backdrop_path || movie.poster_path, 'original')})`;

    document.getElementById('loader').classList.add('d-none');
    document.getElementById('movie-content').classList.remove('d-none');

    await updateWatchlistButton();
    await renderReviews();
    setupReviewForm();
}

// ─── Event tracking ───────────────────────────────────────────────────────────

function trackEvent(entertainmentId, eventType) {
    fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entertainment_id: entertainmentId, event_type: eventType })
    }).catch(() => {});
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

async function updateWatchlistButton() {
    const btn = document.getElementById('btn-watchlist');

    if (currentBackendId) {
        const res = await fetch('/api/watchlist');
        if (!res.ok) { btn.style.display = 'none'; return; } // not logged in
        const data = await res.json();
        const inList = (data.watchlist || []).some(i => i.id === currentBackendId);
        setWatchlistBtn(btn, inList);
    } else {
        setWatchlistBtn(btn, window.storage.isInWatchlist(currentItem.id));
    }
}

function setWatchlistBtn(btn, inList) {
    btn.innerHTML  = inList
        ? '<i class="bi bi-check-lg"></i> In Watchlist'
        : '<i class="bi bi-plus-lg"></i> Add to Watchlist';
    btn.className  = `btn ${inList ? 'btn-secondary' : 'btn-primary'} me-2`;
}

window.toggleWatchlist = async function () {
    const user = window.storage.getUser();
    if (!user) {
        alert('Please sign in to add to your watchlist.');
        window.location.href = 'login.html';
        return;
    }

    const btn    = document.getElementById('btn-watchlist');
    const inList = btn.classList.contains('btn-secondary');

    if (currentBackendId) {
        if (inList) {
            await fetch(`/api/watchlist/${currentBackendId}`, { method: 'DELETE' });
        } else {
            await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entertainment_id: currentBackendId })
            });
            trackEvent(currentBackendId, 'watchlist_add');
        }
    } else {
        inList
            ? window.storage.removeFromWatchlist(currentItem.id)
            : window.storage.addToWatchlist(currentItem);
    }

    setWatchlistBtn(btn, !inList);
};

// ─── Reviews ──────────────────────────────────────────────────────────────────

async function renderReviews() {
    const container = document.getElementById('reviews-list');

    if (currentBackendId) {
        try {
            const res  = await fetch(`/api/reviews/${currentBackendId}`);
            const data = await res.json();
            const reviews = data.reviews || [];
            container.innerHTML = reviews.length === 0
                ? '<p class="text-muted">No reviews yet. Be the first!</p>'
                : reviews.map(r => `
                    <div class="review-card">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <strong><i class="bi bi-person-circle"></i> ${escapeHtml(r.username)}</strong>
                            <span class="text-muted small">${r.created_at}</span>
                        </div>
                        <div class="mb-2 text-warning">
                            ${'<i class="bi bi-star-fill"></i>'.repeat(r.rating)}
                            ${'<i class="bi bi-star"></i>'.repeat(5 - r.rating)}
                        </div>
                        <p class="mb-0">${escapeHtml(r.comment || '')}</p>
                    </div>`).join('');
        } catch {
            container.innerHTML = '<p class="text-muted">Could not load reviews.</p>';
        }
    } else {
        const reviews = window.storage.getMovieReviews(currentItem.id);
        container.innerHTML = reviews.length === 0
            ? '<p class="text-muted">No reviews yet. Be the first!</p>'
            : reviews.map(r => `
                <div class="review-card">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong><i class="bi bi-person-circle"></i> ${escapeHtml(r.author)}</strong>
                        <span class="text-muted small">${r.date}</span>
                    </div>
                    <div class="mb-2 text-warning">
                        ${'<i class="bi bi-star-fill"></i>'.repeat(r.rating)}
                        ${'<i class="bi bi-star"></i>'.repeat(5 - r.rating)}
                    </div>
                    <p class="mb-0">${escapeHtml(r.text || '')}</p>
                </div>`).join('');
    }
}

function setupReviewForm() {
    document.getElementById('review-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = window.storage.getUser();
        if (!user) {
            alert('Please sign in to leave a review.');
            window.location.href = 'login.html';
            return;
        }

        const rating  = parseInt(document.getElementById('review-rating').value, 10);
        const comment = document.getElementById('review-text').value;

        if (currentBackendId) {
            const res  = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entertainment_id: currentBackendId, rating, comment })
            });
            const data = await res.json();
            if (!data.success) { alert('Could not submit review: ' + data.message); return; }
        } else {
            window.storage.addReview(currentItem.id, { author: user.username, rating, text: comment });
        }

        document.getElementById('review-form').reset();
        await renderReviews();
    });
}

// ─── Recommendations row (backend items only) ─────────────────────────────────

async function loadRecommendations(backendId) {
    const user = window.storage.getUser();
    if (!user) return;

    try {
        const res  = await fetch(`/api/recommend/${backendId}`);
        const data = await res.json();
        const items = data.results || [];
        if (items.length === 0) return;

        const section = document.createElement('div');
        section.className = 'mt-5';
        section.innerHTML = `
            <hr class="border-secondary">
            <h4 class="mb-3">More Like This</h4>
            <div class="movie-row">${items.map(i => window.createBackendCard(i)).join('')}</div>
        `;
        document.getElementById('content-container').appendChild(section);
    } catch { /* recommendations are non-critical */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
