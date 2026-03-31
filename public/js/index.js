/**
 * ═══════════════════════════════════════════════════════════
 * GrantFlow ScanEngine — Firebase Cloud Functions
 * Сканує зовнішні сайти, RSS, Telegram канали
 * Записує знайдене у Firestore (gf_detected)
 * ═══════════════════════════════════════════════════════════
 *
 * ДЕПЛОЙ:
 *   cd C:\контроль
 *   firebase deploy --only functions
 *
 * ВИКЛИК:
 *   POST https://us-central1-kontrol-pro.cloudfunctions.net/scanSource
 *   Body: { "sourceId": "src_123" }
 *
 *   GET  https://us-central1-kontrol-pro.cloudfunctions.net/scanAll
 *
 * SCHEDULED: scanScheduled — кожні 30 хвилин автоматично
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');

const COL = {
  sources: 'gf_sources',
  detected: 'gf_detected',
  scanIdx: 'gf_scan_index',
  history: 'gf_history'
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

/* ══════ HTTP: Scan one source ══════ */
exports.scanSource = functions.https.onRequest(async (req, res) => {
  try {
    const { sourceId } = req.body || {};
    if (!sourceId) return res.status(400).json({ error: 'sourceId required' });

    const srcDoc = await db.collection(COL.sources).doc(sourceId).get();
    if (!srcDoc.exists) return res.status(404).json({ error: 'Source not found' });

    const result = await scanSingle(sourceId, srcDoc.data());
    res.json(result);
  } catch (e) {
    console.error('scanSource error:', e);
    res.status(500).json({ error: e.message });
  }
});

/* ══════ HTTP: Scan all active sources ══════ */
exports.scanAll = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      const snap = await db.collection(COL.sources)
        .where('source_status', '==', 'active')
        .get();
      let processed = 0, created = 0, errors = 0;
      for (const doc of snap.docs) {
        try {
          const r = await scanSingle(doc.id, doc.data());
          processed++;
          created += r.created || 0;
        } catch (e) {
          errors++;
          console.error(`Error scanning ${doc.id}:`, e.message);
        }
      }
      res.json({ processed, created, errors, total: snap.size });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

/* ══════ SCHEDULED: Auto-scan every 30 min ══════ */
exports.scanScheduled = functions.pubsub
  .schedule('every 30 minutes')
  .timeZone('Europe/Kyiv')
  .onRun(async () => {
    const snap = await db.collection(COL.sources)
      .where('source_status', '==', 'active')
      .get();
    let processed = 0, created = 0;
    for (const doc of snap.docs) {
      try {
        const r = await scanSingle(doc.id, doc.data());
        processed++;
        created += r.created || 0;
      } catch (e) {
        console.error(`Scheduled scan error ${doc.id}:`, e.message);
      }
    }
    console.log(`Scheduled scan: ${processed} sources, ${created} new items`);
  });

