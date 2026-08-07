function rtLocalDateKey(d) {
  if (!d) return '';
  if (typeof d === 'string') d = new Date(d);
  return d.toISOString().slice(0, 10);
}

const RT_DB = {
  users: {
    async all() { return await RT_FB.getCollection('rt_users'); },
    async add(u) { if (!u.id) u.id = 'rtu-' + crypto.randomUUID().slice(0, 8); return await RT_FB.addDoc('rt_users', u); },
    async update(id, data) { await RT_FB.updateDoc('rt_users', id, data); },
    async remove(id) { await RT_FB.removeDoc('rt_users', id); }
  },

  products: {
    async all() { return await RT_FB.getCollection('rt_products'); },
    async add(p) { if (!p.id) p.id = 'rtp-' + crypto.randomUUID().slice(0, 8); return await RT_FB.addDoc('rt_products', p); },
    async update(id, data) { await RT_FB.updateDoc('rt_products', id, data); },
    async remove(id) { await RT_FB.removeDoc('rt_products', id); }
  },

  categories: {
    async all() { return await RT_FB.getCollection('rt_categories'); },
    async add(c) { if (!c.id) c.id = 'rtc-' + crypto.randomUUID().slice(0, 8); return await RT_FB.addDoc('rt_categories', c); },
    async update(id, data) { await RT_FB.updateDoc('rt_categories', id, data); },
    async remove(id) { await RT_FB.removeDoc('rt_categories', id); }
  },

  shifts: {
    async all() { return await RT_FB.getCollection('rt_shifts'); },
    async getOpen() {
      const all = await RT_FB.getCollection('rt_shifts');
      return all.find(s => s && !s.closedAt) || null;
    },
    async open(name) {
      const now = RT_FB.clockNow();
      const shift = {
        id: 'rts-' + crypto.randomUUID().slice(0, 8),
        openDate: rtLocalDateKey(now),
        openedAt: now.toISOString(),
        openedBy: name || 'المدير',
        closedAt: null,
        closedBy: null
      };
      await RT_FB.addDoc('rt_shifts', shift);
      return shift;
    },
    async close(id, data) { await RT_FB.updateDoc('rt_shifts', id, data); }
  },

  invoices: {
    async all() { return await RT_FB.getCollection('rt_invoices'); },
    async add(inv) { if (!inv.id) inv.id = 'RINV-' + crypto.randomUUID().slice(0, 8).toUpperCase(); return await RT_FB.addDoc('rt_invoices', inv); }
  },

  daycloses: {
    async all() { return await RT_FB.getCollection('rt_daycloses'); },
    async add(dc) { if (!dc.id) dc.id = 'rtdc-' + crypto.randomUUID().slice(0, 8); return await RT_FB.addDoc('rt_daycloses', dc); }
  },

  settings: {
    async get() {
      const all = await RT_FB.getCollection('rt_settings');
      const o = {};
      all.forEach(s => o[s.key] = s.value);
      return o;
    },
    async save(data) {
      const existing = await RT_FB.getCollection('rt_settings');
      for (const [key, value] of Object.entries(data)) {
        const found = existing.find(s => s.key === key);
        if (found) await RT_FB.updateDoc('rt_settings', found.id, { value });
        else await RT_FB.addDoc('rt_settings', { key, value });
      }
    }
  },

  audit: {
    async log(type, detail) {
      try {
        var user;
        try { user = JSON.parse(sessionStorage.getItem('rt_user')); } catch (e) { user = null; }
        await RT_FB.addDoc('rt_audit_logs', {
          type: type,
          detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
          username: user ? user.username : 'unknown',
          timestamp: RT_FB.nowISO()
        });
      } catch (e) { console.warn('[rt-audit]', e); }
    }
  },

  async seedDefaults() {
    const cats = await this.categories.all();
    if (cats.length === 0) {
      const defaults = [
        { slug: 'sandwiches', name: 'ساندوتشات', order: 1 },
        { slug: 'meals', name: 'وجبات', order: 2 },
        { slug: 'appetizers', name: 'مقبلات', order: 3 },
        { slug: 'grills', name: 'مشويات', order: 4 },
        { slug: 'drinks', name: 'مشروبات', order: 5 },
        { slug: 'desserts', name: 'حلويات', order: 6 }
      ];
      for (const c of defaults) await this.categories.add(c);
    }

    const prods = await this.products.all();
    if (prods.length === 0) {
      const defaults = [
        { name: 'ساندوتش شاورما', category: 'sandwiches', price: 60 },
        { name: 'ساندوتش كبدة', category: 'sandwiches', price: 50 },
        { name: 'ساندوتش جبنة', category: 'sandwiches', price: 40 },
        { name: 'ساندوتش بطاطس', category: 'sandwiches', price: 30 },
        { name: 'وجبة شاورما', category: 'meals', price: 120 },
        { name: 'وجبة كبدة', category: 'meals', price: 100 },
        { name: 'فراخ مشوية', category: 'grills', price: 150 },
        { name: 'كفتة', category: 'grills', price: 90 },
        { name: 'بطاطس مقلي', category: 'appetizers', price: 45 },
        { name: 'سلطة خضراء', category: 'appetizers', price: 40 },
        { name: 'مياه', category: 'drinks', price: 10 },
        { name: 'مشروب غازي', category: 'drinks', price: 25 },
        { name: 'عصير برتقال', category: 'drinks', price: 40 },
        { name: 'تشيز كيك', category: 'desserts', price: 90 },
        { name: 'أم علي', category: 'desserts', price: 60 }
      ];
      for (const p of defaults) {
        await this.products.add({ id: 'rtp-' + crypto.randomUUID().slice(0, 8), name: p.name, category: p.category, price: p.price, available: 1 });
      }
    }

    await this.settings.save({ _seeded: true });
  }
};
