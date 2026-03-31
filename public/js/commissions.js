/* ══ Commissions ══ */

/* ═══ COMMISSIONS MODULE ═══ */
function renderComms() {
  var c = el('cm-list');
  var q = (el('cm-s').value || '').trim().toLowerCase();
  var ft = el('cm-ft') ? el('cm-ft').value : '';
  var fs = el('cm-fs') ? el('cm-fs').value : '';
  var fr = el('cm-fr') ? el('cm-fr').value : '';
  var onlyMy = el('cm-my') && el('cm-my').classList.contains('on');
  var myName = CUR_USER ? (CUR_USER.name || CUR_USER.login) : '';

  var filtered = COMMS.filter(function(cm) {
    if (ft && cm.commType !== ft) return false;
    if (fs && cm.status !== fs) return false;
    var searchText = [cm.name, cm.basis, cm.head, cm.deputy, cm.secretary, cm.members, cm.notes, cm.endReason].join(' ').toLowerCase();
    if (q && searchText.indexOf(q) < 0) {
      // Also search in members
      var mbrs = MBR.filter(function(m){return m.commUid===cm.uid});
      var mbrText = mbrs.map(function(m){return m.name+' '+m.role+' '+m.reasonOut}).join(' ').toLowerCase();
      if (mbrText.indexOf(q) < 0) return false;
    }
    // Role filter
    if (fr || onlyMy) {
      var myRole = getMyRole(cm);
      if (onlyMy && !myRole) return false;
      if (fr === 'head' && myRole !== 'Голова') return false;
      if (fr === 'deputy' && myRole !== 'Заступник') return false;
      if (fr === 'secretary' && myRole !== 'Секретар') return false;
      if (fr === 'member' && myRole !== 'Член') return false;
    }
    return true;
  });
  // Sort: my leadership first, then alphabetical
  filtered.sort(function(a,b) {
    var ra = roleOrder(getMyRole(a)), rb = roleOrder(getMyRole(b));
    if (ra !== rb) return ra - rb;
    return (a.name||'').localeCompare(b.name||'');
  });
  if (!filtered.length) { c.innerHTML = '<div class="empty"><div class="ei">👥</div>Немає комісій</div>'; return; }
  var now = new Date();
  var h = '';
  filtered.forEach(function(cm) {
    var meets = MT.filter(function(m) { return m.commUid === cm.uid; });
    var lastMeet = null, nextMeet = null;
    meets.forEach(function(m) {
      var md = pD(m.date); if (!md) return;
      if (md <= now) { if (!lastMeet || md > pD(lastMeet.date)) lastMeet = m; }
      if (md > now || m.status === 'Заплановано') { if (!nextMeet || md < pD(nextMeet.date)) nextMeet = m; }
    });
    // Calculate next meeting date from periodicity if no scheduled
    var nextDate = calcNextMeet(cm, lastMeet);
    var daysLeft = nextDate ? Math.ceil((nextDate - now) / 86400000) : null;
    var allDecs = DC.filter(function(d) { return d.commUid === cm.uid; });
    var overdueDecs = allDecs.filter(function(d) { return d.status !== 'Виконано' && d.status !== 'Знято з контролю' && d.deadline && pD(d.deadline) && pD(d.deadline) < now; });
    var myRole = getMyRole(cm);
    var stColor = cm.status === 'Активна' ? 'var(--grn)' : 'var(--red)';
    var isOverdue = daysLeft !== null && daysLeft < 0 && cm.status === 'Активна';
    h += '<div class="card" onclick="showCommDet(\'' + esc(cm.uid) + '\')" style="padding:12px' + (isOverdue ? ';border-left:3px solid var(--red)' : '') + '">';
    h += '<div class="card-top"><div class="card-title" style="font-size:.88rem">' + esc(cm.name) + '</div>';
    h += '<span class="card-badge" style="background:' + (cm.commType === 'Постійна' ? 'var(--acc)' : 'var(--vio)') + '">' + esc(cm.commType || '—') + '</span></div>';
    h += '<div class="card-sub">' + esc(cm.basis || '') + '</div>';
    h += '<div class="card-meta" style="flex-wrap:wrap">';
    h += '<span style="color:' + stColor + '">● ' + esc(cm.status) + '</span>';
    if (myRole) h += '<span style="color:var(--acc2)">⭐ ' + myRole + '</span>';
    if (cm.head) h += '<span>👤 ' + esc(cm.head) + '</span>';
    if (cm.dateCreated) h += '<span>📅 ' + esc(cm.dateCreated) + '</span>';
    if (lastMeet) h += '<span>🔙 ' + esc(lastMeet.date) + '</span>';
    if (nextDate) {
      var ndStr = p2(nextDate.getDate())+'.'+p2(nextDate.getMonth()+1)+'.'+nextDate.getFullYear();
      h += '<span style="color:' + (isOverdue ? 'var(--red)' : 'var(--orn)') + '">▶ ' + ndStr + (daysLeft !== null ? ' (' + daysLeft + 'д)' : '') + '</span>';
    }
    h += '<span>📋 ' + meets.length + ' засід.</span>';
    if (allDecs.length) h += '<span>📝 ' + allDecs.length + '</span>';
    if (overdueDecs.length) h += '<span style="color:var(--red)">🔴 ' + overdueDecs.length + ' простр.</span>';
    h += '</div></div>';
  });
  c.innerHTML = h;
}


