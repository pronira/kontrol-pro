/* gf-calendar.js v2 */
if (typeof GF !== 'undefined' && GF.calFilter === undefined) GF.calFilter = null;

function gfViewCalendar() {
  var det = GF.data.detected || [];
  var today = new Date().toISOString().slice(0, 10);
  var REJECTED = ['Не підходить', 'Відхилено', 'Видалено первинно'];

  var withDl = det.filter(function(d) {
    return d.deadline && d.deadline.match(/^\d{4}-\d{2}-\d{2}/) && REJECTED.indexOf(d.status) < 0;
  }).sort(function(a, b) { return (a.deadline || '').localeCompare(b.deadline || ''); });

  var upcoming = withDl.filter(function(d) { return d.deadline >= today; });
  var expired  = withDl.filter(function(d) { return d.deadline <  today; }).reverse();

  var weeks = {};
  upcoming.forEach(function(d) {
    var days = gfDaysLeft(d.deadline);
    var g = days <= 0 ? 'today' : days <= 3 ? 'red' : days <= 7 ? 'yellow' : days <= 14 ? 'blue' : days <= 30 ? 'month' : 'far';
    if (!weeks[g]) weeks[g] = [];
    weeks[g].push(d);
  });
  var urgCnt = (weeks.today||[]).length + (weeks.red||[]).length + (weeks.yellow||[]).length;

  var GROUP_KEYS = [
    {k:'today', label:'⚡ Сьогодні'},
    {k:'red',   label:'🔴 До 3 днів'},
    {k:'yellow',label:'🟡 Цей тиждень'},
    {k:'blue',  label:'🔵 Наступний тиждень'},
    {k:'month', label:'📅 Цей місяць'},
    {k:'far',   label:'📆 Далі'}
  ];

  /* Статистика — клікабельні комірки */
  var statDefs = [
    {key:'all',      label:'З дедлайном', val:withDl.length,   cls:'a', title:'Показати всі з дедлайном'},
    {key:'upcoming', label:'Активних',    val:upcoming.length,  cls:'g', title:'Показати лише активні'},
    {key:'urgent',   label:'Цього тижня', val:urgCnt,           cls:urgCnt?'r':'', title:'Показати термінові (до 7 днів)'},
    {key:'expired',  label:'Прострочені', val:expired.length,   cls:'r', title:'Показати прострочені'}
  ];
  var stats = '<div class="gf-stats" style="margin-bottom:14px">';
  statDefs.forEach(function(s) {
    var isActive = GF.calFilter === s.key;
    stats += '<div class="gf-stat" title="' + gfE(s.title) + '" onclick="GF.calFilter=\'' + s.key + '\';gfRender()" style="cursor:pointer;' + (isActive ? 'border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)' : '') + '">'
      + '<div class="gf-stat-lbl">' + gfE(s.label) + '</div>'
      + '<div class="gf-stat-val ' + (s.cls||'') + '">' + s.val + '</div>'
      + (isActive ? '<div style="font-size:9px;color:var(--accent);margin-top:2px;font-weight:700">▲ активний фільтр</div>' : '')
      + '</div>';
  });
  stats += '</div>';

  var resetBtn = GF.calFilter
    ? '<button class="gf-btn sm o" style="margin-bottom:10px" title="Скинути фільтр" onclick="GF.calFilter=null;gfRender()">✕ Скинути фільтр</button> '
    : '';

  var showUpcoming = !GF.calFilter || GF.calFilter === 'all' || GF.calFilter === 'upcoming' || GF.calFilter === 'urgent';
  var showExpired  = !GF.calFilter || GF.calFilter === 'all' || GF.calFilter === 'expired';
  var keys = GF.calFilter === 'urgent' ? ['today','red','yellow'] : GROUP_KEYS.map(function(g){return g.k;});

  var groupsH = '';
  if (showUpcoming) {
    keys.forEach(function(k) {
      var items = weeks[k]; if (!items || !items.length) return;
      var lbl = GROUP_KEYS.filter(function(g){return g.k===k;})[0].label;
      groupsH += '<div class="gf-panel" style="margin-bottom:12px"><div class="gf-panel-h"><h3>' + gfE(lbl) + '</h3><span class="gf-badge blue">' + items.length + '</span></div><div class="gf-list" style="gap:6px">';
      items.forEach(function(d) { groupsH += gfCalCard(d, false); });
      groupsH += '</div></div>';
    });
    if (!groupsH) groupsH = '<div class="gf-empty">Немає активних дедлайнів.</div>';
  }

  var expH = '';
  if (showExpired && expired.length) {
    expH = '<div class="gf-panel" style="opacity:.75"><div class="gf-panel-h"><h3 style="color:var(--red)">⏰ Прострочені</h3><span class="gf-badge red">' + expired.length + '</span></div><div class="gf-list" style="gap:4px">';
    expired.slice(0, 20).forEach(function(d) { expH += gfCalCard(d, true); });
    if (expired.length > 20) expH += '<div class="gf-muted" style="text-align:center;padding:6px">... ще ' + (expired.length - 20) + '</div>';
    expH += '</div></div>';
  }

  return stats + resetBtn + groupsH + expH;
}

