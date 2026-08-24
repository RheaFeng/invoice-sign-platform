// generate-secrets.js
// 生成部署所需的 3 个安全密钥，写入同目录 keys.txt
// 用法：node generate-secrets.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS = [
  { name: 'ENCRYPTION_KEY',       bytes: 32, desc: 'Data encryption key (cannot be changed after first use, BACK THIS UP!)' },
  { name: 'SESSION_SECRET',       bytes: 32, desc: 'Session signing secret' },
  { name: 'ADMIN_INIT_PASSWORD',  bytes: 12, desc: 'Initial admin password (change after first login, then remove env var)' }
];

const lines = [];
lines.push('# Invoice Sign Platform - Deployment Secrets');
lines.push('# Generated at: ' + new Date().toISOString());
lines.push('# ==================================================');
lines.push('');

console.log('====================================================');
console.log('  Generating 3 secrets for Render deployment');
console.log('====================================================');
console.log('');

for (const k of KEYS) {
  const value = crypto.randomBytes(k.bytes).toString('base64');
  lines.push(`${k.name}=${value}    # ${k.desc}`);
  console.log(`${k.name}=${value}`);
}

const out = lines.join('\n') + '\n';
const outPath = path.join(__dirname, 'keys.txt');
fs.writeFileSync(outPath, out, 'utf8');

console.log('');
console.log('====================================================');
console.log('  DONE. Secrets saved to: ' + outPath);
console.log('====================================================');
console.log('');
console.log('NEXT STEPS:');
console.log('  1. Copy the 3 values above into Render Environment page');
console.log('  2. Back up ENCRYPTION_KEY somewhere safe (password manager)');
console.log('  3. Delete or secure keys.txt when you are done');
console.log('  4. Continue with DEPLOY-RENDER-NEON.md step 2 (Neon DB)');
console.log('');
console.log('Press any key to close...');
try {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(0));
} catch (err) {
  setTimeout(() => process.exit(0), 3000);
}
