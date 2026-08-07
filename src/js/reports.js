const monthInput = document.getElementById('reportMonth');

// Set default to current month
const now = FB.clockNow();
monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

function getMonthRange(value) {
  if (!value) {
    const d = FB.clockNow();
    value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  const [year, month] = value.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end, year, month };
}

function getPrevMonthRange(value) {
  const { year, month } = getMonthRange(value);
  if (month === 1) return getMonthRange((year - 1) + '-' + '12');
  return getMonthRange(year + '-' + String(month - 1).padStart(2, '0'));
}

function filterByDate(items, range) {
  if (!range || !range.start) return items;
  return items.filter(item => {
    if (!item.date) return false;
    const d = new Date(item.date);
    return d >= range.start && d <= range.end;
  });
}

function calcStats(invoices, expenses, returns) {
  const soldInvoices = invoices.filter(i => i.status !== 'returned' && i.status !== 'مرتجعة');
  const totalSales = soldInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalPending = 0;
  const totalReturns = returns.filter(r => r.status === 'success').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const collectedCash = soldInvoices.filter(i => i.paymentMethod === 'Cash' || i.paymentMethod === 'كاش').reduce((s, i) => s + Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0)), 0);
  const netProfit = totalSales - totalReturns - totalExpenses;
  const numPaid = soldInvoices.length;
  const avgInvoice = numPaid > 0 ? Math.round(totalSales / numPaid) : 0;
  return { totalSales, totalPending, totalReturns, totalExpenses, netProfit, collectedCash, avgInvoice, numPaid, numInvoices: invoices.length };
}

function fmtMoney(v) { return v.toLocaleString() + ' ج.م'; }

function pctChange(current, previous) {
  if (!previous || previous === 0) return { pct: 0, direction: 'neutral' };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), direction: pct >= 0 ? 'positive' : 'negative' };
}

function renderChangeBadge(container, current, previous) {
  if (!container) return;
  if (previous === undefined || previous === null) { container.innerHTML = ''; return; }
  const change = pctChange(current, previous);
  if (change.direction === 'neutral' || change.pct === 0) { container.innerHTML = '<span class="change-badge" style="background:#f5f5f4;color:#888">—</span>'; return; }
  container.innerHTML = '<span class="change-badge ' + change.direction + '">' + (change.direction === 'positive' ? '▲' : '▼') + ' ' + change.pct + '%</span>';
}

let charts = {};

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function destroyAllCharts() {
  Object.keys(charts).forEach(destroyChart);
}

let rendering = false;

function shiftSessionRange(dateVal, shifts) {
  const sorted = shifts.filter(s => s.openDate && s.openedAt).sort((a, b) => new Date(a.openedAt) - new Date(b.openedAt));
  const i = sorted.findIndex(s => s.openDate === dateVal);
  if (i !== -1) {
    const start = new Date(sorted[i].openedAt);
    let end = null;
    if (i + 1 < sorted.length) end = new Date(sorted[i + 1].openedAt);
    else if (sorted[i].closedAt) end = new Date(sorted[i].closedAt);
    else end = new Date();
    return { start, end };
  }
  return { start: new Date(dateVal + 'T00:00:00Z'), end: new Date(dateVal + 'T23:59:59.999Z') };
}

