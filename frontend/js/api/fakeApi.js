export function loginUser(email, password) {
  if (email === 'test@gmail.com' && password === '123') {
    return {
      success: true,
      user: {
        name: 'Test User',
      },
    };

    return {
      success: false,
    };
  }
}

export function getMovies() {
  return [
    {
      id: 1,
      title: `Sarannya's Adventures`,
      genre: 'Sci-Fi',
    },
    {
      id: 2,
      title: `The Life of Sanchay`,
      genre: 'Horror',
    },
  ];
}
