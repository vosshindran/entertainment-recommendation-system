document.addEventListener('DOMContentLoaded', async () => {
    await loadHomepage();
});

const GENRES = [
    { id: 28,    name: 'Action',    icon: 'bi-lightning-fill' },
    { id: 35,    name: 'Comedy',    icon: 'bi-emoji-laughing-fill' },
    { id: 27,    name: 'Horror',    icon: 'bi-moon-stars-fill' },
    { id: 10749, name: 'Romance',   icon: 'bi-heart-fill' },
    { id: 878,   name: 'Sci-Fi',    icon: 'bi-rocket-fill' },
    { id: 18,    name: 'Drama',     icon: 'bi-masks-theater' },
    { id: 16,    name: 'Animation', icon: 'bi-stars' },
    { id: 53,    name: 'Thriller',  icon: 'bi-eye-fill' },
];

async function loadHomepage() {
    injectFilterBar();

    const [trending, topRated] = await Promise.all([
        api.getTrendingMovies(),
        api.getTopRatedMovies(),
    ]);

    if (trending?.results?.length) {
        const hero = trending.results[Math.floor(Math.random() * Math.min(5, trending.results.length))];
        renderHero(hero);
    }

    renderRow('trending-row', trending);
    renderRow('top-rated-row', topRated);

    const [action, comedy] = await Promise.all([
        api.getActionMovies(),
        api.getComedyMovies(),
    ]);
    renderRow('action-row', action);
    renderRow('comedy-row', comedy);
}

// ─── Improvement 2: Better hero with genre badges + star rating ──────────────
function renderHero(movie) {
    const backdropUrl = api.getImageUrl(movie.backdrop_path, 'original');
    const banner = document.getElementById('hero-banner');
    if (banner && backdropUrl) banner.style.backgroundImage = `url(${backdropUrl})`;

    setText('hero-title', movie.title || movie.name);
    setText('hero-overview', truncate(movie.overview || '', 150));

    // Rating stars
    const ratingEl = document.getElementById('hero-rating');
    if (ratingEl && movie.vote_average) {
        const score = movie.vote_average.toFixed(1);
        const stars = Math.round(movie.vote_average / 2);
        ratingEl.innerHTML = `
            <span class="text-warning me-1">
                ${'<i class="bi bi-star-fill"></i>'.repeat(stars)}${'<i class="bi bi-star"></i>'.repeat(5 - stars)}
            </span>
            <span class="fw-bold">${score}</span><span class="text-muted">/10</span>
        `;
    }

    // Genre badges
    const genreEl = document.getElementById('hero-genres');
    if (genreEl && movie.genre_ids) {
        const matchedGenres = GENRES.filter(g => movie.genre_ids.includes(g.id)).slice(0, 3);
        genreEl.innerHTML = matchedGenres.map(g =>
            `<span class="badge rounded-pill me-1" style="background:rgba(0,168,225,0.2);border:1px solid var(--accent-color);color:var(--accent-color);">
                <i class="bi ${g.icon} me-1"></i>${g.name}
            </span>`
        ).join('');
    }

    const go = () => window.location.href = `pages/movie.html?id=${movie.id}`;
    setClick('hero-play', go);
    setClick('hero-info', go);
}