function showCommDet(uid) {
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === uid) { cm = COMMS[i]; break; } } if (!cm) return;
  var meets = MT.filter(function(m) { return m.commUid === uid; }).sort(function(a, b) { return (pD(b.date) || 0) - (pD(a.date) || 0); });
  // Active members from MBR sheet
  var activeMembers = MBR.filter(function(m) { return m.commUid === uid && !m.dateOut; });
  var archivedMembers = MBR.filter(function(m) { return m.commUid === uid && m.dateOut; });
  // Legacy members from JSON field
  var legacyMembers = [];
  try { legacyMembers = JSON.parse(cm.members || '[]'); } catch(e) { if (cm.members) legacyMembers = cm.members.split(';').map(function(s){return {name:s.trim()}}); }
  var lastMeet = meets.length ? meets[0] : null;
  var nextDate = calcNextMeet(cm, lastMeet);
  var allDecs = DC.filter(function(d) { return d.commUid === uid; });
  var myRole = getMyRole(cm);

  var h = '<div style="margin-top:18px">';
  // Header
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:1.3rem">👥</span>';
  h += '<h2 style="font-size:1rem;font-weight:700">' + esc(cm.name) + '</h2>';
  if (myRole) h += '<span style="font-size:.7rem;background:var(--acc);color:#fff;padding:2px 6px;border-radius:10px">⭐ ' + myRole + '</span>';
  h += '</div>';

  // General info
  h += '<div style="font-size:.76rem;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px">';
  h += '<div>Тип: <b>' + esc(cm.commType) + '</b></div>';
  h += '<div>Статус: <b style="color:' + (cm.status === 'Активна' ? 'var(--grn)' : 'var(--red)') + '">' + esc(cm.status) + '</b></div>';
  if (cm.basis) h += '<div style="grid-column:1/3">Підстава: <b>' + esc(cm.basis) + '</b></div>';
  if (cm.dateCreated) h += '<div>Створено: <b>' + esc(cm.dateCreated) + '</b></div>';
  h += '<div>Періодичність: <b>' + esc(cm.periodicity || '—') + '</b></div>';
  if (cm.head) h += '<div>🎖 Голова: <b>' + esc(cm.head) + '</b></div>';
  if (cm.deputy) h += '<div>🎖 Заступник: <b>' + esc(cm.deputy) + '</b></div>';
  if (cm.secretary) h += '<div>📝 Секретар: <b>' + esc(cm.secretary) + '</b></div>';
  if (lastMeet) h += '<div>Останнє: <b>' + esc(lastMeet.date) + '</b></div>';
  if (nextDate) { var ns = p2(nextDate.getDate())+'.'+p2(nextDate.getMonth()+1)+'.'+nextDate.getFullYear(); h += '<div>Наступне: <b style="color:var(--orn)">' + ns + '</b></div>'; }
  // End info
  if (cm.status === 'Завершена') {
    if (cm.endDate) h += '<div>Завершено: <b>' + esc(cm.endDate) + '</b></div>';
    if (cm.endReason) h += '<div style="grid-column:1/3;color:var(--red)">Причина: ' + esc(cm.endReason) + '</div>';
    if (cm.basisDoc) h += '<div style="grid-column:1/3">Документ: ' + esc(cm.basisDoc) + '</div>';
    if (cm.newCommission) h += '<div style="grid-column:1/3">Нова комісія: <b>' + esc(cm.newCommission) + '</b></div>';
  }
  h += '</div>';

  // Active members
  h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
  h += '<div style="padding:6px 8px;font-size:.78rem;font-weight:700;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0;display:flex;justify-content:space-between">👥 Актуальний склад <button class="btn btn-p btn-sm" onclick="event.stopPropagation();openAddMember(\'' + esc(uid) + '\')">＋</button></div>';
  h += '<div style="padding:6px">';
  if (cm.head) h += '<div style="padding:3px 0;font-size:.76rem">🎖 <b>Голова:</b> ' + esc(cm.head) + '</div>';
  if (cm.deputy) h += '<div style="padding:3px 0;font-size:.76rem">🎖 <b>Заступник:</b> ' + esc(cm.deputy) + '</div>';
  if (cm.secretary) h += '<div style="padding:3px 0;font-size:.76rem">📝 <b>Секретар:</b> ' + esc(cm.secretary) + '</div>';
  // MBR active
  activeMembers.forEach(function(m) {
    h += '<div style="padding:3px 0;font-size:.74rem;padding-left:12px;display:flex;justify-content:space-between">👤 ' + esc(m.name) + ' <span style="color:var(--tx3);font-size:.65rem">' + esc(m.role||'Член') + (m.dateIn ? ' з ' + esc(m.dateIn) : '') + '</span></div>';
  });
  // Legacy members if no MBR
  if (!activeMembers.length && legacyMembers.length) {
    legacyMembers.forEach(function(m, idx) {
      var name = typeof m==='string' ? m : (m.name||'');
      if (name) h += '<div style="padding:2px 0;font-size:.74rem;padding-left:12px">' + (idx+1) + '. ' + esc(name) + '</div>';
    });
  }
  h += '</div></div>';

  // Archived members
  if (archivedMembers.length) {
    h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
    h += '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'" style="padding:6px 8px;cursor:pointer;font-size:.78rem;font-weight:700;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0">📦 Архів складу (' + archivedMembers.length + ') ▶</div>';
    h += '<div style="padding:4px;display:none">';
    archivedMembers.forEach(function(m) {
      h += '<div style="padding:3px 6px;font-size:.72rem;opacity:.7;margin-bottom:2px">👤 ' + esc(m.name) + ' — ' + esc(m.role||'') + '<br><span style="color:var(--tx3)">' + esc(m.dateIn||'') + ' → ' + esc(m.dateOut||'') + (m.reasonOut ? ' • ' + esc(m.reasonOut) : '') + '</span></div>';
    });
    h += '</div></div>';
  }

  // Meetings
  h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
  h += '<div style="padding:6px 8px;font-size:.78rem;font-weight:700;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0;display:flex;justify-content:space-between">📅 Засідання (' + meets.length + ')<button class="btn btn-p btn-sm" onclick="event.stopPropagation();openNewMeet(\'' + esc(uid) + '\')">＋</button></div>';
  h += '<div style="padding:4px;max-height:250px;overflow-y:auto">';
  if (!meets.length) h += '<div class="empty" style="padding:8px">Немає засідань</div>';
  meets.forEach(function(m) {
    var decs = DC.filter(function(d) { return d.meetUid === m.uid; });
    var stBg = m.status === 'Проведено' || m.status === 'Закрито' ? 'var(--grn)' : m.status === 'Заплановано' ? 'var(--acc)' : m.status === 'Перенесено' || m.status === 'Скасовано' ? 'var(--red)' : 'var(--orn)';
    h += '<div style="padding:6px 8px;background:var(--bg);border-radius:var(--r2);margin-bottom:3px;cursor:pointer;font-size:.76rem" onclick="event.stopPropagation();showMeetDet(\'' + esc(m.uid) + '\')">';
    h += '<div style="display:flex;justify-content:space-between"><b>📅 ' + esc(m.date) + '</b><span style="color:' + stBg + ';font-size:.65rem">● ' + esc(m.status) + '</span></div>';
    if (m.protocolNum) h += '<div style="font-size:.7rem;color:var(--tx2)">Протокол №' + esc(m.protocolNum) + '</div>';
    if (m.summary) h += '<div style="font-size:.68rem;color:var(--tx3)">' + esc(m.summary).substring(0,60) + '</div>';
    if (decs.length) h += '<div style="font-size:.68rem;color:var(--tx3)">📝 ' + decs.length + ' рішень</div>';
    h += '</div>';
  });
  h += '</div></div>';

  // Documents block
  h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
  h += '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'" style="padding:6px 8px;cursor:pointer;font-size:.78rem;font-weight:700;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0;display:flex;justify-content:space-between">📁 Документи ▶ <button class="btn btn-p btn-sm" onclick="event.stopPropagation();openAddCommDoc(\'' + esc(uid) + '\')">＋</button></div>';
  h += '<div style="padding:6px;display:none">';
  // Collect docs: basis doc, meeting protocols, decision docs
  var commDocs = [];
  if (cm.basisDoc) commDocs.push({name:'Документ-підстава', type:'Підстава', url:cm.basisDoc});
  meets.forEach(function(m) {
    if (m.protocolFile) commDocs.push({name:'Протокол №' + (m.protocolNum||'?') + ' від ' + m.date, type:'Протокол', url:m.protocolFile});
    if (m.scanFile) commDocs.push({name:'Скан протоколу №' + (m.protocolNum||'?') + ' від ' + m.date, type:'Скан', url:m.scanFile});
  });
  allDecs.forEach(function(d) {
    if (d.doneDoc) commDocs.push({name:'Виконання: ' + (d.decName||d.text||'').substring(0,30), type:'Виконання', url:d.doneDoc});
  });
  // Check localStorage for extra docs
  var extraDocs = [];
  try { extraDocs = JSON.parse(localStorage.getItem('k4_cdocs_'+uid) || '[]'); } catch(e) {}
  extraDocs.forEach(function(d) { commDocs.push(d); });

  if (!commDocs.length) h += '<div style="color:var(--tx3);font-size:.72rem">Немає документів</div>';
  commDocs.forEach(function(doc) {
    h += '<div style="display:flex;align-items:center;gap:4px;padding:4px;background:var(--bg);border-radius:var(--r2);margin-bottom:2px;font-size:.72rem">';
    h += '<span style="color:var(--acc2);font-size:.65rem">' + esc(doc.type||'') + '</span>';
    h += '<span style="flex:1">' + esc(doc.name||'') + '</span>';
    if (doc.url) h += '<button class="btn btn-s btn-sm" style="font-size:.6rem" onclick="openDocOverlay(\'' + esc(doc.url) + '\')">👁</button>';
    h += '</div>';
  });
  h += '</div></div>';

  // History block
  h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
  h += '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'" style="padding:6px 8px;cursor:pointer;font-size:.78rem;font-weight:700;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0">📜 Історія ▶</div>';
  h += '<div style="padding:6px;display:none;max-height:250px;overflow-y:auto;font-size:.7rem">';
  // Build history from log + members + meetings
  var history = [];
  if (cm.dateCreated) history.push({date:cm.dateCreated, text:'Створено комісію', icon:'🆕'});
  // Member events
  MBR.filter(function(m){return m.commUid===uid}).forEach(function(m) {
    if (m.dateIn) history.push({date:m.dateIn, text:m.name + ' — ' + (m.role||'член') + ' (входження)', icon:'➕'});
    if (m.dateOut) history.push({date:m.dateOut, text:m.name + ' — вибув' + (m.reasonOut ? ': ' + m.reasonOut : ''), icon:'➖'});
  });
  // Meeting events
  meets.forEach(function(m) { if (m.date) history.push({date:m.date, text:'Засідання' + (m.protocolNum ? ' (прот. №' + m.protocolNum + ')' : '') + ' — ' + m.status, icon:'📅'}); });
  // End event
  if (cm.endDate) history.push({date:cm.endDate, text:'Комісія завершена: ' + (cm.endReason||''), icon:'🔒'});
  // Log entries
  if (cm.log) { cm.log.split('\n').filter(Boolean).forEach(function(line) { var match = line.match(/^(\d{2}\.\d{2}\.\d{4})/); history.push({date:match?match[1]:'', text:line, icon:'📝'}); }); }
  // Sort by date desc
  history.sort(function(a,b) { var da=pD(a.date)||new Date(0), db=pD(b.date)||new Date(0); return db-da; });
  if (!history.length) h += '<div style="color:var(--tx3)">Немає записів</div>';
  history.forEach(function(ev) { h += '<div style="padding:3px 0;border-bottom:1px dotted var(--brd)">' + ev.icon + ' <b>' + esc(ev.date||'—') + '</b> ' + esc(ev.text) + '</div>'; });
  h += '</div></div>';

  // Buttons
  h += '<div class="btn-row">';
  h += '<button class="btn btn-s btn-sm" onclick="openEditComm(\'' + esc(uid) + '\')">✏️ Редагувати</button>';
  h += '<button class="btn btn-s btn-sm" onclick="printCommMembers(\'' + esc(uid) + '\')" title="Друк складу">🖨 Склад</button>';
  h += '<button class="btn btn-s btn-sm" onclick="printCommSchedule(\'' + esc(uid) + '\')" title="Друк графіку">📅 Графік</button>';
  if (cm.status === 'Активна') h += '<button class="btn btn-s btn-sm" style="color:var(--red)" onclick="endComm(\'' + esc(uid) + '\')" title="Завершити">🔒 Завершити</button>';
  h += '<button class="btn btn-d btn-sm" onclick="delComm(\'' + esc(uid) + '\')">🗑</button>';
  h += '<button class="btn btn-s btn-sm" onclick="closeP()">✕</button></div></div>';
  el('rpc').innerHTML = h; openP();
}


