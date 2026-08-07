let total = 0;
let taxRate = 0;
let enableTax = false;
let serviceRate = 0;
let enableService = false;
let checkoutProcessing = false;
let syncingMilkState = false;
const COOLDOWN_MS = 5000;
const urlParams = new URLSearchParams(window.location.search);
const rawTable = urlParams.get('table');
const tableNum = /^\d+$/.test(rawTable) ? rawTable : '';
const hasService = urlParams.get('service') === '1';
const isCustomer = !!tableNum;
if (isCustomer) {
  document.querySelector('.menu-header h1').textContent = '🍽 القائمة - طاولة ' + tableNum + (hasService ? ' 🌟 ضيافة' : '');
  document.querySelectorAll('.sidebar, #sidebarToggle, .sidebar-overlay').forEach(el => el && (el.style.display = 'none'));
  const mainEl = document.querySelector('.main');
  if (mainEl) { mainEl.style.marginRight = '0'; mainEl.style.width = '100%'; }
  // Hide admin-only checkout fields
  const custSec = document.getElementById('checkoutCustomerSection');
  const paidSec = document.getElementById('checkoutPaidSection');
  const remSec = document.getElementById('checkoutRemainingSection');
  if (custSec) custSec.style.display = 'none';
  if (paidSec) paidSec.style.display = 'none';
  if (remSec) remSec.style.display = 'none';
  // Lock table input for customer QR
  const ti = document.getElementById('tableInput');
  if (ti) { ti.disabled = true; ti.value = tableNum; }
}
(async () => {
  try {
    await DB.seed();
  } catch (e) {
    console.error('[menu] seed error:', e);
  }
  if (hasService) {
    const settings = await DB.settings.get();
    enableService = settings.enableService !== false;
    serviceRate = settings.serviceTax || 10;
    enableTax = settings.enableTax !== false;
    taxRate = settings.taxRate || 14;
  }
})();

function calculateTotals(baseTotal) {
  let serviceAmount = 0, taxAmount = 0, grandTotal = baseTotal;
  if (enableService && serviceRate > 0) {
    serviceAmount = Math.round(baseTotal * serviceRate / 100);
    grandTotal = baseTotal + serviceAmount;
  }
  if (enableTax && taxRate > 0) {
    taxAmount = Math.round(grandTotal * taxRate / 100);
    grandTotal = grandTotal + taxAmount;
  }
  return { serviceAmount, taxAmount, grandTotal };
}

function syncSheetNotesToOrderBox() {
  const sheetList = document.getElementById('sheetOrderList');
  if (!sheetList) return;
  sheetList.querySelectorAll('.order-item').forEach(el => {
    const ni = el.querySelector('.note-input');
    if (!ni || !ni.value) return;
    const nm = el.querySelector('.name');
    if (!nm) return;
    document.querySelectorAll('.order-box .order-list .order-item').forEach(oe => {
      const on = oe.querySelector('.name');
      if (on && on.innerText === nm.innerText) {
        const oi = oe.querySelector('.note-input');
        if (oi) oi.value = ni.value;
      }
    });
  });
}

function syncOrderSheet() {
  const orderList = document.querySelector('.order-box .order-list');
  const sheetList = document.getElementById('sheetOrderList');
  const sheetTotal = document.getElementById('sheetTotal');
  const sheetNoteSave = [];
  if (orderList && sheetList) {
    sheetList.querySelectorAll('.order-item').forEach(el => {
      const ni = el.querySelector('.note-input');
      if (ni && ni.value) {
        const nm = el.querySelector('.name');
        if (nm) sheetNoteSave.push({ name: nm.innerText, note: ni.value });
      }
    });
    sheetList.innerHTML = orderList.innerHTML;
    syncingMilkState = true;
    sheetList.querySelectorAll('.order-item').forEach(el => {
      const ck = el.querySelector('.milk-check');
      if (ck) ck.checked = el.dataset.hasMilk === 'true';
    });
    syncingMilkState = false;
    sheetNoteSave.forEach(({ name, note }) => {
      sheetList.querySelectorAll('.order-item .name').forEach(n => {
        if (n.innerText === name) {
          n.closest('.order-item').querySelector('.note-input').value = note;
        }
      });
    });
  }
  if (sheetTotal) {
    const { serviceAmount, taxAmount, grandTotal } = calculateTotals(total);
    let parts = [grandTotal + ' جنيه'];
    if (serviceAmount > 0) parts.push('خدمة ' + serviceAmount + ' ج.م');
    if (taxAmount > 0) parts.push('ضريبة ' + taxAmount + ' ج.م');
    sheetTotal.textContent = parts.join(' | ');
  }
  let count = 0;
  document.querySelectorAll('.order-box .order-item').forEach(i => {
    const name = i.querySelector('.name');
    if (name) count++;
  });
  const badge = document.getElementById('cartBadge');
  if (badge) badge.textContent = count;
  if (count > 0) badge && (badge.style.display = 'flex'); else badge && (badge.style.display = 'none');
}

