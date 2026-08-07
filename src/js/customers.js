let customers = [];
let editCustId = null;
const custList = document.getElementById('custList');
const searchInput = document.getElementById('custSearch');
const modal = document.getElementById('custModal');

async function render() {
  customers = await DB.customers.all() || [];
  custList.innerHTML = '';
  const val = searchInput.value.toLowerCase();
  const filtered = customers.filter(c => c.name.toLowerCase().includes(val));

  filtered.forEach(c => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span>${escapeHtml(c.name)}</span><span>${escapeHtml(c.phone || '—')}</span>
      <span>${Number(c.totalSpent || 0).toLocaleString()} ج.م</span><span>${c.visits || 0}</span>
      <span>${c.lastVisit ? new Date(c.lastVisit).toLocaleDateString('ar-EG') : '—'}</span>
      <div class="actions">
        <button class="edit-btn" data-id="${c.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    custList.appendChild(row);
  });

  document.getElementById('custTotal').textContent = customers.length;
  document.getElementById('custTotalSpent').textContent = customers.reduce((s, c) => s + Number(c.totalSpent || 0), 0).toLocaleString() + ' ج.م';
  attachEvents();
}

function attachEvents() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => {
      const c = customers.find(x => x.id === btn.dataset.id);
      if (!c) return;
      editCustId = c.id;
      document.getElementById('custModalTitle').textContent = 'تعديل عميل';
      document.getElementById('custName').value = c.name;
      document.getElementById('custPhone').value = c.phone || '';
      modal.classList.add('show');
    };
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('هل تريد حذف هذا العميل؟')) return;
      await DB.customers.remove(btn.dataset.id);
      render();
    };
  });
}

document.getElementById('addCustBtn').onclick = () => {
  editCustId = null;
  document.getElementById('custModalTitle').textContent = 'إضافة عميل';
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  modal.classList.add('show');
};

document.getElementById('saveCust').onclick = async () => {
  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  if (!name) return alert('يرجى إدخال اسم العميل');
  if (editCustId) {
    await DB.customers.update(editCustId, { name, phone });
  } else {
    await DB.customers.add({ name, phone, totalSpent: 0, visits: 1, lastVisit: FB.nowISO() });
  }
  modal.classList.remove('show');
  render();
};

document.getElementById('cancelCust').onclick = () => modal.classList.remove('show');
document.getElementById('closeCustModal').onclick = () => modal.classList.remove('show');
searchInput.addEventListener('keyup', render);

render();
