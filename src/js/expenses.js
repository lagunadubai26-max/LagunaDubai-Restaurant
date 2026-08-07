let expenses = [];
let allExpenses = [];
const expList = document.getElementById('expList');
const expMonth = document.getElementById('expMonth');
const _expUser = (() => { try { return JSON.parse(sessionStorage.getItem('laguna_user')); } catch(e) { return {}; } })();

const _expMonthNow = () => { const d = FB.clockNow(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

expMonth.value = _expMonthNow();

function getMonthRange(value) {
  if (!value) { value = _expMonthNow(); }
  const [year, month] = value.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end, year, month };
}

function filterByDate(items, range) {
  if (!range || !range.start) return items;
  return items.filter(item => {
    if (!item.date) return false;
    const d = new Date(item.date);
    return d >= range.start && d <= range.end;
  });
}

async function render() {
  allExpenses = await DB.expenses.all() || [];
  const range = getMonthRange(expMonth.value);
  expenses = filterByDate(allExpenses, range);

  expList.innerHTML = '';
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const monthTotal = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  document.getElementById('expTotal').textContent = total.toLocaleString() + ' ج.م';
  document.getElementById('expToday').textContent = expenses.length;
  document.getElementById('expCount').textContent = monthTotal.toLocaleString() + ' ج.م';

  expenses.forEach(e => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <span>${escapeHtml(e.description)}</span><span>${escapeHtml(e.category)}</span>
      <span>${Number(e.amount).toLocaleString()} ج.م</span>
      <span>${new Date(e.date).toLocaleDateString('ar-EG')}</span>
      <div class="actions"><button class="delete-btn" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button></div>`;
    expList.appendChild(row);
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('هل تريد حذف هذا المصروف؟')) return;
      await DB.expenses.remove(btn.dataset.id);
      render();
    };
  });
}

function csvEsc(val) {
  const s = String(val || '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
}

document.getElementById('exportExpBtn').onclick = () => {
  let csv = 'الوصف,القسم,المبلغ,التاريخ\n';
  expenses.forEach(e => {
    csv += [csvEsc(e.description), csvEsc(e.category), csvEsc(e.amount), csvEsc(e.date)].join(',') + '\n';
  });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'laguna-expenses-' + expMonth.value + '.csv';
  link.click();
};

document.getElementById('addExpBtn').onclick = async () => {
    const description = document.getElementById('expDesc').value.trim();
    const amount = Number(document.getElementById('expAmount').value);
    const category = document.getElementById('expCategory').value;
    if (!description || !amount) return alert('يرجى إدخال الوصف والمبلغ');
    await DB.expenses.add({ description, amount, category, date: FB.nowISO() });
    document.getElementById('expDesc').value = '';
    document.getElementById('expAmount').value = '';
    render();
  };

expMonth.addEventListener('change', render);
render();
