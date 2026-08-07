const RT_FB = (() => {
  let db;
  let uid = null;

  async function init() {
    if (db) return;
    const app = firebase.initializeApp(RT_FIREBASE_CONFIG, 'rt');
    db = firebase.firestore(app);
    db.settings({ merge: true });
    try {
      const cred = await firebase.auth(app).signInAnonymously();
      uid = cred.user.uid;
    } catch (e) {
      console.warn('[rt-firebase] anonymous auth failed:', e.message);
    }
  }

  async function ensure() { if (!db) await init(); startClockSync(); }

  function docId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2);
  }

  // ── Server clock sync: لا نعتمد على ساعة الجهاز ──
  let _clockOffset = null;
  let _clockStarted = false;

  async function syncClock() {
    try {
      await ensure();
      const probeRef = db.collection('rt_audit_logs').doc('rt_clock_probe_' + (uid || 'anon'));
      await probeRef.set({ t: firebase.firestore.FieldValue.serverTimestamp() });
      const snap = await probeRef.get();
      try { await probeRef.delete(); } catch (e) { /* البقايا تتستبدل في المزامنة التالية */ }
      const t = snap.get('t');
      if (t && t.toDate) _clockOffset = t.toDate().getTime() - Date.now();
    } catch (e) { console.warn('[rt-clock] sync failed:', e); _clockOffset = 0; }
    return _clockOffset;
  }

  function startClockSync() {
    if (_clockStarted) return;
    _clockStarted = true;
    syncClock();
    setInterval(syncClock, 5 * 60 * 1000);
  }

  function clockNow() { return new Date(Date.now() + (_clockOffset || 0)); }
  function nowISO() { return clockNow().toISOString(); }

  async function getCollection(name) {
    await ensure();
    const snap = await db.collection(name).orderBy('__name__', 'asc').get();
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return items;
  }

  async function addDoc(name, data) {
    await ensure();
    const id = data.id || docId();
    const obj = { ...data, id };
    if (uid) obj._uid = uid;
    await db.collection(name).doc(id).set(obj);
    return obj;
  }

  async function updateDoc(name, id, data) {
    await ensure();
    await db.collection(name).doc(id).update(data);
  }

  async function removeDoc(name, id) {
    await ensure();
    await db.collection(name).doc(id).delete();
  }

  async function onCollection(name, callback) {
    await ensure();
    return db.collection(name).orderBy('__name__', 'asc').onSnapshot(snap => {
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      callback(items);
    });
  }

  function getUid() { return uid; }
  function getDb() { return db; }

  return { getCollection, addDoc, updateDoc, removeDoc, onCollection, getUid, getDb, syncClock, clockNow, nowISO };
})();
