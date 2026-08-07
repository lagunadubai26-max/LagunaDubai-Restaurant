;(async () => {
  let user;
  try { user = JSON.parse(sessionStorage.getItem('rt_user')); } catch (e) { user = null; }
  if (!user) { window.location.href = 'rt-login.html'; return; }

  let categories = [];
  let products = [];
  let allUsers = [];

  async function loadAll() {
    [categories, products, allUsers] = await Promise.all([
      RT_DB.categories.all(),
      RT_DB.products.all(),
      RT_DB.users.all()
    ]);
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
  function hideErr(el) { el.textContent = ''; el.style.display = 'none'; }

  function slugify(name) {
    return 'rtcat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  // ── Account ──
  const accError = document.getElementById('accError');
  document.getElementById('accName').value = user.name || '';
  document.getElementById('accUsername').value = user.username || '';

  document.getElementById('saveAccount').onclick = async () => {
    hideErr(accError);
    const me = allUsers.find(u => u.id === user.id);
    if (!me) { showErr(accError, 'حساب غير موجود'); return; }
    const currentPass = document.getElementById('accCurrentPass').value;
    const ok = await PASSWORD_UTILS.verify(currentPass, me.password);
    if (!ok) { showErr(accError, 'كلمة المرور الحالية غير صحيحة'); return; }

    const name = document.getElementById('accName').value.trim();
    const username = document.getElementById('accUsername').value.trim();
    const newPass = document.getElementById('accNewPass').value;
    if (!name || !username) { showErr(accError, 'الاسم واسم المستخدم مطلوبان'); return; }
    if (username.length < 3) { showErr(accError, 'اسم المستخدم 3 أحرف على الأقل'); return; }
    if (newPass && newPass.length < 6) { showErr(accError, 'كلمة المرور الجديدة 6 أحرف على الأقل'); return; }
    const usernameTaken = allUsers.some(u => u.username === username && u.id !== user.id);
    if (usernameTaken) { showErr(accError, 'اسم المستخدم مستخدم بالفعل'); return; }

    const updates = { name: name, username: username };
    if (newPass) updates.password = await PASSWORD_UTILS.hash(newPass);
    await RT_DB.users.update(user.id, updates);
    await RT_DB.audit.log('account_updated', { id: user.id, username: username });

    user.name = name;
    user.username = username;
    sessionStorage.setItem('rt_user', JSON.stringify(user));
    document.getElementById('profileName').textContent = name;
    document.getElementById('sidebarName').textContent = name;
    document.getElementById('accCurrentPass').value = '';
    document.getElementById('accNewPass').value = '';
    alert('تم حفظ الحساب');
  };

  // ── Categories ──
  const catList = document.getElementById('catList');

  function renderCategories() {
    if (categories.length === 0) {
      catList.innerHTML = '<div class="empty-state" style="padding:20px 10px"><h3>لا توجد أصناف</h3></div>';
      return;
    }
    const rows = categories.map(c => {
      const count = products.filter(p => p.category === c.slug).length;
      return '<tr>' +
        '<td>' + escapeHtml(c.name) + '</td>' +
        '<td>' + (c.order || 0) + '</td>' +
        '<td>' + count + '</td>' +
        '<td style="text-align:left;white-space:nowrap">' +
          '<button class="rt-btn rt-btn-ghost rt-btn-sm" data-cat-edit="' + escapeHtml(c.id) + '"><i class="fa-solid fa-pen"></i></button> ' +
          '<button class="rt-btn rt-btn-danger rt-btn-sm" data-cat-del="' + escapeHtml(c.id) + '"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
    catList.innerHTML = '<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>الاسم</th><th>الترتيب</th><th>المنتجات</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';

    catList.querySelectorAll('[data-cat-edit]').forEach(b => {
      b.onclick = () => startCatEdit(b.dataset.catEdit);
    });
    catList.querySelectorAll('[data-cat-del]').forEach(b => {
      b.onclick = () => deleteCat(b.dataset.catDel);
    });
  }

  function startCatEdit(id) {
    const c = categories.find(x => x.id === id);
    if (!c) return;
    document.getElementById('catName').value = c.name;
    document.getElementById('catOrder').value = c.order || '';
    document.getElementById('catEditId').value = c.id;
    document.getElementById('addCat').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ';
    document.getElementById('cancelCatEdit').style.display = '';
  }

  function cancelCatEdit() {
    document.getElementById('catName').value = '';
    document.getElementById('catOrder').value = '';
    document.getElementById('catEditId').value = '';
    document.getElementById('addCat').innerHTML = '<i class="fa-solid fa-plus"></i> إضافة';
    document.getElementById('cancelCatEdit').style.display = 'none';
  }

  document.getElementById('cancelCatEdit').onclick = cancelCatEdit;

  document.getElementById('addCat').onclick = async () => {
    const name = document.getElementById('catName').value.trim();
    const order = parseInt(document.getElementById('catOrder').value, 10);
    const editId = document.getElementById('catEditId').value;
    if (!name) { alert('أدخل اسم الصنف'); return; }
    if (editId) {
      await RT_DB.categories.update(editId, { name: name, order: isNaN(order) ? 0 : order });
      await RT_DB.audit.log('category_updated', { id: editId, name: name });
    } else {
      await RT_DB.categories.add({ slug: slugify(name), name: name, order: isNaN(order) ? categories.length + 1 : order });
      await RT_DB.audit.log('category_added', { name: name });
    }
    categories = await RT_DB.categories.all();
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    cancelCatEdit();
    renderCategories();
    renderCatSelect();
  };

  async function deleteCat(id) {
    const c = categories.find(x => x.id === id);
    if (!c) return;
    if (!confirm('حذف الصنف "' + c.name + '"؟ المنتجات المرتبطة به ستظل في قائمة الكل')) return;
    await RT_DB.categories.remove(id);
    await RT_DB.audit.log('category_deleted', { id: id, name: c.name });
    categories = await RT_DB.categories.all();
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    renderCategories();
    renderCatSelect();
  }

  // ── Products ──
  const prodList = document.getElementById('prodList');
  const prodCatSelect = document.getElementById('prodCat');

  function renderCatSelect() {
    const cur = prodCatSelect.value;
    prodCatSelect.innerHTML = categories.map(c => '<option value="' + escapeHtml(c.slug) + '"' + (c.slug === cur ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('');
    if (!categories.length) prodCatSelect.innerHTML = '<option value="">لا توجد أصناف</option>';
  }

  function catName(slug) {
    const c = categories.find(x => x.slug === slug);
    return c ? c.name : slug;
  }

  function renderProducts() {
    if (products.length === 0) {
      prodList.innerHTML = '<div class="empty-state" style="padding:20px 10px"><h3>لا توجد منتجات</h3></div>';
      return;
    }
    const rows = products.map(p => {
      const avail = p.available;
      return '<tr>' +
        '<td>' + escapeHtml(p.name) + '</td>' +
        '<td>' + escapeHtml(catName(p.category)) + '</td>' +
        '<td>' + Number(p.price).toLocaleString() + ' ج.م</td>' +
        '<td><span class="badge ' + (avail ? 'badge-success' : 'badge-danger') + '" data-avail="' + escapeHtml(p.id) + '" style="cursor:pointer">' + (avail ? 'متاح' : 'موقوف') + '</span></td>' +
        '<td style="text-align:left;white-space:nowrap">' +
          '<button class="rt-btn rt-btn-ghost rt-btn-sm" data-prod-edit="' + escapeHtml(p.id) + '"><i class="fa-solid fa-pen"></i></button> ' +
          '<button class="rt-btn rt-btn-danger rt-btn-sm" data-prod-del="' + escapeHtml(p.id) + '"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
    prodList.innerHTML = '<div style="overflow-x:auto"><table class="rt-table"><thead><tr><th>الاسم</th><th>الصنف</th><th>السعر</th><th>الحالة</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';

    prodList.querySelectorAll('[data-avail]').forEach(b => {
      b.onclick = () => toggleAvail(b.dataset.avail);
    });
    prodList.querySelectorAll('[data-prod-edit]').forEach(b => {
      b.onclick = () => startProdEdit(b.dataset.prodEdit);
    });
    prodList.querySelectorAll('[data-prod-del]').forEach(b => {
      b.onclick = () => deleteProd(b.dataset.prodDel);
    });
  }

  function startProdEdit(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('prodName').value = p.name;
    prodCatSelect.value = p.category;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodEditId').value = p.id;
    document.getElementById('addProd').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ';
    document.getElementById('cancelProdEdit').style.display = '';
  }

  function cancelProdEdit() {
    document.getElementById('prodName').value = '';
    document.getElementById('prodPrice').value = '';
    document.getElementById('prodEditId').value = '';
    document.getElementById('addProd').innerHTML = '<i class="fa-solid fa-plus"></i> إضافة';
    document.getElementById('cancelProdEdit').style.display = 'none';
  }

  document.getElementById('cancelProdEdit').onclick = cancelProdEdit;

  document.getElementById('addProd').onclick = async () => {
    const name = document.getElementById('prodName').value.trim();
    const price = Number(document.getElementById('prodPrice').value);
    const cat = prodCatSelect.value;
    const editId = document.getElementById('prodEditId').value;
    if (!name) { alert('أدخل اسم المنتج'); return; }
    if (!categories.length) { alert('أضف صنفًا أولًا'); return; }
    if (isNaN(price) || price < 0) { alert('أدخل سعرًا صحيحًا'); return; }
    if (editId) {
      await RT_DB.products.update(editId, { name: name, category: cat, price: price });
      await RT_DB.audit.log('product_updated', { id: editId, name: name });
    } else {
      await RT_DB.products.add({ name: name, category: cat, price: price, available: 1 });
      await RT_DB.audit.log('product_added', { name: name, price: price });
    }
    products = await RT_DB.products.all();
    cancelProdEdit();
    renderProducts();
  };

  async function toggleAvail(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const newAvail = p.available ? 0 : 1;
    await RT_DB.products.update(id, { available: newAvail });
    await RT_DB.audit.log('product_toggled', { id: id, available: newAvail });
    products = await RT_DB.products.all();
    renderProducts();
  }

  async function deleteProd(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (!confirm('حذف المنتج "' + p.name + '"؟')) return;
    await RT_DB.products.remove(id);
    await RT_DB.audit.log('product_deleted', { id: id, name: p.name });
    products = await RT_DB.products.all();
    renderProducts();
  }

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
  renderCatSelect();
  renderCategories();
  renderProducts();
})();
