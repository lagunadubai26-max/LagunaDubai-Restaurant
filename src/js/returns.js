let returns = [];
const table = document.querySelector('.returns-table');
const searchInput = document.querySelector('.filter-box input');
const statusSelect = document.querySelector('.filter-box select');
const filterBtn = document.querySelector('.search-btn');
const _retUser = (() => { try { return JSON.parse(sessionStorage.getItem('laguna_user')); } catch(e) { return {}; } })();

async function render() {
  returns = await DB.returns.all() || [];
  const existing = table.querySelectorAll('.table-row');
  existing.forEach(r => r.remove());

  const val = searchInput ? searchInput.value.toLowerCase() : '';
  const filterStatus = statusSelect ? statusSelect.value : 'كل الحالات';
  const filtered = returns.filter(r => {
    const matchSearch = r.product.toLowerCase().includes(val) || r.invoice.toLowerCase().includes(val);
    const matchStatus = filterStatus === 'كل الحالات' || (filterStatus === 'تمت المراجعة' && r.status === 'success') || (filterStatus === 'قيد المراجعة' && r.status === 'pending');
    return matchSearch && matchStatus;
  });

  filtered.forEach(item => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.dataset.id = item.id;
    const stCls = item.status === 'success' ? 'success' : 'pending';
    const stTxt = item.status === 'success' ? 'تمت المراجعة' : 'قيد المراجعة';
    const dateStr = item.date ? new Date(item.date).toLocaleDateString('ar-EG') : item.date || '—';
    row.innerHTML = `
      <span>#${item.id}</span><span>${escapeHtml(item.invoice)}</span><span>${escapeHtml(item.product)}</span>
      <span>${item.qty}</span><span>${item.amount} ج.م</span><span>${dateStr}</span>
      <span class="status ${stCls}">${stTxt}</span>
      <div class="actions">
        <button class="view-btn" data-id="${item.id}"><i class="fa-solid fa-eye"></i></button>
        <button class="edit-btn" data-id="${item.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    table.appendChild(row);
  });

  const cards = document.querySelectorAll('.returns-stats .stat-card h2');
  if (cards.length >= 4) {
    cards[0].textContent = returns.length;
    cards[1].textContent = returns.reduce((s, r) => s + Number(r.amount || 0), 0).toLocaleString() + ' ج.م';
    cards[2].textContent = returns.filter(r => r.status === 'success').length;
    cards[3].textContent = returns.filter(r => r.status === 'pending').length;
  }
  attachEvents();
}

function attachEvents() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = () => {
      const item = returns.find(r => r.id === btn.dataset.id);
      if (item) alert(`رقم المرتجع: ${item.id}\nرقم الفاتورة: ${item.invoice}\nالمنتج: ${item.product}\nالكمية: ${item.qty}\nالقيمة: ${item.amount} ج.م\nالحالة: ${item.status === 'success' ? 'تمت المراجعة' : 'قيد المراجعة'}\nالتاريخ: ${item.date}`);
    };
  });
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = async () => {
      const item = returns.find(r => r.id === btn.dataset.id);
      if (!item) return;
      const product = prompt('اسم المنتج', item.product);
      if (!product) return;
      const qty = prompt('الكمية', item.qty);
      if (!qty) return;
      const amount = prompt('قيمة المرتجع', item.amount);
      if (!amount) return;
      const status = prompt('الحالة (success/pending)', item.status);
      if (!status) return;
      await DB.returns.update(item.id, { product, qty: Number(qty), amount: Number(amount), status });
      render();
    };
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('هل تريد حذف المرتجع؟')) return;
      await DB.returns.remove(btn.dataset.id);
      render();
    };
  });
}


if (searchInput) searchInput.addEventListener('keyup', render);
if (statusSelect) statusSelect.addEventListener('change', render);

render();
