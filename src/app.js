// Express 应用工厂 — 同时兼容常驻服务器（server.js）与 Vercel Serverless（api/index.js）
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { runMigrations, knex } = require('./db');
const { initMailer } = require('./services/mailer');
const { hashPassword } = require('./services/security');

const app = express();

// Vercel / Render 等反向代理：信任 X-Forwarded-* 头
app.set('trust proxy', true);

// 安全头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// ===== 一次性初始化（建表 + 创建管理员 + 邮件配置）=====
// Serverless 下每次冷启动执行一次；用全局 Promise 保证并发请求只初始化一次；
// 跨实例并发建表冲突（relation already exists）被捕获忽略，幂等安全。
let initPromise = null;

async function init() {
  try {
    await runMigrations();
  } catch (e) {
    if (!/already exists/i.test(e.message)) throw e;
  }
  const admin = await knex('users').where('role', 'admin').first();
  if (!admin && config.security.adminInitPassword) {
    await knex('users')
      .insert({
        username: 'admin',
        password_hash: hashPassword(config.security.adminInitPassword),
        display_name: 'Administrator',
        role: 'admin',
      })
      .onConflict('username')
      .ignore();
    console.log('[init] 已使用 ADMIN_INIT_PASSWORD 创建管理员账号 admin');
  }
  initMailer();
}

function ensureReady() {
  if (!initPromise) {
    initPromise = init().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

// 所有请求先确保数据库就绪（必须放在路由之前才生效）
app.use((req, res, next) => {
  ensureReady().then(() => next()).catch(next);
});

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/sign', require('./routes/sign'));

// 静态资源（签署页面 + 管理后台）
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/sign/:token', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'sign.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/', (req, res) => res.redirect('/admin'));

// 健康检查
app.get('/healthz', (req, res) => res.send('ok'));

// 404 / 错误处理
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

module.exports = { app, init, ensureReady };
