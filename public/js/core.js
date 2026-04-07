/* ══ Core UI ══ */
var D = [], O = [], F = [];
var COMMS = [], MT = [], DC = [];
var MBR = [];
var CUR_USER = null;
var PERMS = {};
var TAB = 'myday', CM = new Date().getMonth(), CY = new Date().getFullYear();
var ST = new Set();
var DR = JSON.parse(localStorage.getItem('k4_dr') || '{}');
var TP = JSON.parse(localStorage.getItem('k4_tp') || '[]');
var PU = localStorage.getItem('k4_push') === '1';
var NF = {}, chDisc = null, chTrend = null;
var MO = ['\u0421\u0456\u0447\u0435\u043d\u044c','\u041b\u044e\u0442\u0438\u0439','\u0411\u0435\u0440\u0435\u0437\u0435\u043d\u044c','\u041a\u0432\u0456\u0442\u0435\u043d\u044c','\u0422\u0440\u0430\u0432\u0435\u043d\u044c','\u0427\u0435\u0440\u0432\u0435\u043d\u044c','\u041b\u0438\u043f\u0435\u043d\u044c','\u0421\u0435\u0440\u043f\u0435\u043d\u044c','\u0412\u0435\u0440\u0435\u0441\u0435\u043d\u044c','\u0416\u043e\u0432\u0442\u0435\u043d\u044c','\u041b\u0438\u0441\u0442\u043e\u043f\u0430\u0434','\u0413\u0440\u0443\u0434\u0435\u043d\u044c'];
var DA = ['\u041f\u043d','\u0412\u0442','\u0421\u0440','\u0427\u0442','\u041f\u0442','\u0421\u0431','\u041d\u0434'];
var TM = {'\u0412\u0410\u0416\u041b\u0418\u0412\u041e':{c:'tag-imp',x:'#f97316'},'\u0412\u0415\u0411\u0406\u041d\u0410\u0420':{c:'tag-web',x:'#3b82f6'},'\u041d\u0410 \u041f\u0406\u0414\u041f\u0418\u0421\u0406':{c:'tag-sign',x:'#eab308'}};
var _debT = null;
var INBOX_MODE = false;


function el(id) { return document.getElementById(id); }

function p2(n) { return String(n).padStart(2, '0'); }

function isoT() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth()+1) + '-' + p2(d.getDate()); }


function pD(s) {
  if (!s) return null;
  s = String(s).trim();
  var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]);
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1], 23, 59);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fD(s) {
  var d = pD(s); if (!d) return s || '—';
  var r = p2(d.getDate()) + '.' + p2(d.getMonth()+1) + '.' + d.getFullYear();
  // Only show time if explicitly set (not 23:59, 00:00, 12:00)
  var hh = d.getHours(), mm = d.getMinutes();
  if (!((hh===23&&mm===59)||(hh===0&&mm===0)||(hh===12&&mm===0))) r += ' ' + p2(hh) + ':' + p2(mm);
  return r;
}

function hasExplicitTime(s) {
  var d = pD(s); if (!d) return false;
  var hh = d.getHours(), mm = d.getMinutes();
  return !((hh===23&&mm===59)||(hh===0&&mm===0)||(hh===12&&mm===0));
}

function dC(s) { var d = pD(s); if (!d) return ''; var x = (d - new Date()) / 864e5; if (x < 0) return 'over'; if (x < 3) return 'soon'; return ''; }

function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function toast(m) { var e = el('toast'); e.textContent = m; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(function(){ e.classList.remove('show'); }, 3000); }

/* api() and apiP() are defined in Firebase API layer above */

/* ─── TOGGLE TOPBAR / SIDEBAR ─── */
function toggleTopbar() {
  el('topbar').classList.toggle('hide');
  var hidden = el('topbar').classList.contains('hide');
  el('sidebar').style.top = hidden ? '0' : 'var(--top-h)';
  el('rp').style.top = hidden ? '0' : 'var(--top-h)';
  el('main-area').style.paddingTop = hidden ? '8px' : '';
  localStorage.setItem('k4_tb', hidden ? '0' : '1');
}

function toggleSidebar() {
  var sb = el('sidebar');
  sb.classList.toggle('mini');
  var mini = sb.classList.contains('mini');
  el('main-area').style.marginLeft = mini ? 'var(--sb-mini)' : '';
  localStorage.setItem('k4_sb', mini ? '0' : '1');
}


/* ─── LOAD ─── */
function loadData() {
  el('cards').innerHTML = '<div class="loader"><div class="spin"></div></div>';
  api({action:'getAll'}).then(function(r) {
    if (r.error) { toast('❌ ' + r.error); return; }
    D = (r.docs || []).map(function(d) {
      if (typeof d.tags === 'string') {
        try { if (d.tags.charAt(0) === '[') d.tags = JSON.parse(d.tags); else d.tags = d.tags.split(',').map(function(s){return s.trim()}).filter(Boolean); } catch(e) { d.tags = []; }
      }
      if (!Array.isArray(d.tags)) d.tags = [];
      return d;
    });
    O = r.orgs || [];
    // Cache orgs for instant form rendering
    try { localStorage.setItem('k4_orgs_cache', JSON.stringify(O)); } catch(e) {}
    COMMS = r.comms || []; MT = r.meets || []; DC = r.decisions || []; MBR = r.members || [];
    applyOrgStatuses();
    fillSel(); applyF(); updateBell();
    // Auto-check birthdays once per day
    var bdCheck = localStorage.getItem('k4_bd_check');
    var todayStr = isoT();
    if (bdCheck !== todayStr) {
      apiP({action:'checkBirthdays'}).then(function(r) {
        if (r.created > 0) { toast('🎂 Створено ' + r.created + ' привітань!'); loadData(); }
        localStorage.setItem('k4_bd_check', todayStr);
      }).catch(function(){});
    }
    if (TAB === 'myday') renderMD();
    if (TAB === 'calendar') renderCal();
    if (TAB === 'orgs') renderOrgs();
    if (TAB === 'inbox') renderInbox();
    if (TAB === 'comms') renderComms();
    if (TAB === 'reports') renderRpt();
  }).catch(function() {
    el('cards').innerHTML = '<div class="empty"><div class="ei">⚠\uFE0F</div>\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0437\u0432\x27\u044f\u0437\u043a\u0443 \u0437 Firebase.</div>';
  });
}


function fillSel() {
  var execs = [], types = [], froms = [];
  D.forEach(function(d) {
    if (d.executor && execs.indexOf(d.executor) < 0) execs.push(d.executor);
    if (d.type && types.indexOf(d.type) < 0) types.push(d.type);
    if (d.from && froms.indexOf(d.from) < 0) froms.push(d.from);
  });
  execs.sort(); types.sort(); froms.sort();
  ['f-ex','rf-ex'].forEach(function(id) { var s = el(id); if (!s) return; var v = s.value; s.innerHTML = '<option value="">Усі виконавці</option>'; execs.forEach(function(e){ s.innerHTML += '<option>' + esc(e) + '</option>'; }); s.value = v; });
  ['f-tp','rf-tp','cf-tp'].forEach(function(id) { var s = el(id); if (!s) return; var v = s.value; s.innerHTML = '<option value="">Усі типи</option>'; types.forEach(function(e){ s.innerHTML += '<option>' + esc(e) + '</option>'; }); s.value = v; });
  var cf = el('cf-fr'); if (cf) { cf.innerHTML = '<option value="">Усі організації</option>'; froms.forEach(function(e){ cf.innerHTML += '<option>' + esc(e) + '</option>'; }); }
  var ibf = el('ib-fr'); if (ibf) { var v = ibf.value; ibf.innerHTML = '<option value="">Усі відправники</option>'; froms.forEach(function(e){ ibf.innerHTML += '<option>' + esc(e) + '</option>'; }); ibf.value = v; }
}


