/* ══ Reports ══ */

/* ─── REPORTS ─── */
function getRD(){var f=el('rf-f').value,t=el('rf-t').value,ex=el('rf-ex').value,tp=el('rf-tp').value;return D.filter(function(d){if(ex&&d.executor!==ex)return false;if(tp&&d.type!==tp)return false;if(f||t){var dl=pD(d.deadline);if(!dl)return false;if(f&&dl<new Date(f))return false;if(t){var x=new Date(t);x.setHours(23,59,59);if(dl>x)return false}}return true})}

function resetRF(){el('rf-f').value='';el('rf-t').value='';el('rf-ex').value='';el('rf-tp').value='';renderRpt()}

function renderRpt(){
  var docs=getRD(),tot=docs.length,dn=docs.filter(function(d){return!!d.done}).length,ac=docs.filter(function(d){return!d.done}).length,ov=docs.filter(function(d){if(d.done)return false;var dl=pD(d.deadline);return dl&&dl<new Date()}).length;
  el('sts').innerHTML='<div class="stat"><div class="v">'+tot+'</div><div class="l">Всього</div></div><div class="stat"><div class="v" style="color:var(--grn)">'+dn+'</div><div class="l">Виконано</div></div><div class="stat"><div class="v" style="color:var(--acc)">'+ac+'</div><div class="l">Активних</div></div><div class="stat"><div class="v" style="color:var(--red)">'+ov+'</div><div class="l">Простр.</div></div>';
  rDisc(docs);rAvg(docs);rTrnd(docs);rCommRpt();
}


function rCommRpt() {
  var c = el('rptComm'); if (!c) return;
  var now = new Date();
  var active = COMMS.filter(function(cm){return cm.status==='Активна'}).length;
  var ended = COMMS.filter(function(cm){return cm.status==='Завершена'}).length;
  var perm = COMMS.filter(function(cm){return cm.commType==='Постійна'}).length;
  var temp = COMMS.filter(function(cm){return cm.commType==='Тимчасова'}).length;

  // My roles
  var myHead=0, myDeputy=0, mySec=0, myMem=0;
  COMMS.forEach(function(cm) {
    var r = getMyRole(cm);
    if (r==='Голова') myHead++;
    else if (r==='Заступник') myDeputy++;
    else if (r==='Секретар') mySec++;
    else if (r) myMem++;
  });

  // Meetings stats
  var totalMeets = MT.length;
  var doneMeets = MT.filter(function(m){return m.status==='Проведено'||m.status==='Закрито'}).length;
  var plannedMeets = MT.filter(function(m){return m.status==='Заплановано'}).length;
  var noProtocol = MT.filter(function(m){return (m.status==='Проведено'||m.status==='Закрито')&&!m.protocolFile}).length;

  // Decisions stats
  var totalDec = DC.length;
  var doneDec = DC.filter(function(d){return d.status==='Виконано'}).length;
  var overdueDec = DC.filter(function(d){return d.status!=='Виконано'&&d.status!=='Знято з контролю'&&d.deadline&&pD(d.deadline)&&pD(d.deadline)<now}).length;
  var noDoneDoc = DC.filter(function(d){return d.status==='Виконано'&&!d.doneDoc}).length;

  var h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px">';
  h += '<div class="stat"><div class="v">' + COMMS.length + '</div><div class="l">Всього комісій</div></div>';
  h += '<div class="stat"><div class="v" style="color:var(--grn)">' + active + '</div><div class="l">Активних</div></div>';
  h += '<div class="stat"><div class="v" style="color:var(--tx3)">' + ended + '</div><div class="l">Завершених</div></div>';
  h += '<div class="stat"><div class="v">' + perm + '</div><div class="l">Постійних</div></div>';
  h += '<div class="stat"><div class="v">' + temp + '</div><div class="l">Тимчасових</div></div>';
  h += '</div>';

  // My roles
  h += '<div style="margin-bottom:10px"><b style="font-size:.78rem">⭐ Мої ролі:</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:.76rem">';
  if (myHead) h += '<span>🎖 Голова: <b>' + myHead + '</b></span>';
  if (myDeputy) h += '<span>🎖 Заступник: <b>' + myDeputy + '</b></span>';
  if (mySec) h += '<span>📝 Секретар: <b>' + mySec + '</b></span>';
  if (myMem) h += '<span>👤 Член: <b>' + myMem + '</b></span>';
  if (!myHead&&!myDeputy&&!mySec&&!myMem) h += '<span style="color:var(--tx3)">Немає</span>';
  h += '</div></div>';

  // Meetings
  h += '<div style="margin-bottom:10px"><b style="font-size:.78rem">📅 Засідання:</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:.76rem">';
  h += '<span>Всього: <b>' + totalMeets + '</b></span>';
  h += '<span style="color:var(--grn)">Проведено: <b>' + doneMeets + '</b></span>';
  h += '<span style="color:var(--acc)">Заплановано: <b>' + plannedMeets + '</b></span>';
  if (noProtocol) h += '<span style="color:var(--red)">Без протоколу: <b>' + noProtocol + '</b></span>';
  h += '</div></div>';

  // Decisions
  h += '<div style="margin-bottom:10px"><b style="font-size:.78rem">📝 Рішення:</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:.76rem">';
  h += '<span>Всього: <b>' + totalDec + '</b></span>';
  h += '<span style="color:var(--grn)">Виконано: <b>' + doneDec + '</b></span>';
  if (overdueDec) h += '<span style="color:var(--red)">Прострочено: <b>' + overdueDec + '</b></span>';
  if (noDoneDoc) h += '<span style="color:var(--orn)">Без підтвердження: <b>' + noDoneDoc + '</b></span>';
  h += '</div></div>';

  // Overdue meetings list
  var overdueComms = [];
  COMMS.forEach(function(cm) {
    if (cm.status !== 'Активна') return;
    var meets = MT.filter(function(m){return m.commUid===cm.uid});
    var lastMeet = null;
    meets.forEach(function(m){var md=pD(m.date);if(md&&md<=now){if(!lastMeet||md>pD(lastMeet.date))lastMeet=m}});
    var next = calcNextMeet(cm, lastMeet);
    if (next && next < now) overdueComms.push({name:cm.name, uid:cm.uid, days:Math.ceil((now-next)/86400000)});
  });
  if (overdueComms.length) {
    h += '<div style="margin-top:8px;border:1px solid var(--red);border-radius:var(--r2);padding:8px"><b style="font-size:.76rem;color:var(--red)">🔴 Прострочені засідання:</b>';
    overdueComms.forEach(function(c) {
      h += '<div style="font-size:.74rem;padding:3px 0;cursor:pointer" onclick="showCommDet(\'' + esc(c.uid) + '\')">👥 ' + esc(c.name) + ' <span style="color:var(--red)">(' + c.days + ' дн.)</span></div>';
    });
    h += '</div>';
  }
  c.innerHTML = h;
}

