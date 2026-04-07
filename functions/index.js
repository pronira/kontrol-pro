/**
 * GrantFlow ScanEngine v5
 * Рефакторинг за аудитом 2026-04-03:
 * - Профільний парсинг (siteProfiles) для 12 ключових джерел
 * - canonicalizeUrlV2: зберігає pathname і важливі query-параметри
 * - age-gate = min(source.window_days, 365), дефолт 60 (не 14)
 * - passesFilter з mode strict/balanced/relaxed
 * - fetchAndParseDetail: contacts, attachments, application_link, publication_date
 * - ETag/Last-Modified кешування для RSS і page_links
 * - Retry з exponential backoff для 429/503/timeout
 * - Нові поля в gf_detected: publication_date, contacts, attachments, application_link
 * - Дедуп: unique_id = hash(sourceId+canonicalUrl); оновлення якщо content_hash змінився
 * - Нормалізація дат: скорочені укр місяці, діапазони дат, час
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const crypto = require('crypto');

const COL = {
  sources: 'gf_sources',
  detected: 'gf_detected',
  scanIdx: 'gf_scan_index'
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';
const GLOBAL_AGE_CAP = 365; // максимум днів, навіть якщо source.window_days більше
const DEFAULT_AGE_DAYS = 60; // дефолт якщо window_days не вказано (було 14 — тепер 60)

// ══════════════════════════════════════════════════════════════
// УТИЛІТИ
// ══════════════════════════════════════════════════════════════

function stripHtml(h) {
  return String(h || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

function simpleHash(str) {
  return crypto.createHash('md5').update(str || '').digest('hex').slice(0, 12);
}

function contentHash(item) {
  return simpleHash((item.title || '') + '|' + (item.description || '').slice(0, 500));
}

// ══════════════════════════════════════════════════════════════
// CANONICALIZE URL v2
// Зберігає pathname, видаляє тільки трекінг-параметри
// Залишає ідентифікаційні query-параметри (як ?grants=slug на Prostir)
// ══════════════════════════════════════════════════════════════

const TRACKING_PARAMS = new Set([
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
  'gclid','fbclid','msclkid','yclid','_ga','mc_cid','mc_eid',
  'ref','source','via','from','trk','share'
]);

// Query-параметри які є ідентифікаторами (по хосту)
const HOST_KEEP_PARAMS = {
  'prostir.ua': ['grants','p','page'],
  'gurt.org.ua': ['p','page'],
  'grant.market': ['page'],
};

function canonicalizeUrlV2(rawUrl) {
  try {
    const u = new URL(rawUrl);
    // Нормалізуємо протокол та hostname
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    u.hash = ''; // прибираємо fragment
    // Фільтруємо query params
    const keepParams = HOST_KEEP_PARAMS[u.hostname] || [];
    const paramsToDelete = [];
    for (const [key] of u.searchParams) {
      if (TRACKING_PARAMS.has(key) && !keepParams.includes(key)) {
        paramsToDelete.push(key);
      }
    }
    paramsToDelete.forEach(k => u.searchParams.delete(k));
    // Прибираємо trailing slash з pathname (крім root)
    if (u.pathname !== '/') {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString().toLowerCase();
  } catch (e) {
    return (rawUrl || '').toLowerCase().replace(/\/+$/, '').trim();
  }
}

function uniqueId(sourceId, canonicalUrl) {
  return 'gf_' + simpleHash(sourceId + '|' + canonicalUrl);
}

// ══════════════════════════════════════════════════════════════
// AGE GATE — відповідає window_days джерела
// ══════════════════════════════════════════════════════════════

function withinAgeGate(dateStr, windowDays) {
  if (!dateStr) return true; // немає дати — пропускаємо
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const maxAge = Math.min(windowDays || DEFAULT_AGE_DAYS, GLOBAL_AGE_CAP);
  const cutoff = new Date(Date.now() - maxAge * 24 * 3600 * 1000);
  return d >= cutoff;
}

// ══════════════════════════════════════════════════════════════
// ФІЛЬТРИ
// ══════════════════════════════════════════════════════════════

const GRANT_WORDS = [
  'грант','гранти','конкурс','програм','фінансуван','підтримк','можливіст',
  'заявк','відбір','стипенді','субгрант','мікрогрант',
  'grant','grants','funding','call','application','opportunity','fellowship',
  'scholarship','support program','відновлен','реконструкц','розвиток',
  'проєкт','проект','ініціатив','обладнан','deadline','дедлайн',
  'call for proposals','open call','оголошує конкурс','запрошує до участі',
  'подати заявк','прийом заяв','до участі запрошуються'
];

const SPAM = [
  'вакансія','вакансії','job opening','career','hiring','vacancy',
  'купити','продаж','оголошення продаж','казино','ставки','кредит','порно',
  'login','logout','register','signup','cookie policy','privacy policy',
  'terms of service','підписатися на розсилку'
];

const BAD_TITLE = [
  /^\[?email\s*protected\]?/i, /^mailto:/i, /^https?:\/\//i,
  /^@/, /^\d+$/, /^[\s\W]+$/,
  /^(головна|контакти|про нас|about|home|menu|#|javascript|undefined|null)/i,
  /cloudflare/i, /captcha/i, /404|not found/i, /access denied/i,
  /^(читати далі|детальніше|докладніше|more|read more|→|←|»|«)$/i
];

/**
 * passesFilter з mode: strict | balanced | relaxed
 * strict  — вимагає хоча б 1 грантове слово
 * balanced — поточна логіка (м'яка)
 * relaxed — Telegram/тематичні канали, пропускає майже все
 */
