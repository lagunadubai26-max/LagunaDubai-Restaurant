;(async () => {
  let user;
  try { user = JSON.parse(sessionStorage.getItem('rt_user')); } catch (e) { user = null; }
  if (!user) { window.location.href = 'rt-login.html'; return; }

  const dayInput = document.getElementById('dayInput');
  const monthInput = document.getElementById('monthInput');
  const reportType = document.getElementById('reportType');
  const summaryEl = document.getElementById('reportSummary');
  const contentEl = document.getElementById('reportContent');

  // ── Init dates ──
  (async () => {
    let shift = null;
    try { shift = await RT_DB.shifts.getOpen(); } catch (e) {}
    const now = RT_FB.clockNow();
    const today = rtLocalDateKey(now);
    dayInput.value = shift ? shift.openDate : today;
    monthInput.value = today.slice(0, 7);
  })();

  reportType.onchange = () => {
    const t = reportType.value;
    document.getElementById('dayField').style.display = t === 'daily' ? '' : 'none';
    document.getElementById('monthField').style.display = t === 'monthly' ? '' : 'none';
  };

  document.getElementById('showReport').onclick = async () => {
    const invoices = await RT_DB.invoices.all();
    if (reportType.value === 'daily') dailyReport(invoices, dayInput.value);
    else monthlyReport(invoices, monthInput.value);
  };

  function money(n) { return Number(n || 0).toLocaleString() + ' ج.م'; }
  function fmtTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  function computeTotals(invs) {
    let total = 0, cash = 0, card = 0, itemsSold = 0;
    invs.forEach(i => {
      total += Number(i.total || 0);
      if (i.paymentMethod === 'كاش') cash += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
      else card += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
      (i.items || []).forEach(it => itemsSold += Number(it.qty || 0));
    });
    return { total, cash, card, itemsSold };
  }

  function itemBreakdown(invs) {
    const map = {};
    invs.forEach(i => {
      (i.items || []).forEach(it => {
        const key = it.productId || it.name;
        if (!map[key]) map[key] = { name: it.name || key, qty: 0, revenue: 0 };
        map[key].qty += Number(it.qty || 0);
        map[key].revenue += Number(it.lineTotal || (Number(it.qty || 0) * Number(it.price || 0)));
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }

  function invoicesTable(invs) {
    if (invs.length === 0) return '<div class="empty-state" style="padding:30px 10px"><i class="fa-solid fa-receipt"></i><h3>لا توجد فواتير في هذه الفترة</h3></div>';
    const sorted = invs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const rows = sorted.map(i => {
      const itemsCount = (i.items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
      const itemNames = (i.items || []).map(it => escapeHtml(it.name) + ' ×' + it.qty).join(', ');
      return '<tr>' +
        '<td>' + escapeHtml(i.id) + '</td>' +
        '<td>' + fmtTime(i.date) + '</td>' +
        '<td>' + itemNames + '</td>' +
        '<td>' + itemsCount + '</td>' +
        '<td>' + escapeHtml(i.paymentMethod) + '</td>' +
        '<td>' + money(i.total) + '</td>' +
      '</tr>';
    }).join('');
    return '<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>رقم الفاتورة</th><th>الوقت</th><th>الأصناف</th><th>عدد الأصناف</th><th>الدفع</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // ── Daily ──
  function dailyReport(invoices, dateKey) {
    const invs = invoices.filter(i => i.dayKey === dateKey);
    const t = computeTotals(invs);
    const items = itemBreakdown(invs);

    summaryEl.innerHTML =
      '<div class="rt-summary-box"><span>إجمالي المبيعات</span><strong>' + money(t.total) + '</strong></div>' +
      '<div class="rt-summary-box"><span>كاش</span><strong>' + money(t.cash) + '</strong></div>' +
      '<div class="rt-summary-box"><span>شبكة / فيزا</span><strong>' + money(t.card) + '</strong></div>' +
      '<div class="rt-summary-box"><span>عدد الفواتير</span><strong>' + invs.length + '</strong></div>' +
      '<div class="rt-summary-box"><span>الأصناف المباعة</span><strong>' + t.itemsSold + '</strong></div>';

    let html = '<div class="rt-section"><h3><i class="fa-solid fa-chart-pie"></i> الأصناف الأكثر مبيعًا</h3>';
    if (items.length === 0) {
      html += '<div class="empty-state" style="padding:24px 10px"><h3>لا توجد مبيعات</h3></div>';
    } else {
      const rows = items.map(it => '<tr><td>' + escapeHtml(it.name) + '</td><td>' + it.qty + '</td><td>' + money(it.revenue) + '</td></tr>').join('');
      html += '<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    html += '</div>';

    html += '<div class="rt-section"><h3><i class="fa-solid fa-receipt"></i> فواتير اليوم</h3>' + invoicesTable(invs) + '</div>';

    contentEl.innerHTML = html;
  }

  // ── Monthly ──
  function monthlyReport(invoices, monthKey) {
    const invs = invoices.filter(i => (i.dayKey || '').startsWith(monthKey));
    const t = computeTotals(invs);

    const byDay = {};
    invs.forEach(i => {
      const d = i.dayKey || 'unknown';
      if (!byDay[d]) byDay[d] = { count: 0, total: 0, cash: 0, card: 0 };
      byDay[d].count++;
      byDay[d].total += Number(i.total || 0);
      if (i.paymentMethod === 'كاش') byDay[d].cash += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
      else byDay[d].card += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
    });

    summaryEl.innerHTML =
      '<div class="rt-summary-box"><span>إجمالي المبيعات</span><strong>' + money(t.total) + '</strong></div>' +
      '<div class="rt-summary-box"><span>كاش</span><strong>' + money(t.cash) + '</strong></div>' +
      '<div class="rt-summary-box"><span>شبكة / فيزا</span><strong>' + money(t.card) + '</strong></div>' +
      '<div class="rt-summary-box"><span>عدد الفواتير</span><strong>' + invs.length + '</strong></div>' +
      '<div class="rt-summary-box"><span>أيام العمل</span><strong>' + Object.keys(byDay).length + '</strong></div>';

    const days = Object.keys(byDay).sort().reverse();
    if (days.length === 0) {
      contentEl.innerHTML = '<div class="rt-section"><div class="empty-state" style="padding:30px 10px"><i class="fa-solid fa-calendar-xmark"></i><h3>لا توجد مبيعات في هذا الشهر</h3></div></div>';
      return;
    }
    const rows = days.map(d => {
      const day = byDay[d];
      return '<tr>' +
        '<td>' + escapeHtml(d) + '</td>' +
        '<td>' + day.count + '</td>' +
        '<td>' + money(day.cash) + '</td>' +
        '<td>' + money(day.card) + '</td>' +
        '<td><strong>' + money(day.total) + '</strong></td>' +
      '</tr>';
    }).join('');

    let html = '<div class="rt-section"><h3><i class="fa-solid fa-calendar-day"></i> المبيعات اليومية</h3>';
    html += '<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>اليوم</th><th>الفواتير</th><th>كاش</th><th>شبكة / فيزا</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    const items = itemBreakdown(invs);
    if (items.length > 0) {
      const irows = items.slice(0, 15).map(it => '<tr><td>' + escapeHtml(it.name) + '</td><td>' + it.qty + '</td><td>' + money(it.revenue) + '</td></tr>').join('');
      html += '<div class="rt-section"><h3><i class="fa-solid fa-trophy"></i> أفضل 15 صنفًا</h3><div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>' + irows + '</tbody></table></div></div>';
    }

    contentEl.innerHTML = html;
  }
})();
