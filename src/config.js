// Environment configuration with graceful degradation.
// The site must run fully without the WhatsApp variables (deploy today,
// wire Meta later) — anything WhatsApp-related checks `whatsappEnabled`.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Resolve a writable data directory. Preference order:
//   1. DATA_DIR env var (Render disk: /var/data)
//   2. ./data next to the project (local development, or Render free plan)
function resolveDataDir() {
  const candidates = [];
  if (process.env.DATA_DIR) candidates.push(process.env.DATA_DIR);
  candidates.push(path.join(__dirname, '..', 'data'));
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // try next candidate
    }
  }
  throw new Error('No writable data directory found');
}

const DATA_DIR = resolveDataDir();
const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const whatsapp = {
  appSecret: process.env.META_APP_SECRET || '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  adminNumbers: (process.env.ADMIN_WHATSAPP_NUMBERS || '')
    .split(',')
    .map((n) => n.trim().replace(/^\+/, ''))
    .filter(Boolean),
};

const whatsappEnabled = Boolean(
  whatsapp.appSecret &&
    whatsapp.verifyToken &&
    whatsapp.accessToken &&
    whatsapp.phoneNumberId &&
    whatsapp.adminNumbers.length
);

if (!whatsappEnabled) {
  console.warn(
    '[config] WhatsApp is NOT configured — the website and seed lots run normally; ' +
      'webhook, desk commands and enquiry pushes are disabled. Set META_APP_SECRET, ' +
      'WHATSAPP_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and ' +
      'ADMIN_WHATSAPP_NUMBERS to enable the live desk. See README.md section 5.'
  );
}

if (!process.env.DATA_DIR) {
  console.warn(
    `[config] DATA_DIR not set — using ${DATA_DIR}. On Render's free plan this is ` +
      'ephemeral: lots posted via WhatsApp are lost on restart. Attach a persistent ' +
      'disk on the Starter plan before live trading (see LAUNCH-CHECKLIST.md).'
  );
}

module.exports = {
  BASE_URL,
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATA_DIR,
  MEDIA_DIR,
  DB_PATH: path.join(DATA_DIR, 'amr.sqlite'),
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  whatsapp,
  whatsappEnabled,
};
