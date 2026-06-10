document.addEventListener('DOMContentLoaded', async () => {
  const user = storage.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('profile-name').textContent = user.username;
  document.getElementById('profile-date').textContent = new Date(
    user.loggedInAt,
  ).toLocaleDateString();

  let watchlist = [];
  try {
    const res = await fetch('/api/watchlist');
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      throw new Error(`Watchlist request failed: ${res.status}`);
    }

    const data = await res.json();
    watchlist = data.watchlist || [];
  } catch (error) {
    console.error('Failed to load watchlist:', error);
  }

  document.getElementById('watchlist-count').textContent = watchlist.length;

  const allReviews = storage.getReviews();
  let reviewCount = 0;
  const allCurrentUserReviews = [];

  for (const movieId in allReviews) {
    const currentMovieReviews = allReviews[movieId]; //all reviews from a single movie
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

  const latestMovieContainer = document.getElementById(
    'latest-watchlist-movie-container',
  );

  if (watchlist.length > 0) {
    const latestMovie = watchlist[0];
    const imageUrl = latestMovie.poster_url || api.getImageUrl(latestMovie.poster_path);

    latestMovieContainer.innerHTML = `
    <a href="movie.html?backendId=${latestMovie.id}" class="text-decoration-none">
      <img 
        src ="${imageUrl}"
        alt = "${latestMovie.title}" 
        class="img-fluid rounded mb-2"
        style="max-width: 160px;"
      >
      <p class="text-white fw-semibold mb-0">${latestMovie.title}</p>
    </a>
  `;
  }

  const latestReviewContainer = document.getElementById(
    'latest-review-container',
  );

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
    </a>
    `;
  }

  const topRatedWatchlistMovieContainer = document.getElementById(
    'top-rated-watchlist-movie-container',
  );

  if (watchlist.length > 0) {
    const watchlistMoviesSortedByRating = watchlist.slice();
    watchlistMoviesSortedByRating.sort((a, b) => {
      const aRating = Number((a.extra && (a.extra.tmdb_rating || a.extra.vote_average)) || 0);
      const bRating = Number((b.extra && (b.extra.tmdb_rating || b.extra.vote_average)) || 0);
      return bRating - aRating;
    });

    const topRatedMovie = watchlistMoviesSortedByRating[0];
    const imageUrl = topRatedMovie.poster_url || api.getImageUrl(topRatedMovie.poster_path);

    topRatedWatchlistMovieContainer.innerHTML = `
      <a href="movie.html?backendId=${topRatedMovie.id}" class="text-decoration-none">
        <img
          src="${imageUrl}"
          alt="${topRatedMovie.title}"
          class="img-fluid rounded mb-2"
          style="max-width: 160px;"
        >
        <p class="text-white fw-semibold mb-0">${topRatedMovie.title}</p>
      </a>
    `;
  } else {
    topRatedWatchlistMovieContainer.innerHTML = '<p class="text-muted">No movies added yet.</p>';
  }
});
