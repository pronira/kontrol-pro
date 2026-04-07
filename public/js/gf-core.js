/* ═══════════════════════════════════════════════════════════
   gf-core.js v2 — Ядро з автооновленням, календарем, сповіщеннями
   ═══════════════════════════════════════════════════════════ */

var GF = {
  tab:'overview', data:null, loading:false,
  detectedView:'new', detectedSearch:'', viewMode:'list',
  sourceView:'active', sourceSearch:'',
  priorityKw:'', autoTimer:null, lastCount:0
};

var GF_MENU = [
  {id:'overview',   ico:'📊', label:'Огляд',              sub:'Загальна картина'},
  {id:'detected',   ico:'🔍', label:'Виявлено',            sub:'Нове від сканера'},
  {id:'calendar',   ico:'📅', label:'Календар',             sub:'Дедлайни на часовій шкалі'},
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

function gfE(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s];})}
function gfId(id){return document.getElementById(id);}

/* ── Enter / Exit ── */
function enterGrantFlow(){
  var els=['topbar','tb-show','sidebar','main-area','doc-ov','toast','rp-bg','rp'];
  els.forEach(function(id){var e=document.getElementById(id);if(e)e.style.display='none';});
  var fab=document.querySelector('button[onclick="openNewDoc()"]');
  if(fab)fab.style.display='none';
  var gf=gfId('grantflowRoot');
  if(gf){gf.classList.remove('hidden');gf.style.display='';}
  // Роль grantflow — ховаємо кнопку "Повернутись до Контролів"
  if(typeof CUR_USER!=='undefined'&&CUR_USER&&CUR_USER.role==='grantflow'){
    var backBtn=document.querySelector('.gf-back');
    if(backBtn)backBtn.style.display='none';
  }
  gfBuildNav(); gfBuildBNav(); gfRefresh();
  gfStartAutoRefresh();
}
function exitGrantFlow(){
  // Роль grantflow — не виходимо з GrantFlow (Контролі недоступні)
  if(typeof CUR_USER!=='undefined'&&CUR_USER&&CUR_USER.role==='grantflow') return;
  gfStopAutoRefresh();
  var gf=gfId('grantflowRoot');
  if(gf){gf.classList.add('hidden');gf.style.display='none';}
  var topbar=document.getElementById('topbar');if(topbar)topbar.style.display='';
  var sidebar=document.getElementById('sidebar');if(sidebar)sidebar.style.display='';
  var mainArea=document.getElementById('main-area');if(mainArea)mainArea.style.display='';
  var fab=document.querySelector('button[onclick="openNewDoc()"]');
  if(fab)fab.style.display='';
}

/* ── Auto-refresh кожні 30 сек ── */
function gfStartAutoRefresh(){
  gfStopAutoRefresh();
  GF.autoTimer=setInterval(async function(){
    try{
      var oldCount=GF.data?(GF.data.detected||[]).length:0;
      GF.data=await gfLoadAll();
      var newCount=(GF.data.detected||[]).length;
      gfBuildNav();
      // Тихе оновлення — не перемальовує якщо юзер редагує
      if(!gfId('gfEditorModal')||gfId('gfEditorModal').classList.contains('hidden')){
        if(!gfId('gfStatusModal')||gfId('gfStatusModal').classList.contains('hidden')){
          gfRender();
        }
      }
      // Сповіщення про нові записи
      if(newCount>oldCount&&oldCount>0){
        var diff=newCount-oldCount;
        gfToast('🔍 Знайдено '+diff+' нових записів!','#059669');
      }
    }catch(e){}
  },30000);
}
function gfStopAutoRefresh(){
  if(GF.autoTimer){clearInterval(GF.autoTimer);GF.autoTimer=null;}
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
      else if(i.id==='calendar') cnt=gfCountUpcomingDeadlines();
      if(cnt) badge='<span class="gf-nav-badge">'+cnt+'</span>';
    }
    h+='<button class="gf-nav-btn'+c+'" data-t="'+i.id+'"><span class="gf-nav-ico">'+i.ico+'</span><span>'+gfE(i.label)+'</span>'+badge+'</button>';
  });
  m.innerHTML=h;
  m.onclick=function(e){var b=e.target.closest('.gf-nav-btn');if(b&&b.dataset.t)gfGo(b.dataset.t);};
}
function gfCountUpcomingDeadlines(){
  if(!GF.data||!GF.data.detected)return 0;
  var now=new Date().toISOString().slice(0,10);
  var week=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  return GF.data.detected.filter(function(d){return d.deadline&&d.deadline>=now&&d.deadline<=week;}).length;
}

/* ── Mobile bottom nav ── */
function gfBuildBNav(){
  var n=gfId('gfBNav'); if(!n)return;
  var items=GF_MENU.filter(function(m){return['overview','detected','calendar','sources','setup'].indexOf(m.id)>=0;});
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
      case 'calendar':  h=gfViewCalendar(); break;
      case 'notifs':    h=gfViewNotifs(); break;
      case 'approvals': h=gfViewApprovals(); break;
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

/* ── Busy / Helpers ── */
function gfBusy(title,text){
  var el=gfId('gfBusy');
  if(el){el.querySelector('h3').textContent=title||'Обробка…';el.querySelector('.gf-muted').textContent=text||'';el.classList.remove('hidden');}
}
function gfUnbusy(){var el=gfId('gfBusy');if(el)el.classList.add('hidden');}

function gfDaysLeft(deadline){
  if(!deadline)return null;
  var dl=new Date(deadline),now=new Date();
  dl.setHours(0,0,0,0);now.setHours(0,0,0,0);
  return Math.ceil((dl-now)/864e5);
}
function gfDeadlineBadge(deadline){
  var days=gfDaysLeft(deadline);
  if(days===null)return'<span class="gf-badge gray">—</span>';
  if(days<0)return'<span class="gf-badge red">Минув '+(-days)+' дн</span>';
  if(days===0)return'<span class="gf-badge red">Сьогодні!</span>';
  if(days<=3)return'<span class="gf-badge red">'+days+' дн!</span>';
  if(days<=7)return'<span class="gf-badge yellow">'+days+' дн</span>';
  if(days<=30)return'<span class="gf-badge blue">'+days+' дн</span>';
  return'<span class="gf-badge gray">'+days+' дн</span>';
}
