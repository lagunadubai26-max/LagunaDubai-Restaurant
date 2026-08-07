function shiftTime12h(val) {
  if (!val) return '—';
  const parts = val.split(':');
  if (parts.length < 2) return val;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return h.toString().padStart(2,'0') + ':' + m + ' ' + ampm;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  let h = d.getHours();
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return h.toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ' ' + ampm;
}

function nowTime12h() {
  const now = FB.clockNow();
  let h = now.getHours();
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return h.toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ' ' + ampm;
}

function parseTime12h(str) {
  const match = str.trim().match(/^(\d{1,2}):(\d{2})\s*(ص|م)?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3];
  if (isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (ampm === 'م' && h < 12) h += 12;
  if (ampm === 'ص' && h === 12) h = 0;
  return { h, m };
}

const table = document.querySelector(".attendance-table");
const searchInput = document.querySelector('.filter-box input');
const dateFilter = document.querySelector('.filter-box input[type="date"]');

const detailsModal = document.getElementById("employeeDetailsModal");
const closeDetailsModal = document.getElementById("closeDetailsModal");
const closeDetailsBtn = document.getElementById("closeDetailsBtn");

// ── Time Picker Modal ──
const attTimeModal = document.getElementById('attTimeModal');
const attTimeHour = document.getElementById('attTimeHour');
const attTimeMinute = document.getElementById('attTimeMinute');
let attTimeMode = 'in';
let attTimeEmp = null;
let attTimeRecordId = null;

(function populateTimeSelects() {
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = i < 10 ? '0' + i : String(i);
    attTimeHour.appendChild(opt);
  }
  for (let i = 0; i < 60; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = i < 10 ? '0' + i : String(i);
    attTimeMinute.appendChild(opt);
  }
})();

function attSetAmpm(ampm) {
  const am = document.getElementById('attTimeAm');
  const pm = document.getElementById('attTimePm');
  if (ampm === 'ص') {
    am.style.background = 'var(--accent)'; am.style.color = '#fff'; am.style.borderColor = 'var(--accent)';
    pm.style.background = '#fff'; pm.style.color = 'var(--muted)'; pm.style.borderColor = '#e7e5e4';
  } else {
    pm.style.background = 'var(--accent)'; pm.style.color = '#fff'; pm.style.borderColor = 'var(--accent)';
    am.style.background = '#fff'; am.style.color = 'var(--muted)'; am.style.borderColor = '#e7e5e4';
  }
}

function attTime12hToHm(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':');
  if (parts.length < 2) return null;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return { h, m, ampm };
}

function openTimeModal(mode, emp, recordId) {
  attTimeMode = mode;
  attTimeEmp = emp;
  attTimeRecordId = recordId;
  const title = document.getElementById('attTimeTitle');
  title.innerHTML = mode === 'in'
    ? '<i class="fa-solid fa-right-to-bracket" style="color:var(--accent)"></i> تسجيل الحضور'
    : '<i class="fa-solid fa-right-from-bracket" style="color:var(--accent)"></i> تسجيل الانصراف';
  document.getElementById('attTimeEmpName').textContent = emp ? emp.name : '';
  document.getElementById('attTimeEmpJob').textContent = emp ? (emp.job || '') : '';

  let hm = attTime12hToHm(emp && emp.shiftTime);
  if (!hm) {
    const now = FB.clockNow();
    const h24 = now.getHours();
    hm = { h: h24 % 12 || 12, m: now.getMinutes(), ampm: h24 >= 12 ? 'م' : 'ص' };
  }
  attTimeHour.value = String(hm.h);
  attTimeMinute.value = String(hm.m);
  attSetAmpm(hm.ampm);
  attTimeModal.classList.add('show');
}

function closeTimeModal() { attTimeModal.classList.remove('show'); }

document.getElementById('attTimeClose').onclick = closeTimeModal;
document.getElementById('attTimeCancel').onclick = closeTimeModal;
window.addEventListener('click', e => { if (e.target === attTimeModal) closeTimeModal(); });

document.getElementById('attTimeAm').onclick = () => attSetAmpm('ص');
document.getElementById('attTimePm').onclick = () => attSetAmpm('م');