async function loadProducts() {
  const rawCats = await DB.categories.all() || [];
  const seen = {};
  const categories = [];
  rawCats.forEach(c => { if (!seen[c.slug]) { seen[c.slug] = true; categories.push(c); } });
  categories.sort((a, b) => (a.order || 0) - (b.order || 0));

  const menuCategories = document.getElementById('menuCategories');
  if (menuCategories) {
    menuCategories.innerHTML = '<button class="category-btn active" data-category="all">الكل</button>';
    categories.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.dataset.category = c.slug;
      btn.textContent = c.name;
      menuCategories.appendChild(btn);
    });
  }

  const products = await DB.products.all() || [];
  const container = document.querySelector('.products');
  if (!container) return;
  container.innerHTML = '';

  const categoryOrder = categories.map(c => c.slug);
  products.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
  products.forEach(p => {
    if (!p.available) return;
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.category = p.category;
    const imgSrc = sanitizeUrl(p.image) || '';
    const safeName = escapeHtml(p.name);
    const safeNameEn = escapeHtml(p.nameEn || '');
    const safeDesc = escapeHtml(p.description || '');
    const safePrice = validateNumber(p.price, 0);
    const fallbackImg = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23f5f5f4%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 font-size=%2240%22>🍽</text></svg>';
    card.innerHTML = `
      <div class="menu-icon"><img loading="lazy" src="${imgSrc || fallbackImg}" alt="${safeName}" onerror="this.src='${fallbackImg}'"></div>
      <h3>${safeName}</h3>
      <p>${safeNameEn}</p>
      ${safeDesc ? `<p class="desc">${safeDesc}</p>` : ''}
      <h2>${safePrice} جنيه</h2>
      <button data-price="${safePrice}">إضافة</button>`;
    container.appendChild(card);
  });

  attachAddToCart();
  attachCategoryFilter();
  attachSearch();
}

async function occupyTable() {
  const tn = tableNum || getTableInput();
  if (!tn) return;
  const count = document.querySelectorAll('.order-box .order-list .order-item .name').length;
  if (count > 0) {
    try {
      const allTables = await DB.tables.all() || [];
      const tbl = allTables.find(t => t.name === 'طاولة ' + tn);
      if (tbl) {
        await DB.tables.update(tbl.id, { status: 'occupied' });
      } else {
        await DB.tables.add({ id: 't' + tn, name: 'طاولة ' + tn, capacity: 4, status: 'occupied', currentOrder: null, hasService: false });
      }
    } catch (e) {
      console.warn('[occupy]', e);
    }
  }
}

function getTableInput() {
  const el = document.getElementById('tableInput');
  return el && !el.disabled ? el.value.trim() : '';
}

function attachAddToCart() {
  document.querySelectorAll(".product-card button").forEach(button => {
    button.addEventListener("click", async function () {
      const card = this.parentElement;
      const name = card.querySelector("h3").innerText;
      const price = Number(this.dataset.price);
      const emptyItem = document.querySelector(".order-box .order-list .order-item");
      if (emptyItem && !emptyItem.querySelector(".name")) emptyItem.remove();
      let found = false;
      document.querySelectorAll(".order-box .order-list .order-item").forEach(item => {
        const product = item.querySelector(".name");
        if (!product) return;
        if (product.innerText === name) {
          const qtyEl = item.querySelector(".qty");
          let qty = parseInt(qtyEl.innerText);
          qty++;
          qtyEl.innerText = qty;
          const effective = price + (item.dataset.hasMilk === 'true' ? 15 : 0);
          item.querySelector(".price").innerText = (qty * effective) + " جنيه";
          total += effective;
          found = true;
        }
      });
      if (!found) {
        const item = document.createElement("div");
        item.className = "order-item";
        item.dataset.price = price;
        item.dataset.hasMilk = 'false';
        item.innerHTML = `
          <div class="order-top"><span class="name">${escapeHtml(name)}</span><button class="note-btn" title="أضف ملاحظة"><i class="fa-solid fa-pen"></i>ملاحظة</button><button class="delete"><i class="fa-solid fa-trash"></i></button></div>
          <div class="price">${price} جنيه</div>
          <div class="item-note" style="display:none"><input class="note-input" placeholder="إضافة (قهوة محوج، بدون سكر...)" style="width:100%;height:36px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:13px;font-family:inherit;outline:none;background:#fafaf9;margin-bottom:8px"></div>
          <div class="order-bottom"><div class="controls"><button class="minus">-</button><span class="qty">1</span><button class="plus">+</button></div><label class="milk-toggle"><input type="checkbox" class="milk-check"><span class="checkmark"></span> +حليب 15 ج.م</label></div>`;
        document.querySelector(".order-box .order-list").appendChild(item);
        total += price;
      }
      document.querySelector(".total strong").innerText = total + " جنيه";
      syncOrderSheet();
      await occupyTable();
    });
  });
}

