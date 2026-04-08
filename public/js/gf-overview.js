/* ═══════════════════════════════════════════════════════════
   gf-overview.js v2 — Огляд з лічильниками, дедлайнами, кольорами
   ═══════════════════════════════════════════════════════════ */

function gfViewOverview(){
  var o=GF.data.overview||{};
  var det=GF.data.detected||[];

  // Беремо з лічильника (точні цифри) або з завантажених даних
  var newToday = o.newToday !== undefined ? o.newToday : det.filter(function(d){return(d.found_at||'').slice(0,10)===new Date().toISOString().slice(0,10);}).length;
  var newActive = o.pendingReview !== undefined ? o.pendingReview : det.filter(function(d){return !d.status||d.status==='Виявлено';}).length;

  /* Metrics */
  // Лічильник знайдених вчора з daily_history
  var foundYesterday = 0;
  if (GF._dailyHistory && GF._dailyHistory.length > 0) {
    var yesterday = new Date(Date.now()-864e5).toISOString().slice(0,10);
    var yEntry = GF._dailyHistory.find(function(d){return d.date===yesterday;});
    if (yEntry) foundYesterday = yEntry.count || 0;
  }

  var m=[
    {l:'Нових сьогодні',v:newToday,c:newToday?'g':''},
    {l:'Знайдено вчора',v:foundYesterday,c:foundYesterday?'g':''},
    {l:'Очікують перегляду',v:newActive,c:'a'},
    {l:'Активних джерел',v:o.activeSources,c:'g'},
    {l:'У базі',v:o.oppCount,c:''},
    {l:'Відхилено',v:o.deletedTotal,c:'r'},
    {l:'На погодженні',v:o.pendingApprovals,c:''},
    {l:'Всього знайдено',v:o.detectedCount,c:''}
  ];
  // Карти статистики — тільки інформаційні, без кліку
  var mh='<div class="gf-stats">';
  m.forEach(function(x){
    mh+='<div class="gf-stat">'
      +'<div class="gf-stat-lbl">'+gfE(x.l)+'</div>'
      +'<div class="gf-stat-val'+(x.c?' '+x.c:'')+'">'+(x.v||0)+'</div></div>';
  });
  mh+='</div>';

  /* Upcoming deadlines */
  var dlH=gfUpcomingDeadlinesPanel(det);

  /* Period panels */
  var pp='<div class="gf-gs">'
    +gfPeriodPanel('Відхилення',[['Сьогодні',o.deletedToday],['7 днів',o.deleted7],['30 днів',o.deleted30]],'var(--red)')
    +gfPeriodPanel('Погодження',[['Сьогодні',o.approvedToday],['7 днів',o.approved7],['30 днів',o.approved30]],'var(--green)')
    +'</div>';

  var rh=gfReasonsPanel(o);
  var uh=gfUsersPanel(o);
  var recent=gfRecentPanel();
  var srcQ=gfSourcesQuickPanel();

  return mh+dlH+pp+'<div class="gf-g2">'+rh+uh+'</div><div class="gf-g2">'+recent+srcQ+'</div>';
}

/* ── Найближчі дедлайни ── */
function gfUpcomingDeadlinesPanel(det){
  var now=new Date().toISOString().slice(0,10);
  var upcoming=det.filter(function(d){return d.deadline&&d.deadline>=now&&(!d.status||d.status==='Виявлено'||d.status==='Корисне');})
    .sort(function(a,b){return(a.deadline||'').localeCompare(b.deadline||'');}).slice(0,5);
  if(!upcoming.length) return '';
  
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>🔥 Найближчі дедлайни</h3>'
    +'<button class="gf-btn sm o" onclick="gfGo(\'calendar\')">Календар →</button></div>'
    +'<div class="gf-list" style="gap:6px">';
  upcoming.forEach(function(d){
    var days=gfDaysLeft(d.deadline);
    var urgency=days<=3?'border-left:4px solid var(--red)':days<=7?'border-left:4px solid var(--yellow)':'border-left:4px solid var(--accent)';
    h+='<div class="gf-item" style="padding:10px 14px;'+urgency+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+gfE((d.raw_title||'').slice(0,60))+'</div>'
      +'<div class="gf-muted" style="font-size:11px">'+gfE(d.donor||d.source_name||'')+'</div></div>'
      +gfDeadlineBadge(d.deadline)
      +'</div></div>';
  });
  return h+'</div></div>';
}

function gfPeriodPanel(title,rows,color){
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>'+gfE(title)+'</h3></div><div class="gf-pills">';
  rows.forEach(function(r){h+='<div class="gf-pill"><span>'+gfE(r[0])+'</span><b style="color:'+color+'">'+(r[1]||0)+'</b></div>';});
  return h+'</div></div>';
}

