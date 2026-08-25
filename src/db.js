const config = require('./config');
const fs = require('fs');
const path = require('path');

const usePg = config.db.client === 'pg';

// SQLite 需要确保目录存在；pg 模式跳过，避免 Vercel 等只读文件系统报错
if (!usePg) {
  fs.mkdirSync(path.dirname(config.db.sqlitePath), { recursive: true });
} else {
  console.log('[db] using PostgreSQL:', config.db.url.replace(/:.*@/, ':***@'));
}

const knex = require('knex')({
  client: usePg ? 'pg' : 'better-sqlite3',
  connection: usePg
    ? { connectionString: config.db.url, ssl: { rejectUnauthorized: false } }
    : { filename: config.db.sqlitePath },
  useNullAsDefault: true,
  pool: usePg ? { min: 0, max: 5 } : undefined,
});

async function runMigrations() {
  const hasTable = await knex.schema.hasTable('users');
  if (hasTable) return;

  await knex.schema.createTable('users', (t) => {
    t.increments('id');
    t.string('username', 100).notNullable().unique();
    t.string('password_hash', 200).notNullable();
    t.string('display_name', 100).defaultTo('');
    t.string('role', 20).notNullable().defaultTo('operator'); // admin / operator
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('invoices', (t) => {
    t.increments('id');
    t.string('token_hash', 64).notNullable().unique(); // sha256(sign token) 防库泄露反查
    t.text('token_enc'); // AES 加密的 token 明文（服务端还原用，用于发提醒邮件）
    t.text('invoice_number_enc');
    t.text('agent_name_enc'); // AES encrypted
    t.text('agent_email_enc');
    t.text('project_name_enc');
    t.text('billing_cycle_enc');
    t.text('invoice_date_enc');
    t.text('details_enc'); // JSON: 计费明细等展示字段
    t.text('sensitive_enc'); // JSON: 银行/收款等敏感字段（仅管理员可见）
    t.decimal('total_amount', 14, 2);
    t.string('status', 20).notNullable().defaultTo('pending'); // pending / signed / expired
    t.text('signature_image'); // base64 PNG（已签署）
    t.string('sign_type', 20); // draw / typed
    t.string('signer_name'); // 签署人姓名
    t.timestamp('signed_at');
    t.timestamp('last_reminded_at');
    t.integer('remind_count').notNullable().defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('expires_at'); // 链接有效期（可空=永不过期）
  });

  await knex.schema.createTable('settings', (t) => {
    t.string('key', 100).primary();
    t.text('value');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('reminder_drafts', (t) => {
    t.increments('id');
    t.integer('invoice_id');
    t.text('eml_content');
    t.text('recipient_enc');
    t.string('kind', 20).defaultTo('reminder'); // reminder / invitation
    t.string('status', 20).defaultTo('generated'); // generated / sent / failed
    t.text('error');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('audit_log', (t) => {
    t.increments('id');
    t.integer('user_id');
    t.string('action', 100);
    t.text('detail');
    t.string('ip', 60);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 默认布局设置
  const defaults = {
    'site.title': 'Invoice Signing Portal',
    'site.logo': '',
    'site.theme_color': '#1a56db',
    'site.primary_text': '',
    'site.sign_heading': 'Please review and sign your invoice',
    'site.sign_subtext': 'Review the invoice details below, then sign to confirm. Your signature confirms the information is correct.',
    'site.footer': 'This link is private and for you only. Do not share it.',
    'mail.invite_subject': '【Need your signature】Please sign the invoice and scan back- {projectName}',
    'mail.reminder_subject': '【Reminder】Please sign the invoice - {projectName}',
    'mail.invite_body': '',
    'mail.reminder_body': '',
    'brand.company_name': 'Thoth AI',
    'brand.department': 'HR Team',
  };
  for (const [k, v] of Object.entries(defaults)) {
    await knex('settings').insert({ key: k, value: v }).onConflict('key').ignore();
  }
}

module.exports = { knex, runMigrations };