function getItemPrice(itemEl) {
  return Number(itemEl.dataset.price) + (itemEl.dataset.hasMilk === 'true' ? 15 : 0);
}

function formatItemPrice(itemEl) {
  const base = Number(itemEl.dataset.price);
  const milk = itemEl.dataset.hasMilk === 'true';
  const qty = parseInt(itemEl.querySelector('.qty').innerText);
  const effective = milk ? base + 15 : base;
  return (qty * effective) + ' جنيه' + (milk ? ' (مع حليب)' : '');
}

function handleOrderClick(e) {
  const btn = e.target.closest('.plus, .minus, .delete, .note-btn');
  if (!btn) return;
  if (btn.classList.contains('note-btn')) {
    const item = btn.closest('.order-item');
    if (!item) return;
    const noteDiv = item.querySelector('.item-note');
    if (noteDiv) {
      const showing = noteDiv.style.display !== 'none';
      noteDiv.style.display = showing ? 'none' : 'block';
      btn.classList.toggle('active', !showing);
    }
    return;
  }
  const item = btn.closest('.order-item');
  if (!item) return;
  const nameEl = item.querySelector('.name');
  if (!nameEl) return;
  const name = nameEl.innerText;
  // Source of truth is always order-box list
  let targetItem = null;
  document.querySelectorAll('.order-box .order-list .order-item').forEach(el => {
    const n = el.querySelector('.name');
    if (n && n.innerText === name) targetItem = el;
  });
  if (!targetItem) return;
  if (btn.classList.contains('plus')) {
    const qty = targetItem.querySelector('.qty');
    let q = parseInt(qty.innerText);
    q++;
    qty.innerText = q;
    const effective = getItemPrice(targetItem);
    targetItem.querySelector('.price').innerText = (q * effective) + ' جنيه';
    total += effective;
  } else if (btn.classList.contains('minus')) {
    const qtyEl = targetItem.querySelector('.qty');
    let q = parseInt(qtyEl.innerText);
    if (q <= 1) return;
    q--;
    qtyEl.innerText = q;
    const effective = getItemPrice(targetItem);
    targetItem.querySelector('.price').innerText = (q * effective) + ' جنيه';
    total -= effective;
  } else if (btn.classList.contains('delete')) {
    const qty = parseInt(targetItem.querySelector('.qty').innerText);
    const effective = getItemPrice(targetItem);
    total -= qty * effective;
    targetItem.remove();
    if (!document.querySelector('.order-box .order-list .order-item .name')) {
      document.querySelector('.order-box .order-list').innerHTML = '<div class="order-item"><span>لا توجد منتجات</span><strong>0</strong></div>';
    }
  }
  document.querySelector('.total strong').innerText = total + ' جنيه';
  syncOrderSheet();
}

document.querySelector('.order-box .order-list').addEventListener('click', handleOrderClick);
document.getElementById('sheetOrderList').addEventListener('click', handleOrderClick);

function handleMilkChange(e) {
  if (syncingMilkState) return;
  const ck = e.target;
  if (!ck.classList.contains('milk-check')) return;
  const item = ck.closest('.order-item');
  if (!item) return;
  const isSheet = !!item.closest('#sheetOrderList');
  const name = item.querySelector('.name')?.innerText;
  if (!name) return;
  const targetItem = isSheet
    ? Array.from(document.querySelectorAll('.order-box .order-list .order-item')).find(el =>
        el.querySelector('.name')?.innerText === name
      )
    : item;
  if (!targetItem) return;
  targetItem.dataset.hasMilk = ck.checked ? 'true' : 'false';
  const base = parseInt(targetItem.dataset.price);
  const qty = parseInt(targetItem.querySelector('.qty').innerText);
  total += (ck.checked ? 1 : -1) * 15 * qty;
  targetItem.querySelector('.price').innerText = formatItemPrice(targetItem);
  document.querySelector('.total strong').innerText = total + ' جنيه';
  syncOrderSheet();
}

