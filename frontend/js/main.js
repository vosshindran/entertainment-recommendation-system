document.addEventListener('DOMContentLoaded', async () => {
    // load row independently
    loadForYouRow();

    try {
        const [trending, topRated, action, comedy] = await Promise.all([
            api.getTrendingMovies(),
            api.getTopRatedMovies(),
            api.getActionMovies(),
            api.getComedyMovies()
        ]);

        if (trending && trending.results.length > 0) {
            const heroMovie = trending.results[0];
            const bannerImg = api.getImageUrl(heroMovie.backdrop_path || heroMovie.poster_path, 'original');
            document.getElementById('hero-banner').style.backgroundImage = `url(${bannerImg})`;
            document.getElementById('hero-title').textContent = heroMovie.title || heroMovie.name;
            document.getElementById('hero-overview').textContent = heroMovie.overview;

            document.getElementById('hero-play').onclick = () => window.location.href = `pages/movie.html?id=${heroMovie.id}`;
            document.getElementById('hero-info').onclick = () => window.location.href = `pages/movie.html?id=${heroMovie.id}`;
        }

        const renderRow = (elementId, data) => {
            const container = document.getElementById(elementId);
            if (data && data.results) {
                container.innerHTML = data.results.map(movie => window.createMovieCard(movie)).join('');
            } else {
                container.innerHTML = '<p class="text-muted">Failed to load data.</p>';
            }
        };

        renderRow('trending-row', trending);
        renderRow('top-rated-row', topRated);
        renderRow('action-row', action);
        renderRow('comedy-row', comedy);

    } catch (error) {
        console.error("Initialization error:", error);
    }
});

async function loadForYouRow() {
    const section = document.getElementById('for-you-section');

    const rows = await api.getForYouMovies('movie');

    // user not logged in
    if (rows === null) return;

    section.style.display = '';

    const container = document.getElementById('for-you-rows');

    if (rows.length > 0 && rows[0].results.length > 0) {
        container.innerHTML = rows.map(({ anchorTitle, results }) => `
            <div class="movie-row-container mb-5">
                ${anchorTitle ? `<p class="text-muted small mb-2">Since you added "${anchorTitle}"</p>` : ''}
                <div class="movie-row">
                    ${results.map(item => window.createBackendCard(item)).join('')}
                </div>
            </div>
        `).join('');
    } else {
        // Cold start: DB empty, show TMDB trending
        document.querySelector('#for-you-section .movie-row-title').textContent = 'Popular Right Now';
        const trending = await api.getTrendingMovies();
        if (trending && trending.results && trending.results.length > 0) {
            container.innerHTML = `
                <div class="movie-row-container">
                    <div class="movie-row">
                        ${trending.results.map(movie => window.createMovieCard(movie)).join('')}
                    </div>
                </div>
            `;
        } else {
            section.style.display = 'none';
        }
    }
}