function passesFilter(title, desc, mode) {
  mode = mode || 'balanced';
  if (!title || title.length < 12) return false;
  if (BAD_TITLE.some(re => re.test(title.trim()))) return false;
  if (title.trim().split(' ').length < 2) return false;
  const hay = (title + ' ' + (desc || '')).toLowerCase();
  if (SPAM.some(w => hay.includes(w))) return false;
  const hasGrantWord = GRANT_WORDS.some(w => hay.includes(w));
  if (mode === 'strict') return hasGrantWord;
  if (mode === 'relaxed') return true;
  // balanced: пропускаємо якщо схоже на грантовий контент або не маємо інформації
  return true;
}

function getFilterMode(src) {
  if (src.filter_mode) return src.filter_mode;
  if (src.parser_mode === 'telegram') return 'relaxed';
  if (src.parser_mode === 'rss' || src.parser_mode === 'google_news_rss') return 'balanced';
  // page_links з "новинного" або "міністерського" сайту — strict
  const url = (src.source_url || '').toLowerCase();
  if (url.includes('minregion') || url.includes('kmu.gov') || url.includes('rada.gov')) return 'strict';
  return 'balanced';
}

// ══════════════════════════════════════════════════════════════
// ДЕДЛАЙН — розширений парсер
// Додано: скорочені укр. місяці, діапазони дат, час
// ══════════════════════════════════════════════════════════════

const MONTHS_MAP = {
  'січня':'01','лютого':'02','березня':'03','квітня':'04','травня':'05','червня':'06',
  'липня':'07','серпня':'08','вересня':'09','жовтня':'10','листопада':'11','грудня':'12',
  'січень':'01','лютий':'02','березень':'03','квітень':'04','травень':'05','червень':'06',
  'липень':'07','серпень':'08','вересень':'09','жовтень':'10','листопад':'11','грудень':'12',
  // скорочені форми (ГУРТ, Prostir)
  'січ':'01','лют':'02','бер':'03','квіт':'04','трав':'05','черв':'06',
  'лип':'07','серп':'08','вер':'09','жовт':'10','лист':'11','груд':'12',
  'january':'01','february':'02','march':'03','april':'04','may':'05','june':'06',
  'july':'07','august':'08','september':'09','october':'10','november':'11','december':'12',
  'jan':'01','feb':'02','mar':'03','apr':'04','jun':'06',
  'jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12'
};
const ALL_MONTH_NAMES = Object.keys(MONTHS_MAP).join('|');

