/* ═══════════════════════════════════════════════════════════
   gf-overview.js — Екран «Огляд»
   ═══════════════════════════════════════════════════════════ */

function gfViewOverview(){
  var o=GF.data.overview||{};

  /* Metric cards */
  var m=[
    {l:'Виявлено',v:o.detectedCount,c:'a',bg:'var(--accent)'},
    {l:'У базі',v:o.oppCount,c:'',bg:'var(--accent)'},
    {l:'Активних джерел',v:o.activeSources,c:'g',bg:'var(--green)'},
    {l:'Знайдено всього',v:o.scansTotal,c:'',bg:'var(--accent)'},
    {l:'Відхилено',v:o.deletedTotal,c:'r',bg:'var(--red)'},
    {l:'На погодженні',v:o.pendingApprovals,c:'',bg:'var(--yellow)'},
    {l:'Пріоритетних',v:o.highPriority,c:'g',bg:'var(--green)'},
    {l:'Всього джерел',v:o.sourcesCount,c:'',bg:'var(--accent)'}
  ];
  var mh='<div class="gf-stats">';
  m.forEach(function(x){
    var pct=o.detectedCount?Math.min(100,Math.round((x.v||0)/Math.max(1,o.detectedCount)*100)):0;
    mh+='<div class="gf-stat"><div class="gf-stat-lbl">'+gfE(x.l)+'</div>'
      +'<div class="gf-stat-val'+(x.c?' '+x.c:'')+'">'+(x.v||0)+'</div>'
      +'<div class="gf-stat-bar" style="width:'+pct+'%;background:'+x.bg+'"></div></div>';
  });
  mh+='</div>';

  /* Period panels */
  var pp='<div class="gf-gs">'
    +gfPeriodPanel('Відхилення',[['Сьогодні',o.deletedToday],['7 днів',o.deleted7],['30 днів',o.deleted30],['Рік',o.deleted365]],'var(--red)')
    +gfPeriodPanel('Погодження',[['Сьогодні',o.approvedToday],['7 днів',o.approved7],['30 днів',o.approved30],['Рік',o.approved365]],'var(--green)')
    +'</div>';

  /* Reasons + users */
  var rh=gfReasonsPanel(o);
  var uh=gfUsersPanel(o);

  /* Recent + sources */
  var recent=gfRecentPanel();
  var srcQ=gfSourcesQuickPanel();

  return mh+pp+'<div class="gf-g2">'+rh+uh+'</div><div class="gf-g2">'+recent+srcQ+'</div>';
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
  var medals=['🥇','🥈','🥉'];
  users.forEach(function(u,i){
    h+='<div class="gf-pill"><span>'+(medals[i]||'')+(medals[i]?' ':'')+gfE(u.user)+'</span><b style="color:'+color+'">'+u.count+'</b></div>';
  });
  return h+'</div>';
}

function gfRecentPanel(){
  var det=(GF.data.detected||[]).slice(0,8);
  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Останні знахідки</h3>'
    +'<button class="gf-btn sm o" onclick="gfGo(\'detected\')">Усі →</button></div>';
  if(!det.length) return h+'<div class="gf-empty">Нічого не знайдено.</div></div>';
  h+='<div class="gf-list">';
  det.forEach(function(d){
    var st=d.status||'Виявлено';
    var cls='gray';
    if(/корисне/i.test(st))cls='green';
    else if(/не підходить|видалено/i.test(st))cls='red';
    else if(/ознайомлен|переглян/i.test(st))cls='yellow';
    else if(!d.status||st==='Виявлено')cls='blue';
    h+='<div class="gf-item" style="padding:10px 14px"><div class="gf-item-head">'
      +'<h3 style="font-size:13px">'+gfE((d.raw_title||'').slice(0,70))+'</h3>'
      +'<span class="gf-badge '+cls+'">'+gfE(st)+'</span></div>'
      +'<div class="gf-muted" style="font-size:11px">'+gfE(d.source_name||'')+' · '+gfE((d.found_at||'').slice(0,10))+'</div></div>';
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
    h+='<div class="gf-pill"><span>'+ico+gfE(s.source_name||'?')+'</span><b>'+(s.found_count||0)+'</b></div>';
  });
  return h+'</div></div>';
}
