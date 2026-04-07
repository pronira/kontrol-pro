/* ═══════════════════════════════════════════════════════════
   gf-pages.js — Решта екранів GrantFlow
   ═══════════════════════════════════════════════════════════ */

/* ── Сповіщення ── */
function gfViewNotifs(){
  var list=GF.data.notifs||[];
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Сповіщення</h3><span class="gf-badge blue">'+list.length+'</span></div>';
  if(!list.length) return h+'<div class="gf-empty">Немає сповіщень.</div></div>';
  h+='<div class="gf-list">';
  list.sort(function(a,b){return(b.created_at||'').localeCompare(a.created_at||'');}).slice(0,50).forEach(function(n){
    var isRead=n.is_read;
    h+='<div class="gf-item" style="'+(isRead?'opacity:.6':'border-left:3px solid var(--accent)')+'"><div class="gf-item-head">'
      +'<h3 style="font-size:13px">'+gfE(n.title||'Сповіщення')+'</h3>'
      +'<span class="gf-muted" style="font-size:10px">'+gfE((n.created_at||'').slice(0,16))+'</span></div>'
      +'<div class="gf-muted" style="font-size:12px">'+gfE(n.message||'')+'</div></div>';
  });
  return h+'</div></div>';
}

/* ── Погодження ── */
function gfViewApprovals(){
  var list=GF.data.approvals||[];
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>На погодженні</h3><span class="gf-badge blue">'+list.length+'</span></div>';
  if(!list.length) return h+'<div class="gf-empty">Немає записів на погодженні.</div></div>';
  h+='<div class="gf-list">';
  list.slice(0,50).forEach(function(a){
    var stCls=a.approval_status==='погоджено'?'green':a.approval_status==='не погоджено'?'red':'yellow';
    h+='<div class="gf-item"><div class="gf-item-head">'
      +'<h3 style="font-size:13px">'+gfE(a.opp_id||'Без назви')+'</h3>'
      +'<span class="gf-badge '+stCls+'">'+gfE(a.approval_status||'—')+'</span></div>'
      +'<div class="gf-item-meta">'
      +(a.sent_to_approval_at?'<span>Надіслано: '+gfE(a.sent_to_approval_at)+'</span>':'')
      +(a.priority_level?'<span>'+gfE(a.priority_level)+'</span>':'')
      +'</div>'
      +(a.approval_comment?'<div class="gf-muted" style="font-size:12px">'+gfE(a.approval_comment)+'</div>':'')
      +'</div>';
  });
  return h+'</div></div>';
}

/* ── Можливості ── */
function gfViewOpps(){
  var list=GF.data.opps||[];
  if(!list.length) return '<div class="gf-panel"><div class="gf-panel-h"><h3>База можливостей</h3></div><div class="gf-empty">Немає можливостей. Переведіть записи зі вкладки «Виявлено».</div></div>';
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>База можливостей</h3><span class="gf-badge blue">'+list.length+'</span></div><div class="gf-list">';
  list.slice(0,100).forEach(function(o){
    var url=o.detail_url||o.source_url||'';
    h+='<div class="gf-item"><div class="gf-item-head"><h3>'+gfE(o.title||'Без назви')+'</h3>'
      +'<div style="display:flex;gap:4px">'+gfStatusBadge(o.status)+'</div></div>'
      +'<div class="gf-item-meta">'
      +(o.donor?'<span>'+gfE(o.donor)+'</span>':'')
      +(o.deadline?'<span>Дедлайн: '+gfE(o.deadline)+'</span>':'')
      +(o.amount_text?'<span>'+gfE(o.amount_text)+'</span>':'')
      +(o.topics?'<span>'+gfE(o.topics)+'</span>':'')
      +'</div>'
      +(o.short_desc?'<div class="gf-muted" style="font-size:12px;margin-top:4px">'+gfE((o.short_desc||'').slice(0,200))+'</div>':'')
      +(url?'<div class="gf-item-acts"><button class="gf-btn sm o" onclick="window.open(\''+gfE(url)+'\',\'_blank\')">Відкрити</button></div>':'')
      +'</div>';
  });
  return h+'</div></div>';
}