const orderList = document.querySelector('.order-box .order-list');
if (orderList) orderList.addEventListener('change', handleMilkChange);
const sheetList = document.getElementById('sheetOrderList');
if (sheetList) sheetList.addEventListener('change', handleMilkChange);

function attachCategoryFilter() {
  const catButtons = document.querySelectorAll(".category-btn");
  catButtons.forEach(button => {
    button.addEventListener("click", () => {
      catButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      const category = button.dataset.category;
      document.querySelectorAll(".product-card").forEach(product => {
        product.style.display = category === "all" || product.dataset.category === category ? "block" : "none";
      });
    });
  });
}

function attachSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;
  searchInput.addEventListener("keyup", function () {
    const value = this.value.toLowerCase();
    document.querySelectorAll(".product-card").forEach(card => {
      const name = card.querySelector("h3").innerText.toLowerCase();
      const english = card.querySelector("p") ? card.querySelector("p").innerText.toLowerCase() : "";
      card.style.display = name.includes(value) || english.includes(value) ? "" : "none";
    });
  });
}

const clearBtn = document.querySelector(".clear-order");
const clearModal = document.getElementById('confirmModal');
const clearYesBtn = clearModal.querySelector(".confirm-btn");
const clearNoBtn = clearModal.querySelector(".cancel-btn");

clearBtn.addEventListener("click", () => clearModal.classList.add("show"));
clearNoBtn.addEventListener("click", () => clearModal.classList.remove("show"));
function clearOrder() {
  document.querySelector(".order-box .order-list").innerHTML = `<div class="order-item"><span>لا توجد منتجات</span><strong>0</strong></div>`;
  const sol = document.getElementById('sheetOrderList');
  if (sol) sol.innerHTML = `<div class="order-item"><span>لا توجد منتجات</span><strong>0</strong></div>`;
  total = 0;
  document.querySelector(".total strong").innerText = "0 جنيه";
  const st = document.getElementById('sheetTotal');
  if (st) st.textContent = "0 جنيه";
  syncOrderSheet();
}
clearYesBtn.addEventListener("click", () => {
  clearOrder();
  clearModal.classList.remove("show");
});

const checkoutBtn = document.querySelector(".checkout");
checkoutBtn.addEventListener("click", () => {
  syncSheetNotesToOrderBox();
  const items = [];
  document.querySelectorAll(".order-box .order-list .order-item .name").forEach(el => {
    const itemEl = el.closest(".order-item");
    const qty = parseInt(itemEl.querySelector(".qty").innerText);
    const priceText = itemEl.dataset.price;
    const noteInput = itemEl.querySelector('.note-input');
    const note = noteInput ? noteInput.value.trim() : '';
    const hasMilk = itemEl.dataset.hasMilk === 'true';
    const effectivePrice = Number(priceText) + (hasMilk ? 15 : 0);
    if (priceText) items.push({ name: el.innerText, qty, price: effectivePrice, note, hasMilk });
  });
  if (items.length === 0) return alert("الطلب فارغ، أضف منتجات أولاً");
  const totalAmount = items.reduce((s, i) => s + i.qty * i.price, 0);
  const { serviceAmount, taxAmount, grandTotal } = calculateTotals(totalAmount);
  // Reset checkout form
  document.getElementById('checkoutCustomerType').value = 'regular';
  document.getElementById('checkoutSpecialFields').style.display = 'none';
  document.getElementById('checkoutSpecialName').value = '';
  document.getElementById('checkoutSpecialPrice').value = '';
  (async () => {
    const allCusts = await DB.customers.all();
    const dl = document.getElementById('custList');
    if (dl) dl.innerHTML = allCusts.map(c => '<option value="' + escapeHtml(c.name) + '">').join('');
  })();
  let checkoutLabel = grandTotal + ' جنيه';
  if (serviceAmount > 0) checkoutLabel += ' (خدمة ' + serviceAmount + ' ج.م)';
  if (taxAmount > 0) checkoutLabel += ' (ضريبة ' + taxAmount + ' ج.م)';
  document.getElementById('checkoutTotal').textContent = checkoutLabel;
  document.getElementById('checkoutPaid').value = '';
  window._itemsTotal = grandTotal;
  window._checkoutTotal = grandTotal;
  window._checkoutItems = items;
  window._checkoutService = serviceAmount;
  window._checkoutTax = taxAmount;
  window.calcRemaining();
  document.getElementById('checkoutModal').classList.add('show');
});

