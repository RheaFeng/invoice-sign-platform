const express = require('express');
const multer = require('multer');
const config = require('../config');
const { knex } = require('../db');
const { encrypt, decrypt, encryptJson, generateToken, hashToken } = require('../services/security');
const { parseExcel } = require('../services/excel');
const { generateInvoicePdf, embedSignature } = require('../services/pdf');
const { sendInvitation, runReminder } = require('../services/reminder');
const settingsService = require('../services/settings');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth);

// ===== 统计看板 =====
router.get('/stats', async (req, res) => {
  const [pending, signed, total] = await Promise.all([
    knex('invoices').where('status', 'pending').count('* as c').first(),
    knex('invoices').where('status', 'signed').count('* as c').first(),
    knex('invoices').count('* as c').first(),
  ]);
  const recent = await knex('invoices').orderBy('created_at', 'desc').limit(5)
    .select('id', 'status', 'signed_at', 'created_at', 'total_amount', 'agent_name_enc', 'project_name_enc', 'billing_cycle_enc');
  res.json({
    pending: Number(pending.c || 0),
    signed: Number(signed.c || 0),
    total: Number(total.c || 0),
    recent: recent.map(decodeRow),
  });
});

// ===== 发票列表 =====
router.get('/invoices', async (req, res) => {
  const { status, q, page = 1, pageSize = 20 } = req.query;
  let query = knex('invoices');
  if (status && status !== 'all') query = query.where('status', status);
  if (q) {
    const like = `%${q}%`;
    // SQLite 用 LIKE；pg 用 ILIKE —— 简单处理：只支持按 id/invoice_number 过滤
    query = query.where((b) => b.where('invoice_number', 'like', like));
  }
  const totalRow = await query.clone().count('* as c').first();
  const rows = await query.orderBy('created_at', 'desc').limit(Number(pageSize)).offset((Number(page) - 1) * Number(pageSize));
  res.json({ total: Number(totalRow.c || 0), items: rows.map(decodeRow) });
});

