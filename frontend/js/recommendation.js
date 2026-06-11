document.addEventListener('DOMContentLoaded', async () => {
    const [, tmdbGenres] = await Promise.all([loadForYou(), loadGenreBrowser()]);
    if (tmdbGenres) buildGenrePills(window._forYouRows || [], tmdbGenres);
});

// ─── Personalised rows ────────────────────────────────────────────────────────

async function loadForYou() {
    const loader = document.getElementById('for-you-loader');
    const rowsEl = document.getElementById('for-you-rows');
    const guestBox = document.getElementById('guest-box');

    try {
        const res = await fetch('/api/for-you?type=movie');

        loader.classList.add('d-none');

        if (res.status === 401) {
            guestBox.classList.remove('d-none');
            return;
        }

        const data = await res.json();
        const rows = (data.success && data.rows ? data.rows : [])
            .filter(row => row.results && row.results.length > 0)
            .slice(1); // skip first anchor — already shown on homepage

        if (rows.length === 0) {
            guestBox.classList.remove('d-none');
            document.getElementById('rec-subtitle').textContent =
                'Search for movies or open a movie page to get started';
            return;
        }

        rowsEl.innerHTML = rows.map(({ anchorTitle, results }) => `
            <div class="movie-row-container">
                ${anchorTitle ? `<p class="movie-row-subtitle">Since you added "${anchorTitle}"</p>` : ''}
                <div class="movie-row">
                    ${results.map(item => window.createBackendCard(item)).join('')}
                </div>
            </div>
        `).join('');

        window._forYouRows = rows;

    } catch (err) {
        console.error(err);
        loader.classList.add('d-none');
        guestBox.classList.remove('d-none');
    }
}

// ─── Your Genres pills ────────────────────────────────────────────────────────

function buildGenrePills(rows, tmdbGenres) {
    // Genres from the user's for-you results (personalised, shown first)
    const counts = {};
    rows.forEach(({ results }) => {
        results.forEach(item => {
            if (!item.genre) return;
            item.genre.split(',').forEach(g => {
                const name = g.trim();
                if (name) counts[name] = (counts[name] || 0) + 1;
            });
        });
    });

    const userGenres = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

    // All TMDB genres as a fallback pool
    const allTmdbNames = (tmdbGenres || []).map(g => g.name);

    // Merge: user genres first, then remaining TMDB genres not already listed
    const userSet = new Set(userGenres);
    const merged = [...userGenres, ...allTmdbNames.filter(n => !userSet.has(n))];

    if (merged.length === 0) return;

    const section = document.getElementById('genre-section');
    const pillsEl = document.getElementById('genre-pills');

    pillsEl.innerHTML = merged.map(name => `
        <button class="genre-pill" onclick="filterExploreByName('${name}', this)">${name}</button>
    `).join('');

    section.classList.remove('d-none');
}

// ─── Explore / genre browser ──────────────────────────────────────────────────

let genreMap = {};

async function loadGenreBrowser() {
    const data = await api.getGenres();
    if (!data?.genres) return null;

    data.genres.forEach(g => { genreMap[g.id] = g.name; });

    if (data.genres.length > 0) {
        loadExploreGenre(data.genres[0].id, data.genres[0].name);
    }

    return data.genres;
}

window.filterExploreByName = function(name, pillEl) {
    document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
    pillEl.classList.add('active');

    const match = Object.entries(genreMap).find(([, n]) => n === name);
    if (match) loadExploreGenre(Number(match[0]), name);
};

async function loadExploreGenre(genreId, genreName) {
    const loader = document.getElementById('explore-loader');
    const grid = document.getElementById('explore-grid');
    const label = document.getElementById('explore-genre-label');

    label.textContent = genreName;
    grid.innerHTML = '';
    loader.classList.remove('d-none');

    try {
        const data = await api.getMoviesByGenre(genreId);
        loader.classList.add('d-none');

        if (data?.results?.length > 0) {
            grid.innerHTML = data.results.map(movie => window.createMovieCard(movie)).join('');
        }
    } catch (err) {
        console.error(err);
        loader.classList.add('d-none');
    }
}
