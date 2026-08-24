// 常驻服务器入口 — 本地调试 / 传统 PaaS 用
// Vercel Serverless 部署请用 api/index.js（本文件不会被 Vercel 调用）
const config = require('./src/config');
const { app, init } = require('./src/app');
const { startScheduler } = require('./src/services/reminder');

async function main() {
  await init();
  // Vercel 平台由 Cron 触发提醒；本地/常驻环境才启动 node-cron
  if (!process.env.VERCEL) startScheduler();
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
