/**
 * GrantFlow ScanEngine v5
 * Виправлено: HTTP status checks, scan history, auto-pause, мертві URL
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
const FETCH_TIMEOUT = 12000; // 12с замість 15с
const MAX_FAILS_BEFORE_PAUSE = 7; // авто-пауза після 7 помилок поспіль

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
  return true;
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
  var ctxMatch = text.match(/(?:дедлайн|deadline|термін|до|until|before|by|closes?|closing|прийом до|подати до)[:\s\-–—]*(.{5,60})/i);
  if (ctxMatch) ctx = ctxMatch[1];
  var m = ctx.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](20\d{2})/);
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

// ══════ FETCH З ПЕРЕВІРКОЮ СТАТУСУ ══════
async function safeFetch(url, options) {
  const resp = await fetch(url, Object.assign({ headers:{'User-Agent':UA}, timeout:FETCH_TIMEOUT, redirect:'follow' }, options));
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url.slice(0,80)}`);
  return resp;
}

// ══════ ДЕТАЛЬНИЙ ПАРСИНГ ══════
async function fetchDetailPage(url) {
  if (!url || url.length < 10) return null;
  try {
    const resp = await safeFetch(url);
    const html = await resp.text();
    const $ = cheerio.load(html);
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie,.popup').remove();
    var text = $('article, .content, .post, .entry, main, .page-content, .grant-detail, .single-post').text().trim();
    if (!text || text.length < 50) text = $('body').text().trim();
    return text.replace(/\s+/g, ' ').slice(0, 5000);
  } catch(e) { return null; }
}

// ══════ ЗАПИС HISTORY в документ джерела ══════
async function writeSourceHistory(sourceId, histEntry) {
  // Зберігаємо останні 30 записів в масиві scan_history документа
  const ref = db.collection(COL.sources).doc(sourceId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data();
  let history = Array.isArray(data.scan_history) ? data.scan_history : [];
  history.unshift(histEntry); // новий на початок
  if (history.length > 30) history = history.slice(0, 30);
  await ref.update({ scan_history: history });
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
    const now = new Date().toISOString();
    console.log(`Scan: ${src.source_name || doc.id}`);
    try {
      const r = await scanSingle(doc.id, src, 3);
      console.log(`Done: raw=${r.checked} pass=${r.passed} new=${r.created} dup=${r.dupes}`);
    } catch (e) {
      console.error(`Error scanning ${src.source_name}: ${e.message}`);
      // Записуємо помилку
      const failCount = (parseInt(src.consecutive_fails) || 0) + 1;
      const histEntry = {
        at: now, status: 'error', raw: 0, passed: 0, new: 0, dupes: 0,
        error: e.message.slice(0, 200)
      };
      const upd = {
        last_checked_at: now,
        last_error: e.message.slice(0, 500),
        last_scan_status: 'error',
        last_scan_raw: 0, last_scan_new: 0, last_scan_dupes: 0,
        consecutive_fails: failCount
      };
      // Авто-пауза після MAX_FAILS_BEFORE_PAUSE помилок поспіль
      if (failCount >= MAX_FAILS_BEFORE_PAUSE) {
        upd.source_status = 'paused';
        upd.pause_reason = `Авто-пауза: ${failCount} помилок поспіль. Остання: ${e.message.slice(0,100)}`;
        console.warn(`AUTO-PAUSED: ${src.source_name} after ${failCount} fails`);
      }
      await db.collection(COL.sources).doc(doc.id).update(upd);
      // Зберігаємо в history
      const snap2 = await db.collection(COL.sources).doc(doc.id).get();
      const d2 = snap2.data();
      let hist = Array.isArray(d2.scan_history) ? d2.scan_history : [];
      hist.unshift(histEntry);
      if (hist.length > 30) hist = hist.slice(0, 30);
      await db.collection(COL.sources).doc(doc.id).update({ scan_history: hist });
    }
  });

// ══════ ЩОДЕННИЙ ЛІЧИЛЬНИК о 23:55 ══════
exports.dailyFoundCounter = functions.pubsub
  .schedule('55 23 * * *')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    try {
      var today = new Date().toISOString().slice(0, 10);
      // Рахуємо скільки виявлено сьогодні
      var snap = await db.collection('gf_detected')
        .where('found_at', '>=', today + 'T00:00:00.000Z')
        .where('found_at', '<=', today + 'T23:59:59.999Z')
        .get();
      var todayCount = snap.size;

      // Читаємо поточний total з лічильника
      var statsRef = db.collection('gf_settings').doc('main_stats');
      var statsSnap = await statsRef.get();
      var currentTotal = statsSnap.exists ? (statsSnap.data().total || 0) : 0;

      // Записуємо: total залишається як є (накопичувальний),
      // додаємо запис у daily_history для графіку
      var histRef = db.collection('gf_settings').doc('daily_history');
      var histSnap = await histRef.get();
      var history = histSnap.exists ? (histSnap.data().days || []) : [];
      history.unshift({ date: today, count: todayCount, total: currentTotal });
      if (history.length > 365) history = history.slice(0, 365);

      await histRef.set({ days: history, updatedAt: new Date().toISOString() });
      console.log('Daily counter: ' + today + ' found=' + todayCount + ' total=' + currentTotal);
    } catch(e) {
      console.error('dailyFoundCounter error:', e.message);
    }
  });

// ══════ CORE ══════
async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 3;
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();
  const now = new Date().toISOString();
  let raw = [];

  if (parser==='rss'||parser==='google_news_rss') raw = await parseRSS(url, 40);
  else if (parser==='telegram') raw = await parseTelegram(url, 40);
  else raw = await parsePageLinks(url, 40, src);

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
    if (norm) { const e = await db.collection(COL.scanIdx).where('normalized_title','==',norm).limit(1).get(); if(!e.empty){dupes++;continue;} }
    if (dUrl) { const e = await db.collection(COL.scanIdx).where('canonical_url','==',dUrl).limit(1).get(); if(!e.empty){dupes++;continue;} }

    var cls = classify(item.title||'', item.description||'');
    var fullText = '';
    if (item.url && String(src.fetch_details) !== 'false') {
      fullText = await fetchDetailPage(item.url);
      if (fullText && fullText.length > 100) {
        detailed++;
        var cls2 = classify(item.title||'', fullText);
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
      found_at:now, status:'Виявлено',
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
    await db.collection(COL.scanIdx).add({
      source_id:sourceId, canonical_url:dUrl, normalized_title:norm,
      detected_id:detId, first_seen_at:now
    });
    created++;
  }

  // Визначаємо статус сканування
  let scanStatus = 'empty';
  if (raw.length > 0 && good.length === 0) scanStatus = 'filtered';
  else if (created > 0) scanStatus = 'ok_new';
  else if (dupes > 0) scanStatus = 'ok_dupes';
  else if (good.length > 0) scanStatus = 'ok_dupes';

  const cnt = parseInt(src.found_count)||0;
  const histEntry = {
    at: now, status: scanStatus,
    raw: raw.length, passed, new: created, dupes, error: ''
  };

  // Оновлюємо документ джерела з усіма полями
  const upd = {
    last_checked_at: now,
    last_success_at: created > 0 ? now : (src.last_success_at||''),
    found_count: cnt + created,
    last_error: '',
    consecutive_fails: 0, // скидаємо лічильник помилок
    last_scan_status: scanStatus,
    last_scan_raw: raw.length,
    last_scan_passed: passed,
    last_scan_new: created,
    last_scan_dupes: dupes,
    last_scan_at: now
  };
  await db.collection(COL.sources).doc(sourceId).update(upd);

  // Зберігаємо в history
  const snap = await db.collection(COL.sources).doc(sourceId).get();
  const d = snap.data();
  let hist = Array.isArray(d.scan_history) ? d.scan_history : [];
  hist.unshift(histEntry);
  if (hist.length > 30) hist = hist.slice(0, 30);
  await db.collection(COL.sources).doc(sourceId).update({ scan_history: hist });

  return { sourceId, checked:raw.length, passed, created, dupes, detailed };
}

// ══════ ПАРСЕРИ З ПЕРЕВІРКОЮ СТАТУСУ ══════
async function parseRSS(url, limit) {
  const resp = await safeFetch(url); // кидає помилку якщо не 2xx
  const xml = await resp.text();
  const p = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'@_'});
  const d = p.parse(xml);
  // Підтримка RSS і Atom
  const ch = (d.rss && d.rss.channel) ? d.rss.channel : (d.feed || {});
  const entries = ch.item || ch.entry || [];
  const arr = Array.isArray(entries) ? entries : (entries ? [entries] : []);
  return arr.slice(0, limit).map(function(e) {
    var link = e.link;
    // Atom: link може бути об'єктом {#text, @_href} або масивом
    if (Array.isArray(link)) {
      var alt = link.find(function(l) { return l['@_rel'] === 'alternate' || !l['@_rel']; });
      link = alt ? (alt['@_href'] || alt['#text'] || '') : (link[0]['@_href'] || '');
    } else if (typeof link === 'object') {
      link = link['@_href'] || link['#text'] || '';
    }
    var title = e.title;
    if (typeof title === 'object') title = title['#text'] || title['@_'] || '';
    return {
      title: String(title||'').trim(),
      url: String(link||'').trim(),
      description: stripHtml(e.description||e.summary||e['content:encoded']||e.content||''),
      date: e.pubDate||e.published||e.updated||''
    };
  });
}

async function parseTelegram(url, limit) {
  // Нормалізуємо URL: t.me/ChannelName → t.me/s/ChannelName
  let tUrl = url;
  if (tUrl.includes('t.me/') && !tUrl.includes('t.me/s/')) {
    tUrl = tUrl.replace('t.me/', 't.me/s/');
  }
  const resp = await safeFetch(tUrl);
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];
  $('.tgme_widget_message_wrap').each(function() {
    if (items.length >= limit) return false;
    const msg = $(this);
    const text = msg.find('.tgme_widget_message_text').text().trim();
    const links = [];
    msg.find('.tgme_widget_message_text a[href]').each(function() {
      var h = $(this).attr('href') || '';
      if (h && !h.startsWith('tg://') && !h.includes('t.me/')) links.push(h);
    });
    const date = msg.find('.tgme_widget_message_date time').attr('datetime') || '';
    if (text && text.length > 30) {
      items.push({ title:text.slice(0,200), description:text, url:links[0]||'', date:date });
    }
  });
  return items;
}

async function parsePageLinks(url, limit, src) {
  const resp = await safeFetch(url);
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];
  // Спочатку шукаємо посилання в контентних блоках
  const contentSelectors = ['main a[href]', 'article a[href]', '.content a[href]',
    '.grants a[href]', '.opportunities a[href]', '.items a[href]', 'a[href]'];
  let found = false;
  for (const sel of contentSelectors) {
    $(sel).each(function() {
      if (items.length >= limit) return false;
      const href = $(this).attr('href') || '';
      const text = $(this).text().trim().replace(/\s+/g, ' ');
      if (!text || text.length < 12 || !href) return;
      let fullUrl;
      try { fullUrl = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) { return; }
      if (fullUrl === url || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto:')) return;
      // Уникаємо дублів
      if (items.some(function(i) { return i.url === fullUrl; })) return;
      items.push({ title:text, url:fullUrl, description:'' });
    });
    if (items.length >= 5) { found = true; break; }
  }
  return items;
}

function stripHtml(h) {
  return String(h||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').replace(/\s+/g,' ').trim().slice(0,3000);
}


/* ══════ DAILY COUNTER: кожного дня о 23:55 ══════ */
exports.dailyDetectedCount = functions.pubsub
  .schedule('55 23 * * *')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    var today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    var todayStart = today + 'T00:00:00.000Z';
    var todayEnd   = today + 'T23:59:59.999Z';
    try {
      // Рахуємо скільки знайдено сьогодні
      var snap = await db.collection(COL.detected)
        .where('found_at', '>=', todayStart)
        .where('found_at', '<=', todayEnd)
        .get();
      var todayCount = snap.size;

      if (todayCount > 0) {
        // Додаємо до накопиченого лічильника
        var statsRef = db.collection('gf_settings').doc('main_stats');
        var statsSnap = await statsRef.get();
        if (statsSnap.exists) {
          var cur = parseInt(statsSnap.data().total || 0);
          // total вже містить всі записи — оновлюємо точне значення
          // Також зберігаємо lastDailyCount для відображення
          await statsRef.update({
            total: cur, // залишаємо як є (rebuild дає точне значення)
            lastDailyCount: todayCount,
            lastDailyDate: today,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Перший запуск — рахуємо все
          var allSnap = await db.collection(COL.detected).get();
          await statsRef.set({
            total: allSnap.size,
            lastDailyCount: todayCount,
            lastDailyDate: today,
            updatedAt: new Date().toISOString()
          });
        }
        console.log('Daily count: ' + todayCount + ' new detected on ' + today);
      } else {
        console.log('Daily count: 0 new detected on ' + today);
      }
    } catch(e) {
      console.error('Daily counter error:', e.message);
    }
  });
