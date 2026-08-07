let products = [];
let categories = [];
let catMap = {};
let editProdId = null;
let deleteTargetId = null;
const prodList = document.getElementById('prodList');
const searchInput = document.getElementById('prodSearch');
const catFilter = document.getElementById('prodCategory');
const modal = document.getElementById('prodModal');
const deleteModal = document.getElementById('deleteProdModal');

async function loadCategories() {
  const raw = await DB.categories.all() || [];
  // De-duplicate by slug
  const seen = {};
  categories = [];
  raw.forEach(c => { if (!seen[c.slug]) { seen[c.slug] = true; categories.push(c); } });
  categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  catMap = {};
  categories.forEach(c => catMap[c.slug] = c.name);
  populateCategoryDropdowns();
  renderCategoryList();
}

function populateCategoryDropdowns() {
  catFilter.innerHTML = '<option value="all">كل الأقسام</option>';
  const modalSelect = document.getElementById('prodCategoryModal');
  modalSelect.innerHTML = '';
  categories.forEach(c => {
    const opt1 = document.createElement('option');
    opt1.value = c.slug;
    opt1.textContent = c.name;
    catFilter.appendChild(opt1);
    const opt2 = document.createElement('option');
    opt2.value = c.slug;
    opt2.textContent = c.name;
    modalSelect.appendChild(opt2);
  });
}

function renderCategoryList() {
  const catList = document.getElementById('catList');
  if (!catList) return;
  catList.innerHTML = '';
  categories.forEach(c => {
    const tag = document.createElement('span');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:2px solid var(--border);border-radius:10px;padding:6px 12px;font-size:13px';
    tag.textContent = c.name;
    const btn = document.createElement('button');
    btn.className = 'del-cat-btn';
    btn.dataset.id = c.id;
    btn.style.cssText = 'background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px;padding:0';
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    tag.appendChild(btn);
    catList.appendChild(tag);
  });
  document.querySelectorAll('.del-cat-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const cat = categories.find(c => c.id === id);
      const inUse = products.some(p => p.category === cat.slug);
      if (inUse) return alert('لا يمكن حذف هذا القسم لسه فيه منتجات. نقل المنتجات لقسم تاني الأول.');
      if (!confirm('حذف قسم "' + cat.name + '"؟')) return;
      await DB.categories.remove(id);
      await loadCategories();
      render();
    };
  });
}

document.getElementById('addCatBtn').onclick = async () => {
  const slug = document.getElementById('newCatSlug').value.trim();
  const name = document.getElementById('newCatName').value.trim();
  if (!slug || !name) return alert('ادخل الاسم الإنجليزي والعربي');
  if (categories.find(c => c.slug === slug)) return alert('القسم ده موجود بالفعل');
  const maxOrder = categories.reduce((m, c) => Math.max(m, c.order || 0), 0);
  await DB.categories.add({ slug, name, order: maxOrder + 1 });
  document.getElementById('newCatSlug').value = '';
  document.getElementById('newCatName').value = '';
  await loadCategories();
  render();
};

async function render() {
  products = await DB.products.all() || [];
  prodList.innerHTML = '';
  const val = searchInput.value.toLowerCase();
  const cat = catFilter.value;
  const filtered = products.filter(p => p.name.toLowerCase().includes(val) && (cat === 'all' || p.category === cat));

  filtered.forEach(p => {
    const stCls = p.available ? 'active' : 'stopped';
    const stTxt = p.available ? 'متاح' : 'غير متاح';
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <div><img class="thumb" src="${sanitizeUrl(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍽</text></svg>'"></div>
      <span>${escapeHtml(p.name)}</span><span>${escapeHtml(catMap[p.category] || p.category)}</span>
      <span>${validateNumber(p.price)} ج.م</span>
      <span class="status ${stCls}">${escapeHtml(stTxt)}</span>
      <div class="actions">
        <button class="edit-btn" data-id="${escapeHtml(p.id)}"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" data-id="${escapeHtml(p.id)}"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    prodList.appendChild(row);
  });

  // Click on stat cards to filter by availability
  document.querySelectorAll('.product-stats .stat-card').forEach((card, idx) => {
    card.style.cursor = 'pointer';
    card.onclick = () => {
      if (idx === 2) { // متاح
        catFilter.value = 'all';
        searchInput.value = '';
        renderFiltered(true);
      } else if (idx === 3) { // غير متاح
        catFilter.value = 'all';
        searchInput.value = '';
        renderFiltered(false);
      } else {
        catFilter.value = 'all';
        searchInput.value = '';
        render();
      }
    };
  });
  document.getElementById('prodTotal').textContent = products.length;
  document.getElementById('prodCategories').textContent = categories.length;
  document.getElementById('prodActive').textContent = products.filter(p => p.available).length;
  document.getElementById('prodInactive').textContent = products.filter(p => !p.available).length;
  attachEvents();
}

