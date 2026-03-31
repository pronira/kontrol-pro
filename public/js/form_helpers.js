/* ══ Form Helpers ══ */

/* ─── AUTO-FILL EMAIL FROM ORG ─── */
function autoFillOrgEmail() { onFromChange(); }

function onFromChange() {
  var inp = el('df-fr');
  var specDiv = el('df-fr-spec');
  if (!inp) return;
  var name = inp.value.trim();
  if (name) {
    var org = null; for (var i=0;i<O.length;i++) if(O[i].name===name){org=O[i];break;}
    if (org && org.email) showEmailSuggestions(org.email);
    if (specDiv) showSpecPicker(specDiv, org ? org.row : null, null);
  } else { if (specDiv) specDiv.innerHTML = ''; }
}

function getFromValue() {
  var inp = el('df-fr');
  return inp ? inp.value.trim() : '';
}

function onReportToChange() {
  var inp = el('df-rp');
  var specDiv = el('df-rp-spec');
  if (!inp) return;
  var name = inp.value.trim();
  if (name) {
    var org = null; for (var i=0;i<O.length;i++) if(O[i].name===name){org=O[i];break;}
    if (org && org.email) showEmailSuggestions(org.email);
    if (specDiv) showSpecPicker(specDiv, org ? org.row : null, 'df-rp');
  } else { if (specDiv) specDiv.innerHTML = ''; }
}

/* ─── SEARCHABLE ORG PICKER ─── */
function buildOrgDropItems(q) {
  q = (q||'').toLowerCase();
  var items = [];
  var vis = O.filter(function(o){ return !isOrgDeleted(o) && !isOrgEmpty(o); });
  // Count frequency from existing docs + localStorage history
  var freq = {};
  try { freq = JSON.parse(localStorage.getItem('k4_org_freq') || '{}'); } catch(e) { freq = {}; }
  D.forEach(function(d) {
    if (d.reportTo) freq[d.reportTo] = (freq[d.reportTo] || 0) + 1;
    if (d.from) freq[d.from] = (freq[d.from] || 0) + 0.5;
  });
  vis.forEach(function(o) {
    var nm = (o.name||'').toLowerCase();
    var isSpec = o.orgType === 'Спеціаліст';
    if (q && nm.indexOf(q) < 0 && (o.fullName||'').toLowerCase().indexOf(q) < 0) return;
    items.push({name: o.name, isSpec: isSpec, fullName: o.fullName||'', email: o.email||'', row: o.row, freq: freq[o.name] || 0});
  });
  items.sort(function(a, b) {
    if (b.freq !== a.freq) return b.freq - a.freq;
    if (a.isSpec !== b.isSpec) return a.isSpec ? 1 : -1;
    return a.name.localeCompare(b.name, 'uk');
  });
  return items;
}

function bumpOrgFreq(name) {
  if (!name) return;
  try {
    var freq = JSON.parse(localStorage.getItem('k4_org_freq') || '{}');
    freq[name] = (freq[name] || 0) + 2;
    localStorage.setItem('k4_org_freq', JSON.stringify(freq));
  } catch(e) {}
}

function showOrgDrop(dropId) {
  var drop = el(dropId);
  if (!drop) return;
  var inp = drop.previousElementSibling;
  var q = inp ? inp.value.trim() : '';
  renderOrgDrop(dropId, q);
  drop.style.display = '';
  // Close on outside click
  setTimeout(function(){
    function closer(e) { if (!drop.contains(e.target) && e.target !== inp) { drop.style.display='none'; document.removeEventListener('click',closer); } }
    document.addEventListener('click', closer);
  }, 50);
}

function filterOrgPicker(inp, dropId) {
  renderOrgDrop(dropId, inp.value.trim());
  el(dropId).style.display = '';
}

function renderOrgDrop(dropId, q) {
  var items = buildOrgDropItems(q);
  var drop = el(dropId);
  if (!drop) return;
  if (!items.length) { drop.innerHTML = '<div style="padding:10px;font-size:.72rem;color:var(--tx3)">Нічого не знайдено</div>'; return; }
  var h = '';
  items.forEach(function(it) {
    var cls = it.isSpec ? 'od-item od-spec' : 'od-item od-org';
    var icon = it.isSpec ? '👤' : '🏢';
    var sub = it.isSpec && it.fullName ? '<span style="color:var(--tx3);margin-left:4px;font-weight:400">'+esc(it.fullName)+'</span>' : '';
    h += '<div class="'+cls+'" data-val="'+esc(it.name)+'" data-email="'+esc(it.email)+'" onclick="pickOrgDrop(this,\x27'+dropId+'\x27)">'+icon+' '+esc(it.name)+sub+'</div>';
  });
  drop.innerHTML = h;
}

function pickOrgDrop(item, dropId) {
  var drop = el(dropId);
  var inp = drop.previousElementSibling;
  var val = item.getAttribute('data-val');
  var email = item.getAttribute('data-email');
  inp.value = val;
  drop.style.display = 'none';
  bumpOrgFreq(val);
  if (inp.id === 'df-fr') onFromChange();
  else if (inp.id === 'df-rp') onReportToChange();
  if (email && el('df-em') && !el('df-em').value) el('df-em').value = email;
}