function decodeRow(row) {
  return {
    id: row.id,
    invoiceNumber: decrypt(row.invoice_number_enc) || '',
    invoiceDate: decrypt(row.invoice_date_enc) || '',
    agentName: decrypt(row.agent_name_enc) || '',
    agentEmail: decrypt(row.agent_email_enc) || '',
    projectName: decrypt(row.project_name_enc) || '',
    billingCycle: decrypt(row.billing_cycle_enc) || '',
    totalAmount: Number(row.total_amount || 0),
    status: row.status,
    signType: row.sign_type,
    signerName: row.signer_name,
    signedAt: row.signed_at,
    remindCount: row.remind_count || 0,
    lastRemindedAt: row.last_reminded_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// 发票详情（含敏感收款信息，仅管理员/操作用户登录可见）
router.get('/invoices/:id', async (req, res) => {
  const row = await knex('invoices').where('id', req.params.id).first();
  if (!row) return res.status(404).json({ error: '发票不存在' });
  const base = decodeRow(row);
  const sensitive = decrypt(row.sensitive_enc);
  const details = decrypt(row.details_enc);
  res.json({ ...base, sensitive: sensitive ? JSON.parse(sensitive) : {}, details: details ? JSON.parse(details) : [] });
});

// 发票签署链接（管理员查看/复制/重发）
router.get('/invoices/:id/link', async (req, res) => {
  const row = await knex('invoices').where('id', req.params.id).first();
  if (!row) return res.status(404).json({ error: '发票不存在' });
  const token = decrypt(row.token_enc);
  if (!token) return res.status(500).json({ error: '无法还原签署链接' });
  res.json({ link: `${config.baseUrl}/sign/${token}` });
});

// ===== Excel 上传生成发票 =====
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 Excel 文件' });
  try {
    const invoices = parseExcel(req.file.buffer);
    const created = [];
    for (const inv of invoices) {
      const token = generateToken();
      const inserted = await knex('invoices').insert({
        token_hash: hashToken(token),
        token_enc: encrypt(token),
        invoice_number_enc: encrypt(inv.display.invoiceNumber),
        invoice_date_enc: encrypt(inv.display.invoiceDate),
        agent_name_enc: encrypt(inv.display.agentName),
        agent_email_enc: encrypt(inv.sensitive.agentEmail),
        project_name_enc: encrypt(inv.display.projectName),
        billing_cycle_enc: encrypt(inv.display.billingCycle),
        details_enc: encryptJson(inv.details),
        sensitive_enc: encryptJson(inv.sensitive),
        total_amount: inv.totalAmount,
        status: 'pending',
      }).returning('id'); // pg 与 SQLite 均返回 [{ id }]
      const id = Number(inserted[0]?.id);
      created.push({ id, agentName: inv.display.agentName, totalAmount: inv.totalAmount });
    }

    // 发送邀请邮件（SMTP 或草稿）— 并行发送，适配 Serverless 短超时
    let emailResult = { mode: 'none', draftCount: 0, sentCount: 0 };
    const sendResults = await Promise.all(invoices.map(async (inv, i) => {
      const id = created[i].id;
      const row = await knex('invoices').where('id', id).first();
      const token = decrypt(row.token_enc);
      try {
        return await sendInvitation({
          id,
          agentName: inv.display.agentName,
          agentEmail: inv.sensitive.agentEmail,
          invoiceNumber: inv.display.invoiceNumber,
          projectName: inv.display.projectName,
          billingCycle: inv.display.billingCycle,
          totalAmount: inv.totalAmount,
        }, token);
      } catch (e) {
        return { error: e.message };
      }
    }));
    for (const r of sendResults) {
      if (!r) continue;
      if (r.error) emailResult.error = r.error;
      else if (r.mode === 'sent') emailResult.sentCount++;
      else emailResult.draftCount++;
    }
    emailResult.mode = emailResult.sentCount > 0 ? 'sent' : 'draft';

    res.json({ ok: true, created: created.length, emailResult });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ===== 批量下载 =====
// 已签署：合成签名；未签署：原发票。zip 打包
router.get('/download', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(Boolean).map(Number);
    if (!ids.length) return res.status(400).json({ error: '请选择要下载的发票' });
    const rows = await knex('invoices').whereIn('id', ids);
    if (!rows.length) return res.status(404).json({ error: '未找到发票' });

    const JSZip = require('jszip');
    const zip = new JSZip();
    let okCount = 0, failCount = 0;

    for (const row of rows) {
      try {
        const inv = decodeRow(row);
        const details = JSON.parse(decrypt(row.details_enc) || '[]');
        let pdfBytes = await generateInvoicePdf({ ...inv, details });
        if (row.status === 'signed' && row.signature_image) {
          try {
            pdfBytes = await embedSignature(pdfBytes, row.signature_image);
          } catch (e) {
            console.warn('签名合成失败，下载未签名版本:', e.message);
          }
        }
        const safeName = String(inv.agentName).replace(/[\\/:*?"<>|]/g, '-');
        const safeProject = String(inv.projectName).replace(/[\\/:*?"<>|]/g, '-');
        const fileName = `${safeName} invoice_${safeProject}_${String(inv.invoiceDate).slice(0, 6) || new Date().toISOString().slice(0, 7).replace('-', '')}.pdf`;
        zip.file(fileName, pdfBytes);
        okCount++;
      } catch (e) {
        failCount++;
        console.error('生成 PDF 失败:', e.message);
      }
    }
    if (!okCount) return res.status(500).json({ error: '全部生成失败' });

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${Date.now()}.zip"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== 提醒中心 =====
// 手动触发提醒（仅管理员）
router.post('/remind/run', async (req, res) => {
  const result = await runReminder();
  res.json({ ok: true, ...result });
});

// 草稿列表
router.get('/drafts', async (req, res) => {
  const rows = await knex('reminder_drafts').orderBy('created_at', 'desc').limit(100);
  const items = rows.map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    recipient: r.recipient_enc ? decrypt(r.recipient_enc) : '',
    kind: r.kind,
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
  }));
  res.json(items);
});

// 下载草稿 .eml
router.get('/drafts/:id/eml', async (req, res) => {
  const row = await knex('reminder_drafts').where('id', req.params.id).first();
  if (!row) return res.status(404).json({ error: '草稿不存在' });
  res.setHeader('Content-Type', 'message/rfc822');
  res.setHeader('Content-Disposition', `attachment; filename="reminder_${row.id}.eml"`);
  res.send(row.eml_content);
});

// ===== 布局设置 =====
router.get('/settings', async (req, res) => {
  res.json(await settingsService.getAll());
});

router.put('/settings', async (req, res) => {
  await settingsService.setMany(req.body || {});
  res.json({ ok: true });
});

// ===== 审计日志 =====
router.get('/audit', async (req, res) => {
  const rows = await knex('audit_log').orderBy('created_at', 'desc').limit(100);
  res.json(rows);
});

module.exports = router;
