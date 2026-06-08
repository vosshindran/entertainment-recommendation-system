
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load "For You" section first
        await loadForYouRow();

        // Load movie categories in parallel
        const [trending, topRated, action, comedy] = await Promise.all([
            api.getTrendingMovies(),
            api.getTopRatedMovies(),
            api.getActionMovies(),
            api.getComedyMovies()
        ]);

        // Setup hero banner
        if (trending?.results?.length > 0) {
            const heroMovie = trending.results[0];

            const bannerImg = api.getImageUrl(
                heroMovie.backdrop_path || heroMovie.poster_path,
                'original'
            );

            const heroBanner = document.getElementById('hero-banner');
            const heroTitle = document.getElementById('hero-title');
            const heroOverview = document.getElementById('hero-overview');
            const heroPlay = document.getElementById('hero-play');
            const heroInfo = document.getElementById('hero-info');

            if (heroBanner) {
                heroBanner.style.backgroundImage = `url(${bannerImg})`;
            }

            if (heroTitle) {
                heroTitle.textContent = heroMovie.title || heroMovie.name;
            }

            if (heroOverview) {
                heroOverview.textContent = heroMovie.overview;
            }

            if (heroPlay) {
                heroPlay.onclick = () => {
                    window.location.href = `pages/movie.html?id=${heroMovie.id}`;
                };
            }

            if (heroInfo) {
                heroInfo.onclick = () => {
                    window.location.href = `pages/movie.html?id=${heroMovie.id}`;
                };
            }
        }

        // Render movie rows
        renderRow('trending-row', trending);
        renderRow('top-rated-row', topRated);
        renderRow('action-row', action);
        renderRow('comedy-row', comedy);

    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// ========================
// Render movie row helper
// ========================
function renderRow(elementId, data) {
    const container = document.getElementById(elementId);

    if (!container) return;

    if (data?.results?.length > 0) {
        container.innerHTML = data.results
            .map(movie => window.createMovieCard(movie))
            .join('');
    } else {
        container.innerHTML =
            '<p class="text-muted">Failed to load data.</p>';
    }
}

// ========================
// Load personalized section
// ========================
async function loadForYouRow() {
    try {
        const section = document.getElementById('for-you-section');
        const row = document.getElementById('for-you-row');

        if (!section || !row) return;

        const results = await api.getForYouMovies('movie');

        if (results === null) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';

        if (results.length > 0) {
            const title = document.querySelector('#for-you-section .movie-row-title');
            if (title) title.textContent = 'You May Like';
            row.innerHTML = results.map(item => window.createBackendCard(item)).join('');
        } else {
            const title = document.querySelector('#for-you-section .movie-row-title');
            if (title) title.textContent = 'Popular Right Now';

            const trending = await api.getTrendingMovies();
            if (trending?.results?.length > 0) {
                row.innerHTML = trending.results.map(movie => window.createMovieCard(movie)).join('');
            } else {
                section.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('For You section failed:', error);
        const section = document.getElementById('for-you-section');
        if (section) {
            section.style.display = 'none';
        }
    }
}
