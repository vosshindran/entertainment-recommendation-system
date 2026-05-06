document.addEventListener('DOMContentLoaded', async () => {
    const user = window.storage.getUser();

    if (user) {
        await loadForYou();
    }

    await loadGenreBrowser();
});

async function loadForYou() {
    const section = document.createElement('div');
    section.className = 'mb-5';
    section.innerHTML = `
        <h4 class="mb-3">Recommended For You</h4>
        <div id="for-you-loader" class="loader"></div>
        <div id="for-you-grid" class="movie-grid"></div>
        <p id="for-you-empty" class="text-muted d-none">Search or add to your watchlist to get personalised picks.</p>
    `;
    document.querySelector('.container').prepend(section);

    try {
        const res = await fetch('/api/for-you?type=movie');
        const data = await res.json();
        document.getElementById('for-you-loader').classList.add('d-none');

        if (data.success && data.results && data.results.length > 0) {
            document.getElementById('for-you-grid').innerHTML =
                data.results.map(item => window.createBackendCard(item)).join('');
        } else {
            document.getElementById('for-you-empty').classList.remove('d-none');
        }
    } catch (err) {
        console.error(err);
        document.getElementById('for-you-loader').classList.add('d-none');
        document.getElementById('for-you-empty').classList.remove('d-none');
    }
}

async function loadGenreBrowser() {
    try {
        const data = await api.getGenres();
        const container = document.getElementById('genres-container');

        if (data && data.genres) {
            container.innerHTML = data.genres.map(g => `
                <button class="btn btn-outline-primary genre-btn" onclick="loadGenre(${g.id}, '${g.name}')">
                    ${g.name}
                </button>
            `).join('');

            if (data.genres.length > 0) {
                loadGenre(data.genres[0].id, data.genres[0].name);
            }
        } else {
            container.innerHTML = '<p class="text-danger">Failed to load genres.</p>';
        }
    } catch (error) {
        console.error(error);
    }
}

window.loadGenre = async function(genreId, genreName) {
    document.getElementById('movies-grid').innerHTML = '';
    document.getElementById('loader').classList.remove('d-none');

    const titleEl = document.getElementById('current-genre-title');
    titleEl.classList.remove('d-none');
    titleEl.querySelector('span').textContent = genreName;

    try {
        const data = await api.getMoviesByGenre(genreId);
        document.getElementById('loader').classList.add('d-none');

        if (data && data.results) {
            const grid = document.getElementById('movies-grid');
            grid.innerHTML = data.results.map(movie => window.createMovieCard(movie)).join('');
        }
    } catch (error) {
        console.error(error);
        document.getElementById('loader').classList.add('d-none');
    }
};