async function render() {
  if (rendering) return;
  rendering = true;
  try {
    const range = getMonthRange(monthInput.value);
    const prevRange = getPrevMonthRange(monthInput.value);

    const allInvoices = await DB.invoices.all() || [];
    const allExpenses = await DB.expenses.all() || [];
    const allReturns = await DB.returns.all() || [];
    const products = await DB.products.all() || [];
    const allDaycloses = await DB.daycloses.all() || [];
    const allShifts = await DB.shifts.all() || [];
    const allAudit = await DB.audit.all() || [];

    const invoices = filterByDate(allInvoices, range);
    const prevInvoices = filterByDate(allInvoices, prevRange);
    const expenses = filterByDate(allExpenses, range);
    const returns = filterByDate(allReturns, range);

    const monthKey = monthInput.value;
    const coveredDays = {};
    allDaycloses.forEach(d => { const k = d.date || ''; if (k.indexOf(monthKey) === 0 && Number(d.totalSales || 0) > 0) coveredDays[k] = d; });
    const openDayInvoices = invoices.filter(i => !coveredDays[(i.date || '').slice(0, 10)]);

    let closedSales = 0, closedCash = 0, closedCard = 0, closedNum = 0, closedItems = 0, closedRet = 0, closedExp = 0;
    const chartDays = [];
    Object.keys(coveredDays).forEach(k => {
      const dc = coveredDays[k];
      closedSales += Number(dc.totalSales || 0);
      closedCash += Number(dc.cashAmount || 0);
      closedCard += Number(dc.cardAmount || 0);
      closedNum += Number(dc.numInvoices || 0);
      closedItems += Number(dc.itemsSold || 0);
      closedRet += Number(dc.totalReturns || 0);
      closedExp += Number(dc.totalExpenses || 0);
      chartDays.push({ date: k + 'T12:00:00Z', total: Number(dc.totalSales || 0), paymentMethod: 'Cash', items: [] });
    });

    const coveredZero = {};
    allDaycloses.forEach(d => { const k = d.date || ''; if (k.indexOf(monthKey) === 0 && !(Number(d.totalSales || 0) > 0)) coveredZero[k] = true; });
    const maxAuditT = new Date(FB.clockNow().getTime() + 5 * 60 * 1000);
    Object.keys(coveredZero).forEach(k => {
      const r = shiftSessionRange(k, allShifts);
      let s = 0, c = 0, n = 0;
      allAudit.forEach(a => {
        if (a.type !== 'invoice_created' || !a.timestamp) return;
        const t = new Date(a.timestamp);
        if (t >= r.start && t <= r.end && t <= maxAuditT) {
          let det = {}; try { det = JSON.parse(a.detail || '{}'); } catch(e) {}
          const v = Number(det.total || 0);
          s += v; n++;
          if (det.method === 'Cash' || det.method === '\u0643\u0627\u0634') c += v;
        }
      });
      if (n) {
        closedSales += s; closedCash += c; closedCard += (s - c); closedNum += n;
        chartDays.push({ date: k + 'T12:00:00Z', total: s, paymentMethod: 'Cash', items: [] });
      }
    });

    const stats = calcStats(openDayInvoices, expenses, returns);
    stats.totalSales += closedSales;
    stats.collectedCash += closedCash;
    stats.totalReturns += closedRet;
    stats.totalExpenses += closedExp;
    stats.numPaid += closedNum;
    stats.numInvoices += closedNum;
    stats.avgInvoice = stats.numPaid > 0 ? Math.round(stats.totalSales / stats.numPaid) : 0;
    stats.netProfit = stats.totalSales - stats.totalReturns - stats.totalExpenses;
    stats.totalCard = closedCard;

    const chartInvoices = invoices.concat(chartDays);
    const prevStats = calcStats(prevInvoices, [], []);

    document.getElementById('reportSales').textContent = fmtMoney(stats.totalSales);
    document.getElementById('reportInvoices').textContent = stats.numInvoices;
    document.getElementById('reportAvgInvoice').textContent = fmtMoney(stats.avgInvoice);
    document.getElementById('reportReturns').textContent = fmtMoney(stats.totalReturns);
    document.getElementById('reportExpenses').textContent = fmtMoney(stats.totalExpenses);
    document.getElementById('reportNetProfit').textContent = fmtMoney(stats.netProfit);
    document.getElementById('reportPending').textContent = fmtMoney(stats.totalPending);
    document.getElementById('reportCashDrawer').textContent = fmtMoney(stats.collectedCash);

    renderChangeBadge(document.getElementById('reportSalesChange'), stats.totalSales, prevStats.totalSales);
    renderChangeBadge(document.getElementById('reportInvoicesChange'), stats.numInvoices, prevStats.numInvoices);
    renderChangeBadge(document.getElementById('reportProfitChange'), stats.netProfit, prevStats.netProfit);

    const soldInvoices = invoices.filter(i => i.status !== 'returned' && i.status !== 'مرتجعة');

    drawAnomalies(soldInvoices, expenses, range);
    drawSalesChart(chartInvoices, range);
    drawPaymentChart(soldInvoices);
    drawCategoryChart(soldInvoices, products);
    drawHourlyChart(soldInvoices);
    drawDayChart(chartInvoices);
    drawTopProducts(soldInvoices);
  } catch (e) {
    console.error('[reports]', e);
  }
  rendering = false;
}

