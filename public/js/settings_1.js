/* ══ Settings ══ */

/* ─── Патч: додаємо Гранти до списку блоків дозволів ─── */
(function patchGrantflowBlock() {
  function tryPatch() {
    if (typeof PERM_BLOCKS !== 'undefined') {
      var has = PERM_BLOCKS.some(function(b) { return b.key === 'grantflow'; });
      if (!has) PERM_BLOCKS.push({ key: 'grantflow', label: '🔍 Гранти' });
    } else {
      setTimeout(tryPatch, 100);
    }
  }
  tryPatch();
})();

/* ─── SETTINGS ─── */
function togTheme(){document.body.classList.toggle('light');var on=document.body.classList.contains('light');localStorage.setItem('k4_theme',on?'light':'dark');el('tT').classList.toggle('on',on)}

function togglePush(){if(!PU){if('Notification' in window){Notification.requestPermission().then(function(p){if(p==='granted'){PU=true;localStorage.setItem('k4_push','1');el('tP').classList.add('on');toast('🔔')}else toast('⚠️')})}else toast('⚠️')}else{PU=false;localStorage.setItem('k4_push','0');el('tP').classList.remove('on');toast('🔕')}}

function chkRem(){if(!PU||!D.length)return;var now=new Date();D.forEach(function(d){if(d.done)return;var dl=pD(d.deadline);if(!dl)return;var rems=String(d.reminder||'').split(',');rems.forEach(function(s){var rm=parseInt(s.trim());if(isNaN(rm))return;var diff=(dl-now)/864e5;var key=d.row+'_'+rm;if(diff>=0&&diff<=rm&&!NF[key]){NF[key]=true;if(Notification.permission==='granted'){var body='📄 '+(d.name||d.desc||'Документ')+'\n⏰ Термін: '+fD(d.deadline)+'\n📝 '+(d.task||'').substring(0,80);var n=new Notification('📋 Контролі — '+Math.round(diff)+' дн.',{body:body,tag:'k-'+d.row+'-'+rm,icon:'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📋</text></svg>'});n.onclick=function(){window.focus();showDocDet(d.row);n.close()}}}})})}

function saveAPI(){toast('\u2705 Firebase \u043f\u0456\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u043e')}

function testMail(){var e=el('sE').value.trim();if(!e)return;localStorage.setItem('k4_email',e);apiP({action:'testEmail',email:e}).then(function(r){toast(r.ok?'📧':'❌ '+(r.error||''))}).catch(function(e){toast('❌')})}

function doBkp(){apiP({action:'backup'}).then(function(r){toast(r.ok?'💾':'❌')}).catch(function(){toast('❌')})}


/* ─── TEMPLATES ─── */
function openTemplates(){var h='<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">📄 Шаблони</h2>';if(!TP.length)h+='<div class="empty">Немає</div>';else TP.forEach(function(t,i){h+='<div style="display:flex;align-items:center;gap:5px;padding:7px;background:var(--bg);border-radius:var(--r2);margin-bottom:3px;cursor:pointer" onclick="useTpl('+i+')"><span style="flex:1;font-size:.78rem">'+esc(t.name||t.type||'#'+(i+1))+'</span><span style="color:var(--red);cursor:pointer" onclick="event.stopPropagation();delTpl('+i+')">🗑</span></div>'});h+='<div class="btn-row"><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';el('rpc').innerHTML=h;openP()}

function saveTpl(){var rmArr=[];document.querySelectorAll('#df-rm input:checked').forEach(function(e){rmArr.push(e.value)});var tags=[];document.querySelectorAll('#df-tg .tchip.on').forEach(function(e){tags.push(e.getAttribute('data-tag'))});var t={type:el('df-tp').value,from:el('df-fr').value,name:el('df-nm').value,desc:el('df-ds').value,executor:el('df-ex').value,reportTo:el('df-rp').value,email:el('df-em').value,reminder:rmArr.join(','),recurring:el('df-rc').value,tags:tags};TP.push(t);localStorage.setItem('k4_tp',JSON.stringify(TP));toast('📄')}

