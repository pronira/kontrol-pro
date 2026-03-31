/* ═══════════════════════════════════════════════════════════
   gf-sources.js v2 — Джерела + Каталог 24 готових джерел
   ═══════════════════════════════════════════════════════════ */

/* ── Каталог перевірених джерел ── */
var GF_CATALOG=[
  /* Сайти-агрегатори */
  {cat:'Сайти-агрегатори',id:'gurt_rss',name:'ГУРТ (RSS)',url:'https://gurt.org.ua/grants/feed/',type:'rss',parser:'rss',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'prostir_feed',name:'Prostir (RSS)',url:'https://prostir.ua/grants/feed/',type:'rss',parser:'rss',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'getgrant_page',name:'GetGrant',url:'https://getgrant.com.ua/grants/',type:'page',parser:'page_links',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'grant_market',name:'Grant.Market',url:'https://grant.market/grants',type:'page',parser:'page_links',ico:'🌐'},
  {cat:'Сайти-агрегатори',id:'granty_org_ua',name:'Granty.org.ua',url:'https://granty.org.ua/',type:'page',parser:'page_links',ico:'🌐'},
  /* Telegram канали */
  {cat:'Telegram канали',id:'tg_grantovyphishky',name:'Грантові фішки',url:'https://t.me/s/grantovyphishky',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_gurtrc',name:'ГУРТ',url:'https://t.me/s/gaborets',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_prostirua',name:'Простір',url:'https://t.me/s/prostir_ua',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grant_market',name:'Grant.Market',url:'https://t.me/s/grant_market',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grants_here',name:'Гранти та можливості',url:'https://t.me/s/grants_here',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grantsua',name:'Гранти UA',url:'https://t.me/s/grantsua',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grantup',name:'GrantUP',url:'https://t.me/s/grantup',type:'telegram',parser:'telegram',ico:'📱'},
  {cat:'Telegram канали',id:'tg_grantovyphishky_eu',name:'Грантові фішки ЄС',url:'https://t.me/s/grantovyphishky_eu',type:'telegram',parser:'telegram',ico:'📱'},
  /* Міжнародні донори */
  {cat:'Міжнародні донори',id:'undp_ukraine',name:'UNDP Ukraine',url:'https://www.undp.org/ukraine/grants',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'house_of_europe',name:'House of Europe',url:'https://houseofeurope.org.ua/opportunities',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'eef_grants',name:'Фонд Сх. Європа',url:'https://eef.org.ua/programs/',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'ednannia_grants',name:'ІСАР Єднання',url:'https://ednannia.ua/grants',type:'page',parser:'page_links',ico:'🏛'},
  {cat:'Міжнародні донори',id:'diia_business',name:'Дія.Бізнес',url:'https://business.diia.gov.ua/cases/grant',type:'page',parser:'page_links',ico:'🏛'},
  /* Google News RSS */
  {cat:'Google News',id:'google_news_grants_ua',name:'Гранти Україна',url:'https://news.google.com/rss/search?q=гранти+Україна&hl=uk&gl=UA&ceid=UA:uk',type:'rss',parser:'google_news_rss',ico:'📰'},
  {cat:'Google News',id:'google_news_grants_hromady',name:'Гранти громади',url:'https://news.google.com/rss/search?q=гранти+для+громад&hl=uk&gl=UA&ceid=UA:uk',type:'rss',parser:'google_news_rss',ico:'📰'},
  /* Міжнародні */
  {cat:'Міжнародні RSS',id:'fundsforngos_ukraine',name:'FundsforNGOs',url:'https://www2.fundsforngos.org/tag/ukraine/feed/',type:'rss',parser:'rss',ico:'🌍'},
  {cat:'Міжнародні RSS',id:'reliefweb_ukraine',name:'ReliefWeb UA',url:'https://reliefweb.int/updates/rss?country=254',type:'rss',parser:'rss',ico:'🌍'},
  /* Додаткові */
  {cat:'Додаткові',id:'ucf_news',name:'УКФ (Укр. культурний фонд)',url:'https://ucf.in.ua/programs',type:'page',parser:'page_links',ico:'🎭'},
  {cat:'Додаткові',id:'grant_av',name:'Грант АВ',url:'https://grant.av.ua/',type:'page',parser:'page_links',ico:'🌐'}
];

/* ── Main view ── */
function gfViewSources(){
  var src=GF.data.sources||[];
  var arch=GF.data.archive||[];
  var active=src.filter(function(s){return s.source_status==='active';});
  var paused=src.filter(function(s){return s.source_status!=='active';});

  var view=GF.sourceView||'active';
  var tabs=[
    ['active','Активні',active.length],['paused','Призупинені',paused.length],
    ['catalog','📚 Каталог',GF_CATALOG.length],['archive','Архів',arch.length]
  ];
  var th='<div class="gf-tabs">';
  tabs.forEach(function(t){
    th+='<button'+(view===t[0]?' class="active"':'')+' onclick="GF.sourceView=\''+t[0]+'\';gfRender()">'+gfE(t[1])+' ('+t[2]+')</button>';
  });
  th+='</div>';

  if(view==='catalog') return gfViewCatalog(th,src);

  /* Quick add from URL */
  var addH='<div style="margin-bottom:12px;padding:14px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r)">'
    +'<div style="font-size:12px;font-weight:600;margin-bottom:8px">Швидке додавання</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end">'
    +'<div class="gf-field" style="margin:0"><label>URL джерела</label><input id="gfNewSrcUrl" placeholder="https://t.me/s/channel"></div>'
    +'<div class="gf-field" style="margin:0"><label>Назва (необов\'язково)</label><input id="gfNewSrcName" placeholder="авто з URL"></div>'
    +'<button class="gf-btn" onclick="gfAddSrcFromUrl()" style="margin-bottom:1px">+ Додати</button>'
    +'</div></div>';

  /* Search */
  var sq=(GF.sourceSearch||'').toLowerCase();
  var searchH='<div class="gf-search">'
    +'<input id="gfSrcSearch" placeholder="Пошук джерел…" value="'+gfE(sq)+'" onkeydown="if(event.keyCode===13)gfSrcDoSearch()">'
    +'<button class="gf-btn sm" onclick="gfSrcDoSearch()">🔍</button>'
    +(sq?'<button class="gf-btn sm o" onclick="GF.sourceSearch=\'\';gfRender()">✕</button>':'')
    +'</div>';

  var current=view==='paused'?paused:view==='archive'?arch:active;
  if(sq){
    current=current.filter(function(s){
      return[s.source_name,s.source_url,s.source_type,s.source_topics,s.notes].join(' ').toLowerCase().indexOf(sq)>=0;
    });
  }

  var listH;
  if(!current.length){
    listH='<div class="gf-empty">'+(view==='active'?'Немає активних джерел. Перейдіть на вкладку <b>📚 Каталог</b> щоб додати перевірені джерела.':'Немає джерел.')+'</div>';
  } else {
    listH='<div class="gf-list">';
    current.forEach(function(s){
      var ico=/telegram/i.test(s.source_type||'')?'📱 ':/rss/i.test(s.source_type||'')?'📡 ':/google_news/i.test(s.parser_mode||'')?'📰 ':'🌐 ';
      var stBadge=s.source_status==='active'?'<span class="gf-badge green">Активне</span>':'<span class="gf-badge gray">Пауза</span>';
      var pCls=s.source_priority==='critical'?'red':s.source_priority==='high'?'green':s.source_priority==='medium'?'yellow':'gray';
      var prioBadge='<span class="gf-badge '+pCls+'">'+gfE(s.source_priority||'—')+'</span>';

      listH+='<div class="gf-item"><div class="gf-item-head">'
        +'<h3>'+ico+gfE(s.source_name||'?')+'</h3>'
        +'<div style="display:flex;gap:4px">'+stBadge+prioBadge+'</div></div>'
        +'<div class="gf-item-meta">'
        +'<span>'+gfE(s.source_type||'')+'</span>'
        +'<span>'+gfE(s.parser_mode||'')+'</span>'
        +'<span>Знайдено: '+(s.found_count||0)+'</span>'
        +(s.last_checked_at?'<span>Перевірено: '+gfE((s.last_checked_at||'').slice(0,16))+'</span>':'')
        +(s.source_topics?'<span>'+gfE(s.source_topics)+'</span>':'')
        +'</div>'
        +'<div class="gf-muted" style="font-size:11px;word-break:break-all;margin-top:4px">'+gfE(s.source_url||'')+'</div>';

      if(view==='archive'){
        listH+='<div class="gf-notice" style="margin-top:8px;font-size:11px">'+gfE(s.archive_reason||'')+'</div>';
      } else {
        listH+='<div class="gf-item-acts">'
          +(s.source_url?'<button class="gf-btn sm o" onclick="window.open(\''+gfE(s.source_url)+'\',\'_blank\')">↗ Відкрити</button>':'')
          +'<button class="gf-btn sm o" onclick="gfOpenSourceForm(\''+gfE(s._id||s.source_id)+'\')">✏️</button>'
          +'<button class="gf-btn sm o" onclick="gfTogglePause(\''+gfE(s._id||s.source_id)+'\')">'+(s.source_status==='active'?'⏸':'▶')+'</button>'
          +'<button class="gf-btn sm r" onclick="gfArchiveSrc(\''+gfE(s._id||s.source_id)+'\')">🗑</button>'
          +'</div>';
      }
      listH+='</div>';
    });
    listH+='</div>';
  }

  return '<div class="gf-panel"><div class="gf-panel-h"><h3>Джерела</h3><div style="display:flex;gap:6px"><span class="gf-badge blue">'+src.length+'</span><button class="gf-btn sm" onclick="gfOpenSourceForm()">+ Нове</button></div></div>'
    +th+(view!=='archive'?addH:'')+searchH+listH+'</div>';
}

/* ── Каталог ── */
function gfViewCatalog(tabsH,existingSrc){
  var existingIds=existingSrc.map(function(s){return(s.source_profile||s.source_name||'').toLowerCase();});
  var existingUrls=existingSrc.map(function(s){return(s.source_url||'').toLowerCase().replace(/\/+$/,'');});

  function isAdded(c){
    return existingIds.indexOf(c.id.toLowerCase())>=0 ||
           existingUrls.indexOf(c.url.toLowerCase().replace(/\/+$/,''))>=0 ||
           existingSrc.some(function(s){return(s.source_name||'').toLowerCase()===c.name.toLowerCase();});
  }

  var cats={};
  GF_CATALOG.forEach(function(c){if(!cats[c.cat])cats[c.cat]=[];cats[c.cat].push(c);});
  var addedCnt=GF_CATALOG.filter(isAdded).length;

  var h='<div class="gf-panel"><div class="gf-panel-h"><h3>Каталог перевірених джерел</h3>'
    +'<div style="display:flex;gap:6px"><span class="gf-badge blue">'+addedCnt+' / '+GF_CATALOG.length+' додано</span>'
    +'<button class="gf-btn sm" onclick="gfBulkAddAll()">Додати ВСІ</button></div></div>'
    +tabsH
    +'<div class="gf-ok" style="margin-bottom:14px"><b>'+GF_CATALOG.length+' перевірених джерел.</b> Натисніть «Додати» для окремих або «Додати ВСІ» для всіх одразу. Вже додані позначені ✓.</div>';

  Object.keys(cats).forEach(function(cat){
    var items=cats[cat];
    var catIcon=cat.indexOf('Telegram')>=0?'📱':cat.indexOf('Google')>=0?'📰':cat.indexOf('Міжнародні донори')>=0?'🏛':cat.indexOf('Міжнародні RSS')>=0?'🌍':'🌐';
    h+='<div style="margin-bottom:16px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">'
      +'<span style="font-size:16px">'+catIcon+'</span>'
      +'<span style="font-size:13px;font-weight:700">'+gfE(cat)+'</span>'
      +'<span class="gf-badge gray">'+items.length+'</span></div>'
      +'<div class="gf-list" style="gap:6px">';

    items.forEach(function(c){
      var added=isAdded(c);
      h+='<div class="gf-item" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px;'+(added?'opacity:.6':'')+'"><div style="flex:1;min-width:0">'
        +'<div style="font-size:13px;font-weight:600">'+c.ico+' '+gfE(c.name)+'</div>'
        +'<div class="gf-muted" style="font-size:10px;word-break:break-all;margin-top:2px">'+gfE(c.url.slice(0,70))+'</div>'
        +'</div><div>'
        +(added?'<span class="gf-badge green">✓ Додано</span>':'<button class="gf-btn sm" onclick="gfAddFromCatalog(\''+gfE(c.id)+'\')">+ Додати</button>')
        +'</div></div>';
    });
    h+='</div></div>';
  });

  return h+'</div>';
}

/* ── Actions ── */
function gfSrcDoSearch(){
  GF.sourceSearch=(gfId('gfSrcSearch')||{}).value||'';
  gfRender();
}

async function gfAddSrcFromUrl(){
  var url=(gfId('gfNewSrcUrl')||{}).value||'';
  var name=(gfId('gfNewSrcName')||{}).value||'';
  if(!url.trim()){alert('Введи URL');return;}
  var isTg=/t\.me/i.test(url);
  var isRss=/\/feed|rss|\.xml/i.test(url);
  var isNews=/news\.google/i.test(url);
  if(!name){
    var m=url.match(/https?:\/\/([^\/]+)/);
    name=m?m[1].replace(/^www\./,'').replace(/^t\.me\/s\//,'TG: ').replace(/^t\.me\//,'TG: '):'Нове джерело';
  }
  try{
    await gfSaveSource({
      source_name:name, source_url:url.trim(),
      source_type:isTg?'telegram':isRss||isNews?'rss':'page',
      parser_mode:isTg?'telegram':isNews?'google_news_rss':isRss?'rss':'page_links',
      source_status:'active', source_priority:'high',
      item_limit:'20', first_scan_mode:'true', fetch_details:'true',
      found_count:0
    });
    gfToast('Додано: '+name,'var(--green)');
    await gfRefresh(); gfGo('sources');
  }catch(e){alert('Помилка: '+e.message);}
}

async function gfAddFromCatalog(catalogId){
  var c=GF_CATALOG.find(function(x){return x.id===catalogId;});
  if(!c)return;
  try{
    await gfSaveSource({
      source_id:c.id, source_name:c.name, source_profile:c.id,
      source_url:c.url, source_type:c.type, parser_mode:c.parser,
      source_status:'active', source_priority:'high',
      item_limit:'20', first_scan_mode:'true', fetch_details:'true',
      source_keywords:'грант,гранти,конкурс,можливість,фінансування',
      link_include:'грант,конкурс,можливість,grant,funding',
      link_exclude:'вакансія,job,about,contact,login,privacy',
      geography_hint:'Вся Україна, Громади',
      applicants_hint:'ОМС, Громадські організації, Заклади освіти',
      found_count:0
    });
    gfToast('Додано: '+c.name,'var(--green)');
    await gfRefresh();
  }catch(e){alert('Помилка: '+e.message);}
}

async function gfBulkAddAll(){
  if(!confirm('Додати ВСІ '+GF_CATALOG.length+' джерел? Вже додані будуть пропущені.'))return;
  var existing=(GF.data.sources||[]).map(function(s){return(s.source_profile||'').toLowerCase();});
  var existingUrls=(GF.data.sources||[]).map(function(s){return(s.source_url||'').toLowerCase().replace(/\/+$/,'');});
  var added=0,skipped=0;
  try{
    for(var i=0;i<GF_CATALOG.length;i++){
      var c=GF_CATALOG[i];
      if(existing.indexOf(c.id.toLowerCase())>=0||existingUrls.indexOf(c.url.toLowerCase().replace(/\/+$/,''))>=0){skipped++;continue;}
      await gfSaveSource({
        source_id:c.id, source_name:c.name, source_profile:c.id,
        source_url:c.url, source_type:c.type, parser_mode:c.parser,
        source_status:'active', source_priority:'high',
        item_limit:'20', first_scan_mode:'true', fetch_details:'true',
        source_keywords:'грант,гранти,конкурс,можливість,фінансування',
        link_include:'грант,конкурс,можливість,grant,funding',
        link_exclude:'вакансія,job,about,contact,login,privacy',
        geography_hint:'Вся Україна, Громади',
        applicants_hint:'ОМС, Громадські організації, Заклади освіти',
        found_count:0
      });
      added++;
    }
    gfToast('Додано: '+added+', пропущено: '+skipped,'var(--green)');
    await gfRefresh(); GF.sourceView='active'; gfGo('sources');
  }catch(e){alert('Помилка: '+e.message);}
}

async function gfTogglePause(id){
  var src=(GF.data.sources||[]).find(function(s){return(s._id||s.source_id)===id;});
  if(!src)return;
  var newSt=src.source_status==='active'?'paused':'active';
  try{
    await gfUpd(GFC.sources,id,{source_status:newSt});
    src.source_status=newSt;
    gfToast(src.source_name+': '+(newSt==='active'?'Увімкнено':'Призупинено'));
    gfRender();
  }catch(e){alert(e.message);}
}

async function gfArchiveSrc(id){
  var reason=prompt('Причина архівації:','');
  if(!reason)return;
  try{
    await gfArchiveSource(id,reason);
    gfToast('Архівовано','var(--red)');
    await gfRefresh();
  }catch(e){alert(e.message);}
}

function gfWireSources(){}
