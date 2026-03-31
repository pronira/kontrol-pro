/* ══ Organizations ══ */
var ORG_ARCHIVE_OPEN = false;
var ORG_ORDER = JSON.parse(localStorage.getItem('k4_org_order') || '{}');
var ORG_STATUS = JSON.parse(localStorage.getItem('k4_org_status') || '{}');


/* ─── ORGS ─── */
function isOrgDeleted(o) {
  if (o.status === 'deleted') return true;
  var nm = (o.name||'').toLowerCase(), ct = (o.orgType||'').toLowerCase(), cat = (o.category||'').toLowerCase();
  return nm.indexOf('видалено') >= 0 || ct.indexOf('видалено') >= 0 || cat.indexOf('видалено') >= 0;
}

function isOrgEmpty(o) { return !(o.name||'').trim(); }

function orgCmp(a, b) {
  var oa = ORG_ORDER[a.row], ob = ORG_ORDER[b.row];
  if (oa !== undefined && ob !== undefined) return oa - ob;
  if (oa !== undefined) return -1;
  if (ob !== undefined) return 1;
  return String(a.row).localeCompare(String(b.row));
}

function renderOrgs() {
  var q = (el('org-s').value || '').trim().toLowerCase();
  var c = el('org-t');
  if (!O.length) { c.innerHTML = '<div class="empty"><div class="ei">🏢</div>Немає</div>'; return; }
  var visible = O.filter(function(o) { return !isOrgDeleted(o) && !isOrgEmpty(o); });
  var validIds = {}; visible.forEach(function(o) { validIds[o.row] = true; });
  var byP = {}; visible.forEach(function(o) {
    var p = o.parentRow || 'root';
    if (p !== 'root' && !validIds[p]) p = 'root';
    if (!byP[p]) byP[p] = [];
    byP[p].push(o);
  });
  function countDocsDeep(orgRow) {
    var org = null; for(var i=0;i<visible.length;i++) if(visible[i].row==orgRow){org=visible[i];break;}
    if (!org) return 0;
    var own = D.filter(function(d){ return d.from === org.name && !d.done; }).length;
    (byP[orgRow]||[]).forEach(function(k){ own += countDocsDeep(k.row); });
    return own;
  }
  function bTree(pk, dp) {
    var ch = (byP[pk] || []).slice().sort(orgCmp);
    return ch.filter(function(o){ return !q || o.name.toLowerCase().indexOf(q) >= 0; }).map(function(o) {
      var isSpec = o.orgType === 'Спеціаліст';
      var isInact = o.status === 'inactive';
      var cnt = isSpec ? 0 : countDocsDeep(o.row);
      var hasKids = (byP[o.row] || []).length > 0;
      var kidH = hasKids ? bTree(o.row, dp+1) : '';
      var icon = isSpec ? '👤' : '🏢';
      var dimStyle = isInact ? ';opacity:.45' : '';
      var inactBadge = isInact ? '<span style="color:var(--red);font-size:.6rem;margin-left:3px">🚫</span>' : '';
      var subLabel = isSpec ? (o.fullName ? '<span style="color:var(--tx3);font-size:.68rem;margin-left:4px">' + esc(o.fullName) + '</span>' : '') : '';
      return '<div>' +
        '<div class="orow" style="padding-left:' + (8+dp*18) + 'px' + dimStyle + '">' +
        (hasKids ? '<button class="otog" onclick="event.stopPropagation();togOrg(this)">▶</button>' : '<span style="width:18px;display:inline-block"></span>') +
        '<span style="font-size:.8rem;margin-right:2px">' + icon + '</span>' +
        '<span class="onm" onclick="showOrgDet(\x27'+o.row+'\x27)">' + esc(o.name) + subLabel + inactBadge + '</span>' +
        (cnt ? '<span class="ocnt">' + cnt + '</span>' : '') +
        (o.orgType && o.orgType !== 'Спеціаліст' ? '<span class="ocnt" style="background:transparent;color:var(--tx3)">' + esc(o.orgType) + '</span>' : '') +
        '<div class="oacts" onclick="event.stopPropagation()">' +
        '<button class="ro-btn" onclick="moveOrgUp(\x27'+o.row+'\x27)" title="Підняти">⬆</button><button class="ro-btn" onclick="moveOrgDown(\x27'+o.row+'\x27)" title="Опустити">⬇</button>' +
        (!isSpec ? '<button onclick="openNewOrg(\x27'+o.row+'\x27)" title="Додати підрозділ">🏗</button><button onclick="openNewSpec(\x27'+o.row+'\x27)" title="Додати спеціаліста">👤</button>' : '') +
        '</div></div>' +
        (hasKids ? '<div class="okids">' + kidH + '</div>' : '') + '</div>';
    }).join('');
  }
  var html = bTree('root', 0);
  if (!html.trim()) { html = visible.filter(function(o){ return !q || o.name.toLowerCase().indexOf(q) >= 0; }).map(function(o) {
    var cnt = D.filter(function(d){ return d.from === o.name && !d.done; }).length;
    return '<div class="orow"><span class="onm" onclick="showOrgDet(\x27'+o.row+'\x27)">'+esc(o.name)+'</span>'+(cnt?'<span class="ocnt">'+cnt+'</span>':'')+'<div class="oacts" onclick="event.stopPropagation()"><button onclick="openNewOrg(\x27'+o.row+'\x27)">＋</button></div></div>';
  }).join(''); }
  c.innerHTML = html;
}