function useTpl(i){closeP();setTimeout(function(){openNewDoc(TP[i])},200)}

function delTpl(i){TP.splice(i,1);localStorage.setItem('k4_tp',JSON.stringify(TP));openTemplates()}


/* ─── DEFAULT REMINDERS SETTING ─── */
function saveDefReminders() {
  var vals = [];
  document.querySelectorAll('#set-def-rem input:checked').forEach(function(e) { vals.push(e.value); });
  localStorage.setItem('k4_def_rem', vals.join(','));
  toast('✅ Нагадування збережено: ' + vals.join(','));
}


function loadUsers() {
  if (!hasPerm('users', 'read')) { el('user-mgmt').style.display = 'none'; return; }
  apiP({action:'getUsers'}).then(function(r) {
    if (!r.ok) return;
    var h = '';
    (r.users || []).forEach(function(u) {
      var stC = u.status === 'active' ? 'var(--grn)' : 'var(--red)';
      h += '<div style="display:flex;align-items:center;gap:6px;padding:6px;background:var(--bg);border-radius:var(--r2);margin-bottom:3px;font-size:.76rem">';
      h += '<span style="color:' + stC + '">●</span>';
      h += '<b style="flex:1">' + esc(u.name || u.login) + '</b>';
      h += '<span style="color:var(--tx3);font-size:.65rem">' + esc(u.role) + '</span>';
      h += '<button class="btn btn-s btn-sm" style="font-size:.6rem" onclick="openEditUser(\x27' + u.row + '\x27,\'' + esc(u.login) + '\')">✏️</button>';
      h += '</div>';
    });
    el('users-list').innerHTML = h || '<span style="color:var(--tx3);font-size:.72rem">Немає</span>';
  });
}


function openAddUser() {
  if (!hasPerm('users', 'full')) { toast('⚠️ Немає прав'); return; }
  var h = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">👤 Новий користувач</h2>';
  h += '<input type="hidden" id="uf-row" value="">';
  h += '<div class="fg"><label>&#1051;&#1086;&#1075;&#1110;&#1085;</label><input type="text" id="uf-login" placeholder="login"></div>';
  h += '<div class="fg"><label>&#1055;&#1072;&#1088;&#1086;&#1083;&#1100;</label><input type="password" id="uf-pass"></div>';
  h += '<div class="fg"><label>ПІБ</label><input type="text" id="uf-name"></div>';
  h += '<div class="fg"><label>Роль (назва)</label><input type="text" id="uf-role" value="Читач" placeholder="Читач / Редактор / Адмін"></div>';
  h += '<div class="fg"><label>Статус</label><select id="uf-status"><option value="active">Активний</option><option value="blocked">Заблокований</option></select></div>';
  h += '<div class="fg"><label>Дозволи по блокам:</label>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">';
  PERM_BLOCKS.forEach(function(b) {
    h += '<div style="font-size:.72rem;display:flex;align-items:center;gap:3px"><span style="min-width:90px">' + b.label + '</span><select id="uf-p-' + b.key + '" style="font-size:.68rem;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:2px;border-radius:var(--r2)">';
    PERM_LEVELS.forEach(function(l) { h += '<option value="' + l + '">' + PERM_LABELS[l] + '</option>'; });
    h += '</select></div>';
  });
  h += '</div></div>';
  h += '<div class="btn-row"><button class="btn btn-p" onclick="saveUser()">💾 Зберегти</button><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';
  el('rpc').innerHTML = h; openP();
}


function openEditUser(row, login) {
  openAddUser();
  el('uf-row').value = row;
  el('uf-login').value = login;
  el('uf-login').disabled = true;
  el('uf-pass').placeholder = '(залишити порожнім щоб не міняти)';
  // Load user data
  apiP({action:'getUsers'}).then(function(r) {
    if (!r.ok) return;
    var u = null; (r.users || []).forEach(function(usr) { if (usr.row == row) u = usr; });
    if (!u) return;
    el('uf-name').value = u.name || '';
    el('uf-role').value = u.role || '';
    el('uf-status').value = u.status || 'active';
    try {
      var perms = JSON.parse(u.perms || '{}');
      PERM_BLOCKS.forEach(function(b) { var s = el('uf-p-' + b.key); if (s) s.value = perms[b.key] || 'none'; });
    } catch(e) {}
  });
}


