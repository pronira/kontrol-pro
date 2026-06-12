/**
 * GrantFlow ScanEngine v6.1 — об'єднана версія + фікс Google News 503
 * Об'єднує: safeFetch + auto-pause (v5, 08.04) + мульти-грант + windowDays (Оригінал, 07.04)
 * Виправлення зі звіту 08.06:
 *  - Google News 503: ротація User-Agent + retry з паузою
 *  - Мертві домени: автопауза швидша (5 fails), кращі повідомлення
 *  - non_ua фільтр: пом'якшено (тільки явні службові слова)
 *  - Telegram 0: кращий парсинг, fallback на t.me/s/
 *  - HTTP 403 (devex/undp/mindev): кілька UA, не валиться весь скан
 *  - ВСІ 8 функцій: scanScheduled, scanSource, scanAll, rejectDetected,
 *    clearScanLogs, healthCheck, dailyFoundCounter, dailyDetectedCount
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');

const COL = { sources:'gf_sources', detected:'gf_detected', scanIdx:'gf_scan_index' };

// Ротація User-Agent — для обходу 403/503 (Google News, devex, undp)
const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
];
const UA = UA_LIST[0];
const FETCH_TIMEOUT = 12000;
const MAX_FAILS_BEFORE_PAUSE = 7;

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
  'купити','продаж','казино','ставки','порно',
  'login','logout','register','signup','privacy policy',
  'результати розіграш','переможець розіграш'
];
const BAD_TITLE = [
  /^\[?email\s*protected\]?/i, /^mailto:/i, /^https?:\/\//i,
  /^@/, /^\d+$/, /^[\s\W]+$/,
  /^(головна|контакти|про нас|about|home|menu|#|javascript|undefined|null)$/i,
  /cloudflare/i, /captcha/i, /^404|^not found/i, /access denied/i
];
// Службові слова навігації — пом'якшений non-UA фільтр.
// Відсіюємо ТІЛЬКИ якщо весь заголовок = службове слово (не якщо містить).
const NAV_WORDS = [
  'новини','про міністерство','команда','структура','контакти','напрями',
  'про нас','послуги','ціни','блог','вакансії','умови використання',
  'угода користувача','реєстрація','логін','довідка','конфіденційність',
  'partner with us','receive funding','about','home','menu','login','sign up',
  'privacy','terms','contact','news','careers'
];

function passesFilter(title, desc) {
  if (!title || title.length < 12) return false;
  if (BAD_TITLE.some(function(re) { return re.test(title.trim()); })) return false;
  if (title.trim().split(' ').length < 2) return false;
  var hay = (title + ' ' + desc).toLowerCase();
  if (SPAM.some(function(w) { return hay.indexOf(w) >= 0; })) return false;
  return GRANT_WORDS.some(function(w) { return hay.indexOf(w) >= 0; });
}

// Пом'якшена перевірка "не наша географія/навігація":
// блокуємо лише якщо заголовок ТОЧНО дорівнює службовому слову
function isNavWord(title) {
  var t = (title||'').trim().toLowerCase();
  return NAV_WORDS.indexOf(t) >= 0;
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

// ══════ FETCH з ротацією UA і retry ══════
async function safeFetch(url, opts) {
  opts = opts || {};
  var lastErr = null;
  // Пробуємо різні User-Agent при 403/503/429
  for (var attempt = 0; attempt < UA_LIST.length; attempt++) {
    try {
      var resp = await fetch(url, Object.assign({
        headers: { 'User-Agent': UA_LIST[attempt], 'Accept': 'text/html,application/xhtml+xml,application/xml,*/*' },
        timeout: FETCH_TIMEOUT, redirect: 'follow'
      }, opts));
      // 403/503/429 — пробуємо інший UA
      if ((resp.status === 403 || resp.status === 503 || resp.status === 429) && attempt < UA_LIST.length - 1) {
        await new Promise(function(r){ setTimeout(r, 1500 * (attempt + 1)); }); // пауза перед retry
        continue;
      }
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' from ' + url.slice(0, 80));
      return resp;
    } catch (e) {
      lastErr = e;
      // DNS / connection — немає сенсу пробувати інший UA
      if (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' || e.code === 'ECONNREFUSED' || e.code === 'EHOSTUNREACH') throw e;
      if (attempt < UA_LIST.length - 1) { await new Promise(function(r){ setTimeout(r, 1000); }); continue; }
    }
  }
  throw lastErr || new Error('Fetch failed: ' + url.slice(0, 80));
}

