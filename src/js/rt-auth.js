;(async () => {
  // زرع القائمة الافتراضية في الخلفية — لا يمنع الدخول أبدًا
  RT_DB.seedDefaults().catch(function(e) { console.error('[rt-auth] seed error:', e); });

  const stored = sessionStorage.getItem('rt_user');
  if (stored) try { const u = JSON.parse(stored); if (u && u.id) { window.location.href = 'rt.html'; return; } } catch (e) {}

  const loginBtn = document.getElementById('loginBtn');
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const errorEl = document.getElementById('authError');

  const BLOCK_MULTIPLIERS = [1, 2, 4, 10, 20];
  const BASE_BLOCK_MS = 30000;
  const SECRET_PREFIX = 'rt_lgn_2026_';

  var _memoryBlockedUntil = 0;
  var _memoryAttempts = 0;

  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return h.toString(36);
  }

  function tamperCheck(state) {
    if (!state || typeof state.count !== 'number' || typeof state.blockedUntil !== 'number') return false;
    var expected = simpleHash(SECRET_PREFIX + state.count + ':' + state.level + ':' + state.blockedUntil);
    return state._h === expected;
  }

  function sealState(s) {
    s._h = simpleHash(SECRET_PREFIX + s.count + ':' + s.level + ':' + s.blockedUntil);
    return s;
  }

  function getLoginState() {
    var best = { count: 0, blockedUntil: 0, level: 0, _h: '' };
    try {
      var raw = localStorage.getItem('rt_login_lockout');
      if (raw) {
        var s = JSON.parse(raw);
        if (tamperCheck(s)) {
          if (s.blockedUntil > best.blockedUntil) best = s;
        }
      }
    } catch (e) {}
    if (_memoryBlockedUntil > best.blockedUntil) {
      best.blockedUntil = _memoryBlockedUntil;
      best.count = _memoryAttempts;
    }
    return best;
  }

  function saveLoginState(s) {
    var sealed = sealState(s);
    try { localStorage.setItem('rt_login_lockout', JSON.stringify(sealed)); } catch (e) {}
    _memoryBlockedUntil = s.blockedUntil;
    _memoryAttempts = s.count;
  }

  function showError(el, msg) { el.textContent = msg; el.style.display = 'block'; }
  function hideError(el) { el.textContent = ''; el.style.display = 'none'; }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.innerHTML = loading ? '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...' : (btn.dataset.original || btn.innerHTML);
    if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
  }

  async function auditLogin(username, success, reason) {
    try {
      await RT_FB.getDb().collection('rt_audit_logs').add({
        type: 'login',
        username: username,
        success: success,
        reason: reason || '',
        timestamp: RT_FB.nowISO()
      });
    } catch (e) { console.warn('[rt-auth] audit error:', e); }
  }

  loginBtn.onclick = async () => {
    var loginState = getLoginState();
    if (Date.now() < loginState.blockedUntil) {
      var wait = Math.ceil((loginState.blockedUntil - Date.now()) / 1000);
      showError(errorEl, 'حاول مرة أخرى بعد ' + wait + ' ثانية');
      return;
    }
    hideError(errorEl);
    var u = username.value.trim();
    var p = password.value.trim();
    if (!u || !p) { showError(errorEl, 'يرجى إدخال اسم المستخدم وكلمة المرور'); return; }
    setLoading(loginBtn, true);

    var startTime = Date.now();
    loginState.count++;
    var level = Math.min(loginState.level || 0, BLOCK_MULTIPLIERS.length - 1);
    if (loginState.count >= 5) {
      var blockMs = BASE_BLOCK_MS * BLOCK_MULTIPLIERS[level];
      loginState.blockedUntil = Date.now() + blockMs;
      loginState.count = 0;
      loginState.level = level + 1;
    }
    saveLoginState(loginState);

    var users = await RT_DB.users.all() || [];
    var user = users.find(x => x.username === u);
    var passwordOk = false;
    if (user) {
      passwordOk = await PASSWORD_UTILS.verify(p, user.password);
      if (passwordOk && !PASSWORD_UTILS.isHashed(user.password)) {
        var hashed = await PASSWORD_UTILS.hash(p);
        await RT_DB.users.update(user.id, { password: hashed }).catch(function() {});
      }
    }

    var elapsed = Date.now() - startTime;
    if (elapsed < 800) await new Promise(function(r) { setTimeout(r, 800 - elapsed); });

    if (user && passwordOk) {
      saveLoginState({ count: 0, blockedUntil: 0, level: 0 });
      auditLogin(u, true, '');
      sessionStorage.setItem('rt_token', user.id);
      sessionStorage.setItem('rt_user', JSON.stringify({ id: user.id, username: user.username, name: user.name, role: user.role }));
      sessionStorage.setItem('rt_session_start', String(Date.now()));
      sessionStorage.setItem('rt_last_active', String(Date.now()));
      window.location.href = 'rt.html';
    } else {
      auditLogin(u, false, user ? 'كلمة مرور خاطئة' : 'مستخدم غير موجود');
      showError(errorEl, 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    setLoading(loginBtn, false);
  };

  username.addEventListener('keydown', function(e) { if (e.key === 'Enter') password.focus(); });
  password.addEventListener('keydown', function(e) { if (e.key === 'Enter') loginBtn.click(); });
})();
