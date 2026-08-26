const { verifySession } = require('../services/security');

// 从请求中提取会话令牌：
// 优先 Authorization: Bearer <token>（Vercel 上最可靠，不受浏览器 cookie 策略影响）
// 兼容旧客户端：cookie session
function getToken(req) {
  const auth = (req.headers.authorization || '').trim();
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.cookies?.session || null;
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  const payload = verifySession(token);
  if (!payload) {
    console.log('[requireAuth] 401 for', req.method, req.path,
      'authHeader=', !!req.headers.authorization,
      'cookie present=', !!req.cookies?.session);
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