function renderFiltered(available) {
  prodList.innerHTML = '';
  const filtered = products.filter(p => p.available === available);
  filtered.forEach(p => {
    const stCls = p.available ? 'active' : 'stopped';
    const stTxt = p.available ? 'متاح' : 'غير متاح';
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <div><img class="thumb" src="${sanitizeUrl(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍽</text></svg>'"></div>
      <span>${escapeHtml(p.name)}</span><span>${escapeHtml(catMap[p.category] || p.category)}</span>
      <span>${validateNumber(p.price)} ج.م</span>
      <span class="status ${stCls}">${escapeHtml(stTxt)}</span>
      <div class="actions">
        <button class="edit-btn" data-id="${escapeHtml(p.id)}"><i class="fa-solid fa-pen"></i></button>
        <button class="delete-btn" data-id="${escapeHtml(p.id)}"><i class="fa-solid fa-trash"></i></button>
      </div>`;
    prodList.appendChild(row);
  });
  attachEvents();
}

function attachEvents() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => {
      const p = products.find(x => x.id === btn.dataset.id);
      if (!p) return;
      editProdId = p.id;
      document.getElementById('prodModalTitle').textContent = 'تعديل منتج';
      document.getElementById('prodName').value = p.name;
      document.getElementById('prodNameEn').value = p.nameEn || '';
      document.getElementById('prodCategoryModal').value = p.category;
      document.getElementById('prodPrice').value = p.price;
      document.getElementById('prodDesc').value = p.description || '';
      document.getElementById('prodImage').value = p.image || '';
      document.getElementById('prodImageFile').value = '';
      if (p.image) {
        const preview = document.getElementById('prodImagePreview');
        preview.style.display = 'block';
        preview.querySelector('img').src = p.image;
      } else {
        document.getElementById('prodImagePreview').style.display = 'none';
      }
      document.getElementById('prodAvailable').checked = p.available;
      modal.classList.add('show');
    };
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = () => {
      deleteTargetId = btn.dataset.id;
      deleteModal.classList.add('show');
    };
  });
}

function resetProductForm() {
  document.getElementById('prodName').value = '';
  document.getElementById('prodNameEn').value = '';
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodDesc').value = '';
  document.getElementById('prodImage').value = '';
  document.getElementById('prodImageFile').value = '';
  document.getElementById('prodImagePreview').style.display = 'none';
  document.getElementById('prodAvailable').checked = true;
}

document.getElementById('prodImageFile').onchange = function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const maxW = 400;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = c.toDataURL('image/jpeg', 0.6);
      document.getElementById('prodImage').value = compressed;
      const preview = document.getElementById('prodImagePreview');
      preview.style.display = 'block';
      preview.querySelector('img').src = compressed;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

document.getElementById('addProdBtn').onclick = () => {
  editProdId = null;
  document.getElementById('prodModalTitle').textContent = 'إضافة منتج';
  resetProductForm();
  modal.classList.add('show');
};

document.getElementById('saveProd').onclick = async () => {
  const name = document.getElementById('prodName').value.trim();
  const nameEn = document.getElementById('prodNameEn').value.trim();
  const category = document.getElementById('prodCategoryModal').value;
  const price = Number(document.getElementById('prodPrice').value);
  const description = document.getElementById('prodDesc').value.trim();
  const image = document.getElementById('prodImage').value.trim();
  const available = document.getElementById('prodAvailable').checked;
  if (!name || !price) return alert('يرجى إدخال اسم المنتج والسعر');
  if (editProdId) {
    await DB.products.update(editProdId, { name, nameEn, category, price, description, image, available });
  } else {
    await DB.products.add({ id: Date.now().toString(36), name, nameEn, category, price, description, image, available });
  }
  modal.classList.remove('show');
  render();
};

document.getElementById('cancelProd').onclick = () => modal.classList.remove('show');
document.getElementById('closeProdModal').onclick = () => modal.classList.remove('show');
document.getElementById('cancelDelete').onclick = () => deleteModal.classList.remove('show');
document.getElementById('confirmDelete').onclick = async () => {
  if (deleteTargetId) {
    await DB.products.remove(deleteTargetId);
    deleteTargetId = null;
    deleteModal.classList.remove('show');
    render();
  }
};
searchInput.addEventListener('keyup', render);
catFilter.addEventListener('change', render);

(async () => {
  try {
    await DB.seed();
  } catch (e) {
    console.error('[products] seed error:', e);
  }
  await loadCategories();
  render();
})();
