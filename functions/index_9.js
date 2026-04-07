/**
 * GrantFlow ScanEngine v4
 * Виправлено: дедлайни (англ місяці), email-фільтр, детальний парсинг сторінок
 * Кожну хвилину, 1 джерело, макс 3 записи, авто-класифікація
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
const DEFAULT_FETCH_TIMEOUT = 15000;

// ══════ ФІЛЬТРИ ══════
const GRANT_WORDS = [
  'грант','гранти','конкурс','програм','фінансуван','підтримк','можливіст',
  'заявк','відбір','стипенді','субгрант','мікрогрант',
  'grant','grants','funding','call','application','opportunity','fellowship',
  'scholarship','support','program','відновлен','реконструкц','розвиток',
  'проєкт','проект','ініціатив','допомог','обладнан','deadline','дедлайн'
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

function passesFilter(title, desc) {
  if (!title || title.length < 12) return false;
  if (BAD_TITLE.some(function(re) { return re.test(title.trim()); })) return false;
  if (title.trim().split(' ').length < 2) return false;
  var hay = (title + ' ' + desc).toLowerCase();
  if (SPAM.some(function(w) { return hay.indexOf(w) >= 0; })) return false;
  if (GRANT_WORDS.some(function(w) { return hay.indexOf(w) >= 0; })) return true;
  return true; // м'який — пропускаємо якщо з тематичного каналу
}

// ══════ ДЕДЛАЙН — ПОВНИЙ ПАРСЕР ══════
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
  // Контекст: шукаємо дату біля слів дедлайн/deadline/до/until/before
  var ctx = text;
  var ctxMatch = text.match(/(?:дедлайн|deadline|термін|до|until|before|by|closes?|closing|прийом до|подати до)[:\s\-–—]*(.{5,60})/i);
  if (ctxMatch) ctx = ctxMatch[1];
  
  // DD.MM.YYYY або DD/MM/YYYY
  var m = ctx.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](20\d{2})/);
  if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  
  // YYYY-MM-DD
  m = ctx.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  
  // "14 January 2026" / "14-Jan-2026" / "14 січня 2026"
  var re1 = new RegExp('(\\d{1,2})[\\s\\-\\.]+(' + ALL_MONTH_NAMES + ')[\\s\\-\\.,]+(20\\d{2})', 'i');
  m = ctx.match(re1);
  if (m) return m[3]+'-'+(MONTHS_MAP[m[2].toLowerCase()]||'01')+'-'+m[1].padStart(2,'0');
  
  // "January 14, 2026" / "Jan 14 2026"
  var re2 = new RegExp('(' + ALL_MONTH_NAMES + ')[\\s\\-\\.]+?(\\d{1,2})[\\s,]+(20\\d{2})', 'i');
  m = ctx.match(re2);
  if (m) return m[3]+'-'+(MONTHS_MAP[m[1].toLowerCase()]||'01')+'-'+m[2].padStart(2,'0');
  
  // Якщо не знайшли в контексті — шукаємо у всьому тексті
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
    /(?:до|up to|max|maximum|максимум)\s*[\$€£]?\s*[\d,.\s]+\s*(?:тис|млн|thousand|million|грн|USD|EUR)?/i,
    /[\$€£]\s*[\d,.\s]+(?:\s*(?:тис|млн|thousand|million))?/i,
    /[\d,.\s]+\s*(?:грн|гривень|USD|EUR|доларів|євро|dollars|euros)/i,
    /грант(?:ова сума|у розмірі)[:\s]+[\d,.\s]+/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) return m[0].trim().slice(0, 80);
  }
  return '';
}

// ══════ КЛАСИФІКАТОРИ ══════
const DONORS = [
  [/USAID/i,'USAID'],[/UNDP/i,'UNDP'],[/UNICEF/i,'UNICEF'],
  [/\bEU\b|Європейськ\w+ Союз|European Union/i,'EU'],
  [/GIZ/i,'GIZ'],[/IREX/i,'IREX'],[/Erasmus/i,'Erasmus+'],
  [/House of Europe/i,'House of Europe'],[/British Council/i,'British Council'],
  [/SIDA|Швеці/i,'SIDA'],[/Світовий банк|World Bank/i,'World Bank'],
  [/ЄБРР|EBRD/i,'EBRD'],[/UNESCO|ЮНЕСКО/i,'UNESCO'],
  [/UNHCR/i,'UNHCR'],[/IOM|МОМ/i,'IOM'],
  [/Червон\w+ Хрест|Red Cross|IFRC/i,'Червоний Хрест'],
  [/Карітас|Caritas/i,'Карітас'],[/ГУРТ|GURT/i,'ГУРТ'],
  [/ІСАР|Єднання|ISAR/i,'ІСАР Єднання'],
  [/Фонд Сх\w+ Європ|EEF/i,'Фонд Східна Європа'],
  [/NED\b/i,'NED'],[/NDI\b/i,'NDI'],[/Pact\b/i,'Pact'],
  [/Open Society|Відродження/i,'Open Society'],
  [/Mercy Corps/i,'Mercy Corps'],[/ACTED/i,'ACTED'],
  [/People in Need|PIN\b/i,'People in Need'],
  [/UKF|УКФ|Український культурний фонд/i,'УКФ'],
  [/Дія|Diia/i,'Дія'],[/КМУ|Кабінет Міністрів/i,'КМУ'],
  [/OSCE|ОБСЄ/i,'ОБСЄ'],[/Council of Europe|Рада Європи/i,'Рада Європи'],
  [/JICA/i,'JICA'],[/DOBRE/i,'DOBRE'],[/U-LEAD/i,'U-LEAD'],
  [/Heinrich B/i,'Heinrich Böll'],[/Konrad Adenauer/i,'Konrad Adenauer']
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
  [/енерг|energy|утеплен|котельн/i,'Енергоефективність'],
  [/інфраструктур|дорог|водопостачан/i,'Інфраструктура'],
  [/соціальн|social|захист/i,'Соціальний захист'],
  [/підприємн|бізнес|business|entrepreneur/i,'Підприємництво'],
  [/громад|community|hromada|ОМС|місцев|самоврядув/i,'Громади'],
  [/відновлен|відбудов|reconstruction|recovery/i,'Відновлення'],
  [/правозахист|human rights|демократ/i,'Правозахист'],
  [/гуманітарн|humanitarian/i,'Гуманітарна допомога'],
  [/агро|сільськ\w+ господ|agricultur|фермер/i,'Агро'],
  [/психо|mental health|травм/i,'Психосоціальна підтримка'],
  [/медіа|media|журналіст/i,'Медіа']
];
const APPLICANTS = [
  [/громадськ\w+ організац|ГО\b|НУО|NGO|CSO|nonprofit|civil society|неприбутков/i,'Громадські організації'],
  [/ОМС|орган\w+ місцев|local government|municipality|сільськ\w+ рад|селищн|міськ\w+ рад/i,'ОМС'],
  [/заклад\w+ освіт|школ|ліцей|universit|коледж/i,'Заклади освіти'],
  [/бізнес|підприєм|малий|середній|SME|business|ФОП/i,'Бізнес/Підприємці'],
  [/благодійн|charity|фонд/i,'Благодійні фонди'],
  [/молодіжн|youth org/i,'Молодіжні організації'],
  [/фізичн\w+ особ|individual|особист|кожен/i,'Фізичні особи'],
  [/комунальн/i,'Комунальні підприємства'],
  [/ОТГ|об.єднан\w+ громад/i,'ОТГ']
];
const GEO = [
  [/вся Україна|всій Україн|all Ukraine|nationwide/i,'Вся Україна'],
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
  if (r.deadline) { r.auto_priority = new Date(r.deadline) > new Date() ? 'high' : 'low'; }
  if (d.length && t.length) r.auto_priority = 'high';
  return r;
}

// ═════ ДЕТАЛЬНИЙ ПАРСИНГ СТОРІНКИ ══════
async function fetchDetailPage(url) {
  if (!url || url.length < 10) return null;
  try {
    const resp = await fetch(url, { headers:{'User-Agent':UA}, timeout:10000, redirect:'follow' });
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);
    // Видаляємо скрипти, стилі, навігацію
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie,.popup').remove();
    var text = $('article, .content, .post, .entry, main, .page-content, .grant-detail, .single-post').text().trim();
    if (!text || text.length < 50) text = $('body').text().trim();
    return text.replace(/\s+/g, ' ').slice(0, 5000);
  } catch(e) { return null; }
}

async function fetchWithRetries(url, options, retries) {
  options = options || {};
  retries = typeof retries === 'number' ? retries : 2;
  var attempt = 0;
  var waitMs = 1200;
  var lastErr = null;

  while (attempt <= retries) {
    try {
      const resp = await fetch(url, Object.assign({
        headers: { 'User-Agent': UA },
        timeout: DEFAULT_FETCH_TIMEOUT
      }, options || {}));

      if (resp.ok) return resp;

      // Не валимо весь скан на тимчасових помилках джерела
      if ([429, 500, 502, 503, 504].indexOf(resp.status) >= 0 && attempt < retries) {
        await new Promise(function(resolve) { setTimeout(resolve, waitMs); });
        waitMs *= 2;
        attempt++;
        continue;
      }

      return null;
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
      await new Promise(function(resolve) { setTimeout(resolve, waitMs); });
      waitMs *= 2;
      attempt++;
    }
  }

  if (lastErr) console.warn('fetchWithRetries failed:', lastErr.message || String(lastErr));
  return null;
}

// ══════ SCHEDULED ══════
exports.scanScheduled = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    const snap = await db.collection(COL.sources)
      .where('source_status','==','active')
      .orderBy('last_checked_at','asc')
      .limit(1).get();
    if (snap.empty) { console.log('No active sources'); return; }
    const doc = snap.docs[0];
    const src = doc.data();
    console.log(`Scan: ${src.source_name || doc.id}`);
    try {
      const r = await scanSingle(doc.id, src, 3);
      console.log(`Done: raw=${r.checked} pass=${r.passed} new=${r.created} dup=${r.dupes} detail=${r.detailed}`);
    } catch (e) {
      console.error(`Error: ${e.message}`);
      await db.collection(COL.sources).doc(doc.id).update({ last_checked_at:new Date().toISOString(), last_error:e.message });
    }
  });

// ══════ CORE ══════
async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 3;
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();
  let raw = [];
  if (parser==='rss'||parser==='google_news_rss') raw = await parseRSS(url, 40);
  else if (parser==='telegram') raw = await parseTelegram(url, 40);
  else raw = await parsePageLinks(url, 40, src);

  // Фільтрація
  let passed = 0;
  const good = raw.filter(function(item) {
    if (!passesFilter(item.title, item.description)) return false;
    passed++; return true;
  });

  let created=0, dupes=0, detailed=0;
  for (const item of good) {
    if (created >= maxNew) break;
    const norm = (item.title||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,200);
    const dUrl = (item.url||'').toLowerCase().replace(/\/+$/,'');
    
    // Дедуп
    if (norm) { const e = await db.collection(COL.scanIdx).where('normalized_title','==',norm).limit(1).get(); if(!e.empty){dupes++;continue;} }
    if (dUrl) { const e = await db.collection(COL.scanIdx).where('canonical_url','==',dUrl).limit(1).get(); if(!e.empty){dupes++;continue;} }

    // Класифікація з базового тексту
    var cls = classify(item.title||'', item.description||'');
    
    // Детальний парсинг сторінки (якщо є URL і fetch_details)
    var fullText = '';
    if (item.url && String(src.fetch_details) !== 'false') {
      fullText = await fetchDetailPage(item.url);
      if (fullText && fullText.length > 100) {
        detailed++;
        // Перекласифікуємо з повним текстом
        var cls2 = classify(item.title||'', fullText);
        // Мержимо — беремо більш повну інформацію
        if (!cls.donor && cls2.donor) cls.donor = cls2.donor;
        if (!cls.deadline && cls2.deadline) cls.deadline = cls2.deadline;
        if (!cls.amount_text && cls2.amount_text) cls.amount_text = cls2.amount_text;
        if (!cls.topics && cls2.topics) cls.topics = cls2.topics;
        if (cls2.topics && cls2.topics.split(',').length > cls.topics.split(',').length) cls.topics = cls2.topics;
        if (!cls.applicants && cls2.applicants) cls.applicants = cls2.applicants;
        if (cls2.applicants && cls2.applicants.split(',').length > cls.applicants.split(',').length) cls.applicants = cls2.applicants;
        if (!cls.geography && cls2.geography) cls.geography = cls2.geography;
        if (cls2.auto_priority === 'high') cls.auto_priority = 'high';
      }
    }

    const detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    await db.collection(COL.detected).doc(detId).set({
      detected_id:detId, source_id:sourceId, source_name:src.source_name||'',
      source_url:url, detail_url:item.url||'',
      raw_title:item.title||'', normalized_title:norm,
      short_desc:(item.description||'').slice(0,500),
      full_desc: fullText ? fullText.slice(0,3000) : (item.description||''),
      found_at:new Date().toISOString(), status:'Виявлено',
      source_type:src.source_type||'',
      donor: cls.donor || src.donor_hint || '',
      deadline: cls.deadline || '',
      amount_text: cls.amount_text || '',
      topics: cls.topics || src.source_topics || '',
      applicants: cls.applicants || src.applicants_hint || '',
      geography: cls.geography || src.geography_hint || '',
      auto_priority: cls.auto_priority || 'medium',
      has_detail_page: fullText ? 'true' : 'false'
    });
    await db.collection(COL.scanIdx).add({ source_id:sourceId, canonical_url:dUrl, normalized_title:norm, detected_id:detId, first_seen_at:new Date().toISOString() });
    created++;
  }

  const cnt = parseInt(src.found_count)||0;
  await db.collection(COL.sources).doc(sourceId).update({
    last_checked_at:new Date().toISOString(),
    last_success_at:created>0?new Date().toISOString():(src.last_success_at||''),
    found_count:cnt+created, last_error:''
  });
  return { sourceId, checked:raw.length, passed, created, dupes, detailed };
}

// ══════ ПАРСЕРИ ══════
async function parseRSS(url, limit) {
  try {
    const resp = await fetchWithRetries(url, { headers:{'User-Agent':UA}, timeout:15000 }, 3);
    if (!resp) return [];
    const xml = await resp.text();
    if (!xml || xml.length < 20) return [];

    const p = new XMLParser({ ignoreAttributes:false });
    const d = p.parse(xml);
    const ch = d.rss?.channel || d.feed || {};
    const entries = ch.item || ch.entry || [];
    return (Array.isArray(entries) ? entries : [entries]).filter(Boolean).slice(0, limit).map(function(e) {
      var link = e.link;
      if (typeof link === 'object') link = link['@_href'] || link['#text'] || '';
      return {
        title: String(e.title || '').trim(),
        url: String(link || '').trim(),
        description: stripHtml(e.description || e.summary || e['content:encoded'] || e.content || ''),
        date: e.pubDate || e.published || e.updated || ''
      };
    });
  } catch (e) {
    console.warn('parseRSS error:', e.message || String(e));
    return [];
  }
}

async function parseTelegram(url, limit) {
  try {
    const resp = await fetchWithRetries(url, { headers:{'User-Agent':UA}, timeout:15000 }, 2);
    if (!resp) return [];
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items = [];
    $('.tgme_widget_message_wrap').each(function(){
      if(items.length>=limit)return false;
      const msg=$(this);
      const text=msg.find('.tgme_widget_message_text').text().trim();
      const links=[];
      msg.find('.tgme_widget_message_text a[href]').each(function(){
        var h=$(this).attr('href')||'';
        if(h&&!h.startsWith('tg://')&&!h.includes('t.me/'))links.push(h);
      });
      const date=msg.find('.tgme_widget_message_date time').attr('datetime')||'';
      if(text&&text.length>30) items.push({title:text.slice(0,200),description:text,url:links[0]||'',date:date});
    });
    return items;
  } catch (e) {
    console.warn('parseTelegram error:', e.message || String(e));
    return [];
  }
}

async function parsePageLinks(url, limit, src) {
  try {
    const resp = await fetchWithRetries(url, { headers:{'User-Agent':UA}, timeout:15000 }, 2);
    if (!resp) return [];
    const html = await resp.text();
    const $ = cheerio.load(html);
    const items = [];
    $('a[href]').each(function(){
      if(items.length>=limit)return false;
      const href=$(this).attr('href')||'';
      const text=$(this).text().trim().replace(/\s+/g,' ');
      if(!text||text.length<12||!href)return;
      let fullUrl;
      try{fullUrl=href.startsWith('http')?href:new URL(href,url).toString();}catch(e){return;}
      if(fullUrl===url||href.startsWith('#')||href.startsWith('javascript')||href.startsWith('mailto:'))return;
      items.push({title:text,url:fullUrl,description:''});
    });
    return items;
  } catch (e) {
    console.warn('parsePageLinks error:', e.message || String(e));
    return [];
  }
}

function stripHtml(h){return String(h||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').replace(/\s+/g,' ').trim().slice(0,3000);}