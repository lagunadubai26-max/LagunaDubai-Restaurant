const BASE = window.location.protocol === 'file:' ? 'menu.html' : window.location.origin + '/LagunaBoat-Restaurant/menu.html';
const container = document.getElementById('qrContent');

function renderCard(t, section) {
  const card = document.createElement('div');
  card.className = 'qr-card';
  const num = t.name.replace(/\D/g, '');
  const url = BASE + '?table=' + num + (t.hasService ? '&service=1' : '');
  card.innerHTML = `
    <h2>${escapeHtml(t.name)}</h2>
    <p>امسح الكود لفتح القائمة</p>
    <div class="qr-code" id="qr-${section}-${t.id}"></div>
    <button class="qr-download" data-url="${url}" data-name="${escapeHtml(t.name)}"><i class="fa-solid fa-download"></i> تحميل</button>
    <div class="qr-link">
      <input type="text" value="${url}" readonly>
    </div>`;
  return card;
}

async function render() {
  container.innerHTML = '<div class="qr-loading"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...</div>';
  const tables = await DB.tables.all() || [];
  tables.sort((a, b) => {
    const na = parseInt(a.name.replace(/\D/g, '')) || 0;
    const nb = parseInt(b.name.replace(/\D/g, '')) || 0;
    return na - nb;
  });
  container.innerHTML = '';

  const regularTables = tables.filter(t => !t.hasService);
  const serviceTables = tables.filter(t => t.hasService);

  if (regularTables.length) {
    const section = document.createElement('div');
    section.className = 'qr-section';
    section.innerHTML = '<h2 class="qr-section-title" style="font-size:22px;color:var(--primary);margin-bottom:16px;border-bottom:2px solid var(--border);padding-bottom:10px"><i class="fa-solid fa-qrcode"></i> القائمة العادية</h2>';
    const grid = document.createElement('div');
    grid.className = 'qr-grid';
    regularTables.forEach(t => grid.appendChild(renderCard(t, 'regular')));
    section.appendChild(grid);
    container.appendChild(section);
  }

  if (serviceTables.length) {
    const section = document.createElement('div');
    section.className = 'qr-section';
    section.innerHTML = '<h2 class="qr-section-title" style="font-size:22px;color:var(--accent);margin:32px 0 16px;border-bottom:2px solid #d97706;padding-bottom:10px"><i class="fa-solid fa-star"></i> القائمة مع ضريبة الخدمة</h2>';
    const grid = document.createElement('div');
    grid.className = 'qr-grid';
    serviceTables.forEach(t => grid.appendChild(renderCard(t, 'service')));
    section.appendChild(grid);
    container.appendChild(section);
  }

  document.querySelectorAll('.qr-card').forEach(card => {
    const id = card.querySelector('.qr-code').id;
    const input = card.querySelector('.qr-link input');
    new QRCode(document.getElementById(id), {
      text: input.value,
      width: 180,
      height: 180,
      colorDark: '#1c1917',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  });

  document.querySelectorAll('.qr-download').forEach(btn => {
    btn.onclick = () => {
      const canvas = btn.closest('.qr-card').querySelector('canvas');
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = 'QR-' + btn.dataset.name + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  });

  // Download All / Print All
  const downloadAllBtn = document.getElementById('downloadAllQr');
  if (downloadAllBtn) {
    downloadAllBtn.onclick = () => {
      const modal = document.getElementById('qrPrintModal');
      const grid = document.getElementById('qrPrintGrid');
      grid.innerHTML = '';
      document.querySelectorAll('.qr-card').forEach(card => {
        const canvas = card.querySelector('canvas');
        if (!canvas) return;
        const name = card.querySelector('h2')?.textContent || '';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'text-align:center;background:#fff;border-radius:12px;padding:12px;border:1px solid #eee;break-inside:avoid';
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.cssText = 'width:180px;height:180px;display:block;margin:0 auto';
        const label = document.createElement('div');
        label.style.cssText = 'margin-top:8px;font-size:14px;font-weight:700;color:#1c1917;direction:rtl';
        label.textContent = name;
        wrap.appendChild(img);
        wrap.appendChild(label);
        grid.appendChild(wrap);
      });
      modal.style.display = 'block';
    };
  }

  const closeBtn = document.getElementById('closeQrPrint');
  if (closeBtn) closeBtn.onclick = () => { document.getElementById('qrPrintModal').style.display = 'none'; };

  const printBtn = document.getElementById('printAllQr');
  if (printBtn) printBtn.onclick = () => { window.print(); };
}

render();
