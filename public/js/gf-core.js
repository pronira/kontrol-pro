/* ═══════════════════════════════════════════════════════════
   gf-core.js — Ядро GrantFlow: стан, навігація, рендер
   ═══════════════════════════════════════════════════════════ */

var GF = {
  tab:'overview', data:null, loading:false,
  detectedView:'new', detectedSearch:'', viewMode:'list',
  sourceView:'active', sourceSearch:'',
  priorityKw:''
};

var GF_MENU = [
  {id:'overview',   ico:'📊', label:'Огляд',              sub:'Загальна картина'},
  {id:'detected',   ico:'🔍', label:'Виявлено',            sub:'Нове від сканера'},
  {id:'opps',       ico:'💎', label:'База можливостей',    sub:'Перевірені записи'},
  {id:'mytasks',    ico:'📋', label:'Мої завдання',         sub:'Призначення'},
  {id:'approvals',  ico:'✅', label:'На погодженні',        sub:'Рішення'},
  {id:'notifs',     ico:'🔔', label:'Сповіщення',           sub:'Важливі події'},
  {id:'sources',    ico:'🌐', label:'Джерела',              sub:'Сайти, RSS, TG',admin:true},
  {id:'users',      ico:'👥', label:'Користувачі',          sub:'Люди й ролі',admin:true},
  {id:'contacts',   ico:'📇', label:'Контакти',             sub:'Довідник'},
  {id:'log',        ico:'📜', label:'Лог дій',              sub:'Історія змін',admin:true},
  {id:'setup',      ico:'⚙️', label:'Налаштування',         sub:'Параметри',admin:true}
];

/* ── Helpers ── */
function gfE(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s];})}
function gfId(id){return document.getElementById(id);}

/* ── Enter / Exit ── */
function enterGrantFlow(){
  /* Ховаємо Контролі */
  var els=['topbar','tb-show','sidebar','main-area','doc-ov','toast','rp-bg','rp'];
  els.forEach(function(id){var e=document.getElementById(id);if(e)e.style.display='none';});
  /* Ховаємо кнопку + */
  var fab=document.querySelector('button[onclick="openNewDoc()"]');
  if(fab)fab.style.display='none';
  /* Показуємо GrantFlow */
  var gf=gfId('grantflowRoot');
  if(gf){gf.classList.remove('hidden');gf.style.display='';}
  gfBuildNav(); gfBuildBNav(); gfRefresh();
}
function exitGrantFlow(){
  var gf=gfId('grantflowRoot');
  if(gf){gf.classList.add('hidden');gf.style.display='none';}
  /* Повертаємо Контролі */
  var topbar=document.getElementById('topbar');if(topbar)topbar.style.display='';
  var sidebar=document.getElementById('sidebar');if(sidebar)sidebar.style.display='';
  var mainArea=document.getElementById('main-area');if(mainArea)mainArea.style.display='';
  var fab=document.querySelector('button[onclick="openNewDoc()"]');
  if(fab)fab.style.display='';
}

/* ── Sidebar nav ── */
function gfBuildNav(){
  var m=gfId('gfNav'); if(!m)return;
  var adm=typeof CUR_USER!=='undefined'&&CUR_USER&&CUR_USER.role==='admin';
  var h='';
  GF_MENU.forEach(function(i){
    if(i.admin&&!adm)return;
    var c=i.id===GF.tab?' active':'';
    var badge='';
    if(GF.data){
      var cnt=0;
      if(i.id==='detected') cnt=(GF.data.detected||[]).filter(function(d){return !d.status||d.status==='Виявлено';}).length;
      else if(i.id==='sources') cnt=(GF.data.sources||[]).length;
      else if(i.id==='opps') cnt=(GF.data.opps||[]).length;
      else if(i.id==='approvals') cnt=(GF.data.overview||{}).pendingApprovals||0;
      if(cnt) badge='<span class="gf-nav-badge">'+cnt+'</span>';
    }
    h+='<button class="gf-nav-btn'+c+'" data-t="'+i.id+'"><span class="gf-nav-ico">'+i.ico+'</span><span>'+gfE(i.label)+'</span>'+badge+'</button>';
  });
  m.innerHTML=h;
  m.onclick=function(e){var b=e.target.closest('.gf-nav-btn');if(b&&b.dataset.t)gfGo(b.dataset.t);};
}