// Customer type toggle — show/hide special fields and update total
document.getElementById('checkoutCustomerType').onchange = function() {
  const isSpecial = this.value === 'special';
  document.getElementById('checkoutSpecialFields').style.display = isSpecial ? 'block' : 'none';
  if (isSpecial) {
    const val = Number(document.getElementById('checkoutSpecialPrice').value);
    if (val > 0) {
      window._checkoutTotal = val;
      document.getElementById('checkoutTotal').textContent = val + ' جنيه';
    }
  } else {
    window._checkoutTotal = window._itemsTotal;
    document.getElementById('checkoutTotal').textContent = window._itemsTotal + ' جنيه';
  }
  window.calcRemaining();
};

// Special price input — update total dynamically
document.getElementById('checkoutSpecialPrice').addEventListener('input', function() {
  if (document.getElementById('checkoutCustomerType').value !== 'special') return;
  const val = Number(this.value) || 0;
  window._checkoutTotal = val;
  document.getElementById('checkoutTotal').textContent = val + ' جنيه';
  document.getElementById('checkoutPaid').value = val;
  window.calcRemaining();
});

// Calculate remaining/change in checkout modal
window.calcRemaining = function() {
  const total = window._checkoutTotal || 0;
  const paid = Number(document.getElementById('checkoutPaid').value) || 0;
  const diff = total - paid;
  const remLabel = document.getElementById('checkoutRemainingLabel');
  const remSpan = document.getElementById('checkoutRemaining');
  const remSection = document.getElementById('checkoutRemainingSection');
  if (!remSpan) return;
  if (paid > total) {
    remLabel.textContent = 'الباقي للعميل';
    remSpan.textContent = (paid - total) + ' جنيه';
    remSection.style.background = '#f0fdf4';
    remSpan.style.color = '#059669';
    remLabel.style.color = '#059669';
  } else {
    remLabel.textContent = 'المتبقي';
    remSpan.textContent = Math.abs(diff) + ' جنيه';
    remSection.style.background = '#fef2f2';
    remSpan.style.color = '#dc2626';
    remLabel.style.color = '#dc2626';
  }
};
document.getElementById('checkoutPaid').addEventListener('input', window.calcRemaining);

