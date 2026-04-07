/* ══ Documents ══ */

/* ─── DOC FORM ─── */
function docForm(d, title) {
  d = d || {};
  // Editable types from localStorage
  var defaultTps = ['Вебінар','Доручення','Засідання','Лист','Наказ','Нарада','Привітання','Протокол','Резолюція','Розпорядження','Звернення','Інше'];
  var customTps = JSON.parse(localStorage.getItem('k4_custom_types') || '[]');
  var tps = defaultTps.concat(customTps).filter(function(v,i,a){return a.indexOf(v)===i});
  tps.sort(function(a,b){if(a==='Інше')return 1;if(b==='Інше')return -1;return a.localeCompare(b,'uk')});
  var rcs = ['Ні','Щоденно','Щотижня','Щомісяця','Щокварталу','Щороку','Довільні дати'];
  // Default reminders from settings
  var defRem = localStorage.getItem('k4_def_rem') || '7,5,3,1';
  var remDays = [{v:'7',l:'7дн'},{v:'5',l:'5дн'},{v:'3',l:'3дн'},{v:'1',l:'1дн'},{v:'0',l:'Вдень'}];
  var remTime = [{v:'60',l:'1 год'},{v:'30',l:'30 хв'},{v:'15',l:'15 хв'},{v:'5',l:'5 хв'}];
  var curRem = String(d.reminder || defRem).split(',').map(function(s){return s.trim()}).filter(Boolean);
  var defRemArr = defRem.split(',');
  var dld = d.deadline ? '' : isoT(); // Default = today if new doc
  var dlh = '12', dlm = '00', ped = '', ddd = '';
  if (d.deadline) { var x = pD(d.deadline); if (x) { dld = x.getFullYear()+'-'+p2(x.getMonth()+1)+'-'+p2(x.getDate()); if (hasExplicitTime(d.deadline)) { dlh=p2(x.getHours()); dlm=p2(Math.floor(x.getMinutes()/5)*5); } }}
  if (d.periodEnd) { var x = pD(d.periodEnd); if (x) ped = x.getFullYear()+'-'+p2(x.getMonth()+1)+'-'+p2(x.getDate()); }
  if (d.docDate) { var x = pD(d.docDate); if (x) ddd = x.getFullYear()+'-'+p2(x.getMonth()+1)+'-'+p2(x.getDate()); }
  var h = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">' + title + '</h2>' +
    '<input type="hidden" id="df-r" value="' + (d.row || '') + '">' +
    '<div class="frow"><div class="fg"><label>Тип <button type="button" style="background:none;border:none;color:var(--acc2);cursor:pointer;font-size:.65rem" onclick="addCustomType()" title="Додати новий тип">＋</button></label><select id="df-tp">' + tps.map(function(t){ return '<option' + (d.type===t?' selected':'') + '>' + t + '</option>'; }).join('') + '</select></div>' +
    '<div class="fg"><label>Вхідний №</label><input type="text" id="df-in" value="' + esc(d.inNum||'') + '"></div>' +
    '<div class="fg"><label>Дата док.</label><input type="date" id="df-dd" value="' + ddd + '"></div></div>' +
    '<div class="fg"><label>Від кого</label><div style="position:relative"><input type="text" id="df-fr" value="' + esc(d.from||'') + '" placeholder="Пошук організації..." oninput="filterOrgPicker(this,\x27df-fr-drop\x27)" onfocus="showOrgDrop(\x27df-fr-drop\x27)" autocomplete="off" style="width:100%"><div id="df-fr-drop" class="org-drop" style="display:none"></div></div><div id="df-fr-spec" style="font-size:.7rem;color:var(--tx3);margin-top:2px"></div></div>' +
    '<div class="fg"><label>Назва / Тема</label><input type="text" id="df-nm" value="' + esc(d.name||'') + '"></div>' +
    '<div class="fg"><label>Що зробити</label><textarea id="df-ds">' + esc(d.desc||'') + '</textarea></div>' +
    '<div class="frow"><div class="fg"><label>Термін</label><input type="date" id="df-dl" value="' + dld + '"></div></div>' +
    '<input type="hidden" id="df-tm-h" value="' + dlh + '"><input type="hidden" id="df-tm-m" value="' + dlm + '">' +
    '<div class="frow"><div class="fg"><label>Повторюваний</label><select id="df-rc" onchange="onRecChange()">' + rcs.map(function(r){ return '<option value="'+esc(r)+'"' + ((d.recurring||'').indexOf(r)===0?' selected':'') + '>' + r + '</option>'; }).join('') + '</select>' +
    '<div class="rec-sub" id="rec-daily"><div style="font-size:.68rem;color:var(--tx2);margin-bottom:4px">Дні тижня:</div><div class="rec-days" id="rec-daily-days"></div></div>' +
    '<div class="rec-sub" id="rec-monthly"><div style="font-size:.68rem;color:var(--tx2);margin-bottom:4px">Місяці:</div><div class="rec-months" id="rec-mon-list"></div><div class="rec-row"><label>Число:</label><input type="number" id="rec-mon-day" min="1" max="28" value="5"></div></div>' +
    '<div class="rec-sub" id="rec-quarterly"><div class="rec-row"><input type="radio" name="rec-q-mode" value="last" id="rq-last" checked><label for="rq-last">Останній міс. кварталу (бер/чер/вер/гру)</label></div><div class="rec-row"><input type="radio" name="rec-q-mode" value="first" id="rq-first"><label for="rq-first">Перший міс. кварталу (січ/кві/лип/жов)</label></div><div class="rec-row"><label>Число:</label><input type="number" id="rec-q-day" min="1" max="28" value="5"></div></div>' +
    '<div class="rec-sub" id="rec-yearly"><div style="font-size:.68rem;color:var(--tx2);margin-bottom:4px">Місяць та число:</div><div class="rec-months" id="rec-yr-mons"></div><div class="rec-row"><label>Число:</label><input type="number" id="rec-yr-day" min="1" max="28" value="5"></div></div>' +
    '<div class="rec-sub" id="rec-custom"><div style="font-size:.68rem;color:var(--tx2);margin-bottom:4px">Оберіть дати:</div><div id="rec-custom-dates"></div><button type="button" class="btn btn-s btn-sm" style="font-size:.68rem;margin-top:3px" onclick="addRecCustomDate()">＋ Додати дату</button></div>' +
    '</div><div class="fg"><label>Період до</label><input type="date" id="df-pe" value="' + ped + '"></div></div>' +
    '<div class="fg"><label>Виконавці</label><div id="df-executors">' + buildExecutorsList(d.executor) + '</div><button type="button" class="btn btn-s btn-sm" style="margin-top:4px" onclick="addExecutorRow()">＋ Додати виконавця</button></div>' +
    '<div class="frow"><div class="fg"><label>📤 Звітувати</label><div style="position:relative"><input type="text" id="df-rp" value="' + esc(d.reportTo||'') + '" placeholder="Пошук..." oninput="filterOrgPicker(this,\x27df-rp-drop\x27)" onfocus="showOrgDrop(\x27df-rp-drop\x27)" autocomplete="off" style="width:100%"><div id="df-rp-drop" class="org-drop" style="display:none"></div></div><div id="df-rp-spec" style="font-size:.7rem;color:var(--tx3);margin-top:2px"></div></div>' +
    '<div class="fg"><label>Email</label><input type="text" id="df-em" value="' + (d.row ? esc(d.email||'') : '') + '" placeholder="Обирається автоматично"><div id="df-em-suggest" style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px"></div></div></div>' +
    '<div class="fg"><label>🔔 Нагадування (дні)</label><div id="df-rm" style="display:flex;gap:5px;flex-wrap:wrap">' + remDays.map(function(r){ var isDef = defRemArr.indexOf(r.v)>=0; var isOn = curRem.indexOf(r.v)>=0; return '<label style="display:flex;align-items:center;gap:2px;font-size:.76rem;cursor:pointer;' + (isDef?'font-weight:700':'') + '"><input type="checkbox" value="' + r.v + '"' + (isOn?' checked':'') + ' style="accent-color:var(--acc)"> ' + r.l + '</label>'; }).join('') + '</div>' +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;font-size:.7rem;color:var(--tx3)">⏰ За час: ' + remTime.map(function(r){ var isOn = curRem.indexOf(r.v)>=0; return '<label style="display:flex;align-items:center;gap:2px;cursor:pointer"><input type="checkbox" value="' + r.v + '" class="rem-time-cb"' + (isOn?' checked':'') + ' style="accent-color:var(--orn)"> ' + r.l + '</label>'; }).join('') + '</div></div>' +
    '<div class="fg"><label>📎 Вхідні документи</label><div id="df-incoming-files">' + buildIncomingFiles(d.docLink) + '</div>' +
    '<div style="display:flex;gap:4px;margin-top:4px"><label class="btn btn-p btn-sm" style="cursor:pointer;padding:8px 14px">📤 Завантажити файл<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls" style="display:none" multiple onchange="addIncomingFiles(this)"></label><button type="button" class="btn btn-s btn-sm" onclick="addIncomingUrl()">🔗 Вставити URL</button></div></div>' +
    (d.row ? '<div class="fg"><label>📨 Відповідь</label><div style="display:flex;gap:4px;flex-wrap:wrap"><input type="url" id="df-rl" value="' + esc(d.respLink||'') + '" style="flex:1;min-width:100px" placeholder="URL або завантажте файл"><button type="button" class="btn btn-s btn-sm" onclick="pickFile(\'df-rl\')" title="Вибрати з Drive">📂</button><label class="btn btn-s btn-sm" style="cursor:pointer" title="Завантажити">📤<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls" style="display:none" onchange="uploadFileToField(this,\'df-rl\')"></label></div></div>' : '<input type="hidden" id="df-rl" value="">') +
    '<div class="fg"><label>📄 Зразок відповіді</label><div style="display:flex;gap:4px;flex-wrap:wrap"><input type="url" id="df-sp" value="' + esc(d.sampleResp||'') + '" style="flex:1;min-width:100px" placeholder="URL або завантажте файл"><button type="button" class="btn btn-s btn-sm" onclick="pickFile(\'df-sp\')" title="Вибрати з Drive">📂</button><label class="btn btn-s btn-sm" style="cursor:pointer" title="Завантажити">📤<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls" style="display:none" onchange="uploadFileToField(this,\'df-sp\')"></label></div></div>' +
    '<div class="fg"><label>📅 Додаткові дати виконання / звітування</label><div id="df-extra-dates">' + buildExtraDates(d.extraDates) + '</div><button type="button" class="btn btn-p" style="margin-top:6px;width:100%;padding:10px;font-size:.84rem" onclick="addExtraDate()">＋ Додати термін звітування</button></div>' +
    '<div class="fg"><label>📁 Додаткові файли</label><div id="df-files-list">' + buildFilesList(d.files) + '</div><button type="button" class="btn btn-s btn-sm" style="margin-top:4px" onclick="addFileRow()">＋ Додати файл</button></div>' +
    '<div class="fg"><label>Примітки</label><textarea id="df-nt">' + esc(d.notes||'') + '</textarea></div>' +
    '<div class="fg"><label>Теги</label><div id="df-tg" class="tag-chips" style="margin:0">' + Object.keys(TM).map(function(t){ var on = (d.tags||[]).indexOf(t) >= 0, i = TM[t]; return '<span class="tchip' + (on?' on':'') + '" data-tag="' + t + '" style="background:' + (on?i.x+'33':'transparent') + ';color:' + i.x + ';border-color:' + i.x + '" onclick="this.classList.toggle(\'on\');this.style.background=this.classList.contains(\'on\')?\'' + i.x + '33\':\'transparent\'">' + t + '</span>'; }).join('') + '</div></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="saveDoc()">💾</button><button class="btn btn-s" onclick="saveTpl()">📄</button><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';
  return h;
}