// ══════ ДАТА в межах вікна ══════
function isWithinWindow(dateStr, windowDays) {
  if (!dateStr) return true;
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    return d >= cutoff;
  } catch(e) { return true; }
}

// ══════ ДЕТАЛЬНА СТОРІНКА ══════
async function fetchDetailPage(url) {
  if (!url || url.length < 10) return null;
  try {
    var resp = await safeFetch(url);
    var html = await resp.text();
    var $ = cheerio.load(html);
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie,.popup').remove();
    var text = $('article,.content,.post,.entry,main,.page-content,.grant-detail,.single-post').text().trim();
    if (!text || text.length < 50) text = $('body').text().trim();
    return text.replace(/\s+/g,' ').slice(0,8000);
  } catch(e) { return null; }
}

// ══════ МУЛЬТИ-ГРАНТ: кілька грантів на одній сторінці ══════
const MULTI_SELECTORS = [
  '.grant-item','.grant-card','.grant-block','.call-item','.opportunity',
  '[class*="grant"]','[class*="call"]','[class*="opportunity"]',
  'article','.item','.post','.card','.entry','.news-item','.program-item'
];

async function extractMultipleGrants(url) {
  if (!url) return null;
  try {
    var resp = await safeFetch(url);
    var html = await resp.text();
    var $ = cheerio.load(html);
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie').remove();

    // Спосіб 1: CSS-селектори блоків
    for (var si = 0; si < MULTI_SELECTORS.length; si++) {
      var blocks = $(MULTI_SELECTORS[si]);
      if (blocks.length < 3) continue;
      var items = [];
      blocks.each(function() {
        var el = $(this);
        var text = el.text().replace(/\s+/g,' ').trim();
        if (text.length < 40) return;
        if (!GRANT_WORDS.some(function(w){ return text.toLowerCase().indexOf(w)>=0; })) return;
        var hdr = el.find('h1,h2,h3,h4').first().text().trim() || el.find('a').first().text().trim();
        var blockUrl = el.find('a[href]').first().attr('href') || '';
        try { if (blockUrl && !blockUrl.startsWith('http')) blockUrl = new URL(blockUrl, url).toString(); } catch(e) {}
        items.push({ title:(hdr||text).slice(0,200), description:text.slice(0,1000), url:blockUrl||url, date:'' });
      });
      if (items.length >= 3) return items;
    }

    // Спосіб 2: посилання в контентній зоні
    var contentArea = $('main, .content, .entry-content, article, .post-content, #content, .page-content').first();
    var ctx = contentArea.length ? contentArea : $('body');
    var linkItems = [];
    var seenUrls = {};
    ctx.find('a[href]').each(function() {
      var el = $(this);
      var href = el.attr('href') || '';
      var text = el.text().trim().replace(/\s+/g,' ');
      if (!text || text.length < 15) return;
      if (BAD_TITLE.some(function(re){ return re.test(text); })) return;
      var fullUrl;
      try { fullUrl = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) { return; }
      if (fullUrl === url) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (seenUrls[fullUrl]) return;
      seenUrls[fullUrl] = true;
      var parentText = el.parent().text().replace(/\s+/g,' ').trim();
      var desc = parentText.length > text.length ? parentText.slice(0,500) : text;
      var hay = (text + ' ' + desc).toLowerCase();
      if (!GRANT_WORDS.some(function(w){ return hay.indexOf(w)>=0; })) return;
      if (SPAM.some(function(w){ return hay.indexOf(w)>=0; })) return;
      linkItems.push({ title:text.slice(0,200), description:desc, url:fullUrl, date:'' });
    });
    if (linkItems.length >= 3) return linkItems;

    // Спосіб 3: заголовки H2/H3
    var headerItems = [];
    ctx.find('h2,h3').each(function() {
      var hdr = $(this);
      var title = hdr.text().trim();
      if (!title || title.length < 15) return;
      if (BAD_TITLE.some(function(re){ return re.test(title); })) return;
      var desc = '';
      var next = hdr.next(); var safety = 0;
      while (next.length && !next.is('h2,h3') && safety < 10) {
        desc += ' ' + next.text(); next = next.next(); safety++;
      }
      desc = desc.replace(/\s+/g,' ').trim().slice(0,500);
      var hay = (title + ' ' + desc).toLowerCase();
      if (!GRANT_WORDS.some(function(w){ return hay.indexOf(w)>=0; })) return;
      var blockUrl = hdr.next('a').attr('href') || hdr.find('a').attr('href') || '';
      try { if (blockUrl && !blockUrl.startsWith('http')) blockUrl = new URL(blockUrl, url).toString(); } catch(e) {}
      headerItems.push({ title:title.slice(0,200), description:desc, url:blockUrl||url, date:'' });
    });
    if (headerItems.length >= 3) return headerItems;

    return null;
  } catch(e) { return null; }
}

