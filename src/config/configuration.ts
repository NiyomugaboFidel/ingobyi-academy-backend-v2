import { z } from 'zod';

/** Normalize legacy/alternate env names before Zod validation. */
export function normalizeEnv(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const env = { ...raw };

  if (!env.SMTP_FROM && env.EMAIL_FROM) {
    env.SMTP_FROM = env.EMAIL_FROM;
  }

  if (typeof env.SMTP_PASS === 'string') {
    env.SMTP_PASS = env.SMTP_PASS.replace(/\s+/g, '');
  }

  const cloudinaryUrl = env.CLOUDINARY_URL;
  if (
    typeof cloudinaryUrl === 'string' &&
    cloudinaryUrl.startsWith('cloudinary://')
  ) {
    const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(cloudinaryUrl);
    if (match) {
      if (!env.CLOUDINARY_API_KEY) env.CLOUDINARY_API_KEY = match[1];
      if (!env.CLOUDINARY_API_SECRET) env.CLOUDINARY_API_SECRET = match[2];
      if (!env.CLOUDINARY_CLOUD_NAME) env.CLOUDINARY_CLOUD_NAME = match[3];
    }
  }

  return env;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1h'),
  REFRESH_SECRET: z.string().min(16),
  REFRESH_EXPIRES_IN: z.string().default('180d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_SWAGGER: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  RUN_SEED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  /** Parsed into individual CLOUDINARY_* vars when set (cloudinary://key:secret@cloud). */
  CLOUDINARY_URL: z.string().optional(),
  /** Legacy alias for SMTP_FROM. */
  EMAIL_FROM: z.string().email().optional(),
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce
    .number()
    .default(process.env.NODE_ENV === 'production' ? 100 : 1000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(normalizeEnv(config));
  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }
  return result.data;
}

export default () => validateEnv(process.env);
