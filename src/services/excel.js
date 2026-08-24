const XLSX = require('xlsx');

// 列名 -> 语义映射
function detectColumns(headers) {
  const map = {};
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] == null ? '' : headers[i]).toLowerCase().trim();
    if (h.includes('agent name') || h === 'name') map.name = i;
    else if (h.includes('agent email') || h === 'email') map.email = i;
    else if (h.includes('invoice number') || h.includes('invoice no')) map.invoiceNumber = i;
    else if (h.includes('invoice date')) map.invoiceDate = i;
    else if (h.includes('project name') || h.includes('project')) map.projectName = i;
    else if (h.includes('billing cycle') || h.includes('billing') || h.includes('cycle')) map.billingCycle = i;
    else if (h.includes('go live rate')) map.goLiveRate = i;
    else if (h.includes('go live hours')) map.goLiveHours = i;
    else if (h.includes('training rate')) map.trainingRate = i;
    else if (h.includes('training hours') || h.includes('trainging hours')) map.trainingHours = i;
    else if (h.includes('total amount') || h.includes('total')) map.totalAmount = i;
    else if (h.includes('account type')) map.accountType = i;
    else if (h.includes('bank name') && !h.includes('(bank)')) map.bankName = i;
    else if (h.includes('registered payment platform account name')) map.platformAccountName = i;
    else if (h.includes('registered payment platform email')) map.platformEmail = i;
    else if (h.includes('personal email')) map.personalEmail = i;
    else if (h.includes('passport')) map.passport = i;
    else if (h.includes('registered platform country')) map.platformCountry = i;
    else if (h.includes('registered platform phone')) map.platformPhone = i;
    else if (h.includes('branch name')) map.bankBranch = i;
    else if (h.includes('personal address') || h.includes('street and number')) map.bankAddress = i;
    else if (h.includes('citizenship')) map.citizenship = i;
    else if (h.includes('preferred currency')) map.currency = i;
    else if (h.includes('full name of the account holder') || h.includes('account holder')) map.accountHolder = i;
    else if (h.includes('bank code') || h.includes('bic') || h.includes('swift')) map.swift = i;
    else if (h.includes('account number') || h.includes('iban')) map.iban = i;
    else if (h.includes('routing number')) map.routingNumber = i;
    else if (h.includes('account type') && h.includes('usd')) map.accountTypeUsd = i;
  }
  return map;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? null : n;
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  if (rows.length < 2) throw new Error('Excel 数据不足：至少需要表头 + 1 行数据');

  const headers = rows[0];
  const cols = detectColumns(headers);
  if (cols.name == null || cols.email == null) {
    throw new Error('未找到必需的 "Agent name" 或 "Agent email" 列');
  }

  const invoices = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = String(row[cols.name] || '').trim();
    const email = String(row[cols.email] || '').trim();
    if (!name) continue;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error(`第 ${r + 1} 行邮箱无效: "${email}"（Agent: ${name}）`);
    }

    const total = toNum(row[cols.totalAmount]);
    if (total == null) {
      throw new Error(`第 ${r + 1} 行缺少有效 Total amount（Agent: ${name}）`);
    }

    const details = [];
    if (cols.goLiveRate != null || cols.goLiveHours != null) {
      details.push({
        description: 'Go Live Service',
        rate: toNum(row[cols.goLiveRate]),
        hours: toNum(row[cols.goLiveHours]),
        amount: (toNum(row[cols.goLiveRate]) || 0) * (toNum(row[cols.goLiveHours]) || 0),
      });
    }
    if (cols.trainingRate != null || cols.trainingHours != null) {
      details.push({
        description: 'Training Service',
        rate: toNum(row[cols.trainingRate]),
        hours: toNum(row[cols.trainingHours]),
        amount: (toNum(row[cols.trainingRate]) || 0) * (toNum(row[cols.trainingHours]) || 0),
      });
    }
    if (!details.length) {
      details.push({ description: 'Service', rate: total, hours: null, amount: total });
    }

    const get = (k) => (k != null ? String(row[k] || '').trim() : '');

    // 展示字段
    const display = {
      agentName: name,
      invoiceNumber: get(cols.invoiceNumber),
      invoiceDate: get(cols.invoiceDate),
      projectName: get(cols.projectName),
      billingCycle: get(cols.billingCycle),
    };
    // 敏感字段（仅管理员可见，加密存储）
    const sensitive = {
      agentEmail: email,
      accountType: get(cols.accountType),
      bankName: get(cols.bankName),
      platformAccountName: get(cols.platformAccountName),
      platformEmail: get(cols.platformEmail),
      personalEmail: get(cols.personalEmail),
      passport: get(cols.passport),
      platformCountry: get(cols.platformCountry),
      platformPhone: get(cols.platformPhone),
      bankBranch: get(cols.bankBranch),
      bankAddress: get(cols.bankAddress),
      citizenship: get(cols.citizenship),
      currency: get(cols.currency),
      accountHolder: get(cols.accountHolder),
      swift: get(cols.swift),
      iban: get(cols.iban),
      routingNumber: get(cols.routingNumber),
      accountTypeUsd: get(cols.accountTypeUsd),
    };

    invoices.push({ display, sensitive, details, totalAmount: total });
  }

  if (!invoices.length) throw new Error('Excel 中没有有效数据行');
  return invoices;
}

module.exports = { parseExcel };
