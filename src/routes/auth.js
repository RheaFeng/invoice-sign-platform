const express = require('express');
const rateLimit = require('express-rate-limit');
const { knex } = require('../db');
const { hashPassword, verifyPassword, sessionCookie } = require('../services/security');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '尝试次数过多，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 系统是否已初始化（是否有管理员账号）
router.get('/init-status', async (req, res) => {
  try {
    const admin = await knex('users').where('role', 'admin').first();
    res.json({ initialized: !!admin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 首次初始化：创建管理员（密码由管理员在网站上设置）
router.post('/init', async (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: '请填写用户名和密码' });
    if (String(password).length < 6) return res.status(400).json({ error: '密码至少 6 位' });
    const admin = await knex('users').where('role', 'admin').first();
    if (admin) return res.status(403).json({ error: '系统已初始化' });
    await knex('users').insert({
      username: String(username).trim(),
      password_hash: hashPassword(String(password)),
      display_name: String(displayName || '').trim() || String(username).trim(),
      role: 'admin',
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 登录
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await knex('users').where('username', String(username || '').trim()).first();
    if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    if (!user.active) return res.status(403).json({ error: '账号已被禁用' });
    const cookie = sessionCookie(user);
    res.cookie('session', cookie, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5, secure: req.secure || req.headers['x-forwarded-proto'] === 'https' });
    res.json({ ok: true, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 当前登录用户
router.get('/me', requireAuth, async (req, res) => {
  const user = await knex('users').where('id', req.user.uid).first();
  if (!user) return res.status(401).json({ error: '账号不存在' });
  res.json({ id: user.id, username: user.username, display_name: user.display_name, role: user.role });
});

// 登出
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

// 修改密码
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    const user = await knex('users').where('id', req.user.uid).first();
    if (!user || !verifyPassword(String(oldPassword || ''), user.password_hash)) {
      return res.status(401).json({ error: '原密码错误' });
    }
    if (String(newPassword || '').length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
    await knex('users').where('id', user.id).update({ password_hash: hashPassword(String(newPassword)) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== 操作用户管理（仅管理员）=====
router.get('/users', requireAdmin, async (req, res) => {
  const users = await knex('users').select('id', 'username', 'display_name', 'role', 'active', 'created_at');
  res.json(users);
});

router.post('/users', requireAdmin, async (req, res) => {
  const { username, password, displayName, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '请填写用户名和密码' });
  if (String(password).length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  const exists = await knex('users').where('username', String(username).trim()).first();
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  await knex('users').insert({
    username: String(username).trim(),
    password_hash: hashPassword(String(password)),
    display_name: String(displayName || '').trim(),
    role: role === 'admin' ? 'admin' : 'operator',
  });
  res.json({ ok: true });
});

router.put('/users/:id', requireAdmin, async (req, res) => {
  const { displayName, role, active, password } = req.body || {};
  const update = {};
  if (displayName !== undefined) update.display_name = String(displayName).trim();
  if (role !== undefined) update.role = role === 'admin' ? 'admin' : 'operator';
  if (active !== undefined) update.active = !!active;
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: '密码至少 6 位' });
    update.password_hash = hashPassword(String(password));
  }
  const target = await knex('users').where('id', req.params.id).first();
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.role === 'admin' && target.id === req.user.uid && (active === false || (role && role !== 'admin'))) {
    return res.status(400).json({ error: '不能禁用/降级自己' });
  }
  await knex('users').where('id', req.params.id).update(update);
  res.json({ ok: true });
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  const target = await knex('users').where('id', req.params.id).first();
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.id === req.user.uid) return res.status(400).json({ error: '不能删除自己' });
  await knex('users').where('id', req.params.id).del();
  res.json({ ok: true });
});

module.exports = router;
