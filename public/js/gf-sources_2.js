/* ═══════════════════════════════════════════════════════════
   gf-sources.js v3 — Джерела + Каталог готових джерел
   ─────────────────────────────────────────────────────────
   ВІДНОВЛЕНО (втрачено в нових версіях):
     - Вкладка "🔎 Пошук джерел" (gfViewDiscover)
     - gfForceScan — кнопка "▶ Сканувати" на кожному джерелі
     - gfShowScanLog — модалка лога з діагностикою
     - gfSrcLogBadge — статус останнього сканування
     - gfDiscoverOpen / gfDiscoverDismiss / gfDiscoverAdd
     - gfWireSources — делегування для discover-кнопок

   ЗБЕРЕЖЕНО покращення нових версій:
     - Більше джерел у каталозі (TG + донори)
     - Повна дата перевірки у метаданих

   НОВІ ПОКРАЩЕННЯ v3:
     - gfShowScanLog: повні warnings (до 50), стек помилок
     - Лог: кнопка "Копіювати лог" для звітування
     - Discover: показує повний URL кандидата
     - Discover: зберігає dismissed у localStorage незалежно
   ═══════════════════════════════════════════════════════════ */

/* ── Каталог перевірених джерел ── */
var GF_CATALOG = [
  /* Сайти-агрегатори */
  {cat:'Сайти-агрегатори',id:'gurt_rss',name:'ГУРТ (RSS)',url:'https://gurt.org.ua/grants/feed/',type:'rss',parser:'rss',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'prostir_feed',name:'Prostir (RSS)',url:'https://prostir.ua/grants/feed/',type:'rss',parser:'rss',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'getgrant_page',name:'GetGrant',url:'https://getgrant.com.ua/grants/',type:'page',parser:'page_links',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'grant_market',name:'Grant.Market',url:'https://grant.market/grants',type:'page',parser:'page_links',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'granty_org_ua',name:'Granty.org.ua',url:'https://granty.org.ua/',type:'page',parser:'page_links',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'getgrant_ua',name:'GetGrant.ua',url:'https://getgrant.ua/',type:'page',parser:'page_links',ico:'🌐'},
  /* Telegram канали */
  {cat:'Telegram канали',id:'tg_grantovyphishky',name:'Грантові фішки',url:'https://t.me/s/grantovyphishky',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_gurtrc',name:'ГУРТ',url:'https://t.me/s/gaborets',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_prostirua',name:'Простір',url:'https://t.me/s/prostir_ua',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grant_market',name:'Grant.Market',url:'https://t.me/s/grant_market',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grants_here',name:'Гранти та можливості',url:'https://t.me/s/grants_here',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grantsua',name:'Гранти UA',url:'https://t.me/s/grantsua',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grantup',name:'GrantUP',url:'https://t.me/s/grantup',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grantovyphishky_eu',name:'Грантові фішки ЄС',url:'https://t.me/s/grantovyphishky_eu',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_ednannia',name:'ІСАР Єднання',url:'https://t.me/s/ednannia',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_ukf_ua',name:'УКФ',url:'https://t.me/s/ukf_ua',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_usaid_ukraine',name:'USAID Ukraine',url:'https://t.me/s/usaidukraine',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_undp_ukraine',name:'UNDP Ukraine',url:'https://t.me/s/undp_ukraine',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_eef_ukraine',name:'Фонд Сх. Європа',url:'https://t.me/s/eef_ukraine',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_houseofeurope',name:'House of Europe',url:'https://t.me/s/HouseofEuropeUA',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_diia_business',name:'Дія.Бізнес',url:'https://t.me/s/diia_business',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_giz_ukraine',name:'GIZ Ukraine',url:'https://t.me/s/giz_ukraine',type:'telegram',parser:'telegram',ico:'📱'},
  /* Міжнародні донори */
  {cat:'Міжнародні донори',id:'undp_ukraine',name:'UNDP Ukraine',url:'https://www.undp.org/ukraine/grants',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'house_of_europe',name:'House of Europe',url:'https://houseofeurope.org.ua/opportunities',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'eef_grants',name:'Фонд Сх. Європа',url:'https://eef.org.ua/programs/',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'ednannia_grants',name:'ІСАР Єднання',url:'https://ednannia.ua/grants',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'diia_business',name:'Дія.Бізнес',url:'https://business.diia.gov.ua/cases/grant',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'irex_ukraine',name:'IREX Ukraine',url:'https://www.irex.org/ukraine',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'opensociety_ua',name:'Open Society (МФВ)',url:'https://www.irf.ua/grants/',type:'page',parser:'page_links',ico:'🏛'},
  /* Google News RSS */
  {cat:'Google News',id:'google_news_grants_ua',name:'Гранти Україна',url:'https://news.google.com/rss/search?q=гранти+Україна&hl=uk&gl=UA&ceid=UA:uk',type:'rss',parser:'google_news_rss',ico:'📰'},
  {cat:'Google News',id:'google_news_grants_hromady',name:'Гранти громади',url:'https://news.google.com/rss/search?q=гранти+для+громад&hl=uk&gl=UA&ceid=UA:uk',type:'rss',parser:'google_news_rss',ico:'📰'},
  {cat:'Google News',id:'google_news_konkursy',name:'Конкурси проєктів',url:'https://news.google.com/rss/search?q=конкурс+проєктів+Україна&hl=uk&gl=UA&ceid=UA:uk',type:'rss',parser:'google_news_rss',ico:'📰'},
  {cat:'Google News',id:'google_news_vidnovlennia',name:'Відновлення гранти',url:'https://news.google.com/rss/search?q=відновлення+грант+Україна&hl=uk&gl=UA&ceid=UA:uk',type:'rss',parser:'google_news_rss',ico:'📰'},
  /* Міжнародні RSS */
  {cat:'Міжнародні RSS',id:'fundsforngos_ukraine',name:'FundsforNGOs',url:'https://www2.fundsforngos.org/tag/ukraine/feed/',type:'rss',parser:'rss',ico:'🌍'},
  {cat:'Міжнародні RSS',id:'reliefweb_ukraine',name:'ReliefWeb UA',url:'https://reliefweb.int/updates/rss?country=254',type:'rss',parser:'rss',ico:'🌍'},
  {cat:'Міжнародні RSS',id:'reliefweb_funding',name:'ReliefWeb Funding',url:'https://reliefweb.int/jobs/rss?country=254&type=2',type:'rss',parser:'rss',ico:'🌍'},
  /* Додаткові */
  {cat:'Додаткові',id:'ucf_news',name:'УКФ (Укр. культурний фонд)',url:'https://ucf.in.ua/programs',type:'page',parser:'page_links',ico:'🎭'},
  {cat:'Додаткові',id:'grant_av',name:'Грант АВ',url:'https://grant.av.ua/',type:'page',parser:'page_links',ico:'🌐'}
];

/* ═══════════════════════════════════════════════════════════
   ГОЛОВНИЙ ВИД ДЖЕРЕЛ
   ═══════════════════════════════════════════════════════════ */
function gfViewSources() {
  var src  = GF.data.sources  || [];
  var arch = GF.data.archive  || [];
  var active = src.filter(function(s) { return s.source_status === 'active'; });
  var paused = src.filter(function(s) { return s.source_status !== 'active'; });

  var view = GF.sourceView || 'active';
  var tabs = [
    ['active',   'Активні',          active.length],
    ['paused',   'Призупинені',       paused.length],
    ['catalog',  '📚 Каталог',        GF_CATALOG.length],
    ['discover', '🔎 Нові джерела',   ''],
    ['archive',  'Архів',             arch.length]
  ];
  var th = '<div class="gf-tabs">';
  tabs.forEach(function(t) {
    th += '<button' + (view === t[0] ? ' class="active"' : '') +
          ' onclick="GF.sourceView=\'' + t[0] + '\';gfRender()">' +
          gfE(t[1]) + (t[2] !== '' ? ' (' + t[2] + ')' : '') + '</button>';
  });
  th += '</div>';

  if (view === 'catalog')  return gfViewCatalog(th, src);
  if (view === 'discover') return gfViewDiscover(th, src);

  /* Quick add from URL */
  var addH = '<div style="margin-bottom:12px;padding:14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r)">'
    + '<div style="font-size:12px;font-weight:600;margin-bottom:8px">Швидке додавання</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end">'
    + '<div class="gf-field" style="margin:0"><label>URL джерела</label><input id="gfNewSrcUrl" placeholder="https://t.me/s/channel"></div>'
    + '<div class="gf-field" style="margin:0"><label>Назва (необов\'язково)</label><input id="gfNewSrcName" placeholder="авто з URL"></div>'
    + '<button class="gf-btn" onclick="gfAddSrcFromUrl()" style="margin-bottom:1px">+ Додати</button>'
    + '</div></div>';

  /* Search */
  var sq = (GF.sourceSearch || '').toLowerCase();
  var searchH = '<div class="gf-search">'
    + '<input id="gfSrcSearch" placeholder="Пошук джерел…" value="' + gfE(sq) + '" onkeydown="if(event.keyCode===13)gfSrcDoSearch()">'
    + '<button class="gf-btn sm" onclick="gfSrcDoSearch()">🔍</button>'
    + (sq ? '<button class="gf-btn sm o" onclick="GF.sourceSearch=\'\';gfRender()">✕</button>' : '')
    + '</div>';

  var current = view === 'paused' ? paused : view === 'archive' ? arch : active;
  if (sq) {
    current = current.filter(function(s) {
      return [s.source_name,s.source_url,s.source_type,s.source_topics,s.notes].join(' ').toLowerCase().indexOf(sq) >= 0;
    });
  }

  var listH;
  if (!current.length) {
    listH = '<div class="gf-empty">' + (view === 'active'
      ? 'Немає активних джерел. Перейдіть на вкладку <b>📚 Каталог</b> щоб додати перевірені джерела.'
      : 'Немає джерел.') + '</div>';
  } else {
    listH = '<div class="gf-list">';
    current.forEach(function(s) {
      var ico = /telegram/i.test(s.source_type||'') ? '📱 '
              : /rss/i.test(s.source_type||'')      ? '📡 '
              : /google_news/i.test(s.parser_mode||'') ? '📰 ' : '🌐 ';
      var stBadge  = s.source_status === 'active'
        ? '<span class="gf-badge green">Активне</span>'
        : '<span class="gf-badge gray">Пауза</span>';
      var pCls = s.source_priority === 'critical' ? 'red'
               : s.source_priority === 'high'     ? 'green'
               : s.source_priority === 'medium'   ? 'yellow' : 'gray';
      var prioBadge = '<span class="gf-badge ' + pCls + '">' + gfE(s.source_priority||'—') + '</span>';

      listH += '<div class="gf-item"><div class="gf-item-head">'
        + '<h3>' + ico + gfE(s.source_name||'?') + '</h3>'
        + '<div style="display:flex;gap:4px">' + stBadge + prioBadge + '</div></div>'
        + '<div class="gf-item-meta">'
        + '<span>' + gfE(s.source_type||'') + '</span>'
        + '<span>' + gfE(s.parser_mode||'') + '</span>'
        + '<span>Всього: ' + (s.found_count||0) + '</span>'
        + (s.last_checked_at ? '<span>Перевірено: ' + gfE((s.last_checked_at||'').slice(0,16).replace('T',' ')) + '</span>' : '')
        + gfSrcLogBadge(s)
        + (s.last_error ? '<span style="color:var(--red)" title="' + gfE(s.last_error) + '">❌ Помилка</span>' : '')
        + (s.source_topics ? '<span>' + gfE(s.source_topics) + '</span>' : '')
        + '</div>'
        + '<div class="gf-muted" style="font-size:11px;word-break:break-all;margin-top:4px">' + gfE(s.source_url||'') + '</div>';

      if (view === 'archive') {
        listH += '<div class="gf-notice" style="margin-top:8px;font-size:11px">' + gfE(s.archive_reason||'') + '</div>';
      } else {
        listH += '<div class="gf-item-acts">'
          + (s.source_url ? '<button class="gf-btn sm o" title="Відкрити сайт" onclick="window.open(\'' + gfE(s.source_url) + '\',\'_blank\')">↗ Відкрити</button>' : '')
          + '<button class="gf-btn sm o" title="Редагувати" onclick="gfOpenSourceForm(\'' + gfE(s._id||s.source_id) + '\')">✏️</button>'
          + '<button class="gf-btn sm o" title="Лог сканування" onclick="gfShowScanLog(\'' + gfE(s._id||s.source_id) + '\',\'' + gfE(s.source_name||'') + '\')">📋 Лог</button>'
          + '<button class="gf-btn sm g" title="Примусове сканування" onclick="gfForceScan(\'' + gfE(s._id||s.source_id) + '\',\'' + gfE(s.source_name||'') + '\')">▶ Скан</button>'
          + '<button class="gf-btn sm o" title="' + (s.source_status==='active'?'Призупинити':'Відновити') + '" onclick="gfTogglePause(\'' + gfE(s._id||s.source_id) + '\')">'
          + (s.source_status === 'active' ? '⏸' : '▶') + '</button>'
          + '<button class="gf-btn sm r" title="Архівувати" onclick="gfArchiveSrc(\'' + gfE(s._id||s.source_id) + '\')">🗑</button>'
          + '</div>';
      }
      listH += '</div>';
    });
    listH += '</div>';
  }

  return '<div class="gf-panel"><div class="gf-panel-h"><h3>Джерела</h3>'
    + '<div style="display:flex;gap:6px">'
    + '<span class="gf-badge blue">' + src.length + '</span>'
    + '<button class="gf-btn sm" onclick="gfOpenSourceForm()">+ Нове</button>'
    + '</div></div>'
    + th + (view !== 'archive' ? addH : '') + searchH + listH + '</div>';
}

/* ═══════════════════════════════════════════════════════════
   КАТАЛОГ
   ═══════════════════════════════════════════════════════════ */
function gfViewCatalog(tabsH, existingSrc) {
  var existingIds  = existingSrc.map(function(s) { return (s.source_profile||s.source_name||'').toLowerCase(); });
  var existingUrls = existingSrc.map(function(s) { return (s.source_url||'').toLowerCase().replace(/\/+$/,''); });

  function isAdded(c) {
    return existingIds.indexOf(c.id.toLowerCase()) >= 0 ||
           existingUrls.indexOf(c.url.toLowerCase().replace(/\/+$/,'')) >= 0 ||
           existingSrc.some(function(s) { return (s.source_name||'').toLowerCase() === c.name.toLowerCase(); });
  }

  var cats = {};
  GF_CATALOG.forEach(function(c) { if (!cats[c.cat]) cats[c.cat] = []; cats[c.cat].push(c); });
  var addedCnt = GF_CATALOG.filter(isAdded).length;

  var h = '<div class="gf-panel"><div class="gf-panel-h"><h3>Каталог перевірених джерел</h3>'
    + '<div style="display:flex;gap:6px">'
    + '<span class="gf-badge blue">' + addedCnt + ' / ' + GF_CATALOG.length + ' додано</span>'
    + '<button class="gf-btn sm" onclick="gfBulkAddAll()">Додати ВСІ</button>'
    + '</div></div>' + tabsH
    + '<div class="gf-ok" style="margin-bottom:14px"><b>' + GF_CATALOG.length + ' перевірених джерел.</b> Натисніть «Додати» або «Додати ВСІ». Вже додані позначені ✓.</div>';

  Object.keys(cats).forEach(function(cat) {
    var items = cats[cat];
    var catIcon = cat.indexOf('Telegram') >= 0 ? '📱'
                : cat.indexOf('Google')   >= 0 ? '📰'
                : cat.indexOf('Міжнародні донори') >= 0 ? '🏛'
                : cat.indexOf('Міжнародні RSS')    >= 0 ? '🌍' : '🌐';
    h += '<div style="margin-bottom:16px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">'
      + '<span style="font-size:16px">' + catIcon + '</span>'
      + '<span style="font-size:13px;font-weight:700">' + gfE(cat) + '</span>'
      + '<span class="gf-badge gray">' + items.length + '</span></div>'
      + '<div class="gf-list" style="gap:6px">';
    items.forEach(function(c) {
      var added = isAdded(c);
      h += '<div class="gf-item" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px;' + (added ? 'opacity:.6' : '') + '"><div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:600">' + c.ico + ' ' + gfE(c.name) + '</div>'
        + '<div class="gf-muted" style="font-size:10px;word-break:break-all;margin-top:2px">' + gfE(c.url.slice(0,80)) + '</div>'
        + '</div><div>'
        + (added
          ? '<span class="gf-badge green">✓ Додано</span>'
          : '<button class="gf-btn sm" onclick="gfAddFromCatalog(\'' + gfE(c.id) + '\')">+ Додати</button>')
        + '</div></div>';
    });
    h += '</div></div>';
  });

  return h + '</div>';
}

/* ═══════════════════════════════════════════════════════════
   ПОШУК НОВИХ ДЖЕРЕЛ (DISCOVER)
   ═══════════════════════════════════════════════════════════ */
function gfViewDiscover(tabsH, existingSrc) {
  var existingUrls = new Set(existingSrc.map(function(s) {
    return (s.source_url||'').toLowerCase().replace(/\/+$/,'');
  }));
  var dismissed    = JSON.parse(localStorage.getItem('gf_discover_dismissed')||'[]');
  var dismissedSet = new Set(dismissed);

  // Збираємо зовнішні URL з виявлених грантів
  var det      = GF.data.detected || [];
  var urlCount = {}, urlTitles = {};

  det.forEach(function(d) {
    var u = (d.detail_url||'').toLowerCase().replace(/\/+$/,'');
    if (u && u.startsWith('http') && !u.includes('t.me')) {
      try {
        var host = new URL(u).hostname.replace(/^www\./,'');
        urlCount[host]  = (urlCount[host]||0) + 1;
        if (!urlTitles[host]) urlTitles[host] = [];
        if (urlTitles[host].length < 3) urlTitles[host].push(d.raw_title||'');
      } catch(e) {}
    }
    var srcUrl = (d.source_url||'').toLowerCase();
    if (srcUrl.includes('t.me')) {
      var m = srcUrl.match(/t\.me\/s?\/?([^\/\?]+)/);
      if (m) {
        var ch = 'telegram:' + m[1];
        urlCount[ch] = (urlCount[ch]||0) + 1;
        if (!urlTitles[ch]) urlTitles[ch] = [];
        if (urlTitles[ch].length < 3) urlTitles[ch].push(d.raw_title||'');
      }
    }
  });

  var candidates = Object.keys(urlCount)
    .filter(function(h) {
      if (dismissedSet.has(h)) return false;
      return !existingSrc.some(function(s) {
        var su = (s.source_url||'').toLowerCase();
        return su.includes(h) || (h.startsWith('telegram:') && su.includes(h.replace('telegram:','')));
      });
    })
    .sort(function(a,b) { return urlCount[b] - urlCount[a]; })
    .slice(0, 50);

  var h = '<div class="gf-panel"><div class="gf-panel-h"><h3>🔎 Нові джерела</h3>'
    + '<span class="gf-badge blue">' + candidates.length + ' кандидатів</span></div>'
    + tabsH
    + '<div class="gf-ok" style="margin-bottom:14px">Сайти та канали, які найчастіше зустрічаються у виявлених грантах. Вже додані як джерела — не показуються.</div>';

  if (!candidates.length) {
    return h + '<div class="gf-empty">Немає нових кандидатів. Накопичіть більше виявлених записів або додайте джерела вручну.</div></div>';
  }

  h += '<div class="gf-list">';
  candidates.forEach(function(host) {
    var cnt    = urlCount[host];
    var titles = (urlTitles[host]||[]).slice(0,2);
    var isTg   = host.startsWith('telegram:');
    var channel    = isTg ? host.replace('telegram:','') : '';
    var displayUrl = isTg ? 'https://t.me/s/' + channel : 'https://' + host;
    var ico        = isTg ? '📱' : '🌐';

    h += '<div class="gf-item" style="padding:10px 16px">'
      + '<div style="display:flex;align-items:center;gap:10px">'
      + '<div style="min-width:38px;height:38px;background:rgba(79,110,247,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#4f6ef7;flex-shrink:0">' + cnt + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:600">' + ico + ' ' + gfE(isTg ? '@'+channel : host) + '</div>'
      + '<div class="gf-muted" style="font-size:10px;margin-top:2px;word-break:break-all">' + gfE(displayUrl) + '</div>'
      + (titles.length ? '<div style="font-size:11px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
          + titles.map(function(t){return gfE(t.slice(0,60));}).join(' · ') + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;gap:4px;flex-shrink:0">'
      + '<button class="gf-btn sm o" title="Відкрити" data-disc-open="' + gfE(displayUrl) + '">↗</button>'
      + '<button class="gf-btn sm g" title="Додати як джерело" data-disc-host="' + gfE(host) + '" data-disc-url="' + gfE(displayUrl) + '" data-disc-name="' + gfE(isTg?'@'+channel:host) + '">+ Додати</button>'
      + '<button class="gf-btn sm r" title="Вилучити" data-disc-dismiss="' + gfE(host) + '">✕</button>'
      + '</div></div></div>';
  });
  h += '</div>';

  if (dismissed.length) {
    h += '<div style="margin-top:16px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px">Вилучені (' + dismissed.length + ')</div>'
      + '<button class="gf-btn sm o" style="font-size:10px" data-disc-restore>↺ Відновити всі</button>'
      + '</div>'
      + '<div class="gf-list" style="gap:4px">';
    dismissed.forEach(function(dhost) {
      var dcnt = urlCount[dhost] || 0;
      var disTg = dhost.startsWith('telegram:');
      var dLabel = disTg ? '@' + dhost.replace('telegram:','') : dhost;
      h += '<div class="gf-item" style="padding:7px 14px;opacity:.5;display:flex;align-items:center;gap:8px">'
        + '<div style="min-width:28px;text-align:center;font-size:12px;font-weight:700;color:#64748b">' + dcnt + '</div>'
        + '<div style="flex:1;font-size:12px;color:#64748b">' + (disTg?'📱':'🌐') + ' ' + gfE(dLabel) + '</div>'
        + '<button class="gf-btn sm o" style="font-size:10px;padding:3px 8px" data-disc-restore-one="' + gfE(dhost) + '">↺</button>'
        + '</div>';
    });
    h += '</div></div>';
  }

  return h + '</div>';
}

/* ═══════════════════════════════════════════════════════════
   ЛОГ СКАНУВАННЯ (МОДАЛКА)
   ═══════════════════════════════════════════════════════════ */
async function gfShowScanLog(sourceId, sourceName) {
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(11,15,26,.92);backdrop-filter:blur(6px);z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = '<div style="width:min(860px,96vw);max-height:92vh;overflow-y:auto;background:#0f172a;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:22px;color:#e2e8f0;font-family:Geologica,sans-serif">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    + '<h3 style="margin:0;font-size:15px">📋 Лог сканування: ' + gfE(sourceName) + '</h3>'
    + '<div style="display:flex;gap:8px">'
    + '<button id="gfLogCopyBtn" style="background:#1e293b;border:1px solid rgba(255,255,255,.1);color:#94a3b8;border-radius:8px;padding:5px 12px;cursor:pointer;font-size:11px">📋 Копіювати лог</button>'
    + '<button onclick="this.closest(\'[style*=position\\\\:fixed]\').remove()" style="background:#ef4444;border:none;color:#fff;border-radius:8px;padding:5px 12px;cursor:pointer;font-weight:700">✕</button>'
    + '</div></div>'
    + '<div id="gfLogBody" style="font-size:12px">Завантаження…</div></div>';
  document.body.appendChild(modal);

  try {
    var snap = await db.collection('gf_scan_logs')
      .where('source_id','==',sourceId)
      .orderBy('scanned_at','desc')
      .limit(30).get();

    var body = document.getElementById('gfLogBody');
    if (!body) return;

    var logDocs = [];
    if (snap.empty) {
      // Fallback: last_scan_log з документа джерела
      var srcSnap = await db.collection('gf_sources').doc(sourceId).get();
      var srcData = srcSnap.exists ? srcSnap.data() : {};
      var ll = srcData.last_scan_log;
      if (!ll) {
        body.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px">Лог ще порожній. Дані з\'являться після наступного сканування.</div>';
        return;
      }
      logDocs = [ll];
    } else {
      logDocs = snap.docs.map(function(d){ return d.data(); });
    }

    // Кнопка "Копіювати лог"
    var copyBtn = document.getElementById('gfLogCopyBtn');
    if (copyBtn) {
      copyBtn.onclick = function() {
        var txt = logDocs.map(function(l){
          return ['=== ' + (l.scanned_at||'').slice(0,16).replace('T',' ') + ' | ' + (l.status||'') + ' ===',
                  'Знайдено: '+(l.raw_found||0)+' | Фільтр: '+(l.after_filter||0)+' | Нових: '+(l.created||0)+' | Дублів: '+(l.dupes||0),
                  l.error ? '❌ ПОМИЛКА: ' + l.error : '',
                  (l.diag_warnings||[]).length ? 'Попередження:\n' + l.diag_warnings.join('\n') : '',
                  (l.diag_steps||[]).length ? 'Кроки:\n' + l.diag_steps.map(function(s){return '['+s.ts+'] '+s.step+': '+JSON.stringify(s);}).join('\n') : ''
          ].filter(Boolean).join('\n');
        }).join('\n\n');
        navigator.clipboard.writeText(txt).then(function(){
          copyBtn.textContent = '✓ Скопійовано'; setTimeout(function(){copyBtn.textContent='📋 Копіювати лог';},2000);
        });
      };
    }

    var rows = '';
    logDocs.forEach(function(l) {
      var st = l.status || '';
      var stColor  = st==='ok_new'?'#10b981':st==='ok_dupes'?'#4f6ef7':st==='filtered'?'#f59e0b':st==='error'?'#ef4444':'#64748b';
      var stIcon   = st==='ok_new'?'✅':st==='ok_dupes'?'♻️':st==='filtered'?'⚠️':st==='error'?'❌':st==='empty'?'📭':'—';
      var stLabel  = st==='ok_new'?'Нові записи':st==='ok_dupes'?'Лише дублікати':st==='filtered'?'Відфільтровано':st==='error'?'Помилка':st==='empty'?'Порожня відповідь':'—';

      // ── Діагностичні кроки ──
      var diagHtml = '';
      if (l.diag_steps && l.diag_steps.length) {
        diagHtml += '<details style="margin-top:10px"><summary style="font-size:10px;font-weight:700;color:#64748b;cursor:pointer;text-transform:uppercase;letter-spacing:.5px">Кроки діагностики (' + l.diag_steps.length + ')</summary>'
          + '<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,.06);padding-top:6px">';
        l.diag_steps.forEach(function(step) {
          var isErr  = step.step === 'parse_error' || step.step === 'multi_grant_error';
          var isDone = step.step === 'result';
          var stepColor = isErr ? '#ef4444' : isDone ? '#10b981' : '#94a3b8';
          var stepData = Object.assign({}, step);
          delete stepData.step; delete stepData.ts;
          diagHtml += '<div style="display:flex;gap:8px;margin-bottom:3px;font-size:10px">'
            + '<span style="color:#4f6ef7;min-width:115px;flex-shrink:0">[' + gfE(step.ts||'') + '] ' + gfE(step.step) + '</span>'
            + '<span style="color:' + stepColor + ';word-break:break-all">' + gfE(JSON.stringify(stepData).slice(0, 300)) + '</span>'
            + '</div>';
        });
        diagHtml += '</div></details>';
      }

      // ── Попередження / дублі ──
      var warnHtml = '';
      var warnings = l.diag_warnings || [];
      if (warnings.length) {
        var errWarn  = warnings.filter(function(w){ return w.startsWith('Fatal') || w.startsWith('Parse failed'); });
        var dupWarn  = warnings.filter(function(w){ return w.startsWith('dup_'); });
        var restWarn = warnings.filter(function(w){ return !w.startsWith('Fatal') && !w.startsWith('Parse failed') && !w.startsWith('dup_'); });

        warnHtml += '<div style="margin-top:8px">';
        if (errWarn.length) {
          warnHtml += '<div style="padding:8px;background:rgba(239,68,68,.1);border-radius:6px;margin-bottom:6px">'
            + '<div style="font-size:10px;font-weight:700;color:#ef4444;margin-bottom:4px">🚨 Критичні помилки (' + errWarn.length + ')</div>'
            + errWarn.map(function(w){return '<div style="font-size:10px;color:#fca5a5;word-break:break-all;margin-bottom:2px">' + gfE(w) + '</div>';}).join('')
            + '</div>';
        }
        if (dupWarn.length) {
          warnHtml += '<details style="margin-bottom:6px"><summary style="font-size:10px;font-weight:700;color:#64748b;cursor:pointer">Дублікати пропущено (' + dupWarn.length + ')</summary>'
            + '<div style="margin-top:4px;padding:6px 8px;background:rgba(255,255,255,.03);border-radius:6px">'
            + dupWarn.slice(0,30).map(function(w){return '<div style="font-size:10px;color:#64748b;word-break:break-all">' + gfE(w) + '</div>';}).join('')
            + (dupWarn.length > 30 ? '<div style="font-size:10px;color:#475569">…ще ' + (dupWarn.length-30) + '</div>' : '')
            + '</div></details>';
        }
        if (restWarn.length) {
          warnHtml += '<details><summary style="font-size:10px;font-weight:700;color:#f59e0b;cursor:pointer">⚠️ Інші попередження (' + restWarn.length + ')</summary>'
            + '<div style="margin-top:4px;padding:6px 8px;background:rgba(245,158,11,.06);border-radius:6px">'
            + restWarn.slice(0,20).map(function(w){return '<div style="font-size:10px;color:#94a3b8;word-break:break-all;margin-bottom:2px">' + gfE(w) + '</div>';}).join('')
            + '</div></details>';
        }
        warnHtml += '</div>';
      }

      rows += '<div style="border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px;margin-bottom:8px;background:rgba(255,255,255,.02)">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
        + '<span style="color:' + stColor + ';font-weight:700">' + stIcon + ' ' + stLabel + '</span>'
        + '<span style="color:#64748b;font-size:11px">' + (l.scanned_at||'').slice(0,16).replace('T',' ') + '</span>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px">'
        + gfLogCell('Знайдено',    l.raw_found||0,    '#94a3b8')
        + gfLogCell('Після фільтру', l.after_filter||0, '#94a3b8')
        + gfLogCell('Нових',       l.created||0,      l.created>0?'#10b981':'#94a3b8')
        + gfLogCell('Дублів',      l.dupes||0,        '#94a3b8')
        + gfLogCell('Деталі',      l.detailed||0,     '#64748b')
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;font-size:10px">'
        + '<span style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:4px">Парсер: ' + gfE(l.parser_mode||'—') + '</span>'
        + '<span style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:4px">Вікно: ' + gfE(l.window_days||7) + ' дн</span>'
        + (l.is_multi ? '<span style="background:rgba(79,110,247,.15);color:#4f6ef7;padding:2px 8px;border-radius:4px">Мульти-грант</span>' : '')
        + '</div>'
        + (l.error ? '<div style="margin-top:8px;padding:8px;background:rgba(239,68,68,.1);border-radius:6px;color:#ef4444;font-size:11px;word-break:break-all">❌ ' + gfE(l.error) + '</div>' : '')
        + diagHtml + warnHtml
        + '</div>';
    });

    body.innerHTML = rows || '<div style="color:#64748b;text-align:center;padding:20px">Немає записів.</div>';
  } catch(e) {
    var body2 = document.getElementById('gfLogBody');
    if (body2) body2.innerHTML = '<div style="color:#ef4444;padding:12px">Помилка завантаження лога: ' + gfE(e.message) + '<br><br>'
      + '<small style="color:#94a3b8">Перевірте: колекція <b>gf_scan_logs</b> повинна мати складений індекс Firestore:<br>'
      + 'Поля: <b>source_id (asc)</b> + <b>scanned_at (desc)</b></small></div>';
  }
}

function gfLogCell(label, val, color) {
  return '<div style="background:rgba(255,255,255,.04);border-radius:6px;padding:6px;text-align:center">'
    + '<div style="font-size:16px;font-weight:800;color:' + color + '">' + val + '</div>'
    + '<div style="font-size:10px;color:#64748b;margin-top:1px">' + label + '</div></div>';
}

/* ═══════════════════════════════════════════════════════════
   ПРИМУСОВЕ СКАНУВАННЯ ДЖЕРЕЛА
   ═══════════════════════════════════════════════════════════ */
async function gfForceScan(sourceId, sourceName) {
  // Знаходимо кнопку Скан для цього джерела
  var scanBtn = null;
  document.querySelectorAll('.gf-btn').forEach(function(b) {
    var oc = b.getAttribute('onclick') || '';
    if (oc.indexOf('gfForceScan') >= 0 && oc.indexOf(sourceId) >= 0) scanBtn = b;
  });
  if (scanBtn) { scanBtn.disabled = true; scanBtn.textContent = '⏳…'; }

  gfToast('🔄 Сканую: ' + sourceName + '…', '#4f6ef7');

  try {
    var CF_URL = 'https://us-central1-kontrol-pro.cloudfunctions.net/scanSource';
    var resp = await fetch(CF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: sourceId })
    });
    var result = await resp.json();

    if (result.error) {
      gfToast('❌ ' + result.error, '#ef4444');
    } else {
      var diag = result.diag || {};
      var warnings = (diag.warnings || []).filter(function(w){ return !w.startsWith('dup_'); });
      var msg = '✅ ' + sourceName + ': знайдено ' + (result.checked||0)
        + ', нових ' + (result.created||0)
        + ', дублів ' + (result.dupes||0)
        + (warnings.length ? ' ⚠️ ' + warnings.length + ' попереджень' : '');
      gfToast(msg, result.created > 0 ? '#10b981' : '#4f6ef7');
      await gfRefresh();
    }
  } catch(e) {
    gfToast('❌ Помилка: ' + e.message, '#ef4444');
  } finally {
    if (scanBtn) { scanBtn.disabled = false; scanBtn.textContent = '▶ Скан'; }
  }
}

