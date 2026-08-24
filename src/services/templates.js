const settings = require('./settings');
const { isSmtpEnabled } = require('./mailer');
const config = require('../config');

async function getTemplates() {
  return {
    siteTitle: await settings.get('site.title', 'Invoice Signing Portal'),
    siteLogo: await settings.get('site.logo', ''),
    themeColor: await settings.get('site.theme_color', '#1a56db'),
    signHeading: await settings.get('site.sign_heading', 'Please review and sign your invoice'),
    signSubtext: await settings.get('site.sign_subtext', ''),
    footer: await settings.get('site.footer', ''),
    inviteSubject: await settings.get('mail.invite_subject', '【Need your signature】Please sign the invoice and scan back- {projectName}'),
    reminderSubject: await settings.get('mail.reminder_subject', '【Reminder】Please sign the invoice - {projectName}'),
    inviteBody: await settings.get('mail.invite_body', ''),
    reminderBody: await settings.get('mail.reminder_body', ''),
    companyName: await settings.get('brand.company_name', ''),
    department: await settings.get('brand.department', ''),
  };
}

// 把 {placeholders} 替换为发票数据
function fillTemplate(tpl, vars) {
  let s = tpl || '';
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll('{' + k + '}', v ?? '');
  }
  return s;
}

function defaultInviteBody(inv, link, tpl) {
  const company = tpl.companyName || 'the company';
  const dept = tpl.department || 'HR Team';
  return `
<p>Hi ${inv.agentName},</p>
<p>Please find attached your invoice for the work period of "<b>${inv.billingCycle}</b>" (Project: <b>${inv.projectName}</b>).</p>
<p>Kindly review the details and sign by clicking the button below:</p>
<p style="text-align:center"><a href="${link}" style="background:${tpl.themeColor};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Review &amp; Sign Invoice</a></p>
<p>If the button does not work, copy this link to your browser:<br><a href="${link}">${link}</a></p>
<p><b>Please keep the original file name when signing and returning.</b></p>
<p>Your prompt response is greatly appreciated.</p>
<p>Regards,<br>${dept}<br>${company}</p>`;
}

function defaultReminderBody(inv, link, tpl) {
  const company = tpl.companyName || 'the company';
  const dept = tpl.department || 'HR Team';
  return `
<p>Hi ${inv.agentName},</p>
<p>This is a friendly reminder that your invoice for "<b>${inv.billingCycle}</b>" (Project: <b>${inv.projectName}</b>) is still awaiting your signature.</p>
<p style="text-align:center"><a href="${link}" style="background:${tpl.themeColor};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">Sign Invoice Now</a></p>
<p>If the button does not work, copy this link to your browser:<br><a href="${link}">${link}</a></p>
<p>Your prompt response is greatly appreciated.</p>
<p>Regards,<br>${dept}<br>${company}</p>`;
}

module.exports = { getTemplates, fillTemplate, defaultInviteBody, defaultReminderBody };
