document.addEventListener('DOMContentLoaded', () => {
    initTheme();
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
                        <div class="search-input-group">
                             <input class="form-control" type="search" name="search" placeholder="search for a movie" aria-label="Search">
                             <span class="search-icon">
                                 <i class="bi bi-search"></i>
                             </span>
                         </div>
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

window.handleLogout = function() {
    window.storage.logout();
    window.location.reload();
};

/**
 * Common Movie Card rendering
 */
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
