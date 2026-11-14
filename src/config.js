import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const srcDir = fileURLToPath(new URL('.', import.meta.url));
export const ROOT_DIR = resolve(srcDir, '..');

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || join(ROOT_DIR, 'data', 'kiosco.sqlite'),
  publicDir: join(ROOT_DIR, 'public'),
  timeZone: process.env.KIOSCO_TZ || 'America/Argentina/Buenos_Aires',
  sessionDays: Number(process.env.SESSION_DAYS || 7),
  cookieName: 'kiosco_session',
  isProduction,
  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },
  payments: {
    provider: process.env.PAYMENT_PROVIDER || 'mercadopago',
    accessToken: process.env.PAYMENT_ACCESS_TOKEN || '',
    publicKey: process.env.PAYMENT_PUBLIC_KEY || '',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || '',
    baseUrl: process.env.PAYMENT_BASE_URL || 'http://127.0.0.1:3000',
  },
  seedAdmin: {
    name: process.env.ADMIN_NAME || 'Administración',
    email: process.env.ADMIN_EMAIL || 'admin@kiosco.local',
    password: process.env.ADMIN_PASSWORD || 'Admin1234',
  },
  seedDemoStudent: {
    name: 'Alumno Demo',
    email: 'alumno@kiosco.local',
    password: 'Alumno1234',
  },
};
