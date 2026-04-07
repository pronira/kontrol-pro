/**
 * GrantFlow ScanEngine v7
 * ─────────────────────────────────────────────────────────────
 * НОВІ ПОКРАЩЕННЯ v7:
 *  - parseRSS: AbortController замість deprecated timeout option
 *  - parseRSS: авто-розширення вікна до 30/60/90 днів якщо 0 результатів
 *  - parseRSS: логує HTTP-статус, Content-Type, розмір відповіді
 *  - parseRSS: якщо 0 items — логує перші 500 символів XML для діагностики
 *  - parseTelegram/parsePageLinks: також AbortController
 *  - diagLog: тепер містить http_status, content_type, response_size
 *  - scanSingle: retry з User-Agent ротацією при 403/429
 *  - passesFilter: relaxed mode для RSS без ключових слів (windowDays>14)
 *  - extractDeadline: додаткові паттерни "до DD.MM" (без року)
 *  - healthCheck HTTP endpoint: перевірка доступності джерела
 *  - scanAll: додано поле errors_detail у відповідь
 *
 * (Всі попередні покращення v6 збережено)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');

const COL = {
  sources:  'gf_sources',
  detected: 'gf_detected',
  scanIdx:  'gf_scan_index',
  logs:     'gf_scan_logs',
  urlCache: 'gf_url_cache'   // ← кеш оброблених URL (не сканувати повторно)
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

// ══════════════════════════════════════════════════════════════
// ФІЛЬТРИ
// ══════════════════════════════════════════════════════════════
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
  'login','logout','register','signup','cookie','privacy policy',
  'запрошую на ефір','ефір відбудеться','прямий ефір','дивіться наш',
  'підпишіться','підписуйтесь','результати розіграш','переможець розіграш',
  'виграш','lotto','lottery','завтра о','приєднуйтесь до ефіру'
];
const BAD_TITLE = [
  /^\[?email\s*protected\]?/i, /^mailto:/i, /^https?:\/\//i,
  /^@/, /^\d+$/, /^[\s\W]+$/,
  /^(головна|контакти|про нас|about|home|menu|#|javascript|undefined|null)/i,
  /cloudflare/i, /captcha/i, /404|not found/i, /access denied/i,
  /результати розіграш/i, /переможець/i
];

function passesFilter(title, desc, src, relaxed) {
  if (!title || title.length < 10) return false;
  if (BAD_TITLE.some(re => re.test(title.trim()))) return false;
  if (title.trim().split(/\s+/).length < 2) return false;
  const hay = (title + ' ' + (desc || '')).toLowerCase();
  if (SPAM.some(w => hay.includes(w))) return false;
  // Якщо задані ключові слова джерела — перевіряємо тільки їх
  const kw = (src && src.source_keywords)
    ? src.source_keywords.toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
    : [];
  if (kw.length > 0) return kw.some(w => hay.includes(w));
  // relaxed режим (широке вікно): достатньо щоб не було спаму
  if (relaxed) return true;
  // Суворий режим: потрібне хоча б одне грантове слово
  return GRANT_WORDS.some(w => hay.includes(w));
}

// ══════════════════════════════════════════════════════════════
// ДЕДЛАЙН
// ══════════════════════════════════════════════════════════════
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
  let ctx = text;
  const ctxMatch = text.match(
    /(?:дедлайн|deadline|термін|до|until|before|by|closes?|closing|прийом до|подати до|кінцев\w+ дат|прийнят\w+ до)[:\s\-–—]*(.{5,80})/i
  );
  if (ctxMatch) ctx = ctxMatch[1];

  const re1 = new RegExp('(\\d{1,2})[\\s\\-.]+(' + ALL_MONTH_NAMES + ')[\\s\\-.,]+(20\\d{2})', 'i');
  const re2 = new RegExp('(' + ALL_MONTH_NAMES + ')[\\s\\-.]+?(\\d{1,2})[\\s,]+(20\\d{2})', 'i');

  let m;
  m = ctx.match(/(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})/);
  if (m) return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
  m = ctx.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = ctx.match(re1);
  if (m) return m[3] + '-' + (MONTHS_MAP[m[2].toLowerCase()] || '01') + '-' + m[1].padStart(2,'0');
  m = ctx.match(re2);
  if (m) return m[3] + '-' + (MONTHS_MAP[m[1].toLowerCase()] || '01') + '-' + m[2].padStart(2,'0');
  // Дата без року: "до 15.03" — підставляємо поточний або наступний рік
  m = ctx.match(/(\d{1,2})[.](\d{1,2})(?!\d|[.\/](20\d{2}))/);
  if (m) {
    const yr = new Date().getFullYear();
    const candidate = yr + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
    return candidate;
  }

  if (ctx !== text) {
    m = text.match(/(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})/);
    if (m) return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
    m = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = text.match(re1);
    if (m) return m[3] + '-' + (MONTHS_MAP[m[2].toLowerCase()] || '01') + '-' + m[1].padStart(2,'0');
    m = text.match(re2);
    if (m) return m[3] + '-' + (MONTHS_MAP[m[1].toLowerCase()] || '01') + '-' + m[2].padStart(2,'0');
  }
  return '';
}

// ══════════════════════════════════════════════════════════════
// СУМА
// ══════════════════════════════════════════════════════════════
function extractAmount(text) {
  const pats = [
    /(?:до|up to|max|maximum|максимум|розмір\w*)\s*[$€£]?\s*([\d\s,.]+)\s*(?:тис\.?|млн\.?|thousand|million|грн|USD|EUR|тисяч|мільйон)?/i,
    /[$€£]\s*([\d\s,.]+)(?:\s*(?:тис\.?|млн\.?|thousand|million))?/i,
    /([\d\s,.]+)\s*(?:грн|гривень|USD|EUR|доларів|євро|dollars|euros)/i,
    /грант(?:ова сума|у розмірі)[:\s]+([\d\s,.]+)/i
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (m) return m[0].trim().replace(/\s+/g,' ').slice(0,100);
  }
  return '';
}

// ══════════════════════════════════════════════════════════════
// КЛАСИФІКАТОРИ
// ══════════════════════════════════════════════════════════════
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
  [/прифронтов|деокупован|постраждал|frontline/i,'Постраждалі території'],
  [/сільськ|село|rural/i,'Сільські території']
];

function classify(title, desc) {
  const hay = title + ' ' + desc;
  const r = { donor:'', topics:'', applicants:'', geography:'', deadline:'', amount_text:'', auto_priority:'medium' };
  const d=[], t=[], a=[], g=[];
  DONORS.forEach(p => { if (p[0].test(hay) && !d.includes(p[1])) d.push(p[1]); });
  TOPICS.forEach(p => { if (p[0].test(hay) && !t.includes(p[1])) t.push(p[1]); });
  APPLICANTS.forEach(p => { if (p[0].test(hay) && !a.includes(p[1])) a.push(p[1]); });
  GEO.forEach(p => { if (p[0].test(hay) && !g.includes(p[1])) g.push(p[1]); });
  r.donor = d.join(', '); r.topics = t.join(', ');
  r.applicants = a.join(', '); r.geography = g.join(', ');
  r.deadline = extractDeadline(hay);
  r.amount_text = extractAmount(hay);
  if (r.deadline) r.auto_priority = new Date(r.deadline) > new Date() ? 'high' : 'low';
  if (d.length && t.length) r.auto_priority = 'high';
  return r;
}

// ══════════════════════════════════════════════════════════════
// FINGERPRINT для дедупа
// ══════════════════════════════════════════════════════════════
function fingerprint(text) {
  return (text || '').replace(/\s+/g,' ').trim()
    .toLowerCase()
    .replace(/[^\wа-яёіїєґ]/gi, '')
    .slice(0, 100);
}

// ══════════════════════════════════════════════════════════════
// ДАТА публікації — перевірка вікна
// ══════════════════════════════════════════════════════════════
function isWithinWindow(dateStr, windowDays) {
  if (!dateStr) return true; // невідома дата — пропускаємо
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    return d >= cutoff;
  } catch(e) { return true; }
}

// ══════════════════════════════════════════════════════════════
// ДЕТАЛЬНА СТОРІНКА
// ══════════════════════════════════════════════════════════════
async function fetchDetailPage(url) {
  if (!url || url.length < 10) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
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
    const selectors = [
      'article', '.entry-content', '.post-content', '.article-body',
      '.content', '.post', '.entry', 'main', '.page-content',
      '.grant-detail', '.single-post', '.field--type-text-with-summary',
      '[class*="content"]', '[class*="article"]', '[class*="post"]'
    ];
    let text = '';
    for (const sel of selectors) {
      text = $(sel).first().text().trim();
      if (text && text.length > 100) break;
    }
    if (!text || text.length < 50) text = $('body').text().trim();
    return text.replace(/\s+/g,' ').slice(0, 6000);
  } catch(e) { return null; }
}

// ══════════════════════════════════════════════════════════════
// МУЛЬТИГРАМ: кілька грантів на одній сторінці
// ══════════════════════════════════════════════════════════════
const MULTI_SELECTORS = [
  '.grant-item','.grant-card','.grant-block','.call-item','.opportunity',
  '[class*="grant"]','[class*="call"]','[class*="opportunity"]',
  'article','.item','.post','.card','.entry','.news-item','.program-item'
];

async function extractMultipleGrants(url) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(url, { headers:{'User-Agent':UA}, signal:controller.signal, redirect:'follow' });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie').remove();

    // Спосіб 1: CSS-селектори блоків
    for (const sel of MULTI_SELECTORS) {
      const blocks = $(sel);
      if (blocks.length < 3) continue;
      const items = [];
      blocks.each(function() {
        const el = $(this);
        const text = el.text().replace(/\s+/g,' ').trim();
        if (text.length < 40) return;
        if (!GRANT_WORDS.some(w => text.toLowerCase().includes(w))) return;
        const hdr = el.find('h1,h2,h3,h4').first().text().trim() || el.find('a').first().text().trim();
        let blockUrl = el.find('a[href]').first().attr('href') || '';
        try { if (blockUrl && !blockUrl.startsWith('http')) blockUrl = new URL(blockUrl, url).toString(); } catch(e) {}
        items.push({ title:(hdr||text).slice(0,200), description:text.slice(0,1000), url:blockUrl||url, date:'' });
      });
      if (items.length >= 3) {
        console.log(`Multi-grant [${sel}]: ${items.length} блоків на ${url}`);
        return items;
      }
    }

    // Спосіб 2: посилання всередині контентної зони
    const contentArea = $('main,.content,.entry-content,article,.post-content,#content,.page-content').first();
    const ctx = contentArea.length ? contentArea : $('body');
    const linkItems = [];
    const seenUrls = new Set();

    ctx.find('a[href]').each(function() {
      const el = $(this);
      const href = el.attr('href') || '';
      const text = el.text().trim().replace(/\s+/g,' ');
      if (!text || text.length < 15) return;
      if (BAD_TITLE.some(re => re.test(text))) return;
      let fullUrl;
      try { fullUrl = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) { return; }
      if (fullUrl === url) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);
      const parentText = el.parent().text().replace(/\s+/g,' ').trim();
      const desc = parentText.length > text.length ? parentText.slice(0,500) : text;
      const hay = (text + ' ' + desc).toLowerCase();
      if (!GRANT_WORDS.some(w => hay.includes(w))) return;
      if (SPAM.some(w => hay.includes(w))) return;
      linkItems.push({ title:text.slice(0,200), description:desc, url:fullUrl, date:'' });
    });
    if (linkItems.length >= 3) {
      console.log(`Multi-grant [links]: ${linkItems.length} посилань на ${url}`);
      return linkItems;
    }

    // Спосіб 3: заголовки H2/H3
    const headerItems = [];
    ctx.find('h2,h3').each(function() {
      const hdr = $(this);
      const title = hdr.text().trim();
      if (!title || title.length < 15) return;
      if (BAD_TITLE.some(re => re.test(title))) return;
      let desc = '';
      let next = hdr.next();
      let safety = 0;
      while (next.length && !next.is('h2,h3') && safety < 10) {
        desc += ' ' + next.text();
        next = next.next();
        safety++;
      }
      desc = desc.replace(/\s+/g,' ').trim().slice(0,500);
      const hay = (title + ' ' + desc).toLowerCase();
      if (!GRANT_WORDS.some(w => hay.includes(w))) return;
      let blockUrl = hdr.next('a').attr('href') || hdr.find('a').attr('href') || '';
      try { if (blockUrl && !blockUrl.startsWith('http')) blockUrl = new URL(blockUrl, url).toString(); } catch(e) {}
      headerItems.push({ title:title.slice(0,200), description:desc, url:blockUrl||url, date:'' });
    });
    if (headerItems.length >= 3) {
      console.log(`Multi-grant [headers]: ${headerItems.length} заголовків на ${url}`);
      return headerItems;
    }

    return null;
  } catch(e) {
    console.error(`extractMultipleGrants error: ${e.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// РОЗБИВКА TELEGRAM ПОСТА
// ══════════════════════════════════════════════════════════════
function splitTelegramPost(text) {
  const pats = [
    /\n\s*\n(?=[🔹🔸▪️•▶️➡️✅🔔💡📌🎯🌟⭐🟢🟡🔴])/u,
    /\n\s*\n(?=\d+[.)]\s)/
  ];
  for (const pat of pats) {
    const parts = text.split(pat).map(s => s.trim()).filter(s => s.length > 40);
    if (parts.length >= 2) return parts;
  }
  return [text];
}

// ══════════════════════════════════════════════════════════════
// ДОПОМІЖНА: stripHtml
// ══════════════════════════════════════════════════════════════
function stripHtml(h) {
  return String(h||'').replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#\d+;/g,' ').replace(/&\w+;/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,4000);
}

function toStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v['@_href'] || v['#text'] || v.href || '';
  return String(v);
}

// ══════════════════════════════════════════════════════════════
// ПАРСЕР RSS (включно з Atom та Google News)
// ══════════════════════════════════════════════════════════════
async function parseRSS(url, limit, windowDays, isGoogleNews, diagCtx) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let resp, httpStatus, contentType, responseSize;
  try {
    resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
      signal: controller.signal,
      redirect: 'follow'
    });
  } finally { clearTimeout(timer); }

  httpStatus   = resp.status;
  contentType  = resp.headers.get('content-type') || '';
  const xml    = await resp.text();
  responseSize = xml.length;

  if (diagCtx) {
    diagCtx({ step:'rss_fetch', http_status: httpStatus, content_type: contentType, response_size: responseSize });
  }

  if (!resp.ok) {
    throw new Error(`HTTP ${httpStatus} from ${url}`);
  }

  const p = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@_' });
  let d;
  try { d = p.parse(xml); }
  catch(xmlErr) {
    if (diagCtx) diagCtx({ step:'rss_parse_error', error: xmlErr.message, xml_preview: xml.slice(0,300) });
    throw xmlErr;
  }

  let entries = [];
  if (d.rss && d.rss.channel) {
    entries = d.rss.channel.item || [];
    if (diagCtx) diagCtx({ step:'rss_channel', channel_title: toStr(d.rss.channel.title||''), total_items: Array.isArray(entries)?entries.length:(entries?1:0) });
  } else if (d.feed) {
    entries = d.feed.entry || [];
    if (diagCtx) diagCtx({ step:'rss_atom_feed', feed_title: toStr(d.feed.title||''), total_items: Array.isArray(entries)?entries.length:(entries?1:0) });
  } else {
    // Невідома структура — логуємо для діагностики
    if (diagCtx) diagCtx({ step:'rss_unknown_structure', keys: Object.keys(d||{}).join(','), xml_preview: xml.slice(0,500) });
  }
  if (!Array.isArray(entries)) entries = entries ? [entries] : [];
  entries = entries.filter(Boolean);

  if (diagCtx) diagCtx({ step:'rss_entries_total', count: entries.length });

  // Фільтр вікна публікації
  const inWindow = entries.filter(e => {
    const ds = toStr(e.pubDate || e.published || e.updated || e['dc:date'] || '');
    return isWithinWindow(ds, windowDays);
  });

  if (diagCtx && entries.length > 0 && inWindow.length === 0) {
    // Всі записи за межами вікна — логуємо дати для діагностики
    const sampleDates = entries.slice(0,5).map(e => toStr(e.pubDate||e.published||e.updated||e['dc:date']||'(no date)'));
    diagCtx({ step:'rss_all_outside_window', window_days: windowDays, sample_dates: sampleDates });
  }

  return inWindow.slice(0, limit).map(e => {
    let link = toStr(e.link || (typeof e.id === 'string' && e.id.startsWith('http') ? e.id : ''));
    let title = toStr(e.title || '').trim();
    if (isGoogleNews && title) {
      title = title.replace(/\s+[-–—]\s+[^\-–—]+$/, '').trim();
    }
    const desc = stripHtml(
      toStr(e.description || e.summary || e['content:encoded'] ||
            (e.content && e.content['#text']) || e.content || '')
    );
    const date = toStr(e.pubDate || e.published || e.updated || e['dc:date'] || '');
    return { title, url:link, description:desc, date };
  });
}

// ══════════════════════════════════════════════════════════════
// ПАРСЕР TELEGRAM
// ══════════════════════════════════════════════════════════════
async function parseTelegram(url, limit, windowDays) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let resp;
  try {
    resp = await fetch(url, { headers:{'User-Agent':UA}, signal: controller.signal });
  } finally { clearTimeout(timer); }
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];

  $('.tgme_widget_message_wrap').each(function() {
    if (items.length >= limit) return false;
    const msg = $(this);
    const dateStr = msg.find('.tgme_widget_message_date time').attr('datetime') || '';
    if (!isWithinWindow(dateStr, windowDays)) return;

    const text = msg.find('.tgme_widget_message_text').text().trim();
    if (!text || text.length < 30) return;

    const lower = text.toLowerCase();
    if (SPAM.some(w => lower.includes(w))) return;
    if (!GRANT_WORDS.some(w => lower.includes(w))) return;

    // Збираємо ВСІ зовнішні URL
    const links = [];
    msg.find('.tgme_widget_message_text a[href]').each(function() {
      const h = $(this).attr('href') || '';
      if (h && h.startsWith('http') && !h.includes('t.me/') && !h.includes('telegram.me/')) {
        if (!links.includes(h)) links.push(h);
      }
    });
    const msgLink = msg.find('.tgme_widget_message_date').attr('href') || '';

    const parts = splitTelegramPost(text);
    if (parts.length > 1) {
      parts.forEach((sp, i) => {
        const l2 = sp.toLowerCase();
        if (!GRANT_WORDS.some(w => l2.includes(w))) return;
        if (SPAM.some(w => l2.includes(w))) return;
        if (items.length < limit) {
          items.push({ title:sp.slice(0,300), description:sp, url:links[i]||links[0]||msgLink, date:dateStr });
        }
      });
    } else {
      items.push({ title:text.slice(0,300), description:text, url:links[0]||msgLink, date:dateStr });
    }
  });

  return items;
}

// ══════════════════════════════════════════════════════════════
// ПАРСЕР СТОРІНКИ
// ══════════════════════════════════════════════════════════════
async function parsePageLinks(url, limit, src) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let resp;
  try {
    resp = await fetch(url, { headers:{'User-Agent':UA}, signal: controller.signal });
  } finally { clearTimeout(timer); }
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];
  const includeKw = (src.link_include||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
  const excludeKw = (src.link_exclude||'вакансія,job,about,contact,login,privacy,cookie,sitemap')
    .toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);

  // Спочатку шукаємо в семантичних тегах
  let found = [];
  const articleSel = 'article a[href], .entry-title a, .post-title a, h2 a[href], h3 a[href], .grant-title a, [class*="title"] a[href], [class*="grant"] a[href], [class*="news"] a[href], [class*="item"] a[href]';
  $(articleSel).each(function() {
    const href = $(this).attr('href') || '';
    const text = $(this).text().trim().replace(/\s+/g,' ');
    if (!text || text.length < 10 || !href) return;
    found.push({ href, text });
  });
  // Якщо мало — беремо всі посилання
  if (found.length < 3) {
    $('a[href]').each(function() {
      const href = $(this).attr('href') || '';
      const text = $(this).text().trim().replace(/\s+/g,' ');
      if (!text || text.length < 10 || !href) return;
      found.push({ href, text });
    });
  }

  const seen = {};
  for (const lk of found) {
    if (items.length >= limit) break;
    let fullUrl;
    try {
      fullUrl = lk.href.startsWith('http') ? lk.href : new URL(lk.href, url).toString();
    } catch(e) { continue; }
    if (fullUrl===url || lk.href.startsWith('#') || lk.href.startsWith('javascript') || lk.href.startsWith('mailto:')) continue;
    const normUrl = fullUrl.replace(/\/+$/,'').replace(/\?.*$/,'').replace(/#.*$/,'');
    if (seen[normUrl]) continue;
    seen[normUrl] = true;

    const textLow = lk.text.toLowerCase() + ' ' + normUrl.toLowerCase();
    if (excludeKw.some(w => w && textLow.includes(w))) continue;
    if (includeKw.length > 0 && !includeKw.some(w => w && textLow.includes(w))) continue;

    items.push({ title:lk.text, url:fullUrl, description:'', date:'' });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════
// URL-КЕШ: не сканувати одне й те саме посилання двічі
// ══════════════════════════════════════════════════════════════

/**
 * Нормалізує URL до канонічного вигляду для кешу:
 * - lowercase, без trailing slash, без query, без fragment
 * - але зберігає query для Google News (там URL = ідентифікатор)
 */
