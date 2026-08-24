// Vercel Serverless 入口
// vercel.json 将全部请求 rewrite 到本函数，由 Express 统一处理（路由 + 静态资源）
const { app } = require('../src/app');

module.exports = app;
