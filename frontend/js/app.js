document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    // Verify the server session is still alive; sync localStorage to match
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                window.storage.login(data.username); // keep localStorage fresh
            } else {
                window.storage.logout(); // session expired — clear stale localStorage
            }
        } else {
            window.storage.logout();
        }
    } catch {
        // server unreachable — leave localStorage as-is so UI doesn't break offline
    }
    renderNavbar();
});

function initTheme() {
    const isDark = window.storage.getDarkMode();
    applyTheme(isDark);
}

function applyTheme(isDark) {
    if (isDark) {
        document.body.classList.remove('light-mode');
    } else {
        document.body.classList.add('light-mode');
    }
    // Update toggle button text if it exists
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i> Light Mode' : '<i class="bi bi-moon-fill"></i> Dark Mode';
    }
}

function toggleTheme() {
    const isDark = !window.storage.getDarkMode();
    window.storage.setDarkMode(isDark);
    applyTheme(isDark);
}

function renderNavbar() {
    const user = window.storage.getUser();
    
    // Determine relative path depth
    const inPages = window.location.pathname.includes('/pages/');
    const basePath = inPages ? '../' : './';
    const pagesPath = inPages ? './' : './pages/';

    const navbarHTML = `
        <nav class="navbar navbar-expand-lg fixed-top">
            <div class="container-fluid">
                <a class="navbar-brand" href="${basePath}index.html">StreamFlix</a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav me-auto">
                        <li class="nav-item"><a class="nav-link" href="${basePath}index.html">Home</a></li>
                        <li class="nav-item"><a class="nav-link" href="${pagesPath}recommendations.html">Recommendations</a></li>
                        ${user ? `<li class="nav-item"><a class="nav-link" href="${pagesPath}watchlist.html">Watchlist</a></li>` : ''}
                    </ul>
                    <form class="d-flex me-3" onsubmit="event.preventDefault(); window.location.href='${pagesPath}search.html?q=' + this.search.value;">
                        <input class="form-control me-2" type="search" name="search" placeholder="Search movies..." aria-label="Search">
                    </form>
                    <ul class="navbar-nav">
                        <li class="nav-item">
                            <button id="theme-toggle-btn" class="btn btn-outline-secondary me-3" onclick="toggleTheme()">
                                ${window.storage.getDarkMode() ? '<i class="bi bi-sun-fill"></i> Light Mode' : '<i class="bi bi-moon-fill"></i> Dark Mode'}
                            </button>
                        </li>
                        ${user ? `
                            <li class="nav-item"><a class="nav-link" href="${pagesPath}profile.html"><i class="bi bi-person-circle"></i> ${user.username}</a></li>
                            <li class="nav-item"><a class="nav-link" href="#" onclick="handleLogout()">Logout</a></li>
                        ` : `
                            <li class="nav-item"><a class="btn btn-primary" href="${pagesPath}login.html">Sign In</a></li>
                        `}
                    </ul>
                </div>
            </div>
        </nav>
    `;

    // Insert at the top of the body
    document.body.insertAdjacentHTML('afterbegin', navbarHTML);
}

window.handleLogout = async function() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.storage.logout();
    window.location.reload();
};

/**
 * Common Movie Card rendering
 */
// Card renderer for items coming from the backend DB (poster_url, local id, etc.)
// This is from what I implemented where the movie was suggested based on the user's watchlist and search history, so it may not have all TMDB data fields.
window.createBackendCard = function(item) {
    const inPages = window.location.pathname.includes('/pages/');
    const detailPath = inPages ? 'movie.html' : 'pages/movie.html';
    const poster = item.poster_url || 'https://via.placeholder.com/500x750?text=No+Image';
    const extra = typeof item.extra === 'string' ? JSON.parse(item.extra || '{}') : (item.extra || {});
    const rating = extra.tmdb_rating || extra.vote_average || extra.average_rating || extra.match || null;
    return `
        <div class="movie-card" onclick="window.location.href='${detailPath}?backendId=${item.id}'">
            <img src="${poster}" alt="${item.title}" loading="lazy">
            ${rating ? `<div class="rating"><i class="bi bi-star-fill"></i> ${Number(rating).toFixed(1)}</div>` : ''}
        </div>
    `;
};

window.createMovieCard = function(movie, isWatchlist = false) {
    const imageUrl = window.api.getImageUrl(movie.poster_path);
    const inPages = window.location.pathname.includes('/pages/');
    const detailPath = inPages ? 'movie.html' : 'pages/movie.html';

    return `
        <div class="movie-card" onclick="window.location.href='${detailPath}?id=${movie.id}'">
            <img src="${imageUrl}" alt="${movie.title}" loading="lazy">
            <div class="rating"><i class="bi bi-star-fill"></i> ${movie.vote_average ? movie.vote_average.toFixed(1) : 'NR'}</div>
        </div>
    `;
};
