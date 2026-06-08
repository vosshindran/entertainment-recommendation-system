document.addEventListener('DOMContentLoaded', async () => {
    const user = storage.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    const container = document.getElementById('reviews-list');

    // Try server-side reviews first
    try {
        const res = await fetch('/api/my-reviews');
        if (res.ok) {
            const data = await res.json();
            const reviews = data.reviews || [];
            if (reviews.length === 0) {
                document.getElementById('empty-state').classList.remove('d-none');
                return;
            }
            container.innerHTML = reviews.map(r => `
                <div class="glass-panel mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5><a href="movie.html?backendId=${r.entertainment_id}" class="text-decoration-none text-white">${r.title}</a></h5>
                        <span class="text-muted small">${r.created_at}</span>
                    </div>
                    <div class="mb-2 text-warning">
                        ${'<i class="bi bi-star-fill"></i>'.repeat(r.rating)}
                        ${'<i class="bi bi-star"></i>'.repeat(5 - r.rating)}
                    </div>
                    <p class="mb-0 text-white">${r.comment || ''}</p>
                </div>
            `).join('');
            return;
        }
    } catch (e) {
        console.warn('Could not fetch server reviews, falling back to localStorage');
    }

    // LocalStorage fallback
    const allReviews = storage.getReviews();
    let hasReviews = false;
    for (const movieId in allReviews) {
        const userReviews = allReviews[movieId].filter(r => r.author === user.username);
        if (userReviews.length > 0) {
            hasReviews = true;
            // display review with link
            const movieHTML = userReviews.map(r => `
                <div class="glass-panel mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5><a href="movie.html?id=${movieId}" class="text-decoration-none text-white">Movie ID: ${movieId}</a></h5>
                        <span class="text-muted small">${r.date}</span>
                    </div>
                    <div class="mb-2 text-warning">
                        ${'<i class="bi bi-star-fill"></i>'.repeat(r.rating)}
                        ${'<i class="bi bi-star"></i>'.repeat(5 - r.rating)}
                    </div>
                    <p class="mb-0 text-white">${r.text}</p>
                </div>
            `).join('');
            container.innerHTML += movieHTML;
        }
    }

    if (!hasReviews) {
        document.getElementById('empty-state').classList.remove('d-none');
    }
});