function extractDeadline(text) {
  if (!text) return '';

  // Контекстний пошук: шукаємо дату біля ключових слів
  const ctxMatch = text.match(
    /(?:дедлайн|deadline|термін подач|до\s|until|before|by\b|closes?|closing|прийом до|подати до|прийом заявок до)[:\s\-–—]*(.{5,80})/i
  );
  const ctx = ctxMatch ? ctxMatch[1] : text;

  const tryDate = (str) => {
    // DD.MM.YYYY або DD/MM/YYYY
    let m = str.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](20\d{2})/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // YYYY-MM-DD
    m = str.match(/(20\d{2})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    // "14 January 2026" / "14 квітня 2026" / "14 квіт. 2026"
    const re1 = new RegExp(`(\\d{1,2})[\\s\\-\\.]+\\.?(${ALL_MONTH_NAMES})\\.?[\\s\\-\\.,]+(20\\d{2})`, 'i');
    m = str.match(re1);
    if (m) return `${m[3]}-${(MONTHS_MAP[m[2].toLowerCase().replace('.','')]||'01')}-${m[1].padStart(2,'0')}`;
    // "January 14, 2026"
    const re2 = new RegExp(`(${ALL_MONTH_NAMES})\\.?[\\s\\-\\.]+?(\\d{1,2})[\\s,]+(20\\d{2})`, 'i');
    m = str.match(re2);
    if (m) return `${m[3]}-${(MONTHS_MAP[m[1].toLowerCase().replace('.','')]||'01')}-${m[2].padStart(2,'0')}`;
    return '';
  };

  // Для діапазонів типу "02.04.2026 - 17.04.2026" — беремо кінцеву дату
  const rangeMatch = ctx.match(/(\d{1,2}[\.\/]\d{1,2}[\.\/]20\d{2})\s*[-–—]\s*(\d{1,2}[\.\/]\d{1,2}[\.\/]20\d{2})/);
  if (rangeMatch) {
    const d = tryDate(rangeMatch[2]);
    if (d) return d;
  }

  const fromCtx = tryDate(ctx);
  if (fromCtx) return fromCtx;
  if (ctx !== text) return tryDate(text);
  return '';
}

// ══════════════════════════════════════════════════════════════
// СУМА
// ══════════════════════════════════════════════════════════════

