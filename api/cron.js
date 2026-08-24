// Vercel Cron 端点 — 每日自动提醒未签署发票
// Vercel 平台会在触发时携带 Authorization: Bearer <CRON_SECRET>
const { ensureReady } = require('../src/app');
const { runReminder } = require('../src/services/reminder');

module.exports = async (req, res) => {
  try {
    await ensureReady();
    const expected = process.env.CRON_SECRET;
    if (!expected) return res.status(500).json({ error: 'CRON_SECRET 未配置，请添加到环境变量' });
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${expected}`) return res.status(401).json({ error: 'unauthorized' });
    const result = await runReminder();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] 提醒执行失败:', e.message);
    res.status(500).json({ error: e.message });
  }
};