function saveUser() {
  var row = el('uf-row').value;
  var perms = {};
  PERM_BLOCKS.forEach(function(b) { var s = el('uf-p-' + b.key); if (s) perms[b.key] = s.value; });
  var data = {
    action: row ? 'editUser' : 'addUser',
    row: row || undefined,
    login: el('uf-login').value.trim(),
    password: el('uf-pass').value || undefined,
    name: el('uf-name').value.trim(),
    role: el('uf-role').value.trim(),
    status: el('uf-status').value,
    perms: JSON.stringify(perms)
  };
  if (!row && !data.login) { toast('⚠️ Вкажіть логін'); return; }
  if (!row && !data.password) { toast('⚠️ Вкажіть пароль'); return; }
  toast('💾...');
  apiP(data).then(function(r) {
    if (r.ok) { toast('✅ Збережено'); closeP(); loadUsers(); }
    else toast('❌ ' + (r.error || ''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}


/* ═══ DELETE APPROVAL ═══ */
function loadPendingDeletes() {
  if (!hasPerm('users', 'full')) { el('pending-del').style.display = 'none'; return; }
  apiP({action:'getPendingDeletes'}).then(function(r) {
    if (!r.ok) return;
    var h = '';
    (r.pending || []).forEach(function(p) {
      h += '<div style="display:flex;align-items:center;gap:6px;padding:6px;background:rgba(239,68,68,.1);border:1px solid var(--red);border-radius:var(--r2);margin-bottom:3px;font-size:.74rem">';
      h += '<span style="flex:1">🗑 <b>' + esc(p.name || '—') + '</b> (' + esc(p.type) + ' від ' + esc(p.from) + ')</span>';
      h += '<button class="btn btn-p btn-sm" style="font-size:.6rem;background:var(--red)" onclick="approveDelDoc(\x27' + p.row + '\x27)">✅ Погодити</button>';
      h += '<button class="btn btn-s btn-sm" style="font-size:.6rem" onclick="rejectDelDoc(\x27' + p.row + '\x27)">✕</button>';
      h += '</div>';
    });
    el('pending-list').innerHTML = h || '<span style="color:var(--tx3);font-size:.72rem">Немає запитів</span>';
  });
}


function approveDelDoc(row) {
  if (!confirm('Видалити документ #' + row + '?')) return;
  apiP({action:'approveDelete', row:row}).then(function(r) {
    if (r.ok) { toast('🗑 Видалено'); loadPendingDeletes(); loadData(); }
    else toast('❌ ' + (r.error || ''));
  });
}


function rejectDelDoc(row) {
  toast('✕ Відхилено');
  loadPendingDeletes();
}


/* ═══ ACTIVITY LOG ═══ */
function logAction(action, details, docRow) {
  if (!CUR_USER) return;
  apiP({action:'writeLog', user:CUR_USER.login, action:action, details:details, docRow:docRow||''}).catch(function(){});
}


function loadLog() {
  apiP({action:'getLog', limit:200}).then(function(r) {
    if (!r.ok) return;
    var h = '<table style="width:100%;border-collapse:collapse;font-size:.68rem"><tr style="background:var(--bg3);font-weight:700"><td style="padding:3px">Дата</td><td>Хто</td><td>Дія</td><td>Деталі</td></tr>';
    (r.log || []).forEach(function(l) {
      h += '<tr style="border-bottom:1px solid var(--brd)"><td style="padding:2px;white-space:nowrap">' + esc(l.date) + '</td><td>' + esc(l.user) + '</td><td>' + esc(l.action) + '</td><td>' + esc(l.details).substring(0,60) + '</td></tr>';
    });
    h += '</table>';
    el('log-list').innerHTML = h;
  });
}

