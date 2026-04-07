/**
 * GrantFlow ScanEngine v5
 * Зміни v5:
 *  - Фільтр 7 днів (scan_window_days з джерела або 7 за замовч.)
 *  - Дедуп по fingerprint першого речення + URL + нормалізований заголовок
 *  - Глибокий парсинг: сторінка з 3+ грантовими блоками → окремі записи
 *  - HTTP endpoint rejectDetected (статус Відхилено + причина)
 *  - Telegram: фільтр "ефір/розіграш", розбивка довгих постів
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
  scanIdx:  'gf_scan_index'
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

// ── ФІЛЬТРИ ──────────────────────────────────────────────────
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

function passesFilter(title, desc) {
  if (!title || title.length < 12) return false;
  if (BAD_TITLE.some(re => re.test(title.trim()))) return false;
  if (title.trim().split(' ').length < 2) return false;
  const hay = (title + ' ' + desc).toLowerCase();
  if (SPAM.some(w => hay.includes(w))) return false;
  // Суворий режим: лише якщо є грантові слова
  return GRANT_WORDS.some(w => hay.includes(w));
}

// ── ДЕДЛАЙН ──────────────────────────────────────────────────
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
  const ctxM = text.match(/(?:дедлайн|deadline|термін|крайн|до|until|before|by|closes?|closing|прийом до|подати до)[^\d]{0,20}(.{5,80})/i);
  if (ctxM) ctx = ctxM[1];

  const re1 = new RegExp('(\\d{1,2})[\\s\\-.]+(' + ALL_MONTH_NAMES + ')[\\s\\-.,]+(20\\d{2})', 'i');
  const re2 = new RegExp('(' + ALL_MONTH_NAMES + ')[\\s\\-.]+?(\\d{1,2})[\\s,]+(20\\d{2})', 'i');

  let m;
  m = ctx.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
  if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  m = ctx.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = ctx.match(re1);
  if (m) return m[3]+'-'+(MONTHS_MAP[m[2].toLowerCase()]||'01')+'-'+m[1].padStart(2,'0');
  m = ctx.match(re2);
  if (m) return m[3]+'-'+(MONTHS_MAP[m[1].toLowerCase()]||'01')+'-'+m[2].padStart(2,'0');

  if (ctx !== text) {
    m = text.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
    if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    m = text.match(re1);
    if (m) return m[3]+'-'+(MONTHS_MAP[m[2].toLowerCase()]||'01')+'-'+m[1].padStart(2,'0');
  }
  return '';
}

// ── СУМА ─────────────────────────────────────────────────────
function extractAmount(text) {
  const pats = [
    /(?:до|up to|max|maximum|максимум)\s*[$€£]?\s*[\d,.]+\s*(?:тис|млн|thousand|million|грн|USD|EUR)?/i,
    /[$€£]\s*[\d,.]+(?:\s*(?:тис|млн|thousand|million))?/i,
    /[\d,.]+\s*(?:грн|гривень|USD|EUR|доларів|євро|dollars|euros)/i,
    /грант(?:ова сума|у розмірі)[:\s]+[\d,.]+/i
  ];
  for (const p of pats) { const m = text.match(p); if (m) return m[0].trim().slice(0,80); }
  return '';
}

// ── КЛАСИФІКАТОРИ ────────────────────────────────────────────
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
  [/КМУ|Кабінет Міністрів/i,'КМУ'],
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
  r.donor=d.join(', '); r.topics=t.join(', '); r.applicants=a.join(', '); r.geography=g.join(', ');
  r.deadline = extractDeadline(hay);
  r.amount_text = extractAmount(hay);
  if (r.deadline) r.auto_priority = new Date(r.deadline) > new Date() ? 'high' : 'low';
  if (d.length && t.length) r.auto_priority = 'high';
  return r;
}

// ── FINGERPRINT для дедупа ────────────────────────────────────
function fingerprint(text) {
  return (text || '').replace(/\s+/g,' ').trim()
    .toLowerCase()
    .replace(/[^\wа-яёіїєґ]/gi, '')
    .slice(0, 100);
}

// ── ДАТА публікації ───────────────────────────────────────────
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

// ── ДЕТАЛЬНА СТОРІНКА ─────────────────────────────────────────
async function fetchDetailPage(url) {
  if (!url || url.length < 10) return null;
  try {
    const resp = await fetch(url, { headers:{'User-Agent':UA}, timeout:12000, redirect:'follow' });
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);
    $('script,style,nav,header,footer,aside,.menu,.sidebar,.nav,.cookie,.popup').remove();
    let text = $('article,.content,.post,.entry,main,.page-content,.grant-detail,.single-post').text().trim();
    if (!text || text.length < 50) text = $('body').text().trim();
    return text.replace(/\s+/g,' ').slice(0,8000);
  } catch(e) { return null; }
}

// ── МУЛЬТИГРАМ: кілька грантів на одній сторінці ─────────────
const MULTI_SELECTORS = [
  '.grant-item','.grant-card','.grant-block','.call-item','.opportunity',
  '[class*="grant"]','[class*="call"]','[class*="opportunity"]',
  'article','.item','.post','.card','.entry','.news-item','.program-item'
];

async function extractMultipleGrants(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { headers:{'User-Agent':UA}, timeout:12000, redirect:'follow' });
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
        const hdr = el.find('h1,h2,h3,h4').first().text().trim() ||
                    el.find('a').first().text().trim();
        let blockUrl = el.find('a[href]').first().attr('href') || '';
        try { if (blockUrl && !blockUrl.startsWith('http')) blockUrl = new URL(blockUrl, url).toString(); } catch(e) {}
        items.push({
          title: (hdr || text).slice(0,200),
          description: text.slice(0,1000),
          url: blockUrl || url,
          date: ''
        });
      });
      if (items.length >= 3) {
        console.log(`Multi-grant [${sel}]: ${items.length} блоків на ${url}`);
        return items;
      }
    }

    // Спосіб 2: посилання всередині контентної зони — кожне унікальне посилання = окремий грант
    // Для сторінок типу "список грантів" де кожен грант — окреме посилання в тексті
    const contentArea = $('main, .content, .entry-content, article, .post-content, #content, .page-content').first();
    const ctx = contentArea.length ? contentArea : $('body');
    
    const linkItems = [];
    const seenUrls = new Set();
    const baseHost = new URL(url).hostname;

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

      // Беремо контекст навколо посилання (батьківський елемент)
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

    // Спосіб 3: заголовки H2/H3 з текстом між ними — для сторінок без посилань
    const headerItems = [];
    ctx.find('h2,h3').each(function() {
      const hdr = $(this);
      const title = hdr.text().trim();
      if (!title || title.length < 15) return;
      if (BAD_TITLE.some(re => re.test(title))) return;

      // Текст між цим і наступним заголовком
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

      // Посилання всередині блоку
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

// ── РОЗБИВКА TELEGRAM ПОСТА ───────────────────────────────────
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

// ── ПАРСЕР RSS ────────────────────────────────────────────────
async function parseRSS(url, limit, windowDays) {
  const resp = await fetch(url, { headers:{'User-Agent':UA}, timeout:15000 });
  const xml = await resp.text();
  const p = new XMLParser({ ignoreAttributes:false });
  const d = p.parse(xml);
  const ch = d.rss?.channel || d.feed || {};
  const entries = ch.item || ch.entry || [];
  const arr = Array.isArray(entries) ? entries : [entries];

  return arr
    .filter(e => {
      const ds = e.pubDate || e.published || e.updated || '';
      return isWithinWindow(ds, windowDays);
    })
    .slice(0, limit)
    .map(e => {
      let link = e.link;
      if (typeof link === 'object') link = link['@_href'] || link['#text'] || '';
      return {
        title: String(e.title||'').trim(),
        url:   String(link||'').trim(),
        description: stripHtml(e.description||e.summary||e['content:encoded']||e.content||''),
        date: e.pubDate||e.published||e.updated||''
      };
    });
}

// ── ПАРСЕР TELEGRAM ───────────────────────────────────────────
async function parseTelegram(url, limit, windowDays) {
  const resp = await fetch(url, { headers:{'User-Agent':UA}, timeout:15000 });
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

    const links = [];
    msg.find('.tgme_widget_message_text a[href]').each(function() {
      const h = $(this).attr('href') || '';
      if (h && !h.startsWith('tg://') && !h.includes('t.me/')) links.push(h);
    });

    const parts = splitTelegramPost(text);
    if (parts.length > 1) {
      parts.forEach((sp, i) => {
        const l2 = sp.toLowerCase();
        if (!GRANT_WORDS.some(w => l2.includes(w))) return;
        if (SPAM.some(w => l2.includes(w))) return;
        if (items.length < limit) {
          items.push({ title:sp.slice(0,200), description:sp, url:links[i]||links[0]||'', date:dateStr });
        }
      });
    } else {
      items.push({ title:text.slice(0,200), description:text, url:links[0]||'', date:dateStr });
    }
  });

  return items;
}

// ── ПАРСЕР СТОРІНКИ ───────────────────────────────────────────
async function parsePageLinks(url, limit, src, windowDays) {
  const resp = await fetch(url, { headers:{'User-Agent':UA}, timeout:15000 });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];
  const includeKw = (src.link_include||'').toLowerCase().split(',').filter(Boolean);
  const excludeKw = (src.link_exclude||'').toLowerCase().split(',').filter(Boolean);

  $('a[href]').each(function() {
    if (items.length >= limit) return false;
    const href = $(this).attr('href') || '';
    const text = $(this).text().trim().replace(/\s+/g,' ');
    if (!text || text.length < 12 || !href) return;
    if (BAD_TITLE.some(re => re.test(text.trim()))) return;

    let fullUrl;
    try { fullUrl = href.startsWith('http') ? href : new URL(href, url).toString(); } catch(e) { return; }
    if (fullUrl===url || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto:')) return;

    const hay = (text + ' ' + href).toLowerCase();
    if (includeKw.length && !includeKw.some(k => hay.includes(k.trim()))) return;
    if (excludeKw.some(k => hay.includes(k.trim()))) return;

    const parent = $(this).parent();
    const dateEl = parent.find('time').attr('datetime') ||
                   parent.find('[class*="date"]').text().trim() || '';
    if (dateEl && !isWithinWindow(dateEl, windowDays)) return;

    items.push({ title:text, url:fullUrl, description:'', date:dateEl });
  });
  return items;
}

function stripHtml(h) {
  return String(h||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').replace(/\s+/g,' ').trim().slice(0,3000);
}

// ── CORE SCANNER ──────────────────────────────────────────────
async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 3;
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();
  const windowDays = parseInt(src.scan_window_days) || 7;
  let raw = [];
  const diag = { steps: [], warnings: [] }; // діагностика

  function diagLog(step, data) {
    diag.steps.push({ step, ...data, ts: new Date().toISOString().slice(11,19) });
    console.log(`[${sourceId}] ${step}:`, JSON.stringify(data));
  }

  diagLog('start', { url, parser, windowDays });

  try {
    if (parser==='rss'||parser==='google_news_rss') raw = await parseRSS(url, 40, windowDays);
    else if (parser==='telegram') raw = await parseTelegram(url, 40, windowDays);
    else raw = await parsePageLinks(url, 40, src, windowDays);
    diagLog('parsed', { raw_count: raw.length, sample_titles: raw.slice(0,3).map(i=>i.title.slice(0,40)) });
    // RSS з 0 результатів — спробуємо ширше вікно 7 днів
    if (raw.length === 0 && (parser==='rss'||parser==='google_news_rss')) {
      const raw2 = await parseRSS(url, 40, 7);
      if (raw2.length > 0) { raw = raw2; diagLog('rss_retry', { window:7, raw_count:raw.length }); }
    }
  } catch(parseErr) {
    diagLog('parse_error', { error: parseErr.message, code: parseErr.code||'', type: parseErr.type||'' });
    diag.warnings.push('Parse failed: ' + parseErr.message);
    raw = [];
  }

  // Мультиграм: шукаємо кілька грантів на одній сторінці
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
        diagLog('multi_grant', { blocks_found: multi.length, added: multiAdded });
      } else {
        diagLog('multi_grant', { blocks_found: multi ? multi.length : 0, added: 0 });
      }
    } catch(me) {
      diagLog('multi_grant_error', { error: me.message });
    }
  }

  // Детальна фільтрація з діагностикою
  const filtered_out = [];
  const good = raw.filter(item => {
    const pass = passesFilter(item.title, item.description);
    if (!pass) filtered_out.push(item.title.slice(0,60));
    return pass;
  });
  diagLog('filter', {
    raw: raw.length, passed: good.length, filtered: filtered_out.length,
    filtered_samples: filtered_out.slice(0,5)
  });

  let created=0, dupes=0, detailed=0;

  for (const item of good) {
    if (created >= maxNew) break;

    const norm = (item.title||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,200);
    const dUrl  = (item.url||'').toLowerCase().replace(/\/+$/,'');
    const fp    = fingerprint(item.title + ' ' + (item.description||'').slice(0,200));

    // Дедуп: заголовок
    if (norm) {
      const e = await db.collection(COL.scanIdx).where('normalized_title','==',norm).limit(1).get();
      if (!e.empty) { dupes++; diag.warnings.push('dup_title: '+norm.slice(0,50)); continue; }
    }
    // Дедуп: URL
    if (dUrl && dUrl !== (url||'').toLowerCase().replace(/\/+$/,'')) {
      const e = await db.collection(COL.scanIdx).where('canonical_url','==',dUrl).limit(1).get();
      if (!e.empty) { dupes++; diag.warnings.push('dup_url: '+dUrl.slice(0,60)); continue; }
    }
    // Дедуп: fingerprint
    if (fp && fp.length > 20) {
      const e = await db.collection(COL.scanIdx).where('fingerprint','==',fp).limit(1).get();
      if (!e.empty) { dupes++; diag.warnings.push('dup_fp: '+fp.slice(0,40)); continue; }
    }

    let cls = classify(item.title||'', item.description||'');

    // Детальний парсинг (якщо не мультисторінка — вже маємо текст)
    let fullText = '';
    if (item.url && String(src.fetch_details)!=='false' && !isMultiPage) {
      const detail = await fetchDetailPage(item.url);
      if (detail && detail.length > 100) {
        fullText = detail;
        detailed++;
        const cls2 = classify(item.title||'', fullText);
        if (!cls.donor && cls2.donor) cls.donor = cls2.donor;
        if (!cls.deadline && cls2.deadline) cls.deadline = cls2.deadline;
        if (!cls.amount_text && cls2.amount_text) cls.amount_text = cls2.amount_text;
        if (!cls.topics || cls2.topics.split(',').length > (cls.topics||'').split(',').length) cls.topics = cls2.topics;
        if (!cls.applicants || cls2.applicants.split(',').length > (cls.applicants||'').split(',').length) cls.applicants = cls2.applicants;
        if (!cls.geography && cls2.geography) cls.geography = cls2.geography;
        if (cls2.auto_priority==='high') cls.auto_priority = 'high';
      }
    }

    const detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    await db.collection(COL.detected).doc(detId).set({
      detected_id:      detId,
      source_id:        sourceId,
      source_name:      src.source_name || '',
      source_url:       url,
      detail_url:       item.url || '',
      raw_title:        item.title || '',
      normalized_title: norm,
      short_desc:       (item.description||'').slice(0,500),
      full_desc:        fullText ? fullText.slice(0,3000) : (item.description||''),
      found_at:         new Date().toISOString(),
      pub_date:         item.date || '',
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

    created++;
  }

  const cnt = parseInt(src.found_count) || 0;
  await db.collection(COL.sources).doc(sourceId).update({
    last_checked_at: new Date().toISOString(),
    last_success_at: created > 0 ? new Date().toISOString() : (src.last_success_at||''),
    found_count:     cnt + created,
    last_error:      ''
  });

  diagLog('result', { created, dupes, detailed, is_multi: isMultiPage });

  // ── Зберігаємо лог сканування ──
  const status = created > 0 ? 'ok_new' : good.length > 0 ? 'ok_dupes' : raw.length > 0 ? 'filtered' : 'empty';
  const logEntry = {
    source_id:    sourceId,
    source_name:  src.source_name || '',
    source_url:   url,
    parser_mode:  parser,
    scanned_at:   new Date().toISOString(),
    window_days:  windowDays,
    raw_found:    raw.length,
    after_filter: good.length,
    created:      created,
    dupes:        dupes,
    detailed:     detailed,
    is_multi:     isMultiPage,
    status:       status,
    error:        '',
    diag_steps:   diag.steps,
    diag_warnings: diag.warnings.slice(0, 20)
  };
  try {
    // Зберігаємо лог (тримаємо останні 50 записів на джерело)
    const logRef = db.collection('gf_scan_logs').doc(sourceId + '_' + Date.now());
    await logRef.set(logEntry);
    // Оновлюємо last_scan_log на самому джерелі для швидкого перегляду
    await db.collection(COL.sources).doc(sourceId).update({
      last_scan_log: logEntry
    });
  } catch(logErr) {
    console.warn('Log save error:', logErr.message);
  }

  return { sourceId, checked:raw.length, passed:good.length, created, dupes, detailed, isMultiPage };
}

// ── SCHEDULED: 1 джерело / хвилина ───────────────────────────
exports.scanScheduled = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    const snap = await db.collection(COL.sources)
      .where('source_status','==','active')
      .orderBy('last_checked_at','asc')
      .limit(10).get(); // беремо 10, вибираємо те що час настав
    if (snap.empty) { console.log('No active sources'); return; }
    // Вибираємо джерело де настав час (інтервал)
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
    console.log(`Scan: ${src.source_name || doc.id}`);
    try {
      const r = await scanSingle(doc.id, src, 3);
      console.log(`Done: raw=${r.checked} pass=${r.passed} new=${r.created} dup=${r.dupes} detail=${r.detailed}`);
    } catch(e) {
      console.error(`Error: ${e.message}`);
      const errLog = {
        source_id: doc.id, source_name: src.source_name||'',
        source_url: src.source_url||'', parser_mode: (src.parser_mode||''),
        scanned_at: new Date().toISOString(), window_days: parseInt(src.scan_window_days)||7,
        raw_found:0, after_filter:0, created:0, dupes:0, detailed:0, is_multi:false,
        status:'error', error: e.message
      };
      await db.collection(COL.sources).doc(doc.id).update({
        last_checked_at: new Date().toISOString(),
        last_error: e.message,
        last_scan_log: errLog
      });
      try { await db.collection('gf_scan_logs').doc(doc.id+'_'+Date.now()).set(errLog); } catch(_){}
    }
  });

// ── HTTP: Scan one source ─────────────────────────────────────
exports.scanSource = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(204).send('');
  try {
    const { sourceId } = req.body || {};
    if (!sourceId) return res.status(400).json({ error:'sourceId required' });
    const srcDoc = await db.collection(COL.sources).doc(sourceId).get();
    if (!srcDoc.exists) return res.status(404).json({ error:'Source not found' });
    const result = await scanSingle(sourceId, srcDoc.data(), 10);
    res.json(result);
  } catch(e) {
    console.error('scanSource error:', e);
    res.status(500).json({ error:e.message });
  }
});

// ── HTTP: Відхилити запис ─────────────────────────────────────
exports.rejectDetected = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if (req.method==='OPTIONS') return res.status(204).send('');
  try {
    const { detectedId, reason } = req.body || {};
    if (!detectedId) return res.status(400).json({ error:'detectedId required' });
    const validReasons = ['deadline','irrelevant','spam','duplicate','other'];
    const safeReason = validReasons.includes(reason) ? reason : 'other';
    await db.collection(COL.detected).doc(detectedId).update({
      status:           'Відхилено',
      rejection_reason: safeReason,
      rejected_at:      new Date().toISOString()
    });
    res.json({ ok:true, detectedId, reason:safeReason });
  } catch(e) {
    console.error('rejectDetected error:', e);
    res.status(500).json({ error:e.message });
  }
});

// ── HTTP: Scan all ───────────────────────────────────────────
exports.scanAll = functions
  .runWith({ timeoutSeconds:540, memory:'1GB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin','*');
    try {
      const snap = await db.collection(COL.sources).where('source_status','==','active').get();
      let processed=0, created=0, errors=0;
      for (const doc of snap.docs) {
        try { const r = await scanSingle(doc.id, doc.data(), 5); processed++; created+=r.created||0; }
        catch(e) { errors++; console.error(`Error ${doc.id}:`, e.message); }
      }
      res.json({ processed, created, errors, total:snap.size });
    } catch(e) { res.status(500).json({ error:e.message }); }
  });