// ══════ РОЗБИВКА TELEGRAM ПОСТА ══════
function splitTelegramPost(text) {
  var pats = [
    /\n\s*\n(?=[🔹🔸▪️•▶️➡️✅🔔💡📌🎯🌟⭐🟢🟡🔴])/u,
    /\n\s*\n(?=\d+[.)]\s)/
  ];
  for (var i = 0; i < pats.length; i++) {
    var parts = text.split(pats[i]).map(function(s){ return s.trim(); }).filter(function(s){ return s.length > 40; });
    if (parts.length >= 2) return parts;
  }
  return [text];
}

function stripHtml(h) {
  return String(h||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').replace(/\s+/g,' ').trim().slice(0,3000);
}

// ══════ ПАРСЕР RSS (з підтримкою Atom + windowDays) ══════
async function parseRSS(url, limit, windowDays) {
  var resp = await safeFetch(url);
  var xml = await resp.text();
  var p = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@_' });
  var d = p.parse(xml);
  var ch = (d.rss && d.rss.channel) ? d.rss.channel : (d.feed || {});
  var entries = ch.item || ch.entry || [];
  var arr = Array.isArray(entries) ? entries : (entries ? [entries] : []);
  return arr
    .filter(function(e){
      var ds = e.pubDate || e.published || e.updated || '';
      return isWithinWindow(ds, windowDays);
    })
    .slice(0, limit)
    .map(function(e){
      var link = e.link;
      if (Array.isArray(link)) {
        var alt = link.find(function(l){ return l['@_rel']==='alternate' || !l['@_rel']; });
        link = alt ? (alt['@_href'] || alt['#text'] || '') : (link[0]['@_href'] || '');
      } else if (typeof link === 'object') {
        link = link['@_href'] || link['#text'] || '';
      }
      var title = e.title;
      if (typeof title === 'object') title = title['#text'] || '';
      return {
        title: String(title||'').trim(),
        url: String(link||'').trim(),
        description: stripHtml(e.description||e.summary||e['content:encoded']||e.content||''),
        date: e.pubDate||e.published||e.updated||''
      };
    });
}

// ══════ ПАРСЕР TELEGRAM (з нормалізацією URL + windowDays) ══════
async function parseTelegram(url, limit, windowDays) {
  // Нормалізуємо: t.me/Channel → t.me/s/Channel (web preview)
  var tUrl = url;
  if (tUrl.indexOf('t.me/') >= 0 && tUrl.indexOf('t.me/s/') < 0) {
    tUrl = tUrl.replace('t.me/', 't.me/s/');
  }
  var resp = await safeFetch(tUrl);
  var html = await resp.text();
  var $ = cheerio.load(html);
  var items = [];
  $('.tgme_widget_message_wrap').each(function() {
    if (items.length >= limit) return false;
    var msg = $(this);
    var dateStr = msg.find('.tgme_widget_message_date time').attr('datetime') || '';
    if (!isWithinWindow(dateStr, windowDays)) return;
    var text = msg.find('.tgme_widget_message_text').text().trim();
    if (!text || text.length < 30) return;
    var lower = text.toLowerCase();
    if (SPAM.some(function(w){ return lower.indexOf(w)>=0; })) return;
    if (!GRANT_WORDS.some(function(w){ return lower.indexOf(w)>=0; })) return;
    var links = [];
    msg.find('.tgme_widget_message_text a[href]').each(function() {
      var h = $(this).attr('href') || '';
      if (h && !h.startsWith('tg://') && h.indexOf('t.me/') < 0) links.push(h);
    });
    var parts = splitTelegramPost(text);
    if (parts.length > 1) {
      parts.forEach(function(sp, i){
        var l2 = sp.toLowerCase();
        if (!GRANT_WORDS.some(function(w){ return l2.indexOf(w)>=0; })) return;
        if (SPAM.some(function(w){ return l2.indexOf(w)>=0; })) return;
        if (items.length < limit) items.push({ title:sp.slice(0,200), description:sp, url:links[i]||links[0]||'', date:dateStr });
      });
    } else {
      items.push({ title:text.slice(0,200), description:text, url:links[0]||'', date:dateStr });
    }
  });
  return items;
}

// ══════ ПАРСЕР СТОРІНКИ (з include/exclude + windowDays) ══════
async function parsePageLinks(url, limit, src, windowDays) {
  var resp = await safeFetch(url);
  var html = await resp.text();
  var $ = cheerio.load(html);
  var items = [];
  var includeKw = (src.link_include||'').toLowerCase().split(',').filter(Boolean);
  var excludeKw = (src.link_exclude||'').toLowerCase().split(',').filter(Boolean);
  // Спочатку шукаємо в контентних зонах, потім — всюди
  var contentSel = ['main a[href]','article a[href]','.content a[href]','.grants a[href]','.opportunities a[href]','a[href]'];
  for (var ci = 0; ci < contentSel.length; ci++) {
    $(contentSel[ci]).each(function() {
      if (items.length >= limit) return false;
      var href = $(this).attr('href') || '';
      var text = $(this).text().trim().replace(/\s+/g,' ');
      if (!text || text.length < 12 || !href) return;
      if (BAD_TITLE.some(function(re){ return re.test(text.trim()); })) return;
      var fullUrl;
      try { fullUrl = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) { return; }
      if (fullUrl===url || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto:')) return;
      if (items.some(function(it){ return it.url === fullUrl; })) return;
      var hay = (text + ' ' + href).toLowerCase();
      if (includeKw.length && !includeKw.some(function(k){ return hay.indexOf(k.trim())>=0; })) return;
      if (excludeKw.some(function(k){ return hay.indexOf(k.trim())>=0; })) return;
      var parent = $(this).parent();
      var dateEl = parent.find('time').attr('datetime') || parent.find('[class*="date"]').text().trim() || '';
      if (dateEl && !isWithinWindow(dateEl, windowDays)) return;
      items.push({ title:text, url:fullUrl, description:'', date:dateEl });
    });
    if (items.length >= 5) break;
  }
  return items;
}

// ══════ CORE SCANNER ══════
async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 3;
  var url = src.source_url || '';
  var parser = (src.parser_mode || 'page_links').toLowerCase();
  var windowDays = parseInt(src.scan_window_days) || 7;
  var now = new Date().toISOString();
  var raw = [];

  if (parser==='rss'||parser==='google_news_rss') raw = await parseRSS(url, 40, windowDays);
  else if (parser==='telegram') raw = await parseTelegram(url, 40, windowDays);
  else raw = await parsePageLinks(url, 40, src, windowDays);

  // Якщо сторінка дала мало — пробуємо мульти-грант парсинг
  var isMulti = false;
  if ((parser==='page_links') && raw.length < 3) {
    var multi = await extractMultipleGrants(url);
    if (multi && multi.length >= 3) { raw = multi; isMulti = true; }
  }

  // Фільтр: грантові + не службові навігаційні
  var nonUaDropped = 0;
  var passed = 0;
  var good = raw.filter(function(item) {
    if (isNavWord(item.title)) { nonUaDropped++; return false; }
    if (!passesFilter(item.title, item.description)) return false;
    passed++; return true;
  });

  var created=0, dupes=0, detailed=0;
  for (var gi = 0; gi < good.length; gi++) {
    var item = good[gi];
    if (created >= maxNew) break;
    var norm = (item.title||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,200);
    var dUrl = (item.url||'').toLowerCase().replace(/\/+$/,'');
    if (norm) { var e1 = await db.collection(COL.scanIdx).where('normalized_title','==',norm).limit(1).get(); if(!e1.empty){dupes++;continue;} }
    if (dUrl) { var e2 = await db.collection(COL.scanIdx).where('canonical_url','==',dUrl).limit(1).get(); if(!e2.empty){dupes++;continue;} }

    var cls = classify(item.title||'', item.description||'');
    var fullText = '';
    // Google News дає redirect-посилання (news.google.com/rss/articles/...),
    // які при detail-fetch повертають 503 і валять усе джерело. Тому для
    // google_news_rss НЕ робимо detail-fetch — заголовка+опису достатньо.
    var isGoogleNews = (parser === 'google_news_rss') || (item.url || '').indexOf('news.google.com') >= 0;
    if (item.url && String(src.fetch_details) !== 'false' && !isMulti && !isGoogleNews) {
      fullText = await fetchDetailPage(item.url);
      if (fullText && fullText.length > 100) {
        detailed++;
        var cls2 = classify(item.title||'', fullText);
        if (!cls.donor && cls2.donor) cls.donor = cls2.donor;
        if (!cls.deadline && cls2.deadline) cls.deadline = cls2.deadline;
        if (!cls.amount_text && cls2.amount_text) cls.amount_text = cls2.amount_text;
        if (!cls.topics && cls2.topics) cls.topics = cls2.topics;
        if (cls2.topics && cls.topics && cls2.topics.split(',').length > cls.topics.split(',').length) cls.topics = cls2.topics;
        if (!cls.applicants && cls2.applicants) cls.applicants = cls2.applicants;
        if (!cls.geography && cls2.geography) cls.geography = cls2.geography;
        if (cls2.auto_priority === 'high') cls.auto_priority = 'high';
      }
    }

    var detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
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

  var scanStatus = 'empty';
  if (raw.length > 0 && good.length === 0) scanStatus = 'filtered';
  else if (created > 0) scanStatus = 'ok_new';
  else if (dupes > 0 || good.length > 0) scanStatus = 'ok_dupes';

  var cnt = parseInt(src.found_count)||0;
  var histEntry = { at:now, status:scanStatus, raw:raw.length, passed:passed, new:created, dupes:dupes, non_ua:nonUaDropped, multi:isMulti, error:'' };

  var upd = {
    last_checked_at: now,
    last_success_at: created > 0 ? now : (src.last_success_at||''),
    found_count: cnt + created,
    last_error: '',
    consecutive_fails: 0,
    last_scan_status: scanStatus,
    last_scan_raw: raw.length,
    last_scan_passed: passed,
    last_scan_new: created,
    last_scan_dupes: dupes,
    last_scan_at: now
  };
  await db.collection(COL.sources).doc(sourceId).update(upd);

  var snap = await db.collection(COL.sources).doc(sourceId).get();
  var dd = snap.data();
  var hist = Array.isArray(dd.scan_history) ? dd.scan_history : [];
  hist.unshift(histEntry);
  if (hist.length > 30) hist = hist.slice(0, 30);
  await db.collection(COL.sources).doc(sourceId).update({ scan_history: hist });

  return { sourceId:sourceId, checked:raw.length, passed:passed, created:created, dupes:dupes, detailed:detailed, isMulti:isMulti };
}

// ══════ ОБРОБКА ПОМИЛКИ СКАНУВАННЯ ══════
async function handleScanError(docId, src, e) {
  var now = new Date().toISOString();
  var failCount = (parseInt(src.consecutive_fails) || 0) + 1;
  // Код помилки
  var errLabel = '';
  if (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN') errLabel = 'Домен не знайдено (DNS)';
  else if (e.code === 'ECONNREFUSED') errLabel = "З'єднання відхилено";
  else if (e.code === 'EHOSTUNREACH') errLabel = 'Хост недоступний';
  else if (e.type === 'aborted' || /timeout/i.test(e.message)) errLabel = 'Таймаут';
  else if (/HTTP 403/.test(e.message)) errLabel = 'Доступ заборонено (403)';
  else if (/HTTP 404/.test(e.message)) errLabel = 'Не знайдено (404)';
  else if (/HTTP 503/.test(e.message)) errLabel = 'Сервіс недоступний (503)';

  var histEntry = { at:now, status:'error', raw:0, passed:0, new:0, dupes:0, error:(errLabel||'')+' '+e.message.slice(0,150) };
  var upd = {
    last_checked_at: now,
    last_error: (errLabel ? errLabel + ': ' : '') + e.message.slice(0, 400),
    last_scan_status: 'error',
    last_scan_raw: 0, last_scan_new: 0, last_scan_dupes: 0,
    consecutive_fails: failCount
  };
  // DNS-помилки (домен не існує) — пауза одразу після 3 спроб
  var dnsErr = (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN');
  var pauseThreshold = dnsErr ? 3 : MAX_FAILS_BEFORE_PAUSE;
  if (failCount >= pauseThreshold) {
    upd.source_status = 'paused';
    upd.pause_reason = 'Авто-пауза: ' + failCount + ' помилок поспіль. ' + (errLabel || e.message.slice(0,80));
  }
  await db.collection(COL.sources).doc(docId).update(upd);
  var snap2 = await db.collection(COL.sources).doc(docId).get();
  var d2 = snap2.data();
  var hist = Array.isArray(d2.scan_history) ? d2.scan_history : [];
  hist.unshift(histEntry);
  if (hist.length > 30) hist = hist.slice(0, 30);
  await db.collection(COL.sources).doc(docId).update({ scan_history: hist });
}

// ══════════════════════════════════════════════════════════════
// EXPORTS — всі 8 функцій
// ══════════════════════════════════════════════════════════════

// 1. Scheduled — кожну хвилину, з урахуванням інтервалу джерела
exports.scanScheduled = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    var snap = await db.collection(COL.sources)
      .where('source_status','==','active')
      .orderBy('last_checked_at','asc')
      .limit(10).get();
    if (snap.empty) { console.log('No active sources'); return; }
    var now = Date.now();
    var doc = null, src = null;
    for (var i = 0; i < snap.docs.length; i++) {
      var s = snap.docs[i].data();
      var intervalMin = parseInt(s.scan_interval_min) || 1;
      var lastMs = s.last_checked_at ? new Date(s.last_checked_at).getTime() : 0;
      if ((now - lastMs) / 60000 >= intervalMin) { doc = snap.docs[i]; src = s; break; }
    }
    if (!doc) { console.log('No sources due'); return; }
    console.log('Scan: ' + (src.source_name || doc.id));
    try {
      var r = await scanSingle(doc.id, src, 3);
      console.log('Done: raw=' + r.checked + ' new=' + r.created + ' dup=' + r.dupes);
    } catch (e) {
      console.error('Error: ' + e.message);
      await handleScanError(doc.id, src, e);
    }
  });

// 2. HTTP: Scan one source (ручне сканування з UI)
exports.scanSource = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(204).send('');
  try {
    var sourceId = (req.body || {}).sourceId;
    if (!sourceId) return res.status(400).json({ error:'sourceId required' });
    var srcDoc = await db.collection(COL.sources).doc(sourceId).get();
    if (!srcDoc.exists) return res.status(404).json({ error:'Source not found' });
    try {
      var result = await scanSingle(sourceId, srcDoc.data(), 10);
      res.json(result);
    } catch(scanErr) {
      await handleScanError(sourceId, srcDoc.data(), scanErr);
      res.status(200).json({ error: scanErr.message, sourceId: sourceId, created: 0 });
    }
  } catch(e) {
    console.error('scanSource error:', e);
    res.status(500).json({ error:e.message });
  }
});

