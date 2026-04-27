document.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await api.getGenres();
        const container = document.getElementById('genres-container');
        
        if (data && data.genres) {
            container.innerHTML = data.genres.map(g => `
                <button class="btn btn-outline-primary genre-btn" onclick="loadGenre(${g.id}, '${g.name}')">
                    ${g.name}
                </button>
            `).join('');
            
            // Load first genre by default
            if(data.genres.length > 0) {
                loadGenre(data.genres[0].id, data.genres[0].name);
            }
        } else {
            container.innerHTML = '<p class="text-danger">Failed to load genres.</p>';
        }
    } catch (error) {
        console.error(error);
    }
});

// Make loadGenre globally accessible since it is used in an onclick handler
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
}
