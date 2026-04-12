const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const getAuthCookieOptions = ({ maxAge = COOKIE_MAX_AGE } = {}) => {
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };

  if (maxAge) {
    options.maxAge = maxAge;
  }

  return options;
};
