/**
 * GrantFlow ScanEngine v3
 * - Кожну хвилину, 1 джерело, макс 2 записи
 * - М'які фільтри (більше результатів для налаштування)
 * - Широка географія (всі області)
 * - Авто-класифікація по блоках
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

// ══════ М'ЯКІ ФІЛЬТРИ ══════
// Пропускаємо якщо є ХОЧА Б ОДНЕ грантове слово
const GRANT_WORDS = [
  'грант','гранти','конкурс','програм','фінансуван','підтримк','можливіст',
  'заявк','відбір','стипенді','субгрант','мікрогрант',
  'grant','grants','funding','call','application','opportunity','fellowship',
  'scholarship','support','program','відновлен','реконструкц','розвиток',
  'проєкт','проект','ініціатив','допомог','обладнан'
];

// Відкидаємо ТІЛЬКИ явний спам
const SPAM = [
  'вакансія','вакансії','job','jobs','career','hiring','vacancy',
  'купити','продаж','казино','ставки','кредит','порно',
  'login','logout','register','signup','cookie','privacy policy'
];

function passesFilter(title, desc) {
  if (!title || title.length < 12) return false;
  var t = title.toLowerCase();
  // Відкидаємо навігацію
  if (/^(головна|контакти|про нас|about|home|menu|#|javascript|undefined)/.test(t)) return false;
  if (t.split(' ').length < 2) return false;
  
  var hay = (title + ' ' + desc).toLowerCase();
  // Спам — відкинути
  if (SPAM.some(function(w) { return hay.indexOf(w) >= 0; })) return false;
  // Грантове слово — пропустити (м'який фільтр)
  if (GRANT_WORDS.some(function(w) { return hay.indexOf(w) >= 0; })) return true;
  // Для Telegram і RSS — пропускаємо все що не спам (бо канали вже тематичні)
  return true;
}

// ══════ АВТО-КЛАСИФІКАЦІЯ ══════

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
  [/Save the Children/i,'Save the Children'],
  [/UKF|УКФ|Український культурний фонд/i,'УКФ'],
  [/Дія|Diia/i,'Дія'],[/КМУ|Кабінет Міністрів/i,'КМУ'],
  [/Мінцифри/i,'Мінцифри'],[/Мінрегіон/i,'Мінрегіон'],
  [/OSCE|ОБСЄ/i,'ОБСЄ'],[/Council of Europe|Рада Європи/i,'Рада Європи'],
  [/JICA/i,'JICA'],[/KOICA/i,'KOICA'],[/DOBRE/i,'DOBRE'],
  [/U-LEAD/i,'U-LEAD'],[/DECIDE/i,'DECIDE'],
  [/Heinrich B/i,'Heinrich Böll'],[/Konrad Adenauer/i,'Konrad Adenauer'],
  [/Friedrich Ebert/i,'Friedrich Ebert']
];

const TOPICS = [
  [/освіт|школ|ліцей|навчан|education|training|teacher|вчител/i,'Освіта'],
  [/культур|мистецтв|бібліотек|музей|culture|creative/i,'Культура'],
  [/молод|youth|студент/i,'Молодь'],
  [/ветеран|veteran|захисник|warrior/i,'Ветерани'],
  [/ВПО|переселен|IDP|displaced|internally/i,'ВПО/Переселенці'],
  [/жінк|гендер|gender|women|рівність/i,'Жінки/Гендер'],
  [/інклюзі|disability|інвалідн|доступніст/i,'Інклюзія'],
  [/екологі|environment|клімат|climate|довкілл/i,'Екологія'],
  [/здоров|медиц|health|амбулатор|лікарн|паліатив/i,'Медицина'],
  [/цифров|digital|IT|технолог|кібер/i,'Цифровізація'],
  [/енерг|energy|утеплен|котельн|сонячн|solar/i,'Енергоефективність'],
  [/інфраструктур|дорог|водопостачан|каналіз|infrastructure/i,'Інфраструктура'],
  [/соціальн|social|захист|poverty|бідніст/i,'Соціальний захист'],
  [/підприємн|бізнес|business|entrepreneur|МСП|SME/i,'Підприємництво'],
  [/громад|community|hromada|ОМС|місцев|самоврядув/i,'Громади'],
  [/відновлен|відбудов|reconstruction|recovery|rebuild/i,'Відновлення'],
  [/правозахист|human rights|право людини|демократ|governance/i,'Правозахист'],
  [/гуманітарн|humanitarian|допомог/i,'Гуманітарна допомога'],
  [/агро|сільськ\w+\s*господ|agricultur|farming|фермер/i,'Агро'],
  [/спорт|sport|фізичн/i,'Спорт'],
  [/туризм|tourism|travel/i,'Туризм'],
  [/психо|mental health|МНТР|trauma|травм/i,'Психосоціальна підтримка'],
  [/антикоруп|transparency|прозоріст|accountability/i,'Антикорупція'],
  [/медіа|media|журналіст|press/i,'Медіа']
];

const APPLICANTS = [
  [/громадськ\w+ організац|ГО\b|НУО|NGO|CSO|nonprofit|civil society|неприбутков/i,'Громадські організації'],
  [/ОМС|орган\w+ місцев|local government|municipality|сільськ\w+ рад|селищн|міськ\w+ рад/i,'ОМС'],
  [/заклад\w+ освіт|школ|ліцей|universit|коледж|інститут/i,'Заклади освіти'],
  [/бізнес|підприєм|малий|середній|SME|business|entrepreneur|ФОП/i,'Бізнес/Підприємці'],
  [/благодійн|charity|фонд/i,'Благодійні фонди'],
  [/молодіжн|youth org/i,'Молодіжні організації'],
  [/фізичн\w+ особ|individual|особист|кожен|кожна/i,'Фізичні особи'],
  [/заклад\w+ культур|бібліотек|музей|будинок культур/i,'Заклади культури'],
  [/комунальн|communal/i,'Комунальні підприємства'],
  [/ЦНАП|адміністративн\w+ послуг/i,'ЦНАП'],
  [/лікарн|амбулатор|медичн\w+ заклад/i,'Медичні заклади'],
  [/ОТГ|об.єднан\w+ громад/i,'ОТГ']
];

// ШИРОКА ГЕОГРАФІЯ — всі області + ключові позначки
const GEO = [
  [/вся Україна|всій Україн|all Ukraine|nationwide|загальнонац|по всій/i,'Вся Україна'],
  [/міжнародн|international|global|worldwide/i,'Міжнародно'],
  [/Вінниц/i,'Вінницька'],[/Волин/i,'Волинська'],[/Дніпр/i,'Дніпропетровська'],
  [/Донецьк/i,'Донецька'],[/Житомир/i,'Житомирська'],[/Закарпат/i,'Закарпатська'],
  [/Запоріж/i,'Запорізька'],[/Івано-Франків/i,'Івано-Франківська'],
  [/Київ/i,'Київська'],[/Кіровоградськ/i,'Кіровоградська'],
  [/Луганськ/i,'Луганська'],[/Львів/i,'Львівська'],[/Миколаїв/i,'Миколаївська'],
  [/Одес/i,'Одеська'],[/Полтав/i,'Полтавська'],[/Рівн/i,'Рівненська'],
  [/Сум/i,'Сумська'],[/Тернопіл/i,'Тернопільська'],[/Харків/i,'Харківська'],
  [/Херсон/i,'Херсонська'],[/Хмельниц/i,'Хмельницька'],
  [/Черкас/i,'Черкаська'],[/Чернівец/i,'Чернівецька'],[/Чернігів/i,'Чернігівська'],
  [/громад|hromada|community|territorial/i,'Громади'],
  [/прифронтов|деокупован|постраждал|frontline|liberated/i,'Постраждалі території'],
  [/сільськ|село|селище|rural/i,'Сільські території'],
  [/малі міст|small town|small city/i,'Малі міста']
];

function extractDeadline(text) {
  var months = {'січня':'01','лютого':'02','березня':'03','квітня':'04','травня':'05','червня':'06',
    'липня':'07','серпня':'08','вересня':'09','жовтня':'10','листопада':'11','грудня':'12',
    'january':'01','february':'02','march':'03','april':'04','may':'05','june':'06',
    'july':'07','august':'08','september':'09','october':'10','november':'11','december':'12'};
  var m = text.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](20\d{2})/);
  if (m) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  m = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  var re = new RegExp('(\\d{1,2})\\s+(' + Object.keys(months).join('|') + ')\\s+(20\\d{2})', 'i');
  m = text.match(re);
  if (m) return m[3]+'-'+(months[m[2].toLowerCase()]||'01')+'-'+m[1].padStart(2,'0');
  return '';
}

function extractAmount(text) {
  var m = text.match(/[\$€£]\s*[\d,.\s]+|[\d,.\s]+\s*(грн|гривень|USD|EUR|доларів|євро)|до\s+[\d,.\s]+\s*(тис|млн|грн|USD|EUR)/i);
  return m ? m[0].trim().slice(0, 60) : '';
}

function classify(title, desc) {
  var hay = (title + ' ' + desc);
  var res = { donor:'', topics:'', applicants:'', geography:'', deadline:'', amount_text:'', auto_priority:'medium' };
  
  var d=[]; DONORS.forEach(function(p){if(p[0].test(hay)&&d.indexOf(p[1])<0)d.push(p[1]);}); res.donor=d.join(', ');
  var t=[]; TOPICS.forEach(function(p){if(p[0].test(hay)&&t.indexOf(p[1])<0)t.push(p[1]);}); res.topics=t.join(', ');
  var a=[]; APPLICANTS.forEach(function(p){if(p[0].test(hay)&&a.indexOf(p[1])<0)a.push(p[1]);}); res.applicants=a.join(', ');
  var g=[]; GEO.forEach(function(p){if(p[0].test(hay)&&g.indexOf(p[1])<0)g.push(p[1]);}); res.geography=g.join(', ');
  
  res.deadline = extractDeadline(hay);
  res.amount_text = extractAmount(hay);
  
  if (res.deadline) {
    var dl = new Date(res.deadline);
    res.auto_priority = dl > new Date() ? 'high' : 'low';
  }
  if (d.length && t.length) res.auto_priority = 'high';
  
  return res;
}

// ══════ SCHEDULED: кожну хвилину ══════
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
    console.log(`Scan: ${doc.data().source_name || doc.id}`);
    
    try {
      const r = await scanSingle(doc.id, doc.data(), 2);
      console.log(`Done: raw=${r.checked} grant=${r.grantItems} new=${r.created} skip=${r.filtered}`);
    } catch (e) {
      console.error(`Error: ${e.message}`);
      await db.collection(COL.sources).doc(doc.id).update({ last_checked_at: new Date().toISOString(), last_error: e.message });
    }
  });

// ══════ CORE SCANNER ══════
async function scanSingle(sourceId, src, maxNew) {
  maxNew = maxNew || 2;
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();
  let raw = [];

  if (parser === 'rss' || parser === 'google_news_rss') raw = await parseRSS(url, 30);
  else if (parser === 'telegram') raw = await parseTelegram(url, 30);
  else raw = await parsePageLinks(url, 30, src);

  let filtered = 0;
  const good = raw.filter(function(item) {
    if (!passesFilter(item.title, item.description)) { filtered++; return false; }
    return true;
  });

  let created = 0;
  for (const item of good) {
    if (created >= maxNew) break;
    const norm = (item.title||'').toLowerCase().trim().slice(0,200);
    const dUrl = (item.url||'').toLowerCase().replace(/\/+$/,'');
    if (norm) { const e = await db.collection(COL.scanIdx).where('normalized_title','==',norm).limit(1).get(); if (!e.empty) continue; }
    if (dUrl) { const e = await db.collection(COL.scanIdx).where('canonical_url','==',dUrl).limit(1).get(); if (!e.empty) continue; }

    const cls = classify(item.title||'', item.description||'');
    const detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    
    await db.collection(COL.detected).doc(detId).set({
      detected_id:detId, source_id:sourceId, source_name:src.source_name||'',
      source_url:url, detail_url:item.url||'',
      raw_title:item.title||'', short_desc:(item.description||'').slice(0,500),
      full_desc:item.description||'', found_at:new Date().toISOString(),
      status:'Виявлено', source_type:src.source_type||'', normalized_title:norm,
      donor:cls.donor||src.donor_hint||'', deadline:cls.deadline||'',
      amount_text:cls.amount_text||'', topics:cls.topics||src.source_topics||'',
      applicants:cls.applicants||src.applicants_hint||'',
      geography:cls.geography||src.geography_hint||'',
      auto_priority:cls.auto_priority||'medium'
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
  return { sourceId, checked:raw.length, grantItems:good.length, created, filtered };
}

// ══════ ПАРСЕРИ ══════
async function parseRSS(url, limit) {
  const resp = await fetch(url, {headers:{'User-Agent':UA},timeout:15000});
  const xml = await resp.text();
  const p = new XMLParser({ignoreAttributes:false});
  const d = p.parse(xml);
  const ch = d.rss?.channel||d.feed||{};
  const entries = ch.item||ch.entry||[];
  const arr = Array.isArray(entries)?entries:[entries];
  return arr.slice(0,limit).map(function(e){
    var link=e.link; if(typeof link==='object')link=link['@_href']||link['#text']||'';
    return{title:String(e.title||'').trim(),url:String(link||'').trim(),
      description:stripHtml(e.description||e.summary||e['content:encoded']||e.content||''),
      date:e.pubDate||e.published||e.updated||''};
  });
}

async function parseTelegram(url, limit) {
  const resp = await fetch(url, {headers:{'User-Agent':UA},timeout:15000});
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
}

async function parsePageLinks(url, limit, src) {
  const resp = await fetch(url, {headers:{'User-Agent':UA},timeout:15000});
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
    if(fullUrl===url||href.startsWith('#')||href.startsWith('javascript'))return;
    items.push({title:text,url:fullUrl,description:''});
  });
  return items;
}

function stripHtml(h){return String(h||'').replace(/<[^>]*>/g,' ').replace(/&\w+;/g,' ').replace(/\s+/g,' ').trim().slice(0,3000);}
