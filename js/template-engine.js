window.TEMPLATE = (() => {
  const PLACEHOLDERS = {
    cashier: [
      'logo', 'title', 'id', 'date', 'customer', 'table',
      'items', 'serviceAmount', 'taxAmount', 'total', 'paid',
      'change', 'remaining', 'paymentMethod', 'status', 'footer'
    ],
    kitchen: [
      'logo', 'title', 'id', 'date', 'table', 'items', 'footer'
    ]
  };

  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildItemsHtml(inv, type) {
    if (!inv.items || !inv.items.length) return '';
    if (type === 'kitchen') {
      return inv.items.map(item => {
        const safeName = escape(item.name);
        const milkTxt = item.hasMilk ? ' +حليب' : '';
        const safeNote = escape(item.note || '');
        const noteTxt = safeNote ? '<br><small>' + safeNote + '</small>' : '';
        return '<div class="kitchen-item">'
          + '<span class="item-name">' + safeName + milkTxt + noteTxt + '</span>'
          + '<span class="item-qty">×' + item.qty + '</span>'
          + '</div>';
      }).join('');
    }
    return inv.items.map(item => {
      const safeName = escape(item.name);
      const milkTxt = item.hasMilk ? ' +حليب' : '';
      const safeNote = escape(item.note || '');
      const noteTxt = safeNote ? '<br><small>' + safeNote + '</small>' : '';
      return '<tr>'
        + '<td class="item-name">' + safeName + milkTxt + noteTxt + '</td>'
        + '<td style="text-align:center;">' + item.qty + '</td>'
        + '<td style="text-align:center;">' + item.price + ' ج.م</td>'
        + '</tr>';
    }).join('');
  }

  function buildItemsPlain(inv) {
    if (!inv.items || !inv.items.length) return '';
    return inv.items.map(item => {
      const safeName = escapeEscPos(item.name);
      const safeNote = escapeEscPos(item.note || '');
      const milkTxt = item.hasMilk ? ' +حليب' : '';
      const noteTxt = safeNote ? ' (' + safeNote + ')' : '';
      return '\n\u2022 ' + safeName + milkTxt + noteTxt + ' x' + item.qty + ' = ' + (item.qty * item.price) + ' ج.م';
    }).join('');
  }

  function defaultCashierTemplate() {
    return '<div style="width:100%;max-width:320px;margin:0 auto;font-family:\'Cairo\',sans-serif;direction:rtl;background:#fff;padding:12px 10px;color:#222;">\n'
      + '  <div style="text-align:center;margin-bottom:6px;">\n'
      + '    {logo}\n'
      + '    <div style="font-size:24px;font-weight:900;color:#1a1a2e;margin-top:4px;">لاجونا دبي</div>\n'
      + '    <div style="font-size:10px;color:#888;margin-top:2px;">مطعم | LagunaDubai</div>\n'
      + '  </div>\n'
      + '  <div style="text-align:center;font-size:12px;color:#b8860b;margin:4px 0 2px;">❋ ❋ ❋ ❋ ❋</div>\n'
      + '  <div style="text-align:center;font-size:15px;font-weight:700;color:#1a1a2e;margin:2px 0;">فاتورة ضريبية</div>\n'
      + '  <div style="border-top:2px solid #1a1a2e;margin:6px 0;"></div>\n'
      + '  <table style="width:100%;font-size:11px;line-height:1.9;margin:4px 0;">\n'
      + '    <tr><td style="color:#888;">رقم الفاتورة</td><td style="text-align:left;font-weight:700;direction:ltr">#{id}</td></tr>\n'
      + '    <tr><td style="color:#888;">التاريخ</td><td style="text-align:left;">{date}</td></tr>\n'
      + '    <tr><td style="color:#888;">العميل</td><td style="text-align:left;">{customer}</td></tr>\n'
      + '    <tr><td style="color:#888;">طاولة</td><td style="text-align:left;">{table}</td></tr>\n'
      + '  </table>\n'
      + '  <div style="border-top:1px dashed #bbb;margin:4px 0;"></div>\n'
      + '  <table style="width:100%;font-size:11px;border-collapse:collapse;margin:4px 0;">\n'
      + '    <tr style="border-bottom:2px solid #1a1a2e;font-weight:700;font-size:11px;">\n'
      + '      <td style="padding:4px 2px;">الصنف</td>\n'
      + '      <td style="width:30px;text-align:center;">الكمية</td>\n'
      + '      <td style="width:50px;text-align:center;">السعر</td>\n'
      + '    </tr>\n'
      + '    {items}\n'
      + '  </table>\n'
      + '  <div style="border-top:1px dashed #bbb;margin:4px 0;"></div>\n'
      + '  <table style="width:100%;font-size:11px;line-height:1.8;">\n'
      + '    {taxAmount}\n'
      + '    {serviceAmount}\n'
      + '  </table>\n'
      + '  <div style="background:#1a1a2e;color:#fff;border-radius:8px;padding:10px 14px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;">\n'
      + '    <span style="font-size:14px;font-weight:700;">الإجمالي</span>\n'
      + '    <span style="font-size:22px;font-weight:900;">{total}</span>\n'
      + '  </div>\n'
      + '  <table style="width:100%;font-size:11px;line-height:1.8;">\n'
      + '    <tr><td style="color:#888;">طريقة الدفع</td><td style="text-align:left;font-weight:700;">{paymentMethod}</td></tr>\n'
      + '    <tr><td style="color:#888;">المدفوع</td><td style="text-align:left;">{paid}</td></tr>\n'
      + '    <tr><td style="color:#888;">المتبقي</td><td style="text-align:left;color:#c0392b;font-weight:600;">{remaining}</td></tr>\n'
      + '  </table>\n'
      + '  <div style="border-top:2px solid #1a1a2e;margin:6px 0 4px;"></div>\n'
      + '  <div style="text-align:center;font-size:12px;font-weight:700;color:#1a1a2e;">شكرًا لزيارتكم</div>\n'
      + '  <div style="text-align:center;font-size:10px;color:#999;margin-top:2px;">{footer}</div>\n'
      + '  <script>window.print();window.close();<\/script>\n'
      + '</div>';
  }

  function defaultKitchenTemplate() {
    return '<div style="width:300px;margin:0 auto;font-family:\'Cairo\',sans-serif;direction:rtl;background:#fff;padding:12px 8px;color:#222;">\n'
      + '  <div style="text-align:center;margin-bottom:6px;">\n'
      + '    {logo}\n'
      + '    <div style="font-size:20px;font-weight:900;color:#1a1a2e;">لاجونا دبي</div>\n'
      + '    <div style="font-size:10px;color:#888;">مطعم</div>\n'
      + '  </div>\n'
      + '  <div style="border-top:3px solid #c0392b;margin:6px 0;"></div>\n'
      + '  <div style="text-align:center;font-size:18px;font-weight:900;color:#c0392b;margin:4px 0;">أمر مطبخ</div>\n'
      + '  <div style="border-top:2px dashed #c0392b;margin:6px 0;"></div>\n'
      + '  <table style="width:100%;font-size:13px;line-height:2;font-weight:700;">\n'
      + '    <tr><td style="color:#888;width:50px;">طاولة</td><td style="text-align:left;font-size:18px;color:#c0392b;">{table}</td></tr>\n'
      + '    <tr><td style="color:#888;">رقم الطلب</td><td style="text-align:left;direction:ltr">#{id}</td></tr>\n'
      + '    <tr><td style="color:#888;">الوقت</td><td style="text-align:left;font-weight:400;font-size:12px;">{date}</td></tr>\n'
      + '  </table>\n'
      + '  <div style="border-top:2px dashed #c0392b;margin:8px 0;"></div>\n'
      + '  {items}\n'
      + '  <div style="display:flex;align-items:center;padding:8px 4px;margin-bottom:4px;background:#f9f9f9;border-radius:6px;border-right:4px solid #c0392b;">\n'
      + '    <span style="font-size:20px;font-weight:900;min-width:40px;text-align:center;color:#c0392b;">{qty}</span>\n'
      + '    <span style="font-size:16px;font-weight:700;margin-right:8px;">{name}</span>\n'
      + '  </div>\n'
      + '  {/items}\n'
      + '  <div style="border-top:3px solid #c0392b;margin:12px 0 4px;"></div>\n'
      + '  <div style="text-align:center;font-size:10px;color:#888;">{footer}</div>\n'
      + '  <script>window.print();window.close();<\/script>\n'
      + '</div>';
  }

  function replaceVars(text, vars) {
    let r = text;
    for (const [key, val] of Object.entries(vars)) {
      r = r.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), val);
      r = r.replace(new RegExp('\\{' + key + '\\}', 'g'), val);
    }
    return r;
  }

  function renderItemsBlock(tpl, inv) {
    const start = tpl.indexOf('{items}');
    const end = tpl.indexOf('{/items}');
    if (start === -1 || end === -1) return tpl;

    const before = tpl.slice(0, start);
    const itemTpl = tpl.slice(start + 7, end);
    const after = tpl.slice(end + 8);

    let itemsHtml = '';
    if (inv.items) {
      inv.items.forEach(item => {
        const milkTxt = item.hasMilk ? ' +حليب' : '';
        const hasMilkHtml = item.hasMilk ? ' +حليب' : '';
        const safeNote = escape(item.note || '');
        let line = itemTpl;
        const itemVars = {
          name: escape(item.name) + milkTxt,
          qty: item.qty,
          price: item.price + ' ج.م',
          total: (item.qty * item.price) + ' ج.م',
          note: safeNote,
          hasMilk: item.hasMilk ? 'true' : 'false'
        };
        line = replaceVars(line, itemVars);
        itemsHtml += line;
      });
    }

    return before + itemsHtml + renderItemsBlock(after, inv);
  }

  function renderTemplate(tpl, inv, type) {
    const paid = inv.paid != null ? Number(inv.paid) : Number(inv.total || 0);
    const total = Number(inv.total || 0);
    const remaining = inv.remaining != null ? Number(inv.remaining) : Math.max(0, total - paid);
    const change = inv.change || 0;
    const subtotal = total - (inv.serviceAmount || 0) - (inv.taxAmount || 0);
    const dateStr = inv.date ? new Date(inv.date).toLocaleString('ar-EG') : FB.clockNow().toLocaleString('ar-EG');
    const status = remaining > 0 ? 'معلق' : 'مدفوع';
    const baseUrl = window.location.origin + '/LagunaDubai-Restaurant/';
    const logoHtml = '<img src="' + baseUrl + 'images/logo.png" id="logoImg" style="height:65px;margin-bottom:4px;background:#222;padding:6px;border-radius:8px" alt="LagunaDubai">';

    const commonVars = {
      logo: logoHtml,
      id: escape(inv.id || ''),
      date: dateStr,
      customer: escape(inv.customer || ''),
      table: escape(inv.table || ''),
      items: '',
      serviceAmount: inv.serviceAmount > 0 ? '<tr><td style="color:#888;">خدمة الضيافة</td><td style="text-align:left;">' + Number(inv.serviceAmount).toLocaleString() + ' ج.م</td></tr>' : '',
      taxAmount: inv.taxAmount > 0 ? '<tr><td style="color:#888;">ضريبة القيمة المضافة</td><td style="text-align:left;">' + Number(inv.taxAmount).toLocaleString() + ' ج.م</td></tr>' : '',
      subtotal: Number(subtotal).toLocaleString() + ' ج.م',
      total: Number(total).toLocaleString() + ' ج.م',
      paid: Number(paid).toLocaleString() + ' ج.م',
      change: change > 0 ? Number(change).toLocaleString() + ' ج.م' : '0 ج.م',
      remaining: remaining > 0 ? Number(remaining).toLocaleString() + ' ج.م' : '0 ج.م',
      paymentMethod: inv.paymentMethod || 'كاش',
      status: status,
      footer: 'شكراً لزيارتكم ☕'
    };

    if (type === 'cashier') {
      commonVars.title = '** فاتورة كاشير **';
    } else {
      commonVars.title = '** طلب مطبخ **';
      commonVars.table = escape(inv.table || '');
    }

    // First render the items block
    let result = renderItemsBlock(tpl, inv);
    // Then replace all remaining variables
    result = replaceVars(result, commonVars);
    // Clean up any unreplaced placeholders
    result = result.replace(/\{[^}]+\}/g, '');
    result = result.replace(/\{\{[^}]+\}\}/g, '');
    // Wrap in full HTML if not already (for proper @page CSS in thermal printing)
    if (!result.match(/<html/i)) {
      result = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">'
        + '<style>@media print{@page{margin:0;size:80mm 400mm}}body{margin:0;padding:0;font-family:\'Cairo\',sans-serif}</style>'
        + '</head><body>' + result + '</body></html>';
    }
    return result;
  }

  function renderCashier(inv, templateStr) {
    const tpl = templateStr || defaultCashierTemplate();
    return renderTemplate(tpl, inv, 'cashier');
  }

  function renderKitchen(inv, templateStr) {
    const tpl = templateStr || defaultKitchenTemplate();
    return renderTemplate(tpl, inv, 'kitchen');
  }

  // ===== ESCPOS Template =====
  const ESCPOS_CMD = {
    init: [0x1B, 0x40],
    center: [0x1B, 0x61, 0x01],
    left: [0x1B, 0x61, 0x00],
    boldOn: [0x1B, 0x45, 0x01],
    boldOff: [0x1B, 0x45, 0x00],
    sizeNormal: [0x1B, 0x21, 0x00],
    sizeDoubleH: [0x1B, 0x21, 0x10],
    sizeDoubleW: [0x1B, 0x21, 0x20],
    sizeDouble: [0x1B, 0x21, 0x30],
    cut: [0x1D, 0x56, 0x00],
    drawer: [0x1B, 0x70, 0x00, 0x19, 0xFA],
    newline: [0x0A]
  };

  function escposBytes(...bytes) { return new Uint8Array(bytes.flat()); }

  function concatUint8(arrays) {
    let len = 0;
    arrays.forEach(a => len += a.length);
    const r = new Uint8Array(len);
    let off = 0;
    arrays.forEach(a => { r.set(a, off); off += a.length; });
    return r;
  }

  function textEncoder(s) {
    return new TextEncoder().encode(s + '\n');
  }

  function defaultEscposCashier() {
    return '{init}{center}{size=double}لاجونا دبي\n{size=normal}مطعم\n{bold}فاتورة ضريبية\n{bold=off}\n❋ ❋ ❋ ❋ ❋\n{left}\n#{id}\n{date}\n{customer}{table}\n---\n{items:name:qty:price}\n---\n{taxAmount}\n{serviceAmount}\n{bold}{total}\n{bold=off}{paid}\n{change}\n{remaining}\n{paymentMethod}\n---\nشكراً لزيارتكم\n{footer}\n{cut}';
  }

  function defaultEscposKitchen() {
    return '{init}{center}{size=double}لاجونا دبي\n{size=normal}مطعم\n\n{bold}*** أمر مطبخ ***\n{bold=off}{left}\n{date}\n#{id}\n{table}\n---\n{items:name:qty}\n---\n{footer}\n{cut}';
  }

  function renderEscpos(inv, templateStr, type) {
    const tpl = templateStr || (type === 'cashier' ? defaultEscposCashier() : defaultEscposKitchen());
    const paid = inv.paid != null ? Number(inv.paid) : Number(inv.total || 0);
    const total = Number(inv.total || 0);
    const remaining = inv.remaining != null ? Number(inv.remaining) : Math.max(0, total - paid);
    const change = inv.change || 0;
    const dateStr = inv.date ? new Date(inv.date).toLocaleString('ar-SA') : FB.clockNow().toLocaleString('ar-SA');
    const status = remaining > 0 ? 'معلق' : 'مدفوع';
    const maxLen = 32;

    const vars = {
      date: dateStr,
      id: inv.id || '',
      customer: inv.customer || '',
      table: inv.table || '',
      total: 'الإجمالي:  ' + total.toLocaleString() + ' ج.م',
      paid: 'المدفوع:   ' + paid.toLocaleString() + ' ج.م',
      change: change > 0 ? 'الباقي للعميل: ' + change.toLocaleString() + ' ج.م' : '',
      remaining: remaining > 0 ? 'المتبقي:  ' + remaining.toLocaleString() + ' ج.م' : '',
      serviceAmount: inv.serviceAmount > 0 ? 'خدمة:      ' + Number(inv.serviceAmount).toLocaleString() + ' ج.م' : '',
      taxAmount: inv.taxAmount > 0 ? 'ضريبة:     ' + Number(inv.taxAmount).toLocaleString() + ' ج.م' : '',
      subtotal: 'المجموع:   ' + (total - (inv.serviceAmount || 0) - (inv.taxAmount || 0)).toLocaleString() + ' ج.م',
      paymentMethod: (inv.paymentMethod || 'كاش') + '    ' + status,
      footer: 'شكراً لزيارتكم\nLagunaDubai',
      status: status
    };

    const lines = tpl.split('\n');
    const parts = [];

    for (let line of lines) {
      // Handle commands
      if (line.startsWith('{init}')) { parts.push(escposBytes(ESCPOS_CMD.init)); continue; }
      if (line.startsWith('{center}')) { parts.push(escposBytes(ESCPOS_CMD.center)); continue; }
      if (line.startsWith('{left}')) { parts.push(escposBytes(ESCPOS_CMD.left)); continue; }
      if (line.startsWith('{bold=off}') || line.startsWith('{boldoff}')) { parts.push(escposBytes(ESCPOS_CMD.boldOff)); continue; }
      if (line.startsWith('{bold}') || line.startsWith('{bold=on}')) { parts.push(escposBytes(ESCPOS_CMD.boldOn)); continue; }
      if (line.startsWith('{size=double}') || line.startsWith('{size=2}')) { parts.push(escposBytes(ESCPOS_CMD.sizeDouble)); continue; }
      if (line.startsWith('{size=normal}') || line.startsWith('{size=1}')) { parts.push(escposBytes(ESCPOS_CMD.sizeNormal)); continue; }
      if (line.startsWith('{cut}')) { parts.push(escposBytes(ESCPOS_CMD.cut)); continue; }
      if (line.startsWith('{drawer}') || line.startsWith('{cashdrawer}')) { parts.push(escposBytes(ESCPOS_CMD.drawer)); continue; }
      if (line.startsWith('---')) { parts.push(textEncoder('------------------------------')); continue; }
      if (line.startsWith('{items:')) {
        const match = line.match(/\{items:([^}]+)\}/);
        if (!match || !inv.items) continue;
        const cols = match[1].split(':');
        inv.items.forEach(item => {
          const safeName = escapeEscPos(item.name);
          const safeNote = escapeEscPos(item.note || '');
          const milkTxt = item.hasMilk ? ' +حليب' : '';
          const noteTxt = safeNote ? ' (' + safeNote + ')' : '';
          let buf = '';
          if (cols.length === 3) {
            const name = ('\u2022 ' + safeName + milkTxt).substring(0, maxLen - 8);
            const qty = '' + item.qty + 'x';
            const lastCol = cols[2] === 'price' ? item.price : (item.qty * item.price);
            const lastColStr = '' + lastCol;
            const padded = name.padEnd(maxLen - qty.length - lastColStr.length) + qty + lastColStr;
            buf = padded;
          } else {
            buf = '\u2022 ' + safeName + milkTxt + noteTxt;
          }
          parts.push(textEncoder(buf));
          if (safeNote) parts.push(textEncoder('  ' + safeNote));
        });
        continue;
      }

      // Replace variables
      let text = line;
      for (const [key, val] of Object.entries(vars)) {
        if (val) {
          const re = new RegExp('\\{' + key + '\\}', 'g');
          text = text.replace(re, val);
        }
      }
      text = text.replace(/\{empty\}/g, '').replace(/\{spacer\}/g, ' ');

      if (text.trim() || text === '') {
        parts.push(textEncoder(text));
      }
    }

    return concatUint8(parts);
  }

  async function getTemplate(type) {
    try {
      const settings = await DB.settings.get();
      if (type === 'cashier') return settings.invoiceTemplateCashier || null;
      if (type === 'kitchen') return settings.invoiceTemplateKitchen || null;
    } catch {}
    return null;
  }

  async function getEscposTemplate(type) {
    try {
      const settings = await DB.settings.get();
      if (type === 'cashier') return settings.escposTemplateCashier || null;
      if (type === 'kitchen') return settings.escposTemplateKitchen || null;
    } catch {}
    return null;
  }

  return {
    renderCashier,
    renderKitchen,
    renderEscpos,
    getTemplate,
    getEscposTemplate,
    defaultCashierTemplate: defaultCashierTemplate(),
    defaultKitchenTemplate: defaultKitchenTemplate(),
    defaultEscposCashier: defaultEscposCashier(),
    defaultEscposKitchen: defaultEscposKitchen(),
    PLACEHOLDERS
  };
})();
