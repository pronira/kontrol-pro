/* ══ Calendar ══ */

/* ─── CALENDAR ─── */
function renderCal() {
  var y = CY, m = CM; el('cal-t').textContent = MO[m] + ' ' + y;
  var cs = el('cf-st').value, ct = el('cf-tp').value, cfr = el('cf-fr').value;
  var cd = D.filter(function(d) { if (cs==='active'&&d.done) return false; if (cs==='done'&&!d.done) return false; if (ct&&d.type!==ct) return false; if (cfr&&d.from!==cfr) return false; return true; });
  var bd = {}; cd.forEach(function(d) { var dl = pD(d.deadline); if (!dl) return; var k = dl.getFullYear()+'-'+dl.getMonth()+'-'+dl.getDate(); if (!bd[k]) bd[k]=[]; bd[k].push(d); });
  // Commission meeting map
  var commMeetMap = {};
  MT.forEach(function(mt) { var md = pD(mt.date); if (!md) return; if (md.getMonth()!==m||md.getFullYear()!==y) return; var k = md.getDate(); if (!commMeetMap[k]) commMeetMap[k]=[]; commMeetMap[k].push(mt); });
  // Planned next meetings (calculated)
  var commNextMap = {};
  COMMS.forEach(function(cm) {
    if (cm.status !== 'Активна') return;
    var meets = MT.filter(function(mt){return mt.commUid===cm.uid});
    var last = null; var now2=new Date();
    meets.forEach(function(mt){var md=pD(mt.date);if(md&&md<=now2){if(!last||md>pD(last.date))last=mt}});
    var next = calcNextMeet(cm, last);
    if (next && next.getMonth()===m && next.getFullYear()===y) {
      var day = next.getDate(); if (!commNextMap[day]) commNextMap[day]=[];
      commNextMap[day].push(cm);
    }
  });
  // Birthday map for this month
  var bdayMap = {};
  O.forEach(function(o) {
    if (!o.birthday) return;
    var bp = o.birthday.match(/(\d{1,2})\.(\d{1,2})\.?(\d{4})?/);
    if (!bp) return;
    var bDay = parseInt(bp[1]), bMon = parseInt(bp[2]) - 1;
    if (bMon === m) { if (!bdayMap[bDay]) bdayMap[bDay] = []; bdayMap[bDay].push(o); }
  });
  var f = new Date(y,m,1); var sd = f.getDay(); if (sd===0) sd=7; sd--;
  var dim = new Date(y,m+1,0).getDate(), dip = new Date(y,m,0).getDate(), td = new Date();
  var h = DA.map(function(d){ return '<div class="ch">'+d+'</div>'; }).join('');
  for (var i = sd-1; i >= 0; i--) h += '<div class="cday other"><div class="cd-n">'+(dip-i)+'</div></div>';
  for (var day = 1; day <= dim; day++) {
    var k = y+'-'+m+'-'+day, docs = bd[k] || [], isT = td.getDate()===day&&td.getMonth()===m&&td.getFullYear()===y;
    var total = docs.length, done = 0, active = 0, over = 0;
    docs.forEach(function(d) { if (d.done) done++; else { active++; if (dC(d.deadline)==='over') over++; } });
    var info = '', tip = '', dots = '';
    if (total) {
      info = '<div class="cd-i"><span class="ci-t">📋'+total+'</span>';
      if (done) info += ' <span class="ci-d">✅'+done+'</span>';
      if (over) info += ' <span class="ci-o">⚠️'+over+'</span>';
      else if (active) info += ' <span class="ci-a">⏳'+active+'</span>';
      info += '</div>';
      dots = '<div class="dots">'; docs.slice(0,6).forEach(function(d) { dots += '<div class="dot" style="background:'+(d.done?'var(--grn)':(dC(d.deadline)==='over'?'var(--red)':'var(--acc)'))+'"></div>'; }); dots += '</div>';
      tip = '<div class="ctip"><div style="font-weight:700;margin-bottom:4px">📅 '+p2(day)+'.'+p2(m+1)+'.'+y+' — '+total+' контрол'+(total===1?'ь':total<5?'і':'ів')+'</div>' +
        '<div style="margin-bottom:5px;font-size:.68rem"><span class="ci-d">✅'+done+'</span> <span class="ci-a">⏳'+active+'</span>'+(over?' <span class="ci-o">⚠️'+over+'</span>':'')+'</div>';
      docs.slice(0,8).forEach(function(d) {
        var dl = pD(d.deadline), ht = hasExplicitTime(d.deadline);
        tip += '<div class="ctip-i"><span class="ctip-tm">'+(ht?p2(dl.getHours())+':'+p2(dl.getMinutes()):'')+'</span><span class="ctip-nm">'+esc((d.name||d.desc||'—').substring(0,38))+'</span><span class="ctip-st">'+(d.done?'✅':'⏳')+'</span></div>';
      });
      if (docs.length > 8) tip += '<div style="color:var(--tx3);font-size:.6rem;margin-top:3px">ще '+(docs.length-8)+'...</div>';
      tip += '</div>';
    }
    // Birthday indicator
    var bdayInfo = '';
    if (bdayMap[day]) {
      bdayInfo = '<div style="font-size:.65rem;color:var(--vio);font-weight:700">🎂' + bdayMap[day].length + '</div>';
      // Add to tooltip
      if (!tip) tip = '<div class="ctip">';
      else tip = tip.replace('</div><!--end-->', '');
      tip += '<div style="border-top:1px solid var(--brd);margin-top:4px;padding-top:4px;color:var(--vio);font-size:.68rem">🎂 ';
      tip += bdayMap[day].map(function(o) { return esc(o.name); }).join(', ');
      tip += '</div></div>';
    }
    var bdayBorder = bdayMap[day] ? ';border-bottom:2px solid var(--vio)' : '';
    // Commission meeting indicator
    var commInfo = '';
    if (commMeetMap[day]) { commInfo += '<div style="font-size:.6rem;color:var(--acc2);font-weight:700">👥' + commMeetMap[day].length + '</div>'; }
    if (commNextMap[day]) { commInfo += '<div style="font-size:.6rem;color:var(--orn)">📋' + commNextMap[day].length + '</div>'; }
    var commBorder = commMeetMap[day] ? ';border-left:2px solid var(--acc2)' : (commNextMap[day] ? ';border-left:2px solid var(--orn)' : '');
    h += '<div class="cday'+(isT?' today':'')+'" onclick="showCD('+y+','+m+','+day+')" style="'+bdayBorder+commBorder+'"><div class="cd-n">'+day+'</div>'+bdayInfo+commInfo+info+dots+tip+'</div>';
  }
  var tot = sd + dim, rem = tot%7===0?0:7-tot%7;
  for (var i = 1; i <= rem; i++) h += '<div class="cday other"><div class="cd-n">'+i+'</div></div>';
  el('cal-g').innerHTML = h; el('cdet').style.display = 'none';
}

