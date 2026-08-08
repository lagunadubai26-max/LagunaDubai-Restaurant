(function(){
  try {
    // ── Page entrance stagger (runs before session checks) ──
    document.addEventListener('DOMContentLoaded', function () {
      try {
        var main = document.querySelector('.main');
        if (!main) return;
        var kids = main.children;
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].classList) {
            kids[i].classList.add('anim-in');
            kids[i].style.animationDelay = Math.min(0.08 * i, 0.45) + 's';
          }
        }
      } catch (e) {}
    });

    var u = JSON.parse(sessionStorage.getItem('laguna_rest_user'));
    if (!u) return;

    // ── Session expiry check ──
    var lastActive = Number(sessionStorage.getItem('laguna_rest_last_active')) || 0;
    var sessionStart = Number(sessionStorage.getItem('laguna_rest_session_start')) || 0;
    var now = Date.now();
    var INACTIVITY_MS = 2 * 60 * 60 * 1000;
    var MAX_SESSION_MS = 8 * 60 * 60 * 1000;
    if ((now - lastActive > INACTIVITY_MS) || (sessionStart > 0 && now - sessionStart > MAX_SESSION_MS)) {
      sessionStorage.removeItem('laguna_rest_user');
      sessionStorage.removeItem('laguna_rest_token');
      sessionStorage.removeItem('laguna_rest_session_start');
      sessionStorage.removeItem('laguna_rest_last_active');
      if (window.location.pathname.indexOf('auth.html') === -1) {
        window.location.replace('auth.html');
      }
      return;
    }
    sessionStorage.setItem('laguna_rest_last_active', String(now));
    if (!sessionStart) sessionStorage.setItem('laguna_rest_session_start', String(now));

    var role = u.role;
    if (role === 'Admin') return;
    if (role === 'Owner') role = 'Admin';
    var s = document.createElement('style');
    var rules = [];
    if (role === 'Employee') {
      rules.push('.sidebar nav a.admin-only{display:none!important}');
      rules.push('.sidebar nav a.no-employee{display:none!important}');
    }
    rules.push('#dashDayCloseBtn{display:none!important}');
    s.textContent = rules.join('');
    document.head.appendChild(s);
  } catch(e){
    console.warn('[role-head]', e);
  }
})();