/* ─── COMMISSION FORMS ─── */
function openNewComm() {
  var specOpts = buildExecOptions('');
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">👥 Нова комісія</h2>' +
    '<input type="hidden" id="cf-uid" value=""><input type="hidden" id="cf-row" value="">' +
    '<div class="fg"><label>Назва комісії</label><input type="text" id="cf-nm" placeholder="Комісія з..."></div>' +
    '<div class="frow"><div class="fg"><label>Тип</label><select id="cf-tp"><option>Постійна</option><option>Тимчасова</option></select></div>' +
    '<div class="fg"><label>Статус</label><select id="cf-st"><option>Активна</option><option>Завершена</option></select></div></div>' +
    '<div class="fg"><label>Підстава (наказ/розпорядження)</label><input type="text" id="cf-bs" placeholder="Розпорядження №... від ..."></div>' +
    '<div class="fg"><label>Дата створення</label><input type="date" id="cf-dt" value="' + isoT() + '"></div>' +
    '<div class="fg"><label>🎖 Голова комісії</label><select id="cf-hd">' + specOpts + '</select></div>' +
    '<div class="fg"><label>🎖 Заступник голови</label><select id="cf-dp">' + specOpts + '</select></div>' +
    '<div class="fg"><label>📝 Секретар</label><select id="cf-sc">' + specOpts + '</select></div>' +
    '<div class="fg"><label>👥 Члени комісії</label><div id="cf-members"></div><button type="button" class="btn btn-s btn-sm" style="margin-top:4px" onclick="addCommMember()">＋ Додати</button></div>' +
    '<div class="fg"><label>Періодичність засідань</label><select id="cf-pr"><option>За потреби</option><option>Щомісяця</option><option>Щокварталу</option><option>Раз на півроку</option><option>Щороку</option></select></div>' +
    '<div class="fg"><label>Примітки</label><textarea id="cf-nt" style="min-height:40px"></textarea></div>' +
    '<div id="cf-end-block" style="border:1px solid var(--brd);border-radius:var(--r2);padding:8px;margin-bottom:8px;display:none">' +
    '<div style="font-size:.76rem;font-weight:700;color:var(--red);margin-bottom:6px">🔒 Завершення комісії</div>' +
    '<div class="frow"><div class="fg"><label>Дата завершення</label><input type="date" id="cf-ed"></div>' +
    '<div class="fg"><label>Нова комісія</label><input type="text" id="cf-nc" placeholder="Назва нової комісії"></div></div>' +
    '<div class="fg"><label>Причина завершення</label><textarea id="cf-er" style="min-height:30px" placeholder="В зв\'язку зі створенням нової..."></textarea></div>' +
    '<div class="fg"><label>Документ-підстава</label><input type="text" id="cf-bd" placeholder="Розпорядження №... від ..."></div>' +
    '</div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="saveComm()">💾 Зберегти</button><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';
  addCommMember(); // add first empty row
  openP();
}


