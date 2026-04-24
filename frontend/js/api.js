// TMDB API integration
// Replace this with your actual TMDB API key
const API_KEY = '45b8d3db1f9847b47b96a0cc1920abf2';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const IMAGE_ORIGINAL_URL = 'https://image.tmdb.org/t/p/original';

const api = {
    /**python -m http.server 5500
     * Helper to perform fetch requests
     */
    async fetchAPI(endpoint, params = {}) {
        if (API_KEY === 'YOUR_TMDB_API_KEY') {
            console.error("Please set your TMDB API Key in js/api.js");
            // Return mock data if no key to avoid breaking UI entirely during dev
            return this.getMockData(endpoint);
        }

        const queryParams = new URLSearchParams({
            api_key: API_KEY,
            ...params
        });

        try {
            const response = await fetch(`${BASE_URL}${endpoint}?${queryParams}`);
            if (!response.ok) throw new Error('Failed to fetch data');
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return null;
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
    },

    getMockData(endpoint) {
        // Simple mock data for initial UI rendering if API key is missing
        const mockMovie = {
            id: 1,
            title: "Mock Movie (Set API Key)",
            poster_path: null,
            backdrop_path: null,
            vote_average: 8.5,
            overview: "Please edit js/api.js and add your TMDB API Key to see real movies."
        };
        const mockList = { results: Array(10).fill(mockMovie).map((m, i) => ({ ...m, id: i })) };

        if (endpoint.includes('/movie/')) return mockMovie;
        if (endpoint.includes('/genre/')) return { genres: [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }] };
        return mockList;
    }
};

window.api = api;
