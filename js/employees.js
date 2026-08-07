let employees = [];
let editId = null;
let renderBusy = false;
let renderPending = false;
let loadedOnce = false;

const tableBody = document.querySelector('.employees-table');
const searchInput = document.querySelector('.filter-box input');
const jobFilter = document.querySelector('.filter-box select');
const addBtn = document.querySelector('.add-btn');
const modal = document.getElementById('empModal');
const modalTitle = document.getElementById('empModalTitle');
const nameInput = document.getElementById('empName');
const jobInput = document.getElementById('empJob');
const phoneInput = document.getElementById('empPhone');
const salaryInput = document.getElementById('empSalary');
const hireDateInput = document.getElementById('empHireDate');
const statusSelect = document.getElementById('empStatus');
const pinInput = document.getElementById('empPin');
const shiftTimeInput = document.getElementById('empShiftTime');

function safeStr(v) { return v == null ? '' : String(v); }

function shiftTime12h(val) {
  const s = safeStr(val);
  if (!s || s === '—') return '—';
  const parts = s.split(':');
  if (parts.length < 2) return s;
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return s;
  const m = parts[1];
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return h.toString().padStart(2,'0') + ':' + m + ' ' + ampm;
}

function buildRow(emp) {
  const row = document.createElement('div');
  row.className = 'table-row';
  row.dataset.id = emp.id;
  const stCls = emp.status === 'active' ? 'active' : emp.status === 'vacation' ? 'vacation' : 'stopped';
  const stTxt = emp.status === 'active' ? 'يعمل' : emp.status === 'vacation' ? 'إجازة' : 'موقوف';
  const salary = !isNaN(Number(emp.salary)) && emp.salary !== '' && emp.salary != null
    ? Number(emp.salary).toLocaleString() + ' ج.م'
    : '—';
  row.innerHTML = `
    <span>${escapeHtml(safeStr(emp.name))}</span><span>${escapeHtml(safeStr(emp.job))}</span><span>${escapeHtml(safeStr(emp.phone) || '—')}</span>
    <span style="display:none">${salary}</span>
    <span>${escapeHtml(safeStr(emp.hireDate) || '—')}</span>
    <span>${shiftTime12h(emp.shiftTime)}</span>
    <span class="status ${stCls}">${stTxt}</span>
    <div class="actions">
      <button class="edit-btn" data-id="${escapeHtml(safeStr(emp.id))}"><i class="fa-solid fa-pen"></i></button>
      <button class="delete-btn" data-id="${escapeHtml(safeStr(emp.id))}"><i class="fa-solid fa-trash"></i></button>
    </div>`;
  return row;
}

async function render(force) {
  if (renderBusy) { renderPending = true; return; }
  renderBusy = true;
  try {
    let data;
    try {
      data = await DB.employees.all();
    } catch (e) {
      console.error('[employees] fetch error:', e);
      showEmptyState('حدث خطأ أثناء تحميل الموظفين. اضغط "بحث" للمحاولة مرة أخرى.');
      return;
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      if (loadedOnce && !force) return;
      employees = [];
    } else {
      employees = data;
      loadedOnce = true;
    }

    const val = searchInput ? searchInput.value.toLowerCase() : '';
    const jobVal = jobFilter ? jobFilter.value : 'كل الوظائف';
    const filtered = [];
    for (const e of employees) {
      try {
        if (e && e.name && safeStr(e.name).toLowerCase().includes(val) && (jobVal === 'كل الوظائف' || safeStr(e.job) === jobVal)) {
          filtered.push(e);
        }
      } catch (_) {}
    }

    const existing = tableBody.querySelectorAll('.table-row:not(.table-header)');
    existing.forEach(r => r.remove());

    if (filtered.length === 0) {
      showEmptyState('لا يوجد موظفون مطابقون للبحث');
    } else {
      hideEmptyState();
      for (const emp of filtered) {
        try {
          tableBody.appendChild(buildRow(emp));
        } catch (e) {
          console.error('[employees] row build error:', e);
        }
      }
    }

    const cards = document.querySelectorAll('.employee-stats .stat-card h2');
    if (cards.length >= 4) {
      cards[0].textContent = employees.length;
      cards[1].textContent = employees.filter(e => e.status === 'active').length;
      cards[2].textContent = employees.filter(e => e.status === 'vacation').length;
      cards[3].textContent = employees.filter(e => e.status === 'stopped').length;
    }
    attachActions();
  } catch (e) {
    console.error('[employees] render error:', e);
  } finally {
    renderBusy = false;
    if (renderPending) {
      renderPending = false;
      render();
    }
  }
}