/* ── Мої завдання ── */
function gfViewTasks(){
  var asg=GF.data.assigns||[];
  var tsk=GF.data.tasks||[];
  if(!asg.length&&!tsk.length) return '<div class="gf-panel"><div class="gf-empty">Немає призначень або задач.</div></div>';

  var ah='<div class="gf-panel"><div class="gf-panel-h"><h3>Призначення</h3><span class="gf-badge blue">'+asg.length+'</span></div>';
  if(asg.length){
    ah+='<div class="gf-list">';
    asg.slice(0,50).forEach(function(a){
      ah+='<div class="gf-item"><div class="gf-item-head"><h3>'+gfE(a.opp_id||'Без назви')+'</h3>'
        +'<div style="display:flex;gap:4px">'+gfStatusBadge(a.status)+'</div></div>'
        +'<div class="gf-item-meta">'
        +(a.assigned_at?'<span>'+gfE(a.assigned_at)+'</span>':'')
        +(a.internal_deadline?'<span>Дедлайн: '+gfE(a.internal_deadline)+'</span>':'')
        +'</div>'
        +(a.notes?'<div class="gf-muted" style="font-size:12px">'+gfE(a.notes)+'</div>':'')
        +'</div>';
    });
    ah+='</div>';
  } else ah+='<div class="gf-empty">Немає.</div>';
  ah+='</div>';

  var th='<div class="gf-panel"><div class="gf-panel-h"><h3>Задачі</h3><span class="gf-badge blue">'+tsk.length+'</span></div>';
  if(tsk.length){
    th+='<div class="gf-list">';
    tsk.slice(0,50).forEach(function(t){
      th+='<div class="gf-item"><div class="gf-item-head"><h3>'+gfE(t.title||'Задача')+'</h3>'
        +gfStatusBadge(t.status)+'</div>'
        +(t.deadline?'<div class="gf-item-meta"><span>Дедлайн: '+gfE(t.deadline)+'</span></div>':'')
        +(t.description?'<div class="gf-muted" style="font-size:12px">'+gfE(t.description)+'</div>':'')
        +'</div>';
    });
    th+='</div>';
  } else th+='<div class="gf-empty">Немає.</div>';
  th+='</div>';

  return '<div class="gf-g2">'+ah+th+'</div>';
}

/* ── Контакти ── */
function gfViewContacts(){
  var list=GF.data.contacts||[];
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Контакти</h3><span class="gf-badge blue">'+list.length+'</span></div>';
  if(!list.length) return h+'<div class="gf-empty">Немає контактів.</div></div>';
  h+='<div class="gf-tw"><table class="gf-t"><thead><tr><th>ПІБ</th><th>Організація</th><th>Посада</th><th>Сфера</th><th>Email</th><th>Телефон</th></tr></thead><tbody>';
  list.forEach(function(c){
    h+='<tr><td>'+gfE(c.full_name||'—')+'</td><td>'+gfE(c.organization||'—')+'</td><td>'+gfE(c.position||'—')+'</td><td>'+gfE(c.sector||'—')+'</td><td>'+gfE(c.email||'—')+'</td><td>'+gfE(c.phone||'—')+'</td></tr>';
  });
  return h+'</tbody></table></div></div>';
}

/* ── Користувачі ── */
function gfViewUsers(){
  /* Users from Kontroli's global fbGetUsers if available, otherwise placeholder */
  return '<div class="gf-panel"><div class="gf-panel-h"><h3>Користувачі</h3></div>'
    +'<div class="gf-empty">Управління користувачами — через Контролі (розділ Налаштування).</div></div>';
}

/* ── Лог дій ── */
function gfViewLog(){
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Лог дій</h3>'
    +'<button class="gf-btn sm" onclick="gfLoadLog()">Завантажити</button></div>'
    +'<div id="gfLogContent" class="gf-empty">Натисніть «Завантажити» щоб побачити історію.</div></div>';
  return h;
}

async function gfLoadLog(){
  var el=gfId('gfLogContent'); if(!el)return;
  el.innerHTML='<div class="gf-muted">Завантаження…</div>';
  try{
    var items=await gfAll(GFC.history,'action_at','desc',200);
    if(!items.length){el.innerHTML='<div class="gf-empty">Порожній лог.</div>';return;}
    var h='<div class="gf-tw"><table class="gf-t"><thead><tr><th>Дата</th><th>Тип</th><th>Дія</th><th>Хто</th><th>Примітка</th></tr></thead><tbody>';
    items.forEach(function(i){
      h+='<tr><td>'+gfE((i.action_at||'').slice(0,16))+'</td><td>'+gfE(i.entity_type||'')+'</td><td>'+gfE(i.action_type||'')+'</td><td>'+gfE(i.action_by||'')+'</td><td>'+gfE((i.notes||'').slice(0,80))+'</td></tr>';
    });
    el.innerHTML=h+'</tbody></table></div>';
  }catch(e){el.innerHTML='<div class="gf-notice">Помилка: '+gfE(e.message)+'</div>';}
}