/* ══════ Core scanner ══════ */
async function scanSingle(sourceId, src) {
  const url = src.source_url || '';
  const parser = (src.parser_mode || 'page_links').toLowerCase();
  const limit = parseInt(src.item_limit) || 20;
  let items = [];

  try {
    if (parser === 'rss' || parser === 'google_news_rss') {
      items = await parseRSS(url, limit);
    } else if (parser === 'telegram') {
      items = await parseTelegram(url, limit);
    } else {
      items = await parsePageLinks(url, limit, src);
    }
  } catch (e) {
    console.error(`Parse error for ${sourceId}:`, e.message);
    await db.collection(COL.sources).doc(sourceId).update({
      last_checked_at: new Date().toISOString(),
      last_error: e.message
    });
    return { sourceId, checked: 0, created: 0, error: e.message };
  }

  // Deduplicate against existing
  let created = 0;
  for (const item of items) {
    const normalized = (item.title || '').toLowerCase().trim().slice(0, 200);
    const detailUrl = (item.url || '').toLowerCase().replace(/\/+$/, '');

    // Check scan index
    const existing = await db.collection(COL.scanIdx)
      .where('source_id', '==', sourceId)
      .where('normalized_title', '==', normalized)
      .limit(1).get();

    if (!existing.empty) continue;

    // Also check by URL
    if (detailUrl) {
      const byUrl = await db.collection(COL.scanIdx)
        .where('canonical_url', '==', detailUrl)
        .limit(1).get();
      if (!byUrl.empty) continue;
    }

    // Save to detected
    const detId = 'det_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await db.collection(COL.detected).doc(detId).set({
      detected_id: detId,
      source_id: sourceId,
      source_name: src.source_name || '',
      source_url: url,
      detail_url: item.url || '',
      raw_title: item.title || '',
      short_desc: (item.description || '').slice(0, 500),
      full_desc: item.description || '',
      deadline: item.deadline || '',
      donor: item.donor || src.donor_hint || '',
      amount_text: item.amount || '',
      geography: src.geography_hint || '',
      applicants: src.applicants_hint || '',
      topics: src.source_topics || '',
      found_at: new Date().toISOString(),
      status: 'Виявлено',
      auto_priority: 'medium',
      source_type: src.source_type || ''
    });

    // Save to scan index
    await db.collection(COL.scanIdx).add({
      source_id: sourceId,
      canonical_url: detailUrl,
      normalized_title: normalized,
      detected_id: detId,
      first_seen_at: new Date().toISOString(),
      status: 'new'
    });

    created++;
  }

  // Update source stats
  const currentCount = parseInt(src.found_count) || 0;
  await db.collection(COL.sources).doc(sourceId).update({
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    found_count: currentCount + created,
    last_error: ''
  });

  return { sourceId, checked: items.length, created };
}

/* ══════ RSS Parser ══════ */
async function parseRSS(url, limit) {
  const resp = await fetch(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
  const xml = await resp.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  let items = [];
  const channel = parsed.rss?.channel || parsed.feed || {};
  const entries = channel.item || channel.entry || [];
  const arr = Array.isArray(entries) ? entries : [entries];

  arr.slice(0, limit).forEach(e => {
    items.push({
      title: e.title || '',
      url: e.link?.['@_href'] || e.link || '',
      description: stripHtml(e.description || e.summary || e.content || ''),
      date: e.pubDate || e.published || e.updated || ''
    });
  });
  return items;
}

/* ══════ Telegram Parser ══════ */
async function parseTelegram(url, limit) {
  const resp = await fetch(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];

  $('.tgme_widget_message_wrap').each(function () {
    if (items.length >= limit) return false;
    const msg = $(this);
    const text = msg.find('.tgme_widget_message_text').text().trim();
    const link = msg.find('.tgme_widget_message_text a').attr('href') || '';
    const date = msg.find('.tgme_widget_message_date time').attr('datetime') || '';

    if (text && text.length > 20) {
      items.push({
        title: text.slice(0, 150),
        description: text,
        url: link,
        date: date
      });
    }
  });
  return items;
}

/* ══════ Page Links Parser ══════ */
async function parsePageLinks(url, limit, src) {
  const resp = await fetch(url, { headers: { 'User-Agent': UA }, timeout: 15000 });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const items = [];
  const includeKw = (src.link_include || '').toLowerCase().split(',').filter(Boolean);
  const excludeKw = (src.link_exclude || '').toLowerCase().split(',').filter(Boolean);

  $('a[href]').each(function () {
    if (items.length >= limit) return false;
    const href = $(this).attr('href') || '';
    const text = $(this).text().trim();
    if (!text || text.length < 10 || !href) return;

    const fullUrl = href.startsWith('http') ? href : new URL(href, url).toString();
    const hay = (text + ' ' + href).toLowerCase();

    // Include filter
    if (includeKw.length) {
      const hasInclude = includeKw.some(k => hay.includes(k.trim()));
      if (!hasInclude) return;
    }
    // Exclude filter
    if (excludeKw.some(k => hay.includes(k.trim()))) return;

    items.push({ title: text, url: fullUrl, description: '' });
  });
  return items;
}

/* ══════ Helpers ══════ */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}