function drawSalesChart(invoices, range) {
  destroyChart('sales');
  const canvas = document.getElementById('reportSalesChart');
  if (!canvas) return;
  const buckets = {};
  const order = [];
  invoices.forEach(inv => {
    if (!inv.date) return;
    const d = new Date(inv.date);
    const label = d.getUTCDate().toString();
    if (!buckets[label]) { buckets[label] = 0; order.push({ ts: d.getTime(), label }); }
    buckets[label] += Number(inv.total || 0);
  });
  order.sort((a, b) => a.ts - b.ts);
  const labels = order.map(d => d.label);
  const data = labels.map(k => buckets[k]);
  charts.sales = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'المبيعات', data, backgroundColor: '#d97706', borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() + ' ج.م' } } } }
  });
}

function drawPaymentChart(invoices) {
  destroyChart('payment');
  const canvas = document.getElementById('reportPaymentChart');
  if (!canvas) return;
  const paymentMap = {};
  invoices.forEach(inv => {
    const method = inv.paymentMethod || 'Cash';
    paymentMap[method] = (paymentMap[method] || 0) + Number(inv.total || 0);
  });
  const labels = Object.keys(paymentMap);
  const data = Object.values(paymentMap);
  charts.payment = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: ['#d97706', '#059669', '#f59e0b', '#dc2626', '#7c3aed'].slice(0, labels.length) }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + Number(ctx.raw).toLocaleString() + ' ج.م' } } } }
  });
}

function drawCategoryChart(invoices, products) {
  destroyChart('category');
  const canvas = document.getElementById('reportCategoryChart');
  if (!canvas) return;
  const catMap = {};
  const nameToCat = {};
  products.forEach(p => { nameToCat[p.name] = p.category || 'أخرى'; });
  invoices.forEach(inv => {
    if (!inv.items) return;
    inv.items.forEach(item => {
      const cat = nameToCat[item.name] || 'أخرى';
      catMap[cat] = (catMap[cat] || 0) + Number(item.qty || 0) * Number(item.price || 0);
    });
  });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(s => s[0]);
  const data = sorted.map(s => s[1]);
  const colors = ['#d97706', '#059669', '#2563eb', '#7c3aed', '#dc2626', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];
  charts.category = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length) }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + Number(ctx.raw).toLocaleString() + ' ج.م' } } } }
  });
}

