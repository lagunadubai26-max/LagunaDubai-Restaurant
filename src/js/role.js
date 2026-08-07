(function() {
  var user;
  try { user = JSON.parse(sessionStorage.getItem('laguna_user')); } catch(e) { return; }
  if (!user) return;
  var role = user.role || 'Admin';

  var page = window.location.pathname.split('/').pop();
  var employeeRestricted = ['employees.html','customers.html','qr.html','settings.html','products.html'];

  if (role === 'Owner') role = 'Admin';
  if (role === 'Employee' && employeeRestricted.includes(page)) { window.location.replace('index.html'); return; }

  var avatar = document.getElementById('sidebarAvatar');
  var name = document.getElementById('sidebarName');
  var roleEl = document.getElementById('sidebarRole');
  if (avatar) avatar.textContent = user.name.charAt(0);
  if (name) name.textContent = user.name;
  if (roleEl) {
    if (role === 'Admin') roleEl.textContent = 'كاشير';
    else roleEl.textContent = 'موظف';
  }

  var uidEl = document.getElementById('sidebarUid');
  if (uidEl) {
    var uid = FB.getUid();
    if (uid) {
      uidEl.textContent = 'UID: ' + uid.slice(0, 8) + '...';
      uidEl.title = uid;
    }
  }
  if (role === 'Employee') {
    document.querySelectorAll('.sidebar nav a.no-employee').forEach(function(el) { el.style.display = 'none'; });
  }
  var toggle = document.getElementById('sidebarToggle');
  var overlay = document.getElementById('sidebarOverlay');
  var sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar && overlay) {
    function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
    toggle.onclick = function() { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); };
    overlay.onclick = closeSidebar;
    document.querySelectorAll('.sidebar nav a').forEach(function(a) { a.onclick = closeSidebar; });
  }
  var h4 = document.querySelector('.profile h4');
  var span = document.querySelector('.profile span');
  if (h4) h4.textContent = user.name;
  if (span) {
    if (role === 'Admin') span.textContent = 'كاشير';
    else span.textContent = 'موظف';
  }

  // Verify user has a mapping in user_mappings collection
  (async function() {
    try {
      var firebaseUid = FB && FB.getUid ? FB.getUid() : null;
      if (!firebaseUid) return;
      var snap = await FB.getDb().collection('user_mappings').doc(firebaseUid).get();
      if (!snap.exists) {
        var allUsers = await DB.users.all();
        if (allUsers.length > 0) {
          sessionStorage.removeItem('laguna_user');
          sessionStorage.removeItem('laguna_token');
          window.location.replace('auth.html');
        }
      }
    } catch(e) {}
  })();
})();