function addCommMember() {
  var cont = el('cf-members');
  var opts = buildExecOptions('');
  var idx = cont.children.length;
  cont.insertAdjacentHTML('beforeend',
    '<div class="frow" style="margin-bottom:3px" data-mem="' + idx + '">' +
    '<select style="flex:1;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:4px;border-radius:var(--r2);font-size:.76rem">' + opts + '</select>' +
    '<input type="text" placeholder="роль/посада" style="width:100px;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:4px;border-radius:var(--r2);font-size:.72rem">' +
    '<button type="button" style="background:none;border:none;color:var(--red);cursor:pointer" onclick="this.parentElement.remove()">✕</button></div>');
}


function saveComm() {
  var nm = el('cf-nm').value.trim(); if (!nm) { toast('⚠️ Вкажіть назву'); return; }
  var row = el('cf-row').value;
  var members = [];
  document.querySelectorAll('#cf-members [data-mem]').forEach(function(r) {
    var sel = r.querySelector('select'), inp = r.querySelector('input');
    var name = sel ? sel.value : ''; var role = inp ? inp.value.trim() : '';
    if (name) members.push({name: name, role: role});
  });
  var dtv = el('cf-dt').value;
  var dateCreated = ''; if (dtv) { var pp = dtv.split('-'); dateCreated = pp[2]+'.'+pp[1]+'.'+pp[0]; }
  var data = {
    action: row ? 'editComm' : 'addComm', row: row || undefined,
    name: nm, commType: el('cf-tp').value, basis: el('cf-bs').value.trim(),
    dateCreated: dateCreated, head: el('cf-hd').value, deputy: el('cf-dp') ? el('cf-dp').value : '',
    secretary: el('cf-sc').value,
    members: JSON.stringify(members), periodicity: el('cf-pr').value,
    status: el('cf-st').value, notes: el('cf-nt').value.trim(),
    endDate: el('cf-ed') && el('cf-ed').value ? (function(){var p=el('cf-ed').value.split('-');return p[2]+'.'+p[1]+'.'+p[0]})() : '',
    endReason: el('cf-er') ? el('cf-er').value.trim() : '',
    newCommission: el('cf-nc') ? el('cf-nc').value.trim() : '',
    basisDoc: el('cf-bd') ? el('cf-bd').value.trim() : ''
  };
  toast('💾...'); apiP(data).then(function(r) { if (r.ok) { toast('✅'); closeP(); loadData(); } else toast('❌ ' + (r.error||'')); }).catch(function(e) { toast('❌ ' + e.message); });
}


function openEditComm(uid) {
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === uid) { cm = COMMS[i]; break; } } if (!cm) return;
  openNewComm();
  setTimeout(function() {
    el('cf-row').value = cm.row; el('cf-uid').value = cm.uid;
    el('cf-nm').value = cm.name; el('cf-tp').value = cm.commType || 'Постійна';
    el('cf-bs').value = cm.basis || ''; el('cf-st').value = cm.status || 'Активна';
    if (cm.dateCreated) { var d = pD(cm.dateCreated); if (d) el('cf-dt').value = d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
    el('cf-hd').value = cm.head || ''; if(el('cf-dp')) el('cf-dp').value = cm.deputy || ''; el('cf-sc').value = cm.secretary || '';
    el('cf-pr').value = cm.periodicity || 'За потреби';
    el('cf-nt').value = cm.notes || '';
    // End fields
    if (cm.status === 'Завершена' && el('cf-end-block')) { el('cf-end-block').style.display = ''; }
    if (cm.endDate && el('cf-ed')) { var ed = pD(cm.endDate); if(ed) el('cf-ed').value = ed.getFullYear()+'-'+p2(ed.getMonth()+1)+'-'+p2(ed.getDate()); }
    if (el('cf-er')) el('cf-er').value = cm.endReason || '';
    if (el('cf-nc')) el('cf-nc').value = cm.newCommission || '';
    if (el('cf-bd')) el('cf-bd').value = cm.basisDoc || '';
    // Restore members
    var cont = el('cf-members'); cont.innerHTML = '';
    try {
      var mems = JSON.parse(cm.members);
      mems.forEach(function(m) { addCommMember(); var last = cont.lastElementChild; if (last) { last.querySelector('select').value = m.name || ''; last.querySelector('input').value = m.role || ''; } });
    } catch(e) {}
  }, 80);
}


function delComm(uid) {
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === uid) { cm = COMMS[i]; break; } } if (!cm) return;
  if (!confirm('Видалити комісію "' + cm.name + '"?')) return;
  apiP({action:'delComm', row:cm.row}).then(function(r) { if (r.ok) { toast('🗑'); closeP(); loadData(); } else toast('❌'); }).catch(function(e) { toast('❌ ' + e.message); });
}


/* ─── END COMMISSION ─── */
function endComm(uid) {
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === uid) { cm = COMMS[i]; break; } } if (!cm) return;
  openEditComm(uid);
  setTimeout(function() {
    if (el('cf-st')) el('cf-st').value = 'Завершена';
    if (el('cf-end-block')) el('cf-end-block').style.display = '';
  }, 150);
}


/* ─── COMMISSION DOCUMENTS (localStorage) ─── */
function openAddCommDoc(commUid) {
  var h = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">📁 Додати документ</h2>';
  h += '<div class="fg"><label>Назва</label><input type="text" id="cdd-nm" placeholder="Розпорядження №15 про створення..."></div>';
  h += '<div class="fg"><label>Тип</label><select id="cdd-tp"><option>Розпорядження</option><option>Положення</option><option>Склад</option><option>Зміна складу</option><option>Протокол</option><option>Скан</option><option>Довідка</option><option>Лист</option><option>Інше</option></select></div>';
  h += '<div class="fg"><label>📎 Файл</label><div style="display:flex;gap:4px"><input type="url" id="cdd-url" style="flex:1" placeholder="URL або завантажте"><button type="button" class="btn btn-s btn-sm" onclick="pickFile(\'cdd-url\')">📂</button><label class="btn btn-s btn-sm" style="cursor:pointer">📤<input type="file" style="display:none" onchange="uploadFileToField(this,\'cdd-url\')"></label></div></div>';
  h += '<div class="fg"><label>Примітка</label><input type="text" id="cdd-nt"></div>';
  h += '<div class="btn-row"><button class="btn btn-p" onclick="saveCommDoc(\'' + esc(commUid) + '\')">💾 Зберегти</button><button class="btn btn-s" onclick="showCommDet(\'' + esc(commUid) + '\')">← Назад</button></div></div>';
  el('rpc').innerHTML = h; openP();
}


