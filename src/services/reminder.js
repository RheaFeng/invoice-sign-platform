const cron = require('node-cron');
const config = require('../config');
const { knex } = require('../db');
const { decrypt, encrypt } = require('./security');
const { sendMail, isSmtpEnabled } = require('./mailer');
const { getTemplates, fillTemplate, defaultInviteBody, defaultReminderBody } = require('./templates');

function decryptInv(row) {
  const details = row.details_enc ? JSON.parse(decrypt(row.details_enc) || '{}') : {};
  return {
    id: row.id,
    token: null,
    agentName: decrypt(row.agent_name_enc) || '',
    agentEmail: decrypt(row.agent_email_enc) || '',
    invoiceNumber: decrypt(row.invoice_number_enc) || '',
    invoiceDate: decrypt(row.invoice_date_enc) || '',
    projectName: decrypt(row.project_name_enc) || '',
    billingCycle: decrypt(row.billing_cycle_enc) || '',
    details: row.details_enc ? (JSON.parse(decrypt(row.details_enc) || '[]')) : [],
    totalAmount: Number(row.total_amount || 0),
    status: row.status,
  };
}

// 发送签署邀请（上传 Excel 后立即发送）
async function sendInvitation(inv, token, signBaseUrl) {
  const tpl = await getTemplates();
  const link = `${config.baseUrl}/sign/${token}`;
  const subject = fillTemplate(tpl.inviteSubject, {
    projectName: inv.projectName,
    agentName: inv.agentName,
    invoiceNumber: inv.invoiceNumber,
    billingCycle: inv.billingCycle,
  });
  const html = tpl.inviteBody && tpl.inviteBody.trim()
    ? fillTemplate(tpl.inviteBody, { projectName: inv.projectName, agentName: inv.agentName, link, billingCycle: inv.billingCycle, invoiceNumber: inv.invoiceNumber })
    : defaultInviteBody(inv, link, tpl);

  const result = await sendMail({ to: inv.agentEmail, subject, html });
  if (result.mode === 'draft') {
    await knex('reminder_drafts').insert({
      invoice_id: inv.id,
      eml_content: result.eml,
      recipient_enc: encrypt(inv.agentEmail),
      kind: 'invitation',
      status: result.error ? 'failed' : 'generated',
      error: result.error || null,
    });
  }
  return result;
}

// 每日提醒：对未签署发票发送提醒
async function runReminder() {
  console.log(`[reminder] ${new Date().toISOString()} 开始检查未签署发票...`);
  const rows = await knex('invoices').where('status', 'pending');
  const tpl = await getTemplates();
  let sent = 0, draft = 0, skipped = 0;

  for (const row of rows) {
    // INTERVAL 策略：距上次提醒不足 N 天则跳过
    if (config.reminder.strategy === 'INTERVAL') {
      const last = row.last_reminded_at ? new Date(row.last_reminded_at) : null;
      if (last && (Date.now() - last.getTime()) < config.reminder.intervalDays * 864e5) {
        skipped++;
        continue;
      }
    }

    const inv = decryptInv(row);
    if (!inv.agentEmail) { skipped++; continue; }
    // token 明文以 AES 加密存储，服务端可还原用于生成链接
    const token = decrypt(row.token_enc);
    if (!token) { skipped++; continue; }

    const link = `${config.baseUrl}/sign/${token}`;
    const subject = fillTemplate(tpl.reminderSubject, {
      projectName: inv.projectName, agentName: inv.agentName, invoiceNumber: inv.invoiceNumber, billingCycle: inv.billingCycle,
    });
    const html = tpl.reminderBody && tpl.reminderBody.trim()
      ? fillTemplate(tpl.reminderBody, { projectName: inv.projectName, agentName: inv.agentName, link, billingCycle: inv.billingCycle, invoiceNumber: inv.invoiceNumber })
      : defaultReminderBody(inv, link, tpl);

    const result = await sendMail({ to: inv.agentEmail, subject, html });
    if (result.mode === 'draft') {
      await knex('reminder_drafts').insert({
        invoice_id: inv.id,
        eml_content: result.eml,
        recipient_enc: encrypt(inv.agentEmail),
        kind: 'reminder',
        status: result.error ? 'failed' : 'generated',
        error: result.error || null,
      });
      draft++;
    } else {
      sent++;
    }
    await knex('invoices').where('id', row.id).update({
      last_reminded_at: knex.fn.now(),
      remind_count: (row.remind_count || 0) + 1,
    });
  }
  console.log(`[reminder] 完成: 已发送 ${sent}, 生成草稿 ${draft}, 跳过 ${skipped}`);
  return { sent, draft, skipped };
}

// 定时器注册
function startScheduler() {
  if (!cron.validate(config.reminder.cron)) {
    console.error(`[reminder] 无效 cron 表达式: ${config.reminder.cron}`);
    return;
  }
  cron.schedule(config.reminder.cron, async () => {
    try {
      await runReminder();
    } catch (e) {
      console.error('[reminder] 执行失败:', e.message);
    }
  }, { timezone: config.reminder.timezone });
  console.log(`[reminder] 定时任务已启动: ${config.reminder.cron} (${config.reminder.timezone})`);
}

module.exports = { sendInvitation, runReminder, startScheduler };
