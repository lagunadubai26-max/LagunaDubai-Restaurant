async function updateDashboard() {
  const invoices = await DB.invoices.all() || [];
  const soldInvoices = invoices.filter(i => i.status !== 'returned' && i.status !== 'مرتجعة');
  const totalSales = soldInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const pendingTotal = invoices.filter(i => i.status !== 'paid' && i.status !== 'مدفوعة' && i.status !== 'returned' && i.status !== 'مرتجعة').reduce((s, i) => s + Number(i.total || 0), 0);
  const customers = (await DB.customers.all() || []).length;
  const totalOrders = invoices.reduce((s, i) => s + (i.items ? i.items.reduce((a, b) => a + Number(b.qty || 0), 0) : 0), 0);

  document.getElementById('totalSales').textContent = totalSales.toLocaleString() + ' جنيه';
  const salesStatus = document.getElementById('salesStatus');
  if (salesStatus) salesStatus.textContent = (pendingTotal > 0 ? pendingTotal.toLocaleString() + ' ج.م معلقة | ' : '') + 'مدفوعة';
  document.getElementById('totalInvoices').textContent = invoices.length;
  document.getElementById('totalCustomers').textContent = customers || '0';
  document.getElementById('totalOrders').textContent = totalOrders || '0';

  // Day close button (Owner role removed — always visible)
  const dayCloseBtn = document.getElementById('dashDayCloseBtn');
  if (dayCloseBtn) dayCloseBtn.style.display = 'flex';

  // Payment percentages
  const methods = { Cash: 0, Visa: 0, Wallet: 0 };
  invoices.forEach(i => { const m = i.paymentMethod || 'Cash'; if (methods[m] !== undefined) methods[m]++; });
  const total = Object.values(methods).reduce((a, b) => a + b, 0) || 1;
  document.getElementById('cashPercent').textContent = Math.round(methods.Cash / total * 100) + '%';
  document.getElementById('visaPercent').textContent = Math.round(methods.Visa / total * 100) + '%';
  document.getElementById('walletPercent').textContent = Math.round(methods.Wallet / total * 100) + '%';

  updateChart(soldInvoices);
  checkDashDayClose();
}

function updateChart(invoices) {
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;
  const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  const weeklyData = new Array(7).fill(0);
  invoices.forEach(inv => {
    if (!inv.date) return;
    const d = new Date(inv.date);
    const dayIdx = (d.getDay() + 1) % 7;
    weeklyData[dayIdx] += Number(inv.total || 0);
  });
  if (typeof Chart !== 'undefined' && window.salesChart instanceof Chart) window.salesChart.destroy();
  window.salesChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{ label: 'المبيعات', data: weeklyData, borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.12)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 5, pointBackgroundColor: '#d97706' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// ── Day Close on Dashboard ──
function fmtMoney(v) { return v.toLocaleString() + ' ج.م'; }

function filterDate(items, start, end) {
  if (!items) return [];
  return items.filter(item => {
    if (!item.date) return false;
    const d = new Date(item.date);
    return d >= start && d <= end;
  });
}

async function checkDashDayClose() {
  const shift = await DB.shifts.getOpen();
  const btn = document.getElementById('dashDayCloseBtn');
  if (shift) {
    btn.innerHTML = '<i class="fa-solid fa-moon"></i> غلق الشيفت';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  } else {
    btn.innerHTML = '<i class="fa-solid fa-sun"></i> فتح الشيفت';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
}

document.getElementById('dashDayCloseBtn').onclick = async () => {
  const shift = await DB.shifts.getOpen();
  if (shift) {
    showDashDayCloseModal(shift);
  } else {
    showDashStartDayModal();
  }
};

// ── Start Day (Open Shift) ──
function showDashStartDayModal() {
  const now = FB.clockNow();
  document.getElementById('dashStartDate').textContent = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('dashStartTime').textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('dashStartDayModal').classList.add('show');
}

document.getElementById('dashConfirmStartDay').onclick = async () => {
  const user = JSON.parse(sessionStorage.getItem('laguna_rest_user') || '{}');
  try {
    const shift = await DB.shifts.open(user.name || 'الكاشير');
    DB.audit.log('shift_open', { openDate: shift.openDate, openedBy: shift.openedBy });
    closeDashStartDay();
    checkDashDayClose();
    alert('✅ تم بدء اليوم ' + new Date(shift.openDate + 'T12:00:00').toLocaleDateString('ar-EG') + '\nاليوم ثابت حتى إغلاق الشيفت يدويًا');
  } catch (e) {
    console.error('[startday]', e);
    alert('❌ حدث خطأ أثناء بدء اليوم');
  }
};

function closeDashStartDay() { document.getElementById('dashStartDayModal').classList.remove('show'); }
const dashCloseStartDayEl = document.getElementById('dashCloseStartDay');
if (dashCloseStartDayEl) dashCloseStartDayEl.onclick = closeDashStartDay;
document.getElementById('dashCancelStartDay').onclick = closeDashStartDay;
window.addEventListener('click', e => { if (e.target === document.getElementById('dashStartDayModal')) closeDashStartDay(); });

async function showDashDayCloseModal(shift) {
  const allInvoices = await DB.invoices.all() || [];
  const allExpenses = await DB.expenses.all() || [];
  const allReturns = await DB.returns.all() || [];

  const start = new Date(shift.openedAt || (shift.openDate + 'T00:00:00Z'));
  const end = FB.clockNow();

  const invoices = filterDate(allInvoices, start, end);
  const expenses = filterDate(allExpenses, start, end);
  const returns = filterDate(allReturns, start, end);
  const soldInvoices = invoices.filter(i => i.status !== 'returned' && i.status !== 'مرتجعة');

  const totalSales = soldInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const cashAmount = soldInvoices.filter(i => i.paymentMethod === 'Cash' || i.paymentMethod === 'كاش').reduce((s, i) => s + Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0)), 0);
  const cardAmount = soldInvoices.filter(i => i.paymentMethod === 'Card' || i.paymentMethod === 'شبكة' || i.paymentMethod === 'فيزا').reduce((s, i) => s + Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0)), 0);
  const otherAmount = totalSales - cashAmount - cardAmount;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalReturns = returns.filter(r => r.status === 'success').reduce((s, r) => s + Number(r.amount || 0), 0);
  const netProfit = totalSales - totalReturns - totalExpenses;
  const itemsSold = soldInvoices.reduce((s, i) => s + (i.items ? i.items.reduce((ss, it) => ss + Number(it.qty || 0), 0) : 0), 0);

  const shiftDate = new Date(shift.openDate + 'T12:00:00');
  const todayStr = 'شيفت ' + shiftDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' (من ' + (shift.openedAt ? new Date(shift.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—') + ')';
  document.getElementById('dashDcDate').textContent = todayStr;
  document.getElementById('dashDcSales').textContent = fmtMoney(totalSales);
  document.getElementById('dashDcInvoices').textContent = soldInvoices.length;
  document.getElementById('dashDcCash').textContent = fmtMoney(cashAmount);
  document.getElementById('dashDcCard').textContent = fmtMoney(cardAmount);
  document.getElementById('dashDcItemsSold').textContent = itemsSold;
  document.getElementById('dashDcExpenses').textContent = fmtMoney(totalExpenses);
  document.getElementById('dashDcReturns').textContent = fmtMoney(totalReturns);
  document.getElementById('dashDcNet').textContent = fmtMoney(netProfit);

  const confBtn = document.getElementById('dashConfirmDayClose');
  confBtn.dataset.cashAmount = cashAmount;
  confBtn.dataset.cardAmount = cardAmount;
  confBtn.dataset.totalSales = totalSales;
  confBtn.dataset.paidInvoices = soldInvoices.length;
  confBtn.dataset.itemsSold = itemsSold;
  confBtn.dataset.totalExpenses = totalExpenses;
  confBtn.dataset.totalReturns = totalReturns;
  confBtn.dataset.netProfit = netProfit;
  confBtn.dataset.openDate = shift.openDate;

  document.getElementById('dashDayCloseModal').classList.add('show');
}