function renderTC() {
  var c = el('tc'); c.innerHTML = '';
  Object.keys(TM).forEach(function(t) {
    var on = ST.has(t), i = TM[t];
    var sp = document.createElement('span');
    sp.className = 'tchip' + (on ? ' on' : '');
    sp.textContent = t;
    sp.style.background = on ? i.x + '33' : 'transparent';
    sp.style.color = i.x; sp.style.borderColor = i.x;
    sp.onclick = function() { if (ST.has(t)) ST.delete(t); else ST.add(t); renderTC(); applyF(); };
    c.appendChild(sp);
  });
}


function showTab(t) {
  TAB = t;
  document.querySelectorAll('[id^="tab-"]').forEach(function(e) { e.style.display = 'none'; });
  var e = el('tab-' + t); if (e) e.style.display = '';
  document.querySelectorAll('.sidebar .nav-btn').forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
  // Clear search/filters when switching tabs
  if (el('f-q')) el('f-q').value = '';
  if (el('f-st')) el('f-st').value = '';
  if (el('f-ex')) el('f-ex').value = '';
  if (el('f-tp')) el('f-tp').value = '';
  if (el('f-df')) el('f-df').value = '';
  if (el('f-dt')) el('f-dt').value = '';
  if (t === 'main') applyF();
  if (t === 'myday') renderMD();
  if (t === 'inbox') renderInbox();
  if (t === 'calendar') renderCal();
  if (t === 'comms') renderComms();
  if (t === 'reports') renderRpt();
  if (t === 'orgs') renderOrgs();
  if (t === 'settings') { loadUsers(); loadPendingDeletes(); }
}

function debApplyF() { clearTimeout(_debT); _debT = setTimeout(applyF, 250); }

function applyF() {
  CUR_PAGE = 0;
  var q = el('f-q').value.trim().toLowerCase();
  var st = el('f-st').value, ex = el('f-ex').value, tp = el('f-tp').value;
  var df = el('f-df').value, dt = el('f-dt').value;
  var now = new Date();
  if (q) {
    // Fields shared across parent+children (same for whole series)
    // Match here → show parent only (no duplicates)
    var SHARED = function(d) {
      var base = [d.name||'',d.desc||'',d.from||'',d.inNum||'',d.type||'',String(d.num||''),d.executor||'',d.reportTo||'',(d.tags||[]).join(' ')].join(' ');
      // Include extra dates descriptions, executors, reportTo
      try { var ex = d.extraDates ? (typeof d.extraDates==='string'?JSON.parse(d.extraDates):d.extraDates) : [];
        ex.forEach(function(e){ base += ' '+(e.desc||'')+' '+(e.executor||'')+' '+(e.reportTo||'')+' '+(e.from||''); });
      } catch(e){}
      return base.toLowerCase();
    };
    // Fields truly unique per document (differ between parent and children)
    // Match here → show this exact document
    var UNIQUE = function(d) { return [d.notes||'',d.log||'',d.done||'',d.respNum||'',d.doneDate||''].join(' ').toLowerCase(); };

    var showRows = {}, shownParents = {};
    D.forEach(function(d) {
      var pid = String(d.parentId || '');
      var isChild = pid && pid !== String(d.row);
      var sharedMatch = SHARED(d).indexOf(q) >= 0;
      var uniqueMatch = UNIQUE(d).indexOf(q) >= 0;

      if (!sharedMatch && !uniqueMatch) return; // no match at all

      if (sharedMatch && !uniqueMatch) {
        // Match in shared fields (name, from, №) → show PARENT only
        if (isChild) {
          // Find parent and show it (once)
          if (!shownParents[pid]) {
            for (var j = 0; j < D.length; j++) {
              if (String(D[j].row) === pid) { showRows[D[j].row] = true; break; }
            }
            shownParents[pid] = true;
          }
          // Don't show this child
        } else {
          // This IS the parent or standalone
          showRows[d.row] = true;
          shownParents[String(d.row)] = true;
        }
      } else {
        // Match in unique fields (notes, log, comments) → show THIS exact doc
        showRows[d.row] = true;
        // If this is a child with unique match, also show parent for context (once)
        if (isChild && !shownParents[pid]) {
          for (var j = 0; j < D.length; j++) {
            if (String(D[j].row) === pid) { showRows[D[j].row] = true; break; }
          }
          shownParents[pid] = true;
        }
      }
    });

    F = D.filter(function(d) {
      if (!showRows[d.row]) return false;
      if (st === 'active' && d.done) return false;
      if (st === 'done' && !d.done) return false;
      if (st === 'overdue') { if (d.done) return false; var dl = pD(d.deadline); if (!dl || dl > now) return false; }
      if (ex && d.executor !== ex) return false;
      if (tp && d.type !== tp) return false;
      if (INBOX_MODE && (!d.from || d.type === 'Привітання')) return false;
      if (ST.size > 0 && !(d.tags || []).some(function(t){ return ST.has(t); })) return false;
      return true;
    });
  } else {
    F = D.filter(function(d) {
      var pid = String(d.parentId || '');
      if (pid && pid !== String(d.row) && pid !== '') return false;
      if (st === 'active' && d.done) return false;
      if (st === 'done' && !d.done) return false;
      if (st === 'overdue') { if (d.done) return false; var dl = pD(d.deadline); if (!dl || dl > now) return false; }
      if (ex && d.executor !== ex) return false;
      if (tp && d.type !== tp) return false;
      if (INBOX_MODE && (!d.from || d.type === 'Привітання')) return false;
      if (ST.size > 0 && !(d.tags || []).some(function(t){ return ST.has(t); })) return false;
      if (df || dt) { var dl = pD(d.deadline); if (!dl) return false;
        var isOverdue = !d.done && dl < now;
        if (df && !isOverdue) { var f = new Date(df); f.setHours(0,0,0,0); if (dl < f) return false; }
        if (dt) { var t2 = new Date(dt); t2.setHours(23,59,59); if (dl > t2) return false; } }
      return true;
    });
  }
  var sortBy = el('f-sort') ? el('f-sort').value : 'deadline';
  F.sort(function(a,b) {
    var oa = DR[a.row] || 9999, ob = DR[b.row] || 9999;
    if (oa !== 9999 || ob !== 9999) { if (oa !== ob) return oa - ob; }
    if (sortBy === 'num') return (parseInt(a.num)||0) - (parseInt(b.num)||0);
    if (sortBy === 'type') return (a.type||'').localeCompare(b.type||'');
    if (sortBy === 'from') return (a.from||'').localeCompare(b.from||'');
    if (sortBy === 'name') return (a.name||'').localeCompare(b.name||'');
    if (sortBy === 'executor') return (a.executor||'').localeCompare(b.executor||'');
    var da = pD(a.deadline), db = pD(b.deadline);
    if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db;
  });
  renderDashboard();
  renderCards();
}

function resetF() { el('f-q').value = ''; el('f-st').value = ''; el('f-ex').value = ''; el('f-tp').value = ''; if(el('f-sort')) el('f-sort').value = 'deadline'; ST.clear(); renderTC(); el('f-df').value = ''; el('f-dt').value = ''; el('btn-all').classList.remove('on'); applyF(); }


