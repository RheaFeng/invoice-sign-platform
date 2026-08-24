const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./src/config');
const { runMigrations } = require('./src/db');
const { initMailer } = require('./src/services/mailer');
const { startScheduler } = require('./src/services/reminder');
const { hashPassword } = require('./src/services/security');
const { knex } = require('./src/db');

const app = express();

// Render 等云平台反向代理：信任 X-Forwarded-* 头
app.set('trust proxy', 1);

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

// 路由
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/sign', require('./src/routes/sign'));

// 静态资源（签署页面 + 管理后台）
app.use(express.static(path.join(__dirname, 'public')));
app.get('/sign/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sign.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.redirect('/admin'));

// 健康检查
app.get('/healthz', (req, res) => res.send('ok'));

// 404 / 错误处理
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

async function ensureInitAdmin() {
  const admin = await knex('users').where('role', 'admin').first();
  if (!admin && config.security.adminInitPassword) {
    await knex('users').insert({
      username: 'admin',
      password_hash: hashPassword(config.security.adminInitPassword),
      display_name: 'Administrator',
      role: 'admin',
    });
    console.log('[init] 已使用 ADMIN_INIT_PASSWORD 创建管理员账号 admin');
  }
}

async function main() {
  await runMigrations();
  await ensureInitAdmin();
  initMailer();
  startScheduler();
  app.listen(config.port, () => {
    console.log(`============================================`);
    console.log(`  Invoice Sign Platform`);
    console.log(`  管理后台: ${config.baseUrl}/admin`);
    console.log(`  端口: ${config.port}`);
    console.log(`============================================`);
  });
}

main().catch((e) => {
  console.error('启动失败:', e);
  process.exit(1);
});