function drawAnomalies(invoices, expenses, range) {
  var container = document.getElementById('reportAnomalies');
  if (!container) return;
  var alerts = [];
  var dailySales = {};
  var dailyExpenses = {};
  var dayCount = 0;

  // Aggregate per day
  var cursor = new Date(range.start);
  while (cursor <= range.end) {
    var key = localDateKey(cursor);
    dailySales[key] = 0;
    dailyExpenses[key] = 0;
    dayCount++;
    cursor.setDate(cursor.getDate() + 1);
  }

  invoices.forEach(function(inv) {
    if (!inv.date) return;
    var day = localDateKey(new Date(inv.date));
    if (dailySales[day] !== undefined) dailySales[day] += Number(inv.total || 0);
  });

  expenses.forEach(function(exp) {
    if (!exp.date) return;
    var day = localDateKey(new Date(exp.date));
    if (dailyExpenses[day] !== undefined) dailyExpenses[day] += Number(exp.amount || 0);
  });

  var salesValues = Object.values(dailySales).filter(function(v) { return v > 0; });
  var expenseValues = Object.values(dailyExpenses).filter(function(v) { return v > 0; });

  var avgDailySales = salesValues.length > 0 ? salesValues.reduce(function(a, b) { return a + b; }, 0) / salesValues.length : 0;
  var avgDailyExpenses = expenseValues.length > 0 ? expenseValues.reduce(function(a, b) { return a + b; }, 0) / expenseValues.length : 0;

  Object.keys(dailySales).forEach(function(day) {
    var sale = dailySales[day];
    var exp = dailyExpenses[day] || 0;

    // Sales drop check
    if (avgDailySales > 0 && sale > 0 && sale < avgDailySales * 0.5) {
      alerts.push({
        icon: '📉',
        text: day + ': المبيعات ' + sale.toLocaleString() + ' ج.م (أقل من 50% من المتوسط اليومي ' + Math.round(avgDailySales).toLocaleString() + ' ج.م)'
      });
    }

    // Unusual expenses check
    if (avgDailyExpenses > 0 && exp > avgDailyExpenses * 2) {
      alerts.push({
        icon: '⚠️',
        text: day + ': مصروفات ' + exp.toLocaleString() + ' ج.م (أكثر من ضعف المتوسط اليومي ' + Math.round(avgDailyExpenses).toLocaleString() + ' ج.م)'
      });
    }
  });

  if (alerts.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  container.innerHTML = '<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:10px;padding:16px"><h4 style="margin:0 0 8px 0;color:#856404;font-size:15px"><i class="fa-solid fa-triangle-exclamation"></i> تنبيهات</h4>' +
    alerts.map(function(a) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#856404">' +
        '<span>' + a.icon + '</span><span>' + a.text + '</span></div>';
    }).join('') + '</div>';
}

function drawHourlyChart(invoices) {
  destroyChart('hourly');
  const canvas = document.getElementById('reportHourlyChart');
  if (!canvas) return;
  const hourly = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  invoices.forEach(inv => {
    if (!inv.date) return;
    const h = new Date(inv.date).getHours();
    hourly[h] += Number(inv.total || 0);
    counts[h]++;
  });
  const labels = [];
  for (let i = 0; i < 24; i++) {
    labels.push(i.toString().padStart(2, '0') + ':00');
  }
  charts.hourly = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'المبيعات', data: hourly, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, yAxisID: 'y' },
      { label: 'عدد الفواتير', data: counts, borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, yAxisID: 'y1' }
    ] },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } },
      scales: {
        y: { beginAtZero: true, position: 'left', ticks: { callback: v => v.toLocaleString() + ' ج.م' } },
        y1: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { callback: v => v + ' فاتورة' } }
      }
    }
  });
}

function drawDayChart(invoices) {
  destroyChart('day');
  const canvas = document.getElementById('reportDayChart');
  if (!canvas) return;
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayData = new Array(7).fill(0);
  invoices.forEach(inv => {
    if (!inv.date) return;
    const day = new Date(inv.date).getUTCDay();
    dayData[day] += Number(inv.total || 0);
  });
  charts.day = new Chart(canvas, {
    type: 'bar',
    data: { labels: dayNames, datasets: [{ label: 'المبيعات', data: dayData, backgroundColor: dayData.map((v, i) => i === 5 || i === 6 ? '#dc2626' : '#2563eb'), borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() + ' ج.م' } } } }
  });
}

function drawTopProducts(invoices) {
  destroyChart('topQty');
  destroyChart('topRevenue');
  const qtyCanvas = document.getElementById('reportTopQtyChart');
  const revCanvas = document.getElementById('reportTopRevenueChart');

  const prodQty = {};
  const prodRev = {};
  invoices.forEach(inv => {
    if (!inv.items) return;
    inv.items.forEach(item => {
      const name = item.name;
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      prodQty[name] = (prodQty[name] || 0) + qty;
      prodRev[name] = (prodRev[name] || 0) + qty * price;
    });
  });

  const topQty = Object.entries(prodQty).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topRev = Object.entries(prodRev).sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (qtyCanvas && topQty.length > 0) {
    charts.topQty = new Chart(qtyCanvas, {
      type: 'bar',
      data: {
        labels: topQty.map(p => p[0]),
        datasets: [{ label: 'الكمية', data: topQty.map(p => p[1]), backgroundColor: '#059669', borderRadius: 6 }]
      },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  if (revCanvas && topRev.length > 0) {
    charts.topRevenue = new Chart(revCanvas, {
      type: 'bar',
      data: {
        labels: topRev.map(p => p[0]),
        datasets: [{ label: 'الإيراد', data: topRev.map(p => p[1]), backgroundColor: '#d97706', borderRadius: 6 }]
      },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() + ' ج.م' } } }
      }
    });
  }
}