function extractAmount(text) {
  const patterns = [
    /(?:до|up to|max(?:imum)?|максимум|не більше)\s*[\$€£₴]?\s*[\d\s,.']+\s*(?:тис\.?|млн\.?|thousand|million|грн|UAH|USD|EUR)?/i,
    /[\$€£₴]\s*[\d\s,.']+ ?(?:тис\.?|млн\.?|thousand|million)?/i,
    /[\d\s,.']+\s*(?:грн|гривень|гривні|UAH|USD|EUR|доларів|євро|dollars|euros)/i,
    /грант(?:ова сума|у розмірі)[:\s]+[\d\s,.]+/i,
    /сума[:\s]+(?:до\s+)?[\d\s,.]+\s*(?:грн|USD|EUR)?/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim().replace(/\s+/g, ' ').slice(0, 80);
  }
  return '';
}

// ══════════════════════════════════════════════════════════════
// КЛАСИФІКАТОРИ (без змін логіки, розширено списки)
// ══════════════════════════════════════════════════════════════

const DONORS = [
  [/USAID/i,'USAID'],[/UNDP/i,'UNDP'],[/UNICEF/i,'UNICEF'],
  [/\bEU\b|Євросоюз|Євро\w+\s+Союз|European Union/i,'EU'],
  [/GIZ/i,'GIZ'],[/IREX/i,'IREX'],[/Erasmus/i,'Erasmus+'],
  [/House of Europe/i,'House of Europe'],[/British Council/i,'British Council'],
  [/SIDA|Швеці/i,'SIDA'],[/Світовий банк|World Bank/i,'World Bank'],
  [/ЄБРР|EBRD/i,'EBRD'],[/UNESCO|ЮНЕСКО/i,'UNESCO'],
  [/UNHCR/i,'UNHCR'],[/IOM|МОМ/i,'IOM'],
  [/Червон\w+ Хрест|Red Cross|IFRC/i,'Червоний Хрест'],
  [/Карітас|Caritas/i,'Карітас'],[/ГУРТ|GURT/i,'ГУРТ'],
  [/ІСАР|Єднання|ISAR/i,'ІСАР Єднання'],
  [/Фонд Сх\w+ Євро|EEF/i,'Фонд Східна Європа'],
  [/NED\b/i,'NED'],[/NDI\b/i,'NDI'],[/Pact\b/i,'Pact'],
  [/Open Society|Відродження/i,'Open Society'],
  [/Mercy Corps/i,'Mercy Corps'],[/ACTED/i,'ACTED'],
  [/People in Need|PIN\b/i,'People in Need'],
  [/UKF|УКФ|Укр\w+ культурний фонд/i,'УКФ'],
  [/Дія\.Бізнес|Дія бізнес|Diia/i,'Дія'],[/КМУ|Кабінет Міністрів/i,'КМУ'],
  [/OSCE|ОБСЄ/i,'ОБСЄ'],[/Council of Europe|Рада Європи/i,'Рада Європи'],
  [/JICA/i,'JICA'],[/DOBRE/i,'DOBRE'],[/U-LEAD/i,'U-LEAD'],
  [/Heinrich B/i,'Heinrich Böll'],[/Konrad Adenauer/i,'Konrad Adenauer'],
  [/STDF|Швейцарськ/i,'STDF/Швейцарія'],[/ReliefWeb/i,'ReliefWeb'],
  [/Devex/i,'Devex'],[/UNOCHA|OCHA/i,'UNOCHA']
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
  [/цифров|digital|IT\b|технолог/i,'Цифровізація'],
  [/енерг|energy|утеплен|котельн/i,'Енергоефективність'],
  [/інфраструктур|дорог|водопостачан/i,'Інфраструктура'],
  [/соціальн|social protection|захист населен/i,'Соціальний захист'],
  [/підприємн|бізнес|business|entrepreneur/i,'Підприємництво'],
  [/громад|community|hromada|ОМС|місцев самоврядув/i,'Громади'],
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
  const hay = (title || '') + ' ' + (desc || '');
  const r = { donor:'', topics:'', applicants:'', geography:'', deadline:'', amount_text:'', auto_priority:'medium' };
  const d=[], t=[], a=[], g=[];
  DONORS.forEach(p => { if (p[0].test(hay) && !d.includes(p[1])) d.push(p[1]); });
  TOPICS.forEach(p => { if (p[0].test(hay) && !t.includes(p[1])) t.push(p[1]); });
  APPLICANTS.forEach(p => { if (p[0].test(hay) && !a.includes(p[1])) a.push(p[1]); });
  GEO.forEach(p => { if (p[0].test(hay) && !g.includes(p[1])) g.push(p[1]); });
  r.donor = d.join(', ');
  r.topics = t.join(', ');
  r.applicants = a.join(', ');
  r.geography = g.join(', ');
  r.deadline = extractDeadline(hay);
  r.amount_text = extractAmount(hay);
  if (r.deadline) {
    r.auto_priority = new Date(r.deadline) > new Date() ? 'high' : 'low';
  }
  if (d.length && t.length) r.auto_priority = 'high';
  return r;
}

// ══════════════════════════════════════════════════════════════
// SITE PROFILES — профільний парсинг для ключових джерел
// Кожен профіль: listSelector, urlFilter, dateSelector, detailSelectors
// ══════════════════════════════════════════════════════════════

const SITE_PROFILES = {
  // Громадський простір / Prostir.ua
  'prostir.ua': {
    filterMode: 'balanced',
    listParse: ($, baseUrl) => {
      const items = [];
      // Картки грантів: h3 з посиланням на /category/grants або ?grants=
      $('h3 a[href], h2 a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (!text || text.length < 12) return;
        if (!href.includes('grants') && !href.includes('grant')) return;
        let fullUrl;
        try { fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString(); } catch(e) { return; }
        // Спробуємо знайти дату поруч
        const parent = $(el).closest('article, .post, li, .item, .grant-card');
        const dateText = parent.find('time, .date, .post-date').attr('datetime') ||
                         parent.find('time, .date, .post-date').text().trim() || '';
        items.push({ title: text, url: fullUrl, description: '', date: dateText });
      });
      return items;
    }
  },

  // ГУРТ
  'gurt.org.ua': {
    filterMode: 'strict',
    listParse: ($, baseUrl) => {
      const items = [];
      $('h2 a[href*="/news/grants/"], h3 a[href*="/news/grants/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (!text || text.length < 12) return;
        let fullUrl;
        try { fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString(); } catch(e) { return; }
        const parent = $(el).closest('article, li, .item, div');
        const dateText = parent.find('time, .date, .post-meta').attr('datetime') ||
                         parent.find('time, .date, .post-meta').text().trim() || '';
        items.push({ title: text, url: fullUrl, description: '', date: dateText });
      });
      return items;
    }
  },

  // Grant.Market
  'grant.market': {
    filterMode: 'balanced',
    listParse: ($, baseUrl) => {
      const items = [];
      // Ліки: посилання /opp/ або /grants/
      $('a[href*="/opp/"], a[href*="/grants/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (!text || text.length < 12) return;
        if (href.endsWith('/opp/') || href.endsWith('/grants/')) return; // skip listing pages
        let fullUrl;
        try { fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString(); } catch(e) { return; }
        items.push({ title: text, url: fullUrl, description: '' });
      });
      return items;
    }
  },

  // ReliefWeb — RSS (обробляється окремо, але профіль для detail)
  'reliefweb.int': { filterMode: 'balanced', listParse: null },

  // Devex
  'devex.com': { filterMode: 'strict', listParse: null },

  // UNDP Ukraine
  'ua.undp.org': {
    filterMode: 'strict',
    listParse: ($, baseUrl) => {
      const items = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!href.includes('grant') && !href.includes('funding') && !href.includes('call')) return;
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (!text || text.length < 12) return;
        let fullUrl;
        try { fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString(); } catch(e) { return; }
        items.push({ title: text, url: fullUrl, description: '' });
      });
      return items;
    }
  },

  // British Council
  'britishcouncil.org': {
    filterMode: 'strict',
    fetchTimeout: 25000, // підвищений таймаут
    listParse: ($, baseUrl) => {
      const items = [];
      $('main a[href*="grant"], main a[href*="funding"], h2 a, h3 a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (!text || text.length < 12) return;
        let fullUrl;
        try { fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString(); } catch(e) { return; }
        items.push({ title: text, url: fullUrl, description: '' });
      });
      return items;
    }
  },

  // Мінрегіон / урядові сторінки
  'minregion.gov.ua': {
    filterMode: 'strict',
    listParse: ($, baseUrl) => {
      const items = [];
      // Тільки контентні посилання, без header/footer/nav
      $('main a[href], .content a[href], article a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (!text || text.length < 12) return;
        // Виключаємо навігаційні посилання
        if (href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto:')) return;
        let fullUrl;
        try { fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString(); } catch(e) { return; }
        items.push({ title: text, url: fullUrl, description: '' });
      });
      return items;
    }
  }
};

