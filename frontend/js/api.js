// TMDB calls are proxied through the backend — the API key never reaches the client.
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const IMAGE_ORIGINAL_URL = 'https://image.tmdb.org/t/p/original';

const api = {
    async fetchAPI(endpoint, params = {}) {
        const queryParams = new URLSearchParams(params);
        try {
            const response = await fetch(`/api/tmdb${endpoint}?${queryParams}`);
            if (!response.ok) throw new Error('Failed to fetch data');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return null;
        }
    },

    // Get personalized recommendations from user activity
    async getForYouMovies(type = 'movie') {
        try {
            const res = await fetch(`/api/for-you?type=${encodeURIComponent(type)}`);
            if (res.status === 401) return null; // not logged in
            if (!res.ok) throw new Error(`for-you request failed: ${res.status}`);
            const data = await res.json();
            return data.success ? data.rows : [];
        } catch (error) {
            console.error('getForYouMovies error:', error);
            return [];
        }
    },

    async getTrendingMovies() {
        return this.fetchAPI('/trending/movie/week');
    },

    async getTopRatedMovies() {
        return this.fetchAPI('/movie/top_rated');
    },

    async getActionMovies() {
        return this.fetchAPI('/discover/movie', { with_genres: 28 });
    },

    async getComedyMovies() {
        return this.fetchAPI('/discover/movie', { with_genres: 35 });
    },

    async getMovieDetails(id) {
        return this.fetchAPI(`/movie/${id}`, { append_to_response: 'credits,videos' });
    },

    async searchMovies(query) {
        return this.fetchAPI('/search/movie', { query });
    },

    async getGenres() {
        return this.fetchAPI('/genre/movie/list');
    },

    async getMoviesByGenre(genreId) {
        return this.fetchAPI('/discover/movie', { with_genres: genreId });
    },

    getImageUrl(path, size = 'w500') {
        if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
        return size === 'original' ? `${IMAGE_ORIGINAL_URL}${path}` : `${IMAGE_BASE_URL}${path}`;
    }
};

window.api = api;
