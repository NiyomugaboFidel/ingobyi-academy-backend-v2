/** Default local development URLs. */
export const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

export const DEFAULT_API_ORIGIN = 'http://localhost:3001';

export const DEFAULT_API_URL = `${DEFAULT_API_ORIGIN}/api`;

export const DEFAULT_GOOGLE_CALLBACK_URL = `${DEFAULT_API_URL}/auth/google/callback`;

/** @deprecated Use DEFAULT_* constants — kept for existing imports. */
export const PRODUCTION_FRONTEND_URL = DEFAULT_FRONTEND_URL;
export const PRODUCTION_API_ORIGIN = DEFAULT_API_ORIGIN;
export const PRODUCTION_API_URL = DEFAULT_API_URL;
export const PRODUCTION_GOOGLE_CALLBACK_URL = DEFAULT_GOOGLE_CALLBACK_URL;