function showEmailSuggestions(emailStr) {
  var sug = el('df-em-suggest');
  if (!sug) return;
  var emails = emailStr.split(';').map(function(s){return s.trim()}).filter(Boolean);
  if (emails.length <= 1) {
    // Single email — just fill
    if (emails[0] && el('df-em') && !el('df-em').value) el('df-em').value = emails[0];
    sug.innerHTML = '';
    return;
  }
  // Multiple — show as suggestion buttons with doc count
  var h = '<span style="font-size:.65rem;color:var(--tx3)">Адреси:</span> ';
  emails.forEach(function(em) {
    var cnt = D.filter(function(d){return d.email && d.email.indexOf(em)>=0}).length;
    h += '<button type="button" class="btn btn-s btn-sm" style="font-size:.65rem;padding:1px 5px" onclick="addEmailSug(\'' + esc(em) + '\')">' + esc(em) + (cnt ? ' <span style="color:var(--acc2)">(' + cnt + ')</span>' : '') + '</button> ';
  });
  h += '<button type="button" class="btn btn-s btn-sm" style="font-size:.65rem;padding:1px 5px" onclick="var e=prompt(\'Email:\');if(e)addEmailSug(e)">＋</button>';
  sug.innerHTML = h;
}


function addEmailSug(email) {
  var em = el('df-em');
  if (!em) return;
  if (!em.value) em.value = email;
  else if (em.value.indexOf(email) < 0) em.value = em.value + '; ' + email;
  toast('📧 ' + email);
}


/* ─── SPECIALIST PICKER (inline in form) ─── */
function showSpecPicker(container, orgRow, targetInputId) {
  if (!orgRow) { container.innerHTML = ''; return; }
  var specs = O.filter(function(s) {
    return s.orgType === 'Спеціаліст' && String(s.parentRow) === String(orgRow) && s.status !== 'inactive' && s.status !== 'deleted';
  });
  if (!specs.length) { container.innerHTML = '<span style="font-size:.68rem;color:var(--tx3)">Немає спеціалістів</span>'; return; }
  var h = '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px">';
  specs.forEach(function(s) {
    var label = s.name + (s.fullName ? ' — ' + s.fullName : '');
    h += '<button type="button" class="btn btn-s btn-sm" style="font-size:.68rem;padding:2px 6px" onclick="pickSpec(this,\'' + esc(s.name) + '\',\'' + esc(s.email||'') + '\'' + (targetInputId ? ',\'' + targetInputId + '\'' : '') + ')" title="' + esc(label) + '">👤 ' + esc(s.name) + '</button>';
  });
  h += '</div>';
  container.innerHTML = h;
}


function pickSpec(btn, name, email, targetInputId) {
  // Highlight selected
  btn.parentElement.querySelectorAll('button').forEach(function(b){ b.style.opacity='.5'; });
  btn.style.opacity = '1'; btn.style.fontWeight = '700';
  // Fill target if specified
  if (targetInputId) {
    var tgt = el(targetInputId);
    if (tgt) tgt.value = tgt.value ? tgt.value + ', ' + name : name;
  }
  // Auto-fill email
  if (email && el('df-em')) {
    var cur = el('df-em').value;
    if (!cur) el('df-em').value = email;
    else if (cur.indexOf(email) < 0) el('df-em').value = cur + ', ' + email;
  }
  toast('👤 ' + name);
}


/* ─── CUSTOM TYPES ─── */
function addCustomType() {
  var name = prompt('Введіть новий тип документа:');
  if (!name || !name.trim()) return;
  name = name.trim();
  var custom = JSON.parse(localStorage.getItem('k4_custom_types') || '[]');
  if (custom.indexOf(name) < 0) { custom.push(name); localStorage.setItem('k4_custom_types', JSON.stringify(custom)); }
  var sel = el('df-tp');
  if (sel) { var opt = document.createElement('option'); opt.textContent = name; opt.selected = true; sel.appendChild(opt); }
  toast('✅ Тип "' + name + '" додано');
}


/* ─── EXTRA DATES (manual, separate from recurring) ─── */
function buildExtraDates(str) {
  var dates = [];
  if (str) { try { dates = JSON.parse(str); } catch(e) { dates = []; } }
  if (!dates.length) return '';
  return dates.map(function(dt, i) { return extraDateRow(dt, i); }).join('');
}