function openNewDoc(t) { if(!hasPerm('docs','create')){toast('⚠️ Немає прав на створення');return;} el('rpc').innerHTML = docForm(t || {}, '📝 Новий документ'); openP(); }

function openEdit(row) { if(!hasPerm('docs','edit')){toast('⚠️ Немає прав на редагування');return;} var d = null; for (var i=0;i<D.length;i++) if (D[i].row==row) { d=D[i]; break; } if (!d) return; el('rpc').innerHTML = docForm(d, '✏️ Редагувати'); openP(); setTimeout(function(){ restoreRecurring(d.recurring); }, 50); }

function copyDoc(row) { var d = null; for (var i=0;i<D.length;i++) if (D[i].row==row) { d=D[i]; break; } if (!d) return; var c = {}; for (var k in d) c[k] = d[k]; c.row = ''; c.done = ''; c.doneDate = ''; c.respNum = ''; c.respLink = ''; el('rpc').innerHTML = docForm(c, '📋 Копія'); openP(); setTimeout(function(){ restoreRecurring(d.recurring); }, 50); toast('📋 Скопійовано'); }


function saveDoc() {
  try {
  var row = el('df-r').value, tp = el('df-tp').value, inn = el('df-in').value.trim();
  var fr = el('df-fr') ? el('df-fr').value.trim() : '';
  var nm = el('df-nm').value.trim(), ds = el('df-ds').value.trim();
  var ddv = el('df-dd').value, dlv = el('df-dl').value;
  var tmh = el('df-tm-h') ? el('df-tm-h').value : '12';
  var tmm = el('df-tm-m') ? el('df-tm-m').value : '00';
  var tmv = tmh + ':' + tmm;
  var rc = getRecurringValue(), pev = el('df-pe').value;
  var ex = getExecutorsValue(), rp = el('df-rp') ? el('df-rp').value.trim() : '', em = el('df-em') ? el('df-em').value.trim() : '';
  var rmArr = []; document.querySelectorAll('#df-rm input:checked').forEach(function(e){ rmArr.push(e.value); }); document.querySelectorAll('.rem-time-cb:checked').forEach(function(e){ rmArr.push(e.value); }); var rm = rmArr.join(',');
  var extraDates = getExtraDates();
  var incLinks = getIncomingLinks();
  var lk = incLinks.length ? incLinks.join(';') : '', rl = el('df-rl') ? el('df-rl').value.trim() : '', sp = el('df-sp') ? el('df-sp').value.trim() : '';
  var fl = getFilesValue(), nt = el('df-nt') ? el('df-nt').value.trim() : '';
  var tags = []; document.querySelectorAll('#df-tg .tchip.on').forEach(function(e){ tags.push(e.getAttribute('data-tag')); });
  if (!nm && !ds) { toast('⚠️ Назва або опис'); return; }
  // Auto-fill periodEnd for recurring
  if (rc !== 'Ні' && !pev && dlv) {
    var autoEnd = new Date(dlv);
    autoEnd.setFullYear(autoEnd.getFullYear() + 1);
    pev = autoEnd.getFullYear() + '-' + p2(autoEnd.getMonth()+1) + '-' + p2(autoEnd.getDate());
    if (el('df-pe')) el('df-pe').value = pev;
  }
  if (rc !== 'Ні' && !dlv) { toast('⚠️ Вкажіть термін виконання для повторюваних'); return; }
  var deadline = ''; if (dlv) { var pp = dlv.split('-'); deadline = pp[2]+'.'+pp[1]+'.'+pp[0]; var addTime = tmv !== '12:00' || ['Вебінар','Засідання','Нарада'].indexOf(tp) >= 0; if (addTime && tmv) deadline += ' ' + tmv; }
  var docDate = ''; if (ddv) { var pp = ddv.split('-'); docDate = pp[2]+'.'+pp[1]+'.'+pp[0]; }
  var periodEnd = ''; if (pev) { var pp = pev.split('-'); periodEnd = pp[2]+'.'+pp[1]+'.'+pp[0]; }
  var payload = {action:row?'editDoc':'addDoc',row:row||undefined,type:tp,inNum:inn,docDate:docDate,from:fr,name:nm,desc:ds,deadline:deadline,recurring:rc,periodEnd:periodEnd,executor:ex,reportTo:rp,email:em,reminder:rm,docLink:lk,respLink:rl,sampleResp:sp,extraDates:extraDates,files:fl,notes:nt,tags:JSON.stringify(tags)};
  showSaveConfirm(payload);
  } catch(err) { toast('❌ Помилка: ' + err.message); console.error(err); }
}


