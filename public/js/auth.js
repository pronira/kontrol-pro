/* ══ Auth ══ */
var LOGIN_FAILS = 0;

function doLogin() {
  var user = el('lg-user').value.trim();
  var pass = el('lg-pass').value;
  if (!user || !pass) { el('lg-err').textContent = 'Введіть логін і пароль'; return; }
  el('lg-err').textContent = '⏳ Перевірка...';
  el('lg-err').style.color = 'var(--tx3)';
  apiP({action:'login', login:user, password:pass}).then(function(r) {
    if (r.ok && r.user) {
      CUR_USER = r.user;
      try { PERMS = JSON.parse(CUR_USER.perms || '{}'); } catch(e) { PERMS = {}; }
      localStorage.setItem('k4_user', JSON.stringify(CUR_USER));
      el('lg-err').textContent = '';
      LOGIN_FAILS = 0;
      startApp();
    } else {
      LOGIN_FAILS++;
      el('lg-err').style.color = 'var(--red)';
      el('lg-err').textContent = r.error || 'Помилка входу';
      if (LOGIN_FAILS >= 3) el('lg-reset-btn').style.display = '';
    }
  }).catch(function(e) {
    LOGIN_FAILS++;
    el('lg-err').style.color = 'var(--red)';
    el('lg-err').textContent = '❌ ' + e.message;
    if (LOGIN_FAILS >= 3) el('lg-reset-btn').style.display = '';
  });
}


function doGoogleLogin() {
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).then(function(result) {
    var gUser = result.user;
    // Check if this Google user exists in our users collection
    db.collection('users').where('email', '==', gUser.email).get().then(function(snap) {
      if (snap.empty) {
        // Auto-create user with viewer role
        var newUser = {login: gUser.email, name: gUser.displayName || gUser.email, role: 'viewer', status: 'active', perms: '{}', email: gUser.email, authUid: gUser.uid};
        db.collection('users').doc(gUser.uid).set(newUser).then(function() {
          CUR_USER = {row: gUser.uid, login: gUser.email, name: gUser.displayName || gUser.email, role: 'viewer', status: 'active', perms: '{}'};
          PERMS = {};
          localStorage.setItem('k4_user', JSON.stringify(CUR_USER));
          startApp();
          toast('👤 Вітаємо, ' + CUR_USER.name + '! Роль: viewer. Зверніться до адміністратора для зміни ролі.');
        });
      } else {
        var uDoc = snap.docs[0];
        var uData = uDoc.data();
        CUR_USER = {row: uDoc.id, login: uData.login || gUser.email, name: uData.name || gUser.displayName, role: uData.role || 'viewer', status: uData.status || 'active', perms: uData.perms || '{}'};
        try { PERMS = JSON.parse(CUR_USER.perms || '{}'); } catch(e) { PERMS = {}; }
        localStorage.setItem('k4_user', JSON.stringify(CUR_USER));
        startApp();
      }
    });
  }).catch(function(e) {
    if (e.code === 'auth/popup-closed-by-user') return;
    if (e.code === 'auth/operation-not-allowed') {
      el('lg-err').style.color = 'var(--orn)';
      el('lg-err').textContent = 'Google Auth не увімкнено. Firebase Console → Authentication → Sign-in method → Google → Enable';
    } else {
      el('lg-err').style.color = 'var(--red)';
      el('lg-err').textContent = '❌ ' + e.message;
    }
  });
}


function resetAdminPwd() {
  var key = prompt('Введіть секретний ключ для скидання:');
  if (!key) return;
  el('lg-err').textContent = '⏳ Скидаю...';
  el('lg-err').style.color = 'var(--tx3)';
  apiP({action:'resetAdmin', secret:key}).then(function(r) {
    if (r.ok) {
      el('lg-err').style.color = 'var(--grn)';
      el('lg-err').textContent = '✅ ' + (r.message || 'Скинуто! admin / admin');
      el('lg-user').value = 'admin';
      el('lg-pass').value = 'admin';
    } else {
      el('lg-err').style.color = 'var(--red)';
      el('lg-err').textContent = '❌ ' + (r.error || 'Невірний ключ');
    }
  }).catch(function(e) { el('lg-err').style.color='var(--red)'; el('lg-err').textContent='❌ '+e.message; });
}


function logout() {
  saveSettingsToFirestore();
  CUR_USER = null; PERMS = {};
  localStorage.removeItem('k4_user');
  if (window._ivRem) { clearInterval(window._ivRem); window._ivRem = null; }
  if (window._ivLogout) { clearInterval(window._ivLogout); window._ivLogout = null; }
  if (_settingsSyncTimer) { clearInterval(_settingsSyncTimer); _settingsSyncTimer = null; }
  el('login-screen').style.display = 'flex';
  el('main-area').style.display = 'none';
  document.querySelector('.sidebar').style.display = 'none';
}


function startApp() {
  el('login-screen').style.display = 'none';
  el('main-area').style.display = '';
  document.querySelector('.sidebar').style.display = '';
  applyPermissions();
  loadData();
  showTab('myday');
  window._ivRem = setInterval(chkRem, 60000);
  renderTC();
  if (CUR_USER) {
    el('user-info').textContent = '👤 ' + (CUR_USER.name || CUR_USER.login);
    el('logout-btn').style.display = '';
  }
  localStorage.setItem('k4_last_activity', Date.now());
  window._ivLogout = setInterval(checkAutoLogout, 60000);
  document.addEventListener('click', function() { localStorage.setItem('k4_last_activity', Date.now()); });
  document.addEventListener('keydown', function() { localStorage.setItem('k4_last_activity', Date.now()); });
  startSettingsSync();
}


function checkAutoLogout() {
  var last = parseInt(localStorage.getItem('k4_last_activity') || '0');
  if (Date.now() - last > 8 * 3600000) { // 8 hours
    toast('⏰ Сесія закінчилась');
    setTimeout(logout, 1500);
  }
}


function hasPerm(block, level) {
  // block: docs, orgs, comms, reports, settings, users, inbox, myday, calendar
  // level: read, create, edit, delete, full
  if (!CUR_USER) return false;
  // Admin role has full access to everything
  if (CUR_USER.role === 'admin') return true;
  var p = PERMS[block];
  if (p === 'full') return true;
  if (p === 'edit' && (level === 'read' || level === 'create' || level === 'edit')) return true;
  if (p === 'create' && (level === 'read' || level === 'create')) return true;
  if (p === 'read' && level === 'read') return true;
  return false;
}


function applyPermissions() {
  // Hide tabs based on permissions
  // docs та myday — завжди видимі для всіх авторизованих
  var tabMap = {main:'docs', inbox:'inbox', myday:'myday', calendar:'calendar', orgs:'orgs', comms:'comms', reports:'reports', settings:'settings', grantflow:'grantflow'};
  var alwaysVisible = ['docs', 'myday'];
  document.querySelectorAll('.nav-btn[data-t]').forEach(function(btn) {
    var t = btn.getAttribute('data-t');
    var block = tabMap[t] || t;
    if (alwaysVisible.indexOf(block) >= 0) {
      btn.style.display = '';
      return;
    }
    // Для адміна — все видиме
    if (CUR_USER && CUR_USER.role === 'admin') {
      btn.style.display = '';
      return;
    }
    // Для решти — приховуємо якщо немає дозволу
    if (!hasPerm(block, 'read')) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  });
}
