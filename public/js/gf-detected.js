/* ═══════════════════════════════════════════════════════════
   gf-detected.js — Екран «Виявлено» з фільтрами
   ═══════════════════════════════════════════════════════════ */

function gfViewDetected(){
  var all=GF.data.detected||[];
  var rej=['Не підходить','Видалено первинно'];
  var act=['Виявлено','Переглянув','Ознайомився','Потрібно уточнити','Цікаво','Дуже цікаво'];
  var filters={
    new:function(d){return !d.status||act.indexOf(d.status)>=0;},
    helpful:function(d){return d.status==='Корисне';},
    review:function(d){return d.status==='На ознайомленні';},
    base:function(d){return d.status==='В базу';},
    duplicates:function(d){return d.duplicate_flag==='possible_duplicate';},
    rejected:function(d){return rej.indexOf(d.status)>=0;},
    all:function(){return true;}
  };

  var counts={};
  Object.keys(filters).forEach(function(k){counts[k]=all.filter(filters[k]).length;});

  var view=GF.detectedView||'new';
  var list=all.filter(filters[view]||filters.new);

  /* Search */
  var q=(GF.detectedSearch||'').toLowerCase();
  if(q){
    list=list.filter(function(d){
      return[d.raw_title,d.short_desc,d.donor,d.topics,d.geography,d.applicants,d.source_name,d.tags].join(' ').toLowerCase().indexOf(q)>=0;
    });
  }

  /* Priority scoring */
  var kw=(GF.priorityKw||'').toLowerCase().split(',').map(function(s){return s.trim();}).filter(function(s){return s.length>2;});
  list.forEach(function(d){
    var hay=[d.raw_title,d.short_desc,d.topics,d.applicants,d.geography,d.donor,d.tags,d.full_desc].join(' ').toLowerCase();
    d._ps=0; d._pm=[];
    kw.forEach(function(k){if(k&&hay.indexOf(k)>=0){d._ps++;d._pm.push(k);}});
  });
  list.sort(function(a,b){return(b._ps||0)-(a._ps||0);});

  /* Tabs */
  var tabs=[
    ['new','Нові',counts.new],['helpful','Корисні',counts.helpful],
    ['review','На ознайомленні',counts.review],['base','У базі',counts.base],
    ['duplicates','Дублікати',counts.duplicates],['rejected','Відхилені',counts.rejected],
    ['all','Усі',counts.all]
  ];
  var th='<div class="gf-tabs">';
  tabs.forEach(function(t){
    th+='<button'+(view===t[0]?' class="active"':'')+' onclick="GF.detectedView=\''+t[0]+'\';gfRender()">'+gfE(t[1])+' ('+t[2]+')</button>';
  });
  th+='</div>';

  /* Search bar */
  var sh='<div class="gf-search">'
    +'<input id="gfDetSearch" placeholder="Пошук по назві, донору, темі, географії…" value="'+gfE(q)+'" onkeydown="if(event.keyCode===13)gfDetDoSearch()">'
    +'<button class="gf-btn sm" onclick="gfDetDoSearch()">Шукати</button>'
    +(q?'<button class="gf-btn sm o" onclick="GF.detectedSearch=\'\';gfRender()">✕</button>':'')
    +'</div>';

  /* View mode buttons */
  var modes=[['list','Список'],['compact','Компакт']];
  var vmh='<div style="display:flex;gap:4px;margin-bottom:10px">';
  modes.forEach(function(m){
    vmh+='<button class="gf-btn sm'+(GF.viewMode===m[0]?'':' o')+'" onclick="GF.viewMode=\''+m[0]+'\';gfRender()">'+m[1]+'</button>';
  });
  vmh+='</div>';

  /* Items */
  var items=list.slice(0,80);
  var ih;
  if(!items.length){
    ih='<div class="gf-empty">'+(q?'Нічого за «'+gfE(q)+'».':'Немає записів.')+'</div>';
  } else if(GF.viewMode==='compact'){
    ih=gfDetCompact(items);
  } else {
    ih=gfDetList(items);
  }

  /* Bulk bar */
  var bulkH='<div id="gfBulkBar" style="display:none;margin-bottom:10px;padding:10px 14px;background:var(--accent-soft);border:1px solid rgba(79,110,247,.2);border-radius:var(--r);align-items:center;gap:10px;flex-wrap:wrap">'
    +'<span><b id="gfBulkCnt">0</b> вибрано</span>'
    +'<button class="gf-btn sm g" onclick="gfBulkAction(\'Корисне\')">✓ Корисне</button>'
    +'<button class="gf-btn sm r" onclick="gfBulkAction(\'Не підходить\')">✕ Не підходить</button>'
    +'<button class="gf-btn sm o" onclick="GF_BULK={};gfUpdateBulkBar();gfRender()">Скинути</button>'
    +'<label style="font-size:11px;cursor:pointer"><input type="checkbox" onchange="gfToggleAllBulk()"> Вибрати всі</label>'
    +'</div>';

  return '<div class="gf-panel"><div class="gf-panel-h"><h3>Виявлено</h3>'
    +'<span class="gf-badge blue">'+list.length+(q?' (пошук)':'')+'</span></div>'
    +th+vmh+sh+bulkH+ih+'</div>';
}