function quickFilter(preset) {
  resetF();
  var now = new Date(), td = new Date(); td.setHours(0,0,0,0);
  if (preset === 'overdue') {
    el('f-st').value = 'overdue';
  } else if (preset === 'no-resp') {
    // Show active docs without response
    el('f-st').value = 'active';
    // Will post-filter in applyF — for now just show active and user checks
  } else if (preset === 'sign') {
    el('f-st').value = 'active';
    // Search for "на підписі" tag or status
    ST.add('НА ПІДПИСІ'); renderTC();
  } else if (preset === 'my') {
    // Show only docs where I'm executor
    var myName = CUR_USER ? (CUR_USER.name || CUR_USER.login) : '';
    if (myName) { el('f-ex').value = myName; }
  } else if (preset === 'week') {
    el('f-st').value = 'active';
    el('f-df').value = isoT();
    var wk = new Date(td); wk.setDate(wk.getDate()+7);
    el('f-dt').value = wk.getFullYear()+'-'+p2(wk.getMonth()+1)+'-'+p2(wk.getDate());
  }
  applyF();
}

function showAllD() { el('f-df').value = ''; el('f-dt').value = ''; el('btn-all').classList.toggle('on'); applyF(); }

function toggleInboxFilter() {
  INBOX_MODE = !INBOX_MODE;
  var btn = el('btn-inbox');
  if (btn) btn.classList.toggle('on', INBOX_MODE);
  applyF();
}

function renderInbox() {
  var c = el('ib-list');
  var q = (el('ib-q').value || '').trim().toLowerCase();
  var st = el('ib-st') ? el('ib-st').value : '';
  var fr = el('ib-fr') ? el('ib-fr').value : '';
  var now = new Date();
  var items = D.filter(function(d) {
    var pid = String(d.parentId || '');
    if (pid && pid !== String(d.row) && pid !== '') return false;
    if (d.type === 'Привітання') return false;
    if (st === 'active' && d.done) return false;
    if (st === 'done' && !d.done) return false;
    if (st === 'overdue') { if (d.done) return false; var dl = pD(d.deadline); if (!dl || dl > now) return false; }
    if (fr && d.from !== fr) return false;
    if (q) { var s = [d.name,d.desc,d.from,d.type,d.inNum].join(' ').toLowerCase(); if (s.indexOf(q) < 0) return false; }
    return true;
  });
  items.sort(function(a,b) { var da = pD(a.deadline), db = pD(b.deadline); if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da - db; });

  if (!items.length) { c.innerHTML = '<div class="empty"><div class="ei">📨</div>Немає вхідних</div>'; updateMassBar(); return; }
  var h = '';
  items.forEach(function(d) {
    var dc = d.done ? '' : dC(d.deadline);
    var sel = SELECTED[d.row] ? ' selected' : '';
    var chk = SELECTED[d.row] ? ' checked' : '';
    var nameH = q ? hlQ(esc(d.name || d.desc || '—'), q) : esc(d.name || d.desc || '—');
    var fromH = q ? hlQ(esc(d.from || ''), q) : esc(d.from || '');
    var descH = '';
    if (q && d.desc && d.desc.toLowerCase().indexOf(q) >= 0) {
      var idx = d.desc.toLowerCase().indexOf(q);
      var start = Math.max(0, idx - 30);
      var snippet = (start > 0 ? '...' : '') + d.desc.substring(start, idx + q.length + 30) + (idx + q.length + 30 < d.desc.length ? '...' : '');
      descH = '<div style="font-size:.68rem;color:var(--tx3);margin-top:2px">' + hlQ(esc(snippet), q) + '</div>';
    }
    h += '<div class="card ib-card' + sel + '" data-row="' + d.row + '">';
    h += '<input type="checkbox" class="ib-cb"' + chk + ' onclick="event.stopPropagation();toggleSelect(\x27' + d.row + '\x27,this)" title="Обрати">';
    h += '<div onclick="openDet(\x27' + d.row + '\x27)">';
    h += '<div class="card-top"><div class="card-title">' + nameH + '</div><span class="card-badge">' + esc(d.type || '—') + '</span></div>';
    h += '<div class="card-sub">' + fromH + (d.inNum ? ' • №' + esc(d.inNum) : '') + '</div>';
    h += '<div class="card-meta"><span class="card-dl ' + dc + '">📅 ' + esc(fD(d.deadline)) + '</span>' + (d.executor ? '<span>👤 ' + esc(d.executor) + '</span>' : '') + '</div>';
    h += descH;
    h += '</div></div>';
  });
  c.innerHTML = h;
  updateMassBar();
}

function renderDashboard() {
  var now = new Date(), td = new Date(); td.setHours(0,0,0,0);
  var tom = new Date(td); tom.setDate(tom.getDate()+1);
  var all = D.length, active = 0, overdue = 0, doneToday = 0;
  D.forEach(function(d) {
    if (!d.done) { active++; var dl = pD(d.deadline); if (dl && dl < td) overdue++; }
    else { var dd = pD(d.doneDate); if (dd && dd >= td && dd < tom) doneToday++; }
  });
  var _td7 = new Date(); _td7.setHours(0,0,0,0);
  var _tom7 = new Date(_td7); _tom7.setDate(_td7.getDate()+1);
  var _dat2 = new Date(_td7); _dat2.setDate(_td7.getDate()+2);
  var _wk7 = new Date(_td7); _wk7.setDate(_td7.getDate()+7);
  var _mn7 = new Date(_td7); _mn7.setDate(_td7.getDate()+30);
  var _todayCnt2 = D.filter(function(d){ if(d.done)return false; var dl=pD(d.deadline); return dl&&dl>=_td7&&dl<_tom7; }).length;
  var _tomCnt = D.filter(function(d){ if(d.done)return false; var dl=pD(d.deadline); return dl&&dl>=_tom7&&dl<_dat2; }).length;
  var _wkCnt = D.filter(function(d){ if(d.done)return false; var dl=pD(d.deadline); return dl&&dl>=_td7&&dl<_wk7; }).length;
  var _mnCnt = D.filter(function(d){ if(d.done)return false; var dl=pD(d.deadline); return dl&&dl>=_td7&&dl<_mn7; }).length;
  var dash = el('dash-stats');
  if (dash) {
    dash.innerHTML =
      '<div class="dash-item" onclick="quickFilter(\x27overdue\x27)" style="cursor:pointer"><span class="dash-v" style="color:var(--red)">' + overdue + '</span><span class="dash-l">Прострочено</span></div>' +
      '<div class="dash-item" style="cursor:pointer" onclick="(function(){resetF();var t=new Date();var s=t.getFullYear()+\x27-\x27+p2(t.getMonth()+1)+\x27-\x27+p2(t.getDate());el(\x27f-df\x27).value=s;el(\x27f-dt\x27).value=s;applyF()})()"><span class="dash-v" style="color:var(--orn)">' + _todayCnt2 + '</span><span class="dash-l">Сьогодні</span></div>' +
      '<div class="dash-item"><span class="dash-v" style="color:var(--ylw)">' + _tomCnt + '</span><span class="dash-l">Завтра</span></div>' +
      '<div class="dash-item" onclick="quickFilter(\x27week\x27)" style="cursor:pointer"><span class="dash-v" style="color:var(--acc)">' + _wkCnt + '</span><span class="dash-l">Тиждень</span></div>' +
      '</div><div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">' +
      '<div class="dash-item"><span class="dash-v">' + all + '</span><span class="dash-l">Всього</span></div>' +
      '<div class="dash-item"><span class="dash-v" style="color:var(--acc)">' + active + '</span><span class="dash-l">Активних</span></div>' +
      '<div class="dash-item"><span class="dash-v" style="color:var(--grn)">' + doneToday + '</span><span class="dash-l">Виконано</span></div>' +
      '<div class="dash-item"><span class="dash-v" style="color:var(--tx2)">' + _mnCnt + '</span><span class="dash-l">Місяць</span></div>';
  }
}