document.getElementById('attTimeNow').onclick = () => {
  const now = FB.clockNow();
  const h24 = now.getHours();
  attTimeHour.value = String(h24 % 12 || 12);
  attTimeMinute.value = String(now.getMinutes());
  attSetAmpm(h24 >= 12 ? 'م' : 'ص');
};

document.getElementById('attTimeConfirm').onclick = async () => {
  const h12 = parseInt(attTimeHour.value, 10) || 12;
  const m = parseInt(attTimeMinute.value, 10) || 0;
  const amBtn = document.getElementById('attTimeAm');
  const isAm = amBtn.style.background === 'var(--accent)';
  let h24 = h12 % 12;
  if (!isAm) h24 += 12;
  const d = FB.clockNow();
  d.setHours(h24, m, 0, 0);
  const btn = document.getElementById('attTimeConfirm');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري...';
  try {
    if (attTimeMode === 'in') {
      await DB.attendance.checkIn(attTimeEmp.id, attTimeEmp.name, attTimeEmp.job || '', d.toISOString(), attTimeEmp.shiftTime);
    } else {
      await DB.attendance.checkOut(attTimeRecordId, d.toISOString());
    }
    closeTimeModal();
    render();
  } catch (e) {
    console.error('[att-time]', e);
    alert('❌ حدث خطأ أثناء التسجيل');
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> تأكيد';
};

let cachedEmployees = [];
let cachedRecords = [];

async function render() {
  const existing = table.querySelectorAll(".table-row:not(.table-header)");
  existing.forEach(r => r.remove());

  cachedEmployees = await DB.employees.all() || [];
  cachedRecords = await DB.attendance.today() || [];

  const searchVal = searchInput ? searchInput.value.toLowerCase() : '';

  let filtered = cachedEmployees;
  if (searchVal) {
    filtered = filtered.filter(e => (e.name && e.name.toLowerCase().includes(searchVal)) || (e.job && e.job.toLowerCase().includes(searchVal)));
  }

  filtered.forEach(emp => {
    const record = cachedRecords.find(r => r.employeeId === emp.id);
    const row = document.createElement("div");
    row.className = "table-row";
    row.dataset.id = emp.id;
    row.dataset.recordId = record ? record.id : '';

    const stCls = record ? (record.status === 'present' ? 'present' : record.status === 'late' ? 'late' : 'absent') : 'absent';
    const stTxt = record ? (record.status === 'present' ? 'حاضر' : record.status === 'late' ? 'متأخر' : 'غائب') : 'غائب';
    const checkInTime = record && record.checkIn ? formatTime(record.checkIn) : '—';
    const checkOutTime = record && record.checkOut ? formatTime(record.checkOut) : '—';
    const expectedTime = shiftTime12h(emp.shiftTime);

    row.innerHTML = `
      <span class="emp-name-click">${escapeHtml(emp.name)}</span>
      <span>${escapeHtml(emp.job || '—')}</span>
      <span style="font-size:12px;color:var(--muted)">${expectedTime}</span>
      <span>${escapeHtml(checkInTime)}</span>
      <span>${escapeHtml(checkOutTime)}</span>
      <span class="status ${stCls}">${stTxt}</span>
      <div class="actions">
        <button class="check-btn" title="تسجيل حضور" ${record ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}><i class="fa-solid fa-right-to-bracket"></i></button>
        <button class="leave-btn" title="تسجيل انصراف" ${!record || record.checkOut ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}><i class="fa-solid fa-right-from-bracket"></i></button>
        <button class="delete-btn" title="حذف تسجيل اليوم" ${!record ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}><i class="fa-solid fa-trash"></i></button>
      </div>`;
    table.appendChild(row);
  });

  updateStats(cachedEmployees, cachedRecords);
  attachEvents(cachedEmployees, cachedRecords);
}

function updateStats(employees, records) {
  const e = document.getElementById("employeesCount");
  const p = document.getElementById("presentCount");
  const l = document.getElementById("lateCount");
  const a = document.getElementById("absentCount");
  if (e) e.textContent = employees.length;
  if (p) p.textContent = records.filter(x => x.status === 'present').length;
  if (l) l.textContent = records.filter(x => x.status === 'late').length;
  if (a) a.textContent = employees.length - records.filter(x => x.status === 'present' || x.status === 'late').length;
}

function attachEvents(employees, records) {
  document.querySelectorAll(".attendance-table .table-row:not(.table-header)").forEach(row => {
    const empId = row.dataset.id;
    const recordId = row.dataset.recordId;
    const emp = employees.find(x => x.id === empId);

    row.querySelector(".emp-name-click").onclick = () => { showEmployeeDetails(emp); };

    const checkBtn = row.querySelector(".check-btn");
    if (checkBtn && !checkBtn.disabled) {
      checkBtn.onclick = () => { openTimeModal('in', emp); };
    }

    const leaveBtn = row.querySelector(".leave-btn");
    if (leaveBtn && !leaveBtn.disabled) {
      leaveBtn.onclick = () => { openTimeModal('out', emp, recordId); };
    }

    const delBtn = row.querySelector(".delete-btn");
    if (delBtn && !delBtn.disabled) {
      delBtn.onclick = async () => {
        if (!confirm("هل تريد حذف تسجيل حضور الموظف لهذا اليوم؟")) return;
        await DB.attendance.remove(recordId);
        render();
      };
    }
  });
}

async function showEmployeeDetails(emp) {
  if (!emp) return;
  document.getElementById("detName").textContent = emp.name;
  document.getElementById("detJob").textContent = emp.job || '—';
  document.getElementById("detPhone").textContent = emp.phone || '—';
  document.getElementById("detSalary").textContent = emp.salary ? (emp.salary + ' ج.م') : '—';
  document.getElementById("detHireDate").textContent = emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('ar-EG') : '—';
  document.getElementById("detStatus").textContent = emp.status === 'active' ? 'نشط' : 'غير نشط';
  document.getElementById("detPin").textContent = emp.pin || '—';

  const historyList = document.getElementById("detHistoryList");
  historyList.innerHTML = '<tr><td colspan="4" style="padding:20px;color:#888"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل السجل...</td></tr>';

  try {
    const allAtt = await DB.attendance.all() || [];
    const empHistory = allAtt.filter(a => a.employeeId === emp.id);
    empHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    historyList.innerHTML = '';
    if (empHistory.length === 0) {
      historyList.innerHTML = '<tr><td colspan="4" style="padding:20px;color:#888">لا يوجد سجلات حضور سابقة لهذا الموظف</td></tr>';
    } else {
      empHistory.forEach(h => {
        const dateStr = h.date ? new Date(h.date).toLocaleDateString('ar-EG') : '—';
        const stCls = h.status === 'present' ? 'present' : h.status === 'late' ? 'late' : 'absent';
        const stTxt = h.status === 'present' ? 'حاضر' : h.status === 'late' ? 'متأخر' : 'غائب';
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding:10px;border-bottom:1px solid var(--border)">${dateStr}</td>
          <td style="padding:10px;border-bottom:1px solid var(--border)">${escapeHtml(formatTime(h.checkIn))}</td>
          <td style="padding:10px;border-bottom:1px solid var(--border)">${escapeHtml(formatTime(h.checkOut))}</td>
          <td style="padding:10px;border-bottom:1px solid var(--border)"><span class="status ${stCls}" style="padding:2px 8px;font-size:11px">${stTxt}</span></td>`;
        historyList.appendChild(tr);
      });
    }
  } catch (e) {
    console.error('Error fetching history:', e);
    historyList.innerHTML = '<tr><td colspan="4" style="padding:20px;color:#dc2626">حدث خطأ أثناء تحميل السجل</td></tr>';
  }

  detailsModal.classList.add("show");
}

function closeDetails() { detailsModal.classList.remove("show"); }

if (closeDetailsModal) closeDetailsModal.addEventListener("click", closeDetails);
if (closeDetailsBtn) closeDetailsBtn.addEventListener("click", closeDetails);
window.addEventListener("click", function (e) {
  if (e.target === detailsModal) closeDetails();
});

if (searchInput) searchInput.addEventListener('keyup', render);

render();