// ─── Improvement 3: Filter bar with genre + year + rating ────────────────────
function injectFilterBar() {
    const main = document.querySelector('main');
    if (!main) return;

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

    const bar = document.createElement('section');
    bar.id = 'filter-bar';
    bar.className = 'px-4 px-lg-5 py-3 mb-2';

    bar.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
            <span class="text-muted fw-semibold me-1" style="font-size:0.85rem;">
                <i class="bi bi-funnel-fill"></i> Genre:
            </span>
            <button class="btn btn-sm btn-primary rounded-pill genre-btn" data-id="" onclick="filterByGenre(null, this)">
                All
            </button>
            ${GENRES.map(g => `
                <button class="btn btn-sm btn-outline-secondary rounded-pill genre-btn" data-id="${g.id}" onclick="filterByGenre(${g.id}, this)">
                    <i class="bi ${g.icon}"></i> ${g.name}
                </button>
            `).join('')}
        </div>
        <div class="d-flex align-items-center gap-3 flex-wrap">
            <span class="text-muted fw-semibold" style="font-size:0.85rem;">
                <i class="bi bi-sliders"></i> Sort & Filter:
            </span>
            <select class="form-select form-select-sm w-auto bg-dark text-white border-secondary" id="sort-select" onchange="applyFilters()">
                <option value="popularity.desc">Most Popular</option>
                <option value="vote_average.desc">Highest Rated</option>
                <option value="release_date.desc">Newest First</option>
                <option value="release_date.asc">Oldest First</option>
            </select>
            <select class="form-select form-select-sm w-auto bg-dark text-white border-secondary" id="year-select" onchange="applyFilters()">
                <option value="">Any Year</option>
                ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
            </select>
            <select class="form-select form-select-sm w-auto bg-dark text-white border-secondary" id="rating-select" onchange="applyFilters()">
                <option value="">Any Rating</option>
                <option value="9">9+ ⭐⭐⭐⭐⭐</option>
                <option value="8">8+ ⭐⭐⭐⭐</option>
                <option value="7">7+ ⭐⭐⭐</option>
                <option value="6">6+ ⭐⭐</option>
            </select>
        </div>
        <hr class="border-secondary mt-3 mb-0">
    `;

    main.insertAdjacentElement('afterbegin', bar);
}

let activeGenreId = null;

window.filterByGenre = async function(genreId, btn) {
    document.querySelectorAll('.genre-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-secondary');
    });
    btn.classList.remove('btn-outline-secondary');
    btn.classList.add('btn-primary');
    activeGenreId = genreId;
    await applyFilters();
};

window.applyFilters = async function() {
    const sort   = document.getElementById('sort-select')?.value || 'popularity.desc';
    const year   = document.getElementById('year-select')?.value || '';
    const rating = document.getElementById('rating-select')?.value || '';

    const existing = document.getElementById('genre-results-section');
    if (existing) existing.remove();

    document.querySelectorAll('.movie-row-container').forEach(s => s.style.display = '');

    // If all filters are default and no genre, show homepage rows
    if (!activeGenreId && !year && !rating && sort === 'popularity.desc') return;

    document.querySelectorAll('.movie-row-container').forEach(s => s.style.display = 'none');

    const main = document.querySelector('main');
    const section = document.createElement('section');
    section.id = 'genre-results-section';
    section.className = 'px-4 px-lg-5 py-4';

    const genreName = activeGenreId ? GENRES.find(g => g.id === activeGenreId)?.name : 'Movies';
    const genreIcon = activeGenreId ? GENRES.find(g => g.id === activeGenreId)?.icon : 'bi-film';

    section.innerHTML = `
        <h2 class="movie-row-title mb-4">
            <i class="bi ${genreIcon} me-2" style="color:var(--accent-color)"></i>${genreName}
        </h2>
        <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 row-cols-xl-6 g-3" id="genre-grid">
            <div class="col-12 d-flex justify-content-center py-5">
                <div class="loader"></div>
            </div>
        </div>
    `;
    main.appendChild(section);

    // Build params for TMDB discover
    const params = { sort_by: sort };
    if (activeGenreId) params.with_genres = activeGenreId;
    if (year)          params.primary_release_year = year;
    if (rating)        params['vote_average.gte'] = rating;

    const data = await api.fetchAPI('/discover/movie', params);
    const grid = document.getElementById('genre-grid');
    if (!grid) return;

    if (!data?.results?.length) {
        grid.innerHTML = '<p class="text-muted col-12">No movies found.</p>';
        return;
    }

    grid.innerHTML = data.results.map(movie => `
        <div class="col">
            <div class="movie-card" onclick="window.location.href='pages/movie.html?id=${movie.id}'">
                <img src="${api.getImageUrl(movie.poster_path)}" alt="${movie.title}" loading="lazy">
                <div class="rating"><i class="bi bi-star-fill"></i> ${movie.vote_average ? movie.vote_average.toFixed(1) : 'NR'}</div>
                <div class="movie-card-overlay">
                    <p class="movie-card-title">${movie.title}</p>
                    <p class="movie-card-meta">${movie.release_date ? movie.release_date.split('-')[0] : ''}</p>
                </div>
            </div>
        </div>
    `).join('');
};

// ─── Row renderer ─────────────────────────────────────────────────────────────
function renderRow(rowId, data) {
    const row = document.getElementById(rowId);
    if (!row) return;

    if (!data?.results?.length) {
        row.innerHTML = '<p class="text-muted p-3">No content available.</p>';
        return;
    }

    // Improvement 1: cards in rows also get the hover overlay
    row.innerHTML = data.results.map(movie => `
        <div class="movie-card" onclick="window.location.href='pages/movie.html?id=${movie.id}'">
            <img src="${api.getImageUrl(movie.poster_path)}" alt="${movie.title}" loading="lazy">
            <div class="rating"><i class="bi bi-star-fill"></i> ${movie.vote_average ? movie.vote_average.toFixed(1) : 'NR'}</div>
            <div class="movie-card-overlay">
                <p class="movie-card-title">${movie.title}</p>
                <p class="movie-card-meta">${movie.release_date ? movie.release_date.split('-')[0] : ''}</p>
            </div>
        </div>
    `).join('');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
}

function truncate(str, max) {
    return str.length > max ? str.substring(0, max) + '...' : str;
}