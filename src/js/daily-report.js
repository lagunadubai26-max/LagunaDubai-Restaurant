const dayReportDate = document.getElementById('dayReportDate');
const dayReportShowBtn = document.getElementById('dayReportShowBtn');
const dayReportPdfBtn = document.getElementById('dayReportPdfBtn');
const dayReportImgBtn = document.getElementById('dayReportImgBtn');
const dayReportEl = document.getElementById('dayReport');

async function setDayReportDate() {
  let day = localDateKey(FB.clockNow());
  try {
    const openShift = await DB.shifts.getOpen();
    if (openShift && openShift.openDate) day = openShift.openDate;
  } catch(e) { console.warn('[dayreport] shift default:', e); }
  dayReportDate.value = day;
}

function fmtMoney(v) {
  return Number(v || 0).toLocaleString('ar-EG') + ' ج.م';
}

function buildDrinkTable(itemsMap) {
  const rows = Object.values(itemsMap).sort((a, b) => b.revenue - a.revenue);
  if (!rows.length) return '<div class="dr-empty">لا توجد مبيعات في هذا اليوم</div>';
  let html = '<table class="dr-table"><thead><tr><th>المشروب / المنتج</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>';
  rows.forEach(r => {
    html += '<tr><td>' + escapeHtml(r.name) + (r.hasMilk ? ' (+حليب)' : '') + (r.note ? ' <span style="color:#888;font-size:11px">(' + escapeHtml(r.note) + ')</span>' : '') + '</td><td>' + r.qty + '</td><td>' + fmtMoney(r.revenue) + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function buildReturnTable(returns) {
  if (!returns.length) return '<div class="dr-empty">لا توجد مرتجعات في هذا اليوم</div>';
  let html = '<table class="dr-table"><thead><tr><th>الوقت</th><th>المنتج</th><th>الكمية</th><th>المبلغ</th><th>السبب</th></tr></thead><tbody>';
  returns.forEach(r => {
    const t = r.date ? new Date(r.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
    html += '<tr><td>' + t + '</td><td>' + escapeHtml(r.productName || '—') + '</td><td>' + (r.qty || 1) + '</td><td style="color:#dc2626">-' + fmtMoney(r.amount) + '</td><td>' + escapeHtml(r.reason || '—') + '</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

async function resolveDayRange(dateVal, latestInvTs) {
  try {
    const shifts = await DB.shifts.all() || [];
    const sorted = shifts.filter(s => s.openDate && s.openedAt).sort((a, b) => new Date(a.openedAt) - new Date(b.openedAt));
    const i = sorted.findIndex(s => s.openDate === dateVal);
    if (i !== -1) {
      const start = new Date(sorted[i].openedAt);
      let end = null;
      if (i + 1 < sorted.length) end = new Date(sorted[i + 1].openedAt);
      else if (sorted[i].closedAt) end = new Date(sorted[i].closedAt);
      else end = new Date(Math.max(FB.clockNow().getTime(), latestInvTs || 0));
      return { start, end };
    }
  } catch(e) { console.warn('[dayreport] range:', e); }
  return { start: new Date(dateVal + 'T00:00:00Z'), end: new Date(dateVal + 'T23:59:59.999Z') };
}

function buildItemsMap(invs) {
  const m = {};
  (invs || []).forEach(inv => {
    (inv.items || []).forEach(it => {
      const key = (it.name || '') + '|' + (it.hasMilk ? '1' : '0') + '|' + (it.note || '');
      if (!m[key]) m[key] = { name: it.name || '\u0645\u0646\u062a\u062c', qty: 0, revenue: 0, hasMilk: !!it.hasMilk, note: it.note || '' };
      m[key].qty += Number(it.qty || 1);
      m[key].revenue += Number(it.qty || 1) * Number(it.price || 0);
    });
  });
  return m;
}

async function showDayReport() {
  const dateVal = dayReportDate.value;
  if (!dateVal) return alert('\u0627\u062e\u062a\u0631 \u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0623\u0648\u0644\u0627\u064b');
  dayReportEl.innerHTML = '<div class="dr-empty"><i class="fa-solid fa-spinner fa-spin"></i> \u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u0642\u0631\u064a\u0631...</div>';

  try {
    const [allInvoices, allExpenses, allReturns, menu, allDaycloses, allAudit] = await Promise.all([
      DB.invoices.all(), DB.expenses.all(), DB.returns.all(), DB.products.all(), DB.daycloses.all(), DB.audit.all()
    ]);

    const latestInvTs = (allInvoices || []).reduce((m, i) => i.date ? Math.max(m, new Date(i.date).getTime()) : m, 0);
    const { start, end } = await resolveDayRange(dateVal, latestInvTs);
    const dayInvoices = (allInvoices || []).filter(i => i.date && (() => { const d = new Date(i.date); return d >= start && d <= end; })());
    const dayExpenses = (allExpenses || []).filter(e => { const d = new Date(e.date); return d >= start && d <= end; });
    const dayReturns = (allReturns || []).filter(r => { const d = new Date(r.date); return d >= start && d <= end; });

    const soldInvoices = dayInvoices.filter(i => i.status !== 'returned' && i.status !== '\u0645\u0631\u062a\u062c\u0639\u0629');
    const totalSales = soldInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const totalCash = soldInvoices.filter(i => i.paymentMethod === 'Cash' || i.paymentMethod === '\u0643\u0627\u0634').reduce((s, i) => s + Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0)), 0);
    const totalCard = soldInvoices.filter(i => i.paymentMethod !== 'Cash' && i.paymentMethod !== '\u0643\u0627\u0634').reduce((s, i) => s + Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0)), 0);
    const totalExpenses = dayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalReturns = dayReturns.reduce((s, r) => s + Number(r.amount || 0), 0);
    const netProfit = totalSales - totalReturns - totalExpenses;
    const liveSales = soldInvoices.reduce((s, i) => s + Number(i.total || 0), 0);

    const dc = (allDaycloses || []).find(d => d.date === dateVal);
    const auditInvoices = (allAudit || [])
      .filter(a => a.type === 'invoice_created' && a.timestamp && (() => { const t = new Date(a.timestamp); const maxT = new Date(FB.clockNow().getTime() + 5 * 60 * 1000); return t >= start && t <= end && t <= maxT; })())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let auditHtml = '<div class="dr-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0648\u0627\u062a\u064a\u0631 \u0645\u0633\u062c\u0644\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645</div>';
    if (auditInvoices.length) {
      let rows = '';
      auditInvoices.forEach(a => {
        let det = {};
        try { det = JSON.parse(a.detail || '{}'); } catch(e) {}
        const t = new Date(a.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        rows += '<tr><td>' + t + '</td><td>' + escapeHtml(a.detail_id || det.id || '\u2014') + '</td><td>' + escapeHtml(det.customer || '\u2014') + '</td><td>' + fmtMoney(det.total || 0) + '</td><td>' + escapeHtml(det.method || '\u2014') + '</td></tr>';
      });
      auditHtml = '<table class="dr-table"><thead><tr><th>\u0627\u0644\u0648\u0642\u062a</th><th>\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</th><th>\u0627\u0644\u0639\u0645\u064a\u0644</th><th>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</th><th>\u0627\u0644\u0637\u0631\u064a\u0642\u0629</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    const summaryHtml = (title, cards, extra) =>
      '<div class="dr-header">' +
        '<img src="images/logo.png" alt="LagunaDubai">' +
        '<h2>\u0644\u0627\u062c\u0648\u0646\u0627 \u062f\u0628\u064a - \u0643\u0627\u0641\u064a\u0647 \u0648\u0645\u0637\u0639\u0645</h2>' +
        '<p>' + title + ' - ' + dateVal + '</p>' +
      '</div>' +
      '<div class="dr-summary">' + cards + '</div>' +
      '<div class="dr-title">\u0641\u0648\u0627\u062a\u064a\u0631 \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645 (\u0645\u0646 \u0633\u062c\u0644 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a)</div>' +
      auditHtml + (extra || '');

    if (dc && (Number(dc.totalSales || 0) > 0 || !auditInvoices.length)) {
      const cards =
        '<div class="card"><span>\u0639\u062f\u062f \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629</span><b>' + (dc.numInvoices || 0) + '</b></div>' +
        '<div class="card"><span>\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a</span><b>' + fmtMoney(dc.totalSales || 0) + '</b></div>' +
        '<div class="card"><span>\u0643\u0627\u0634</span><b>' + fmtMoney(dc.cashAmount || 0) + '</b></div>' +
        '<div class="card"><span>\u0634\u0628\u0643\u0629 / \u0641\u064a\u0632\u0627</span><b>' + fmtMoney(dc.cardAmount || 0) + '</b></div>' +
        '<div class="card"><span>\u0639\u062f\u062f \u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062a</span><b>' + (dc.itemsSold || 0) + '</b></div>' +
        '<div class="card"><span>\u0627\u0644\u0645\u0631\u062a\u062c\u0639\u0627\u062a</span><b style="color:#dc2626">-' + fmtMoney(dc.totalReturns || 0) + '</b></div>' +
        '<div class="card"><span>\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</span><b style="color:#dc2626">-' + fmtMoney(dc.totalExpenses || 0) + '</b></div>' +
        '<div class="card"><span>\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</span><b style="color:var(--success)">' + fmtMoney(Number(dc.totalSales || 0) - Number(dc.totalReturns || 0) - Number(dc.totalExpenses || 0)) + '</b></div>';
      const cards2 = cards + (soldInvoices.length ? '<div class="card"><span>\u0641\u0648\u0627\u062a\u064a\u0631 \u0628\u0639\u062f \u0627\u0644\u0625\u063a\u0644\u0627\u0642</span><b>' + soldInvoices.length + ' \u0641\u0627\u062a\u0648\u0631\u0629 / ' + fmtMoney(liveSales) + '</b></div>' : '');
      const liveExtra = soldInvoices.length ? '<div class="dr-title">\u0645\u0634\u0631\u0648\u0628\u0627\u062a \u0648\u0645\u0646\u062a\u062c\u0627\u062a \u0641\u0648\u0627\u062a\u064a\u0631 \u0645\u0627 \u0628\u0639\u062f \u0627\u0644\u0625\u063a\u0644\u0627\u0642</div>' + buildDrinkTable(buildItemsMap(soldInvoices)) : '';
      dayReportEl.innerHTML = summaryHtml('\u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u064a\u0648\u0645\u064a (\u0625\u063a\u0644\u0627\u0642 \u0633\u0627\u0628\u0642)', cards2, '<div class="dr-empty" style="margin-top:16px">\u26a0\ufe0f \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645 \u0627\u062a\u063a\u0644\u0642 \u0633\u0627\u0628\u0642\u064b\u0627 \u0648\u062a\u0645 \u062a\u0635\u062f\u064a\u0631 \u0641\u0648\u0627\u062a\u064a\u0631\u0647 \u0625\u0644\u0649 \u0645\u0644\u0641 Excel \u2014 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0627\u062a \u0645\u0646 \u0633\u062c\u0644 \u0627\u0644\u0625\u063a\u0644\u0627\u0642</div>' + liveExtra);
    } else if (auditInvoices.length && !soldInvoices.length) {
      const audSales = auditInvoices.reduce((s, a) => { let det = {}; try { det = JSON.parse(a.detail || '{}'); } catch(e) {} return s + Number(det.total || 0); }, 0);
      const audCash = auditInvoices.reduce((s, a) => { let det = {}; try { det = JSON.parse(a.detail || '{}'); } catch(e) {} return s + ((det.method === 'Cash' || det.method === '\u0643\u0627\u0634') ? Number(det.total || 0) : 0); }, 0);
      const cards =
        '<div class="card"><span>\u0639\u062f\u062f \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631</span><b>' + auditInvoices.length + '</b></div>' +
        '<div class="card"><span>\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a</span><b>' + fmtMoney(audSales) + '</b></div>' +
        '<div class="card"><span>\u0643\u0627\u0634</span><b>' + fmtMoney(audCash) + '</b></div>' +
        '<div class="card"><span>\u0634\u0628\u0643\u0629 / \u0641\u064a\u0632\u0627</span><b>' + fmtMoney(audSales - audCash) + '</b></div>';
      dayReportEl.innerHTML = summaryHtml('\u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u064a\u0648\u0645\u064a (\u0645\u0646 \u0633\u062c\u0644 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a)', cards, '');
    } else if (!soldInvoices.length && !dayReturns.length && !dayExpenses.length) {
      dayReportEl.innerHTML = '<div class="dr-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645</div>';
    } else {
      const itemsMap = buildItemsMap(soldInvoices);

      const totalItemsQty = Object.values(itemsMap).reduce((s, r) => s + r.qty, 0);
      const menuMap = (menu || []).reduce((m, p) => { m[p.id] = p; return m; }, {});
      let recipesCost = 0;
      Object.values(itemsMap).forEach(r => {
        const prod = menuMap[r.name] || menu.find(p => p.name === r.name);
        if (prod && prod.cost) recipesCost += Number(prod.cost) * r.qty;
      });

      dayReportEl.innerHTML =
        '<div class="dr-header">' +
          '<img src="images/logo.png" alt="LagunaDubai">' +
          '<h2>\u0644\u0627\u062c\u0648\u0646\u0627 \u062f\u0628\u064a - \u0643\u0627\u0641\u064a\u0647 \u0648\u0645\u0637\u0639\u0645</h2>' +
          '<p>\u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u064a\u0648\u0645\u064a - ' + dateVal + '</p>' +
        '</div>' +
        '<div class="dr-summary">' +
          '<div class="card"><span>\u0639\u062f\u062f \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631</span><b>' + soldInvoices.length + '</b></div>' +
          '<div class="card"><span>\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a</span><b>' + fmtMoney(totalSales) + '</b></div>' +
          '<div class="card"><span>\u0643\u0627\u0634</span><b>' + fmtMoney(totalCash) + '</b></div>' +
          '<div class="card"><span>\u0634\u0628\u0643\u0629 / \u0641\u064a\u0632\u0627</span><b>' + fmtMoney(totalCard) + '</b></div>' +
          '<div class="card"><span>\u0639\u062f\u062f \u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062a</span><b>' + totalItemsQty + '</b></div>' +
          '<div class="card"><span>\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u062e\u0627\u0645\u0627\u062a (\u062a\u0642\u0631\u064a\u0628\u064a)</span><b>' + fmtMoney(recipesCost) + '</b></div>' +
          '<div class="card"><span>\u0627\u0644\u0645\u0631\u062a\u062c\u0639\u0627\u062a</span><b style="color:#dc2626">-' + fmtMoney(totalReturns) + '</b></div>' +
          '<div class="card"><span>\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</span><b style="color:#dc2626">-' + fmtMoney(totalExpenses) + '</b></div>' +
          '<div class="card"><span>\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</span><b style="color:var(--success)">' + fmtMoney(netProfit) + '</b></div>' +
        '</div>' +
        '<div class="dr-title">\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062a \u0648\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u0645\u0628\u0627\u0639\u0629 (\u0643\u0645\u064a\u0629 \u00d7 \u0625\u064a\u0631\u0627\u062f)</div>' +
        buildDrinkTable(itemsMap) +
        '<div class="dr-title">\u0645\u0631\u062a\u062c\u0639\u0627\u062a \u0627\u0644\u064a\u0648\u0645</div>' +
        buildReturnTable(dayReturns);
    }
  } catch (e) {
    console.error('[dayreport]', e);
    dayReportEl.innerHTML = '<div class="dr-empty" style="color:#dc2626">\u062d\u062f\u062b \u062e\u0637\u0623 \u0623\u062b\u0646\u0627\u0621 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u0642\u0631\u064a\u0631: ' + escapeHtml(e.message || e) + '</div>';
  }
}
async function exportDayReport(asImage) {
  const el = dayReportEl;
  if (!el || !el.innerHTML || el.innerHTML.indexOf('dr-header') === -1) return alert('اعرض اليوم أولاً قبل التحميل');
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 900,
      windowHeight: Math.max(document.documentElement.scrollHeight, el.scrollHeight) + 500,
      scrollX: 0,
      scrollY: 0
    });
    const imgData = canvas.toDataURL('image/png');
    const fileName = 'تقرير-يومي-' + dayReportDate.value;
    if (asImage) {
      const link = document.createElement('a');
      link.href = imgData;
      link.download = fileName + '.png';
      link.click();
    } else {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(fileName + '.pdf');
    }
  } catch (e) {
    console.error('[dayreport-export]', e);
    alert('حدث خطأ أثناء التحميل: ' + escapeHtml(e.message || e));
  }
}

if (dayReportShowBtn) dayReportShowBtn.onclick = showDayReport;
if (dayReportPdfBtn) dayReportPdfBtn.onclick = () => exportDayReport(false);
if (dayReportImgBtn) dayReportImgBtn.onclick = () => exportDayReport(true);
setDayReportDate().then(showDayReport);
