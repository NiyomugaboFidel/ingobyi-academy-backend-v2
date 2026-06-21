/**
 * Verify Resend + Cloudinary from backend/.env
 * Usage: npm run verify:integrations
 */
import { v2 as cloudinary } from 'cloudinary';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
import { normalizeEnv, validateEnv } from '../src/config/configuration';

loadDotenv({ path: resolve(__dirname, '../.env') });

const env = validateEnv(normalizeEnv(process.env as Record<string, unknown>));

async function verifyResend(): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;

  if (!apiKey) {
    console.log('Resend: SKIP — set RESEND_API_KEY in .env');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    console.log(`Resend: OK (from: ${from})`);
    return true;
  } catch (err) {
    console.error(`Resend: FAIL — ${(err as Error).message}`);
    return false;
  }
}

function verifyCloudinary(): boolean {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.log(
      'Cloudinary: SKIP — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or CLOUDINARY_URL)',
    );
    return false;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'ingobyi-academy/verify';
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, CLOUDINARY_API_SECRET);

  if (!signature) {
    console.error('Cloudinary: FAIL — could not generate upload signature');
    return false;
  }

  console.log(`Cloudinary: OK (cloud: ${CLOUDINARY_CLOUD_NAME}, signature generated)`);
  return true;
}

async function main(): Promise<void> {
  console.log('Checking integrations from backend/.env...\n');
  const resendOk = await verifyResend();
  const cloudinaryOk = verifyCloudinary();
  console.log('');
  if (resendOk && cloudinaryOk) {
    console.log('All configured integrations are ready.');
    process.exit(0);
  }
  if (!resendOk && !cloudinaryOk) {
    console.log('No integrations configured (optional for local dev).');
    process.exit(0);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