document.getElementById('dashConfirmDayClose').onclick = async () => {
  const btn = document.getElementById('dashConfirmDayClose');
  const user = JSON.parse(sessionStorage.getItem('laguna_rest_user') || '{}');
  const shift = await DB.shifts.getOpen();
  if (!shift) { alert('❌ لا يوجد شيفت مفتوح حاليًا'); return; }
  const openDate = btn.dataset.openDate || shift.openDate;
  const data = {
    date: openDate,
    totalSales: Number(btn.dataset.totalSales),
    numInvoices: Number(btn.dataset.paidInvoices),
    cashAmount: Number(btn.dataset.cashAmount),
    cardAmount: Number(btn.dataset.cardAmount),
    totalExpenses: Number(btn.dataset.totalExpenses),
    totalReturns: Number(btn.dataset.totalReturns),
    netProfit: Number(btn.dataset.netProfit),
    itemsSold: Number(btn.dataset.itemsSold),
    closedBy: user.name || 'الكاشير',
    closedAt: FB.nowISO()
  };
  try {
    await DB.daycloses.close(data);
    await DB.shifts.close(shift.id, { closedAt: FB.nowISO(), closedBy: user.name || 'الكاشير' });
    DB.audit.log('day_close', { date: data.date, totalSales: data.totalSales, cashInDrawer: data.cashInDrawer });
    document.getElementById('dashDayCloseModal').classList.remove('show');
    checkDashDayClose();
    alert('✅ تم إغلاق اليوم بنجاح');
  } catch (e) {
    console.error('[dash-dayclose]', e);
    alert('❌ حدث خطأ أثناء إغلاق اليوم');
  }
};

function closeDashDayClose() { document.getElementById('dashDayCloseModal').classList.remove('show'); }
document.getElementById('dashCloseDayClose').onclick = closeDashDayClose;
document.getElementById('dashCancelDayClose').onclick = closeDashDayClose;
window.addEventListener('click', e => { if (e.target === document.getElementById('dashDayCloseModal')) closeDashDayClose(); });

updateDashboard();

(async function autoStartDay() {
  try {
    const shift = await DB.shifts.getOpen();
    if (!shift) showDashStartDayModal();
  } catch (e) {
    console.warn('[autostart]', e);
  }
})();
