// Vercel Serverless 入口
// vercel.json 将全部请求 rewrite 到本函数，由 Express 统一处理（路由 + 静态资源）
// Vercel 期望默认导出是 (req, res) 函数，因此包装一层
const { app } = require('../src/app');

// 冷启动时打印环境信息（不暴露密钥），便于排查
console.log('[vercel] cold start', {
  nodeEnv: process.env.NODE_ENV,
  databaseClient: process.env.DATABASE_CLIENT,
  databaseUrlPrefix: (process.env.DATABASE_URL || '').split(':')[0] || '(unset)',
  hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
  hasSessionSecret: !!process.env.SESSION_SECRET,
  hasAdminPassword: !!process.env.ADMIN_INIT_PASSWORD,
  vercelUrl: process.env.VERCEL_URL || '(unset)',
});

module.exports = (req, res) => app(req, res);