// 3. HTTP: Scan all active sources
exports.scanAll = functions
  .runWith({ timeoutSeconds:540, memory:'1GB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin','*');
    res.set('Access-Control-Allow-Methods','POST,GET,OPTIONS');
    res.set('Access-Control-Allow-Headers','Content-Type');
    if (req.method==='OPTIONS') return res.status(204).send('');
    try {
      var snap = await db.collection(COL.sources).where('source_status','==','active').get();
      var processed=0, created=0, errors=0;
      for (var i = 0; i < snap.docs.length; i++) {
        var doc = snap.docs[i];
        try { var r = await scanSingle(doc.id, doc.data(), 5); processed++; created += r.created||0; }
        catch(e) { errors++; try { await handleScanError(doc.id, doc.data(), e); } catch(_){} }
      }
      res.json({ processed:processed, created:created, errors:errors, total:snap.size });
    } catch(e) { res.status(500).json({ error:e.message }); }
  });

// 4. HTTP: Відхилити запис
exports.rejectDetected = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(204).send('');
  try {
    var body = req.body || {};
    var detectedId = body.detectedId, reason = body.reason;
    if (!detectedId) return res.status(400).json({ error:'detectedId required' });
    await db.collection(COL.detected).doc(detectedId).update({
      status: 'Відхилено',
      rejection_reason: reason || 'other',
      rejected_at: new Date().toISOString()
    });
    res.json({ ok:true, detectedId:detectedId, reason:reason||'other' });
  } catch(e) {
    console.error('rejectDetected error:', e);
    res.status(500).json({ error:e.message });
  }
});