/* ── Налаштування ── */
function gfViewSetup(){
  var kw = GF.priorityKw || '';
  var active = (GF.data.sources||[]).filter(function(s){ return s.source_status==='active'; });

  // Рядки таблиці автосканування
  var scanRows = '';
  active.forEach(function(s) {
    var sid = s._id || s.source_id || '';
    var ico = /telegram/i.test(s.source_type||'') ? '📱' : /rss/i.test(s.source_type||'') ? '📡' : '🌐';
    var stBg = s.last_error ? 'rgba(239,68,68,.12)' : '';

    function sel(cls, opts, cur) {
      return '<select class="'+cls+'" data-sid="'+gfE(sid)+'" style="background:#1e293b;color:#e2e8f0;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 6px;font-size:11px">'
        + opts.map(function(o){ return '<option value="'+o[0]+'"'+(String(cur)===String(o[0])?' selected':'')+'>'+o[1]+'</option>'; }).join('')
        + '</select>';
    }

    scanRows += '<tr style="background:'+stBg+'">'
      + '<td style="padding:6px 10px;font-size:12px">'+ico+' '+gfE(s.source_name||'?')
      +   (s.last_error ? ' <span title="'+gfE(s.last_error)+'" style="color:#ef4444;cursor:help">⚠️</span>' : '')
      + '</td>'
      + '<td style="padding:6px;text-align:center">'+sel('gf-sc-int',[['1','1хв'],['5','5хв'],['15','15хв'],['30','30хв'],['60','1год'],['360','6год'],['1440','1день']], s.scan_interval_min||'1')+'</td>'
      + '<td style="padding:6px;text-align:center"><input type="number" class="gf-sc-max" data-sid="'+gfE(sid)+'" value="'+gfE(s.item_limit||'3')+'" min="1" max="50" style="background:#1e293b;color:#e2e8f0;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 6px;font-size:11px;width:50px;text-align:center"></td>'
      + '<td style="padding:6px;text-align:center">'+sel('gf-sc-win',[['3','3дн'],['7','7дн'],['14','14дн'],['30','30дн'],['60','60дн']], s.scan_window_days||'7')+'</td>'
      + '<td style="padding:6px;text-align:center;font-size:11px;color:#64748b">'+(s.last_checked_at?(s.last_checked_at||'').slice(11,16):'—')+'</td>'
      + '<td style="padding:6px;text-align:center">'+(s.found_count||0)+'</td>'
      + '</tr>';
  });

  var scanPanel = '<div class="gf-panel" style="margin-bottom:14px">'
    + '<div class="gf-panel-h"><h3>⚙️ Автосканування</h3>'
    + '<button class="gf-btn sm" onclick="gfSaveScanSettings()">💾 Зберегти все</button></div>'
    + '<p class="gf-muted" style="font-size:12px;margin-bottom:10px">Налаштування по всіх активних джерелах. ⚠️ — є помилка сканування.</p>'
    + (active.length
        ? '<div class="gf-tw"><table class="gf-t"><thead><tr>'
          + '<th>Джерело</th><th style="text-align:center">Інтервал</th>'
          + '<th style="text-align:center">Макс нових</th><th style="text-align:center">Вікно</th>'
          + '<th style="text-align:center">Останнє</th><th style="text-align:center">Знайдено</th>'
          + '</tr></thead><tbody>'+scanRows+'</tbody></table></div>'
        : '<div class="gf-empty">Немає активних джерел.</div>')
    + '</div>';

  return scanPanel
    + '<div class="gf-panel" style="margin-bottom:14px"><div class="gf-panel-h"><h3>🎯 Пріоритетні слова</h3></div>'
    + '<p class="gf-muted" style="margin-bottom:10px;font-size:12px">Записи з цими словами підсвічуються та виводяться вгору у «Виявлено». Через кому.</p>'
    + '<div class="gf-field"><textarea id="gfSetupKw" style="min-height:60px">'+gfE(kw)+'</textarea></div>'
    + '<button class="gf-btn" onclick="gfSavePrioKw()">Зберегти</button></div>'

    + '<div class="gf-panel" style="margin-bottom:14px"><div class="gf-panel-h"><h3>🗄️ Firestore</h3></div>'
    + '<p class="gf-muted" style="font-size:12px">Проєкт: <b>kontrol-pro</b></p>'
    + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">'
    + Object.values(GFC).map(function(c){ return '<code style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:4px;font-size:10px">'+gfE(c)+'</code>'; }).join('')
    + '</div></div>'

    + '<div class="gf-panel"><div class="gf-panel-h"><h3>⚡ Cloud Functions</h3></div>'
    + '<p class="gf-muted" style="font-size:12px">ScanEngine активний — сканує 1 джерело на хвилину відповідно до налаштованого інтервалу.</p>'
    + '<div class="gf-ok" style="margin-top:8px">✅ Автосканування працює.</div></div>';
}

async function gfSaveScanSettings() {
  var rows = document.querySelectorAll('.gf-sc-int');
  var saved = 0;
  try {
    for (var i = 0; i < rows.length; i++) {
      var sid = rows[i].dataset.sid; if (!sid) continue;
      var maxEl = document.querySelector('.gf-sc-max[data-sid="'+sid+'"]');
      var winEl = document.querySelector('.gf-sc-win[data-sid="'+sid+'"]');
      var upd = {
        scan_interval_min: rows[i].value,
        item_limit:        maxEl ? maxEl.value : '3',
        scan_window_days:  winEl ? winEl.value : '7'
      };
      await gfUpd(GFC.sources, sid, upd);
      var src = (GF.data.sources||[]).find(function(s){ return (s._id||s.source_id)===sid; });
      if (src) Object.assign(src, upd);
      saved++;
    }
    gfToast('Збережено для '+saved+' джерел', 'var(--green)');
  } catch(e) { gfToast('Помилка: '+e.message, 'var(--red)'); }
}

async function gfSavePrioKw(){
  var kw=(gfId('gfSetupKw')||{}).value||'';
  try{
    await gfSetSetting('priority_keywords',kw.trim());
    GF.priorityKw=kw.trim();
    gfToast('Пріоритетні слова збережено','var(--green)');
  }catch(e){alert('Помилка: '+e.message);}
}
