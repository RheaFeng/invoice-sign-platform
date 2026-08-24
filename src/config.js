require('dotenv').config();
const crypto = require('crypto');
const path = require('path');

function requireSecret(name, len) {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}（请参考 .env.example 配置）`);
  if (len && Buffer.from(v, 'base64').length !== len) {
    throw new Error(`${name} 必须是 ${len} 字节的 base64 编码（生成命令见 .env.example）`);
  }
  return v;
}

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),

  db: {
    client: process.env.DATABASE_CLIENT || 'better-sqlite3',
    url: process.env.DATABASE_URL || '',
    sqlitePath: path.join(__dirname, '..', 'data', 'app.db'),
  },

  security: {
    encryptionKey: process.env.ENCRYPTION_KEY
      ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64')
      : null,
    sessionSecret: process.env.SESSION_SECRET || null,
    adminInitPassword: process.env.ADMIN_INIT_PASSWORD || null,
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Invoice Platform <no-reply@localhost>',
    replyTo: process.env.MAIL_REPLY_TO || '',
  },

  reminder: {
    cron: process.env.REMINDER_CRON || '0 10 * * *',
    strategy: process.env.REMINDER_STRATEGY || 'ALL',
    intervalDays: parseInt(process.env.REMINDER_INTERVAL_DAYS || '3', 10),
    timezone: 'Asia/Shanghai',
  },
};

module.exports = config;
