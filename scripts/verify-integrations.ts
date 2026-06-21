/**
 * Verify SMTP + Cloudinary from backend/.env
 * Usage: npm run verify:integrations
 */
import * as nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
import { normalizeEnv, validateEnv } from '../src/config/configuration';

loadDotenv({ path: resolve(__dirname, '../.env') });

const env = validateEnv(normalizeEnv(process.env as Record<string, unknown>));

async function verifySmtp(): Promise<boolean> {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM ?? 'noreply@ingobyi.com';

  if (!host || !user || !pass) {
    console.log('SMTP: SKIP — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: env.SMTP_PORT ?? 587,
    secure: false,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log(`SMTP: OK (${host}, from: ${from})`);
    return true;
  } catch (err) {
    console.error(`SMTP: FAIL — ${(err as Error).message}`);
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
  const smtpOk = await verifySmtp();
  const cloudinaryOk = verifyCloudinary();
  console.log('');
  if (smtpOk && cloudinaryOk) {
    console.log('All configured integrations are ready.');
    process.exit(0);
  }
  if (!smtpOk && !cloudinaryOk) {
    console.log('No integrations configured (optional for local dev).');
    process.exit(0);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
