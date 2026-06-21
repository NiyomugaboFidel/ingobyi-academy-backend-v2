/** Production deployment URLs (Vercel frontend + Railway API). */
export const PRODUCTION_FRONTEND_URL =
  'https://ingobyi-academy-frontend-v2.vercel.app';

export const PRODUCTION_API_ORIGIN =
  'https://ingobyi-academy-backend-v2-production.up.railway.app';

export const PRODUCTION_API_URL = `${PRODUCTION_API_ORIGIN}/api`;

export const PRODUCTION_GOOGLE_CALLBACK_URL = `${PRODUCTION_API_URL}/auth/google/callback`;