monthInput.addEventListener('change', () => { destroyAllCharts(); render(); });

// ── Export Monthly Report (PDF / Image) ──
async function exportMonthlyReport(asImage) {
  const el = document.getElementById('monthlyReport');
  if (!el) return;
  try {
    const labelEl = document.getElementById('monthlyReportLabel');
    if (labelEl) {
      const [y, m] = monthInput.value.split('-').map(Number);
      labelEl.textContent = new Date(y, m - 1, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    }
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f6f8fb',
      windowWidth: Math.min(Math.max(document.documentElement.clientWidth, 1200), 1920),
      windowHeight: Math.max(document.documentElement.scrollHeight, el.scrollHeight) + 500,
      scrollX: 0,
      scrollY: 0
    });
    const imgData = canvas.toDataURL('image/png');
    const fileName = 'تقرير-شهري-' + monthInput.value;
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
    console.error('[monthly-export]', e);
    alert('حدث خطأ أثناء تحميل التقرير: ' + (e.message || e));
  }
}

const monthlyPdfBtn = document.getElementById('monthlyPdfBtn');
const monthlyImgBtn = document.getElementById('monthlyImgBtn');
if (monthlyPdfBtn) monthlyPdfBtn.onclick = () => exportMonthlyReport(false);
if (monthlyImgBtn) monthlyImgBtn.onclick = () => exportMonthlyReport(true);