/* ── List view ── */
function gfDetList(items){
  var h='<div class="gf-list">';
  items.forEach(function(d){
    var url=d.detail_url||d.source_url||'';
    var did=d._id||d.detected_id;
    var isPrio=(d._ps||0)>0;
    var bdr=isPrio?'border-left:4px solid var(--accent);':'';
    var stBadge=gfStatusBadge(d.status);

    var kwBadges=(d._pm||[]).slice(0,3).map(function(k){
      return '<span class="gf-badge green" style="font-size:9px;padding:1px 6px">'+gfE(k)+'</span>';
    }).join(' ');

    h+='<div class="gf-item" style="'+bdr+'padding:0;overflow:hidden">'
      /* Header */
      +'<div style="padding:12px 16px 8px;display:flex;justify-content:space-between;align-items:start;gap:8px">'
      +'<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;line-height:1.4;margin-bottom:2px">'+gfE(d.raw_title||'Без назви')+'</div>'
      +'<div class="gf-muted" style="font-size:11px">'+gfE(d.source_name||'')+' · '+gfE((d.found_at||'').slice(0,10))+'</div></div>'
      +'<div style="display:flex;gap:3px;flex-wrap:wrap;flex-shrink:0">'+stBadge+(isPrio?' <span class="gf-badge blue" style="font-size:9px">★'+d._ps+'</span> ':' ')+kwBadges+'</div></div>';

    /* Description */
    if(d.short_desc)
      h+='<div style="padding:0 16px 8px;font-size:12px;color:var(--text2);line-height:1.5">'+gfE((d.short_desc||'').slice(0,280))+'</div>';

    /* Data grid */
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--border)">'
      +gfCell('Донор',d.donor)
      +'<div style="padding:8px 16px;border-right:1px solid var(--border)"><div class="gf-muted" style="font-size:10px">Дедлайн</div><div style="font-size:12px;margin-top:2px">'+(d.deadline?gfDeadlineBadge(d.deadline)+' '+gfE(d.deadline):'—')+'</div></div>'
      +gfCell('Сума',d.amount_text,'color:var(--green)')
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--border)">'
      +gfCell('Заявники',d.applicants)+gfCell('Географія',d.geography)+gfCell('Тематика',d.topics)
      +'</div>';

    /* Link */
    if(url)
      h+='<div style="padding:6px 16px;border-top:1px solid var(--border);font-size:11px;word-break:break-all"><a href="'+gfE(url)+'" target="_blank" style="color:var(--accent)">'+gfE(url.slice(0,90))+'</a></div>';

    /* Actions */
    h+='<div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;gap:5px;flex-wrap:wrap;background:rgba(255,255,255,.02)">'
      +'<input type="checkbox" class="gf-bulk-chk" data-id="'+gfE(did)+'" id="gfchk_'+gfE(did)+'" onclick="gfToggleBulk(\''+gfE(did)+'\')"'+(GF_BULK[did]?' checked':'')+' style="width:16px;height:16px;cursor:pointer">'
      +(url?'<button class="gf-btn sm o" onclick="window.open(\''+gfE(url)+'\',\'_blank\')">Відкрити</button>':'')
      +'<button class="gf-btn sm o" onclick="gfOpenEditor(\''+gfE(did)+'\')">✏️ Редагувати</button>'
      +'<button class="gf-btn sm g" onclick="gfOpenStatusModal(\''+gfE(did)+'\',\'Корисне\')">✓ Корисне</button>'
      +'<button class="gf-btn sm r" onclick="gfOpenStatusModal(\''+gfE(did)+'\',\'Не підходить\')">✕ Не підходить</button>'
      +'</div></div>';
  });
  return h+'</div>';
}