function saveCommDoc(commUid) {
  var nm = el('cdd-nm') ? el('cdd-nm').value.trim() : '';
  var url = el('cdd-url') ? el('cdd-url').value.trim() : '';
  if (!nm && !url) { toast('⚠️ Вкажіть назву або файл'); return; }
  var doc = {name: nm, type: el('cdd-tp')?el('cdd-tp').value:'', url: url, notes: el('cdd-nt')?el('cdd-nt').value.trim():'', date: isoT()};
  var key = 'k4_cdocs_' + commUid;
  var docs = [];
  try { docs = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
  docs.push(doc);
  localStorage.setItem(key, JSON.stringify(docs));
  toast('✅ Документ додано');
  showCommDet(commUid);
}


/* ─── MEETING FORMS ─── */
function openNewMeet(commUid) {
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">📅 Нове засідання</h2>' +
    '<input type="hidden" id="mf-cuid" value="' + esc(commUid) + '"><input type="hidden" id="mf-row" value=""><input type="hidden" id="mf-uid" value="">' +
    '<div class="frow"><div class="fg"><label>Дата</label><input type="date" id="mf-dt" value="' + isoT() + '"></div>' +
    '<div class="fg"><label>№ протоколу</label><input type="text" id="mf-pn"></div></div>' +
    '<div class="fg"><label>Місце</label><input type="text" id="mf-pl" value="Актова зала"></div>' +
    '<div class="fg"><label>Статус</label><select id="mf-st"><option>Заплановано</option><option>Проведено</option><option>Перенесено</option><option>Скасовано</option><option>Протокол оформлюється</option><option>Закрито</option></select></div>' +
    '<div class="fg"><label>📋 Порядок денний</label><textarea id="mf-ag" style="min-height:80px" placeholder="1. Про...\n2. Про...\n3. Різне"></textarea></div>' +
    '<div class="fg"><label>👤 Присутні</label><textarea id="mf-at" style="min-height:50px" placeholder="ПІБ, ПІБ, ..."></textarea></div>' +
    '<div class="fg"><label>❌ Відсутні</label><textarea id="mf-ab" style="min-height:30px" placeholder="ПІБ — причина"></textarea></div>' +
    '<div class="fg"><label>📝 Короткий підсумок</label><textarea id="mf-sm" style="min-height:40px" placeholder="Результати засідання..."></textarea></div>' +
    '<div class="fg"><label>📎 Файл протоколу</label><div style="display:flex;gap:4px"><input type="url" id="mf-pf" style="flex:1"><button type="button" class="btn btn-s btn-sm" onclick="pickFile(\'mf-pf\')">📂</button><label class="btn btn-s btn-sm" style="cursor:pointer">📤<input type="file" style="display:none" onchange="uploadFileToField(this,\'mf-pf\')"></label></div></div>' +
    '<div class="fg"><label>📎 Скан протоколу</label><div style="display:flex;gap:4px"><input type="url" id="mf-sf" style="flex:1"><button type="button" class="btn btn-s btn-sm" onclick="pickFile(\'mf-sf\')">📂</button><label class="btn btn-s btn-sm" style="cursor:pointer">📤<input type="file" style="display:none" onchange="uploadFileToField(this,\'mf-sf\')"></label></div></div>' +
    '<div class="fg"><label>Примітки</label><textarea id="mf-nt" style="min-height:36px"></textarea></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="saveMeet()">💾 Зберегти</button><button class="btn btn-s" onclick="showCommDet(\'' + esc(commUid) + '\')">← Назад</button></div></div>';
  openP();
}


function saveMeet() {
  var dtv = el('mf-dt').value;
  var date = ''; if (dtv) { var pp = dtv.split('-'); date = pp[2]+'.'+pp[1]+'.'+pp[0]; }
  var row = el('mf-row').value;
  var data = {
    action: row ? 'editMeet' : 'addMeet', row: row || undefined,
    commUid: el('mf-cuid').value, date: date, protocolNum: el('mf-pn').value.trim(),
    place: el('mf-pl').value.trim(), status: el('mf-st').value,
    agenda: el('mf-ag').value.trim(), attendees: el('mf-at').value.trim(),
    absent: el('mf-ab') ? el('mf-ab').value.trim() : '',
    protocolFile: el('mf-pf').value.trim(),
    scanFile: el('mf-sf') ? el('mf-sf').value.trim() : '',
    summary: el('mf-sm') ? el('mf-sm').value.trim() : '',
    notes: el('mf-nt').value.trim()
  };
  toast('💾...'); apiP(data).then(function(r) { if (r.ok) { toast('✅'); logAction(row?'editMeet':'addMeet', data.date); closeP(); loadData(); } else toast('❌ ' + (r.error||'')); }).catch(function(e) { toast('❌ ' + e.message); });
}


/* ─── DECISION FORMS ─── */
function openNewDecis(meetUid, commUid) {
  var specOpts = buildExecOptions('');
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">📝 Нове рішення</h2>' +
    '<input type="hidden" id="dc-muid" value="' + esc(meetUid) + '"><input type="hidden" id="dc-cuid" value="' + esc(commUid) + '"><input type="hidden" id="dc-row" value="">' +
    '<div class="fg"><label>Коротка назва</label><input type="text" id="dc-nm" placeholder="Про виділення коштів..."></div>' +
    '<div class="fg"><label>Повний текст рішення</label><textarea id="dc-tx" style="min-height:60px"></textarea></div>' +
    '<div class="fg"><label>Відповідальний</label><select id="dc-rsp">' + specOpts + '</select></div>' +
    '<div class="fg"><label>Термін виконання</label><input type="date" id="dc-dl"></div>' +
    '<div class="fg"><label>Статус</label><select id="dc-st"><option>На контролі</option><option>Виконано</option><option>Частково виконано</option><option>Перенесено</option><option>Знято з контролю</option></select></div>' +
    '<div class="fg"><label>📎 Документ виконання</label><div style="display:flex;gap:4px"><input type="url" id="dc-dd" style="flex:1"><button type="button" class="btn btn-s btn-sm" onclick="pickFile(\'dc-dd\')">📂</button><label class="btn btn-s btn-sm" style="cursor:pointer">📤<input type="file" style="display:none" onchange="uploadFileToField(this,\'dc-dd\')"></label></div></div>' +
    '<div class="fg"><label><input type="checkbox" id="dc-ac" style="accent-color:var(--acc)"> Автоматично створити контрольний документ</label></div>' +
    '<div class="fg"><label>Примітки</label><textarea id="dc-nt" style="min-height:36px"></textarea></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="saveDecis()">💾 Зберегти</button><button class="btn btn-s" onclick="showMeetDet(\'' + esc(meetUid) + '\')">← Назад</button></div></div>';
  openP();
}


function saveDecis() {
  var text = el('dc-tx').value.trim(); if (!text && !el('dc-nm').value.trim()) { toast('⚠️ Введіть назву або текст рішення'); return; }
  var dlv = el('dc-dl').value;
  var deadline = ''; if (dlv) { var pp = dlv.split('-'); deadline = pp[2]+'.'+pp[1]+'.'+pp[0]; }
  var row = el('dc-row').value;
  var data = {
    action: row ? 'editDecis' : 'addDecis', row: row || undefined,
    meetUid: el('dc-muid').value, commUid: el('dc-cuid').value,
    decName: el('dc-nm') ? el('dc-nm').value.trim() : '',
    text: text, responsible: el('dc-rsp').value, deadline: deadline,
    status: el('dc-st').value, doneDoc: el('dc-dd') ? el('dc-dd').value.trim() : '',
    notes: el('dc-nt').value.trim(),
    autoControl: el('dc-ac') && el('dc-ac').checked
  };
  toast('💾...'); apiP(data).then(function(r) { if (r.ok) { toast('✅'); logAction(row?'editDecis':'addDecis', data.decName||text.substring(0,30)); closeP(); loadData(); } else toast('❌ ' + (r.error||'')); }).catch(function(e) { toast('❌ ' + e.message); });
}


/* ─── COMMISSION PRINT ─── */
function printCommMembers(uid) {
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === uid) { cm = COMMS[i]; break; } } if (!cm) return;
  var legacyMembers = []; try { legacyMembers = JSON.parse(cm.members); } catch(e) {}
  var activeMembers = MBR.filter(function(m) { return m.commUid === uid && !m.dateOut; });
  var w = window.open('', '_blank');
  var h = '<html><head><title>Склад комісії</title><style>body{font-family:Arial;margin:20mm}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #000;padding:5px;font-size:12px}th{background:#f0f0f0}.no-print{text-align:center;margin:10px}@media print{.no-print{display:none}}</style></head><body>';
  h += '<div class="no-print"><button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#3b82f6;color:#fff;border:none;border-radius:6px">🖨 Друкувати</button></div>';
  h += '<h2 style="text-align:center">СКЛАД КОМІСІЇ</h2>';
  h += '<p><b>' + esc(cm.name) + '</b></p>';
  if (cm.basis) h += '<p>Підстава: ' + esc(cm.basis) + '</p>';
  h += '<table><tr><th>№</th><th>ПІБ</th><th>Роль/посада</th></tr>';
  var n = 1;
  if (cm.head) { h += '<tr><td>' + n + '</td><td>' + esc(cm.head) + '</td><td>Голова комісії</td></tr>'; n++; }
  if (cm.deputy) { h += '<tr><td>' + n + '</td><td>' + esc(cm.deputy) + '</td><td>Заступник голови</td></tr>'; n++; }
  if (cm.secretary) { h += '<tr><td>' + n + '</td><td>' + esc(cm.secretary) + '</td><td>Секретар</td></tr>'; n++; }
  // MBR members first, then legacy
  if (activeMembers.length) {
    activeMembers.forEach(function(m) { h += '<tr><td>' + n + '</td><td>' + esc(m.name) + '</td><td>' + esc(m.role||'Член комісії') + '</td></tr>'; n++; });
  } else {
    legacyMembers.forEach(function(m) { var name = typeof m==='string'?m:(m.name||''); var role = typeof m==='object'?(m.role||'Член комісії'):'Член комісії'; h += '<tr><td>' + n + '</td><td>' + esc(name) + '</td><td>' + esc(role) + '</td></tr>'; n++; });
  }
  h += '</table></body></html>';
  w.document.write(h); w.document.close();
}


