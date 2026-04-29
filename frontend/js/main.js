document.addEventListener('DOMContentLoaded', async () => {
    // Load personalised row independently so it doesn't block the main fetch
    loadForYouRow();

    try {
        // Fetch Data
        const [trending, topRated, action, comedy] = await Promise.all([
            api.getTrendingMovies(),
            api.getTopRatedMovies(),
            api.getActionMovies(),
            api.getComedyMovies()
        ]);

        // Render Hero Banner (Use first trending movie)
        if (trending && trending.results.length > 0) {
            const heroMovie = trending.results[0];
            const bannerImg = api.getImageUrl(heroMovie.backdrop_path || heroMovie.poster_path, 'original');
            document.getElementById('hero-banner').style.backgroundImage = `url(${bannerImg})`;
            document.getElementById('hero-title').textContent = heroMovie.title || heroMovie.name;
            document.getElementById('hero-overview').textContent = heroMovie.overview;

            document.getElementById('hero-play').onclick = () => window.location.href = `pages/movie.html?id=${heroMovie.id}`;
            document.getElementById('hero-info').onclick = () => window.location.href = `pages/movie.html?id=${heroMovie.id}`;
        }

        // Render Rows
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
    const row = document.getElementById('for-you-row');

    const results = await api.getForYouMovies('movie');

    // null means user is not logged in — keep section hidden
    if (!results || results.length === 0) return;

    section.style.display = '';
    row.innerHTML = results.map(item => window.createBackendCard(item)).join('');
}