// 5. HTTP: Очистити логи сканування джерела
exports.clearScanLogs = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(204).send('');
  try {
    var sourceId = (req.body || {}).sourceId;
    if (!sourceId) return res.status(400).json({ error:'sourceId required' });
    await db.collection(COL.sources).doc(sourceId).update({
      scan_history: [], last_error: '', consecutive_fails: 0
    });
    res.json({ ok:true, sourceId:sourceId });
  } catch(e) {
    console.error('clearScanLogs error:', e);
    res.status(500).json({ error:e.message });
  }
});

// 6. HTTP: Health check
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  try {
    var snap = await db.collection(COL.sources).where('source_status','==','active').get();
    res.json({ ok:true, activeSources:snap.size, time:new Date().toISOString(), version:'v6.1' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// 7. Scheduled: щоденний лічильник знайдених о 23:55
exports.dailyFoundCounter = functions.pubsub
  .schedule('55 23 * * *')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    try {
      var today = new Date().toISOString().slice(0, 10);
      var snap = await db.collection(COL.detected)
        .where('found_at', '>=', today + 'T00:00:00.000Z')
        .where('found_at', '<=', today + 'T23:59:59.999Z')
        .get();
      var todayCount = snap.size;
      var statsRef = db.collection('gf_settings').doc('main_stats');
      var statsSnap = await statsRef.get();
      var currentTotal = statsSnap.exists ? (statsSnap.data().total || 0) : 0;
      var histRef = db.collection('gf_settings').doc('daily_history');
      var histSnap = await histRef.get();
      var history = histSnap.exists ? (histSnap.data().days || []) : [];
      history.unshift({ date: today, count: todayCount, total: currentTotal });
      if (history.length > 365) history = history.slice(0, 365);
      await histRef.set({ days: history, updatedAt: new Date().toISOString() });
      console.log('Daily counter: ' + today + ' found=' + todayCount);
    } catch(e) { console.error('dailyFoundCounter error:', e.message); }
  });

// 8. Scheduled: щоденний підрахунок загальної кількості detected о 23:50
exports.dailyDetectedCount = functions.pubsub
  .schedule('50 23 * * *')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    try {
      // Рахуємо всю колекцію detected батчами
      var total = 0, last = null;
      while (true) {
        var q = db.collection(COL.detected).orderBy('detected_id').limit(500);
        if (last) q = q.startAfter(last);
        var snap = await q.get();
        total += snap.size;
        if (snap.docs.length < 500) break;
        last = snap.docs[snap.docs.length - 1].data().detected_id;
      }
      await db.collection('gf_settings').doc('main_stats').set({
        total: total, updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log('Daily detected total: ' + total);
    } catch(e) { console.error('dailyDetectedCount error:', e.message); }
  });
