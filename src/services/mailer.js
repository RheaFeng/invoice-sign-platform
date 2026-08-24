const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
let smtpEnabled = false;

function initMailer() {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    console.log('[mailer] SMTP 未配置，邮件将降级为生成 .eml 草稿（管理员在后台下载手动发送）');
    smtpEnabled = false;
    return;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  smtpEnabled = true;
  console.log(`[mailer] SMTP 已配置: ${config.smtp.user}@${config.smtp.host}`);
}

function isSmtpEnabled() { return smtpEnabled; }

async function sendMail({ to, subject, html, attachments }) {
  if (!smtpEnabled) {
    // 降级：生成 .eml 草稿
    return { mode: 'draft', eml: buildEml({ to, subject, html, attachments }) };
  }
  try {
    await transporter.sendMail({
      from: config.smtp.from,
      replyTo: config.smtp.replyTo || undefined,
      to,
      subject,
      html,
      attachments,
    });
    return { mode: 'sent' };
  } catch (e) {
    console.error('[mailer] SMTP 发送失败，降级生成草稿:', e.message);
    return { mode: 'draft', eml: buildEml({ to, subject, html, attachments }), error: e.message };
  }
}

// 构建 .eml（与 Outlook 兼容）
function buildEml({ to, subject, html, attachments }) {
  const boundary = '----=_Part_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
  const encSubject = '=?UTF-8?B?' + Buffer.from(subject, 'utf-8').toString('base64') + '?=';
  const parts = [];
  parts.push('From: ' + config.smtp.from);
  parts.push('To: ' + to);
  parts.push('Subject: ' + encSubject);
  parts.push('Date: ' + new Date().toUTCString());
  parts.push('MIME-Version: 1.0');
  parts.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');
  parts.push('X-Unsent: 1');
  parts.push('');
  parts.push('--' + boundary);
  parts.push('Content-Type: text/html; charset=UTF-8');
  parts.push('Content-Transfer-Encoding: base64');
  parts.push('');
  parts.push(Buffer.from(html, 'utf-8').toString('base64'));
  for (const att of (attachments || [])) {
    parts.push('--' + boundary);
    parts.push('Content-Type: application/pdf; name="' + att.filename + '"');
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('Content-Disposition: attachment; filename="' + att.filename + '"');
    parts.push('');
    parts.push(att.content.toString('base64'));
  }
  parts.push('--' + boundary + '--');
  return parts.join('\r\n');
}

module.exports = { initMailer, isSmtpEnabled, sendMail, buildEml };