function calPrev() { CM--; if (CM<0){CM=11;CY--;} renderCal(); }

function calNext() { CM++; if (CM>11){CM=0;CY++;} renderCal(); }


function getBirthdays(from, to) {
  var result = [];
  O.forEach(function(o) {
    if (!o.birthday) return;
    var bp = o.birthday.match(/(\d{1,2})\.(\d{1,2})\.?(\d{4})?/);
    if (!bp) return;
    var bDay = parseInt(bp[1]), bMon = parseInt(bp[2]) - 1, bYear = bp[3] ? parseInt(bp[3]) : null;
    var thisYear = from.getFullYear();
    var bd = new Date(thisYear, bMon, bDay);
    if (bd < from) bd = new Date(thisYear + 1, bMon, bDay);
    if (bd >= from && bd < to) {
      var age = bYear ? (bd.getFullYear() - bYear) : null;
      result.push({name: o.name, date: p2(bDay) + '.' + p2(bMon+1), age: age, dateObj: bd});
    }
  });
  result.sort(function(a,b) { return a.dateObj - b.dateObj; });
  return result;
}

function showCD(y, m, day) {
  var docs = D.filter(function(d) { var dl = pD(d.deadline); return dl && dl.getFullYear()===y && dl.getMonth()===m && dl.getDate()===day; });
  var ds = p2(day)+'.'+p2(m+1)+'.'+y;
  var det = el('cdet'); det.style.display = '';
  el('cdet-t').textContent = '📅 ' + ds + ' — ' + docs.length + ' док.';
  if (!docs.length) { el('cdet-c').innerHTML = '<div class="empty" style="padding:10px">Немає</div>'; }
  else { el('cdet-c').innerHTML = docs.map(function(d){ return cH(d, false); }).join(''); }
  det.scrollIntoView({behavior:'smooth', block:'start'});
}