/* ── Compact view ── */
function gfDetCompact(items){
  var h='<div class="gf-list">';
  items.forEach(function(d){
    var url=d.detail_url||d.source_url||'';
    var isPrio=(d._ps||0)>0;
    var bdr=isPrio?'border-left:4px solid var(--accent);':'';
    h+='<div class="gf-item" style="'+bdr+'padding:8px 14px;display:flex;align-items:center;gap:10px">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+gfE((d.raw_title||'').slice(0,80))+'</div>'
      +'<div class="gf-muted" style="font-size:11px;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">'
      +'<span>'+gfE(d.source_name||'')+'</span>'
      +'<span>'+gfE(d.donor||'')+'</span>'
      +(d.deadline?'<span style="color:var(--red)">'+gfE(d.deadline)+'</span>':'')
      +'<span>'+gfE(d.amount_text||'')+'</span></div></div>'
      +'<div style="display:flex;gap:4px;flex-shrink:0">'
      +(url?'<button class="gf-btn sm o" onclick="window.open(\''+gfE(url)+'\',\'_blank\')">↗</button>':'')
      +'<button class="gf-btn sm g" onclick="gfDetStatus(\''+gfE(d._id||d.detected_id)+'\',\'Корисне\')">✓</button>'
      +'<button class="gf-btn sm r" onclick="gfDetStatus(\''+gfE(d._id||d.detected_id)+'\',\'Не підходить\')">✕</button>'
      +'</div></div>';
  });
  return h+'</div>';
}

/* ── Helpers ── */
function gfCell(label,val,style){
  return '<div style="padding:8px 16px;border-right:1px solid var(--border)">'
    +'<div class="gf-muted" style="font-size:10px">'+gfE(label)+'</div>'
    +'<div style="font-size:12px;'+(style||'')+'">'+gfE(val||'—')+'</div></div>';
}

function gfStatusBadge(st){
  var s=String(st||'Виявлено');
  var c='gray';
  if(/корисне/i.test(s))c='green';
  else if(/не підходить|видалено/i.test(s))c='red';
  else if(/ознайомлен|аналіз|потреб/i.test(s))c='yellow';
  else if(s==='Виявлено'||!st)c='blue';
  return '<span class="gf-badge '+c+'">'+gfE(s)+'</span>';
}

/* ── Actions ── */
function gfDetDoSearch(){
  GF.detectedSearch=(gfId('gfDetSearch')||{}).value||'';
  gfRender();
}

async function gfDetStatus(id,status){
  var reason=status==='Не підходить'?prompt('Причина відхилення:',''):status;
  if(reason===null)return;
  try{
    /* Optimistic update */
    var det=GF.data.detected||[];
    for(var i=0;i<det.length;i++){
      if((det[i]._id||det[i].detected_id)===id){
        det[i].status=status;
        det[i].status_reason=reason;
        det[i].status_changed_at=new Date().toISOString();
        break;
      }
    }
    gfRender();
    await gfSetDetectedStatus(id,status,reason,'');
    gfToast(status==='Корисне'?'✓ Позначено корисним':'✕ Відхилено',status==='Корисне'?'var(--green)':'var(--red)');
  }catch(e){alert('Помилка: '+e.message);await gfRefresh();}
}

function gfWireDetected(){
  /* Post-render wiring for search input enter key etc - already handled inline */
}

/* ── Manual add ── */
async function gfQuickAdd(){
  var title=prompt('Назва можливості',''); if(!title)return;
  var url=prompt('Посилання','')||'';
  var donor=prompt('Донор','')||'';
  var desc=prompt('Короткий опис','')||'';
  var deadline=prompt('Дедлайн (YYYY-MM-DD)','')||'';
  var amount=prompt('Сума','')||'';
  var topics=prompt('Тематики (через кому)','')||'';
  var geo=prompt('Географія','')||'';
  var appl=prompt('Заявники','')||'';
  try{
    await gfSaveDetected({
      raw_title:title,detail_url:url,donor:donor,short_desc:desc,
      deadline:deadline,amount_text:amount,topics:topics,geography:geo,
      applicants:appl,source_name:'Вручну',source_type:'manual',
      status:'Виявлено',auto_priority:'medium'
    });
    gfToast('Додано: '+title,'var(--green)');
    await gfRefresh(); gfGo('detected');
  }catch(e){alert('Помилка: '+e.message);}
}
