/* ══ Init ══ */

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', function() {
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(function(){}); }
  if (localStorage.getItem('k4_theme') === 'light') { document.body.classList.add('light'); if(el('tT')) el('tT').classList.add('on'); }
  if (PU && el('tP')) el('tP').classList.add('on');
  if (localStorage.getItem('k4_tb') === '0') toggleTopbar();
  if (localStorage.getItem('k4_sb') === '0') toggleSidebar();
  // Firebase — no API URL needed
  el('sE').value = localStorage.getItem('k4_email') || '';
  var defR = (localStorage.getItem('k4_def_rem') || '7,5,3,1').split(',');
  var drC = el('set-def-rem');
  if (drC) { [{v:'7',l:'7 днів'},{v:'5',l:'5 днів'},{v:'3',l:'3 дні'},{v:'1',l:'1 день'},{v:'0',l:'В день'}].forEach(function(r){ drC.innerHTML += '<label style="display:flex;align-items:center;gap:2px;font-size:.78rem;cursor:pointer"><input type="checkbox" value="'+r.v+'"'+(defR.indexOf(r.v)>=0?' checked':'')+' style="accent-color:var(--acc)"> '+r.l+'</label>'; }); }
  el('f-df').value = '';
  try { var cached = localStorage.getItem('k4_orgs_cache'); if (cached) O = JSON.parse(cached); } catch(e) {}
  try { var st = JSON.parse(localStorage.getItem('k4_org_status')||'{}'); O.forEach(function(o){if(st[o.row]){o.status=st[o.row].status;o.statusNote=st[o.row].note}}); } catch(e) {}
  // Check saved session
  var savedUser = localStorage.getItem('k4_user');
  if (savedUser) {
    try { CUR_USER = JSON.parse(savedUser); PERMS = JSON.parse(CUR_USER.perms || '{}'); } catch(e) { CUR_USER = null; }
  }
  if (CUR_USER) {
    startApp();
  } else {
    localStorage.removeItem('k4_user');
    el('login-screen').style.display = 'flex';
    el('main-area').style.display = 'none';
    document.querySelector('.sidebar').style.display = 'none';
  }
});


/* ─── FILTERS ─── */

/* ─── INBOX FILTER ON MAIN ─── */

/* ─── INBOX TAB ─── */
var SELECTED = {};
/* ─── RENDER CARDS ─── */
var PAGE_SIZE = 50, CUR_PAGE = 0;

/* ─── DEACTIVATE / REACTIVATE SPECIALIST ─── */

/* ─── ORG UP/DOWN (local order) ─── */
var ORG_REORDER = false;

var CM_MY = false;

/* ═══ USER MANAGEMENT ═══ */
var PERM_BLOCKS = [
  {key:'docs', label:'📋 Документи'},
  {key:'inbox', label:'📨 Вхідні'},
  {key:'myday', label:'☀️ Мій день'},
  {key:'calendar', label:'📅 Календар'},
  {key:'orgs', label:'🏢 Організації'},
  {key:'comms', label:'👥 Комісії'},
  {key:'reports', label:'📊 Звіти'},
  {key:'settings', label:'⚙️ Налаштування'},
  {key:'users', label:'👥 Користувачі'}
];
var PERM_LEVELS = ['none','read','create','edit','full'];
var PERM_LABELS = {'none':'🚫 Немає','read':'👁 Читання','create':'＋ Створення','edit':'✏️ Редагування','full':'✅ Повний'};

/* ─── RECURRING LOGIC ─── */