document.getElementById('confirmCheckout').onclick = async () => {
  if (checkoutProcessing) return;
  if (isCustomer && tableNum) {
    const lastKey = 'laguna_last_order_t' + tableNum;
    const lastTime = Number(localStorage.getItem(lastKey)) || 0;
    if (Date.now() - lastTime < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastTime)) / 1000);
      return alert('يرجى الانتظار ' + remaining + ' ثوانٍ قبل إرسال طلب جديد');
    }
    localStorage.setItem(lastKey, Date.now());
  }
  checkoutProcessing = true;
  document.getElementById('confirmCheckout').disabled = true;
  document.getElementById('confirmCheckout').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري...';

  const resetCheckout = () => {
    checkoutProcessing = false;
    document.getElementById('confirmCheckout').disabled = false;
    document.getElementById('confirmCheckout').innerHTML = 'تأكيد الدفع';
  };

  try {
    syncSheetNotesToOrderBox();
    const custType = document.getElementById('checkoutCustomerType').value;
    let customer, totalAmount;
    if (custType === 'special') {
      customer = document.getElementById('checkoutSpecialName').value.trim();
      if (!customer) { resetCheckout(); return alert('يرجى إدخال اسم العميل الخاص'); }
      totalAmount = Number(document.getElementById('checkoutSpecialPrice').value);
      if (!totalAmount || totalAmount <= 0) { resetCheckout(); return alert('يرجى إدخال السعر المخصص للعميل الخاص'); }
    } else {
      customer = 'نقدي';
      totalAmount = window._checkoutTotal;
    }
    const method = document.getElementById('checkoutMethod').value;
    const items = window._checkoutItems || [];
    const serviceAmount = window._checkoutService || 0;
    const taxAmount = window._checkoutTax || 0;
    const table = (tableNum || getTableInput()) ? 'طاولة ' + (tableNum || getTableInput()) : null;
    const paid = Math.max(0, Number(document.getElementById('checkoutPaid').value) || 0);
    const change = Math.max(0, paid - totalAmount);
    if (custType !== 'special') {
      const allProds = await DB.products.all() || [];
      const priceMap = {};
      allProds.forEach(p => { priceMap[p.name] = Number(p.price); });
      for (const item of items) {
        const catalogPrice = priceMap[item.name];
        if (catalogPrice !== undefined) {
          const expected = catalogPrice + (item.hasMilk ? 15 : 0);
          if (item.price !== expected) {
            resetCheckout();
            return alert('خطأ في السعر: "' + item.name + '" - السعر المتوقع ' + expected + ' ج.م ولكن وجد ' + item.price + ' ج.م');
          }
        }
      }
    }
    const invId = 'INV-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    let inv, matchedCust, custReadFailed = false;
    if (custType === 'special') {
      try {
        const allCusts = await DB.customers.all() || [];
        matchedCust = allCusts.find(c => c.name === customer);
        if (!matchedCust) { resetCheckout(); return alert('العميل "' + customer + '" غير موجود في قائمة العملاء المميزين'); }
      } catch(e) { custReadFailed = true; console.warn('[checkout] could not read customers:', e); }
    }
    try {
      await FB.runTransaction(async (tx) => {
        const rawDb = FB.getDb();
        const tn = tableNum || getTableInput();
        if (tn) {
          const allTables = await DB.tables.all() || [];
          const tbl = allTables.find(t => t.name === 'طاولة ' + tn);
          if (tbl) {
            const tableRef = rawDb.collection('tables_').doc(tbl.id);
            tx.update(tableRef, { status: 'occupied' });
          }
        }
        const invData = { id: invId, customer, table, date: FB.nowISO(), items, total: totalAmount, paid, change, remaining: Math.max(0, totalAmount - paid), serviceAmount, taxAmount, paymentMethod: method, status: 'pending' };
        const uid = FB.getUid();
        if (uid) invData._uid = uid;
        tx.set(rawDb.collection('invoices').doc(invId), invData);
      });
      try {
        if (matchedCust) {
          await DB.customers.update(matchedCust.id, {
            visits: (matchedCust.visits || 0) + 1,
            totalSpent: (matchedCust.totalSpent || 0) + totalAmount,
            lastVisit: FB.nowISO()
          });
        }
      } catch(e) { console.warn('[checkout] customer stats update failed:', e); }
      inv = { id: invId, customer, table, date: FB.nowISO(), items, total: totalAmount, paid, change, remaining: Math.max(0, totalAmount - paid), serviceAmount, taxAmount, paymentMethod: method, status: 'pending' };
    } catch (e) {
      resetCheckout();
      console.error('[checkout] transaction error:', e);
      return alert('فشل إنشاء الفاتورة: ' + e.message);
    }
    DB.audit.log('invoice_created', { id: invId, total: totalAmount, method: method, customer: customer, table: table });
    document.getElementById('checkoutModal').classList.remove('show');
    if (inv && inv.id) {
      const isAdmin = !!sessionStorage.getItem('laguna_user');
      const printSettings = (await DB.settings.get()) || {};
      const autoPrintReceipt = printSettings.autoPrintReceipt !== false;
      const autoPrintKitchen = printSettings.autoPrintKitchen !== false;
      const copies = printSettings.printCopies || 1;
      const hasPrinter = typeof PRINTER !== 'undefined' && PRINTER.isConnected();

      if (isCustomer || !isAdmin) {
        alert(`تم إنشاء الفاتورة ${inv.id}\nالإجمالي: ${totalAmount} ج.م\nالمدفوع: ${paid} ج.م`);
      } else {
        const safeItems = inv.items && inv.items.length
          ? '<div style="margin:8px 0">' + inv.items.map(it => {
              const safeName = escapeHtml(it.name);
              const milkTxt = it.hasMilk ? ' +حليب' : '';
              const safeNote = escapeHtml(it.note || '');
              const noteTxt = safeNote ? ' (' + safeNote + ')' : '';
              return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #eee;font-size:13px"><span>• ${safeName}${milkTxt}${noteTxt} x${it.qty}</span><span>${it.qty * it.price} ج.م</span></div>`;
            }).join('') + '</div><hr style="margin:8px 0;border:none;border-top:2px dashed #ddd">'
          : '';
        document.getElementById('successDetails').innerHTML = `
          <img src="images/logo.png" style="height:55px;margin-bottom:4px;background:#222;padding:6px;border-radius:8px" alt="LagunaBoat">
          <div style="font-size:14px;font-weight:700;margin-bottom:4px">LagunaBoat</div>
          <div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:8px">** فاتورة كاشير **</div>
          <div style="font-size:11px;color:#888;margin-bottom:4px">#${escapeHtml(inv.id)}</div>
          ${safeItems}
          ${inv.serviceAmount > 0 ? `<div style="display:flex;justify-content:space-between;margin:2px 0;color:#888;font-size:12px"><span>خدمة (${Math.round(inv.serviceAmount / (totalAmount - inv.serviceAmount - (inv.taxAmount || 0)) * 100) || 0}%)</span><span>${inv.serviceAmount} ج.م</span></div>` : ''}
          ${inv.taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;margin:2px 0;color:#888;font-size:12px"><span>ضريبة (${Math.round(inv.taxAmount / (totalAmount - inv.taxAmount) * 100) || 0}%)</span><span>${inv.taxAmount} ج.م</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;margin:2px 0;font-weight:700;font-size:15px;padding-top:4px"><span>الإجمالي</span><span>${totalAmount} ج.م</span></div>
          <div style="display:flex;justify-content:space-between;margin:2px 0"><span>المدفوع</span><span>${paid} ج.م</span></div>
          ${inv.change > 0 ? `<div style="display:flex;justify-content:space-between;margin:2px 0;color:#059669"><span>الباقي للعميل</span><span>${inv.change} ج.م</span></div>` : ''}
          ${inv.remaining > 0 ? `<div style="display:flex;justify-content:space-between;margin:2px 0;color:#dc2626"><span>المتبقي</span><span>${inv.remaining} ج.م</span></div>` : ''}
        `.trim();

        const btnContainer = document.getElementById('successButtons');
        btnContainer.innerHTML = '';

        const cashierBtn = document.createElement('button');
        cashierBtn.style.cssText = 'flex:1;height:44px;border-radius:12px;font-size:13px;font-weight:700;background:linear-gradient(135deg,var(--accent),var(--accent-light));color:#fff;border:none;cursor:pointer';
        cashierBtn.innerHTML = '<i class="fa-solid fa-receipt"></i> طباعة الكاشير';

        const kitchenBtn = document.createElement('button');
        kitchenBtn.style.cssText = 'flex:1;height:44px;border-radius:12px;font-size:13px;font-weight:700;background:#dc2626;color:#fff;border:none;cursor:pointer';
        kitchenBtn.innerHTML = '<i class="fa-solid fa-utensils"></i> طباعة المطبخ';

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'flex:1;height:44px;border-radius:12px;font-size:14px;font-weight:600;background:#f5f5f4;color:var(--primary);border:none;cursor:pointer';
        closeBtn.textContent = 'إغلاق';

        btnContainer.appendChild(cashierBtn);
        btnContainer.appendChild(kitchenBtn);
        btnContainer.appendChild(closeBtn);

        document.getElementById('successModal').classList.add('show');

        const printCashier = async () => {
          let printed = false;
          try {
            if (localStorage.getItem('laguna_print_agent_enabled') === 'true') {
              const agentResult = await PRINTER.printViaAgent(inv, 'invoice', { noAutoKitchen: true, openDrawer: paid >= totalAmount });
              if (agentResult && agentResult.ok) printed = true;
            }
            if (!printed && typeof PRINTER !== 'undefined' && PRINTER.isConnected()) {
              const result = await PRINTER.printReceipt(inv);
              if (result && result.ok) printed = true;
              if (printed && paid >= totalAmount) await PRINTER.openDrawer();
            }
          } catch(e) { console.warn('[print]', e); }
          if (!printed) {
            const tpl = await TEMPLATE.getTemplate('cashier');
            const w = window.open('', '_blank', 'width=400,height=600');
            w.document.write(TEMPLATE.renderCashier(inv, tpl || TEMPLATE.defaultCashierTemplate));
            w.document.close();
          }
        };

        const printKitchen = async () => {
          let printed = false;
          try {
            if (localStorage.getItem('laguna_print_agent_enabled') === 'true') {
              const agentResult = await PRINTER.printViaAgent(inv, 'kitchen');
              if (agentResult && agentResult.ok) printed = true;
            }
            if (!printed && typeof PRINTER !== 'undefined' && PRINTER.isConnected()) {
              await PRINTER.printKitchenOrder(inv);
              printed = true;
            }
          } catch(e) { console.warn('[print]', e); }
          if (!printed) {
            const tpl = await TEMPLATE.getTemplate('kitchen');
            const w = window.open('', '_blank', 'width=400,height=600');
            w.document.write(TEMPLATE.renderKitchen(inv, tpl || TEMPLATE.defaultKitchenTemplate));
            w.document.close();
          }
        };

        cashierBtn.onclick = async () => { document.getElementById('successModal').classList.remove('show'); await printCashier(); };
        kitchenBtn.onclick = async () => { document.getElementById('successModal').classList.remove('show'); await printKitchen(); };
        const hideSuccess = () => document.getElementById('successModal').classList.remove('show');
        closeBtn.onclick = hideSuccess;
      }
    } else {
      alert(`تم إنشاء الفاتورة\nالإجمالي: ${totalAmount} ج.م\nالمدفوع: ${paid} ج.م`);
    }
    clearOrder();
  } catch (e) {
    console.error('[checkout] error:', e);
    alert('حدث خطأ أثناء إنشاء الفاتورة. حاول مرة أخرى.');
  }
  resetCheckout();
};
document.getElementById('cancelCheckout').onclick = () => {
  document.getElementById('checkoutModal').classList.remove('show');
};