function extraDateRow(dt, idx) {
  dt = dt || {};
  var val = '';
  if (dt.date) { var d = pD(dt.date); if (d) val = d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
  var rcs = ['Ні','Щоденно','Щотижня','Щомісяця','Щокварталу','Щороку','Довільні дати'];
  var orgOpts = '<option value="">—</option>' + O.filter(function(o){return !isOrgDeleted(o) && !isOrgEmpty(o) && o.orgType!=="Спеціаліст"}).map(function(o){return '<option'+(dt.from===o.name?' selected':'')+'>'+esc(o.name)+'</option>'}).join('') + '<option value="__other__">Інше...</option>';
  var execOpts = buildExecOptions(dt.executor || '');
  var edId = 'ed-'+idx+'-'+Date.now();
  return '<div class="ed-block" data-edate="'+idx+'" style="border:1px solid var(--brd);border-radius:var(--r2);padding:8px;margin-bottom:6px;background:var(--bg)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:.74rem;font-weight:700;color:var(--acc2)">📅 Дата #' + (idx+2) + '</span><button type="button" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.9rem" onclick="this.closest(\'.ed-block\').remove()">✕</button></div>' +
    '<div class="frow" style="gap:4px;margin-bottom:4px">' +
    '<div class="fg"><label style="font-size:.68rem">Дата</label><input data-f="date" type="date" value="'+val+'" style="font-size:.74rem"></div>' +
    '<div class="fg"><label style="font-size:.68rem">Час</label><input data-f="time" type="time" style="font-size:.74rem"></div>' +
    '</div>' +
    '<div class="fg" style="margin-bottom:4px"><label style="font-size:.68rem">Що зробити</label><input data-f="desc" type="text" placeholder="Напр. проміжний звіт" value="' + esc(dt.desc||'') + '" style="font-size:.74rem"></div>' +
    '<div class="fg" style="margin-bottom:4px"><label style="font-size:.68rem">Повторюваний</label><select data-f="recurring" style="font-size:.72rem" onchange="onEdRecChange(this)">' + rcs.map(function(r){return '<option'+(dt.recurring===r?' selected':'')+'>'+r+'</option>'}).join('') + '</select>' +
    '<div class="ed-rec-sub" style="display:none;margin-top:4px;padding:6px;background:var(--bg2);border-radius:var(--r2)"></div></div>' +
    '<div class="fg" style="margin-bottom:4px"><label style="font-size:.68rem">Період до</label><input data-f="periodEnd" type="date" value="" style="font-size:.74rem"></div>' +
    '<div class="frow" style="gap:4px;margin-bottom:4px">' +
    '<div class="fg"><label style="font-size:.68rem">Від кого</label><select data-f="from" style="font-size:.72rem" onchange="if(this.value===\'__other__\')this.nextElementSibling.style.display=\'\';else this.nextElementSibling.style.display=\'none\'">' + orgOpts + '</select><input data-f="fromManual" type="text" style="display:none;font-size:.72rem;margin-top:2px" placeholder="Вручну"></div>' +
    '<div class="fg"><label style="font-size:.68rem">Виконавець</label><select data-f="executor" style="font-size:.72rem">' + execOpts + '</select></div>' +
    '</div>' +
    '<div class="frow" style="gap:4px">' +
    '<div class="fg"><label style="font-size:.68rem">Звітувати</label><select data-f="reportTo" style="font-size:.72rem" onchange="autoFillEdEmail(this)">' + orgOpts + '</select></div>' +
    '<div class="fg"><label style="font-size:.68rem">Email</label><input data-f="email" type="email" value="' + esc(dt.email||'') + '" style="font-size:.74rem"></div>' +
    '</div></div>';
}

function onEdRecChange(sel) {
  var sub = sel.parentElement.querySelector('.ed-rec-sub');
  if (!sub) return;
  var v = sel.value;
  if (v === 'Ні' || !v) { sub.style.display='none'; sub.innerHTML=''; return; }
  sub.style.display = '';
  var h = '';
  if (v === 'Щоденно') {
    h = '<div style="font-size:.68rem;color:var(--tx2);margin-bottom:3px">Дні тижня:</div><div style="display:flex;gap:3px;flex-wrap:wrap">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].forEach(function(d,i){ var chk = i<5?' checked':''; var clr = i>=5?' style="color:var(--red)"':''; h += '<label style="font-size:.68rem;cursor:pointer"'+clr+'><input type="checkbox"'+chk+' data-day="'+i+'"> '+d+'</label>'; });
    h += '</div>';
  } else if (v === 'Щотижня') {
    h = '<div style="font-size:.68rem;color:var(--tx2);margin-bottom:3px">День тижня:</div><div style="display:flex;gap:3px;flex-wrap:wrap">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].forEach(function(d,i){ var clr = i>=5?' style="color:var(--red)"':''; h += '<label style="font-size:.68rem;cursor:pointer"'+clr+'><input type="checkbox" data-day="'+i+'"> '+d+'</label>'; });
    h += '</div>';
  } else if (v === 'Щомісяця') {
    h = '<div style="font-size:.68rem;color:var(--tx2);margin-bottom:3px">Місяці:</div><div style="display:flex;gap:2px;flex-wrap:wrap">';
    MO.forEach(function(m,i){ h += '<label style="font-size:.65rem;cursor:pointer;padding:1px 3px;background:var(--bg3);border-radius:3px"><input type="checkbox" checked data-mon="'+i+'"> '+m.substring(0,3)+'</label>'; });
    h += '</div><div style="margin-top:3px;font-size:.68rem"><label>Число: <input type="number" min="1" max="28" value="5" style="width:45px;font-size:.72rem"></label></div>';
  } else if (v === 'Щокварталу') {
    h = '<div style="font-size:.68rem"><label><input type="radio" name="ed-q-'+Date.now()+'" value="last" checked> Останній міс. (бер/чер/вер/гру)</label><br><label><input type="radio" name="ed-q-'+Date.now()+'" value="first"> Перший міс. (січ/кві/лип/жов)</label></div><div style="margin-top:3px;font-size:.68rem"><label>Число: <input type="number" min="1" max="28" value="5" style="width:45px;font-size:.72rem"></label></div>';
  } else if (v === 'Щороку') {
    h = '<div style="font-size:.68rem;display:flex;gap:4px;flex-wrap:wrap">';
    MO.forEach(function(m,i){ h += '<label style="font-size:.65rem;cursor:pointer;padding:1px 3px;background:var(--bg3);border-radius:3px"><input type="radio" name="ed-yr-'+Date.now()+'" value="'+i+'"> '+m.substring(0,3)+'</label>'; });
    h += '</div><div style="margin-top:3px;font-size:.68rem"><label>Число: <input type="number" min="1" max="28" value="5" style="width:45px;font-size:.72rem"></label></div>';
  } else if (v === 'Довільні дати') {
    h = '<div style="font-size:.68rem;color:var(--tx2);margin-bottom:3px">Оберіть дати:</div><div class="ed-custom-dates"></div><button type="button" class="btn btn-s btn-sm" style="font-size:.65rem;margin-top:3px" onclick="addEdCustomDate(this)">＋ Дата</button>';
  }
  sub.innerHTML = h;
}

function addEdCustomDate(btn) {
  var cont = btn.previousElementSibling;
  cont.insertAdjacentHTML('beforeend', '<div style="display:flex;gap:3px;align-items:center;margin-bottom:2px"><input type="date" style="font-size:.72rem;flex:1"><button type="button" style="background:none;border:none;color:var(--red);cursor:pointer" onclick="this.parentElement.remove()">✕</button></div>');
}

function addExtraDate() {
  var cont = el('df-extra-dates');
  var idx = cont.children.length;
  cont.insertAdjacentHTML('beforeend', extraDateRow({}, idx));
}

function autoFillEdEmail(sel) {
  var block = sel.closest('.ed-block');
  if (!block) return;
  var emailInp = block.querySelector('input[type=email]');
  if (!emailInp || emailInp.value) return;
  var name = sel.value;
  if (!name || name === '__other__') return;
  for (var i = 0; i < O.length; i++) {
    if (O[i].name === name && O[i].email) { emailInp.value = O[i].email; break; }
  }
}

function getExtraDates() {
  var dates = [];
  document.querySelectorAll('#df-extra-dates .ed-block').forEach(function(block) {
    function gf(name) { var e = block.querySelector('[data-f="'+name+'"]'); return e ? e.value : ''; }
    var dateVal = gf('date');
    if (!dateVal) return;
    var pp = dateVal.split('-');
    var timeVal = gf('time');
    var fromSel = gf('from');
    var fromManual = gf('fromManual');
    dates.push({
      date: pp[2]+'.'+pp[1]+'.'+pp[0] + (timeVal ? ' ' + timeVal : ''),
      desc: gf('desc').trim(),
      recurring: gf('recurring') || 'Ні',
      periodEnd: gf('periodEnd'),
      from: (fromSel === '__other__' ? fromManual.trim() : fromSel) || '',
      executor: gf('executor'),
      reportTo: gf('reportTo'),
      email: gf('email').trim()
    });
  });
  return dates.length ? JSON.stringify(dates) : '';
}


/* ─── CONFIRM + PRINT ─── */
function expandRecurringDates(deadline, recurring, periodEnd) {
  var dates = [];
  var dl = pD(deadline);
  var pe = pD(periodEnd);
  if (!dl && !recurring) return dates;
  if (!pe) { pe = dl ? new Date(dl.getFullYear(), 11, 31) : new Date(new Date().getFullYear(), 11, 31); }
  if (!recurring || recurring === 'Ні') { if(dl) dates.push(dl); return dates; }

  // Довільні дати
  if (recurring.indexOf('Довільні') >= 0) {
    var m = recurring.match(/\(([^)]+)\)/);
    if (m) { m[1].split(';').forEach(function(s){ var d=pD(s.trim()); if(d) dates.push(d); }); }
    return dates;
  }

  if (!dl) return dates;
  var cur = new Date(dl);

  // Щотижня (День1,День2) — specific weekdays
  if (recurring.indexOf('Щотижня') >= 0) {
    var dm = recurring.match(/\(([^)]+)\)/);
    if (dm) {
      var dayMap = {'\u041f\u043d':1,'\u0412\u0442':2,'\u0421\u0440':3,'\u0427\u0442':4,'\u041f\u0442':5,'\u0421\u0431':6,'\u041d\u0434':0};
      var wantDays = dm[1].split(',').map(function(s){ return dayMap[s.trim()]; }).filter(function(d){ return d!==undefined; });
      while (cur <= pe && dates.length < 200) {
        if (wantDays.indexOf(cur.getDay()) >= 0) dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      while (cur <= pe && dates.length < 100) { dates.push(new Date(cur)); cur.setDate(cur.getDate()+7); }
    }
    return dates;
  }

  if (recurring.indexOf('Щоденно') >= 0) {
    var dm = recurring.match(/\(([^)]+)\)/);
    var workDays = [1,2,3,4,5]; // default Mon-Fri
    if (dm) {
      var dayMap = {'\u041f\u043d':1,'\u0412\u0442':2,'\u0421\u0440':3,'\u0427\u0442':4,'\u041f\u0442':5,'\u0421\u0431':6,'\u041d\u0434':0};
      workDays = dm[1].split(',').map(function(s){ return dayMap[s.trim()]; }).filter(function(d){ return d!==undefined; });
    }
    while (cur <= pe && dates.length < 300) { if (workDays.indexOf(cur.getDay()) >= 0) dates.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
    return dates;
  }

  if (recurring.indexOf('Щомісяця') >= 0) {
    var mm = recurring.match(/\(([^)]+)\)/);
    var dayM = recurring.match(/(\d+)-го/);
    var day = dayM ? parseInt(dayM[1]) : dl.getDate();
    var months = [];
    if (mm) { mm[1].split(',').forEach(function(s){ months.push(parseInt(s.trim())-1); }); }
    else { for(var i=0;i<12;i++) months.push(i); }
    var yr = dl.getFullYear();
    for (var y=yr; y<=pe.getFullYear(); y++) {
      months.forEach(function(m) {
        var d = new Date(y, m, Math.min(day, new Date(y, m+1, 0).getDate()));
        if (d >= dl && d <= pe) dates.push(d);
      });
    }
    return dates;
  }

  if (recurring.indexOf('Щокварталу') >= 0) {
    var qms = recurring.indexOf('перш') >= 0 ? [0,3,6,9] : [2,5,8,11];
    var dayM = recurring.match(/(\d+)-го/);
    var day = dayM ? parseInt(dayM[1]) : dl.getDate();
    var yr = dl.getFullYear();
    for (var y=yr; y<=pe.getFullYear(); y++) {
      qms.forEach(function(m) {
        var d = new Date(y, m, Math.min(day, new Date(y, m+1, 0).getDate()));
        if (d >= dl && d <= pe) dates.push(d);
      });
    }
    return dates;
  }

  if (recurring.indexOf('Щороку') >= 0) {
    var mm = recurring.match(/\((\d+)\)/);
    var dayM = recurring.match(/(\d+)-го/);
    var mon = mm ? parseInt(mm[1])-1 : dl.getMonth();
    var day = dayM ? parseInt(dayM[1]) : dl.getDate();
    for (var y=dl.getFullYear(); y<=pe.getFullYear(); y++) {
      var d = new Date(y, mon, Math.min(day, new Date(y, mon+1, 0).getDate()));
      if (d >= dl && d <= pe) dates.push(d);
    }
    return dates;
  }

  dates.push(dl);
  return dates;
}