function rDisc(docs){var cv=el('chD');if(!cv)return;var now=new Date(),ms={};docs.forEach(function(d){var dl=pD(d.deadline);if(!dl)return;var k=dl.getFullYear()+'-'+p2(dl.getMonth()+1);if(!ms[k])ms[k]={ok:0,lt:0,no:0};if(!d.done){if(dl<now)ms[k].no++}else{var dd=pD(d.doneDate);if(dd&&dd<=dl)ms[k].ok++;else ms[k].lt++}});var lb=Object.keys(ms).sort().slice(-12);var pl=lb.map(function(k){var p=k.split('-');return(MO[+p[1]-1]||'').substring(0,3)+' '+p[0].substring(2)});var tc=getComputedStyle(document.body).getPropertyValue('--tx').trim();if(chDisc)chDisc.destroy();chDisc=new Chart(cv,{type:'bar',data:{labels:pl,datasets:[{label:'Вчасно',data:lb.map(function(k){return(ms[k]||{}).ok||0}),backgroundColor:'#22c55e'},{label:'Запізн.',data:lb.map(function(k){return(ms[k]||{}).lt||0}),backgroundColor:'#eab308'},{label:'Не вик.',data:lb.map(function(k){return(ms[k]||{}).no||0}),backgroundColor:'#ef4444'}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}},plugins:{legend:{labels:{color:tc}}}}})}

function rAvg(docs){var c=el('avgC'),dd=docs.filter(function(d){return d.done&&d.doneDate&&d.deadline});if(!dd.length){c.innerHTML='<p style="color:var(--tx3)">Недостатньо даних</p>';return}var s=0,n=0,bT={},bF={};dd.forEach(function(d){var dl=pD(d.deadline),dn=pD(d.doneDate);if(!dl||!dn)return;var dy=Math.abs((dn-dl)/864e5);s+=dy;n++;if(d.type){if(!bT[d.type])bT[d.type]={s:0,c:0};bT[d.type].s+=dy;bT[d.type].c++}if(d.from){if(!bF[d.from])bF[d.from]={s:0,c:0};bF[d.from].s+=dy;bF[d.from].c++}});var h='<div class="stat" style="margin-bottom:6px"><div class="v">'+(s/n).toFixed(1)+'</div><div class="l">Середній (дн.)</div></div><div style="font-size:.73rem"><b>По типах:</b><br>';Object.keys(bT).sort().forEach(function(t){h+=esc(t)+' — '+(bT[t].s/bT[t].c).toFixed(1)+' дн.<br>'});h+='<br><b>По відправниках:</b><br>';Object.keys(bF).sort().forEach(function(f){h+=esc(f)+' — '+(bF[f].s/bF[f].c).toFixed(1)+' дн.<br>'});c.innerHTML=h+'</div>'}

function rTrnd(docs){var cv=el('chT');if(!cv)return;var ws={};docs.forEach(function(d){var dl=pD(d.deadline);if(!dl)return;var dy=dl.getDay()||7,mn=new Date(dl);mn.setDate(mn.getDate()-dy+1);var k=mn.getFullYear()+'-'+p2(mn.getMonth()+1)+'-'+p2(mn.getDate());ws[k]=(ws[k]||0)+1});var lb=Object.keys(ws).sort().slice(-20);var pl=lb.map(function(k){var p=k.split('-');return p[2]+'.'+p[1]});var tc=getComputedStyle(document.body).getPropertyValue('--tx').trim();if(chTrend)chTrend.destroy();chTrend=new Chart(cv,{type:'line',data:{labels:pl,datasets:[{label:'Нових',data:lb.map(function(k){return ws[k]||0}),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.1)',fill:true,tension:.4}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}},plugins:{legend:{labels:{color:tc}}}}})}


/* ─── EXPORT ─── */
function exportData() {
  var data = F.length ? F : D;
  var csv = '\uFEFF'; // BOM for Excel Ukrainian
  csv += 'Тип;Вхідний №;Дата;Від кого;Назва;Завдання;Термін;Виконавець;Виконано;Дата вик.\n';
  data.forEach(function(d) {
    csv += [d.type,d.inNum,fD(d.docDate),d.from,d.name,d.desc,fD(d.deadline),d.executor,d.done||'',fD(d.doneDate)].map(function(v) {
      return '"' + String(v || '').replace(/"/g, '""') + '"';
    }).join(';') + '\n';
  });
  var blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'kontroli_' + isoT() + '.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('📥 Експортовано ' + data.length + ' документів');
}