function renderCards() {
  var c = el('cards');
  if (!F.length) { c.innerHTML = '<div class="empty"><div class="ei">📭</div>Документів не знайдено</div>'; return; }
  var now = new Date();
  var td = new Date(); td.setHours(0,0,0,0);
  var tom = new Date(td); tom.setDate(tom.getDate()+1);

  var _sq2 = el('f-q') ? el('f-q').value.trim().toLowerCase() : '';
  var _grpR = (!_sq2) ? groupByInNum(F) : {singles:F, groups:[], groupRows:{}};
  var _groupRows = _grpR.groupRows;

  // Separate: overdue, by-day (active), done
  var ov = [], dayGroups = {}, dn = [];
  F.forEach(function(d) {
    if (_groupRows[d.row]) return;
    if (d.done) { dn.push(d); return; }
    var dl = pD(d.deadline);
    if (!dl) { var key = '9999-99-99'; if(!dayGroups[key]) dayGroups[key]=[]; dayGroups[key].push(d); return; }
    if (dl < td) { ov.push(d); return; }
    var key = dl.getFullYear() + '-' + p2(dl.getMonth()+1) + '-' + p2(dl.getDate());
    if (!dayGroups[key]) dayGroups[key] = [];
    dayGroups[key].push(d);
  });

  // Build flat list for pagination
  var allItems = [];
  var todayKey = td.getFullYear() + '-' + p2(td.getMonth()+1) + '-' + p2(td.getDate());

  if (dayGroups[todayKey] && dayGroups[todayKey].length) {
    allItems.push({type:'header', text:'📌 Сьогодні', count:dayGroups[todayKey].length, color:'var(--orn)'});
    dayGroups[todayKey].forEach(function(d){ allItems.push({type:'card', doc:d, big:true}); });
  }
  if (ov.length) {
    allItems.push({type:'header', text:'🔴 Прострочені', count:ov.length, color:'var(--red)'});
    ov.forEach(function(d){ allItems.push({type:'card', doc:d}); });
  }
  var sortedKeys = Object.keys(dayGroups).sort();
  sortedKeys.forEach(function(key) {
    if (key === todayKey) return;
    var docs = dayGroups[key]; if (!docs.length) return;
    var keyDate = new Date(key);
    var diffDays = Math.round((keyDate - td) / 864e5);
    var label = key === '9999-99-99' ? '📋 Без терміну' : diffDays===1 ? '📅 Завтра' : diffDays===2 ? '📅 Післязавтра' : '📅 ' + ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][keyDate.getDay()] + ', ' + key.split('-').reverse().join('.');
    allItems.push({type:'header', text:label, count:docs.length});
    docs.forEach(function(d){ allItems.push({type:'card', doc:d}); });
  });
  if (dn.length) {
    allItems.push({type:'header', text:'✅ Виконані', count:dn.length, color:'var(--grn)'});
    dn.forEach(function(d){ allItems.push({type:'card', doc:d}); });
  }

  // Pagination
  var limit = (CUR_PAGE + 1) * PAGE_SIZE;
  var cardCount = allItems.filter(function(i){return i.type==='card'}).length;
  var shown = 0;
  var h = '';
  var inSS = false;
  allItems.forEach(function(item) {
    if (item.type === 'header') {
      if (inSS) h += '</div>';
      h += '<div class="sec"><h2' + (item.color ? ' style="color:'+item.color+'"' : '') + '>' + item.text + '</h2><span class="cnt"' + (item.color ? ' style="background:'+item.color+'"' : '') + '>' + item.count + '</span></div><div class="ss">';
      inSS = true;
    } else {
      shown++;
      if (shown <= limit) h += cH(item.doc, item.big);
    }
  });
  if (inSS) h += '</div>';

  if (_grpR.groups && _grpR.groups.length) {
    h += '<div class="sec"><h2 style="color:var(--acc2)">Один №вх — кілька завдань</h2><span class="cnt" style="background:var(--acc2)">' + _grpR.groups.length + '</span></div><div class="ss">';
    _grpR.groups.forEach(function(grp){ h += cHGroup(grp, _sq2); });
    h += '</div>';
  }

  if (cardCount > limit) {
    h += '<div style="text-align:center;padding:12px"><button class="btn btn-p" onclick="CUR_PAGE++;renderCards()" style="padding:10px 30px;font-size:.84rem">📄 Показати ще ' + Math.min(PAGE_SIZE, cardCount - limit) + ' з ' + (cardCount - limit) + '</button></div>';
  }
  if (cardCount > PAGE_SIZE) {
    h += '<div style="text-align:center;font-size:.68rem;color:var(--tx3);padding:4px">Показано ' + Math.min(limit, cardCount) + ' з ' + cardCount + '</div>';
  }

  c.innerHTML = h;
  var sq = el('f-q').value.trim();
  if (sq) { var re = new RegExp('(' + sq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); document.querySelectorAll('.card-title,.card-sub').forEach(function(e){ e.innerHTML = e.textContent.replace(re, '<mark>$1</mark>'); }); }
  setTimeout(initSortable, 150);
}


/* ─── PANEL ─── */
function openP() { el('rp').classList.add('open'); el('rp-bg').classList.add('open'); }

function closeP() { el('rp').classList.remove('open'); el('rp-bg').classList.remove('open'); }