function togOrg(btn) { var kids = btn.closest('.orow').nextElementSibling; if (!kids || !kids.classList.contains('okids')) return; kids.classList.toggle('open'); btn.textContent = kids.classList.contains('open') ? '▼' : '▶'; }

function toggleOrgArchive() {
  ORG_ARCHIVE_OPEN = !ORG_ARCHIVE_OPEN;
  var btn = el('org-archive-btn');
  var arc = el('org-archive');
  var main = el('org-t');
  if (ORG_ARCHIVE_OPEN) {
    btn.classList.add('on'); btn.style.background='var(--red)'; btn.style.color='#fff';
    main.style.display = 'none';
    arc.style.display = '';
    renderOrgArchive();
  } else {
    btn.classList.remove('on'); btn.style.background=''; btn.style.color='';
    main.style.display = '';
    arc.style.display = 'none';
  }
}

function renderOrgArchive() {
  var deleted = O.filter(function(o) { return isOrgDeleted(o); });
  if (!deleted.length) {
    el('org-archive').innerHTML = '<div class="empty" style="padding:20px"><div class="ei">\u2705</div>\u0410\u0440\u0445\u0456\u0432 \u043f\u043e\u0440\u043e\u0436\u043d\u0456\u0439</div>';
    return;
  }
  var h = '<div style="padding:8px;background:rgba(239,68,68,.08);border:1px solid var(--red);border-radius:var(--r);margin-bottom:8px"><h3 style="font-size:.85rem;color:var(--red);margin-bottom:6px">\uD83D\uDDD1 \u0412\u0438\u0434\u0430\u043B\u0435\u043D\u0456 (' + deleted.length + ')</h3>';
  deleted.forEach(function(o) {
    var displayName = o.deletedName || (o.name||'').replace(/\[ВИДАЛЕНО\]\s*/gi,'').trim() || '\u2014';
    h += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg);border-radius:var(--r2);margin-bottom:3px;font-size:.76rem">';
    h += '<span style="color:var(--red)">\uD83D\uDDD1</span>';
    h += '<span style="flex:1"><b>' + esc(displayName) + '</b>';
    if (o.deletedAt) h += ' <span style="color:var(--tx3);font-size:.65rem">' + esc(o.deletedAt) + '</span>';
    h += '</span>';
    h += '<button class="btn btn-p btn-sm" style="font-size:.6rem" onclick="restoreOrg(\x27' + o.row + '\x27)">\u2705 \u0412\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438</button>';
    h += '</div>';
  });
  h += '</div>';
  el('org-archive').innerHTML = h;
}

function restoreOrg(row) {
  if (!confirm('\u0412\u0456\u0434\u043D\u043E\u0432\u0438\u0442\u0438?')) return;
  var o = null; for (var i=0;i<O.length;i++) if(O[i].row==row){o=O[i];break;} if(!o) return;
  var restoreName = o.deletedName || (o.name||'').replace(/\[ВИДАЛЕНО\]\s*/gi,'').trim() || 'Відновлена';
  var upd = {status:'', deletedAt:'', deletedName:''};
  if ((o.name||'').indexOf('[ВИДАЛЕНО]')>=0) { upd.shortName = restoreName; upd.name = restoreName; }
  db.collection('organizations').doc(row).update(upd).then(function(){
    toast('\u2705 \u0412\u0456\u0434\u043D\u043E\u0432\u043B\u0435\u043D\u043E'); loadData();
    if(ORG_ARCHIVE_OPEN) setTimeout(renderOrgArchive,500);
  }).catch(function(e){toast('\u274C '+e.message)});
}

