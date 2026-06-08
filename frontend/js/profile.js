document.addEventListener('DOMContentLoaded', () => {
  const user = storage.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('profile-name').textContent = user.username;
  document.getElementById('profile-date').textContent = new Date(
    user.loggedInAt,
  ).toLocaleDateString();

  (async () => {
    // Try server-side data first
    try {
      const [watchRes, reviewsRes] = await Promise.all([
        fetch('/api/watchlist'),
        fetch('/api/my-reviews')
      ]);

      if (watchRes.ok) {
        const w = await watchRes.json();
        const watchlist = w.watchlist || [];
        document.getElementById('watchlist-count').textContent = watchlist.length;

        const latestMovieContainer = document.getElementById('latest-watchlist-movie-container');
        if (watchlist.length > 0) {
          const latest = watchlist[watchlist.length - 1];
          const poster = latest.poster_url || 'https://via.placeholder.com/160x240?text=No+Image';
          latestMovieContainer.innerHTML = `
            <a href="movie.html?backendId=${latest.id}" class="text-decoration-none">
              <img src="${poster}" alt="${latest.title}" class="img-fluid rounded mb-2" style="max-width:160px;">
              <p class="text-white fw-semibold mb-0">${latest.title}</p>
            </a>`;
        }

        // Top rated in watchlist
        if (watchlist.length > 0) {
          const withRating = watchlist.map(i => ({
            ...i,
            rating: (typeof i.extra === 'string' ? JSON.parse(i.extra || '{}').tmdb_rating : (i.extra?.tmdb_rating || i.extra?.vote_average)) || 0
          }));
          withRating.sort((a,b) => b.rating - a.rating);
          const top = withRating[0];
          const topContainer = document.getElementById('top-rated-watchlist-movie-container');
          const poster = top.poster_url || 'https://via.placeholder.com/160x240?text=No+Image';
          topContainer.innerHTML = `
            <a href="movie.html?backendId=${top.id}" class="text-decoration-none">
              <img src="${poster}" alt="${top.title}" class="img-fluid rounded mb-2" style="max-width:160px;">
              <p class="text-white fw-semibold mb-0">${top.title}</p>
            </a>`;
        }
      }

      if (reviewsRes.ok) {
        const r = await reviewsRes.json();
        const reviews = r.reviews || [];
        document.getElementById('reviews-count').textContent = reviews.length;

        if (reviews.length > 0) {
          const latest = reviews[0];
          const latestReviewContainer = document.getElementById('latest-review-container');
          latestReviewContainer.innerHTML = `
            <a href="movie.html?backendId=${latest.entertainment_id}" class="text-decoration-none">
              <div class="mb-2 text-warning">
                ${'<i class="bi bi-star-fill"></i>'.repeat(latest.rating)}
                ${'<i class="bi bi-star"></i>'.repeat(5 - latest.rating)}
              </div>
              <p class="text-white mb-1">${latest.comment || ''}</p>
              <p class="text-muted small mb-0">${latest.created_at}</p>
            </a>`;
        }
      }

      // If both failed, fall back to localStorage below
      if (!watchRes.ok && !reviewsRes.ok) throw new Error('server data unavailable');
      return;
    } catch (e) {
      console.warn('Server profile data unavailable, falling back to localStorage', e);
    }

    // LocalStorage fallback
    const watchlist = storage.getWatchlist();
    document.getElementById('watchlist-count').textContent = watchlist.length;

    const allReviews = storage.getReviews();
    let reviewCount = 0;
    const allCurrentUserReviews = [];

    for (const movieId in allReviews) {
      const currentMovieReviews = allReviews[movieId];
      const currentUserReviewsForCurrentMovie = currentMovieReviews.filter(
        (review) => review.author === user.username,
      );
      reviewCount += currentUserReviewsForCurrentMovie.length;
      const currentUserReviewsWithMovieId = currentUserReviewsForCurrentMovie.map(
        (review) => ({
          ...review,
          movieId: movieId,
        }),
      );
      allCurrentUserReviews.push(...currentUserReviewsWithMovieId);
    }
    document.getElementById('reviews-count').textContent = reviewCount;

    const latestMovieContainer = document.getElementById('latest-watchlist-movie-container');
    if (watchlist.length > 0) {
      const latestMovie = watchlist[watchlist.length - 1];
      const imageUrl = api.getImageUrl(latestMovie.poster_path);
      latestMovieContainer.innerHTML = `
        <a href="movie.html?id=${latestMovie.id}" class="text-decoration-none">
          <img src ="${imageUrl}" alt = "${latestMovie.title}" class="img-fluid rounded mb-2" style="max-width: 160px;">
          <p class="text-white fw-semibold mb-0">${latestMovie.title}</p>
        </a>`;
    }

    const latestReviewContainer = document.getElementById('latest-review-container');
    if (allCurrentUserReviews.length > 0) {
      allCurrentUserReviews.sort((a, b) => b.id - a.id);
      const latestReview = allCurrentUserReviews[0];
      latestReviewContainer.innerHTML = `
        <a href="movie.html?id=${latestReview.movieId}" class="text-decoration-none">
          <div class="mb-2 text-warning">
            ${'<i class="bi bi-star-fill"></i>'.repeat(latestReview.rating)}
            ${'<i class="bi bi-star"></i>'.repeat(5 - latestReview.rating)}
          </div>
          <p class="text-white mb-1">${latestReview.text}</p>
          <p class="text-muted small mb-0">${latestReview.date}</p>
        </a>`;
    }

    const topRatedWatchlistMovieContainer = document.getElementById('top-rated-watchlist-movie-container');
    if (watchlist.length > 0) {
      const watchlistMoviesSortedByRating = watchlist.map((x) => x);
      watchlistMoviesSortedByRating.sort((a, b) => b.vote_average - a.vote_average);
      const topRatedMovie = watchlistMoviesSortedByRating[0];
      const imageUrl = api.getImageUrl(topRatedMovie.poster_path);
      topRatedWatchlistMovieContainer.innerHTML = `
        <a href="movie.html?id=${topRatedMovie.id}" class="text-decoration-none">
          <img src="${imageUrl}" alt="topRatedMovie.title" class="img-fluid rounded mb-2" style="max-width: 160px;">
          <p class="text-white fw-semibold mb-0">${topRatedMovie.title}</p>
        </a>`;
    }
  })();
});