/* ═══════════════════════════════════════════════════════════
   ACTIONS
   ═══════════════════════════════════════════════════════════ */
function gfSrcDoSearch() {
  GF.sourceSearch = (gfId('gfSrcSearch')||{}).value || '';
  gfRender();
}

async function gfAddSrcFromUrl() {
  var url  = (gfId('gfNewSrcUrl')||{}).value  || '';
  var name = (gfId('gfNewSrcName')||{}).value || '';
  if (!url.trim()) { alert('Введи URL'); return; }
  var isTg   = /t\.me/i.test(url);
  var isRss  = /\/feed|rss|\.xml/i.test(url);
  var isNews = /news\.google/i.test(url);
  if (!name) {
    var m = url.match(/https?:\/\/([^\/]+)/);
    name = m ? m[1].replace(/^www\./,'').replace(/^t\.me\/s\//,'TG: ').replace(/^t\.me\//,'TG: ') : 'Нове джерело';
  }
  try {
    await gfSaveSource({
      source_name: name, source_url: url.trim(),
      source_type:  isTg ? 'telegram' : (isRss||isNews) ? 'rss' : 'page',
      parser_mode:  isTg ? 'telegram' : isNews ? 'google_news_rss' : isRss ? 'rss' : 'page_links',
      source_status: 'active', source_priority: 'high',
      item_limit: '20', first_scan_mode: 'true', fetch_details: 'true',
      found_count: 0
    });
    gfToast('Додано: ' + name, 'var(--green)');
    await gfRefresh(); gfGo('sources');
  } catch(e) { alert('Помилка: ' + e.message); }
}

async function gfAddFromCatalog(catalogId) {
  var c = GF_CATALOG.find(function(x) { return x.id === catalogId; });
  if (!c) return;
  try {
    await gfSaveSource({
      source_id: c.id, source_name: c.name, source_profile: c.id,
      source_url: c.url, source_type: c.type, parser_mode: c.parser,
      source_status: 'active', source_priority: 'high',
      item_limit: '20', first_scan_mode: 'true', fetch_details: 'true',
      source_keywords: 'грант,гранти,конкурс,можливість,фінансування',
      link_include: 'грант,конкурс,можливість,grant,funding',
      link_exclude: 'вакансія,job,about,contact,login,privacy',
      geography_hint: 'Вся Україна, Громади',
      applicants_hint: 'ОМС, Громадські організації, Заклади освіти',
      found_count: 0
    });
    gfToast('Додано: ' + c.name, 'var(--green)');
    await gfRefresh();
  } catch(e) { alert('Помилка: ' + e.message); }
}

async function gfBulkAddAll() {
  if (!confirm('Додати ВСІ ' + GF_CATALOG.length + ' джерел? Вже додані будуть пропущені.')) return;
  var existing     = (GF.data.sources||[]).map(function(s){ return (s.source_profile||'').toLowerCase(); });
  var existingUrls = (GF.data.sources||[]).map(function(s){ return (s.source_url||'').toLowerCase().replace(/\/+$/,''); });
  var added = 0, skipped = 0;
  try {
    for (var i = 0; i < GF_CATALOG.length; i++) {
      var c = GF_CATALOG[i];
      if (existing.indexOf(c.id.toLowerCase()) >= 0 || existingUrls.indexOf(c.url.toLowerCase().replace(/\/+$/,'')) >= 0) {
        skipped++; continue;
      }
      await gfSaveSource({
        source_id: c.id, source_name: c.name, source_profile: c.id,
        source_url: c.url, source_type: c.type, parser_mode: c.parser,
        source_status: 'active', source_priority: 'high',
        item_limit: '20', first_scan_mode: 'true', fetch_details: 'true',
        source_keywords: 'грант,гранти,конкурс,можливість,фінансування',
        link_include: 'грант,конкурс,можливість,grant,funding',
        link_exclude: 'вакансія,job,about,contact,login,privacy',
        geography_hint: 'Вся Україна, Громади',
        applicants_hint: 'ОМС, Громадські організації, Заклади освіти',
        found_count: 0
      });
      added++;
    }
    gfToast('Додано: ' + added + ', пропущено: ' + skipped, 'var(--green)');
    await gfRefresh(); GF.sourceView = 'active'; gfGo('sources');
  } catch(e) { alert('Помилка: ' + e.message); }
}

async function gfTogglePause(id) {
  var src = (GF.data.sources||[]).find(function(s){ return (s._id||s.source_id) === id; });
  if (!src) return;
  var newSt = src.source_status === 'active' ? 'paused' : 'active';
  try {
    await gfUpd(GFC.sources, id, { source_status: newSt });
    src.source_status = newSt;
    gfToast(src.source_name + ': ' + (newSt === 'active' ? 'Увімкнено' : 'Призупинено'));
    gfRender();
  } catch(e) { alert(e.message); }
}

async function gfArchiveSrc(id) {
  var reason = prompt('Причина архівації:', '');
  if (!reason) return;
  try {
    await gfArchiveSource(id, reason);
    gfToast('Архівовано', 'var(--red)');
    await gfRefresh();
  } catch(e) { alert(e.message); }
}

/* ── Статус-бейдж останнього сканування ── */
function gfSrcLogBadge(s) {
  var ll = s.last_scan_log || {};
  var st = ll.status || '';
  if (!st) return '';
  var color = st==='ok_new'    ? 'var(--green)'
            : st==='ok_dupes'  ? 'var(--accent)'
            : st==='filtered'  ? 'var(--yellow)'
            : st==='error'     ? 'var(--red)'
            : 'var(--muted)';
  var icon = st==='ok_new'   ? '✅ +' + (ll.created||0)
           : st==='ok_dupes' ? '♻️ дублі'
           : st==='filtered' ? '⚠️ 0'
           : st==='error'    ? '❌'
           : st==='empty'    ? '📭' : '—';
  return '<span style="color:' + color + '" title="' + gfE(ll.error||st) + '">' + icon + '</span>';
}

/* ── Discover: допоміжні функції ── */
function gfDiscoverOpen(url) { window.open(url, '_blank'); }

function gfDiscoverDismiss(host) {
  var d = JSON.parse(localStorage.getItem('gf_discover_dismissed')||'[]');
  if (d.indexOf(host) < 0) d.push(host);
  localStorage.setItem('gf_discover_dismissed', JSON.stringify(d));
  gfRender();
}

async function gfDiscoverAdd(host, url, suggestName) {
  var isTg = host.startsWith('telegram:');
  var name = suggestName || (isTg ? 'TG: ' + host.replace('telegram:','') : host);
  try {
    await gfSaveSource({
      source_name: name, source_url: url,
      source_type: isTg ? 'telegram' : 'page',
      parser_mode: isTg ? 'telegram' : 'page_links',
      source_status: 'active', source_priority: 'medium',
      item_limit: '10', scan_window_days: '7', scan_interval_min: '30',
      fetch_details: 'true', found_count: 0
    });
    await gfRefresh();
    var newSrc = (GF.data.sources||[]).find(function(s){
      return (s.source_url||'').toLowerCase().replace(/\/+$/,'') === url.toLowerCase().replace(/\/+$/,'');
    });
    if (newSrc) setTimeout(function(){ gfOpenSourceForm(newSrc._id||newSrc.source_id); }, 300);
    gfToast('Додано — відредагуй налаштування', 'var(--green)');
  } catch(e) { alert('Помилка: ' + e.message); }
}

/* ── Делегування для discover-кнопок ── */
function gfWireSources() {
  var content = gfId('gfContent');
  if (!content) return;
  // Переконуємося що не додаємо дублі
  if (content._gfSourcesWired) return;
  content._gfSourcesWired = true;

  content.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.discOpen)       { window.open(btn.dataset.discOpen, '_blank'); return; }
    if (btn.dataset.discHost)       { gfDiscoverAdd(btn.dataset.discHost, btn.dataset.discUrl, btn.dataset.discName); return; }
    if (btn.dataset.discDismiss)    { gfDiscoverDismiss(btn.dataset.discDismiss); return; }
    if (btn.dataset.discRestoreOne) {
      var d = JSON.parse(localStorage.getItem('gf_discover_dismissed')||'[]');
      var idx = d.indexOf(btn.dataset.discRestoreOne);
      if (idx >= 0) { d.splice(idx, 1); localStorage.setItem('gf_discover_dismissed', JSON.stringify(d)); gfRender(); }
      return;
    }
    if (btn.hasAttribute('data-disc-restore')) { localStorage.removeItem('gf_discover_dismissed'); gfRender(); return; }
  });
}