function gfReasonsPanel(o){
  var reasons=o.deletedReasons||{};
  var keys=Object.keys(reasons).sort(function(a,b){return reasons[b]-reasons[a];});
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Причини відхилення</h3></div>';
  if(!keys.length) return h+'<div class="gf-empty">Немає відхилень.</div></div>';
  var mx=Math.max.apply(null,keys.map(function(k){return reasons[k];}));
  h+='<div class="gf-pills">';
  keys.forEach(function(k){
    var pct=mx>0?Math.round(reasons[k]/mx*100):0;
    h+='<div class="gf-pill"><span style="flex:1;position:relative">'
      +'<span style="position:absolute;left:0;top:0;bottom:0;width:'+pct+'%;background:var(--red-soft);border-radius:4px"></span>'
      +'<span style="position:relative;z-index:1">'+gfE(k)+'</span></span>'
      +'<b style="color:var(--red)">'+reasons[k]+'</b></div>';
  });
  return h+'</div></div>';
}

function gfUsersPanel(o){
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Хто працював</h3></div><div class="gf-g2">';
  h+='<div>'+gfTopList('Відхилено',o.topDeletedUsers||[],'var(--red)')+'</div>';
  h+='<div>'+gfTopList('Погоджено',o.topApprovedUsers||[],'var(--green)')+'</div>';
  return h+'</div></div>';
}

function gfTopList(title,users,color){
  var h='<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px">'+gfE(title)+'</div>';
  if(!users.length) return h+'<div class="gf-muted" style="font-size:12px">Немає.</div>';
  h+='<div class="gf-pills">';
  users.forEach(function(u,i){
    h+='<div class="gf-pill"><span>'+gfE(u.user)+'</span><b style="color:'+color+'">'+u.count+'</b></div>';
  });
  return h+'</div>';
}

/* Кнопка перерахування — викликається з UI */
function gfRebuildStatsBtn() {
  gfRebuildStats().then(function(s) {
    if (typeof gfRefresh === 'function') gfRefresh();
  }).catch(function(e){ toast('❌ ' + e.message); });
}

function gfRecentPanel(){
  var det=(GF.data.detected||[]).slice(0,6);
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Останні знахідки</h3>'
    +'<button class="gf-btn sm o" onclick="gfGo(\'detected\')">Усі →</button></div>';
  if(!det.length) return h+'<div class="gf-empty">Нічого не знайдено.</div></div>';
  h+='<div class="gf-list">';
  det.forEach(function(d){
    var st=d.status||'Виявлено';
    var cls='gray';
    if(/корисне/i.test(st))cls='green'; else if(/не підходить|видалено/i.test(st))cls='red';
    else if(st==='Виявлено')cls='blue';
    h+='<div class="gf-item" style="padding:10px 14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+gfE((d.raw_title||'').slice(0,60))+'</div>'
      +'<div class="gf-muted" style="font-size:11px">'+gfE(d.source_name||'')+' · '+gfE((d.found_at||'').slice(0,10))+'</div></div>'
      +'<div style="display:flex;gap:4px">'+gfDeadlineBadge(d.deadline)+'<span class="gf-badge '+cls+'">'+gfE(st)+'</span></div>'
      +'</div></div>';
  });
  return h+'</div></div>';
}

function gfSourcesQuickPanel(){
  var src=(GF.data.sources||[]).filter(function(s){return s.source_status==='active';});
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Активні джерела</h3>'
    +'<button class="gf-btn sm o" onclick="gfGo(\'sources\')">Керувати →</button></div>';
  if(!src.length) return h+'<div class="gf-empty">Немає.</div></div>';
  var byT={};
  src.forEach(function(s){
    var t=/telegram/i.test(s.source_type||'')?'📱 Telegram':/rss/i.test(s.source_type||'')?'📡 RSS':'🌐 Сайти';
    byT[t]=(byT[t]||0)+1;
  });
  h+='<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
  Object.keys(byT).forEach(function(t){
    h+='<div style="background:var(--accent-soft);border-radius:8px;padding:6px 12px;font-size:12px"><b>'+byT[t]+'</b> '+gfE(t)+'</div>';
  });
  h+='</div>';
  var top=src.slice().sort(function(a,b){return(parseInt(b.found_count)||0)-(parseInt(a.found_count)||0);}).slice(0,5);
  h+='<div class="gf-pills">';
  top.forEach(function(s){
    var ico=/telegram/i.test(s.source_type||'')?'📱 ':/rss/i.test(s.source_type||'')?'📡 ':'🌐 ';
    var lastCheck=s.last_checked_at&&s.last_checked_at!=='2000-01-01T00:00:00Z'?gfE((s.last_checked_at||'').slice(11,16)):'—';
    h+='<div class="gf-pill"><span>'+ico+gfE(s.source_name||'?')+' <span class="gf-muted" style="font-size:10px">'+lastCheck+'</span></span><b>'+(s.found_count||0)+'</b></div>';
  });
  return h+'</div></div>';
}
