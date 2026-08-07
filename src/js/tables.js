let tables = [];
let editTableId = null;
const grid = document.getElementById('tablesGrid');
const modal = document.getElementById('tableModal');
const modalTitle = document.getElementById('modalTitle');
const tableName = document.getElementById('tableName');
const tableCapacity = document.getElementById('tableCapacity');
const tableService = document.getElementById('tableService');
const saveBtn = document.getElementById('saveTable');

async function render() {
  tables = (await DB.tables.all() || []).sort((a, b) => {
    const na = parseInt(a.name.replace(/\D/g, '')) || 0;
    const nb = parseInt(b.name.replace(/\D/g, '')) || 0;
    return na - nb;
  });
  grid.innerHTML = '';
  const statusMap = { available: 'متاحة', occupied: 'مشغولة', reserved: 'محجوزة' };
  const colorMap = { available: '#15B66D', occupied: '#E74C3C', reserved: '#F4A825' };

  tables.forEach(t => {
    const card = document.createElement('div');
    card.className = 'table-card';
    card.innerHTML = `
      <div class="table-status" style="background:${colorMap[t.status]}"></div>
      <h3>${escapeHtml(t.name)}</h3>
      <p><i class="fa-solid fa-chair"></i> ${validateNumber(t.capacity)} كراسي ${t.hasService ? '<span style="color:#d97706;font-size:12px;margin-right:8px"><i class="fa-solid fa-star"></i> ضيافة</span>' : ''}</p>
      <span class="badge" style="background:${colorMap[t.status]}">${statusMap[t.status]}</span>
      <div class="table-actions">
        <button class="edit-btn" data-id="${t.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="qr-btn" data-id="${t.id}" data-num="${t.name.replace(/\D/g, '')}" title="عرض QR كود"><i class="fa-solid fa-qrcode"></i></button>
        <select class="status-select" data-id="${t.id}">
          <option value="available" ${t.status === 'available' ? 'selected' : ''}>متاحة</option>
          <option value="occupied" ${t.status === 'occupied' ? 'selected' : ''}>مشغولة</option>
          <option value="reserved" ${t.status === 'reserved' ? 'selected' : ''}>محجوزة</option>
        </select>
        <button class="delete-btn" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    grid.appendChild(card);
  });

  document.getElementById('totalTables').textContent = tables.length;
  document.getElementById('availableTables').textContent = tables.filter(t => t.status === 'available').length;
  document.getElementById('occupiedTables').textContent = tables.filter(t => t.status === 'occupied').length;
  document.getElementById('reservedTables').textContent = tables.filter(t => t.status === 'reserved').length;
  attachEvents();
}

function attachEvents() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => {
      const t = tables.find(x => x.id === btn.dataset.id);
      if (!t) return;
      editTableId = t.id;
      modalTitle.textContent = 'تعديل طاولة';
      tableName.value = t.name;
      tableCapacity.value = t.capacity;
      tableService.checked = t.hasService || false;
      modal.classList.add('show');
    };
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('هل تريد حذف هذه الطاولة؟')) return;
      await DB.tables.remove(btn.dataset.id);
      render();
    };
  });
  document.querySelectorAll('.status-select').forEach(sel => {
    sel.onchange = async function () {
      await DB.tables.update(this.dataset.id, { status: this.value });
      render();
    };
  });
  document.querySelectorAll('.qr-btn').forEach(btn => {
    btn.onclick = () => {
      window.open('qr.html', '_blank');
    };
  });
}

document.getElementById('addTableBtn').onclick = () => {
  editTableId = null;
  modalTitle.textContent = 'إضافة طاولة';
  tableName.value = '';
  tableCapacity.value = '';
  modal.classList.add('show');
};

saveBtn.onclick = async () => {
  const name = tableName.value.trim();
  const capacity = parseInt(tableCapacity.value);
  if (!name || !capacity) return alert('يرجى إدخال اسم الطاولة وعدد الكراسي');
  const hasService = tableService.checked;
  if (editTableId) {
    await DB.tables.update(editTableId, { name, capacity, hasService });
  } else {
    const tnum = name.replace(/\D/g, '').trim() || Date.now(); await DB.tables.add({ id: 't' + tnum, name, capacity, status: 'available', currentOrder: null, hasService });
  }
  modal.classList.remove('show');
  render();
};

document.getElementById('cancelTable').onclick = () => modal.classList.remove('show');
document.getElementById('closeTableModal').onclick = () => modal.classList.remove('show');
window.onclick = (e) => { if (e.target === modal) modal.classList.remove('show'); };

render();