function confirmAndPrint() {
  var payload = window._pendingPayload;
  if (!payload) return;
  function dateOnly(s) { var v = fD(s); return v ? v.split(' ')[0] : ''; }
  function fmtD(d) { return p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear(); }
  // Expand main deadline recurring dates
  var allDates = [];
  var mainExpanded = expandRecurringDates(payload.deadline, payload.recurring, payload.periodEnd);
  mainExpanded.forEach(function(d) { allDates.push({date: fmtD(d), from: payload.reportTo||'', desc: '', recurring: payload.recurring||''}); });
  // Expand extra dates
  try { var extras = payload.extraDates ? JSON.parse(payload.extraDates) : [];
    extras.forEach(function(e) {
      var expanded = expandRecurringDates(e.date, e.recurring, e.periodEnd);
      expanded.forEach(function(d) {
        allDates.push({date: fmtD(d), from: e.reportTo||e.from||'', desc: e.desc||'', recurring: e.recurring||''});
      });
    });
  } catch(ex) {}
  // Sort by date
  allDates.sort(function(a,b) { var da=pD(a.date), db=pD(b.date); if(!da||!db) return 0; return da-db; });
  var tblH = '';
  if (allDates.length) {
    tblH = '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:11px"><tr style="background:#eee;font-weight:700"><td style="border:1px solid #999;padding:4px;width:22px">№</td><td style="border:1px solid #999;padding:4px">Термін</td><td style="border:1px solid #999;padding:4px">Кому звітувати</td><td style="border:1px solid #999;padding:4px;width:80px">№ відповіді</td><td style="border:1px solid #999;padding:4px;width:80px">Дата відповіді</td><td style="border:1px solid #999;padding:4px;width:22px">✓</td></tr>';
    allDates.forEach(function(dt, i) {
      var label = dt.date || '—';
      if (dt.desc) label += ' — ' + dt.desc;
      tblH += '<tr><td style="border:1px solid #999;padding:3px;text-align:center;font-size:10px">' + (i+1) + '</td><td style="border:1px solid #999;padding:3px">' + esc(label) + '</td><td style="border:1px solid #999;padding:3px">' + esc(dt.from) + '</td><td style="border:1px solid #999;padding:3px"></td><td style="border:1px solid #999;padding:3px"></td><td style="border:1px solid #999;padding:3px;text-align:center"><span style="display:inline-block;width:12px;height:12px;border:1.5px solid #000"></span></td></tr>';
    });
    tblH += '</table>';
  }
  var h = '<div style="font-family:Arial;padding:20px;max-width:500px;margin:auto;border:2px solid #000;background:#fff;color:#000">' +
    '<h3 style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin:0 0 10px">РЕЗОЛЮЦІЯ</h3>' +
    '<div style="margin:4px 0;font-size:12px"><b>Від:</b> ' + esc(payload.from || '') + '</div>' +
    '<div style="margin:4px 0;font-size:12px"><b>Вх. №:</b> ' + esc(payload.inNum || '') + ' від ' + dateOnly(payload.docDate) + '</div>' +
    '<div style="margin:4px 0;font-size:12px"><b>Тема:</b> ' + esc(payload.name || '') + '</div>' +
    '<div style="margin:4px 0;font-size:12px"><b>Зміст:</b> ' + esc((payload.desc || '').substring(0,200)) + '</div>' +
    '<div style="margin:4px 0;font-size:12px"><b>Виконавець:</b> ' + esc(payload.executor || '') + '</div>' +
    '<div style="margin:4px 0;font-size:12px"><b>Термін:</b> ' + dateOnly(payload.deadline) + '</div>' +
    (payload.reportTo ? '<div style="margin:4px 0;font-size:12px"><b>Звітувати:</b> ' + esc(payload.reportTo) + '</div>' : '') +
    tblH +
    '</div>';
  // Ask about auto-numbering
  var hasNumbers = (payload.inNum || '').trim();
  var askNum = !hasNumbers;
  var ov = el('doc-ov');
  var fr = ov.querySelector('iframe');
  if (fr) fr.style.display = 'none';
  var prev = ov.querySelector('.res-preview');
  if (prev) prev.remove();
  var div = document.createElement('div');
  div.className = 'res-preview';
  div.style.cssText = 'position:absolute;inset:40px;background:var(--bg);border-radius:var(--r);overflow:auto;padding:20px';
  var btns = '<div style="text-align:center;margin-top:12px">';
  if (askNum) btns += '<div style="margin-bottom:8px;padding:8px;background:rgba(59,130,246,.1);border-radius:6px;font-size:12px;color:#333"><b>Номери не вказано.</b> <label style="cursor:pointer"><input type="checkbox" id="res-auto-num" checked> Проставити номери автоматично?</label></div>';
  btns += '<button onclick="printResPreview()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#3b82f6;color:#fff;border:none;border-radius:6px">🖨 Друкувати</button> <button onclick="closeOverlay()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#666;color:#fff;border:none;border-radius:6px">✕ Закрити</button></div>';
  div.innerHTML = h + btns;
  ov.appendChild(div);
  ov.classList.add('open');
}


