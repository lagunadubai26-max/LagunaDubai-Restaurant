const DB_MODE = 'firebase';

function localGet(key, def) {
  try { const d = localStorage.getItem('laguna_rest_' + key); return d ? JSON.parse(d) : def; } catch { return def; }
}
function localSet(key, val) { localStorage.setItem('laguna_rest_' + key, JSON.stringify(val)); }

function localDateKey(d) {
  if (!d) return '';
  if (typeof d === 'string') d = new Date(d);
  return d.toISOString().slice(0, 10);
}

const DB = {
  mode: DB_MODE,

  invoices: {
    async all() { return await FB.getCollection('invoices'); },
    async add(inv) {
      if (!inv.id) inv.id = 'INV-' + crypto.randomUUID().slice(0, 8).toUpperCase();
      return await FB.addDoc('invoices', inv);
    },
    async update(id, data) { await FB.updateDoc('invoices', id, data); },
    async remove(id) { await FB.removeDoc('invoices', id); }
  },

  employees: {
    async all() { return await FB.getCollection('employees'); },
    async add(emp) { if (!emp.id) emp.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('employees', emp); },
    async update(id, data) { await FB.updateDoc('employees', id, data); },
    async remove(id) { await FB.removeDoc('employees', id); }
  },

  attendance: {
    async all() { return await FB.getCollection('attendance'); },
    async attDayRange(now) {
      now = now || FB.clockNow();
      let shift = null;
      try { shift = await DB.shifts.getOpen(); } catch(e) {}
      if (shift && shift.openDate) {
        const start = new Date(shift.openDate + 'T00:00:00Z');
        return { start, end: now };
      }
      const h = now.getHours();
      let start, end;
      if (h >= 17) {
        start = new Date(now); start.setHours(17, 0, 0, 0);
        end = new Date(now); end.setDate(end.getDate() + 1); end.setHours(16, 59, 59, 999);
      } else {
        start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(17, 0, 0, 0);
        end = new Date(now); end.setHours(16, 59, 59, 999);
      }
      return { start, end };
    },
    async today() {
      const all = await FB.getCollection('attendance');
      const range = this.attDayRange();
      return all.filter(a => {
        if (!a.date) return false;
        const d = new Date(a.date);
        return d >= range.start && d <= range.end;
      });
    },
    async add(rec) { if (!rec.id) rec.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('attendance', rec); },
    async update(id, data) { await FB.updateDoc('attendance', id, data); },
    async remove(id) { await FB.removeDoc('attendance', id); },
    async checkIn(employeeId, name, job, customTime, shiftTime) {
      const time = customTime ? new Date(customTime) : FB.clockNow();
      const minutes = time.getHours() * 60 + time.getMinutes();
      let status = 'present';
      if (shiftTime) {
        const parts = String(shiftTime).split(':');
        if (parts.length >= 2) {
          const shiftMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          status = minutes > shiftMin + 30 ? 'late' : 'present';
        } else {
          status = minutes > 17 * 60 + 30 ? 'late' : 'present';
        }
      } else {
        status = minutes > 17 * 60 + 30 ? 'late' : 'present';
      }
      return await FB.addDoc('attendance', {
        id: 'att-' + crypto.randomUUID().slice(0, 8), employeeId, name, job,
        date: time.toISOString(), checkIn: time.toISOString(), status
      });
    },
    async checkOut(id, customTime) {
      const time = customTime ? new Date(customTime) : FB.clockNow();
      await FB.updateDoc('attendance', id, { checkOut: time.toISOString() });
    }
  },

  returns: {
    async all() { return await FB.getCollection('returns'); },
    async add(r) { if (!r.id) r.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('returns', r); },
    async update(id, data) { await FB.updateDoc('returns', id, data); },
    async remove(id) { await FB.removeDoc('returns', id); }
  },

  tables: {
    async all() { return await FB.getCollection('tables_'); },
    async add(t) { if (!t.id) t.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('tables_', t); },
    async update(id, data) { await FB.updateDoc('tables_', id, data); },
    async remove(id) { await FB.removeDoc('tables_', id); }
  },

  expenses: {
    async all() { return await FB.getCollection('expenses'); },
    async add(e) { if (!e.id) e.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('expenses', e); },
    async remove(id) { await FB.removeDoc('expenses', id); }
  },

  customers: {
    async all() { return await FB.getCollection('customers'); },
    async add(c) { if (!c.id) c.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('customers', c); },
    async update(id, data) { await FB.updateDoc('customers', id, data); },
    async remove(id) { await FB.removeDoc('customers', id); }
  },

  inventory: {
    async all() { return await FB.getCollection('inventory'); },
    async add(item) { if (!item.id) item.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('inventory', item); },
    async update(id, data) { await FB.updateDoc('inventory', id, data); },
    async remove(id) { await FB.removeDoc('inventory', id); }
  },

  inventory_counts: {
    async all() { return await FB.getCollection('inventory_counts'); },
    async add(c) { if (!c.id) c.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('inventory_counts', c); },
  },

  settings: {
    async get() {
      const all = await FB.getCollection('settings');
      const o = {};
      all.forEach(s => o[s.key] = s.value);
      return o;
    },
    async save(data) {
      const existing = await FB.getCollection('settings');
      for (const [key, value] of Object.entries(data)) {
        const found = existing.find(s => s.key === key);
        if (found) await FB.updateDoc('settings', found.id, { value });
        else await FB.addDoc('settings', { key, value });
      }
    }
  },

  categories: {
    async all() { return await FB.getCollection('categories'); },
    async add(c) { if (!c.id) c.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('categories', c); },
    async update(id, data) { await FB.updateDoc('categories', id, data); },
    async remove(id) { await FB.removeDoc('categories', id); }
  },

  users: {
    async all() { return await FB.getCollection('users'); },
    async add(u) { return await FB.addDoc('users', u); },
    async update(id, data) { await FB.updateDoc('users', id, data); },
    async remove(id) { await FB.removeDoc('users', id); }
  },

  daycloses: {
    async all() { return await FB.getCollection('daycloses'); },
    async today() {
      const all = await FB.getCollection('daycloses');
      const today = localDateKey(FB.clockNow());
      return all.find(d => d.date && d.date.slice(0, 10) === today);
    },
    async byMonth(year, month) {
      const all = await FB.getCollection('daycloses');
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return all.filter(d => d.date && d.date.startsWith(prefix));
    },
    async close(data) {
      if (!data.id) data.id = 'dc-' + crypto.randomUUID().slice(0, 8);
      return await FB.addDoc('daycloses', data);
    },
  },

  shifts: {
    async all() { return await FB.getCollection('shifts'); },
    async getOpen() {
      const all = await FB.getCollection('shifts');
      return all.find(s => s && !s.closedAt) || null;
    },
    async open(name) {
      const now = FB.clockNow();
      const shift = {
        id: 'sh-' + crypto.randomUUID().slice(0, 8),
        openDate: localDateKey(now),
        openedAt: now.toISOString(),
        openedBy: name || 'الكاشير',
        closedAt: null
      };
      await FB.addDoc('shifts', shift);
      return shift;
    },
    async close(id, data) {
      await FB.updateDoc('shifts', id, data);
    }
  },

  audit: {
    async all() { return await FB.getCollection('audit_logs'); },
    async log(type, detail) {
      try {
        var user;
        try { user = JSON.parse(sessionStorage.getItem('laguna_rest_user')); } catch(e) { user = null; }
        await FB.addDoc('audit_logs', {
          type: type,
          detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
          username: user ? user.username : 'unknown',
          role: user ? user.role : 'none',
          timestamp: FB.nowISO()
        });
      } catch(e) { console.warn('[audit]', e); }
    }
  },

  products: {
    async all() { return await FB.getCollection('products'); },
    async add(p) { if (!p.id) p.id = crypto.randomUUID().slice(0, 8); return await FB.addDoc('products', p); },
    async update(id, data) { await FB.updateDoc('products', id, data); },
    async remove(id) { await FB.removeDoc('products', id); }
  },

  async migrateProductDescriptions() {
    const descMap = {};
    const products = await this.products.all() || [];
    for (const p of products) {
      const desc = descMap[p.id];
      if (desc && !p.description) {
        await this.products.update(p.id, { description: desc });
      }
    }
  },

  async seed() {
    const users = await this.users.all();
    const adminUser = users.find(u => u.username === 'admin');
    if (adminUser) {
      if (!PASSWORD_UTILS.isHashed(adminUser.password)) {
        const adminHashed = await PASSWORD_UTILS.hash('admin123');
        await this.users.update(adminUser.id, { password: adminHashed }).catch(function() {});
      }
    } else {
      const adminHashed = await PASSWORD_UTILS.hash('admin123');
      const uid = FB.getUid();
      if (uid) {
        try {
          const snap = await FB.getDb().collection('user_mappings').doc(uid).get();
          if (!snap.exists) {
            await FB.getDb().collection('user_mappings').doc(uid).set({
              userId: 'u1', role: 'Administrator', username: 'admin', name: 'الكاشير',
              updatedAt: FB.nowISO()
            });
          }
        } catch(e) { console.warn('[seed] mapping error:', e); }
      }
      await this.users.add({ id: 'u1', username: 'admin', password: adminHashed, name: 'الكاشير', role: 'Administrator' });
    }
    const ownerUser = users.find(u => u.username === 'owner');
    if (ownerUser) {
      await this.users.remove(ownerUser.id);
    }
    console.warn('%c[seed] 👤 كاشير: admin / admin123', 'font-size:14px;font-weight:bold');

    const settings = await this.settings.get();
    if (settings._seeded) return;

    const cats = await this.categories.all();
    if (cats.length === 0) {
            const defaults = [
        { slug: 'sandwiches', name: 'ساندوتشات', order: 1 },
        { slug: 'meals', name: 'وجبات', order: 2 },
        { slug: 'grills', name: 'مشويات', order: 3 },
        { slug: 'appetizers', name: 'مقبلات', order: 4 },
        { slug: 'drinks', name: 'مشروبات', order: 5 },
        { slug: 'desserts', name: 'حلويات', order: 6 }
      ];
      for (const c of defaults) {
        await this.categories.add(c);
      }
    }

    const employees = await this.employees.all();
    if (employees.length === 0) {
      await this.employees.add({ id: 'e1', name: 'أحمد موظف', job: 'ويتر', phone: '01012345678', salary: '3000', hireDate: '2025-01-15', status: 'active', pin: '1234' });
      await this.employees.add({ id: 'e2', name: 'محمد موظف', job: 'شيف', phone: '01198765432', salary: '5000', hireDate: '2025-02-01', status: 'active', pin: '5678' });
    }

    const tables = await this.tables.all();
    if (tables.length === 0) {
      for (let i = 1; i <= 12; i++) {
        await this.tables.add({ id: 't' + i, name: 'طاولة ' + i, capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6, status: 'available', currentOrder: null, hasService: i > 6 });
      }
    }

    const customers = await this.customers.all();
    if (customers.length === 0) {
      await this.customers.add({ id: 'c1', name: 'أحمد محمد', phone: '01012345678', totalSpent: 1200, visits: 15, lastVisit: FB.nowISO() });
      await this.customers.add({ id: 'c2', name: 'محمد علي', phone: '01198765432', totalSpent: 850, visits: 8, lastVisit: FB.nowISO() });
    }

    const inventory = await this.inventory.all();
    if (inventory.length === 0) {
      await this.inventory.add({ id: 'i1', name: 'قهوة تركية', category: 'قهوة', quantity: 50, unit: 'كجم', minQuantity: 10 });
      await this.inventory.add({ id: 'i2', name: 'حليب', category: 'ألبان', quantity: 30, unit: 'لتر', minQuantity: 5 });
      await this.inventory.add({ id: 'i3', name: 'سكر', category: 'مواد جافة', quantity: 100, unit: 'كجم', minQuantity: 20 });
    }

    const products = await this.products.all();
    if (products.length === 0) {
            const raw = 'rt1^ساندوتش شاورما^Shawarma Sandwich^sandwiches^60^|rt2^ساندوتش كبدة^Liver Sandwich^sandwiches^50^|rt3^ساندوتش جبنة مشوية^Grilled Cheese^sandwiches^40^|rt4^ساندوتش بطاطس^Potato Sandwich^sandwiches^30^|rt5^ساندوتش سجق^Sausage Sandwich^sandwiches^55^|rt6^ساندوتش فلافل^Falafel Sandwich^sandwiches^35^|rt7^وجبة شاورما^Shawarma Meal^meals^120^|rt8^وجبة كبدة^Liver Meal^meals^100^|rt9^وجبة مشكلة^Mixed Meal^meals^140^|rt10^وجبة فراخ^Chicken Meal^meals^130^|rt11^فراخ مشوية^Grilled Chicken^grills^150^|rt12^كفتة مشوية^Grilled Kofta^grills^90^|rt13^شيش طاووق^Shish Tawook^grills^130^|rt14^ريش ضاني^Lamb Chops^grills^180^|rt15^بطاطس مقلي^French Fries^appetizers^45^|rt16^سلطة خضراء^Green Salad^appetizers^40^|rt17^حمص^Hummus^appetizers^35^|rt18^بابا غنوج^Baba Ganoush^appetizers^35^|rt19^مياه^Water^drinks^10^|rt20^مشروب غازي^Soft Drink^drinks^25^|rt21^عصير برتقال^Orange Juice^drinks^40^|rt22^شاي^Tea^drinks^15^|rt23^قهوة^Coffee^drinks^25^|rt24^تشيز كيك^Cheesecake^desserts^90^|rt25^أم علي^Om Ali^desserts^60^|rt26^كنافة^Kunafa^desserts^70^';
      const descMap = {};
      const prods = raw.split('|').map(s => {
        const [id, name, nameEn, category, price, image] = s.split('^');
        return { id, name, nameEn, category, price: Number(price), image: image || '', description: descMap[id] || '', available: 1 };
      });
      for (const p of prods) {
        await this.products.add(p);
      }
    }
    await this.migrateProductDescriptions();
    await this.settings.save({ _seeded: true });
  }
};