/* ─── MY DAY ─── */
function renderMD() {
  var td = new Date(); td.setHours(0,0,0,0);
  var tom = new Date(td); tom.setDate(tom.getDate()+1);
  var dayAfter = new Date(td); dayAfter.setDate(dayAfter.getDate()+2);
  var weekEnd = new Date(td); weekEnd.setDate(weekEnd.getDate()+7);
  el('md-d').textContent = p2(td.getDate())+'.'+p2(td.getMonth()+1)+'.'+td.getFullYear();

  var overdue=[],today=[],tomorrow=[],week=[],later=[];
  D.forEach(function(d) {
    if (d.done) return;
    var dl = pD(d.deadline); if (!dl) return;
    if (dl < td) overdue.push(d);
    else if (dl < tom) today.push(d);
    else if (dl < dayAfter) tomorrow.push(d);
    else if (dl < weekEnd) week.push(d);
    else later.push(d);
  });
  [overdue,today,tomorrow,week,later].forEach(function(a){a.sort(function(x,y){return pD(x.deadline)-pD(y.deadline)})});

  var total = overdue.length + today.length;
  var badge = el('md-badge'); if(total>0){badge.style.display='flex';badge.textContent=total}else badge.style.display='none';

  // Birthdays this week
  var bdays = getBirthdays(td, weekEnd);

  // Commission meeting events
  var commEvents = getCommEvents(td, weekEnd);

  var h = '';
  if (bdays.length) {
    h += '<div class="md-sec"><div class="md-sec-h" style="color:var(--vio)">🎂 Дні народження</div>';
    bdays.forEach(function(b) { h += '<div class="md-i" style="border-left:3px solid var(--vio)"><span class="md-t" style="color:var(--vio)">' + esc(b.date) + '</span><span class="md-n">🎂 ' + esc(b.name) + (b.age ? ' (' + b.age + ' р.)' : '') + '</span></div>'; });
    h += '</div>';
  }
  if (commEvents.overdue.length) {
    h += '<div class="md-sec"><div class="md-sec-h" style="color:var(--red)">🔴 Прострочені засідання <span class="cnt" style="background:var(--red)">' + commEvents.overdue.length + '</span></div>';
    commEvents.overdue.forEach(function(e) { h += '<div class="md-i" style="border-left:3px solid var(--red)" onclick="showCommDet(\'' + esc(e.uid) + '\')"><span class="md-t" style="color:var(--red)">⚠️ ' + esc(e.dateStr) + '</span><span class="md-n">👥 ' + esc(e.name) + '</span></div>'; });
    h += '</div>';
  }
  if (commEvents.soon.length) {
    h += '<div class="md-sec"><div class="md-sec-h" style="color:var(--acc2)">👥 Засідання комісій</div>';
    commEvents.soon.forEach(function(e) {
      var col = e.days <= 1 ? 'var(--orn)' : e.days <= 7 ? 'var(--acc2)' : 'var(--tx3)';
      h += '<div class="md-i" style="border-left:3px solid ' + col + '" onclick="showCommDet(\'' + esc(e.uid) + '\')"><span class="md-t" style="color:' + col + '">' + esc(e.dateStr) + ' (' + e.days + 'д)</span><span class="md-n">👥 ' + esc(e.name) + (e.role ? ' • ' + esc(e.role) : '') + '</span></div>';
    });
    h += '</div>';
  }
  // Overdue decisions
  if (commEvents.overdueDec.length) {
    h += '<div class="md-sec"><div class="md-sec-h" style="color:var(--red)">📝 Прострочені рішення комісій <span class="cnt" style="background:var(--red)">' + commEvents.overdueDec.length + '</span></div>';
    commEvents.overdueDec.forEach(function(e) { h += '<div class="md-i" style="border-left:3px solid var(--red)"><span class="md-t" style="color:var(--red)">⚠️ ' + esc(e.deadline) + '</span><span class="md-n">' + esc(e.text).substring(0,50) + ' • 👤 ' + esc(e.responsible) + '</span></div>'; });
    h += '</div>';
  }
  if (overdue.length) { h += '<div class="md-sec"><div class="md-sec-h" style="color:var(--red)">🔴 Прострочені <span class="cnt" style="background:var(--red)">' + overdue.length + '</span></div>'; overdue.forEach(function(d){h+=mdItem(d,td,true)}); h+='</div>'; }
  if (today.length) { h += '<div class="md-sec"><div class="md-sec-h" style="color:var(--orn)">📌 Сьогодні <span class="cnt">' + today.length + '</span></div>'; today.forEach(function(d){h+=mdItem(d,td,false)}); h+='</div>'; }
  if (tomorrow.length) { h += '<div class="md-sec"><div class="md-sec-h">📅 Завтра <span class="cnt">' + tomorrow.length + '</span></div>'; tomorrow.forEach(function(d){h+=mdItem(d,td,false)}); h+='</div>'; }
  if (week.length) { h += '<div class="md-sec"><div class="md-sec-h">📅 Цей тиждень <span class="cnt">' + week.length + '</span></div>'; week.forEach(function(d){h+=mdItem(d,td,false)}); h+='</div>'; }
  if (later.length) { h += '<div class="md-sec"><div class="md-sec-h" style="color:var(--tx3)">📅 Наступні <span class="cnt" style="background:var(--bg3)">' + later.length + '</span></div>'; later.slice(0,20).forEach(function(d){h+=mdItem(d,td,false)}); if(later.length>20) h+='<div style="text-align:center;font-size:.7rem;color:var(--tx3);padding:4px">...ще '+(later.length-20)+'</div>'; h+='</div>'; }
  if (!h) h = '<div class="empty">🎉 Все зроблено!</div>';
  el('md-l').innerHTML = h;
}


function hlQ(text, q) {
  if (!q || !text) return text;
  var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return text.replace(re, '<mark>$1</mark>');
}


function toggleSelect(row, cb) {
  if (cb.checked) SELECTED[row] = true; else delete SELECTED[row];
  var card = cb.closest('.ib-card');
  if (card) card.classList.toggle('selected', !!SELECTED[row]);
  updateMassBar();
}


function updateMassBar() {
  var cnt = Object.keys(SELECTED).length;
  var bar = el('ib-mass');
  if (cnt > 0) { bar.classList.add('show'); el('ib-cnt').textContent = cnt + ' обрано'; }
  else bar.classList.remove('show');
}


function clearSelection() { SELECTED = {}; renderInbox(); }


function getSelectedDocs() {
  var docs = [];
  for (var key in SELECTED) {
    for (var i = 0; i < D.length; i++) { if (D[i].row == key) { docs.push(D[i]); break; } }
  }
  return docs;
}


/* ─── MASS PRINT RESOLUTIONS (4 different docs per A4) ─── */
function massPrintRes() {
  var docs = getSelectedDocs();
  if (!docs.length) { toast('⚠️ Оберіть документи'); return; }
  var w = window.open('', '_blank');
  var css = 'body{font-family:Arial,sans-serif;margin:0;padding:0}' +
    '.page{width:297mm;height:210mm;padding:5mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4mm;page-break-after:always}' +
    '.res{border:1px solid #000;padding:5mm;font-size:10px;display:flex;flex-direction:column;overflow:hidden}' +
    '.res h3{font-size:12px;margin:0 0 3mm;text-align:center;border-bottom:1px solid #000;padding-bottom:2mm}' +
    '.res-field{margin:1.5mm 0;font-size:10px}' +
    '.res-line{border-bottom:1px dotted #999;min-height:5mm;margin:1mm 0}' +
    '@media print{@page{size:A4 landscape;margin:3mm}.page{page-break-after:always}}';

  var html = '<html><head><title>Резолюції</title><style>' + css + '</style></head><body>';
  // Split docs into groups of 4
  for (var p = 0; p < docs.length; p += 4) {
    html += '<div class="page">';
    for (var i = p; i < p + 4; i++) {
      if (i < docs.length) {
        var d = docs[i];
        html += '<div class="res"><h3>РЕЗОЛЮЦІЯ</h3>' +
          '<div class="res-field"><b>Від:</b> ' + esc(d.from || '') + '</div>' +
          '<div class="res-field"><b>Вх. №:</b> ' + esc(d.inNum || '') + ' від ' + fD(d.docDate) + '</div>' +
          '<div class="res-field"><b>Тема:</b> ' + esc(d.name || '') + '</div>' +
          '<div class="res-field"><b>Зміст:</b> ' + esc((d.desc || '').substring(0, 120)) + '</div>' +
          '<div class="res-field"><b>Виконавець:</b> ' + esc(d.executor || '_______________') + '</div>' +
          '<div class="res-field"><b>Термін:</b> ' + fD(d.deadline) + '</div>' +
          '<div class="res-line"></div>' +
          '<div style="margin-top:auto;font-size:8px;color:#666">Дата: ___.___.______ Підпис: ___________</div></div>';
      } else {
        html += '<div class="res" style="border:none"></div>';
      }
    }
    html += '</div>';
  }
  html += '</body></html>';
  html = html.replace('</head>', '.no-print{margin:10px auto;text-align:center}@media print{.no-print{display:none}}</style></head>');
  html = html.replace('<body>', '<body><div class="no-print"><button onclick="window.print()" style="padding:10px 30px;font-size:16px;cursor:pointer;background:#3b82f6;color:#fff;border:none;border-radius:8px;margin:5px">🖨 Друкувати</button><button onclick="window.close()" style="padding:10px 30px;font-size:16px;cursor:pointer;background:#666;color:#fff;border:none;border-radius:8px;margin:5px">✕ Закрити</button></div>');
  w.document.write(html); w.document.close();
}