function showEmptyState(msg) {
  hideEmptyState();
  const div = document.createElement('div');
  div.id = 'empEmptyState';
  div.style.cssText = 'padding:40px;text-align:center;color:#888;font-size:15px';
  div.textContent = msg;
  tableBody.appendChild(div);
}

function hideEmptyState() {
  const el = document.getElementById('empEmptyState');
  if (el) el.remove();
}

function attachActions() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => {
      const emp = employees.find(e => e.id === btn.dataset.id);
      if (!emp) return;
      editId = emp.id;
      modalTitle.textContent = 'تعديل موظف';
      nameInput.value = safeStr(emp.name);
      jobInput.value = safeStr(emp.job);
      phoneInput.value = safeStr(emp.phone);
      salaryInput.value = safeStr(emp.salary);
      hireDateInput.value = safeStr(emp.hireDate);
      statusSelect.value = safeStr(emp.status) || 'active';
      pinInput.value = '';
      shiftTimeInput.value = safeStr(emp.shiftTime);
      modal.classList.add('show');
    };
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('هل تريد حذف الموظف؟')) return;
      try {
        await DB.employees.remove(btn.dataset.id);
      } catch (e) {
        console.error('[employees] delete error:', e);
        alert('حدث خطأ أثناء الحذف');
        return;
      }
      render();
    };
  });
}

if (addBtn) {
  addBtn.onclick = () => {
    editId = null;
    modalTitle.textContent = 'إضافة موظف';
    nameInput.value = '';
    jobInput.value = '';
    phoneInput.value = '';
    hireDateInput.value = '';
    statusSelect.value = 'active';
    pinInput.value = '';
    shiftTimeInput.value = '';
    modal.classList.add('show');
  };
}

document.getElementById('saveEmp').onclick = async () => {
  const name = nameInput.value.trim();
  const job = jobInput.value.trim();
  if (!name || !job) return alert('يرجى إدخال الاسم والوظيفة');
  let pin = pinInput.value.trim() || null;
  const data = {
    name,
    job,
    phone: phoneInput.value.trim(),
    salary: salaryInput.value.trim() || '',
    hireDate: hireDateInput.value,
    status: statusSelect.value,
    shiftTime: shiftTimeInput.value || '',
    pin: null
  };
  if (pin) {
    try {
      const hashedPin = await PASSWORD_UTILS.hash(pin);
      data.pin = hashedPin;
    } catch (e) {
      console.error('[employees] failed to hash PIN:', e);
      data.pin = pin;
    }
  } else if (editId) {
    delete data.pin;
  }
  try {
    if (editId) {
      await DB.employees.update(editId, data);
    } else {
      await DB.employees.add(data);
    }
    modal.classList.remove('show');
    render();
  } catch (e) {
    console.error('[employees] save error:', e);
    alert('حدث خطأ أثناء الحفظ');
  }
};

document.getElementById('cancelEmp').onclick = () => modal.classList.remove('show');
document.getElementById('closeEmpModal').onclick = () => modal.classList.remove('show');
window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

if (searchInput) searchInput.addEventListener('keyup', render);
if (jobFilter) jobFilter.addEventListener('change', render);
const searchBtn = document.querySelector('.search-btn');
if (searchBtn) searchBtn.addEventListener('click', () => render(true));

render();