function showOrgDet(row) {
  var o = null; for (var i=0;i<O.length;i++) if (O[i].row==row){o=O[i];break;} if (!o) return;
  var children = O.filter(function(c){ return String(c.parentRow) === String(o.row); });
  var subs = children.filter(function(c){ return c.orgType !== 'Спеціаліст'; });
  var specs = children.filter(function(c){ return c.orgType === 'Спеціаліст'; });
  // Find parent
  var parent = null;
  if (o.parentRow) { for (var i=0;i<O.length;i++) if (String(O[i].row)===String(o.parentRow)){parent=O[i];break;} }

  var h = '<div style="margin-top:18px">';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
  h += '<span style="font-size:1.3rem">' + (o.orgType === 'Спеціаліст' ? '👤' : '🏢') + '</span>';
  h += '<h2 style="font-size:1rem;font-weight:700">' + esc(o.name) + '</h2></div>';
  if (o.fullName) h += '<p style="font-size:.78rem;color:var(--tx2);margin-bottom:4px">' + esc(o.fullName) + '</p>';
  if (parent) h += '<p style="font-size:.72rem;color:var(--tx3);margin-bottom:6px">📂 ' + esc(parent.name) + '</p>';

  h += '<div style="font-size:.76rem;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px">';
  if (o.orgType) h += '<div>Тип: <b>' + esc(o.orgType) + '</b></div>';
  if (o.email) h += '<div>📧 <a href="mailto:' + esc(o.email) + '">' + esc(o.email) + '</a></div>';
  if (o.phone) h += '<div>📞 ' + esc(o.phone) + '</div>';
  if (o.contact) h += '<div>👤 ' + esc(o.contact) + '</div>';
  if (o.birthday) h += '<div>🎂 ' + esc(o.birthday) + '</div>';
  if (o.address) h += '<div style="grid-column:1/3">📍 ' + esc(o.address) + '</div>';
  if (o.edrpou) h += '<div>🏛 ЄДРПОУ: ' + esc(o.edrpou) + '</div>';
  if (o.website) h += '<div>🌐 <a href="' + esc(o.website) + '" target="_blank">' + esc(o.website) + '</a></div>';
  if (o.tabNum) h += '<div>🔢 Таб.№: ' + esc(o.tabNum) + '</div>';
  if (o.hireDate) h += '<div>📅 Прийнятий: ' + esc(o.hireDate) + '</div>';
  if (o.category) h += '<div>🏅 ' + esc(o.category) + '</div>';
  if (o.notes) h += '<div style="grid-column:1/3;color:var(--tx3);font-size:.7rem;font-style:italic">📝 ' + esc(o.notes) + '</div>';
  // Inactive status
  var isInactive = o.status === 'inactive';
  if (isInactive) h += '<div style="grid-column:1/3;color:var(--red);font-weight:700">🚫 ' + esc(o.statusNote || 'Неактивний') + '</div>';
  h += '</div>';

  // Subdivisions
  if (subs.length) {
    h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
    h += '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=this.nextElementSibling.style.display===\'none\'?\'▶\':\'▼\'" style="padding:6px 8px;cursor:pointer;font-size:.78rem;font-weight:700;display:flex;align-items:center;gap:4px;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0"><span>▼</span>🏗 Підрозділи (' + subs.length + ')</div>';
    h += '<div style="padding:4px">';
    subs.forEach(function(s) {
      var cnt = D.filter(function(d){ return d.from === s.name && !d.done; }).length;
      h += '<div class="orow" style="margin-bottom:2px" onclick="showOrgDet(\x27' + s.row + '\x27)"><span class="onm">🏢 ' + esc(s.name) + '</span>';
      if (s.orgType) h += '<span class="ocnt">' + esc(s.orgType) + '</span>';
      if (cnt) h += '<span class="ocnt" style="background:var(--acc);color:#fff">' + cnt + '</span>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  // Specialists
  if (specs.length) {
    h += '<div style="margin-bottom:8px;border:1px solid var(--brd);border-radius:var(--r2)">';
    h += '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=this.nextElementSibling.style.display===\'none\'?\'▶\':\'▼\'" style="padding:6px 8px;cursor:pointer;font-size:.78rem;font-weight:700;display:flex;align-items:center;gap:4px;background:var(--bg3);border-radius:var(--r2) var(--r2) 0 0"><span>▼</span>👥 Спеціалісти (' + specs.length + ')</div>';
    h += '<div style="padding:4px">';
    specs.forEach(function(s) {
      var sInact = s.status === 'inactive';
      h += '<div style="padding:5px 8px;background:var(--bg);border-radius:var(--r2);margin-bottom:2px;font-size:.75rem;cursor:pointer' + (sInact?';opacity:.5':'') + '" onclick="showOrgDet(\x27' + s.row + '\x27)">';
      h += '<div style="display:flex;justify-content:space-between"><b>👤 ' + esc(s.name) + '</b>';
      if (sInact) h += '<span style="color:var(--red);font-size:.65rem;font-weight:700">🚫 неактивний</span>';
      else if (s.fullName) h += '<span style="color:var(--tx3);font-size:.68rem">' + esc(s.fullName) + '</span>';
      h += '</div>';
      if (s.email || s.phone) {
        h += '<div style="font-size:.68rem;color:var(--tx2)">';
        if (s.email) h += '📧 ' + esc(s.email) + ' ';
        if (s.phone) h += '📞 ' + esc(s.phone);
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div></div>';
  }

  h += '<div class="btn-row">';
  h += '<button class="btn btn-p btn-sm" onclick="openNewOrg(\x27' + o.row + '\x27)" title="Додати підрозділ нижчого рівня">⬇ Нижче</button>';
  h += '<button class="btn btn-s btn-sm" onclick="openNewOrgAbove(\x27' + o.row + '\x27)" title="Додати вищу організацію">⬆ Вище</button>';
  h += '<button class="btn btn-p btn-sm" onclick="openNewSpec(\x27' + o.row + '\x27)" title="Додати спеціаліста">Спеціаліст</button>';
  h += '<button class="btn btn-s btn-sm" onclick="openEditOrg(\x27' + o.row + '\x27)">✏️</button>';
  h += '<button class="btn btn-s btn-sm" onclick="moveOrg(\x27' + o.row + '\x27)">►</button>';
  if (o.orgType === 'Спеціаліст' && !isInactive) h += '<button class="btn btn-s btn-sm" style="color:var(--orn)" onclick="deactivateSpec(\x27' + o.row + '\x27)" title="Позначити як неактивний">🚫 Неактивний</button>';
  if (o.orgType === 'Спеціаліст' && isInactive) h += '<button class="btn btn-s btn-sm" style="color:var(--grn)" onclick="reactivateSpec(\x27' + o.row + '\x27)" title="Повернути в активні">✅ Активувати</button>';
  h += '<button class="btn btn-d btn-sm" onclick="deleteOrg(\x27' + o.row + '\x27)" title="Видалити">🗑</button>';
  h += '<button class="btn btn-s btn-sm" onclick="closeP()">✕</button></div></div>';
  el('rpc').innerHTML = h; openP();
}


function orgParentSelect(currentParentRow, excludeRow) {
  var opts = '<option value="">— Без батьківської (корінь) —</option>';
  O.forEach(function(o) {
    if (o.orgType === 'Спеціаліст') return;
    if (isOrgDeleted(o) || isOrgEmpty(o)) return;
    if (excludeRow && String(o.row) === String(excludeRow)) return;
    var sel = String(o.row) === String(currentParentRow) ? ' selected' : '';
    var indent = '';
    // Show hierarchy level
    var lvl = parseInt(o.level) || 1;
    for (var i = 1; i < lvl; i++) indent += '— ';
    opts += '<option value="' + o.row + '"' + sel + '>' + indent + esc(o.name) + '</option>';
  });
  return opts;
}


function openNewOrg(parentRow) {
  var prOpts = orgParentSelect(parentRow, null);
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">🏢 Організація / Підрозділ</h2>' +
    '<input type="hidden" id="of-r" value="">' +
    '<div class="fg"><label>📂 Підпорядкування</label><select id="of-pr">' + prOpts + '</select></div>' +
    '<div class="fg"><label>Назва (скорочена)</label><input type="text" id="of-nm" placeholder="КОВА, РДА..."></div>' +
    '<div class="fg"><label>Повна назва</label><input type="text" id="of-fn" placeholder="Кіровоградська обласна..."></div>' +
    '<div class="fg"><label>Тип</label><select id="of-tp"><option value="">—</option><option>ОВА</option><option>РДА</option><option>ОМС</option><option>Департамент</option><option>Управління</option><option>Відділ</option><option>Сектор</option><option>Підприємство</option><option>Інше</option></select></div>' +
    '<div class="fg"><label>Email (декілька через ;)</label><input type="text" id="of-em" placeholder="email1@gov.ua; email2@gov.ua"></div>' +
    '<div class="fg"><label>Телефон (декілька через ;)</label><input type="text" id="of-ph" placeholder="+380...; +380..."></div>' +
    '<div class="fg"><label>Контактна особа</label><input type="text" id="of-ct"></div>' +
    '<div class="fg"><label>📍 Адреса</label><input type="text" id="of-addr" placeholder="вул. Шевченка, 1, м. Кропивницький"></div>' +
    '<div class="frow"><div class="fg"><label>ЄДРПОУ / ІПН</label><input type="text" id="of-edr" placeholder="12345678"></div>' +
    '<div class="fg"><label>🌐 Веб-сайт</label><input type="url" id="of-web" placeholder="https://..."></div></div>' +
    '<div class="fg"><label>📝 Примітки</label><textarea id="of-nt" style="min-height:40px"></textarea></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="saveOrg()">💾 Зберегти</button><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';
  openP();
}


function openNewSpec(parentRow) {
  var prOpts = orgParentSelect(parentRow, null);
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">👤 Спеціаліст</h2>' +
    '<input type="hidden" id="of-r" value="">' +
    '<div class="fg"><label>📂 Організація</label><select id="of-pr">' + prOpts + '</select></div>' +
    '<div class="fg"><label>ПІБ</label><input type="text" id="of-nm" placeholder="Іванов Іван Іванович"></div>' +
    '<div class="fg"><label>Посада</label><input type="text" id="of-fn" placeholder="Головний спеціаліст"></div>' +
    '<input type="hidden" id="of-tp" value="Спеціаліст">' +
    '<div class="fg"><label>Email (декілька через ;)</label><input type="text" id="of-em" placeholder="email@gov.ua; email2@gov.ua"></div>' +
    '<div class="fg"><label>Телефон (декілька через ;)</label><input type="text" id="of-ph" placeholder="+380...; +380..."></div>' +
    '<div class="fg"><label>🎂 Дата народження</label><div style="display:flex;gap:4px"><select id="of-bd" style="width:55px;background:var(--bg2);border:1px solid var(--brd);color:var(--tx);padding:4px;border-radius:var(--r2);font-size:.78rem"><option value="">Дн</option>' + (function(){var h='';for(var i=1;i<=31;i++)h+='<option value="'+i+'">'+i+'</option>';return h})() + '</select><select id="of-bm" style="width:80px;background:var(--bg2);border:1px solid var(--brd);color:var(--tx);padding:4px;border-radius:var(--r2);font-size:.78rem"><option value="">Міс</option><option value="1">Січень</option><option value="2">Лютий</option><option value="3">Березень</option><option value="4">Квітень</option><option value="5">Травень</option><option value="6">Червень</option><option value="7">Липень</option><option value="8">Серпень</option><option value="9">Вересень</option><option value="10">Жовтень</option><option value="11">Листопад</option><option value="12">Грудень</option></select><input type="number" id="of-by" placeholder="Рік" style="width:65px;background:var(--bg2);border:1px solid var(--brd);color:var(--tx);padding:4px;border-radius:var(--r2);font-size:.78rem"></div></div>' +
    '<input type="hidden" id="of-ct" value="">' +
    '<div class="frow"><div class="fg"><label>🔢 Табельний №</label><input type="text" id="of-tab" placeholder="001"></div>' +
    '<div class="fg"><label>📅 Дата прийняття</label><input type="date" id="of-hire"></div></div>' +
    '<div class="fg"><label>🏅 Категорія / Ранг</label><input type="text" id="of-cat" placeholder="Спеціаліст І категорії"></div>' +
    '<div class="fg"><label>📍 Адреса</label><input type="text" id="of-addr" placeholder="домашня адреса (необов.)"></div>' +
    '<div class="fg"><label>📝 Примітки</label><textarea id="of-nt" style="min-height:40px"></textarea></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="saveOrg()">💾 Зберегти</button><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';
  openP();
}


function openEditOrg(row) {
  var o = null; for (var i=0;i<O.length;i++) if (O[i].row==row){o=O[i];break;} if (!o) return;
  if (o.orgType === 'Спеціаліст') { openNewSpec(o.parentRow); } else { openNewOrg(o.parentRow); }
  setTimeout(function(){
    el('of-r').value=o.row; el('of-nm').value=o.name||''; el('of-fn').value=o.fullName||'';
    if(el('of-tp') && el('of-tp').tagName==='SELECT') el('of-tp').value=o.orgType||'';
    if(el('of-em')) el('of-em').value=o.email||'';
    if(el('of-ph')) el('of-ph').value=o.phone||'';
    if(el('of-ct')) el('of-ct').value=o.contact||'';
    if(el('of-pr')) el('of-pr').value=o.parentRow||'';
    // Restore birthday
    if(o.birthday && el('of-bd')) {
      var bp = o.birthday.match(/(\d{1,2})\.(\d{1,2})\.?(\d{4})?/);
      if(bp) { el('of-bd').value=parseInt(bp[1]); el('of-bm').value=parseInt(bp[2]); if(bp[3]&&el('of-by')) el('of-by').value=bp[3]; }
    }
    // Restore new fields
    if(el('of-addr')) el('of-addr').value = o.address || '';
    if(el('of-edr')) el('of-edr').value = o.edrpou || '';
    if(el('of-web')) el('of-web').value = o.website || '';
    if(el('of-nt')) el('of-nt').value = o.notes || '';
    if(el('of-tab')) el('of-tab').value = o.tabNum || '';
    if(el('of-hire') && o.hireDate) { var hd = pD(o.hireDate); if(hd) el('of-hire').value = hd.getFullYear()+'-'+p2(hd.getMonth()+1)+'-'+p2(hd.getDate()); }
    if(el('of-cat')) el('of-cat').value = o.category || '';
  }, 60);
}


function saveOrg() {
  var row=el('of-r').value, nm=el('of-nm').value.trim();
  if(!nm){toast('⚠️ Вкажіть назву');return;}
  var hireDt = '';
  if (el('of-hire') && el('of-hire').value) { var hp = el('of-hire').value.split('-'); hireDt = hp[2]+'.'+hp[1]+'.'+hp[0]; }
  var data = {
    action: row ? 'editOrg' : 'addOrg',
    row: row || undefined,
    name: nm,
    fullName: el('of-fn') ? el('of-fn').value.trim() : '',
    orgType: el('of-tp') ? el('of-tp').value : '',
    email: el('of-em') ? el('of-em').value.trim() : '',
    phone: el('of-ph') ? el('of-ph').value.trim() : '',
    contact: el('of-ct') ? el('of-ct').value.trim() : '',
    parentRow: el('of-pr') ? el('of-pr').value : '',
    birthday: (function(){ var bd=el('of-bd'),bm=el('of-bm'),by=el('of-by'); if(!bd||!bd.value||!bm||!bm.value)return ''; var s=p2(parseInt(bd.value))+'.'+p2(parseInt(bm.value)); if(by&&by.value) s+='.'+by.value; return s; })(),
    address: el('of-addr') ? el('of-addr').value.trim() : '',
    edrpou: el('of-edr') ? el('of-edr').value.trim() : '',
    website: el('of-web') ? el('of-web').value.trim() : '',
    notes: el('of-nt') ? el('of-nt').value.trim() : '',
    tabNum: el('of-tab') ? el('of-tab').value.trim() : '',
    hireDate: hireDt,
    category: el('of-cat') ? el('of-cat').value.trim() : ''
  };
  toast('💾...');
  apiP(data).then(function(r){
    if(r.ok||r.row){toast('✅');logAction(row?'editOrg':'addOrg',nm);closeP();loadData()}else toast('❌ '+(r.error||''))
  }).catch(function(e){toast('❌ '+e.message)});
}


function openNewOrgAbove(childRow) {
  var child = null; for (var i=0;i<O.length;i++) if(O[i].row==childRow){child=O[i];break;} if(!child) return;
  var prOpts = orgParentSelect(child.parentRow, childRow);
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:6px">⬆ Вища організація для: ' + esc(child.name) + '</h2>' +
    '<p style="font-size:.72rem;color:var(--tx2);margin-bottom:10px">Нова стане батьківською. "' + esc(child.name) + '" буде перенесено автоматично.</p>' +
    '<input type="hidden" id="of-r" value=""><input type="hidden" id="of-above-child" value="' + childRow + '">' +
    '<div class="fg"><label>Підпорядкування нової</label><select id="of-pr">' + prOpts + '</select></div>' +
    '<div class="fg"><label>Назва</label><input type="text" id="of-nm"></div>' +
    '<div class="fg"><label>Тип</label><select id="of-tp"><option value="">—</option><option>ОВА</option><option>РДА</option><option>Департамент</option><option>Управління</option><option>Відділ</option><option>Сектор</option><option>Інше</option></select></div>' +
    '<div class="fg"><label>Email</label><input type="text" id="of-em"></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="saveOrgAbove()">Зберегти та перенести</button><button class="btn btn-s" onclick="closeP()">← Закрити</button></div></div>';
  openP();
}

function saveOrgAbove() {
  var nm = el('of-nm') ? el('of-nm').value.trim() : '';
  if (!nm) { toast('Вкажіть назву'); return; }
  var childRow = el('of-above-child') ? el('of-above-child').value : '';
  apiP({action:'addOrg', name:nm, fullName:'', orgType:el('of-tp')?el('of-tp').value:'', email:el('of-em')?el('of-em').value.trim():'', parentRow:el('of-pr')?el('of-pr').value:''}).then(function(r) {
    if (!r.ok || !r.row) { toast('Помилка: ' + (r.error||'')); return; }
    apiP({action:'editOrg', row:childRow, parentRow:r.row}).then(function(r2) {
      if (r2.ok) { toast('Переміщено'); closeP(); loadData(); }
      else toast('Помилка: ' + (r2.error||''));
    });
  }).catch(function(e){ toast('Помилка: ' + e.message); });
}

function moveOrg(row) {
  var o = null; for (var i=0;i<O.length;i++) if (O[i].row==row){o=O[i];break;} if (!o) return;
  var opts = orgParentSelect(o.parentRow, row);
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">📁 Перемістити: ' + esc(o.name) + '</h2>' +
    '<div class="fg"><label>Нова батьківська організація</label><select id="mv-parent">' + opts + '</select></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="doMoveOrg(\x27' + row + '\x27)">✅ Перемістити</button><button class="btn btn-s" onclick="showOrgDet(\x27' + row + '\x27)">← Назад</button></div></div>';
  openP();
}


function doMoveOrg(row) {
  var newParent = el('mv-parent').value;
  apiP({action:'editOrg', row:row, parentRow:newParent}).then(function(r) {
    if (r.ok) { toast('✅ Переміщено'); closeP(); loadData(); } else toast('❌ ' + (r.error || ''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}


/* ─── DELETE ORG ─── */
function deleteOrg(row) {
  var o = null; for (var i=0;i<O.length;i++) if(O[i].row==row){o=O[i];break;} if(!o) return;
  var children = O.filter(function(c){ return String(c.parentRow) === String(row); });
  if (children.length) { toast('⚠️ Спочатку видаліть підлеглих (' + children.length + ')'); return; }
  if (!confirm('Видалити "' + o.name + '"?')) return;
  var now = new Date(); var delDate = p2(now.getDate())+'.'+p2(now.getMonth()+1)+'.'+now.getFullYear();
  db.collection('organizations').doc(row).update({status:'deleted', deletedAt:delDate, deletedName:o.name}).then(function(){
    toast('🗑 Видалено'); closeP(); loadData();
  }).catch(function(e) { toast('❌ ' + e.message); });
}


function applyOrgStatuses() {
  O.forEach(function(o) {
    if (ORG_STATUS[o.row]) {
      o.status = ORG_STATUS[o.row].status || '';
      o.statusNote = ORG_STATUS[o.row].note || '';
    }
    // Also hide deleted
    if (o.orgType === 'Видалено') o.status = 'deleted';
  });
}


function deactivateSpec(row) {
  var o = null; for (var i=0;i<O.length;i++) if(O[i].row==row){o=O[i];break;} if(!o) return;
  var note = prompt('Причина (звільнений / на іншій посаді / декрет / ...):');
  if (note === null) return;
  var now = new Date();
  var dateStr = p2(now.getDate())+'.'+p2(now.getMonth()+1)+'.'+now.getFullYear();
  ORG_STATUS[row] = {status:'inactive', note:(note||'Неактивний') + ' з ' + dateStr, date:dateStr};
  localStorage.setItem('k4_org_status', JSON.stringify(ORG_STATUS));
  applyOrgStatuses();
  toast('🚫 ' + o.name + ' — неактивний');
  showOrgDet(row);
}


function reactivateSpec(row) {
  var o = null; for (var i=0;i<O.length;i++) if(O[i].row==row){o=O[i];break;} if(!o) return;
  if (!confirm('Повернути "' + o.name + '" в активні?')) return;
  var prev = ORG_STATUS[row] || {};
  // Store history
  var hist = JSON.parse(localStorage.getItem('k4_org_history') || '{}');
  if (!hist[row]) hist[row] = [];
  hist[row].push(prev);
  localStorage.setItem('k4_org_history', JSON.stringify(hist));
  delete ORG_STATUS[row];
  localStorage.setItem('k4_org_status', JSON.stringify(ORG_STATUS));
  applyOrgStatuses();
  toast('✅ ' + o.name + ' — активний');
  showOrgDet(row);
}

function toggleOrgReorder() {
  ORG_REORDER = !ORG_REORDER;
  var btn = el('org-reorder-btn');
  var tree = el('org-t');
  if (ORG_REORDER) {
    btn.classList.add('active');
    btn.textContent = '💾 Зберегти порядок';
    tree.classList.add('reorder-on');
  } else {
    btn.classList.remove('active');
    btn.textContent = '↕ Порядок';
    tree.classList.remove('reorder-on');
    localStorage.setItem('k4_org_order', JSON.stringify(ORG_ORDER));
    toast('✅ Порядок збережено');
  }
}

function moveOrgUp(row) {
  var o = null; for (var i=0;i<O.length;i++) if(O[i].row==row){o=O[i];break;} if(!o) return;
  var siblings = O.filter(function(s){ return !isOrgDeleted(s) && !isOrgEmpty(s) && String(s.parentRow||'root') === String(o.parentRow||'root'); });
  siblings.sort(orgCmp);
  // Assign sequential order to all siblings first
  for (var i=0;i<siblings.length;i++) { ORG_ORDER[siblings[i].row] = i; }
  var idx = -1; for(var i=0;i<siblings.length;i++) if(siblings[i].row==row){idx=i;break;}
  if (idx <= 0) { toast('⬆ Вже перший'); return; }
  // Swap
  ORG_ORDER[row] = idx - 1;
  ORG_ORDER[siblings[idx-1].row] = idx;
  localStorage.setItem('k4_org_order', JSON.stringify(ORG_ORDER));
  renderOrgs(); toast('⬆');
}

function moveOrgDown(row) {
  var o = null; for (var i=0;i<O.length;i++) if(O[i].row==row){o=O[i];break;} if(!o) return;
  var siblings = O.filter(function(s){ return !isOrgDeleted(s) && !isOrgEmpty(s) && String(s.parentRow||'root') === String(o.parentRow||'root'); });
  siblings.sort(orgCmp);
  for (var i=0;i<siblings.length;i++) { ORG_ORDER[siblings[i].row] = i; }
  var idx = -1; for(var i=0;i<siblings.length;i++) if(siblings[i].row==row){idx=i;break;}
  if (idx < 0 || idx >= siblings.length-1) { toast('⬇ Вже останній'); return; }
  ORG_ORDER[row] = idx + 1;
  ORG_ORDER[siblings[idx+1].row] = idx;
  localStorage.setItem('k4_org_order', JSON.stringify(ORG_ORDER));
  renderOrgs(); toast('⬇');
}


/* ─── CONTACT PICKER POPUP ─── */
function openContactPicker(targetInputId) {
  var h = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:8px">📋 Довідник контактів</h2>';
  h += '<input type="text" id="cp-search" placeholder="🔍 Пошук..." oninput="filterContacts()" style="width:100%;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:6px 10px;border-radius:var(--r);font-size:.8rem;outline:none;margin-bottom:8px">';
  h += '<div id="cp-list" style="max-height:400px;overflow-y:auto">';
  h += buildContactTree('root', 0);
  h += '</div>';
  h += '<div style="margin-top:8px;border-top:1px solid var(--brd);padding-top:8px">';
  h += '<div class="fg"><label>Або введіть вручну та додайте в довідник:</label>';
  h += '<div style="display:flex;gap:4px"><input type="text" id="cp-new" placeholder="ПІБ або назва" style="flex:1;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:5px 8px;border-radius:var(--r2);font-size:.78rem">';
  h += '<button class="btn btn-p btn-sm" onclick="addContactFromPicker()">＋ Додати</button></div></div>';
  h += '</div>';
  h += '<div class="btn-row"><button class="btn btn-s" onclick="closeP()">✕ Закрити</button></div></div>';
  window._cpTarget = targetInputId;
  el('rpc').innerHTML = h;
  openP();
}


function buildContactTree(parentKey, depth) {
  var children = O.filter(function(o) { return String(o.parentRow || 'root') === parentKey; });
  children.sort(function(a,b){ return orgCmp(a,b); });
  var h = '';
  children.forEach(function(o) {
    var isSpec = o.orgType === 'Спеціаліст';
    var icon = isSpec ? '👤' : '🏢';
    var indent = depth * 14;
    var clickable = true;
    var label = o.name + (o.fullName && isSpec ? ' — ' + o.fullName : '') + (o.email ? ' (' + o.email + ')' : '');
    h += '<div class="cp-item" data-name="' + esc(o.name) + '" data-email="' + esc(o.email || '') + '" onclick="selectContact(this)" style="padding:5px 8px;padding-left:' + (8+indent) + 'px;cursor:pointer;font-size:.76rem;border-bottom:1px solid var(--bg3);display:flex;align-items:center;gap:4px">';
    h += '<span>' + icon + '</span><span class="cp-name">' + esc(label) + '</span>';
    h += '</div>';
    h += buildContactTree(String(o.row), depth + 1);
  });
  return h;
}


function filterContacts() {
  var q = (el('cp-search').value || '').trim().toLowerCase();
  var items = document.querySelectorAll('.cp-item');
  items.forEach(function(it) {
    var name = (it.querySelector('.cp-name') || {}).textContent || '';
    it.style.display = (!q || name.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
  });
}


function addContactFromPicker() {
  var name = el('cp-new') ? el('cp-new').value.trim() : '';
  if (!name) { toast('⚠️ Введіть назву'); return; }
  // Save to directory as specialist at root level
  apiP({action:'addOrg', name:name, fullName:'', orgType:'Спеціаліст', email:'', phone:'', contact:'', parentRow:''}).then(function(r) {
    if (r.ok) {
      toast('✅ Додано в довідник');
      // Also set value
      var targetId = window._cpTarget;
      if (targetId && el(targetId)) el(targetId).value = name;
      closeP();
      loadData();
    } else toast('❌ ' + (r.error || ''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}


function selectContact(elem) {
  var name = elem.getAttribute('data-name');
  var email = elem.getAttribute('data-email');
  var targetId = window._cpTarget;
  if (targetId && el(targetId)) {
    el(targetId).value = name;
  }
  // Auto-fill email if available
  if (email && el('df-em') && !el('df-em').value) {
    el('df-em').value = email;
  }
  closeP();
  toast('✅ ' + name);
}