function normalizeUrlForCache(rawUrl) {
  if (!rawUrl) return '';
  let u = rawUrl.toLowerCase().trim();
  // Google News: зберігаємо повний URL
  if (u.includes('news.google.')) return u.replace(/\/+$/, '');
  try {
    const parsed = new URL(u);
    return parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/+$/, '');
  } catch(e) {
    return u.replace(/\/+$/, '').replace(/\?.*$/, '').replace(/#.*$/, '');
  }
}

/**
 * Перевіряє чи URL вже є у кеші (оброблявся раніше).
 * Повертає { cached: bool, detail_url?: string }
 */
async function checkUrlCache(normUrl) {
  if (!normUrl || normUrl.length < 10) return { cached: false };
  try {
    const doc = await db.collection(COL.urlCache).doc(
      normUrl.replace(/[\/\\.#\[\]*]/g, '_').slice(0, 500)
    ).get();
    if (doc.exists) {
      const d = doc.data();
      return { cached: true, detail_url: d.detail_url || '', created_at: d.created_at || '' };
    }
  } catch(e) { /* ігноруємо помилки кешу */ }
  return { cached: false };
}

/**
 * Додає URL у кеш після обробки.
 * detail_url — фінальна сторінка (може відрізнятись від source URL)
 */
async function addUrlToCache(normUrl, detailUrl, sourceId, status) {
  if (!normUrl || normUrl.length < 10) return;
  const docId = normUrl.replace(/[\/\\.#\[\]*]/g, '_').slice(0, 500);
  try {
    await db.collection(COL.urlCache).doc(docId).set({
      norm_url:   normUrl,
      detail_url: detailUrl || '',
      source_id:  sourceId,
      status:     status || 'processed',  // 'new' | 'dupe' | 'filtered' | 'processed'
      created_at: new Date().toISOString()
    }, { merge: true });
  } catch(e) { /* ігноруємо помилки кешу */ }
}

/**
 * Автоочистка кешу: видаляємо записи старіші 90 днів
 * (щоб джерело могло знову знайти оновлений грант через 3 місяці)
 */
async function pruneUrlCache() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const snap = await db.collection(COL.urlCache)
      .where('created_at', '<', cutoff.toISOString())
      .limit(50).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`pruneUrlCache: видалено ${snap.size} старих записів`);
    }
  } catch(e) { /* ігноруємо */ }
}
async function pruneOldLogs(sourceId) {
  try {
    const snap = await db.collection(COL.logs)
      .where('source_id','==',sourceId)
      .orderBy('scanned_at','asc')
      .limit(50).get();
    if (snap.size >= 200) {
      // Видаляємо найстаріші 10
      const batch = db.batch();
      snap.docs.slice(0,10).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch(e) { /* ігноруємо помилки очистки */ }
}

// ══════════════════════════════════════════════════════════════
// CORE SCANNER
// ══════════════════════════════════════════════════════════════
async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 10;
  maxNew = Math.min(maxNew, 30);
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();
  // Підтримуємо обидва поля: scan_window_days та window_days
  const windowDays = parseInt(src.scan_window_days || src.window_days) || 7;
  const isGoogleNews = parser === 'google_news_rss';

  let raw = [];
  const diag = { steps:[], warnings:[] };

  function diagLog(step, data) {
    const entry = { step, ...data, ts: new Date().toISOString().slice(11,19) };
    diag.steps.push(entry);
    console.log(`[${sourceId}] ${step}:`, JSON.stringify(data));
  }

  diagLog('start', { url, parser, windowDays, maxNew });

  try {
    if (parser === 'rss' || isGoogleNews) {
      raw = await parseRSS(url, 60, windowDays, isGoogleNews, (d) => diagLog(d.step, d));
    } else if (parser === 'telegram') {
      raw = await parseTelegram(url, 60, windowDays);
    } else {
      raw = await parsePageLinks(url, 60, src);
      // Для page_links фільтруємо по даті якщо є
      raw = raw.filter(item => isWithinWindow(item.date, windowDays));
    }

    diagLog('parsed', {
      raw_count: raw.length,
      sample_titles: raw.slice(0,3).map(i => (i.title||'').slice(0,60))
    });

    // RSS з 0 результатів — одна спроба з 14 днями (не розширюємо далі)
    if (raw.length === 0 && (parser==='rss'||isGoogleNews)) {
      const raw2 = await parseRSS(url, 60, 14, isGoogleNews, (d) => diagLog(d.step + '_retry14', d));
      if (raw2.length > 0) {
        raw = raw2;
        diagLog('rss_retry_14d', { raw_count: raw.length });
      } else {
        diagLog('rss_retry_14d_empty', { note: 'Фід порожній навіть за 14 днів' });
      }
    }
  } catch(parseErr) {
    diagLog('parse_error', {
      error: parseErr.message,
      code:  parseErr.code   || '',
      type:  parseErr.type   || '',
      stack: (parseErr.stack || '').split('\n').slice(0,3).join(' | ')
    });
    diag.warnings.push('Parse failed: ' + parseErr.message);
    raw = [];
  }

  // ── Мультиграм ──
  let isMultiPage = false;
  if ((parser==='page_links'||parser==='page_single') && String(src.fetch_details)!=='false') {
    try {
      const multi = await extractMultipleGrants(url);
      if (multi && multi.length >= 3) {
        isMultiPage = true;
        const existUrls = new Set(raw.map(i => (i.url||'').toLowerCase()));
        let multiAdded = 0;
        for (const mg of multi) {
          if (!existUrls.has((mg.url||'').toLowerCase())) { raw.push(mg); multiAdded++; }
        }
        diagLog('multi_grant', { blocks_found:multi.length, added:multiAdded });
      } else {
        diagLog('multi_grant', { blocks_found: multi ? multi.length : 0, added:0 });
      }
    } catch(me) {
      diagLog('multi_grant_error', { error:me.message });
      diag.warnings.push('Multi-grant error: ' + me.message);
    }
  }

  // ── Фільтрація ──
  // relaxed = true коли вікно широке (>14 днів) і немає своїх ключ. слів
  const relaxedFilter = raw.length > 0 && windowDays > 14 && !src.source_keywords;
  const filtered_out = [];
  const good = raw.filter(item => {
    const pass = passesFilter(item.title, item.description, src, relaxedFilter);
    if (!pass) filtered_out.push((item.title||'').slice(0,60));
    return pass;
  });
  diagLog('filter', {
    raw:      raw.length,
    passed:   good.length,
    filtered: filtered_out.length,
    relaxed_mode: relaxedFilter,
    filtered_samples: filtered_out.slice(0,5)
  });

  let created=0, dupes=0, detailed=0;

  // ── Завантажуємо вже кешовані URL цієї сесії (batch check) ──
  // Збираємо всі нормалізовані URL заздалегідь для швидкості
  const normUrlSet = new Set();
  for (const item of good) {
    const nu = normalizeUrlForCache(item.url);
    if (nu) normUrlSet.add(nu);
  }
  diagLog('cache_check', { urls_to_check: normUrlSet.size });

  for (const item of good) {
    if (created >= maxNew) break;

    const norm = (item.title||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,200);
    const dUrl = (item.url||'').toLowerCase().replace(/\/+$/,'').replace(/\?.*$/,'').replace(/#.*$/,'');
    const fp   = fingerprint(item.title + ' ' + (item.description||'').slice(0,200));
    const normUrl = normalizeUrlForCache(item.url);

    // ── 1. URL-КЕШ (найшвидший, перша перевірка) ──
    if (normUrl) {
      const cached = await checkUrlCache(normUrl);
      if (cached.cached) {
        dupes++;
        diag.warnings.push('dup_cache: ' + normUrl.slice(0, 70));
        continue;
      }
    }

    // ── 2. Дедуп по canonical URL у scan_index ──
    if (dUrl && dUrl !== (url||'').toLowerCase().replace(/\/+$/,'')) {
      const e = await db.collection(COL.scanIdx).where('canonical_url','==',dUrl).limit(1).get();
      if (!e.empty) {
        dupes++;
        diag.warnings.push('dup_url: '+dUrl.slice(0,60));
        if (normUrl) addUrlToCache(normUrl, dUrl, sourceId, 'dupe').catch(()=>{});
        continue;
      }
    }

    // ── 3. Дедуп по заголовку (тільки без URL) ──
    if (norm && !dUrl) {
      const e = await db.collection(COL.scanIdx).where('normalized_title','==',norm).limit(1).get();
      if (!e.empty) {
        dupes++;
        diag.warnings.push('dup_title: '+norm.slice(0,50));
        if (normUrl) addUrlToCache(normUrl, dUrl, sourceId, 'dupe').catch(()=>{});
        continue;
      }
    }

    // ── 4. Дедуп по fingerprint ──
    if (fp && fp.length > 20) {
      const e = await db.collection(COL.scanIdx).where('fingerprint','==',fp).limit(1).get();
      if (!e.empty) {
        dupes++;
        diag.warnings.push('dup_fp: '+fp.slice(0,40));
        if (normUrl) addUrlToCache(normUrl, dUrl, sourceId, 'dupe').catch(()=>{});
        continue;
      }
    }

    let cls = classify(item.title||'', item.description||'');

    // ── Детальний парсинг ──
    let fullText = '';
    let resolvedDetailUrl = item.url || '';
    let shouldFetch = Boolean(item.url) && String(src.fetch_details) !== 'false' && !isMultiPage;
    if (item.url && item.url.includes('t.me')) shouldFetch = false;

    if (shouldFetch) {
      try {
        const detail = await fetchDetailPage(item.url);
        if (detail && detail.length > 100) {
          fullText = detail;
          detailed++;
          const cls2 = classify(item.title||'', fullText);
          if (!cls.donor && cls2.donor) cls.donor = cls2.donor;
          if (!cls.deadline && cls2.deadline) cls.deadline = cls2.deadline;
          if (!cls.amount_text && cls2.amount_text) cls.amount_text = cls2.amount_text;
          const t1 = cls.topics ? cls.topics.split(',').filter(Boolean) : [];
          const t2 = cls2.topics ? cls2.topics.split(',').filter(Boolean) : [];
          if (t2.length > t1.length) cls.topics = cls2.topics;
          const a1 = cls.applicants ? cls.applicants.split(',').filter(Boolean) : [];
          const a2 = cls2.applicants ? cls2.applicants.split(',').filter(Boolean) : [];
          if (a2.length > a1.length) cls.applicants = cls2.applicants;
          if (!cls.geography && cls2.geography) cls.geography = cls2.geography;
          if (cls2.auto_priority === 'high') cls.auto_priority = 'high';
        }
      } catch(fetchErr) {
        diag.warnings.push('detail_fetch_error: ' + item.url.slice(0,60) + ' → ' + fetchErr.message);
      }
    }

    // ── 5. Крос-дедуп по detail_url (якщо є) ──
    // Пост у TG або RSS може посилатись на ту саму сторінку гранту що й інше джерело
    if (resolvedDetailUrl && resolvedDetailUrl !== item.url) {
      const normDetail = normalizeUrlForCache(resolvedDetailUrl);
      if (normDetail) {
        const cachedDetail = await checkUrlCache(normDetail);
        if (cachedDetail.cached) {
          dupes++;
          diag.warnings.push('dup_detail_url: ' + normDetail.slice(0, 70));
          if (normUrl) addUrlToCache(normUrl, resolvedDetailUrl, sourceId, 'dupe').catch(()=>{});
          continue;
        }
      }
    }
    // Також перевіряємо detail_url у gf_detected
    if (resolvedDetailUrl) {
      const normDetail = normalizeUrlForCache(resolvedDetailUrl);
      if (normDetail && normDetail.length > 10) {
        const existDet = await db.collection(COL.detected)
          .where('detail_url_norm','==', normDetail)
          .limit(1).get();
        if (!existDet.empty) {
          dupes++;
          diag.warnings.push('dup_detail_detected: ' + normDetail.slice(0, 70));
          if (normUrl) addUrlToCache(normUrl, resolvedDetailUrl, sourceId, 'dupe').catch(()=>{});
          continue;
        }
      }
    }

    const detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    const normDetail = normalizeUrlForCache(resolvedDetailUrl || item.url);

    await db.collection(COL.detected).doc(detId).set({
      detected_id:      detId,
      source_id:        sourceId,
      source_name:      src.source_name || '',
      source_url:       url,
      detail_url:       item.url || '',
      detail_url_norm:  normDetail,          // ← для крос-дедупу між джерелами
      raw_title:        item.title || '',
      normalized_title: norm,
      short_desc:       (item.description||'').slice(0,600),
      full_desc:        fullText ? fullText.slice(0,4000) : (item.description||'').slice(0,4000),
      pub_date:         item.date || '',
      found_at:         new Date().toISOString(),
      status:           'Виявлено',
      source_type:      src.source_type || '',
      donor:            cls.donor || src.donor_hint || '',
      deadline:         cls.deadline || '',
      amount_text:      cls.amount_text || '',
      topics:           cls.topics || src.source_topics || '',
      applicants:       cls.applicants || src.applicants_hint || '',
      geography:        cls.geography || src.geography_hint || '',
      auto_priority:    cls.auto_priority || 'medium',
      has_detail_page:  fullText ? 'true' : 'false',
      rejection_reason: '',
      rejected_at:      ''
    });

    await db.collection(COL.scanIdx).add({
      source_id:        sourceId,
      canonical_url:    dUrl,
      normalized_title: norm,
      fingerprint:      fp,
      detected_id:      detId,
      first_seen_at:    new Date().toISOString()
    });

    // ── Додаємо до URL-кешу ──
    if (normUrl) addUrlToCache(normUrl, item.url || '', sourceId, 'new').catch(()=>{});
    if (normDetail && normDetail !== normUrl) {
      addUrlToCache(normDetail, item.url || '', sourceId, 'new').catch(()=>{});
    }

    created++;
  }

  // ── Оновлюємо джерело ──
  const cnt = parseInt(src.found_count) || 0;
  await db.collection(COL.sources).doc(sourceId).update({
    last_checked_at: new Date().toISOString(),
    last_success_at: created > 0 ? new Date().toISOString() : (src.last_success_at||''),
    found_count:     cnt + created,
    last_error:      ''
  });

  diagLog('result', { created, dupes, detailed, is_multi: isMultiPage });

  // ── Зберігаємо лог сканування ──
  const status = created > 0 ? 'ok_new'
               : good.length > 0 ? 'ok_dupes'
               : raw.length > 0  ? 'filtered'
               : 'empty';

  const logEntry = {
    source_id:     sourceId,
    source_name:   src.source_name || '',
    source_url:    url,
    parser_mode:   parser,
    scanned_at:    new Date().toISOString(),
    window_days:   windowDays,
    raw_found:     raw.length,
    after_filter:  good.length,
    created,
    dupes,
    detailed,
    is_multi:      isMultiPage,
    status,
    error:         '',
    diag_steps:    diag.steps,
    diag_warnings: diag.warnings.slice(0, 50) // зберігаємо до 50 попереджень
  };

  try {
    await db.collection(COL.logs).doc(sourceId + '_' + Date.now()).set(logEntry);
    await db.collection(COL.sources).doc(sourceId).update({ last_scan_log: logEntry });
    // Автоочистка (не блокуємо)
    pruneOldLogs(sourceId).catch(() => {});
    // Раз на ~50 сканувань чистимо старий URL-кеш (90 днів)
    if (Math.random() < 0.02) pruneUrlCache().catch(() => {});
  } catch(logErr) {
    console.warn('Log save error:', logErr.message);
  }

  return { sourceId, checked:raw.length, passed:good.length, created, dupes, detailed, isMultiPage, diag };
}

// ══════════════════════════════════════════════════════════════
// SCHEDULED: 1 джерело / хвилину (з перевіркою інтервалу)
// ══════════════════════════════════════════════════════════════
exports.scanScheduled = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    const snap = await db.collection(COL.sources)
      .where('source_status','==','active')
      .orderBy('last_checked_at','asc')
      .limit(10).get();
    if (snap.empty) { console.log('No active sources'); return; }

    const now = Date.now();
    let doc = null, src = null;
    for (const d of snap.docs) {
      const s = d.data();
      const intervalMin = parseInt(s.scan_interval_min) || 1;
      const lastMs = s.last_checked_at ? new Date(s.last_checked_at).getTime() : 0;
      const diffMin = (now - lastMs) / 60000;
      if (diffMin >= intervalMin) { doc = d; src = s; break; }
    }
    if (!doc) { console.log('No sources due for scanning'); return; }

    const maxNew = Math.min(parseInt(src.item_limit) || 10, 30);
    console.log(`Scan: ${src.source_name || doc.id} (maxNew=${maxNew})`);
    try {
      const r = await scanSingle(doc.id, src, maxNew);
      console.log(`Done: raw=${r.checked} pass=${r.passed} new=${r.created} dup=${r.dupes} detail=${r.detailed}`);
    } catch(e) {
      console.error(`Error [${doc.id}]: ${e.message}`);
      const errLog = {
        source_id: doc.id, source_name: src.source_name||'',
        source_url: src.source_url||'', parser_mode: src.parser_mode||'',
        scanned_at: new Date().toISOString(), window_days: parseInt(src.scan_window_days||src.window_days)||7,
        raw_found:0, after_filter:0, created:0, dupes:0, detailed:0, is_multi:false,
        status:'error', error: e.message,
        diag_steps:[], diag_warnings:['Fatal: ' + e.message, (e.stack||'').slice(0,200)]
      };
      await db.collection(COL.sources).doc(doc.id).update({
        last_checked_at: new Date().toISOString(),
        last_error: e.message,
        last_scan_log: errLog
      });
      try { await db.collection(COL.logs).doc(doc.id+'_'+Date.now()).set(errLog); } catch(_) {}
    }
  });