// ── Export ──
document.getElementById('exportBtn').onclick = async () => {
  const invoices = await DB.invoices.all() || [];
  const products = await DB.products.all() || [];
  const nameToCat = {};
  products.forEach(p => { nameToCat[p.name] = p.category || 'أخرى'; });

  function csvEsc(val) {
    const s = String(val || '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  let csv = 'رقم الفاتورة,العميل,الطاولة,التاريخ,طريقة الدفع,الحالة,الإجمالي,المدفوع,المتبقي,خدمة,ضريبة,المنتج,الفئة,الكمية,سعر الوحدة,الإجمالي الفرعي,ملاحظة\n';
  invoices.forEach(i => {
    if (i.items && i.items.length > 0) {
      i.items.forEach(item => {
        const cat = nameToCat[item.name] || '';
        const lineTotal = (Number(item.qty || 0) * Number(item.price || 0));
        csv += [csvEsc(i.id), csvEsc(i.customer), csvEsc(i.table), csvEsc(i.date), csvEsc(i.paymentMethod), csvEsc(i.status), csvEsc(i.total), csvEsc(i.paid), csvEsc(i.remaining), csvEsc(i.serviceAmount), csvEsc(i.taxAmount), csvEsc(item.name), csvEsc(cat), csvEsc(item.qty), csvEsc(item.price), csvEsc(lineTotal), csvEsc(item.note || '')].join(',') + '\n';
      });
    } else {
      csv += [csvEsc(i.id), csvEsc(i.customer), csvEsc(i.table), csvEsc(i.date), csvEsc(i.paymentMethod), csvEsc(i.status), csvEsc(i.total), csvEsc(i.paid), csvEsc(i.remaining), csvEsc(i.serviceAmount), csvEsc(i.taxAmount), '', '', '', '', '', ''].join(',') + '\n';
    }
  });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'laguna-report-detailed.csv';
  link.click();
};

// ── Day Close ──
const dayCloseModal = document.getElementById('dayCloseModal');
const closeDayClose = document.getElementById('closeDayClose');
const cancelDayClose = document.getElementById('cancelDayClose');
const confirmDayClose = document.getElementById('confirmDayClose');
const dcHistoryBtn = document.getElementById('dcHistoryBtn');
const dcHistoryModal = document.getElementById('dcHistoryModal');
const closeDcHistory = document.getElementById('closeDcHistory');
const closeDcHistoryBtn = document.getElementById('closeDcHistoryBtn');

async function checkDayCloseStatus() {
  const shift = await DB.shifts.getOpen();
  if (shift) {
    document.getElementById('dayCloseBtn').innerHTML = '<i class="fa-solid fa-moon"></i> غلق الشيفت';
    document.getElementById('dayCloseBtn').disabled = false;
    document.getElementById('dayCloseBtn').style.opacity = '1';
    document.getElementById('dayCloseBtn').style.cursor = 'pointer';
  } else {
    document.getElementById('dayCloseBtn').innerHTML = '<i class="fa-solid fa-sun"></i> فتح الشيفت';
    document.getElementById('dayCloseBtn').disabled = false;
    document.getElementById('dayCloseBtn').style.opacity = '1';
    document.getElementById('dayCloseBtn').style.cursor = 'pointer';
  }
}

async function showDayCloseModal() {
  const allInvoices = await DB.invoices.all() || [];
  const allExpenses = await DB.expenses.all() || [];
  const allReturns = await DB.returns.all() || [];

  const shift = await DB.shifts.getOpen();
  const rangeStart = shift && shift.openedAt ? new Date(shift.openedAt) : null;
  const range = { start: rangeStart, end: FB.clockNow() };
  if (!rangeStart) {
    alert('❌ لا يوجد شيفت مفتوح حاليًا');
    return;
  }

  const invoices = filterByDate(allInvoices, range);
  const expenses = filterByDate(allExpenses, range);
  const returns = filterByDate(allReturns, range);
  const soldInvoices = invoices.filter(i => i.status !== 'returned' && i.status !== 'مرتجعة');

  const totalSales = soldInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const cashAmount = soldInvoices.filter(i => i.paymentMethod === 'Cash' || i.paymentMethod === 'كاش').reduce((s, i) => s + Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0)), 0);
  const cardAmount = soldInvoices.filter(i => i.paymentMethod === 'Card' || i.paymentMethod === 'شبكة' || i.paymentMethod === 'فيزا').reduce((s, i) => s + Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0)), 0);
  const otherAmount = totalSales - cashAmount - cardAmount;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalReturns = returns.filter(r => r.status === 'success').reduce((s, r) => s + Number(r.amount || 0), 0);
  const netProfit = totalSales - totalReturns - totalExpenses;
  const itemsSold = soldInvoices.reduce((s, i) => s + (i.items ? i.items.reduce((ss, it) => ss + Number(it.qty || 0), 0) : 0), 0);

  const shiftForDate = shift ? new Date(shift.openDate + 'T12:00:00Z') : FB.clockNow();
  const todayStr = 'شيفت ' + shiftForDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + (shift && shift.openedAt ? ' (من ' + new Date(shift.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ')' : '');
  document.getElementById('dcDate').textContent = todayStr;
  document.getElementById('dcSales').textContent = fmtMoney(totalSales);
  document.getElementById('dcInvoices').textContent = soldInvoices.length;
  document.getElementById('dcCash').textContent = fmtMoney(cashAmount);
  document.getElementById('dcCard').textContent = fmtMoney(cardAmount);
  document.getElementById('dcItemsSold').textContent = itemsSold;
  document.getElementById('dcExpenses').textContent = fmtMoney(totalExpenses);
  document.getElementById('dcReturns').textContent = fmtMoney(totalReturns);
  document.getElementById('dcNet').textContent = fmtMoney(netProfit);

  confirmDayClose.dataset.cashAmount = cashAmount;
  confirmDayClose.dataset.cardAmount = cardAmount;
  confirmDayClose.dataset.otherAmount = otherAmount;
  confirmDayClose.dataset.totalSales = totalSales;
  confirmDayClose.dataset.paidInvoices = soldInvoices.length;
  confirmDayClose.dataset.itemsSold = itemsSold;
  confirmDayClose.dataset.totalExpenses = totalExpenses;
  confirmDayClose.dataset.totalReturns = totalReturns;
  confirmDayClose.dataset.netProfit = netProfit;

  dayCloseModal.classList.add('show');
}