function showSaveConfirm(payload) {
  var h = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">📋 Підтвердження збереження</h2>';
  h += '<div style="font-size:.78rem;line-height:1.6;background:var(--bg);padding:10px;border-radius:var(--r2);margin-bottom:10px">';
  h += '<div><b>Тип:</b> ' + esc(payload.type) + '</div>';
  if (payload.inNum) h += '<div><b>Вхідний №:</b> ' + esc(payload.inNum) + '</div>';
  if (payload.from) h += '<div><b>Від кого:</b> ' + esc(payload.from) + '</div>';
  h += '<div><b>Назва:</b> ' + esc(payload.name) + '</div>';
  if (payload.desc) h += '<div><b>Завдання:</b> ' + esc(payload.desc) + '</div>';
  if (payload.deadline) h += '<div><b style="color:var(--ylw)">📅 Дедлайн:</b> ' + esc(payload.deadline) + '</div>';
  if (payload.docDate) h += '<div><b>📆 Дата документа:</b> ' + esc(payload.docDate) + '</div>';
  if (payload.recurring && payload.recurring !== 'Ні') h += '<div><b style="color:var(--acc2)">🔄 Повторюваний:</b> ' + esc(payload.recurring) + '</div>';
  if (payload.periodEnd) h += '<div><b>📅 Період до:</b> ' + esc(payload.periodEnd) + '</div>';
  if (payload.executor) h += '<div><b>👤 Виконавці:</b> ' + esc(payload.executor) + '</div>';
  if (payload.reportTo) h += '<div><b>📤 Звітувати:</b> ' + esc(payload.reportTo) + '</div>';
  if (payload.reminder) h += '<div><b>🔔 Нагадування:</b> за ' + esc(payload.reminder) + ' дн.</div>';

  // Show generated control dates for recurring
  var allCtrlDates = [];
  if (payload.recurring && payload.recurring !== 'Ні' && payload.deadline && payload.periodEnd) {
    var dates = generateControlDates(payload.recurring, payload.deadline, payload.periodEnd);
    dates.forEach(function(dt){ allCtrlDates.push({date:dt, source:'Основний', from:payload.reportTo||''}); });
  } else if (payload.deadline) {
    allCtrlDates.push({date:fD(payload.deadline).split(' ')[0], source:'Основний', from:payload.reportTo||''});
  }
  // Add extra dates expanded
  try { var extras = payload.extraDates ? JSON.parse(payload.extraDates) : [];
    extras.forEach(function(e, ei) {
      if (e.recurring && e.recurring !== 'Ні' && e.date) {
        var expanded = expandRecurringDates(e.date, e.recurring, e.periodEnd);
        expanded.forEach(function(d){ allCtrlDates.push({date:p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear(), source:'#'+(ei+2)+' '+(e.desc||''), from:e.reportTo||e.from||''}); });
      } else if (e.date) {
        allCtrlDates.push({date:e.date.split(' ')[0], source:'#'+(ei+2)+' '+(e.desc||''), from:e.reportTo||e.from||''});
      }
    });
  } catch(ex){}
  // Sort all dates
  allCtrlDates.sort(function(a,b){ var da=pD(a.date),db=pD(b.date); if(!da||!db)return 0; return da-db; });
  if (allCtrlDates.length) {
    h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--brd)"><b style="color:var(--acc)">📅 Всі контрольні дати (' + allCtrlDates.length + '):</b>';
    h += '<div style="max-height:160px;overflow-y:auto;font-size:.72rem;margin-top:4px">';
    h += '<table style="width:100%;border-collapse:collapse"><tr style="font-size:.65rem;color:var(--tx3)"><td style="padding:2px 4px">№</td><td style="padding:2px 4px">Дата</td><td style="padding:2px 4px">Джерело</td><td style="padding:2px 4px">Звітувати</td></tr>';
    allCtrlDates.forEach(function(dt,i){
      h += '<tr style="border-top:1px solid var(--bg3)"><td style="padding:2px 4px;color:var(--tx3)">'+(i+1)+'</td><td style="padding:2px 4px">'+esc(dt.date)+'</td><td style="padding:2px 4px;color:var(--tx3);font-size:.65rem">'+esc(dt.source)+'</td><td style="padding:2px 4px;font-size:.65rem">'+esc(dt.from)+'</td></tr>';
    });
    h += '</table></div></div>';
  }
  h += '</div>';
  h += '<div class="btn-row"><button class="btn btn-p" onclick="confirmSave()">💾 Зберегти</button><button class="btn btn-s" onclick="confirmAndPrint()">🖨 Резолюція</button><button class="btn btn-s" onclick="backToEdit()">✏️ Редагувати</button><button class="btn btn-s" onclick="closeP()">✕</button></div></div>';

  // Store payload for confirmation
  window._pendingPayload = payload;
  el('rpc').innerHTML = h;
}