function printCommSchedule(uid) {
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === uid) { cm = COMMS[i]; break; } } if (!cm) return;
  var meets = MT.filter(function(m) { return m.commUid === uid; }).sort(function(a,b) { var da = pD(a.date), db = pD(b.date); return (da||0)-(db||0); });
  var w = window.open('', '_blank');
  var h = '<html><head><title>Графік засідань</title><style>body{font-family:Arial;margin:20mm}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #000;padding:5px;font-size:12px}th{background:#f0f0f0}</style></head><body>';
  h += '<h2 style="text-align:center">ГРАФІК ЗАСІДАНЬ</h2>';
  h += '<p><b>' + esc(cm.name) + '</b> • Періодичність: ' + esc(cm.periodicity) + '</p>';
  h += '<table><tr><th>№</th><th>Дата</th><th>Статус</th><th>Протокол</th><th>Рішень</th></tr>';
  meets.forEach(function(m, i) {
    var decs = DC.filter(function(d) { return d.meetUid === m.uid; }).length;
    h += '<tr><td>' + (i+1) + '</td><td>' + esc(m.date) + '</td><td>' + esc(m.status) + '</td><td>' + esc(m.protocolNum||'—') + '</td><td>' + decs + '</td></tr>';
  });
  h += '</table></body></html>';
  w.document.write(h); w.document.close(); setTimeout(function() { w.print(); }, 500);
}


function printProtocol(meetUid) {
  var m = null; for (var i = 0; i < MT.length; i++) { if (MT[i].uid === meetUid) { m = MT[i]; break; } } if (!m) return;
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === m.commUid) { cm = COMMS[i]; break; } }
  var decs = DC.filter(function(d) { return d.meetUid === meetUid; });
  var w = window.open('', '_blank');
  var h = '<html><head><title>Протокол</title><style>body{font-family:Arial;margin:20mm;font-size:13px}h2{text-align:center}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #000;padding:5px;font-size:12px}th{background:#f0f0f0}</style></head><body>';
  h += '<h2>ПРОТОКОЛ №' + esc(m.protocolNum || '___') + '</h2>';
  h += '<p style="text-align:center">засідання ' + (cm ? esc(cm.name) : '') + '</p>';
  h += '<p>Дата: <b>' + esc(m.date) + '</b>' + (m.place ? ' • Місце: ' + esc(m.place) : '') + '</p>';
  if (m.attendees) h += '<p>Присутні: ' + esc(m.attendees) + '</p>';
  if (m.agenda) { h += '<p><b>Порядок денний:</b></p><pre style="font-family:Arial;white-space:pre-line">' + esc(m.agenda) + '</pre>'; }
  if (decs.length) {
    h += '<p><b>ВИРІШИЛИ:</b></p><table><tr><th>№</th><th>Рішення</th><th>Відповідальний</th><th>Термін</th></tr>';
    decs.forEach(function(d, i) { h += '<tr><td>' + (i+1) + '</td><td>' + esc(d.text) + '</td><td>' + esc(d.responsible||'—') + '</td><td>' + esc(d.deadline||'—') + '</td></tr>'; });
    h += '</table>';
  }
  h += '<br><table style="border:none;width:100%"><tr><td style="border:none;width:50%">Голова _____________ ' + (cm ? esc(cm.head) : '') + '</td><td style="border:none">Секретар _____________ ' + (cm ? esc(cm.secretary) : '') + '</td></tr></table>';
  h += '</body></html>';
  w.document.write(h); w.document.close(); setTimeout(function() { w.print(); }, 500);
}