document.getElementById('dayCloseBtn').onclick = async () => {
    const shift = await DB.shifts.getOpen();
    if (!shift) {
      showStartDayModal();
      return;
    }
    showDayCloseModal();
  };

function showStartDayModal() {
  const now = FB.clockNow();
  document.getElementById('dcStartDate').textContent = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('dcStartTime').textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('dcStartDayModal').classList.add('show');
}

document.getElementById('dcConfirmStartDay').onclick = async () => {
  const user = JSON.parse(sessionStorage.getItem('laguna_user') || '{}');
  try {
    const shift = await DB.shifts.open(user.name || 'الكاشير');
    DB.audit.log('shift_open', { openDate: shift.openDate, openedBy: shift.openedBy });
    closeStartDayModal();
    checkDayCloseStatus();
    alert('✅ تم بدء اليوم ' + new Date(shift.openDate + 'T12:00:00Z').toLocaleDateString('ar-EG') + '\nاليوم ثابت حتى إغلاق الشيفت يدويًا');
  } catch (e) {
    console.error('[startday]', e);
    alert('❌ حدث خطأ أثناء بدء اليوم');
  }
};

function closeStartDayModal() { document.getElementById('dcStartDayModal').classList.remove('show'); }
const dcCloseStartDayEl = document.getElementById('dcCloseStartDay');
if (dcCloseStartDayEl) dcCloseStartDayEl.onclick = closeStartDayModal;
document.getElementById('dcCancelStartDay').onclick = closeStartDayModal;
window.addEventListener('click', e => { if (e.target === document.getElementById('dcStartDayModal')) closeStartDayModal(); });