function confirmSave() {
  var payload = window._pendingPayload;
  if (!payload) return;
  
  // First upload any pending incoming files to get URLs
  var pendingInc = window._pendingIncoming || [];
  if (pendingInc.length > 0) {
    toast('📤 Завантажую вхідні файли...');
    uploadIncomingSeq(pendingInc, 0, [], function(urls) {
      // Append uploaded URLs to payload.docLink
      var existing = payload.docLink ? payload.docLink.split(';').filter(function(s){return s.trim() && s.indexOf('📤')<0}) : [];
      payload.docLink = existing.concat(urls).join(';');
      window._pendingIncoming = [];
      doFinalSave(payload);
    });
  } else {
    // Clean any pending placeholders from docLink
    if (payload.docLink) payload.docLink = payload.docLink.split(';').filter(function(s){return s.trim()&&s.indexOf('📤')<0}).join(';');
    doFinalSave(payload);
  }
}


function doFinalSave(payload) {
  toast('💾 Зберігаю...');
  apiP(payload).then(function(r) {
    if (r.ok || r.row) {
      var savedRow = r.row || payload.row;
      logAction(payload.row ? 'edit' : 'create', (payload.type||'') + ': ' + (payload.name||'').substring(0,40), savedRow);
      var pf = window._pendingFiles || {};
      var fileKeys = Object.keys(pf);
      if (fileKeys.length > 0 && savedRow) {
        uploadPendingFiles(savedRow, fileKeys, 0, function() {
          window._pendingFiles = {};
          toast('✅ Збережено!'); closeP(); loadData();
        });
      } else {
        toast('✅ Збережено'); closeP(); loadData();
      }
    } else toast('❌ ' + (r.error || ''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}


function confirmAndPrint() {
  /* Зберігаємо документ і після збереження відкриваємо резолюцію */
  var payload = window._pendingPayload;
  if (!payload) return;

  var pendingInc = window._pendingIncoming || [];
  function doSaveAndPrint(pl) {
    toast('💾 Зберігаю...');
    apiP(pl).then(function(r) {
      if (r.ok || r.row) {
        var savedRow = r.row || pl.row;
        try { if (typeof logAction === 'function') logAction(pl.row ? 'edit' : 'create', (pl.type||'') + ': ' + (pl.name||'').substring(0,40), savedRow); } catch(le){}
        var pf = window._pendingFiles || {};
        var fileKeys = Object.keys(pf);
        function afterFiles() {
          window._pendingFiles = {};
          toast('✅ Збережено');
          closeP();
          loadData();
          /* Відкриваємо резолюцію після завантаження даних */
          setTimeout(function() {
            if (typeof printResolution === 'function' && savedRow) {
              printResolution(savedRow);
            }
          }, 800);
        }
        if (fileKeys.length > 0 && savedRow) {
          uploadPendingFiles(savedRow, fileKeys, 0, afterFiles);
        } else {
          afterFiles();
        }
      } else toast('❌ ' + (r.error || ''));
    }).catch(function(e) { toast('❌ ' + e.message); });
  }

  if (pendingInc.length > 0) {
    toast('📤 Завантажую вхідні файли...');
    uploadIncomingSeq(pendingInc, 0, [], function(urls) {
      var existing = payload.docLink ? payload.docLink.split(';').filter(function(s){return s.trim()&&s.indexOf('📤')<0}) : [];
      payload.docLink = existing.concat(urls).join(';');
      window._pendingIncoming = [];
      doSaveAndPrint(payload);
    });
  } else {
    if (payload.docLink) payload.docLink = payload.docLink.split(';').filter(function(s){return s.trim()&&s.indexOf('📤')<0}).join(';');
    doSaveAndPrint(payload);
  }
}

function backToEdit() {
  // Re-open the form — crude but effective
  var p = window._pendingPayload;
  if (!p) { closeP(); return; }
  // Find doc by row if editing
  if (p.row) {
    var d = null; for (var i=0;i<D.length;i++) if(D[i].row==p.row){d=D[i];break;}
    if (d) { el('rpc').innerHTML = docForm(d, '✏️ Редагувати'); openP(); setTimeout(function(){ restoreRecurring(d.recurring); }, 50); return; }
  }
  el('rpc').innerHTML = docForm(p, '📝 Новий документ'); openP();
}


/* ─── DETAIL ─── */
function openDet(row) {
  var d = null; for (var i = 0; i < D.length; i++) { if (D[i].row == row) { d = D[i]; break; } } if (!d) return;
  var dl = pD(d.deadline), ht = hasExplicitTime(d.deadline);
  var tg = ''; if (d.tags && d.tags.length) { tg = '<div class="card-tags" style="margin:5px 0">'; d.tags.forEach(function(t){ var i = TM[t]; if (i) tg += '<span class="tag ' + i.c + '">' + esc(t) + '</span>'; }); tg += '</div>'; }
  var fl = ''; if (d.files) { fl = '<div style="font-size:.7rem;margin-bottom:6px">📁 ' + renderFL(d.files) + '</div>'; }
  // Status indicator
  var now = new Date(), stText = '', stColor = '', stIcon = '';
  if (d.done) {
    var isCancelled = String(d.done).indexOf('касован')>=0||String(d.done).indexOf('рипинен')>=0||String(d.done).indexOf('тратив')>=0;
    stText = isCancelled ? d.done : '✅ Виконано ' + fD(d.doneDate);
    stColor = isCancelled ? 'var(--red)' : 'var(--grn)';
    stIcon = isCancelled ? '🚫' : '✅';
  } else if (dl) {
    var daysLeft = Math.ceil((dl - now) / 86400000);
    if (daysLeft < 0) { stText = '🔴 Прострочено на ' + Math.abs(daysLeft) + ' дн.'; stColor = 'var(--red)'; stIcon = '🔴'; }
    else if (daysLeft === 0) { stText = '⚡ Сьогодні останній день!'; stColor = 'var(--orn)'; stIcon = '⚡'; }
    else if (daysLeft === 1) { stText = '⏰ Завтра термін'; stColor = 'var(--orn)'; stIcon = '⏰'; }
    else if (daysLeft <= 3) { stText = '📅 Залишилось ' + daysLeft + ' дні'; stColor = 'var(--orn)'; stIcon = '📅'; }
    else if (daysLeft <= 7) { stText = '📅 Залишилось ' + daysLeft + ' днів'; stColor = 'var(--acc2)'; stIcon = '📅'; }
    else { stText = '📋 Активний • ' + daysLeft + ' днів'; stColor = 'var(--tx3)'; stIcon = '📋'; }
  } else { stText = '📋 Без терміну'; stColor = 'var(--tx3)'; stIcon = '📋'; }
  // Child count
  var pid = String(d.parentId||'');
  var childCount = (pid && pid === String(d.row)) ? D.filter(function(x){return String(x.parentId)===pid && x.row!==d.row}).length : 0;
  var childDone = (pid && pid === String(d.row)) ? D.filter(function(x){return String(x.parentId)===pid && x.row!==d.row && x.done}).length : 0;

  var h = '<div style="margin-top:18px">' +
    '<div style="background:' + stColor + '22;border-left:4px solid ' + stColor + ';padding:8px 12px;border-radius:0 var(--r2) var(--r2) 0;margin-bottom:8px;font-size:.82rem;font-weight:700;color:' + stColor + '">' + stIcon + ' ' + esc(stText) +
    (childCount ? '<span style="font-size:.7rem;margin-left:8px;font-weight:400">📅 ' + childCount + ' дат (✅' + childDone + ')</span>' : '') + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><h2 style="font-size:1rem;font-weight:700;flex:1">' + esc(d.name || '—') + '</h2><span class="card-badge">' + esc(d.type || '—') + '</span></div>' +
    (d.from ? '<p style="color:var(--tx2);font-size:.78rem">📨 ' + esc(d.from) + (d.inNum ? ' • Вх.№' + esc(d.inNum) : '') + '</p>' : '') +
    (d.desc ? '<p style="font-size:.8rem;margin:5px 0;line-height:1.4">' + esc(d.desc) + '</p>' : '') + tg +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:8px 0;font-size:.73rem">' +
    '<div><span style="color:var(--tx3)">📅 Термін:</span><br><b class="card-dl ' + dC(d.deadline) + '">' + fD(d.deadline) + (ht ? ' ⏰' : '') + '</b></div>' +
    '<div><span style="color:var(--tx3)">📆 Дата док:</span><br><b>' + fD(d.docDate) + '</b></div>' +
    '<div><span style="color:var(--tx3)">👤 Виконавець:</span><br><b>' + esc(d.executor || '—') + '</b></div>' +
    '<div><span style="color:var(--tx3)">📤 Звітувати:</span><br><b>' + esc(d.reportTo || '—') + '</b></div>' +
    '<div><span style="color:var(--tx3)">🔄 Повтор:</span><br><b>' + esc(d.recurring || 'Ні') + '</b></div>' +
    '<div><span style="color:var(--tx3)">📅 Період до:</span><br><b>' + fD(d.periodEnd) + '</b></div>' +
    '<div><span style="color:var(--tx3)">🔔 Нагадув.:</span><br><b>' + (d.reminder ? 'за ' + esc(d.reminder) + ' дн.' : '—') + '</b></div>' +
    '<div><span style="color:var(--tx3)">✉️ Email:</span><br><b>' + esc(d.email || '—') + '</b></div>' +
    '<div><span style="color:var(--tx3)">✅ Виконано:</span><br><b>' + esc(d.done || 'Ні') + '</b></div>' +
    '<div><span style="color:var(--tx3)">📋 Дата вик:</span><br><b>' + fD(d.doneDate) + '</b></div>' +
    (d.notes ? '<div style="grid-column:1/3"><span style="color:var(--tx3)">📝:</span> ' + esc(d.notes) + '</div>' : '') +
    (d.log ? '<div style="grid-column:1/3;margin-top:4px"><details><summary style="cursor:pointer;color:var(--tx3);font-size:.68rem">📜 Історія змін</summary><div style="font-size:.65rem;color:var(--tx3);margin-top:4px;padding:4px;background:var(--bg);border-radius:var(--r2);max-height:100px;overflow-y:auto;white-space:pre-line;font-family:var(--mono)">' + esc(d.log) + '</div></details></div>' : '') +
    '</div>' +
    '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:6px 0">' +
    (d.docLink ? (function() { var links = d.docLink.split(';').filter(function(s){return s.trim()}); return links.map(function(url,i) { return '<button class="btn btn-s btn-sm btn-icon" title="Відкрити вхідний документ" onclick="openDocOverlay(\'' + esc(url.trim()) + '\')">📎 Вхідний' + (links.length>1?' #'+(i+1):'') + '</button>'; }).join(''); })() : '') +
    (d.respLink ? '<button class="btn btn-s btn-sm btn-icon" title="Відкрити документ відповіді" onclick="openDocOverlay(\'' + esc(d.respLink) + '\')">📨 Відповідь</button>' : '') +
    (d.sampleResp ? '<a href="' + esc(d.sampleResp) + '" target="_blank" class="btn btn-s btn-sm btn-icon" title="Відкрити зразок відповіді">📄 Зразок</a>' : '') +
    '</div>' + fl;

  // Show parent/child relationship
  var parentId = d.parentId ? String(d.parentId) : '';
  var isParent = parentId === String(d.row);
  var isChild = parentId && !isParent;
  var siblings = [];

  if (isParent) {
    // This is a parent doc — find all children
    siblings = D.filter(function(x){ return String(x.parentId) === String(d.row) && x.row !== d.row; });
  } else if (isChild) {
    // This is a child — find parent and all siblings
    siblings = D.filter(function(x){ return String(x.parentId) === parentId; });
  }

  if (isChild) {
    h += '<div style="margin:8px 0;padding:6px;background:var(--bg);border-radius:var(--r2);font-size:.75rem">' +
      '📌 Це повторюваний контроль. <a href="javascript:void(0)" onclick="openDet(' + parentId + ')" style="color:var(--acc2)">→ Батьківський документ</a></div>';
  }

  if (siblings.length > 0) {
    h += '<div style="margin:8px 0"><div style="font-size:.78rem;font-weight:700;margin-bottom:4px">📅 Контрольні дати (' + (siblings.length + (isParent ? 1 : 0)) + '):</div>';
    h += '<div style="max-height:200px;overflow-y:auto">';
    // Include parent itself if viewing parent
    var allDates = isParent ? [d].concat(siblings) : siblings;
    allDates.sort(function(a,b){ var da = pD(a.deadline), db = pD(b.deadline); if(!da) return 1; if(!db) return -1; return da-db; });
    allDates.forEach(function(s) {
      var isCurrent = s.row === d.row;
      var bg = isCurrent ? 'var(--acc)' : (s.done ? 'var(--grn)' : 'var(--bg)');
      var clr = isCurrent ? '#fff' : (s.done ? '#fff' : 'var(--tx)');
      h += '<div style="padding:5px 8px;background:' + bg + ';color:' + clr + ';border-radius:var(--r2);margin-bottom:2px;font-size:.73rem;display:flex;justify-content:space-between;align-items:center;gap:4px">';
      h += '<span onclick="openDet(\x27' + s.row + '\x27)" style="cursor:pointer;flex:1">📅 ' + fD(s.deadline) + '</span>';
      h += '<span>' + (s.done ? '✅' : '⏳') + '</span>';
      if (s.respLink) h += '<button onclick="event.stopPropagation();openDocOverlay(\'' + esc(s.respLink) + '\')" style="background:none;border:none;cursor:pointer;font-size:.7rem" title="Переглянути відповідь">📨</button>';
      h += '<button onclick="event.stopPropagation();openMkD(\x27' + s.row + '\x27)" style="background:none;border:none;cursor:pointer;font-size:.7rem" title="Виконати / завантажити файл">📎</button>';
      h += '</div>';
    });
    h += '</div></div>';
  }

  h += '<div class="btn-row">' + (!d.done ? '<button class="btn btn-p btn-sm" title="Відмітити як виконаний" onclick="openMkD(\x27' + d.row + '\x27)">✅ Виконано</button>' : '') +
    '<button class="btn btn-s btn-sm" title="Редагувати документ" onclick="openEdit(\x27' + d.row + '\x27)">✏️ Редагувати</button>' +
    '<button class="btn btn-s btn-sm" title="Друк резолюції" onclick="printResolution(\x27' + d.row + '\x27)">🖨 Резолюція</button>' +
    '<button class="btn btn-s btn-sm" title="Створити копію як зразок" onclick="copyDoc(\x27' + d.row + '\x27)">📋 Копія</button>' +
    (!d.done ? '<button class="btn btn-s btn-sm" style="color:var(--orn)" title="Скасувати / Припинити виконання" onclick="openCancelDoc(\x27' + d.row + '\x27)">🚫 Скасувати</button>' : '') +
    '<button class="btn btn-d btn-sm" title="Видалити документ" onclick="delDoc(\x27' + d.row + '\x27)">🗑</button></div></div>';
  el('rpc').innerHTML = h;
  openP();
}


/* ─── MARK DONE ─── */
function openMkD(row) {
  var doc = null; for (var i=0;i<D.length;i++) if(D[i].row==row){doc=D[i];break;}
  var isBday = doc && doc.type === 'Привітання';
  var title = isBday ? '🎂 Привітання' : '📋 Зміна статусу';
  var defText = isBday ? 'Привітано' : 'виконано';
  var notePlaceholder = isBday ? 'Як привітали? Що подарували?' : 'Додаткова інформація...';
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">' + title + '</h2>' +
    (isBday && doc ? '<div style="padding:8px;background:rgba(168,85,247,.1);border:1px solid var(--vio);border-radius:var(--r2);margin-bottom:8px;font-size:.82rem">🎂 <b>' + esc(doc.name) + '</b><br><span style="font-size:.72rem;color:var(--tx2)">' + esc(doc.desc||'') + '</span></div>' : '') +
    (!isBday ? '<div class="fg"><label>Статус</label><div style="display:flex;gap:4px;flex-wrap:wrap">' +
    '<button type="button" class="btn btn-sm stat-btn" data-st="виконано" onclick="selStatus(this)" style="background:var(--grn);color:#fff">✅ Виконано</button>' +
    '<button type="button" class="btn btn-sm stat-btn" data-st="на підписі" onclick="selStatus(this)" style="background:var(--ylw);color:#000">✍️ На підписі</button>' +
    '<button type="button" class="btn btn-sm stat-btn" data-st="на доопрацюванні" onclick="selStatus(this)" style="background:var(--orn);color:#fff">🔄 На доопрацюванні</button>' +
    '<button type="button" class="btn btn-sm stat-btn" data-st="на погодженні" onclick="selStatus(this)" style="background:var(--acc);color:#fff">📝 На погодженні</button>' +
    '</div><input type="hidden" id="dm-status" value="виконано"></div>' : '') +
    '<div class="fg"><label>Текст відмітки</label><input type="text" id="dm-t" value="' + defText + '"></div>' +
    '<div class="frow"><div class="fg"><label>№ відповіді</label><input type="text" id="dm-r"></div>' +
    '<div class="fg"><label>Дата</label><input type="date" id="dm-d" value="' + isoT() + '"></div></div>' +
    '<div class="frow"><div class="fg"><label>⏰ Час (необов.)</label><input type="time" id="dm-time"></div><div class="fg"></div></div>' +
    '<div class="fg"><label>📨 Посилання</label><input type="url" id="dm-l" placeholder="https://drive.google.com/..."></div>' +
    '<div class="fg"><label>📎 Файл' + (isBday?' (фото, листівка)':'') + '</label>' +
    '<input type="file" id="dm-file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls" style="font-size:.72rem;color:var(--tx2)" onchange="onDoneFileSelect(this)">' +
    '<div id="dm-file-status" style="font-size:.68rem;color:var(--tx3);margin-top:3px"></div></div>' +
    '<div class="fg"><label>📝 Примітка</label><textarea id="dm-note" style="min-height:50px" placeholder="' + notePlaceholder + '"></textarea></div>' +
    '<div class="btn-row"><button class="btn btn-p" onclick="subDone(\x27' + row + '\x27)">' + (isBday?'🎂 Привітав!':'💾 Зберегти') + '</button><button class="btn btn-s" onclick="openDet(\x27' + row + '\x27)">← Назад</button></div></div>';
  openP();
}


function delDoc(row) {
  if (hasPerm('docs', 'full')) {
    if (!confirm('Видалити?')) return;
    apiP({action:'delDoc',row:row}).then(function(r){if(r.ok){toast('🗑');logAction('delete','Видалено документ',row);closeP();loadData()}else toast('❌')}).catch(function(e){toast('❌ '+e.message)});
  } else {
    if (!confirm('Надіслати запит адміністратору на видалення?')) return;
    apiP({action:'requestDelete',row:row,user:CUR_USER?CUR_USER.login:''}).then(function(r){
      if(r.ok){toast('📨 Запит надіслано адміністратору');logAction('requestDelete','Запит на видалення',row);closeP()}else toast('❌ '+(r.error||''));
    }).catch(function(e){toast('❌ '+e.message)});
  }
}


/* ─── CANCEL / SUSPEND DOC ─── */
function openCancelDoc(row) {
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">🚫 Скасування / Припинення</h2>' +
    '<div class="fg"><label>Причина</label><select id="cn-reason">' +
    '<option>Скасовано</option>' +
    '<option>Припинено виконання</option>' +
    '<option>Втратив чинність</option>' +
    '</select></div>' +
    '<div class="fg"><label>Деталі / На підставі чого</label><textarea id="cn-detail" style="min-height:50px" placeholder="В зв\'язку з прийняттям нового..."></textarea></div>' +
    '<div class="fg"><label>📎 Документ-підстава</label><div style="display:flex;gap:4px"><input type="url" id="cn-link" style="flex:1" placeholder="https://drive.google.com/..."><button type="button" class="btn btn-s btn-sm" onclick="pickFile(\'cn-link\')">📂</button></div></div>' +
    '<div class="btn-row"><button class="btn btn-p" style="background:var(--orn)" onclick="doCancelDoc(\x27' + row + '\x27)">🚫 Скасувати</button><button class="btn btn-s" onclick="openDet(\x27' + row + '\x27)">← Назад</button></div></div>';
  openP();
}


function doCancelDoc(row) {
  var reason = el('cn-reason') ? el('cn-reason').value : 'Скасовано';
  var detail = el('cn-detail') ? el('cn-detail').value.trim() : '';
  var link = el('cn-link') ? el('cn-link').value.trim() : '';
  var doneText = reason + (detail ? ': ' + detail : '') + (link ? ' [' + link + ']' : '');
  toast('💾...');
  apiP({action:'markDone', row:row, doneText:doneText, doneDate:isoT().split('-').reverse().join('.')}).then(function(r) {
    if (r.ok) { toast('🚫 ' + reason); closeP(); loadData(); } else toast('❌ ' + (r.error||''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}


/* ─── PERIODIC: CHECK IF LAST DATE ─── */
function checkPeriodicEnd(row) {
  var d = null; for (var i=0;i<D.length;i++) if (D[i].row==row) { d=D[i]; break; } if (!d) return false;
  // Check if this is the last date in a periodic series
  var pid = String(d.parentId || '');
  if (!pid) return false;
  var siblings = D.filter(function(x) { return String(x.parentId) === pid; });
  var undone = siblings.filter(function(x) { return !x.done && x.row !== d.row; });
  // If marking this as done and no other undone remain — it's the last one
  if (undone.length > 0) return false;
  // Check if parent has recurring
  var parent = null;
  for (var i=0;i<D.length;i++) { if (String(D[i].row) === pid || String(D[i].parentId) === pid && D[i].row == D[i].parentId) { parent = D[i]; break; } }
  if (!parent || !parent.recurring || parent.recurring === 'Ні') return false;
  return true;
}


function showPeriodicEndPopup(row) {
  var d = null; for (var i=0;i<D.length;i++) if (D[i].row==row) { d=D[i]; break; } if (!d) return;
  el('rpc').innerHTML = '<div style="margin-top:18px"><h2 style="font-size:1rem;font-weight:700;margin-bottom:10px">🔄 Це остання контрольна дата!</h2>' +
    '<p style="font-size:.82rem;color:var(--tx2);margin-bottom:12px">Всі дати цього документа виконані. Що далі?</p>' +
    '<div style="display:flex;flex-direction:column;gap:8px">' +
    '<button class="btn btn-p" onclick="extendPeriodic(' + row + ')" style="padding:12px;font-size:.88rem">🔄 Продовжити ще на 1 період</button>' +
    '<button class="btn btn-s" onclick="closeP();toast(\'✅ Завершено\')" style="padding:12px;font-size:.88rem">✅ Завершити — більше не потрібно</button>' +
    '<button class="btn btn-s" onclick="openEdit(\x27' + row + '\x27)" style="padding:12px;font-size:.88rem">⚙️ Змінити період / налаштування</button>' +
    '</div></div>';
  openP();
}


function extendPeriodic(row) {
  var d = null; for (var i=0;i<D.length;i++) if (D[i].row==row) { d=D[i]; break; } if (!d) return;
  // Find parent to get period end and recurring info
  var pid = String(d.parentId || '');
  var parent = null;
  for (var i=0;i<D.length;i++) {
    if ((String(D[i].row) === pid || String(D[i].parentId) === pid) && D[i].recurring && D[i].recurring !== 'Ні') { parent = D[i]; break; }
  }
  if (!parent) { toast('⚠️ Не знайдено батьківський документ'); return; }
  // Extend period end by the recurring interval
  var pe = pD(parent.periodEnd) || pD(d.deadline) || new Date();
  var rec = parent.recurring || '';
  if (rec.indexOf('Щоденно') >= 0) pe.setDate(pe.getDate() + 30);
  else if (rec.indexOf('Щотижня') >= 0) pe.setMonth(pe.getMonth() + 3);
  else if (rec.indexOf('Щомісяця') >= 0) pe.setFullYear(pe.getFullYear() + 1);
  else if (rec.indexOf('Щокварталу') >= 0) pe.setFullYear(pe.getFullYear() + 1);
  else if (rec.indexOf('Щороку') >= 0) pe.setFullYear(pe.getFullYear() + 1);
  else pe.setMonth(pe.getMonth() + 3); // default 3 months
  var newPE = p2(pe.getDate()) + '.' + p2(pe.getMonth()+1) + '.' + pe.getFullYear();
  toast('💾 Продовжую до ' + newPE + '...');
  apiP({action:'editDoc', row:parent.row, periodEnd:newPE}).then(function(r) {
    if (r.ok) { toast('✅ Продовжено до ' + newPE + '. Перезавантажую...'); closeP(); loadData(); }
    else toast('❌ ' + (r.error||''));
  }).catch(function(e) { toast('❌ ' + e.message); });
}


function uploadIncomingSeq(files, idx, urls, callback) {
  if (idx >= files.length) { callback(urls); return; }
  var f = files[idx];
  toast('📤 ' + f.name + ' (' + (idx+1) + '/' + files.length + ')...');
  apiP({action:'uploadFile', fileName:f.name, fileType:f.type, fileData:f.data}).then(function(r) {
    if (r.fileUrl) urls.push(r.fileUrl);
    else if (r.ok) toast('📎 ' + f.name);
    uploadIncomingSeq(files, idx+1, urls, callback);
  }).catch(function() { uploadIncomingSeq(files, idx+1, urls, callback); });
}


function uploadPendingFiles(row, keys, idx, callback) {
  if (idx >= keys.length) { callback(); return; }
  var targetId = keys[idx];
  var f = window._pendingFiles[targetId];
  if (!f) { uploadPendingFiles(row, keys, idx+1, callback); return; }
  apiP({action:'uploadFile', fileName:f.name, fileType:f.type, fileData:f.data}).then(function(r) {
    if (r.ok) toast('📎 ' + f.name + ' завантажено');
    uploadPendingFiles(row, keys, idx+1, callback);
  }).catch(function() { uploadPendingFiles(row, keys, idx+1, callback); });
}


function generateControlDates(recurring, deadline, periodEnd) {
  var start = pD(deadline), end = pD(periodEnd);
  if (!start || !end) return [];
  var dates = [], cur = new Date(start), limit = 100;

  if (recurring.indexOf('Щоденно') === 0 || recurring.indexOf('Щотижня') === 0) {
    var daysMatch = recurring.match(/\(([^)]+)\)/);
    var allowedDays = null;
    if (daysMatch) {
      allowedDays = {};
      daysMatch[1].split(',').forEach(function(d) {
        d = d.trim();
        var idx = (typeof REC_DAYS_UA !== 'undefined' ? REC_DAYS_UA : ['Пн','Вт','Ср','Чт','Пт','Сб','Нд']).indexOf(d);
        if (idx >= 0) allowedDays[(idx + 1) % 7] = true; // JS: 0=Sun, convert
      });
    }
    while (cur <= end && dates.length < limit) {
      var jsDay = cur.getDay();
      if (!allowedDays || allowedDays[jsDay]) {
        dates.push(p2(cur.getDate())+'.'+p2(cur.getMonth()+1)+'.'+cur.getFullYear());
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (recurring.indexOf('Щомісяця') === 0) {
    var monMatch = recurring.match(/\(([^)]+)\)/);
    var dayMatch = recurring.match(/(\d+)-го/);
    var day = dayMatch ? parseInt(dayMatch[1]) : 5;
    var allowedMons = null;
    if (monMatch) { allowedMons = {}; monMatch[1].split(',').forEach(function(m){ allowedMons[parseInt(m)] = true; }); }
    cur = new Date(start.getFullYear(), start.getMonth(), day);
    if (cur < start) cur.setMonth(cur.getMonth() + 1);
    while (cur <= end && dates.length < limit) {
      var m = cur.getMonth() + 1;
      if (!allowedMons || allowedMons[m]) {
        dates.push(p2(cur.getDate())+'.'+p2(cur.getMonth()+1)+'.'+cur.getFullYear());
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (recurring.indexOf('Щокварталу') === 0) {
    var isFirst = recurring.indexOf('перш') >= 0;
    var dayMatch = recurring.match(/(\d+)-го/);
    var day = dayMatch ? parseInt(dayMatch[1]) : 5;
    var qMonths = isFirst ? [0,3,6,9] : [2,5,8,11];
    cur = new Date(start.getFullYear(), 0, day);
    while (cur <= end && dates.length < limit) {
      if (qMonths.indexOf(cur.getMonth()) >= 0 && cur >= start) {
        dates.push(p2(cur.getDate())+'.'+p2(cur.getMonth()+1)+'.'+cur.getFullYear());
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (recurring.indexOf('Щороку') === 0) {
    var monMatch = recurring.match(/\((\d+)\)/);
    var dayMatch = recurring.match(/(\d+)-го/);
    var mon = monMatch ? parseInt(monMatch[1]) - 1 : start.getMonth();
    var day = dayMatch ? parseInt(dayMatch[1]) : start.getDate();
    cur = new Date(start.getFullYear(), mon, day);
    if (cur < start) cur.setFullYear(cur.getFullYear() + 1);
    while (cur <= end && dates.length < limit) {
      dates.push(p2(cur.getDate())+'.'+p2(cur.getMonth()+1)+'.'+cur.getFullYear());
      cur.setFullYear(cur.getFullYear() + 1);
    }
  }
  return dates;
}


function onDoneFileSelect(input) {
  var status = el('dm-file-status');
  if (input.files && input.files[0]) {
    var f = input.files[0];
    var sizeMB = (f.size / 1048576).toFixed(1);
    status.innerHTML = '📄 ' + esc(f.name) + ' (' + sizeMB + ' МБ)';
    if (f.size > 10485760) {
      status.innerHTML += ' <span style="color:var(--red)">⚠️ Максимум 10 МБ</span>';
    }
  } else {
    status.innerHTML = '';
  }
}

function showDocDet(row){openDet(row)}

