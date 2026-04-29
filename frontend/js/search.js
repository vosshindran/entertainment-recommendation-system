document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    const type = params.get('type') || 'movie';

    if (!query) {
        document.getElementById('search-query').textContent = '...';
        document.getElementById('loader').classList.add('d-none');
        return;
    }

    document.getElementById('search-query').textContent = query;

    try {
        const res = await fetch(`/api/search?type=${encodeURIComponent(type)}&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        document.getElementById('loader').classList.add('d-none');

        if (data.success && data.results && data.results.length > 0) {
            const grid = document.getElementById('results-grid');
            grid.innerHTML = data.results.map(item => window.createBackendCard(item)).join('');
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