function gfCalCard(d, compact) {
  var days = gfDaysLeft(d.deadline);
  var urgStyle = days <= 3 ? 'border-left:4px solid var(--red)' : days <= 7 ? 'border-left:4px solid var(--yellow)' : '';
  var did = d._id || d.detected_id;
  var url = d.detail_url || d.source_url || '';

  if (compact) {
    return '<div class="gf-item" style="padding:8px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;' + urgStyle + '">'
      + '<div style="flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + gfE((d.raw_title || '').slice(0, 70)) + '</div>'
      + '<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">'
      + gfDeadlineBadge(d.deadline) + gfStatusBadge(d.status)
      + '<button class="gf-btn sm o" title="Редагувати" onclick="gfOpenEditor(\'' + gfE(did) + '\')">✏️</button>'
      + (url ? '<button class="gf-btn sm o" title="Відкрити сайт" onclick="window.open(\'' + gfE(url) + '\',\'_blank\')">↗</button>' : '')
      + '<button class="gf-btn sm r" title="Не підходить" onclick="gfOpenStatusModal(\'' + gfE(did) + '\',\'Не підходить\',' + (compact?'\'Крайня дата минула\'':'undefined') + ')">✕</button>'
      + '</div></div>';
  }

  return '<div class="gf-item" style="padding:0;overflow:hidden;' + urgStyle + '">'
    + '<div style="padding:12px 16px 8px;display:flex;justify-content:space-between;align-items:start;gap:8px">'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:13px;font-weight:600;line-height:1.4">' + gfE((d.raw_title || '').slice(0, 100)) + '</div>'
    + '<div class="gf-muted" style="font-size:11px;margin-top:2px">'
    + (d.donor ? '<b>' + gfE(d.donor) + '</b> · ' : '')
    + gfE(d.source_name || '') + ' · ' + gfE(d.deadline)
    + (d.amount_text ? ' · <span style="color:var(--green)">' + gfE(d.amount_text) + '</span>' : '')
    + '</div></div>'
    + '<div style="display:flex;flex-direction:column;align-items:end;gap:3px;flex-shrink:0">' + gfDeadlineBadge(d.deadline) + gfStatusBadge(d.status) + '</div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--border)">'
    + gfCalCell('Заявники', d.applicants) + gfCalCell('Географія', d.geography) + gfCalCell('Тематика', d.topics)
    + '</div>'
    + (d.topics ? '<div style="padding:5px 16px;border-top:1px solid var(--border);display:flex;gap:3px;flex-wrap:wrap">' + d.topics.split(',').map(function(t){return '<span class="gf-badge gray" style="font-size:9px">'+gfE(t.trim())+'</span>';}).join('') + '</div>' : '')
    + '<div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;gap:5px;flex-wrap:wrap;background:rgba(255,255,255,.02)">'
    + '<button class="gf-btn sm o" title="Редагувати картку" onclick="gfOpenEditor(\'' + gfE(did) + '\')">✏️ Редагувати</button>'
    + (url ? '<button class="gf-btn sm o" title="Відкрити сайт джерела" onclick="window.open(\'' + gfE(url) + '\',\'_blank\')">↗ Сайт</button>' : '')
    + '<button class="gf-btn sm g" title="Позначити як корисне" onclick="gfOpenStatusModal(\'' + gfE(did) + '\',\'Корисне\')">✓ Корисне</button>'
    + '<button class="gf-btn sm r" title="Не підходить — відхилити" onclick="gfOpenStatusModal(\'' + gfE(did) + '\',\'Не підходить\')">✕ Не підходить</button>'
    + '</div></div>';
}

function gfCalCell(label, val) {
  return '<div style="padding:8px 16px;border-right:1px solid var(--border)"><div class="gf-muted" style="font-size:10px">' + gfE(label) + '</div><div style="font-size:12px;margin-top:2px">' + gfE(val || '—') + '</div></div>';
}
