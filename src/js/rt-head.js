(function(){
  try {
    var u = JSON.parse(sessionStorage.getItem('rt_user'));
    if (!u) return;

    // ── Session expiry check ──
    var lastActive = Number(sessionStorage.getItem('rt_last_active')) || 0;
    var sessionStart = Number(sessionStorage.getItem('rt_session_start')) || 0;
    var now = Date.now();
    var INACTIVITY_MS = 2 * 60 * 60 * 1000;
    var MAX_SESSION_MS = 8 * 60 * 60 * 1000;
    if ((now - lastActive > INACTIVITY_MS) || (sessionStart > 0 && now - sessionStart > MAX_SESSION_MS)) {
      clearRtSession();
      if (window.location.pathname.indexOf('rt-login.html') === -1) {
        window.location.replace('rt-login.html');
      }
      return;
    }
    sessionStorage.setItem('rt_last_active', String(now));
    if (!sessionStart) sessionStorage.setItem('rt_session_start', String(now));
  } catch(e){
    console.warn('[rt-head]', e);
  }
})();

function clearRtSession() {
  try {
    sessionStorage.removeItem('rt_user');
    sessionStorage.removeItem('rt_token');
    sessionStorage.removeItem('rt_session_start');
    sessionStorage.removeItem('rt_last_active');
  } catch(e) {}
}