/* ── Mobile bottom nav ── */
function gfBuildBNav(){
  var n=gfId('gfBNav'); if(!n)return;
  var items=GF_MENU.filter(function(m){return['overview','detected','sources','opps','setup'].indexOf(m.id)>=0;});
  var h='<div class="gf-bnav-inner">';
  items.forEach(function(i){
    var c=i.id===GF.tab?' active':'';
    h+='<button class="gf-bnav-btn'+c+'" data-t="'+i.id+'"><span class="gf-bnav-ico">'+i.ico+'</span>'+gfE(i.label)+'</button>';
  });
  h+='</div>';
  n.innerHTML=h;
  n.onclick=function(e){var b=e.target.closest('.gf-bnav-btn');if(b&&b.dataset.t)gfGo(b.dataset.t);};
}

/* ── Tab switch ── */
function gfGo(tab){
  GF.tab=tab;
  gfBuildNav(); gfBuildBNav();
  var item=GF_MENU.find(function(m){return m.id===tab;})||GF_MENU[0];
  var t=gfId('gfTitle'),s=gfId('gfSub');
  if(t)t.textContent=item.label;
  if(s)s.textContent=item.sub;
  gfRender();
}

/* ── Data refresh ── */
async function gfRefresh(){
  GF.loading=true; gfRenderLoading();
  try{
    GF.data=await gfLoadAll();
    GF.priorityKw=(await gfGetSetting('priority_keywords'))||'';
  }catch(e){
    console.error('GF refresh:',e);
    var c=gfId('gfContent');
    if(c)c.innerHTML='<div class="gf-notice">Помилка: '+gfE(e.message)+'</div>';
  }
  GF.loading=false;
  gfBuildNav(); gfRender();
}

function gfRenderLoading(){
  var c=gfId('gfContent'); if(!c)return;
  c.innerHTML='<div class="gf-stats">'
    +'<div class="gf-stat" style="height:72px;background:rgba(255,255,255,.02)"></div>'.repeat(4)
    +'</div><div class="gf-g2"><div class="gf-panel" style="height:200px"></div><div class="gf-panel" style="height:200px"></div></div>';
}

/* ── Render router ── */
function gfRender(){
  var c=gfId('gfContent'); if(!c)return;
  if(!GF.data){gfRenderLoading();return;}
  var h='';
  try{
    switch(GF.tab){
      case 'overview':  h=gfViewOverview(); break;
      case 'detected':  h=gfViewDetected(); break;
      case 'notifs':     h=gfViewNotifs(); break;
      case 'approvals':  h=gfViewApprovals(); break;
      case 'sources':   h=gfViewSources(); break;
      case 'opps':      h=gfViewOpps(); break;
      case 'mytasks':   h=gfViewTasks(); break;
      case 'contacts':  h=gfViewContacts(); break;
      case 'users':     h=gfViewUsers(); break;
      case 'log':       h=gfViewLog(); break;
      case 'setup':     h=gfViewSetup(); break;
      default:          h=gfPlaceholder(GF.tab);
    }
  }catch(e){
    h='<div class="gf-notice">Помилка: '+gfE(e.message)+'</div>';
    console.error('gfRender',e);
  }
  c.innerHTML=h;
  // Post-render hooks
  if(GF.tab==='detected') setTimeout(gfWireDetected,0);
  if(GF.tab==='sources') setTimeout(gfWireSources,0);
}

function gfPlaceholder(tab){
  return '<div class="gf-panel" style="text-align:center;padding:40px">'
    +'<div style="font-size:36px;margin-bottom:10px;opacity:.5">🚧</div>'
    +'<h3 style="margin:0 0 6px">'+gfE(tab)+'</h3>'
    +'<p class="gf-muted">Цей розділ буде реалізовано далі.</p></div>';
}

/* ── Toast ── */
function gfToast(msg,bg){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:'+(bg||'#4f6ef7')+';color:#fff;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.4);font-family:Geologica,sans-serif';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.transition='opacity .4s';t.style.opacity='0';setTimeout(function(){t.remove();},400);},2500);
}

/* ── Busy overlay ── */
function gfBusy(title,text){
  var el=gfId('gfBusy');
  if(el){el.querySelector('h3').textContent=title||'Обробка…';el.querySelector('.gf-muted').textContent=text||'';el.classList.remove('hidden');}
}
function gfUnbusy(){var el=gfId('gfBusy');if(el)el.classList.add('hidden');}

/* ── Button already in sidebar HTML, no auto-inject needed ── */
