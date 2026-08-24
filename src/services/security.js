const crypto = require('crypto');
const config = require('../config');

// ===== AES-256-GCM 字段级加密 =====
// 格式: base64(iv).base64(tag).base64(ciphertext)
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (!config.security.encryptionKey) {
    throw new Error('ENCRYPTION_KEY 未配置，无法加密敏感数据');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', config.security.encryptionKey, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

function decrypt(payload) {
  if (!payload) return payload;
  if (!config.security.encryptionKey) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', config.security.encryptionKey, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

function encryptJson(obj) {
  return encrypt(JSON.stringify(obj));
}
function decryptJson(payload) {
  const s = decrypt(payload);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

// ===== 签署令牌 =====
// 生成 128-bit 随机 token 给用户；数据库只存 sha256 哈希，防库泄露反查
function generateToken() {
  return crypto.randomBytes(16).toString('base64url');
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ===== 密码 =====
const bcrypt = require('bcryptjs');
function hashPassword(pw) { return bcrypt.hashSync(pw, 10); }
function verifyPassword(pw, hash) { return bcrypt.compareSync(pw, hash); }

// ===== 会话（签名 Cookie）=====
// 无状态：cookie 内放 {uid, role, exp} + HMAC 签名，防篡改
function signSession(payload) {
  if (!config.security.sessionSecret) throw new Error('SESSION_SECRET 未配置');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.security.sessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifySession(value) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expect = crypto.createHmac('sha256', config.security.sessionSecret).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

function sessionCookie(user) {
  return signSession({ uid: user.id, role: user.role, name: user.display_name || user.username, exp: Date.now() + 7 * 864e5 });
}

module.exports = { encrypt, decrypt, encryptJson, decryptJson, generateToken, hashToken, hashPassword, verifyPassword, signSession, verifySession, sessionCookie };