/* ─── MASS ASSIGN EXECUTOR ─── */
function massAssignExec() {
  var docs = getSelectedDocs();
  if (!docs.length) { toast('⚠️ Оберіть документи'); return; }
  var opts = buildExecOptions('');
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">👤 Призначити виконавця</h2>' +
    '<p style="font-size:.78rem;color:var(--tx2);margin-bottom:8px">Обрано документів: <b>' + docs.length + '</b></p>' +
    '<div class="fg"><label>Виконавець</label><select id="me-ex">' + opts + '</select></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="doMassExec()">✅ Призначити</button><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';
  openP();
}


function doMassExec() {
  var exec = el('me-ex') ? el('me-ex').value : '';
  if (!exec) { toast('⚠️ Оберіть виконавця'); return; }
  var docs = getSelectedDocs();
  var done = 0, total = docs.length;
  toast('💾 Призначаю ' + total + '...');
  docs.forEach(function(d) {
    apiP({action:'editDoc', row:d.row, executor:exec}).then(function(r) {
      done++;
      if (done === total) { toast('✅ Призначено ' + total + ' документів'); closeP(); SELECTED = {}; loadData(); }
    }).catch(function() { done++; });
  });
}


/* ─── MASS MARK DONE ─── */
function massDone() {
  var docs = getSelectedDocs();
  if (!docs.length) { toast('⚠️ Оберіть документи'); return; }
  if (!confirm('Відмітити ' + docs.length + ' документів як виконані?')) return;
  var done = 0, total = docs.length;
  toast('💾 Відмічаю ' + total + '...');
  docs.forEach(function(d) {
    apiP({action:'markDone', row:d.row, doneText:'виконано', doneDate:isoT().split('-').reverse().join('.')}).then(function(r) {
      done++;
      if (done === total) { toast('✅ Виконано ' + total + ' документів'); SELECTED = {}; loadData(); }
    }).catch(function() { done++; });
  });
}


/* ─── DASHBOARD STATS ─── */
function initSortable() {
  if (typeof Sortable === 'undefined') return;
  var c = el('cards');
  if (!c || c._sortableInit) return;
  c._sortableInit = true;
  Sortable.create(c, {
    animation: 150, handle: '.card', ghostClass: 'sortable-ghost',
    filter: 'button,a,input,select',
    onEnd: function() {
      var cards = c.querySelectorAll('.card[data-row]');
      cards.forEach(function(card, i) {
        var row = parseInt(card.getAttribute('data-row'));
        if (row) DR[row] = i;
      });
      localStorage.setItem('k4_dr', JSON.stringify(DR));
      toast('Порядок збережено');
    }
  });
}


/* ─── GROUP BY inNum ─── */
function groupByInNum(docs) {
  var numMap = {};
  docs.forEach(function(d) { if (!d.inNum) return; if (!numMap[d.inNum]) numMap[d.inNum] = []; numMap[d.inNum].push(d); });
  var groupRows = {}, groups = [];
  Object.keys(numMap).forEach(function(num) {
    if (numMap[num].length > 1) { numMap[num].forEach(function(d){ groupRows[d.row] = num; }); groups.push({inNum: num, docs: numMap[num]}); }
  });
  return {singles: docs.filter(function(d){ return !groupRows[d.row]; }), groups: groups, groupRows: groupRows};
}

function cHGroup(group, sq) {
  var d0 = group.docs[0];
  var h = '<div class="card" style="padding:10px 12px;margin-bottom:6px;border-left:3px solid var(--acc)">';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><div style="flex:1">';
  h += '<span style="font-size:.62rem;color:var(--tx3)">Вх.№ </span>';
  h += '<b style="font-size:.9rem">' + esc(d0.inNum) + '</b>';
  if (d0.docDate) h += ' <span style="font-size:.63rem;color:var(--tx3)">від ' + esc(fD(d0.docDate).split(' ')[0]) + '</span>';
  h += '</div><span class="card-badge">' + esc(d0.from || '—') + '</span></div>';
  group.docs.forEach(function(d, i) {
    var dc2 = d.done ? '' : dC(d.deadline);
    var nameH = sq ? hlQ(esc(d.name || d.desc || '—'), sq) : esc(d.name || d.desc || '—');
    h += '<div style="display:flex;align-items:center;gap:5px;padding:5px 8px;background:var(--bg);border-radius:var(--r2);margin-bottom:3px;cursor:pointer" onclick="openDet(\x27' + d.row + '\x27)">';
    h += '<span style="font-size:.65rem;color:var(--tx3);min-width:16px">' + (i+1) + '.</span>';
    h += '<span style="flex:1;font-size:.8rem">' + (d.done ? '[✓] ' : '') + nameH + '</span>';
    if (d.num) h += '<span style="font-size:.6rem;color:var(--tx3);font-family:var(--mono)">№' + esc(String(d.num)) + '</span>';
    h += '<span class="card-dl ' + dc2 + '" style="font-size:.68rem;white-space:nowrap">' + esc(fD(d.deadline).split(' ')[0]) + '</span>';
    if (d.executor) h += '<span style="font-size:.6rem;color:var(--tx3)">' + esc(d.executor.split('(')[0].trim()) + '</span>';
    if (!d.done) h += '<button class="qd-btn" style="display:flex;position:static;margin-left:2px;flex-shrink:0" onclick="event.stopPropagation();openMkD(\x27' + d.row + '\x27)">✓</button>';
    h += '</div>';
  });
  return h + '</div>';
}