function printResPreview() {
  var prev = document.querySelector('.res-preview');
  if (!prev) return;
  var w = window.open('', '_blank');
  var css = 'body{font-family:Arial;margin:10mm;font-size:12px}h3{text-align:center;border-bottom:2px solid #000;padding-bottom:8px}table{border-collapse:collapse}td{border:1px solid #999;padding:3px}@media print{@page{size:A4 landscape;margin:5mm}}';
  w.document.write('<html><head><style>' + css + '</style></head><body>' + prev.querySelector('div').outerHTML + '</body></html>');
  w.document.close();
  setTimeout(function() { w.print(); }, 500);
}


/* ─── EXECUTORS ─── */
function getOrgSpecialists() {
  var items = [];
  var orgs = O.filter(function(o) { return !isOrgDeleted(o) && !isOrgEmpty(o) && o.orgType !== 'Спеціаліст'; });
  orgs.sort(function(a,b) {
    var aEkon = a.name && a.name.toLowerCase().indexOf('ектор екон') >= 0 ? 0 : 1;
    var bEkon = b.name && b.name.toLowerCase().indexOf('ектор екон') >= 0 ? 0 : 1;
    if (aEkon !== bEkon) return aEkon - bEkon;
    return orgCmp(a,b);
  });
  orgs.forEach(function(org) {
    var contact = org.contact ? ' — ' + org.contact : '';
    items.push({label: '🏢 ' + org.name + contact, value: org.name, isOrg: true, row: org.row});
    // Only active specialists
    var specs = O.filter(function(s) { return s.orgType === 'Спеціаліст' && String(s.parentRow) === String(org.row) && s.status !== 'inactive' && s.status !== 'deleted'; });
    specs.forEach(function(s) {
      items.push({label: '  👤 ' + s.name + (s.fullName ? ' — ' + s.fullName : ''), value: s.name + ' (' + org.name + ')', isOrg: false, row: s.row});
    });
  });
  return items;
}


