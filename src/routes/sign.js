const express = require('express');
const rateLimit = require('express-rate-limit');
const { knex } = require('../db');
const { hashToken, decrypt } = require('../services/security');
const settings = require('../services/settings');

const router = express.Router();

// 防暴力枚举：每个 token 限制尝试次数
const signLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
});

function toPublicInvoice(row) {
  const details = JSON.parse(decrypt(row.details_enc) || '[]');
  return {
    id: row.id,
    invoiceNumber: decrypt(row.invoice_number_enc) || '',
    invoiceDate: decrypt(row.invoice_date_enc) || '',
    agentName: decrypt(row.agent_name_enc) || '',
    projectName: decrypt(row.project_name_enc) || '',
    billingCycle: decrypt(row.billing_cycle_enc) || '',
    details,
    totalAmount: Number(row.total_amount || 0),
    status: row.status,
    signedAt: row.signed_at,
    signType: row.sign_type,
    signerName: row.signer_name,
  };
}

// 签署页面配置（标题、主题色等，供页面渲染）
router.get('/config', async (req, res) => {
  res.json({
    siteTitle: await settings.get('site.title', 'Invoice Signing Portal'),
    siteLogo: await settings.get('site.logo', ''),
    themeColor: await settings.get('site.theme_color', '#1a56db'),
    signHeading: await settings.get('site.sign_heading', 'Please review and sign your invoice'),
    signSubtext: await settings.get('site.sign_subtext', ''),
    footer: await settings.get('site.footer', ''),
    companyName: await settings.get('brand.company_name', ''),
    department: await settings.get('brand.department', ''),
  });
});

// 凭 token 获取本人发票（仅返回本人数据）
router.get('/invoice/:token', signLimiter, async (req, res) => {
  const token = req.params.token;
  const row = await knex('invoices').where('token_hash', hashToken(token)).first();
  if (!row) {
    return res.status(404).json({ error: '链接无效或已失效' });
  }
  // 过期检查
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ error: '链接已过期，请联系发件人' });
  }
  res.json({ invoice: toPublicInvoice(row) });
});

// 提交签字
router.post('/invoice/:token/sign', signLimiter, async (req, res) => {
  const token = req.params.token;
  const { signatureImage, signType, signerName } = req.body || {};
  if (!['draw', 'typed'].includes(signType)) {
    return res.status(400).json({ error: '无效的签字方式' });
  }
  if (signType === 'draw' && !signatureImage) {
    return res.status(400).json({ error: '请先书写签名' });
  }
  if (signType === 'typed' && (!signerName || !String(signerName).trim())) {
    return res.status(400).json({ error: '请输入签名姓名' });
  }
  if (signatureImage && !/^data:image\/(png|jpeg|jpg);base64,/.test(signatureImage)) {
    return res.status(400).json({ error: '签名图片格式无效' });
  }
  if (signatureImage && signatureImage.length > 2 * 1024 * 1024) {
    return res.status(400).json({ error: '签名图片过大' });
  }

  const row = await knex('invoices').where('token_hash', hashToken(token)).first();
  if (!row) return res.status(404).json({ error: '链接无效或已失效' });
  if (row.status === 'signed') return res.status(400).json({ error: '该发票已签署，请勿重复提交' });
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ error: '链接已过期' });
  }

  const now = knex.fn.now();
  await knex('invoices').where('id', row.id).update({
    status: 'signed',
    signature_image: signatureImage || null,
    sign_type: signType,
    signer_name: signType === 'typed' ? String(signerName).trim() : decrypt(row.agent_name_enc),
    signed_at: now,
  });

  res.json({ ok: true, message: '签署成功，感谢您的确认！' });
});

module.exports = router;