confirmDayClose.onclick = async () => {
  const btn = confirmDayClose;
  const user = JSON.parse(sessionStorage.getItem('laguna_user') || '{}');
  const shift = await DB.shifts.getOpen();
  if (!shift) { alert('❌ لا يوجد شيفت مفتوح حاليًا'); return; }
  const todayISO = shift.openDate;
  const data = {
    date: todayISO,
    totalSales: Number(btn.dataset.totalSales),
    numInvoices: Number(btn.dataset.paidInvoices),
    cashAmount: Number(btn.dataset.cashAmount),
    cardAmount: Number(btn.dataset.cardAmount),
    otherAmount: Number(btn.dataset.otherAmount),
    itemsSold: Number(btn.dataset.itemsSold),
    totalExpenses: Number(btn.dataset.totalExpenses),
    totalReturns: Number(btn.dataset.totalReturns),
    netProfit: Number(btn.dataset.netProfit),
    closedBy: user.name || 'الكاشير',
    closedAt: FB.nowISO()
  };
  try {
    await DB.daycloses.close(data);
    await DB.shifts.close(shift.id, { closedAt: FB.nowISO(), closedBy: user.name || 'الكاشير' });
    DB.audit.log('day_close', { date: data.date, totalSales: data.totalSales, totalExpenses: data.totalExpenses });
    dayCloseModal.classList.remove('show');
    checkDayCloseStatus();

    // Export Excel for today's invoices
    const allInvoices = await DB.invoices.all() || [];
    const todayStart = new Date(shift.openedAt);
    const todayEnd = FB.clockNow();
    const todayInvoices = allInvoices.filter(inv => {
      if (!inv.date) return false;
      const d = new Date(inv.date);
      return d >= todayStart && d <= todayEnd;
    });
    const products = await DB.products.all() || [];
    const nameToCat = {};
    products.forEach(p => { nameToCat[p.name] = p.category || 'أخرى'; });

    function csvEsc(val) {
      const s = String(val || '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    let csv = 'رقم الفاتورة,العميل,الطاولة,التاريخ,طريقة الدفع,الحالة,الإجمالي,المدفوع,المتبقي,خدمة,ضريبة,المنتج,الفئة,الكمية,سعر الوحدة,الإجمالي الفرعي,ملاحظة\n';
    todayInvoices.forEach(i => {
      if (i.items && i.items.length > 0) {
        i.items.forEach(item => {
          const cat = nameToCat[item.name] || '';
          const lineTotal = (Number(item.qty || 0) * Number(item.price || 0));
          csv += [csvEsc(i.id), csvEsc(i.customer), csvEsc(i.table), csvEsc(i.date), csvEsc(i.paymentMethod), csvEsc(i.status), csvEsc(i.total), csvEsc(i.paid), csvEsc(i.remaining), csvEsc(i.serviceAmount), csvEsc(i.taxAmount), csvEsc(item.name), csvEsc(cat), csvEsc(item.qty), csvEsc(item.price), csvEsc(lineTotal), csvEsc(item.note || '')].join(',') + '\n';
        });
      } else {
        csv += [csvEsc(i.id), csvEsc(i.customer), csvEsc(i.table), csvEsc(i.date), csvEsc(i.paymentMethod), csvEsc(i.status), csvEsc(i.total), csvEsc(i.paid), csvEsc(i.remaining), csvEsc(i.serviceAmount), csvEsc(i.taxAmount), '', '', '', '', '', ''].join(',') + '\n';
      }
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'laguna-close-' + todayISO + '.csv';
    link.click();

    // Clear today's invoices — محذوف عمدًا: الفواتير تبقى محفوظة عشان التقارير اليومية والسابقة
    alert('✅ تم إغلاق اليوم بنجاح\n📄 تم تحميل ملف Excel بالفواتير');
  } catch (e) {
    console.error('[dayclose]', e);
    alert('❌ حدث خطأ أثناء إغلاق اليوم');
  }
};

function closeDayCloseModal() { dayCloseModal.classList.remove('show'); }
if (closeDayClose) closeDayClose.addEventListener('click', closeDayCloseModal);
if (cancelDayClose) cancelDayClose.addEventListener('click', closeDayCloseModal);
window.addEventListener('click', e => { if (e.target === dayCloseModal) closeDayCloseModal(); });

// ── Day Close History ──
dcHistoryBtn.onclick = async () => {
  const list = document.getElementById('dcHistoryList');
  list.innerHTML = '<p style="text-align:center;padding:20px;color:#888"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...</p>';
  dcHistoryModal.classList.add('show');

  try {
    const all = await DB.daycloses.all() || [];
    all.sort((a, b) => b.date.localeCompare(a.date));

    if (all.length === 0) {
      list.innerHTML = '<p style="text-align:center;padding:30px;color:#888">لا يوجد سجلات إغلاق أيام بعد</p>';
      return;
    }

    let html = '<div class="dc-history-table">';
    html += '<div class="dc-history-header"><span>التاريخ</span><span>المبيعات</span><span>الدرج</span><span>فيزا</span><span>الفواتير</span><span>صافي الربح</span><span>بواسطة</span></div>';
    all.forEach(dc => {
      const dateStr = new Date(dc.date + 'T12:00:00').toLocaleDateString('ar-EG');
      const isToday = dc.date === localDateKey(FB.clockNow());
      html += `<div class="dc-history-row${isToday ? ' today' : ''}">
        <span>${dateStr}</span>
        <span>${fmtMoney(dc.totalSales || 0)}</span>
        <span>${fmtMoney(dc.cashAmount || 0)}</span>
        <span>${fmtMoney(dc.cardAmount || 0)}</span>
        <span>${dc.numInvoices || 0}</span>
        <span style="color:var(--success);font-weight:700">${fmtMoney(dc.netProfit || 0)}</span>
        <span>${dc.closedBy || '—'}</span>
      </div>`;
    });
    html += '</div>';
    list.innerHTML = html;
  } catch (e) {
    console.error('[dchistory]', e);
    list.innerHTML = '<p style="text-align:center;padding:20px;color:#dc2626">حدث خطأ أثناء تحميل السجل</p>';
  }
};

function closeDcHistoryModal() { dcHistoryModal.classList.remove('show'); }
if (closeDcHistory) closeDcHistory.addEventListener('click', closeDcHistoryModal);
if (closeDcHistoryBtn) closeDcHistoryBtn.addEventListener('click', closeDcHistoryModal);
window.addEventListener('click', e => { if (e.target === dcHistoryModal) closeDcHistoryModal(); });

checkDayCloseStatus();
render();