;(async () => {
  let user;
  try { user = JSON.parse(sessionStorage.getItem('rt_user')); } catch (e) { user = null; }
  if (!user) { window.location.href = 'rt-login.html'; return; }

  let categories = [];
  let products = [];
  let shift = null;
  let cart = {};
  let selectedCat = 'all';
  let searchTerm = '';
  let currentMethod = 'كاش';
  let dayCloseStats = null;

  // ── Modal helpers ──
  function openModal(id) { document.getElementById(id).classList.add('show'); }
  function closeModal(id) { document.getElementById(id).classList.remove('show'); }

  // ── Loading ──
  async function loadAll() {
    [categories, products, shift] = await Promise.all([
      RT_DB.categories.all(),
      RT_DB.products.all(),
      RT_DB.shifts.getOpen()
    ]);
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function updateShiftUI() {
    const dayLabel = document.getElementById('dayLabel');
    const shiftBtn = document.getElementById('shiftBtn');
    const dayCloseBtn = document.getElementById('dayCloseBtn');
    if (shift) {
      dayLabel.textContent = 'اليوم: ' + shift.openDate + ' — الشيفت مفتوح بواسطة ' + (shift.openedBy || '');
      shiftBtn.innerHTML = '<i class="fa-solid fa-moon"></i> غلق الشيفت';
      dayCloseBtn.style.display = 'flex';
      dayCloseBtn.style.visibility = 'visible';
    } else {
      dayLabel.textContent = 'اليوم: ' + rtLocalDateKey(RT_FB.clockNow()) + ' — الشيفت مغلق';
      shiftBtn.innerHTML = '<i class="fa-solid fa-sun"></i> فتح الشيفت';
      dayCloseBtn.style.display = 'none';
    }
  }

  // ── Categories ──
  function renderCategories() {
    const tabs = document.getElementById('catTabs');
    let html = '<button class="category-btn active" data-cat="all">الكل</button>';
    categories.forEach(c => {
      html += '<button class="category-btn" data-cat="' + escapeHtml(c.slug) + '">' + escapeHtml(c.name) + '</button>';
    });
    tabs.innerHTML = html;
    tabs.querySelectorAll('.category-btn').forEach(btn => {
      btn.onclick = () => {
        selectedCat = btn.dataset.cat;
        document.querySelectorAll('#catTabs .category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProducts();
      };
    });
  }

  // ── Products ──
  function renderProducts() {
    const grid = document.getElementById('productGrid');
    let list = products.filter(p => p.available);
    if (selectedCat !== 'all') list = list.filter(p => p.category === selectedCat);
    if (searchTerm) list = list.filter(p => (p.name || '').includes(searchTerm));

    if (list.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-utensils"></i><h3>لا توجد منتجات</h3><p>أضف المنتجات من صفحة الإعدادات</p></div>';
      return;
    }

    grid.innerHTML = list.map(p => {
      const inCart = cart[p.id] || 0;
      return '<div class="rt-prod">' +
        '<div class="rt-prod-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="rt-prod-price">' + Number(p.price).toLocaleString() + ' ج.م</div>' +
        (inCart > 0 ? '<div class="rt-prod-qty">' + inCart + '</div>' : '') +
        '<button class="rt-prod-add" data-id="' + escapeHtml(p.id) + '"><i class="fa-solid fa-plus"></i> أضف</button>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.rt-prod-add').forEach(btn => {
      btn.onclick = () => { addToCart(btn.dataset.id); };
    });
  }

  // ── Cart ──
  function addToCart(id) { cart[id] = (cart[id] || 0) + 1; renderCart(); renderProducts(); }
  function inc(id) { cart[id]++; renderCart(); renderProducts(); }
  function dec(id) { cart[id]--; if (cart[id] <= 0) delete cart[id]; renderCart(); renderProducts(); }

  function cartTotal() {
    let total = 0;
    Object.keys(cart).forEach(pid => {
      const p = products.find(x => x.id === pid);
      if (p) total += cart[pid] * Number(p.price);
    });
    return total;
  }

  function renderCart() {
    const itemsEl = document.getElementById('cartItems');
    let total = 0;
    const rows = [];
    Object.keys(cart).forEach(pid => {
      const p = products.find(x => x.id === pid);
      if (!p) return;
      const qty = cart[pid];
      const line = qty * Number(p.price);
      total += line;
      rows.push('<div class="rt-cart-item">' +
        '<div class="rt-cart-item-info"><strong>' + escapeHtml(p.name) + '</strong><span>' + qty + ' × ' + Number(p.price).toLocaleString() + '</span></div>' +
        '<div class="rt-cart-ctl">' +
          '<button data-a="dec" data-id="' + escapeHtml(p.id) + '"><i class="fa-solid fa-minus"></i></button>' +
          '<b>' + qty + '</b>' +
          '<button data-a="inc" data-id="' + escapeHtml(p.id) + '"><i class="fa-solid fa-plus"></i></button>' +
        '</div>' +
      '</div>');
    });
    itemsEl.innerHTML = rows.join('') || '<div class="empty-state" style="padding:26px 10px"><i class="fa-solid fa-cart-arrow-down"></i><h3>السلة فارغة</h3><p>اختر منتجات من اليسار</p></div>';
    itemsEl.querySelectorAll('button').forEach(b => {
      b.onclick = () => { if (b.dataset.a === 'inc') inc(b.dataset.id); else dec(b.dataset.id); };
    });
    document.getElementById('cartTotal').textContent = total.toLocaleString() + ' ج.م';
    updateChange();
  }

  function updateChange() {
    const total = cartTotal();
    const paid = Number(document.getElementById('paidInput').value) || 0;
    const change = currentMethod === 'كاش' ? Math.max(0, paid - total) : 0;
    document.getElementById('changeOut').textContent = change.toLocaleString() + ' ج.م';
  }

  // ── Today summary ──
  async function refreshSummary() {
    const all = await RT_DB.invoices.all();
    const dayKey = shift ? shift.openDate : rtLocalDateKey(RT_FB.clockNow());
    const invs = all.filter(i => i.dayKey === dayKey);
    let total = 0, cash = 0, card = 0;
    invs.forEach(i => {
      total += Number(i.total || 0);
      if (i.paymentMethod === 'كاش') cash += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
      else card += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
    });
    document.getElementById('sumTotal').textContent = total.toLocaleString() + ' ج.م';
    document.getElementById('sumCash').textContent = cash.toLocaleString() + ' ج.م';
    document.getElementById('sumCard').textContent = card.toLocaleString() + ' ج.م';
    document.getElementById('sumInvoices').textContent = invs.length;
    renderTodayInvoices(invs);
  }

  function renderTodayInvoices(invs) {
    const el = document.getElementById('todayInvoices');
    if (invs.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding:30px 10px"><i class="fa-solid fa-receipt"></i><h3>لا توجد فواتير لهذا اليوم بعد</h3></div>';
      return;
    }
    const sorted = invs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let rows = sorted.map(i => {
      const time = i.date ? new Date(i.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
      return '<tr>' +
        '<td>' + escapeHtml(i.id) + '</td>' +
        '<td>' + escapeHtml(time) + '</td>' +
        '<td>' + (i.items || []).reduce((s, it) => s + Number(it.qty || 0), 0) + '</td>' +
        '<td>' + escapeHtml(i.paymentMethod) + '</td>' +
        '<td>' + Number(i.total || 0).toLocaleString() + ' ج.م</td>' +
      '</tr>';
    }).join('');
    el.innerHTML = '<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>رقم الفاتورة</th><th>الوقت</th><th>الأصناف</th><th>الدفع</th><th>الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // ── Checkout ──
  document.getElementById('checkoutBtn').onclick = async () => {
    const total = cartTotal();
    if (total <= 0 || Object.keys(cart).length === 0) {
      alert('السلة فارغة');
      return;
    }
    let paid = Number(document.getElementById('paidInput').value) || 0;
    if (currentMethod === 'كاش') {
      if (paid < total) { alert('المبلغ المدفوع أقل من الإجمالي'); return; }
    } else {
      paid = total;
    }
    const dayKey = shift ? shift.openDate : rtLocalDateKey(RT_FB.clockNow());
    const items = Object.keys(cart).map(pid => {
      const p = products.find(x => x.id === pid);
      const qty = cart[pid];
      return { productId: pid, name: p ? p.name : pid, qty: qty, price: Number(p ? p.price : 0), lineTotal: qty * Number(p ? p.price : 0) };
    });
    const inv = {
      id: 'RINV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      date: RT_FB.nowISO(),
      dayKey: dayKey,
      shiftId: shift ? shift.id : null,
      items: items,
      total: total,
      paid: paid,
      change: currentMethod === 'كاش' ? Math.max(0, paid - total) : 0,
      paymentMethod: currentMethod,
      status: 'completed'
    };
    await RT_DB.invoices.add(inv);
    await RT_DB.audit.log('invoice_created', { id: inv.id, total: total, method: currentMethod });
    cart = {};
    document.getElementById('paidInput').value = '';
    renderCart();
    renderProducts();
    await refreshSummary();
  };

  document.getElementById('paidInput').addEventListener('input', updateChange);

  document.getElementById('methodBtns').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      currentMethod = btn.dataset.method;
      document.querySelectorAll('#methodBtns button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (currentMethod === 'شبكة') document.getElementById('paidInput').value = cartTotal();
      updateChange();
    };
  });

  // ── Shift open/close ──
  document.getElementById('shiftBtn').onclick = () => {
    if (shift) {
      openModal('shiftCloseModal');
    } else {
      document.getElementById('shiftOpenDate').textContent = 'اليوم: ' + rtLocalDateKey(RT_FB.clockNow());
      openModal('shiftOpenModal');
    }
  };

  document.getElementById('confirmShiftOpen').onclick = async () => {
    const s = await RT_DB.shifts.open(user.name);
    await RT_DB.audit.log('shift_open', { id: s.id, date: s.openDate });
    shift = s;
    closeModal('shiftOpenModal');
    updateShiftUI();
    await refreshSummary();
  };

  document.getElementById('confirmShiftClose').onclick = async () => {
    if (shift) {
      await RT_DB.shifts.close(shift.id, { closedAt: RT_FB.nowISO(), closedBy: user.name });
      await RT_DB.audit.log('shift_close', { id: shift.id, date: shift.openDate });
    }
    shift = null;
    closeModal('shiftCloseModal');
    updateShiftUI();
    await refreshSummary();
  };

  // ── Day close ──
  document.getElementById('dayCloseBtn').onclick = async () => {
    if (!shift) return;
    const all = await RT_DB.invoices.all();
    const dayKey = shift.openDate;
    const invs = all.filter(i => i.dayKey === dayKey);
    let total = 0, cash = 0, card = 0, itemsSold = 0;
    invs.forEach(i => {
      total += Number(i.total || 0);
      if (i.paymentMethod === 'كاش') cash += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
      else card += Number(i.paid != null && Number(i.paid) > 0 ? i.paid : (i.total || 0));
      (i.items || []).forEach(it => itemsSold += Number(it.qty || 0));
    });
    const existing = await RT_DB.daycloses.all();
    const alreadyClosed = existing.some(d => d.date === dayKey);
    dayCloseStats = { dayKey, total, invoicesCount: invs.length, cash, card, itemsSold, alreadyClosed };

    document.getElementById('dcDate').textContent = 'اليوم: ' + dayKey;
    document.getElementById('dcSales').textContent = total.toLocaleString() + ' ج.م';
    document.getElementById('dcInvoices').textContent = invs.length;
    document.getElementById('dcCash').textContent = cash.toLocaleString() + ' ج.م';
    document.getElementById('dcCard').textContent = card.toLocaleString() + ' ج.م';
    document.getElementById('dcItemsSold').textContent = itemsSold;
    openModal('dayCloseModal');
  };

  document.getElementById('confirmDayClose').onclick = async () => {
    if (!dayCloseStats || !shift) return;
    const s = dayCloseStats;
    if (!s.alreadyClosed) {
      await RT_DB.daycloses.add({
        date: s.dayKey,
        totalSales: s.total,
        invoicesCount: s.invoicesCount,
        cashAmount: s.cash,
        cardAmount: s.card,
        itemsSold: s.itemsSold,
        closedAt: RT_FB.nowISO(),
        closedBy: user.name
      });
    }
    await RT_DB.shifts.close(shift.id, { closedAt: RT_FB.nowISO(), closedBy: user.name });
    await RT_DB.audit.log('day_close', { date: s.dayKey, total: s.total });
    shift = null;
    dayCloseStats = null;
    closeModal('dayCloseModal');
    updateShiftUI();
    await refreshSummary();
    alert('تم إغلاق اليوم ' + s.dayKey + ' — إجمالي المبيعات: ' + s.total.toLocaleString() + ' ج.م');
  };

  // ── Modal close buttons ──
  document.getElementById('closeShiftOpen').onclick = () => closeModal('shiftOpenModal');
  document.getElementById('cancelShiftOpen').onclick = () => closeModal('shiftOpenModal');
  document.getElementById('closeShiftClose').onclick = () => closeModal('shiftCloseModal');
  document.getElementById('cancelShiftClose').onclick = () => closeModal('shiftCloseModal');
  document.getElementById('closeDayClose').onclick = () => closeModal('dayCloseModal');
  document.getElementById('cancelDayClose').onclick = () => closeModal('dayCloseModal');

  // ── Search ──
  document.getElementById('searchInput').addEventListener('input', e => {
    searchTerm = e.target.value.trim();
    renderProducts();
  });

  // ── Sidebar toggle ──
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar && overlay) {
    function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
    toggle.onclick = function() { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); };
    overlay.onclick = closeSidebar;
    document.querySelectorAll('.sidebar nav a').forEach(function(a) { a.onclick = closeSidebar; });
  }

  // ── Init ──
  await loadAll();
  updateShiftUI();
  renderCategories();
  renderProducts();
  renderCart();
  await refreshSummary();
})();
