document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    
    if (!query) {
        document.getElementById('search-query').textContent = '...';
        document.getElementById('loader').classList.add('d-none');
        return;
    }

    document.getElementById('search-query').textContent = query;

    try {
        const data = await api.searchMovies(query);
        document.getElementById('loader').classList.add('d-none');

        if (data && data.results && data.results.length > 0) {
            const grid = document.getElementById('results-grid');
            grid.innerHTML = data.results.map(movie => window.createMovieCard(movie)).join('');
        } else {
            document.getElementById('no-results').classList.remove('d-none');
        }
    } catch (error) {
        console.error(error);
        document.getElementById('loader').classList.add('d-none');
        document.getElementById('no-results').innerHTML = '<h4 class="text-danger">Error fetching results.</h4>';
        document.getElementById('no-results').classList.remove('d-none');
    }
});
