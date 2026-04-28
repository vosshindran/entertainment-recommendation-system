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

  const watchlist = storage.getWatchlist();
  document.getElementById('watchlist-count').textContent = watchlist.length;

  const allReviews = storage.getReviews();
  let reviewCount = 0;
  for (const movieId in allReviews) {
    reviewCount += allReviews[movieId].length;
  }

  let reviewCount = 0;
  for (const movieId in allReviews) {
    const currentMovieReviews = allReviews[movieId]; //all reviews from a single movie
    const currentUserReviewsForCurrentMovie = currentMovieReviews.filter(
      (review) => review.author === user.username,
    );
  }
  document.getElementById('reviews-count').textContent = reviewCount;
});