function getActiveOrgs() {
  return O.filter(function(o) { return !isOrgDeleted(o) && !isOrgEmpty(o) && o.orgType !== 'Спеціаліст'; });
}


function buildExecOptions(selectedVal) {
  var items = getOrgSpecialists();
  var h = '<option value="">— Виконавець —</option>';
  items.forEach(function(it) {
    var sel = (selectedVal && selectedVal.indexOf(it.value) >= 0) ? ' selected' : '';
    h += '<option value="' + esc(it.value) + '"' + sel + (it.isOrg ? ' style="font-weight:700"' : '') + '>' + esc(it.label) + '</option>';
  });
  h += '<option value="__other__">Інше (вручну)...</option>';
  return h;
}


function buildExecutorsList(execStr) {
  var execs = [];
  if (execStr) {
    String(execStr).split(';').forEach(function(s) {
      s = s.trim(); if (!s) return;
      var isUzag = s.indexOf('(узаг.)') >= 0;
      var name = s.replace('(узаг.)', '').trim();
      var comment = '';
      var cm = s.match(/\[([^\]]*)\]/);
      if (cm) { comment = cm[1]; name = name.replace(/\[[^\]]*\]/, '').trim(); }
      execs.push({name: name, uzag: isUzag, comment: comment});
    });
  }
  if (!execs.length) execs.push({name:'',uzag:false,comment:''});
  return execs.map(function(e,i){ return execRow(e,i); }).join('');
}