// Mobile cart floating button
const cartFloat = document.getElementById('cartFloat');
const cartSheet = document.getElementById('cartSheet');
const sheetClose = document.getElementById('sheetClose');
const sheetOrderList = document.getElementById('sheetOrderList');
const sheetTotal = document.getElementById('sheetTotal');
const sheetCheckout = document.getElementById('sheetCheckout');
const sheetClear = document.getElementById('sheetClear');

if (cartFloat && cartSheet) {
  cartFloat.onclick = () => { cartSheet.style.display = 'flex'; syncOrderSheet(); };
  sheetClose.onclick = () => cartSheet.style.display = 'none';
  cartSheet.onclick = (e) => { if (e.target === cartSheet) cartSheet.style.display = 'none'; };
  sheetCheckout.onclick = () => { cartSheet.style.display = 'none'; checkoutBtn.click(); };
  sheetClear.onclick = () => { cartSheet.style.display = 'none'; clearBtn.click(); };
}

async function autoConnectPrinter() {
  try {
    await PRINTER.restorePrinters();
    if (PRINTER.isConnected()) return;
    const btn = document.createElement('button');
    btn.id = 'connectPrinterBtn';
    btn.innerHTML = '🖨️ توصيل الطابعة';
    btn.style.cssText = 'position:fixed;bottom:80px;right:15px;z-index:999;background:#e94560;color:#fff;border:none;border-radius:50px;padding:12px 20px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(233,69,96,0.4);transition:0.2s';
    btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    btn.onclick = async () => {
      btn.innerHTML = '⏳ جاري...';
      btn.disabled = true;
      try {
        await PRINTER.addPrinter('usb', { name: 'XP-80', forKitchen: false });
        btn.innerHTML = '✅ متصلة';
        btn.style.background = '#059669';
        setTimeout(() => btn.remove(), 2000);
      } catch(e) {
        btn.innerHTML = '❌ فشل';
        setTimeout(() => { btn.innerHTML = '🖨️ توصيل الطابعة'; btn.disabled = false; }, 2000);
      }
    };
    document.body.appendChild(btn);
  } catch(e) { console.warn('[printer]', e); }
}
if (!isCustomer && window.innerWidth > 768) autoConnectPrinter();
loadProducts();