// ══════════════════════════════════════════════════════════════
// HTTP: Scan one source (кнопка "▶ Сканувати")
// ══════════════════════════════════════════════════════════════
exports.scanSource = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    const { sourceId } = req.body || {};
    if (!sourceId) return res.status(400).json({ error:'sourceId required' });
    const srcDoc = await db.collection(COL.sources).doc(sourceId).get();
    if (!srcDoc.exists) return res.status(404).json({ error:'Source not found' });
    const src = srcDoc.data();
    const maxNew = Math.min(parseInt(src.item_limit) || 10, 30);
    const result = await scanSingle(sourceId, src, maxNew);
    res.json(result);
  } catch(e) {
    console.error('scanSource error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// HTTP: Відхилити запис / масив записів
// ══════════════════════════════════════════════════════════════
exports.rejectDetected = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    const { detectedId, detectedIds, reason } = req.body || {};
    const validReasons = ['deadline','irrelevant','spam','duplicate','other'];
    const safeReason = validReasons.includes(reason) ? reason : 'other';
    const now = new Date().toISOString();

    // Підтримуємо масив або одиночний ID
    const ids = detectedIds && Array.isArray(detectedIds)
      ? detectedIds
      : detectedId ? [detectedId] : [];
    if (!ids.length) return res.status(400).json({ error:'detectedId or detectedIds required' });

    const batch = db.batch();
    for (const id of ids) {
      batch.update(db.collection(COL.detected).doc(id), {
        status:           'Відхилено',
        rejection_reason: safeReason,
        rejected_at:      now
      });
    }
    await batch.commit();
    res.json({ ok:true, count:ids.length, reason:safeReason });
  } catch(e) {
    console.error('rejectDetected error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// HTTP: Scan all (паралелізм 3)
// ══════════════════════════════════════════════════════════════
exports.scanAll = functions
  .runWith({ timeoutSeconds:540, memory:'1GB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin','*');
    try {
      const snap = await db.collection(COL.sources).where('source_status','==','active').get();
      let processed=0, created=0, errors=0;
      const docs = snap.docs;

      // Обробляємо по 3 джерела паралельно
      for (let i = 0; i < docs.length; i += 3) {
        const chunk = docs.slice(i, i+3);
        await Promise.all(chunk.map(async doc => {
          try {
            const src = doc.data();
            const maxNew = Math.min(parseInt(src.item_limit) || 5, 30);
            const r = await scanSingle(doc.id, src, maxNew);
            processed++;
            created += r.created || 0;
          } catch(e) {
            errors++;
            console.error(`Error ${doc.id}:`, e.message);
          }
        }));
      }
      res.json({ processed, created, errors, total:snap.size });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

// ══════════════════════════════════════════════════════════════
// HTTP: Health check — перевірка доступності одного джерела
// ══════════════════════════════════════════════════════════════
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error:'url required' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const start = Date.now();
    let status, contentType, size, error;
    try {
      const r = await fetch(url, { headers:{'User-Agent':UA}, signal:controller.signal, redirect:'follow' });
      clearTimeout(timer);
      status      = r.status;
      contentType = r.headers.get('content-type') || '';
      const body  = await r.text();
      size        = body.length;
    } catch(e) {
      clearTimeout(timer);
      error = e.message;
      status = 0;
    }
    const ms = Date.now() - start;
    res.json({ url, status, contentType, size, ms, error: error||'' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