function execRow(e, idx) {
  var opts = buildExecOptions(e.name);
  return '<div class="frow" style="margin-bottom:4px;align-items:center" data-exec-row="'+idx+'">' +
    '<select style="flex:1;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:4px 6px;border-radius:var(--r2);font-size:.75rem">' + opts + '</select>' +
    '<button type="button" data-uzag="' + (e.uzag ? '1' : '0') + '" style="padding:2px 6px;border:1px solid ' + (e.uzag ? 'var(--acc)' : 'var(--brd)') + ';background:' + (e.uzag ? 'var(--acc)' : 'var(--bg2)') + ';color:' + (e.uzag ? '#fff' : 'var(--tx3)') + ';border-radius:var(--r2);font-size:.6rem;cursor:pointer;white-space:nowrap" onclick="togUzag(this)" title="Узагальнює відповіді">узаг.</button>' +
    '<input type="text" placeholder="коментар" value="' + esc(e.comment) + '" style="width:80px;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:4px 6px;border-radius:var(--r2);font-size:.7rem">' +
    '<button type="button" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem" onclick="this.parentElement.remove()">✕</button></div>';
}


function addExecutorRow() {
  var cont = el('df-executors');
  var idx = cont.children.length;
  cont.insertAdjacentHTML('beforeend', execRow({name:'',uzag:false,comment:''}, idx));
}


function togUzag(btn) {
  var wasOn = btn.getAttribute('data-uzag') === '1';
  // Turn off all others
  document.querySelectorAll('#df-executors [data-uzag]').forEach(function(b) {
    b.setAttribute('data-uzag', '0');
    b.style.background = 'var(--bg2)'; b.style.borderColor = 'var(--brd)'; b.style.color = 'var(--tx3)';
  });
  if (!wasOn) {
    btn.setAttribute('data-uzag', '1');
    btn.style.background = 'var(--acc)'; btn.style.borderColor = 'var(--acc)'; btn.style.color = '#fff';
  }
}


function getExecutorsValue() {
  var parts = [];
  document.querySelectorAll('#df-executors [data-exec-row]').forEach(function(row) {
    var sel = row.querySelector('select');
    var name = sel ? sel.value : '';
    if (!name) return;
    var uzagBtn = row.querySelector('[data-uzag]');
    var isUzag = uzagBtn && uzagBtn.getAttribute('data-uzag') === '1';
    var commentInput = row.querySelector('input[type=text]');
    var comment = commentInput ? commentInput.value.trim() : '';
    var s = name;
    if (isUzag) s += ' (узаг.)';
    if (comment) s += ' [' + comment + ']';
    parts.push(s);
  });
  parts.sort(function(a,b) { return (b.indexOf('(узаг.)') >= 0 ? 1 : 0) - (a.indexOf('(узаг.)') >= 0 ? 1 : 0); });
  return parts.join('; ');
}


/* ─── FILES LIST ─── */
function buildFilesList(filesStr) {
  var files = [];
  if (filesStr) {
    try { files = JSON.parse(filesStr); } catch(e) {
      String(filesStr).split(',').forEach(function(u) { u = u.trim(); if (u) files.push({url: u, name: ''}); });
    }
  }
  if (!Array.isArray(files)) files = [];
  if (!files.length) return fileRow({url:'',name:''}, 0);
  return files.map(function(f, i) {
    if (typeof f === 'string') f = {url: f, name: ''};
    return fileRow(f, i);
  }).join('');
}


