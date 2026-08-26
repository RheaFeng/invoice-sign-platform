const { verifySession } = require('../services/security');

function requireAuth(req, res, next) {
  const rawCookie = req.cookies?.session;
  const payload = verifySession(rawCookie);
  if (!payload) {
    console.log('[requireAuth] 401 for', req.method, req.path, 'cookie present=', !!rawCookie, 'length=', rawCookie ? rawCookie.length : 0);
    return res.status(401).json({ error: '未登录或会话已过期' });
  }
  req.user = payload;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