function getProfile(src) {
  try {
    const hostname = new URL(src.source_url || '').hostname.replace(/^www\./, '');
    return SITE_PROFILES[hostname] || null;
  } catch(e) { return null; }
}

// ══════════════════════════════════════════════════════════════
// RETRY FETCH з exponential backoff
// ══════════════════════════════════════════════════════════════

async function fetchWithRetry(url, options, maxRetries) {
  maxRetries = maxRetries || 3;
  const baseDelay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);
      if (resp.status === 429 || resp.status === 503) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      return resp;
    } catch (e) {
      if (attempt < maxRetries && (e.type === 'system' || e.name === 'AbortError' || e.message.includes('timeout'))) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// ДЕТАЛЬНИЙ ПАРСИНГ СТОРІНКИ — структурований витяг
// contacts, attachments, application_link, publication_date
// ══════════════════════════════════════════════════════════════

const ATTACHMENT_EXTS = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|odt|ods)(\?.*)?$/i;

async function fetchAndParseDetail(url, timeout) {
  if (!url || url.length < 10) return null;
  timeout = timeout || 15000;
  try {
    const resp = await fetchWithRetry(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'uk,en;q=0.9' },
      timeout,
      redirect: 'follow'
    }, 2);
    if (!resp || !resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);

    // Видаляємо шум
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie,.popup,.breadcrumb').remove();

    // Основний контент
    let mainEl = $('article, .grant-detail, .single-post, .entry-content, .post-content, main, .content, .page-content').first();
    if (!mainEl.length) mainEl = $('body');
    const mainText = mainEl.text().replace(/\s+/g, ' ').trim().slice(0, 5000);

    // Дата публікації
    let publication_date = '';
    const timeEl = $('time[datetime]').first();
    if (timeEl.length) {
      publication_date = timeEl.attr('datetime') || '';
    }
    if (!publication_date) {
      const metaDate = $('meta[property="article:published_time"], meta[name="date"]').attr('content') || '';
      publication_date = metaDate;
    }
    if (!publication_date) {
      publication_date = extractDeadline(mainEl.find('.date, .post-date, .published').text()) || '';
    }

    // Email та телефони
    const emails = [];
    const phones = [];
    const emailRe = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const phoneRe = /(?:\+380|380|0)[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g;
    const bodyText = $('body').text();
    let m;
    while ((m = emailRe.exec(bodyText)) !== null) {
      if (!emails.includes(m[0]) && !m[0].includes('example.') && !m[0].includes('noreply')) {
        emails.push(m[0]);
      }
    }
    while ((m = phoneRe.exec(bodyText)) !== null) {
      const clean = m[0].replace(/\s/g, '');
      if (!phones.includes(clean)) phones.push(clean);
    }

    // Вкладення (attachments): PDF, DOC, ZIP тощо
    const attachments = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (ATTACHMENT_EXTS.test(href)) {
        let fullUrl;
        try { fullUrl = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) { return; }
        const filename = href.split('/').pop().split('?')[0];
        const ext = (filename.match(/\.([a-z0-9]+)(\?|$)/i) || [])[1] || '';
        if (!attachments.find(a => a.url === fullUrl)) {
          attachments.push({ url: fullUrl, filename, ext: ext.toLowerCase() });
        }
      }
    });

    // Application link: кнопки "Подати заявку", "Apply", "Register"
    let application_link = '';
    $('a[href]').each((_, el) => {
      if (application_link) return false;
      const txt = ($(el).text() || '').toLowerCase().trim();
      if (/подати заявк|apply now|submit.*application|register|зареєструват|подати заяв|заповни форм/.test(txt)) {
        const href = $(el).attr('href') || '';
        if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
          try { application_link = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) {}
        }
      }
    });

    // Секція "Контакти" — текст
    let contactSectionText = '';
    $('h2, h3, h4').each((_, el) => {
      if (/контакт|contact/i.test($(el).text())) {
        contactSectionText = $(el).nextUntil('h2, h3, h4').text().replace(/\s+/g, ' ').trim().slice(0, 500);
        return false;
      }
    });

    return {
      mainText,
      publication_date,
      contacts: { emails, phones, page_section_text: contactSectionText },
      attachments,
      application_link
    };
  } catch(e) {
    console.warn(`fetchAndParseDetail error for ${url}: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// ПАРСЕРИ
// ══════════════════════════════════════════════════════════════

async function parseRSS(url, limit, src) {
  // Підтримка ETag/Last-Modified кешування
  const headers = { 'User-Agent': UA };
  if (src.last_etag) headers['If-None-Match'] = src.last_etag;
  if (src.last_modified) headers['If-Modified-Since'] = src.last_modified;

  const resp = await fetchWithRetry(url, { headers, timeout: 20000 }, 3);
  if (!resp) return [];

  // 304 Not Modified — нічого нового
  if (resp.status === 304) {
    console.log(`RSS 304 Not Modified: ${url}`);
    return [];
  }
  if (!resp.ok) throw new Error(`RSS fetch failed: ${resp.status}`);

  // Зберігаємо кеш-заголовки для наступного скану
  const newEtag = resp.headers.get('etag') || '';
  const newModified = resp.headers.get('last-modified') || '';

  const xml = await resp.text();
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const d = p.parse(xml);
  const ch = d.rss?.channel || d.feed || {};
  const entries = ch.item || ch.entry || [];
  const items = (Array.isArray(entries) ? entries : [entries]).slice(0, limit).map(e => {
    let link = e.link;
    if (typeof link === 'object') link = link['@_href'] || link['#text'] || '';
    return {
      title: String(e.title || '').trim(),
      url: String(link || '').trim(),
      description: stripHtml(e.description || e.summary || e['content:encoded'] || e.content || ''),
      date: e.pubDate || e.published || e.updated || ''
    };
  });

  return { items, newEtag, newModified };
}

async function parseTelegram(url, limit) {
  const resp = await fetchWithRetry(url, { headers: { 'User-Agent': UA }, timeout: 20000 }, 2);
  if (!resp || !resp.ok) throw new Error(`Telegram fetch failed: ${resp ? resp.status : 'no response'}`);
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];
  $('.tgme_widget_message_wrap').each((_, el) => {
    if (items.length >= limit) return false;
    const msg = $(el);
    const text = msg.find('.tgme_widget_message_text').text().trim();
    const links = [];
    msg.find('.tgme_widget_message_text a[href]').each((_, a) => {
      const h = $(a).attr('href') || '';
      if (h && !h.startsWith('tg://') && !h.includes('t.me/')) links.push(h);
    });
    const date = msg.find('.tgme_widget_message_date time').attr('datetime') || '';
    if (text && text.length > 30) {
      items.push({ title: text.slice(0, 200), description: text, url: links[0] || '', date });
    }
  });
  return items;
}

async function parsePageLinks(url, limit, src) {
  const profile = getProfile(src);
  const timeout = (profile && profile.fetchTimeout) || 18000;

  const resp = await fetchWithRetry(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'uk,en;q=0.9' },
    timeout
  }, 2);
  if (!resp || !resp.ok) throw new Error(`Page fetch failed: ${resp ? resp.status : 'no response'}`);
  const html = await resp.text();
  const $ = cheerio.load(html);

  // Профільний парсинг якщо є
  if (profile && profile.listParse) {
    const profileItems = profile.listParse($, url);
    return profileItems.slice(0, limit);
  }

  // Fallback: базовий витяг з покращеними фільтрами
  // Виключаємо header/footer/nav/sidebar
  $('header, footer, nav, .nav, .menu, .sidebar, .header, .footer').remove();

  const items = [];
  $('a[href]').each((_, el) => {
    if (items.length >= limit) return false;
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (!text || text.length < 15 || !href) return;
    if (href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto:')) return;
    // Виключаємо чисто навігаційні посилання
    if (/^(головна|menu|search|login|register|контакти|about|facebook|twitter|instagram|youtube)$/i.test(text)) return;
    let fullUrl;
    try { fullUrl = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) { return; }
    if (fullUrl === url) return;
    items.push({ title: text, url: fullUrl, description: '' });
  });
  return items;
}

// ══════════════════════════════════════════════════════════════
// SCHEDULED FUNCTION — 1 джерело/хвилину
// ══════════════════════════════════════════════════════════════

exports.scanScheduled = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    const snap = await db.collection(COL.sources)
      .where('source_status', '==', 'active')
      .orderBy('last_checked_at', 'asc')
      .limit(1)
      .get();
    if (snap.empty) { console.log('No active sources'); return; }
    const doc = snap.docs[0];
    const src = doc.data();
    console.log(`Scan: ${src.source_name || doc.id} [${src.parser_mode}]`);
    try {
      const r = await scanSingle(doc.id, src, 3);
      console.log(`Done: raw=${r.checked} pass=${r.passed} new=${r.created} dup=${r.dupes} detail=${r.detailed}`);
    } catch (e) {
      console.error(`Error scanning ${doc.id}: ${e.message}`);
      await db.collection(COL.sources).doc(doc.id).update({
        last_checked_at: new Date().toISOString(),
        last_error: e.message
      });
    }
  });

// ══════════════════════════════════════════════════════════════
// CORE SCAN — основна логіка
// ══════════════════════════════════════════════════════════════

async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 3;
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();
  const windowDays = src.window_days || DEFAULT_AGE_DAYS;
  const filterMode = getFilterMode(src);

  let raw = [];
  let newEtag = '', newModified = '';

  if (parser === 'rss' || parser === 'google_news_rss') {
    const result = await parseRSS(url, 40, src);
    if (Array.isArray(result)) { raw = result; }
    else if (result && result.items) {
      raw = result.items;
      newEtag = result.newEtag || '';
      newModified = result.newModified || '';
    }
  } else if (parser === 'telegram') {
    raw = await parseTelegram(url, 40);
  } else {
    raw = await parsePageLinks(url, 40, src);
  }

  // Збереження ETag/Last-Modified якщо є
  if (newEtag || newModified) {
    const cacheUpdate = {};
    if (newEtag) cacheUpdate.last_etag = newEtag;
    if (newModified) cacheUpdate.last_modified = newModified;
    await db.collection(COL.sources).doc(sourceId).update(cacheUpdate);
  }

  // Фільтрація + age gate
  let passed = 0;
  const good = raw.filter(item => {
    if (!passesFilter(item.title, item.description, filterMode)) return false;
    if (item.date && !withinAgeGate(item.date, windowDays)) return false;
    passed++;
    return true;
  });

  let created = 0, dupes = 0, detailed = 0, updated = 0;

  for (const item of good) {
    if (created >= maxNew) break;

    const canonUrl = canonicalizeUrlV2(item.url || '');
    const normTitle = (item.title || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
    const uid = uniqueId(sourceId, canonUrl);
    const cHash = contentHash(item);

    // Дедуп v2: перевіряємо по unique_id
    if (canonUrl) {
      const existSnap = await db.collection(COL.scanIdx).doc(uid).get();
      if (existSnap.exists) {
        const existData = existSnap.data();
        // Якщо контент змінився — оновлюємо
        if (existData.content_hash && existData.content_hash !== cHash) {
          await db.collection(COL.scanIdx).doc(uid).update({
            content_hash: cHash,
            last_seen_at: new Date().toISOString(),
            update_count: (existData.update_count || 0) + 1
          });
          updated++;
        } else {
          dupes++;
        }
        continue;
      }
    }

    // Додатковий дедуп по normalized_title (для елементів без URL)
    if (normTitle && !canonUrl) {
      const titleSnap = await db.collection(COL.scanIdx)
        .where('normalized_title', '==', normTitle)
        .limit(1).get();
      if (!titleSnap.empty) { dupes++; continue; }
    }

    // Класифікація з базового тексту
    let cls = classify(item.title || '', item.description || '');

    // Детальний парсинг
    let detailData = null;
    if (item.url && String(src.fetch_details) !== 'false') {
      const profile = getProfile(src);
      const detailTimeout = (profile && profile.fetchTimeout) || 15000;
      detailData = await fetchAndParseDetail(item.url, detailTimeout);
      if (detailData && detailData.mainText && detailData.mainText.length > 100) {
        detailed++;
        const cls2 = classify(item.title || '', detailData.mainText);
        // Мерж: беремо більш інформативне значення
        if (!cls.donor && cls2.donor) cls.donor = cls2.donor;
        if (!cls.deadline && cls2.deadline) cls.deadline = cls2.deadline;
        if (!cls.amount_text && cls2.amount_text) cls.amount_text = cls2.amount_text;
        if (!cls.topics || cls2.topics.split(',').length > cls.topics.split(',').length) cls.topics = cls2.topics;
        if (!cls.applicants || cls2.applicants.split(',').length > cls.applicants.split(',').length) cls.applicants = cls2.applicants;
        if (!cls.geography && cls2.geography) cls.geography = cls2.geography;
        if (cls2.auto_priority === 'high') cls.auto_priority = 'high';
        // Якщо дедлайн не знайдено з класифікатора — шукаємо в детальному тексті
        if (!cls.deadline) cls.deadline = extractDeadline(detailData.mainText);
      }
    }

    const detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const docData = {
      detected_id: detId,
      source_id: sourceId,
      source_name: src.source_name || '',
      source_url: url,
      detail_url: item.url || '',
      raw_title: item.title || '',
      normalized_title: normTitle,
      short_desc: (item.description || '').slice(0, 500),
      full_desc: detailData ? detailData.mainText.slice(0, 3000) : (item.description || ''),
      found_at: new Date().toISOString(),
      status: 'Виявлено',
      source_type: src.source_type || '',
      donor: cls.donor || src.donor_hint || '',
      deadline: cls.deadline || '',
      amount_text: cls.amount_text || '',
      topics: cls.topics || src.source_topics || '',
      applicants: cls.applicants || src.applicants_hint || '',
      geography: cls.geography || src.geography_hint || '',
      auto_priority: cls.auto_priority || 'medium',
      has_detail_page: detailData ? 'true' : 'false',
      // Нові поля (UI ігнорує, але зберігаємо для якості та аналітики)
      publication_date: (detailData && detailData.publication_date) || item.date || '',
      contacts: (detailData && detailData.contacts) || { emails: [], phones: [] },
      attachments: (detailData && detailData.attachments) || [],
      application_link: (detailData && detailData.application_link) || '',
      canonical_url_v2: canonUrl,
      unique_id: uid
    };

    await db.collection(COL.detected).doc(detId).set(docData);

    // Індекс для дедуплікації
    await db.collection(COL.scanIdx).doc(uid).set({
      source_id: sourceId,
      canonical_url: canonUrl,
      normalized_title: normTitle,
      detected_id: detId,
      content_hash: cHash,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      update_count: 0
    });

    created++;
  }

  const cnt = parseInt(src.found_count) || 0;
  await db.collection(COL.sources).doc(sourceId).update({
    last_checked_at: new Date().toISOString(),
    last_success_at: created > 0 ? new Date().toISOString() : (src.last_success_at || ''),
    found_count: cnt + created,
    last_error: ''
  });

  return { sourceId, checked: raw.length, passed, created, dupes, updated, detailed };
}
