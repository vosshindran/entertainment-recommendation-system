let currentMovie = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const movieId = params.get('id');

    if (!movieId) {
        document.getElementById('content-container').innerHTML = '<h2>Movie not found.</h2>';
        return;
    }

    try {
        currentMovie = await api.getMovieDetails(movieId);
        
        if (!currentMovie) throw new Error("Could not fetch movie");

        // Populate UI
        document.getElementById('movie-title').textContent = currentMovie.title || currentMovie.name;
        document.getElementById('movie-date').textContent = currentMovie.release_date || 'N/A';
        document.getElementById('movie-rating').textContent = currentMovie.vote_average ? currentMovie.vote_average.toFixed(1) : 'NR';
        document.getElementById('movie-overview').textContent = currentMovie.overview;
        document.getElementById('movie-genres').textContent = currentMovie.genres ? currentMovie.genres.map(g => g.name).join(', ') : '';
        
        const posterUrl = api.getImageUrl(currentMovie.poster_path);
        document.getElementById('movie-poster').src = posterUrl;
        
        const backdropUrl = api.getImageUrl(currentMovie.backdrop_path, 'original');
        document.getElementById('backdrop-container').style.backgroundImage = `url(${backdropUrl})`;

        // Hide loader, show content
        document.getElementById('loader').classList.add('d-none');
        document.getElementById('movie-content').classList.remove('d-none');

        updateWatchlistButton();
        renderReviews();

        // Handle Review Submit
        document.getElementById('review-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const user = storage.getUser();
            if(!user) {
                alert("Please sign in to leave a review.");
                window.location.href = 'login.html';
                return;
            }

            const review = {
                author: user.username,
                rating: document.getElementById('review-rating').value,
                text: document.getElementById('review-text').value
            };
            storage.addReview(currentMovie.id, review);
            document.getElementById('review-form').reset();
            renderReviews();
        });

    } catch (error) {
        console.error(error);
        document.getElementById('content-container').innerHTML = '<h2>Error loading movie details. Check console.</h2>';
    }
});

function updateWatchlistButton() {
    const btn = document.getElementById('btn-watchlist');
    const inList = storage.isInWatchlist(currentMovie.id);
    if (inList) {
        btn.innerHTML = '<i class="bi bi-check-lg"></i> In Watchlist';
        btn.classList.replace('btn-primary', 'btn-secondary');
    } else {
        btn.innerHTML = '<i class="bi bi-plus-lg"></i> Add to Watchlist';
        btn.classList.replace('btn-secondary', 'btn-primary');
    }
}

// Make toggleWatchlist accessible globally since it's called from onclick attribute
window.toggleWatchlist = function() {
    const user = storage.getUser();
    if(!user) {
        alert("Please sign in to add to your watchlist.");
        window.location.href = 'login.html';
        return;
    }

    const inList = storage.isInWatchlist(currentMovie.id);
    if (inList) {
        storage.removeFromWatchlist(currentMovie.id);
    } else {
        storage.addToWatchlist(currentMovie);
    }
    updateWatchlistButton();
}

function renderReviews() {
    const reviews = storage.getMovieReviews(currentMovie.id);
    const container = document.getElementById('reviews-list');
    if (reviews.length === 0) {
        container.innerHTML = '<p class="text-muted">No reviews yet. Be the first!</p>';
        return;
    }

    container.innerHTML = reviews.map(r => `
        <div class="review-card">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <strong><i class="bi bi-person-circle"></i> ${r.author}</strong>
                <span class="text-muted small">${r.date}</span>
            </div>
            <div class="mb-2 text-warning">
                ${'<i class="bi bi-star-fill"></i>'.repeat(r.rating)}
                ${'<i class="bi bi-star"></i>'.repeat(5 - r.rating)}
            </div>
            <p class="mb-0">${r.text}</p>
        </div>
    `).join('');
}
