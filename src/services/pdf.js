const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// 生成发票 PDF
async function generateInvoicePdf(inv) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const M = 50; // margin
  let y = 780;

  page.drawText('INVOICE', { x: M, y, size: 26, font: bold, color: rgb(0.1, 0.15, 0.35) });
  y -= 14;
  page.drawText('Invoice Number: ' + (inv.invoiceNumber || '-'), { x: M, y, size: 11, font });
  y -= 18;
  page.drawText('Invoice Date: ' + (inv.invoiceDate || '-'), { x: M, y, size: 11, font });

  y -= 40;
  // 收款人（agent）
  page.drawText('BILL TO', { x: M, y, size: 10, font: bold, color: rgb(0.4, 0.4, 0.4) });
  y -= 16;
  page.drawText(inv.agentName || '', { x: M, y, size: 14, font: bold });
  y -= 16;
  page.drawText(inv.agentEmail || '', { x: M, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

  // 项目信息（右侧）
  page.drawText('PROJECT', { x: 320, y: y + 40, size: 10, font: bold, color: rgb(0.4, 0.4, 0.4) });
  y -= 16;
  page.drawText(inv.projectName || '', { x: 320, y, size: 12, font: bold });
  y -= 16;
  page.drawText('Billing Cycle: ' + (inv.billingCycle || '-'), { x: 320, y, size: 10, font });

  y -= 50;
  // 明细表
  const tableTop = y;
  const colX = [M, 320, 420, 480];
  page.drawText('Description', { x: colX[0], y: tableTop, size: 10, font: bold });
  page.drawText('Rate', { x: colX[1], y: tableTop, size: 10, font: bold });
  page.drawText('Hours', { x: colX[2], y: tableTop, size: 10, font: bold });
  page.drawText('Amount', { x: colX[3], y: tableTop, size: 10, font: bold });
  page.drawLine({ start: { x: M, y: tableTop - 6 }, end: { x: W - M, y: tableTop - 6 }, thickness: 1, color: rgb(0.75, 0.75, 0.75) });

  let rowY = tableTop - 24;
  const rows = inv.details || [];
  for (const r of rows) {
    if (rowY < 60) { page = null; break; }
    page.drawText(r.description || '', { x: colX[0], y: rowY, size: 10, font });
    page.drawText(r.rate != null ? '$' + Number(r.rate).toFixed(2) : '', { x: colX[1], y: rowY, size: 10, font });
    page.drawText(r.hours != null ? String(r.hours) : '', { x: colX[2], y: rowY, size: 10, font });
    page.drawText(r.amount != null ? '$' + Number(r.amount).toFixed(2) : '', { x: colX[3], y: rowY, size: 10, font });
    rowY -= 20;
  }

  // 合计
  const totalY = rowY - 10;
  page.drawLine({ start: { x: M, y: totalY + 8 }, end: { x: W - M, y: totalY + 8 }, thickness: 1, color: rgb(0.75, 0.75, 0.75) });
  page.drawText('TOTAL', { x: colX[2], y: totalY, size: 12, font: bold });
  page.drawText('$' + Number(inv.totalAmount || 0).toFixed(2), { x: colX[3], y: totalY, size: 12, font: bold });

  // 签名区
  const signY = 300;
  page.drawLine({ start: { x: M, y: signY }, end: { x: 300, y: signY }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
  page.drawText('Signature', { x: M, y: signY - 16, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawLine({ start: { x: 320, y: signY }, end: { x: 470, y: signY }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
  page.drawText('Date', { x: 320, y: signY - 16, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

  return await doc.save();
}

// 已签署：把签名图片合成到 PDF 签名区
async function embedSignature(pdfBytes, signatureBase64) {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPage(0);
  let img;
  try {
    img = doc.embedPng(Buffer.from(signatureBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  } catch (e) {
    // 尝试 jpg
    img = doc.embedJpg(Buffer.from(signatureBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  }
  page.drawImage(img, { x: 52, y: 275, width: 200, height: 60 });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Signed: ' + new Date().toLocaleDateString('en-US'), { x: 320, y: 288, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  return await doc.save();
}

module.exports = { generateInvoicePdf, embedSignature };