function cH(d, big) {
  var dc = d.done ? '' : dC(d.deadline), dl = pD(d.deadline);
  var ht = hasExplicitTime(d.deadline);
  var ts = ht ? ' ⏰' + p2(dl.getHours()) + ':' + p2(dl.getMinutes()) : '';
  var tg = '';
  if (d.tags && d.tags.length) { tg = '<div class="card-tags">'; d.tags.forEach(function(t){ var i = TM[t]; if (i) tg += '<span class="tag ' + i.c + '">' + esc(t) + '</span>'; }); tg += '</div>'; }
  var rc = d.recurring && d.recurring !== 'Ні' ? ' 🔄' + esc(d.recurring) : '';
  // Child count for parent recurring docs
  var childInfo = '';
  var pid = String(d.parentId || '');
  if (pid && pid === String(d.row)) {
    var children = D.filter(function(x){ return String(x.parentId) === pid; });
    var childDone = children.filter(function(x){ return !!x.done; }).length;
    // Find nearest unfinished date
    var nextChild = null;
    var now = new Date();
    children.forEach(function(x) {
      if (x.done) return;
      var xd = pD(x.deadline); if (!xd) return;
      if (!nextChild || xd < pD(nextChild.deadline)) nextChild = x;
    });
    childInfo = '<span style="font-size:.6rem;color:var(--acc2);margin-left:4px">📅' + children.length + ' (✅' + childDone + ')</span>';
    if (nextChild) {
      var ndl = pD(nextChild.deadline);
      var ndC = ndl && ndl < now ? 'color:var(--red)' : 'color:var(--orn)';
      childInfo += '<div style="font-size:.62rem;' + ndC + ';margin-top:1px">▶ Наступна: ' + fD(nextChild.deadline) + '</div>';
    }
  }
  var cardStyle = big ? 'padding:14px 16px;border-width:2px;border-color:var(--orn)' : '';
  var titleSize = big ? 'font-size:1rem' : '';
  var badgeStyle = d.type === 'Привітання' ? 'background:var(--vio)' : '';
  var doneIcon = d.done ? (String(d.done).indexOf('касован')>=0||String(d.done).indexOf('рипинен')>=0||String(d.done).indexOf('тратив')>=0 ? '🚫' : '✅') : '';
  var sq = el('f-q') ? el('f-q').value.trim().toLowerCase() : '';
  var nameH = sq ? hlQ(esc(d.name || d.desc || '—'), sq) : esc(d.name || d.desc || '—');
  var fromH = sq ? hlQ(esc(d.from || ''), sq) : esc(d.from || '');
  var inNumH = d.inNum ? ' • №' + (sq ? hlQ(esc(d.inNum), sq) : esc(d.inNum)) : '';
  var descSnippet = '';
  if (sq && d.desc && d.desc.toLowerCase().indexOf(sq) >= 0) {
    var idx2 = d.desc.toLowerCase().indexOf(sq);
    var start2 = Math.max(0, idx2 - 25);
    var snip = (start2 > 0 ? '...' : '') + d.desc.substring(start2, idx2 + sq.length + 25) + (idx2 + sq.length + 25 < d.desc.length ? '...' : '');
    descSnippet = '<div style="font-size:.66rem;color:var(--tx3);margin-top:2px;padding:2px 4px;background:var(--bg3);border-radius:var(--r2)">' + hlQ(esc(snip), sq) + '</div>';
  }
  return '<div class="card" data-row="' + d.row + '" onclick="openDet(\x27' + d.row + '\x27)" style="' + cardStyle + '">' +
    (d.done ? '<div class="card-done">' + doneIcon + '</div>' : '') +
    '<div class="card-top"><div class="card-title" style="' + titleSize + '">' + nameH + childInfo + '</div><span class="card-badge" style="' + badgeStyle + '">' + esc(d.type || '—') + '</span></div>' +
    '<div class="card-sub">' + fromH + inNumH + '</div>' +
    '<div class="card-meta">' +
    (d.num ? '<span style="color:var(--tx3);font-size:.65rem;font-family:var(--mono)">№' + esc(String(d.num)) + '</span>' : '') +
    (d.docDate ? '<span style="color:var(--tx3);font-size:.65rem"> 📆' + esc(fD(d.docDate).split(' ')[0]) + '</span>' : '') +
    '<span class="card-dl ' + dc + '">📅 ' + esc(fD(d.deadline).split(' ')[0]) + (ts ? ' ⏰' + ts : '') + '</span>' +
    (d.executor ? '<span>👤 ' + esc(d.executor) + '</span>' : '') +
    rc +
  '</div>' + tg +
    descSnippet +
    (!d.done ? '<button class="qd-btn" onclick="event.stopPropagation();openMkD(\x27' + d.row + '\x27)">✅</button>' : '') + '</div>';
}


/* ─── BELL ─── */
function getBellData() {
  var now = new Date(), td = new Date(); td.setHours(0,0,0,0);
  var tom = new Date(td); tom.setDate(tom.getDate() + 1);
  var wk = new Date(td); wk.setDate(wk.getDate() + 7);
  var overdue = D.filter(function(d) { if (d.done) return false; var dl = pD(d.deadline); return dl && dl < td; });
  var today = D.filter(function(d) { if (d.done) return false; var dl = pD(d.deadline); return dl && dl >= td && dl < tom; });
  var week = D.filter(function(d) { if (d.done) return false; var dl = pD(d.deadline); return dl && dl >= tom && dl < wk; });
  // Commission meetings
  var commEvts = getCommEvents(td, wk);
  return { overdue: overdue, today: today, week: week, commOverdue: commEvts.overdue, commSoon: commEvts.soon, overdueDec: commEvts.overdueDec,
    total: overdue.length + today.length + commEvts.overdue.length };
}

function updateBell() {
  var b = getBellData(); var cnt = el('bell-cnt');
  if (b.total > 0) { cnt.style.display = 'flex'; cnt.textContent = b.total; } else cnt.style.display = 'none';
  var td = new Date(); td.setHours(0,0,0,0); var tom = new Date(td); tom.setDate(tom.getDate()+1);
  var todayCnt = D.filter(function(d){ if(d.done)return false; var dl=pD(d.deadline); return dl&&dl>=td&&dl<tom; }).length;
  var overdCnt = D.filter(function(d){ if(d.done)return false; var dl=pD(d.deadline); return dl&&dl<td; }).length;
  var mdTotal = todayCnt + overdCnt + (b.commOverdue ? b.commOverdue.length : 0);
  var mdBadge = el('md-badge'); if(mdTotal>0){mdBadge.style.display='flex';mdBadge.textContent=mdTotal}else mdBadge.style.display='none';
}

function openBell() {
  var b = getBellData(), h = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">🔔 Сповіщення</h2>';
  if (b.overdue.length) { h += '<div class="bsec"><h3 style="color:var(--red)">🔴 Прострочені документи (' + b.overdue.length + ')</h3>'; b.overdue.forEach(function(d) { h += '<div class="bi" onclick="openDet(\x27' + d.row + '\x27)"><b>' + esc(d.name || d.desc || '—') + '</b><div class="bi-d">📅 ' + fD(d.deadline) + ' • ' + esc(d.from || '') + '</div></div>'; }); h += '</div>'; }
  // Commission overdue meetings
  if (b.commOverdue && b.commOverdue.length) {
    h += '<div class="bsec"><h3 style="color:var(--red)">🔴 Прострочені засідання (' + b.commOverdue.length + ')</h3>';
    b.commOverdue.forEach(function(e) { h += '<div class="bi" style="border-left:3px solid var(--red)" onclick="showCommDet(\'' + esc(e.uid) + '\')"><b>👥 ' + esc(e.name) + '</b><div class="bi-d">Просрочено ' + Math.abs(e.days) + ' дн.</div></div>'; });
    h += '</div>';
  }
  if (b.today.length) { h += '<div class="bsec"><h3 style="color:var(--orn)">📌 Сьогодні (' + b.today.length + ')</h3>'; b.today.forEach(function(d) { h += '<div class="bi" onclick="openDet(\x27' + d.row + '\x27)"><b>' + esc(d.name || d.desc || '—') + '</b><div class="bi-d">📅 ' + fD(d.deadline) + ' • ' + esc(d.from || '') + '</div></div>'; }); h += '</div>'; }
  // Commission upcoming meetings
  if (b.commSoon && b.commSoon.length) {
    h += '<div class="bsec"><h3 style="color:var(--acc2)">👥 Засідання комісій (' + b.commSoon.length + ')</h3>';
    b.commSoon.slice(0, 10).forEach(function(e) {
      var col = e.days <= 3 ? 'var(--orn)' : 'var(--acc2)';
      h += '<div class="bi" style="border-left:3px solid ' + col + '" onclick="showCommDet(\'' + esc(e.uid) + '\')"><b>👥 ' + esc(e.name) + '</b><div class="bi-d">' + esc(e.dateStr) + ' (' + e.days + ' дн.)' + (e.role ? ' • ' + esc(e.role) : '') + '</div></div>';
    });
    h += '</div>';
  }
  // Overdue decisions
  if (b.overdueDec && b.overdueDec.length) {
    h += '<div class="bsec"><h3 style="color:var(--red)">📝 Прострочені рішення (' + b.overdueDec.length + ')</h3>';
    b.overdueDec.slice(0, 5).forEach(function(d) { h += '<div class="bi" style="border-left:3px solid var(--red)"><b>' + esc((d.decName||d.text||'').substring(0,40)) + '</b><div class="bi-d">📅 ' + esc(d.deadline) + ' • 👤 ' + esc(d.responsible||'') + '</div></div>'; });
    h += '</div>';
  }
  if (b.week.length) { h += '<div class="bsec"><h3 style="color:var(--acc2)">📅 7 днів (' + b.week.length + ')</h3>'; b.week.forEach(function(d) { h += '<div class="bi" onclick="openDet(\x27' + d.row + '\x27)">' + esc(d.name || d.desc || '—') + '<div class="bi-d">📅 ' + fD(d.deadline) + ' • ' + esc(d.from || '') + '</div></div>'; }); h += '</div>'; }
  if (!b.overdue.length && !b.today.length && !b.week.length && (!b.commOverdue||!b.commOverdue.length) && (!b.commSoon||!b.commSoon.length)) h += '<div class="empty">🎉 Немає термінових</div>';
  // Birthdays
  var td7 = new Date(); td7.setHours(0,0,0,0); var wk7 = new Date(td7); wk7.setDate(wk7.getDate()+7);
  var bdays = getBirthdays(td7, wk7);
  if (bdays.length) {
    h += '<div class="bsec"><h3 style="color:var(--vio)">🎂 Дні народження (' + bdays.length + ')</h3>';
    bdays.forEach(function(b) { h += '<div class="bi" style="border-left:3px solid var(--vio)">🎂 <b>' + esc(b.name) + '</b><div class="bi-d">' + esc(b.date) + (b.age ? ' • ' + b.age + ' років' : '') + '</div></div>'; });
    h += '</div>';
  }
  h += '</div>'; el('rpc').innerHTML = h; openP();
}