// ── Auto-print toggle ──
(function() {
  const btn = document.getElementById('autoPrintToggle');
  const status = document.getElementById('autoPrintStatus');
  if (!btn || !status) return;
  function update() {
    const disabled = localStorage.getItem('laguna_auto_print_disabled') === 'true';
    btn.style.borderColor = disabled ? '#dc2626' : '#059669';
    btn.style.background = disabled ? '#fef2f2' : '#f0fdf4';
    status.textContent = disabled ? 'متوقفة' : 'مفعلة';
    status.style.background = disabled ? '#dc2626' : '#059669';
    status.style.color = '#fff';
  }
  update();
  btn.onclick = () => {
    const cur = localStorage.getItem('laguna_auto_print_disabled') === 'true';
    localStorage.setItem('laguna_auto_print_disabled', cur ? 'false' : 'true');
    update();
  };
})();

function printReceipt(inv) {
  TEMPLATE.getTemplate('cashier').then(cashierTpl => {
    if (!cashierTpl) cashierTpl = TEMPLATE.defaultCashierTemplate;
    const w = window.open('', '_blank', 'width=400,height=600');
    const rendered = TEMPLATE.renderCashier(inv, cashierTpl);
    w.document.write(rendered);
    w.document.close();
  }).catch(() => {
    const w = window.open('', '_blank', 'width=400,height=600');
    const rendered = TEMPLATE.renderCashier(inv);
    w.document.write(rendered);
    w.document.close();
  });
}