function fileRow(f, idx) {
  return '<div class="frow" style="margin-bottom:3px;align-items:center" data-file-row="'+idx+'">' +
    '<input type="text" placeholder="Назва файлу" value="' + esc(f.name||'') + '" style="width:100px;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:4px 6px;border-radius:var(--r2);font-size:.7rem">' +
    '<input type="url" placeholder="https://..." value="' + esc(f.url||'') + '" style="flex:1;background:var(--bg);border:1px solid var(--brd);color:var(--tx);padding:4px 6px;border-radius:var(--r2);font-size:.7rem">' +
    '<button type="button" class="btn btn-s" style="padding:3px 6px;font-size:.7rem" onclick="pickFile(this.previousElementSibling.id||null,this.previousElementSibling)" title="Вибрати">📂</button>' +
    '<button type="button" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem" onclick="this.parentElement.remove()">✕</button></div>';
}


function addFileRow() {
  var cont = el('df-files-list');
  var idx = cont.children.length;
  cont.insertAdjacentHTML('beforeend', fileRow({url:'',name:''}, idx));
}


function getFilesValue() {
  var files = [];
  document.querySelectorAll('#df-files-list [data-file-row]').forEach(function(row) {
    var inputs = row.querySelectorAll('input');
    var name = inputs[0] ? inputs[0].value.trim() : '';
    var url = inputs[1] ? inputs[1].value.trim() : '';
    if (url) files.push({name: name, url: url});
  });
  return files.length ? JSON.stringify(files) : '';
}


function pickFile(inputId, inputEl) {
  var target = inputId ? el(inputId) : inputEl;
  if (!target) return;
  var url = prompt('Вставте посилання на файл з Google Drive:');
  if (url) target.value = url;
}


function uploadFileToField(fileInput, targetId) {
  var file = fileInput.files && fileInput.files[0];
  if (!file) return;
  if (file.size > 10485760) { toast('⚠️ Файл завеликий (макс 10 МБ)'); return; }
  var target = el(targetId);
  toast('📤 Завантажую ' + file.name + '...');
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result.split(',')[1];
    if (!window._pendingFiles) window._pendingFiles = {};
    window._pendingFiles[targetId] = {name: file.name, type: file.type, data: base64};
    if (target) target.value = '📤 ' + file.name + ' (завантажиться при збереженні)';
    toast('✅ ' + file.name + ' готовий');
  };
  reader.onerror = function() { toast('❌ Помилка читання файлу'); };
  reader.readAsDataURL(file);
}


/* ─── INCOMING FILES (multi) ─── */
function buildIncomingFiles(docLink) {
  if (!docLink) return '';
  // Parse existing links (comma or ; separated, or JSON array)
  var links = [];
  try { links = JSON.parse(docLink); } catch(e) { links = docLink.split(';').map(function(s){return s.trim()}).filter(Boolean); }
  if (typeof links === 'string') links = [links];
  return links.map(function(url, i) { return incomingFileRow(url, '', i); }).join('');
}


function incomingFileRow(url, fileName, idx) {
  var label = fileName || (url.length > 40 ? url.substring(0, 37) + '...' : url);
  return '<div class="inc-file" data-inc="' + idx + '" style="display:flex;align-items:center;gap:4px;padding:4px 6px;background:var(--bg);border:1px solid var(--brd);border-radius:var(--r2);margin-bottom:3px;font-size:.74rem">' +
    '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(url) + '">📎 ' + esc(label) + '</span>' +
    '<input type="hidden" class="inc-url" value="' + esc(url) + '">' +
    (url && url.indexOf('http') === 0 ? '<button type="button" class="btn btn-s btn-sm" style="font-size:.6rem;padding:2px 4px" onclick="openDocOverlay(\'' + esc(url) + '\')" title="Переглянути">👁</button>' : '') +
    '<button type="button" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.8rem" onclick="this.closest(\'.inc-file\').remove()">✕</button></div>';
}


function addIncomingFiles(fileInput) {
  var files = fileInput.files;
  if (!files || !files.length) return;
  var cont = el('df-incoming-files');
  for (var f = 0; f < files.length; f++) {
    (function(file) {
      if (file.size > 10485760) { toast('⚠️ ' + file.name + ' завеликий'); return; }
      var idx = cont.children.length;
      var reader = new FileReader();
      reader.onload = function(e) {
        var base64 = e.target.result.split(',')[1];
        if (!window._pendingIncoming) window._pendingIncoming = [];
        var pIdx = window._pendingIncoming.length;
        window._pendingIncoming.push({name: file.name, type: file.type, data: base64});
        cont.insertAdjacentHTML('beforeend', incomingFileRow('📤 (буде завантажено)', file.name, 'p' + pIdx));
        toast('✅ ' + file.name);
      };
      reader.readAsDataURL(file);
    })(files[f]);
  }
  fileInput.value = '';
}


function addIncomingUrl() {
  var url = prompt('Вставте посилання на документ:');
  if (!url || !url.trim()) return;
  var cont = el('df-incoming-files');
  var idx = cont.children.length;
  cont.insertAdjacentHTML('beforeend', incomingFileRow(url.trim(), '', idx));
}


function getIncomingLinks() {
  var links = [];
  document.querySelectorAll('#df-incoming-files .inc-url').forEach(function(inp) {
    var v = inp.value.trim();
    if (v && v.indexOf('📤') < 0) links.push(v);
  });
  return links;
}