function mdItem(d,td,isOv){
  var dl=pD(d.deadline);
  var dateStr = dl ? p2(dl.getDate())+'.'+p2(dl.getMonth()+1) : '—';
  return '<div class="md-i" onclick="openDet(\x27'+d.row+'\x27)" style="position:relative"><span class="md-t"'+(isOv?' style="color:var(--red)"':'')+'>'+( isOv?'⚠️ '+dateStr:dateStr)+'</span><span class="md-n">'+esc(d.name||d.desc||'—')+'</span>' +
    '<div style="display:flex;gap:2px;margin-left:auto" onclick="event.stopPropagation()">' +
    '<button style="width:24px;height:20px;border-radius:4px;border:1px solid var(--brd);background:var(--bg3);color:var(--tx3);font-size:.55rem;cursor:pointer" onclick="postponeDoc('+d.row+',1)" title="На завтра">+1</button>' +
    '<button style="width:24px;height:20px;border-radius:4px;border:1px solid var(--brd);background:var(--bg3);color:var(--tx3);font-size:.55rem;cursor:pointer" onclick="postponeDoc('+d.row+',3)" title="+3 дні">+3</button>' +
    '<button style="width:24px;height:20px;border-radius:4px;border:1px solid var(--brd);background:var(--bg3);color:var(--tx3);font-size:.55rem;cursor:pointer" onclick="postponeDoc('+d.row+',7)" title="+7 днів">+7</button>' +
    '<button class="md-c" onclick="event.stopPropagation();openMkD('+d.row+')" title="Виконано">✓</button>' +
    '</div></div>';
}


function postponeDoc(row, days) {
  var d = null; for (var i=0;i<D.length;i++) if(D[i].row==row){d=D[i];break;} if(!d) return;
  var dl = pD(d.deadline);
  if (!dl) dl = new Date();
  var newDl = new Date(dl);
  newDl.setDate(newDl.getDate() + days);
  var newDlStr = p2(newDl.getDate())+'.'+p2(newDl.getMonth()+1)+'.'+newDl.getFullYear();
  toast('📅 +' + days + 'дн → ' + newDlStr);
  apiP({action:'editDoc', row:row, deadline:newDlStr}).then(function(r) {
    if (r.ok) { logAction('postpone', '+'+days+'дн: '+(d.name||'').substring(0,30), row); loadData(); }
    else toast('❌ ' + (r.error||''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}

function renderFL(f) {
  if (!f) return '';
  try {
    var a = JSON.parse(f);
    if (Array.isArray(a)) return a.map(function(item, i) {
      if (typeof item === 'object' && item.url) {
        var label = item.name || 'Файл ' + (i+1);
        return '<a href="' + esc(item.url) + '" target="_blank" style="color:var(--acc2)">' + esc(label) + '</a>';
      }
      return '<a href="' + esc(String(item)) + '" target="_blank" style="color:var(--acc2)">📁' + (i+1) + '</a>';
    }).join(', ');
  } catch(e) {}
  return String(f).split(',').map(function(u,i) { u = u.trim(); return u ? '<a href="' + esc(u) + '" target="_blank" style="color:var(--acc2)">📁' + (i+1) + '</a>' : ''; }).filter(Boolean).join(', ');
}

function selStatus(btn) {
  document.querySelectorAll('.stat-btn').forEach(function(b){ b.style.opacity='.4'; });
  btn.style.opacity = '1';
  var st = btn.getAttribute('data-st');
  if (el('dm-status')) el('dm-status').value = st;
  if (el('dm-t')) el('dm-t').value = st;
}


function subDone(row) {
  var dt = el('dm-t').value.trim() || 'виконано';
  var rn = el('dm-r').value.trim();
  var dd = el('dm-d').value;
  var tm = el('dm-time') ? el('dm-time').value : '';
  var rl = el('dm-l').value.trim();
  var note = el('dm-note') ? el('dm-note').value.trim() : '';
  var doneDate = ''; if (dd) { var p = dd.split('-'); doneDate = p[2] + '.' + p[1] + '.' + p[0]; if (tm) doneDate += ' ' + tm; }

  var fileInput = el('dm-file');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    var file = fileInput.files[0];
    if (file.size > 10485760) { toast('⚠️ Файл завеликий (макс 10 МБ)'); return; }
    toast('📤 Завантажую файл...');
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      apiP({
        action:'markDone', row:row, doneText:dt, respNum:rn, doneDate:doneDate,
        respLink:rl, note:note,
        fileName: file.name, fileType: file.type, fileData: base64
      }).then(function(r) {
        if (r.ok) { toast('✅ Виконано! Файл збережено.'); loadData(); setTimeout(function(){ if(checkPeriodicEnd(row)) showPeriodicEndPopup(row); else closeP(); }, 300); }
        else toast('❌ ' + (r.error || ''));
      }).catch(function(e) { toast('❌ ' + e.message); });
    };
    reader.onerror = function() { toast('❌ Помилка читання файлу'); };
    reader.readAsDataURL(file);
  } else {
    // No file — just mark done
    toast('💾...');
    apiP({action:'markDone', row:row, doneText:dt, respNum:rn, doneDate:doneDate, respLink:rl, note:note})
      .then(function(r) { if (r.ok) { toast('✅ Виконано!'); loadData(); setTimeout(function(){ if(checkPeriodicEnd(row)) showPeriodicEndPopup(row); else closeP(); }, 300); } else toast('❌ ' + (r.error || '')); })
      .catch(function(e) { toast('❌ ' + e.message); });
  }
}