/* ─── ADD MEMBER (new sheet) ─── */
function openAddMember(commUid) {
  var specOpts = buildExecOptions('');
  var h = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">👤 Додати члена комісії</h2>';
  h += '<div class="fg"><label>ПІБ</label><select id="mb-nm">' + specOpts + '</select></div>';
  h += '<div class="fg"><label>Роль</label><select id="mb-rl"><option>Член</option><option>Голова</option><option>Заступник</option><option>Секретар</option></select></div>';
  h += '<div class="fg"><label>Дата входження</label><input type="date" id="mb-di" value="' + isoT() + '"></div>';
  h += '<div class="fg"><label>Примітка</label><input type="text" id="mb-nt"></div>';
  h += '<div class="btn-row"><button class="btn btn-p" onclick="saveMember(\'' + esc(commUid) + '\')">💾 Зберегти</button><button class="btn btn-s" onclick="showCommDet(\'' + esc(commUid) + '\')">← Назад</button></div></div>';
  el('rpc').innerHTML = h; openP();
}


function saveMember(commUid) {
  var nm = el('mb-nm') ? el('mb-nm').value : '';
  if (!nm) { toast('⚠️ Оберіть особу'); return; }
  var div = el('mb-di') ? el('mb-di').value : '';
  var dateIn = ''; if (div) { var pp = div.split('-'); dateIn = pp[2]+'.'+pp[1]+'.'+pp[0]; }
  toast('💾...');
  apiP({action:'addMember', commUid:commUid, name:nm, role:el('mb-rl')?el('mb-rl').value:'Член', dateIn:dateIn, notes:el('mb-nt')?el('mb-nt').value.trim():''}).then(function(r) {
    if (r.ok) { toast('✅ Додано'); loadData(); setTimeout(function(){ showCommDet(commUid); }, 500); }
    else toast('❌ ' + (r.error||''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}


function showMeetDet(meetUid) {
  var m = null; for (var i = 0; i < MT.length; i++) { if (MT[i].uid === meetUid) { m = MT[i]; break; } } if (!m) return;
  var cm = null; for (var i = 0; i < COMMS.length; i++) { if (COMMS[i].uid === m.commUid) { cm = COMMS[i]; break; } }
  var decs = DC.filter(function(d) { return d.meetUid === meetUid; });

  var h = '<div style="margin-top:18px">';
  h += '<h2 style="font-size:1rem;font-weight:700;margin-bottom:6px">📅 Засідання ' + esc(m.date) + '</h2>';
  if (cm) h += '<p style="font-size:.78rem;color:var(--tx2);margin-bottom:6px">👥 ' + esc(cm.name) + '</p>';
  h += '<div style="font-size:.76rem;margin-bottom:8px">';
  if (m.protocolNum) h += '<div>📋 Протокол: <b>№' + esc(m.protocolNum) + '</b></div>';
  h += '<div>Статус: <b>' + esc(m.status) + '</b></div>';
  if (m.place) h += '<div>📍 Місце: ' + esc(m.place) + '</div>';
  h += '</div>';

  if (m.agenda) {
    h += '<div style="margin-bottom:6px"><div style="font-size:.72rem;color:var(--tx3);font-weight:700;margin-bottom:2px">📋 Порядок денний:</div>';
    h += '<div style="font-size:.76rem;background:var(--bg);padding:6px;border-radius:var(--r2);white-space:pre-line">' + esc(m.agenda) + '</div></div>';
  }
  if (m.attendees) {
    h += '<div style="margin-bottom:6px"><div style="font-size:.72rem;color:var(--tx3);font-weight:700;margin-bottom:2px">👤 Присутні:</div>';
    h += '<div style="font-size:.74rem;padding:4px">' + esc(m.attendees) + '</div></div>';
  }
  if (m.absent) {
    h += '<div style="margin-bottom:6px"><div style="font-size:.72rem;color:var(--red);font-weight:700;margin-bottom:2px">❌ Відсутні:</div>';
    h += '<div style="font-size:.74rem;padding:4px">' + esc(m.absent) + '</div></div>';
  }
  if (m.summary) {
    h += '<div style="margin-bottom:6px"><div style="font-size:.72rem;color:var(--tx3);font-weight:700;margin-bottom:2px">📝 Підсумок:</div>';
    h += '<div style="font-size:.76rem;background:var(--bg);padding:6px;border-radius:var(--r2)">' + esc(m.summary) + '</div></div>';
  }
  var fileButtons = '';
  if (m.protocolFile) fileButtons += '<button class="btn btn-s btn-sm" onclick="openDocOverlay(\'' + esc(m.protocolFile) + '\')">📎 Протокол</button> ';
  if (m.scanFile) fileButtons += '<button class="btn btn-s btn-sm" onclick="openDocOverlay(\'' + esc(m.scanFile) + '\')">📜 Скан</button>';
  if (fileButtons) h += '<div style="margin-bottom:6px">' + fileButtons + '</div>';

  // Decisions
  h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
  h += '<div style="padding:6px 8px;font-size:.78rem;font-weight:700;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0;display:flex;justify-content:space-between;align-items:center">📝 Рішення (' + decs.length + ')<button class="btn btn-p btn-sm" onclick="event.stopPropagation();openNewDecis(\'' + esc(meetUid) + '\',\'' + esc(m.commUid) + '\')">＋</button></div>';
  h += '<div style="padding:4px">';
  if (!decs.length) h += '<div class="empty" style="padding:6px">Немає рішень</div>';
  decs.forEach(function(d, idx) {
    var stC = d.status === 'Виконано' ? 'var(--grn)' : (d.status === 'На контролі' ? 'var(--orn)' : 'var(--tx3)');
    h += '<div style="padding:5px 8px;background:var(--bg);border-radius:var(--r2);margin-bottom:2px;font-size:.74rem">';
    h += '<div>' + (idx+1) + '. ' + esc(d.text) + '</div>';
    h += '<div style="display:flex;gap:6px;font-size:.68rem;color:var(--tx3);margin-top:2px">';
    if (d.responsible) h += '<span>👤 ' + esc(d.responsible) + '</span>';
    if (d.deadline) h += '<span>📅 ' + esc(d.deadline) + '</span>';
    h += '<span style="color:' + stC + '">● ' + esc(d.status) + '</span>';
    if (d.controlId) h += '<span onclick="event.stopPropagation();openDet(' + d.controlId + ')" style="color:var(--acc2);cursor:pointer">📋→</span>';
    h += '</div></div>';
  });
  h += '</div></div>';

  h += '<div class="btn-row">';
  h += '<button class="btn btn-s btn-sm" onclick="openEditMeet(\'' + esc(meetUid) + '\')">✏️ Редагувати</button>';
  h += '<button class="btn btn-s btn-sm" onclick="printProtocol(\'' + esc(meetUid) + '\')" title="Друк протоколу">🖨 Протокол</button>';
  h += '<button class="btn btn-d btn-sm" onclick="delMeet(\'' + esc(meetUid) + '\')">🗑</button>';
  h += '<button class="btn btn-s btn-sm" onclick="showCommDet(\'' + esc(m.commUid) + '\')">← Назад</button></div></div>';
  el('rpc').innerHTML = h; openP();
}


function delMeet(meetUid) {
  var m = null; for (var i = 0; i < MT.length; i++) { if (MT[i].uid === meetUid) { m = MT[i]; break; } } if (!m) return;
  if (!confirm('Видалити засідання ' + m.date + '?')) return;
  apiP({action:'delMeet', row:m.row}).then(function(r) { if (r.ok) { toast('🗑'); closeP(); loadData(); } else toast('❌'); }).catch(function(e) { toast('❌ ' + e.message); });
}


function openEditMeet(meetUid) {
  var m = null; for (var i = 0; i < MT.length; i++) { if (MT[i].uid === meetUid) { m = MT[i]; break; } } if (!m) return;
  openNewMeet(m.commUid);
  setTimeout(function() {
    el('mf-row').value = m.row; el('mf-uid').value = m.uid;
    if (m.date) { var d = pD(m.date); if (d) el('mf-dt').value = d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
    el('mf-pn').value = m.protocolNum || ''; el('mf-pl').value = m.place || '';
    el('mf-st').value = m.status || 'Заплановано';
    el('mf-ag').value = m.agenda || ''; el('mf-at').value = m.attendees || '';
    if (el('mf-ab')) el('mf-ab').value = m.absent || '';
    if (el('mf-sm')) el('mf-sm').value = m.summary || '';
    el('mf-pf').value = m.protocolFile || '';
    if (el('mf-sf')) el('mf-sf').value = m.scanFile || '';
    el('mf-nt').value = m.notes || '';
  }, 80);
}


function calcNextMeet(cm, lastMeet) {
  if (cm.status !== 'Активна') return null;
  if (!cm.periodicity || cm.periodicity === 'За потреби') return null;
  var base = lastMeet ? pD(lastMeet.date) : pD(cm.dateCreated);
  if (!base) return null;
  var next = new Date(base);
  if (cm.periodicity === 'Щомісяця') next.setMonth(next.getMonth() + 1);
  else if (cm.periodicity === 'Щокварталу') next.setMonth(next.getMonth() + 3);
  else if (cm.periodicity === 'Раз на півроку') next.setMonth(next.getMonth() + 6);
  else if (cm.periodicity === 'Щороку') next.setFullYear(next.getFullYear() + 1);
  return next;
}

function toggleCmMy() { CM_MY = !CM_MY; var b = el('cm-my'); if(b) b.classList.toggle('on', CM_MY); renderComms(); }


function getMyRole(cm) {
  var myName = CUR_USER ? (CUR_USER.name || CUR_USER.login || '') : '';
  if (!myName) return '';
  var n = myName.toLowerCase();
  if (cm.head && cm.head.toLowerCase().indexOf(n) >= 0) return 'Голова';
  if (cm.deputy && cm.deputy.toLowerCase().indexOf(n) >= 0) return 'Заступник';
  if (cm.secretary && cm.secretary.toLowerCase().indexOf(n) >= 0) return 'Секретар';
  // Check MBR
  var mbrs = MBR.filter(function(m) { return m.commUid === cm.uid && !m.dateOut; });
  for (var i = 0; i < mbrs.length; i++) {
    if (mbrs[i].name && mbrs[i].name.toLowerCase().indexOf(n) >= 0) return mbrs[i].role || 'Член';
  }
  // Check legacy members JSON
  try { var mem = JSON.parse(cm.members || '[]');
    for (var j = 0; j < mem.length; j++) { var mn = typeof mem[j]==='string'?mem[j]:(mem[j].name||''); if (mn.toLowerCase().indexOf(n)>=0) return 'Член'; }
  } catch(e) { if (cm.members && cm.members.toLowerCase().indexOf(n)>=0) return 'Член'; }
  return '';
}


function roleOrder(r) { return r==='Голова'?0:r==='Заступник'?1:r==='Секретар'?2:r==='Член'?3:r?4:9; }


function getCommEvents(td, limit) {
  var now = new Date();
  var overdue = [], soon = [], overdueDec = [];
  var limitDate = new Date(td); limitDate.setDate(limitDate.getDate() + 60);

  COMMS.forEach(function(cm) {
    if (cm.status !== 'Активна') return;
    var meets = MT.filter(function(m) { return m.commUid === cm.uid; });
    var lastMeet = null;
    meets.forEach(function(m) { var md = pD(m.date); if (md && md <= now) { if (!lastMeet || md > pD(lastMeet.date)) lastMeet = m; } });
    var nextDate = calcNextMeet(cm, lastMeet);
    if (!nextDate) return;
    var days = Math.ceil((nextDate - now) / 86400000);
    var dateStr = p2(nextDate.getDate())+'.'+p2(nextDate.getMonth()+1)+'.'+nextDate.getFullYear();
    var myRole = getMyRole(cm);
    var evt = {uid: cm.uid, name: cm.name, dateStr: dateStr, days: days, role: myRole, dateObj: nextDate};
    if (days < 0) overdue.push(evt);
    else if (days <= 30) soon.push(evt);
  });

  // Overdue decisions
  DC.forEach(function(d) {
    if (d.status === 'Виконано' || d.status === 'Знято з контролю') return;
    var dl = pD(d.deadline);
    if (dl && dl < now) overdueDec.push(d);
  });

  overdue.sort(function(a,b) { return a.dateObj - b.dateObj; });
  soon.sort(function(a,b) { return a.dateObj - b.dateObj; });
  return {overdue: overdue, soon: soon, overdueDec: overdueDec};
}

