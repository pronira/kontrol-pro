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
  var isAdmin=typeof CUR_USER!=='undefined'&&CUR_USER&&CUR_USER.role==='admin';
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Користувачі</h3>'
    +(isAdmin?'<button class="gf-btn sm" onclick="gfOpenAddUser()">+ Додати</button>':'')
    +'</div>';
  if(!GF._users||!GF._users.length){
    h+='<div class="gf-empty">Завантаження...</div></div>';
    gfLoadUsers();
    return h;
  }
  var ROLE_LABELS={admin:'Адміністратор',grantflow:'GrantFlow (тільки)',user:'Користувач',viewer:'Переглядач'};
  h+='<div class="gf-tw"><table class="gf-t"><thead><tr><th>ПІБ</th><th>Логін/Email</th><th>Роль</th><th>Статус</th>'+(isAdmin?'<th></th>':'')+'</tr></thead><tbody>';
  (GF._users||[]).forEach(function(u){
    var roleLabel=ROLE_LABELS[u.role]||u.role||'—';
    var statusBadge=u.status==='active'
      ?'<span class="gf-badge green">Активний</span>'
      :'<span class="gf-badge gray">Заблокований</span>';
    var uid=gfE(u._id||u.row||'');
    h+='<tr>'
      +'<td>'+gfE(u.name||'—')+'</td>'
      +'<td>'+gfE(u.login||u.email||'—')+'</td>'
      +'<td>'+gfE(roleLabel)+'</td>'
      +'<td>'+statusBadge+'</td>'
      +(isAdmin?'<td><button class="gf-btn sm o" onclick="gfOpenEditUser(\''+uid+'\')">✏️</button></td>':'')
      +'</tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}

async function gfLoadUsers(){
  try{
    var snap=await db.collection('users').orderBy('name').get();
    GF._users=[];
    snap.forEach(function(d){GF._users.push(Object.assign({_id:d.id},d.data()));});
    if(GF.tab==='users') gfRender();
  }catch(e){console.warn('gfLoadUsers',e);}
}

function gfOpenAddUser(){
  var m=gfId('gfUserModal'); if(!m) return;
  gfId('gfum-id').value='';
  gfId('gfum-login').value=''; gfId('gfum-login').disabled=false;
  gfId('gfum-pass').value=''; gfId('gfum-pass').placeholder='Пароль';
  gfId('gfum-name').value='';
  gfId('gfum-role').value='viewer';
  gfId('gfum-status').value='active';
  gfId('gfUserModalTitle').textContent='Новий користувач';
  m.classList.remove('hidden');
}

function gfOpenEditUser(id){
  var u=(GF._users||[]).find(function(x){return (x._id||x.row)===id;});
  if(!u) return;
  var m=gfId('gfUserModal'); if(!m) return;
  gfId('gfum-id').value=id;
  gfId('gfum-login').value=u.login||u.email||''; gfId('gfum-login').disabled=true;
  gfId('gfum-pass').value=''; gfId('gfum-pass').placeholder='(порожньо = не змінювати)';
  gfId('gfum-name').value=u.name||'';
  gfId('gfum-role').value=u.role||'viewer';
  gfId('gfum-status').value=u.status||'active';
  gfId('gfUserModalTitle').textContent='Редагування: '+gfE(u.name||'');
  m.classList.remove('hidden');
}

function gfCloseUserModal(){
  var m=gfId('gfUserModal'); if(m) m.classList.add('hidden');
}

async function gfSaveUserModal(){
  var id=gfId('gfum-id').value.trim();
  var login=gfId('gfum-login').value.trim();
  var pass=gfId('gfum-pass').value;
  var name=gfId('gfum-name').value.trim();
  var role=gfId('gfum-role').value;
  var status=gfId('gfum-status').value;
  if(!id&&!login){ gfToast('Вкажіть логін/email','var(--red)'); return; }
  if(!id&&!pass){ gfToast('Вкажіть пароль','var(--red)'); return; }
  if(!name){ gfToast('Вкажіть ПІБ','var(--red)'); return; }
  try{
    var data={name:name,role:role,status:status,updatedAt:new Date().toISOString()};
    if(pass) data.password=pass;
    if(id){
      await db.collection('users').doc(id).update(data);
    } else {
      data.login=login;
      data.createdAt=new Date().toISOString();
      await db.collection('users').add(data);
    }
    gfCloseUserModal();
    gfToast('✅ Збережено','var(--green)');
    await gfLoadUsers();
    gfRender();
  }catch(e){ gfToast('❌ '+e.message,'var(--red)'); }
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
  var kw=GF.priorityKw||'';
  return '<div class="gf-panel" style="margin-bottom:14px"><div class="gf-panel-h"><h3>Пріоритетні слова</h3></div>'
    +'<p class="gf-muted" style="margin-bottom:10px;font-size:12px">Записи з цими словами будуть зверху списку «Виявлено» та підсвічені. Через кому.</p>'
    +'<div class="gf-field"><textarea id="gfSetupKw" style="min-height:70px">'+gfE(kw)+'</textarea></div>'
    +'<button class="gf-btn" onclick="gfSavePrioKw()">Зберегти</button></div>'

    +'<div class="gf-panel" style="margin-bottom:14px"><div class="gf-panel-h"><h3>Firestore</h3></div>'
    +'<p class="gf-muted" style="font-size:12px">Дані зберігаються у Firebase проєкті <b>kontrol-pro</b>.</p>'
    +'<p class="gf-muted" style="font-size:12px;margin-top:6px">Колекції: '
    +Object.values(GFC).map(function(c){return '<code style="background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px;font-size:11px">'+gfE(c)+'</code>';}).join(' ')
    +'</p></div>'

    +'<div class="gf-panel"><div class="gf-panel-h"><h3>Cloud Functions</h3></div>'
    +'<p class="gf-muted" style="font-size:12px">ScanEngine буде працювати через Firebase Cloud Functions (планується).</p>'
    +'<div class="gf-notice" style="margin-top:10px">Автосканування ще не налаштовано. Поки що додавайте записи вручну.</div></div>';
}

async function gfSavePrioKw(){
  var kw=(gfId('gfSetupKw')||{}).value||'';
  try{
    await gfSetSetting('priority_keywords',kw.trim());
    GF.priorityKw=kw.trim();
    gfToast('Пріоритетні слова збережено','var(--green)');
  }catch(e){alert('Помилка: '+e.message);}
}
