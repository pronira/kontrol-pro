/**
 * GrantFlow ScanEngine v5
 * ЗМІНИ vs v4:
 * 1. maxNew тепер читається з src.item_limit (дефолт 10, макс 30) — було хардкодовано 3!
 * 2. window_days — фільтрація за датою публікації (ігноруємо старіші за вікно)
 * 3. parsePageLinks: враховує link_include/link_exclude, семантичні теги article/h2/h3
 * 4. parseRSS: підтримка Atom-feeds, нормалізація Atom link object
 * 5. Google News RSS: очищення заголовку від " - Назва джерела"
 * 6. parseTelegram: збирає ВСІ зовнішні URL, не тільки перший; заголовок 300 знаків
 * 7. fetchDetailPage: таймаут 8с, більше CSS-селекторів, 6000 знаків тексту
 * 8. Дедуп: нормалізація URL (без query string), дедуп по title тільки без URL
 * 9. classify: більше донорів, тематик, заявників; покращений extractDeadline
 * 10. passesFilter: враховує source_keywords якщо задані
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');

const COL = { sources:'gf_sources', detected:'gf_detected', scanIdx:'gf_scan_index' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

// ══════ ФІЛЬТРИ ══════
const GRANT_WORDS = [
  'грант','гранти','конкурс','програм','фінансуван','підтримк','можливіст',
  'заявк','відбір','стипенді','субгрант','мікрогрант',
  'grant','grants','funding','call','application','opportunity','fellowship',
  'scholarship','support','program','відновлен','реконструкц','розвиток',
  'проєкт','проект','ініціатив','допомог','обладнан','deadline','дедлайн',
  'тендер','замовлен','відкрит','оголошен','запрошу'
];
const SPAM = [
  'вакансія','вакансії','job','jobs','career','hiring','vacancy',
  'купити','продаж','казино','ставки','кредит','порно',
  'login','logout','register','signup','cookie','privacy policy'
];
const BAD_TITLE = [
  /^\[?email\s*protected\]?/i, /^mailto:/i, /^https?:\/\//i,
  /^@/, /^\d+$/, /^[\s\W]+$/, /^(головна|контакти|про нас|about|home|menu|#|javascript|undefined|null)/i,
  /cloudflare/i, /captcha/i, /404|not found/i, /access denied/i
];

function passesFilter(title, desc, src) {
  if (!title || title.length < 10) return false;
  if (BAD_TITLE.some(function(re) { return re.test(title.trim()); })) return false;
  if (title.trim().split(/\s+/).length < 2) return false;
  var hay = (title + ' ' + (desc||'')).toLowerCase();
  if (SPAM.some(function(w) { return hay.indexOf(w) >= 0; })) return false;
  // Перевіряємо ключові слова джерела якщо задані
  var kw = (src && src.source_keywords) ? src.source_keywords.toLowerCase().split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
  if (kw.length > 0) {
    return kw.some(function(w) { return hay.indexOf(w) >= 0; });
  }
  if (GRANT_WORDS.some(function(w) { return hay.indexOf(w) >= 0; })) return true;
  return true; // м'який — пропускаємо якщо з тематичного каналу
}

// ══════ ДЕДЛАЙН ══════
const MONTHS_MAP = {
  'січня':'01','лютого':'02','березня':'03','квітня':'04','травня':'05','червня':'06',
  'липня':'07','серпня':'08','вересня':'09','жовтня':'10','листопада':'11','грудня':'12',
  'січень':'01','лютий':'02','березень':'03','квітень':'04','травень':'05','червень':'06',
  'липень':'07','серпень':'08','вересень':'09','жовтень':'10','листопад':'11','грудень':'12',
  'january':'01','february':'02','march':'03','april':'04','may':'05','june':'06',
  'july':'07','august':'08','september':'09','october':'10','november':'11','december':'12',
  'jan':'01','feb':'02','mar':'03','apr':'04','may':'05','jun':'06',
  'jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12'
};
const ALL_MONTH_NAMES = Object.keys(MONTHS_MAP).join('|');

function extractDeadline(text) {
  var ctx = text;
  var ctxMatch = text.match(/(?:дедлайн|deadline|термін|до|until|before|by|closes?|closing|прийом до|подати до|кінцев\w+ дат|прийнят\w+ до)[:\s\-\u2013\u2014]*(.{5,80})/i);
  if (ctxMatch) ctx = ctxMatch[1];

  var m;
  m = ctx.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](20\d{2})/);
  if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  m = ctx.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  var re1 = new RegExp('(\\d{1,2})[\\s\\-\\.]+(' + ALL_MONTH_NAMES + ')[\\s\\-\\.,]+(20\\d{2})', 'i');
  m = ctx.match(re1);
  if (m) return m[3]+'-'+(MONTHS_MAP[m[2].toLowerCase()]||'01')+'-'+m[1].padStart(2,'0');
  var re2 = new RegExp('(' + ALL_MONTH_NAMES + ')[\\s\\-\\.]+?(\\d{1,2})[\\s,]+(20\\d{2})', 'i');
  m = ctx.match(re2);
  if (m) return m[3]+'-'+(MONTHS_MAP[m[1].toLowerCase()]||'01')+'-'+m[2].padStart(2,'0');

  if (ctx !== text) {
    m = text.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](20\d{2})/);
    if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    m = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = text.match(re1);
    if (m) return m[3]+'-'+(MONTHS_MAP[m[2].toLowerCase()]||'01')+'-'+m[1].padStart(2,'0');
    m = text.match(re2);
    if (m) return m[3]+'-'+(MONTHS_MAP[m[1].toLowerCase()]||'01')+'-'+m[2].padStart(2,'0');
  }
  return '';
}

// ══════ СУМА ══════
function extractAmount(text) {
  var patterns = [
    /(?:до|up to|max|maximum|максимум|розмір\w*)\s*[\$\u20ac\u00a3]?\s*([\d\s,\.]+)\s*(?:тис\.?|млн\.?|thousand|million|грн|USD|EUR|тисяч|мільйон)?/i,
    /[\$\u20ac\u00a3]\s*([\d\s,\.]+)(?:\s*(?:тис\.?|млн\.?|thousand|million))?/i,
    /([\d\s,\.]+)\s*(?:грн|гривень|USD|EUR|доларів|євро|dollars|euros)/i,
    /грант(?:ова сума|у розмірі)[:\s]+([\d\s,\.]+)/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) return m[0].trim().replace(/\s+/g,' ').slice(0, 100);
  }
  return '';
}

// ══════ КЛАСИФІКАТОРИ ══════
const DONORS = [
  [/USAID/i,'USAID'],[/UNDP/i,'UNDP'],[/UNICEF/i,'UNICEF'],
  [/\bEU\b|Євросоюз|Европейськ\w+ Союз|European Union/i,'EU'],
  [/GIZ/i,'GIZ'],[/IREX/i,'IREX'],[/Erasmus/i,'Erasmus+'],
  [/House of Europe/i,'House of Europe'],[/British Council/i,'British Council'],
  [/SIDA|Швеці/i,'SIDA'],[/Світовий банк|World Bank/i,'World Bank'],
  [/ЄБРР|EBRD/i,'EBRD'],[/UNESCO|ЮНЕСКО/i,'UNESCO'],
  [/UNHCR/i,'UNHCR'],[/IOM|МОМ/i,'IOM'],
  [/Червон\w+ Хрест|Red Cross|IFRC/i,'Червоний Хрест'],
  [/Карітас|Caritas/i,'Карітас'],[/ГУРТ|GURT/i,'ГУРТ'],
  [/ІСАР|Єднання|ISAR/i,'ІСАР Єднання'],
  [/Фонд Сх\w* Євр|EEF/i,'Фонд Східна Європа'],
  [/NED\b/i,'NED'],[/NDI\b/i,'NDI'],[/Pact\b/i,'Pact'],
  [/Open Society|Відродження/i,'Open Society'],
  [/Mercy Corps/i,'Mercy Corps'],[/ACTED/i,'ACTED'],
  [/People in Need|PIN\b/i,'People in Need'],
  [/UKF|УКФ|Укр[а-я]+ культурний фонд/i,'УКФ'],
  [/Дія\.?[Бб]ізнес|Diia/i,'Дія'],[/КМУ|Кабінет Міністрів/i,'КМУ'],
  [/OSCE|ОБСЄ/i,'ОБСЄ'],[/Council of Europe|Рада Європи/i,'Рада Європи'],
  [/JICA/i,'JICA'],[/DOBRE/i,'DOBRE'],[/U-LEAD/i,'U-LEAD'],
  [/Heinrich B/i,'Heinrich Böll'],[/Konrad Adenauer/i,'Konrad Adenauer'],
  [/Prostir|Простір UA/i,'Простір UA'],[/GetGrant/i,'GetGrant'],
  [/ReliefWeb/i,'ReliefWeb'],[/FundsforNGOs/i,'FundsforNGOs'],
  [/Представництво ЄС|EU Delegation/i,'Представництво ЄС в Україні']
];
const TOPICS = [
  [/освіт|школ|ліцей|навчан|education|training|teacher|вчител/i,'Освіта'],
  [/культур|мистецтв|бібліотек|музей|culture|creative/i,'Культура'],
  [/молод|youth|студент/i,'Молодь'],[/ветеран|veteran|захисник/i,'Ветерани'],
  [/ВПО|переселен|IDP|displaced/i,'ВПО/Переселенці'],
  [/жінк|гендер|gender|women|рівність/i,'Жінки/Гендер'],
  [/інклюзі|disability|інвалідн/i,'Інклюзія'],
  [/екологі|environment|клімат|climate/i,'Екологія'],
  [/здоров|медиц|health|амбулатор|лікарн/i,'Медицина'],
  [/цифров|digital|IT|технолог/i,'Цифровізація'],
  [/енерг|energy|утеплен|котельн|сонячн/i,'Енергоефективність'],
  [/інфраструктур|дорог|водопостачан|каналізац/i,'Інфраструктура'],
  [/соціальн|social|захист/i,'Соціальний захист'],
  [/підприємн|бізнес|business|entrepreneur|стартап/i,'Підприємництво'],
  [/громад|community|hromada|ОМС|місцев|самоврядув/i,'Громади'],
  [/відновлен|відбудов|reconstruction|recovery/i,'Відновлення'],
  [/правозахист|human rights|демократ/i,'Правозахист'],
  [/гуманітарн|humanitarian/i,'Гуманітарна допомога'],
  [/агро|сільськ\w+ господ|agricultur|фермер/i,'Агро'],
  [/психо|mental health|травм/i,'Психосоціальна підтримка'],
  [/медіа|media|журналіст/i,'Медіа'],
  [/спорт|sport|physical/i,'Спорт'],
  [/туризм|tourism/i,'Туризм']
];
const APPLICANTS = [
  [/громадськ\w+ організац|ГО\b|НУО|NGO|CSO|nonprofit|civil society|неприбутков/i,'Громадські організації'],
  [/ОМС|орган\w+ місцев|local government|municipality|сільськ\w+ рад|селищн|міськ\w+ рад/i,'ОМС'],
  [/заклад\w+ освіт|школ|ліцей|universit|коледж|навчальн\w+ заклад/i,'Заклади освіти'],
  [/бізнес|підприєм|малий|середній|SME|business|ФОП/i,'Бізнес/Підприємці'],
  [/благодійн|charity|фонд/i,'Благодійні фонди'],
  [/молодіжн|youth org/i,'Молодіжні організації'],
  [/фізичн\w+ особ|individual|особист|кожен/i,'Фізичні особи'],
  [/комунальн/i,'Комунальні підприємства'],
  [/ОТГ|об.єднан\w+ громад/i,'ОТГ'],
  [/медіа|ЗМІ|редакц/i,'Медіа організації'],
  [/бібліотек/i,'Бібліотеки'],
  [/музей|мистецьк/i,'Культурні заклади']
];
const GEO = [
  [/вся Україна|всій Україн|all Ukraine|nationwide|по всій/i,'Вся Україна'],
  [/міжнародн|international|global/i,'Міжнародно'],
  [/Вінниц/i,'Вінницька'],[/Волин/i,'Волинська'],[/Дніпр/i,'Дніпропетровська'],
  [/Донецьк/i,'Донецька'],[/Житомир/i,'Житомирська'],[/Закарпат/i,'Закарпатська'],
  [/Запоріж/i,'Запорізька'],[/Івано-Франків/i,'Івано-Франківська'],
  [/Київ/i,'Київська'],[/Кіровоградськ/i,'Кіровоградська'],
  [/Луганськ/i,'Луганська'],[/Львів/i,'Львівська'],[/Миколаїв/i,'Миколаївська'],
  [/Одес/i,'Одеська'],[/Полтав/i,'Полтавська'],[/Рівн/i,'Рівненська'],
  [/Сум/i,'Сумська'],[/Тернопіл/i,'Тернопільська'],[/Харків/i,'Харківська'],
  [/Херсон/i,'Херсонська'],[/Хмельниц/i,'Хмельницька'],
  [/Черкас/i,'Черкаська'],[/Чернівец/i,'Чернівецька'],[/Чернігів/i,'Чернігівська'],
  [/громад|hromada|community/i,'Громади'],
  [/прифронтов|деокупован|постраждал|frontline/i,'Постраждалі території'],
  [/сільськ|село|rural/i,'Сільські території']
];

function classify(title, desc) {
  var hay = (title + ' ' + desc);
  var r = { donor:'', topics:'', applicants:'', geography:'', deadline:'', amount_text:'', auto_priority:'medium' };
  var d=[],t=[],a=[],g=[];
  DONORS.forEach(function(p){if(p[0].test(hay)&&d.indexOf(p[1])<0)d.push(p[1]);});
  TOPICS.forEach(function(p){if(p[0].test(hay)&&t.indexOf(p[1])<0)t.push(p[1]);});
  APPLICANTS.forEach(function(p){if(p[0].test(hay)&&a.indexOf(p[1])<0)a.push(p[1]);});
  GEO.forEach(function(p){if(p[0].test(hay)&&g.indexOf(p[1])<0)g.push(p[1]);});
  r.donor=d.join(', '); r.topics=t.join(', '); r.applicants=a.join(', '); r.geography=g.join(', ');
  r.deadline = extractDeadline(hay);
  r.amount_text = extractAmount(hay);
  if (r.deadline) {
    r.auto_priority = new Date(r.deadline) > new Date() ? 'high' : 'low';
  }
  if (d.length && t.length) r.auto_priority = 'high';
  return r;
}

// ══════ ДЕТАЛЬНИЙ ПАРСИНГ СТОРІНКИ ══════
async function fetchDetailPage(url) {
  if (!url || url.length < 10) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, 8000);
    const resp = await fetch(url, {
      headers: {'User-Agent': UA},
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie,.popup,.social,.share,.comments').remove();
    var selectors = [
      'article', '.entry-content', '.post-content', '.article-body',
      '.content', '.post', '.entry', 'main', '.page-content',
      '.grant-detail', '.single-post', '.field--type-text-with-summary',
      '[class*="content"]', '[class*="article"]', '[class*="post"]'
    ];
    var text = '';
    for (var i = 0; i < selectors.length; i++) {
      text = $(selectors[i]).first().text().trim();
      if (text && text.length > 100) break;
    }
    if (!text || text.length < 50) text = $('body').text().trim();
    return text.replace(/\s+/g, ' ').slice(0, 6000);
  } catch(e) { return null; }
}

// ══════ SCHEDULED ══════
exports.scanScheduled = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Europe/Kyiv')
  .onRun(async function() {
    const snap = await db.collection(COL.sources)
      .where('source_status','==','active')
      .orderBy('last_checked_at','asc')
      .limit(1).get();
    if (snap.empty) { console.log('No active sources'); return; }
    const doc = snap.docs[0];
    const src = doc.data();
    console.log('Scan: ' + (src.source_name || doc.id));
    try {
      // item_limit з налаштувань джерела (дефолт 10, макс 30)
      var maxNew = parseInt(src.item_limit) || 10;
      maxNew = Math.min(maxNew, 30);
      const r = await scanSingle(doc.id, src, maxNew);
      console.log('Done: raw='+r.checked+' pass='+r.passed+' new='+r.created+' dup='+r.dupes+' detail='+r.detailed);
    } catch (e) {
      console.error('Error: ' + e.message);
      await db.collection(COL.sources).doc(doc.id).update({
        last_checked_at: new Date().toISOString(),
        last_error: e.message
      });
    }
  });

// ══════ CORE ══════
async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 10;
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();

  // Вікно публікацій
  var windowDays = parseInt(src.window_days) || 30;
  var windowDate = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

  var raw = [];
  if (parser === 'rss' || parser === 'google_news_rss') {
    raw = await parseRSS(url, 60, parser === 'google_news_rss');
  } else if (parser === 'telegram') {
    raw = await parseTelegram(url, 60);
  } else {
    raw = await parsePageLinks(url, 60, src);
  }

  // Фільтрація за датою (тільки якщо вікно < 1 рік)
  if (windowDays < 365) {
    raw = raw.filter(function(item) {
      if (!item.date) return true;
      var d = new Date(item.date);
      if (isNaN(d.getTime())) return true;
      return d >= windowDate;
    });
  }

  var passed = 0;
  var good = raw.filter(function(item) {
    if (!passesFilter(item.title, item.description, src)) return false;
    passed++; return true;
  });

  var created=0, dupes=0, detailed=0;
  for (var i = 0; i < good.length; i++) {
    if (created >= maxNew) break;
    var item = good[i];
    var norm = (item.title||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,200);
    // Нормалізація URL без query-рядка для кращого дедупу
    var dUrl = (item.url||'').toLowerCase().replace(/\/+$/,'').replace(/\?.*$/,'').replace(/#.*$/,'');

    // Дедуп по URL (пріоритет)
    if (dUrl) {
      var eUrl = await db.collection(COL.scanIdx).where('canonical_url','==',dUrl).limit(1).get();
      if (!eUrl.empty) { dupes++; continue; }
    }
    // Дедуп по заголовку тільки якщо немає URL
    if (norm && !dUrl) {
      var eTitle = await db.collection(COL.scanIdx).where('normalized_title','==',norm).limit(1).get();
      if (!eTitle.empty) { dupes++; continue; }
    }

    var cls = classify(item.title||'', item.description||'');

    var fullText = '';
    var shouldFetch = item.url && String(src.fetch_details) !== 'false';
    if (item.url && item.url.includes('t.me')) shouldFetch = false;

    if (shouldFetch) {
      fullText = await fetchDetailPage(item.url);
      if (fullText && fullText.length > 100) {
        detailed++;
        var cls2 = classify(item.title||'', fullText);
        if (!cls.donor && cls2.donor) cls.donor = cls2.donor;
        if (!cls.deadline && cls2.deadline) cls.deadline = cls2.deadline;
        if (!cls.amount_text && cls2.amount_text) cls.amount_text = cls2.amount_text;
        var t1 = cls.topics ? cls.topics.split(',').filter(Boolean) : [];
        var t2 = cls2.topics ? cls2.topics.split(',').filter(Boolean) : [];
        if (t2.length > t1.length) cls.topics = cls2.topics;
        var a1 = cls.applicants ? cls.applicants.split(',').filter(Boolean) : [];
        var a2 = cls2.applicants ? cls2.applicants.split(',').filter(Boolean) : [];
        if (a2.length > a1.length) cls.applicants = cls2.applicants;
        if (!cls.geography && cls2.geography) cls.geography = cls2.geography;
        if (cls2.auto_priority === 'high') cls.auto_priority = 'high';
      }
    }

    var detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    await db.collection(COL.detected).doc(detId).set({
      detected_id: detId,
      source_id: sourceId,
      source_name: src.source_name||'',
      source_url: url,
      detail_url: item.url||'',
      raw_title: item.title||'',
      normalized_title: norm,
      short_desc: (item.description||'').slice(0,600),
      full_desc: fullText ? fullText.slice(0,4000) : (item.description||'').slice(0,4000),
      pub_date: item.date||'',
      found_at: new Date().toISOString(),
      status: 'Виявлено',
      source_type: src.source_type||'',
      donor: cls.donor || src.donor_hint || '',
      deadline: cls.deadline || '',
      amount_text: cls.amount_text || '',
      topics: cls.topics || src.source_topics || '',
      applicants: cls.applicants || src.applicants_hint || '',
      geography: cls.geography || src.geography_hint || '',
      auto_priority: cls.auto_priority || 'medium',
      has_detail_page: fullText ? 'true' : 'false'
    });

    await db.collection(COL.scanIdx).add({
      source_id: sourceId,
      canonical_url: dUrl,
      normalized_title: norm,
      detected_id: detId,
      first_seen_at: new Date().toISOString()
    });
    created++;
  }

  var cnt = parseInt(src.found_count)||0;
  await db.collection(COL.sources).doc(sourceId).update({
    last_checked_at: new Date().toISOString(),
    last_success_at: created > 0 ? new Date().toISOString() : (src.last_success_at||''),
    found_count: cnt + created,
    last_error: ''
  });
  return { sourceId: sourceId, checked: raw.length, passed: passed, created: created, dupes: dupes, detailed: detailed };
}

// ══════ ПАРСЕРИ ══════
function toStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v['@_href'] || v['#text'] || v.href || '';
  return String(v);
}

async function parseRSS(url, limit, isGoogleNews) {
  var resp = await fetch(url, {headers:{'User-Agent':UA}, timeout:15000});
  var xml = await resp.text();
  var p = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'@_'});
  var d = p.parse(xml);

  var entries = [];
  if (d.rss && d.rss.channel) {
    // RSS 2.0
    entries = d.rss.channel.item || [];
  } else if (d.feed) {
    // Atom 1.0
    entries = d.feed.entry || [];
  }
  if (!Array.isArray(entries)) entries = [entries];
  entries = entries.filter(Boolean).slice(0, limit);

  return entries.map(function(e) {
    var link = toStr(e.link || (e.id && typeof e.id === 'string' && e.id.startsWith('http') ? e.id : ''));
    var title = toStr(e.title || '').trim();
    // Очищення Google News: "Назва - Джерело" -> "Назва"
    if (isGoogleNews && title) {
      title = title.replace(/\s+[-\u2013\u2014]\s+[^\-\u2013\u2014]+$/, '').trim();
    }
    var desc = stripHtml(
      toStr(e.description || e.summary || e['content:encoded'] ||
            (e.content && e.content['#text']) || e.content || '')
    );
    var date = toStr(e.pubDate || e.published || e.updated || e['dc:date'] || '');
    return {title: title, url: link, description: desc, date: date};
  });
}

async function parseTelegram(url, limit) {
  var resp = await fetch(url, {headers:{'User-Agent':UA}, timeout:15000});
  var html = await resp.text();
  var $ = cheerio.load(html);
  var items = [];
  $('.tgme_widget_message_wrap').each(function(){
    if (items.length >= limit) return false;
    var msg = $(this);
    var text = msg.find('.tgme_widget_message_text').text().trim();
    // Збираємо ВСІ зовнішні посилання з тексту
    var links = [];
    msg.find('.tgme_widget_message_text a[href]').each(function(){
      var h = $(this).attr('href') || '';
      if (h && h.startsWith('http') && !h.includes('t.me/') && !h.includes('telegram.me/')) {
        if (links.indexOf(h) < 0) links.push(h);
      }
    });
    var msgLink = msg.find('.tgme_widget_message_date').attr('href') || '';
    var date = msg.find('.tgme_widget_message_date time').attr('datetime') || '';
    if (text && text.length > 30) {
      items.push({
        title: text.slice(0, 300), // Збільшили з 200 до 300
        description: text,
        url: links[0] || msgLink, // зовнішній URL або пост
        date: date
      });
    }
  });
  return items;
}

async function parsePageLinks(url, limit, src) {
  var resp = await fetch(url, {headers:{'User-Agent':UA}, timeout:15000});
  var html = await resp.text();
  var $ = cheerio.load(html);
  var items = [];

  // Фільтри з налаштувань
  var includeWords = (src.link_include || '').toLowerCase().split(',').map(function(s){return s.trim();}).filter(Boolean);
  var excludeWords = (src.link_exclude || 'вакансія,job,about,contact,login,privacy,cookie,sitemap').toLowerCase().split(',').map(function(s){return s.trim();}).filter(Boolean);

  // Спочатку шукаємо в семантичних тегах (заголовки статей)
  var found = [];
  var articleSel = 'article a[href], .entry-title a, .post-title a, h2 a[href], h3 a[href], .grant-title a, [class*="title"] a[href], [class*="grant"] a[href], [class*="news"] a[href], [class*="item"] a[href]';
  $(articleSel).each(function(){
    var href = $(this).attr('href') || '';
    var text = $(this).text().trim().replace(/\s+/g,' ');
    if (!text || text.length < 10 || !href) return;
    found.push({href: href, text: text});
  });

  // Якщо мало знайшли — беремо всі посилання
  if (found.length < 3) {
    $('a[href]').each(function(){
      var href = $(this).attr('href') || '';
      var text = $(this).text().trim().replace(/\s+/g,' ');
      if (!text || text.length < 10 || !href) return;
      found.push({href: href, text: text});
    });
  }

  var seen = {};
  for (var i = 0; i < found.length; i++) {
    if (items.length >= limit) break;
    var lk = found[i];
    var href = lk.href, text = lk.text;
    var fullUrl;
    try {
      fullUrl = href.startsWith('http') ? href : new URL(href, url).toString();
    } catch(e) { continue; }

    if (fullUrl === url || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto:')) continue;
    var normUrl = fullUrl.replace(/\/+$/,'').replace(/\?.*$/,'').replace(/#.*$/,'');
    if (seen[normUrl]) continue;
    seen[normUrl] = true;

    var textLow = text.toLowerCase() + ' ' + normUrl.toLowerCase();
    if (excludeWords.some(function(w){ return w && textLow.indexOf(w) >= 0; })) continue;
    if (includeWords.length > 0) {
      if (!includeWords.some(function(w){ return w && textLow.indexOf(w) >= 0; })) continue;
    }

    items.push({title: text, url: fullUrl, description: '', date: ''});
  }
  return items;
}

function stripHtml(h) {
  return String(h||'').replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#\d+;/g,' ').replace(/&\w+;/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,4000);
}
