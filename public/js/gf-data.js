/* ═══════════════════════════════════════════════════════════
   gf-data.js — Firestore CRUD for GrantFlow
   Використовує глобальний db з firebase.js Контролів
   ═══════════════════════════════════════════════════════════ */

var GFC = {
  sources:'gf_sources', archive:'gf_sources_archive', detected:'gf_detected',
  opps:'gf_opportunities', assigns:'gf_assignments', tasks:'gf_tasks',
  approvals:'gf_approvals', notifs:'gf_notifications', history:'gf_history',
  contacts:'gf_contacts', settings:'gf_settings', scanIdx:'gf_scan_index'
};

/* ── Generic ── */
async function gfAll(col, ord, dir, lim) {
  var r = db.collection(col);
  if (ord) r = r.orderBy(ord, dir || 'desc');
  var s = await r.limit(lim || 500).get();
  var a = []; s.forEach(function(d) { a.push(Object.assign({_id:d.id}, d.data())); }); return a;
}

/* ── Читає ВСІ документи колекції батчами (для великих колекцій) ── */
async function gfAllPaged(col, ord, dir) {
  var r = db.collection(col);
  if (ord) r = r.orderBy(ord, dir || 'desc');
  var all = [], last = null, batchSize = 500;
  while (true) {
    var q = last ? r.startAfter(last).limit(batchSize) : r.limit(batchSize);
    var snap = await q.get();
    snap.forEach(function(d) { all.push(Object.assign({_id:d.id}, d.data())); });
    if (snap.docs.length < batchSize) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return all;
}
async function gfDoc(col, id) {
  var s = await db.collection(col).doc(id).get();
  return s.exists ? Object.assign({_id:s.id}, s.data()) : null;
}
async function gfAdd(col, data) { var r = await db.collection(col).add(data); return r.id; }
async function gfSet(col, id, data) { await db.collection(col).doc(id).set(data, {merge:true}); return id; }
async function gfUpd(col, id, data) { await db.collection(col).doc(id).update(data); return id; }
async function gfDel(col, id) { await db.collection(col).doc(id).delete(); return id; }
async function gfWhere(col, f, op, v, lim) {
  var r = db.collection(col).where(f, op, v);
  if (lim) r = r.limit(lim);
  var s = await r.get(); var a = []; s.forEach(function(d) { a.push(Object.assign({_id:d.id}, d.data())); }); return a;
}

/* ── Sources ── */
async function gfGetSources() { return gfAll(GFC.sources, 'source_name', 'asc'); }
async function gfSaveSource(d) {
  var id = d.source_id || d._id || 'src_' + Date.now();
  delete d._id;
  d.source_id = id;
  d.updated_at = new Date().toISOString();
  await gfSet(GFC.sources, id, d);
  return id;
}
async function gfArchiveSource(id, reason) {
  var src = await gfDoc(GFC.sources, id); if (!src) return;
  delete src._id;
  src.archive_reason = reason; src.archived_at = new Date().toISOString();
  await gfSet(GFC.archive, id, src);
  await gfDel(GFC.sources, id);
}

/* ── Detected ── */
/* Для відображення — остання 1000 записів (UI не потребує більше) */
async function gfGetDetected(limitN) { return gfAll(GFC.detected, 'found_at', 'desc', limitN || 1000); }

/* ── Статистика (лічильник) ── */
var GF_STATS_ID = 'main_stats';

async function gfGetStats() {
  var d = await gfDoc(GFC.settings, GF_STATS_ID);
  return d ? d : {
    total: 0, pending: 0, rejected: 0, approved: 0, highPriority: 0,
    rejectedToday: 0, rejected7: 0, rejected30: 0,
    approvedToday: 0, approved7: 0, approved30: 0,
    rejectedReasons: {}, topRejectedUsers: {}, topApprovedUsers: {},
    lastRebuild: null
  };
}

/* Оновлюємо лічильник при зміні статусу */
async function gfUpdateStatOnChange(oldStatus, newStatus, reason, user) {
  var today = new Date().toISOString().slice(0, 10);
  var rejSt = ['Не підходить', 'Видалено первинно'];
  var apprSt = ['Корисне', 'В базу'];

  var inc = {};
  var wasRej = rejSt.indexOf(oldStatus) >= 0;
  var wasAppr = apprSt.indexOf(oldStatus) >= 0;
  var wasPend = !oldStatus || oldStatus === 'Виявлено';
  var isRej = rejSt.indexOf(newStatus) >= 0;
  var isAppr = apprSt.indexOf(newStatus) >= 0;
  var isPend = !newStatus || newStatus === 'Виявлено';

  // Лічильник відхилених
  if (isRej && !wasRej) {
    inc['rejected'] = firebase.firestore.FieldValue.increment(1);
    inc['rejectedToday'] = firebase.firestore.FieldValue.increment(1);
    inc['rejected7'] = firebase.firestore.FieldValue.increment(1);
    inc['rejected30'] = firebase.firestore.FieldValue.increment(1);
    if (reason) {
      inc['rejectedReasons.' + reason.replace(/[.\/]/g, '_')] = firebase.firestore.FieldValue.increment(1);
    }
    if (user) {
      inc['topRejectedUsers.' + user.replace(/[.\/]/g, '_')] = firebase.firestore.FieldValue.increment(1);
    }
  } else if (wasRej && !isRej) {
    inc['rejected'] = firebase.firestore.FieldValue.increment(-1);
  }

  // Лічильник погоджених
  if (isAppr && !wasAppr) {
    inc['approved'] = firebase.firestore.FieldValue.increment(1);
    inc['approvedToday'] = firebase.firestore.FieldValue.increment(1);
    inc['approved7'] = firebase.firestore.FieldValue.increment(1);
    inc['approved30'] = firebase.firestore.FieldValue.increment(1);
    if (user) {
      inc['topApprovedUsers.' + user.replace(/[.\/]/g, '_')] = firebase.firestore.FieldValue.increment(1);
    }
  } else if (wasAppr && !isAppr) {
    inc['approved'] = firebase.firestore.FieldValue.increment(-1);
  }

  // Очікують перегляду
  if (isPend && !wasPend) inc['pending'] = firebase.firestore.FieldValue.increment(1);
  else if (wasPend && !isPend) inc['pending'] = firebase.firestore.FieldValue.increment(-1);

  inc['updatedAt'] = new Date().toISOString();
  if (Object.keys(inc).length > 1) {
    // update() правильно обробляє dot-notation ('a.b') для вкладених полів
    // set({merge:true}) НЕ обробляє dot-notation — створює буквальний ключ "a.b"
    try {
      await db.collection(GFC.settings).doc(GF_STATS_ID).update(inc);
    } catch(e) {
      // Якщо документ не існує — створюємо його
      await db.collection(GFC.settings).doc(GF_STATS_ID).set(inc, {merge:true});
    }
  }
}

/* Додається новий запис — збільшуємо total і pending */
async function gfStatOnNewDetected() {
  await gfSet(GFC.settings, GF_STATS_ID, {
    total: firebase.firestore.FieldValue.increment(1),
    pending: firebase.firestore.FieldValue.increment(1),
    updatedAt: new Date().toISOString()
  });
}

/* Повне перерахування статистики з нуля (для синхронізації) */
async function gfRebuildStats() {
  toast('📊 Перераховую статистику...');
  var all = await gfAllPaged(GFC.detected, 'found_at', 'desc');
  var now = new Date();
  var today = now.toISOString().slice(0, 10);
  var d7 = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
  var d30 = new Date(now - 30 * 864e5).toISOString().slice(0, 10);

  var rejSt = ['Не підходить', 'Видалено первинно'];
  var apprSt = ['Корисне', 'В базу'];

  var stats = {
    total: all.length,
    pending: 0, rejected: 0, approved: 0, highPriority: 0,
    rejectedToday: 0, rejected7: 0, rejected30: 0,
    approvedToday: 0, approved7: 0, approved30: 0,
    rejectedReasons: {}, topRejectedUsers: {}, topApprovedUsers: {},
    lastRebuild: new Date().toISOString(), updatedAt: new Date().toISOString()
  };

  all.forEach(function(d) {
    var st = d.status || 'Виявлено';
    var isRej = rejSt.indexOf(st) >= 0;
    var isAppr = apprSt.indexOf(st) >= 0;
    var isPend = !d.status || st === 'Виявлено';
    var chAt = (d.status_changed_at || '').slice(0, 10);

    if (isPend) stats.pending++;
    if (isRej) {
      stats.rejected++;
      if (chAt >= today) stats.rejectedToday++;
      if (chAt >= d7) stats.rejected7++;
      if (chAt >= d30) stats.rejected30++;
      var r = (d.status_reason || 'Без причини').replace(/[.\/]/g, '_');
      stats.rejectedReasons[r] = (stats.rejectedReasons[r] || 0) + 1;
      var u = (d.status_changed_by || '?').replace(/[.\/]/g, '_');
      stats.topRejectedUsers[u] = (stats.topRejectedUsers[u] || 0) + 1;
    }
    if (isAppr) {
      stats.approved++;
      if (chAt >= today) stats.approvedToday++;
      if (chAt >= d7) stats.approved7++;
      if (chAt >= d30) stats.approved30++;
      var u2 = (d.status_changed_by || '?').replace(/[.\/]/g, '_');
      stats.topApprovedUsers[u2] = (stats.topApprovedUsers[u2] || 0) + 1;
    }
    if ((d.auto_priority === 'high' || d.auto_priority === 'critical') && !isRej) stats.highPriority++;
  });

  await gfSet(GFC.settings, GF_STATS_ID, stats);
  toast('✅ Статистику перераховано (' + all.length + ' записів)');
  return stats;
}
async function gfSaveDetected(d) {
  var id = d.detected_id || d._id || 'det_' + Date.now();
  delete d._id;
  d.detected_id = id;
  d.found_at = d.found_at || new Date().toISOString();
  await gfSet(GFC.detected, id, d);
  return id;
}
async function gfSetDetectedStatus(id, status, reason, comment) {
  // Зберігаємо статус — точно як оригінал, без додаткової логіки
  // Статистика оновлюється окремо через "Перерахувати стат."
  return gfUpd(GFC.detected, id, {
    status:status, status_reason:reason||'', status_comment:comment||'',
    status_changed_at:new Date().toISOString(),
    status_changed_by:(typeof CUR_USER!=='undefined'&&CUR_USER)?CUR_USER.name:''
  });
}

/* ── Opportunities ── */
async function gfGetOpps() { return gfAll(GFC.opps, 'created_at', 'desc'); }

/* ── Settings ── */
async function gfGetSetting(key) {
  var d = await gfDoc(GFC.settings, key);
  return d ? d.value : null;
}
async function gfSetSetting(key, val) {
  return gfSet(GFC.settings, key, {value:val, updated_at:new Date().toISOString()});
}

/* ── History ── */
async function gfLog(eType, eId, action, oldSt, newSt, notes) {
  return gfAdd(GFC.history, {
    entity_type:eType, entity_id:eId, action_type:action,
    old_status:oldSt||'', new_status:newSt||'',
    action_by:(typeof CUR_USER!=='undefined'&&CUR_USER)?CUR_USER.name:'',
    action_at:new Date().toISOString(), notes:notes||''
  });
}

/* ── Aggregated overview data ── */
async function gfLoadAll() {
  // Паралельно читаємо: detected, джерела, stats, daily_history
  var res = await Promise.all([
    gfGetDetected(1000), gfGetSources(), gfAll(GFC.archive), gfGetOpps(),
    gfAll(GFC.approvals), gfAll(GFC.assigns), gfAll(GFC.tasks),
    gfAll(GFC.notifs), gfAll(GFC.contacts), gfGetStats(),
    gfDoc(GFC.settings, 'daily_history')
  ]);
  var det=res[0], src=res[1], arch=res[2], opp=res[3],
      apr=res[4], asg=res[5], tsk=res[6], ntf=res[7], cnt=res[8], sts=res[9], dh=res[10];
  // Зберігаємо daily_history в GF для огляду
  if (typeof GF !== 'undefined') GF._dailyHistory = dh ? (dh.days || []) : [];

  var actSrc = src.filter(function(s){ return s.source_status==='active'; });
  var rejSt = ['Не підходить','Видалено первинно'];

  // Причини і топ-користувачі — конвертуємо з об'єкту назад у масив
  function objToArr(obj) {
    return Object.keys(obj||{}).map(function(k){ return {user:k.replace(/_/g,' '), count:obj[k]}; })
      .sort(function(a,b){ return b.count - a.count; }).slice(0, 5);
  }
  function objToReasons(obj) {
    var r = {};
    Object.keys(obj||{}).forEach(function(k){ r[k.replace(/_/g,' ')] = obj[k]; });
    return r;
  }

  return {
    detected:det, sources:src, archive:arch, opps:opp, approvals:apr,
    assigns:asg, tasks:tsk, notifs:ntf, contacts:cnt, statsDoc:sts,
    overview:{
      // Загальні лічильники — з лічильника (точні, незалежно від обсягу)
      detectedCount: sts.total || det.length,
      oppCount: opp.length,
      sourcesCount: src.length,
      activeSources: actSrc.length,
      scansTotal: src.reduce(function(s,x){ return s+(parseInt(x.found_count)||0); }, 0),
      deletedTotal: sts.rejected || 0,
      pendingApprovals: apr.filter(function(a){ return a.approval_status==='на погодженні'; }).length,
      highPriority: sts.highPriority || 0,
      // Часові лічильники — з лічильника
      deletedToday: sts.rejectedToday||0, deleted7: sts.rejected7||0,
      deleted30: sts.rejected30||0, deleted365: sts.rejected30||0,
      approvedToday: sts.approvedToday||0, approved7: sts.approved7||0,
      approved30: sts.approved30||0, approved365: sts.approved30||0,
      // Причини і користувачі — з лічильника
      deletedReasons: objToReasons(sts.rejectedReasons),
      topDeletedUsers: objToArr(sts.topRejectedUsers),
      topApprovedUsers: objToArr(sts.topApprovedUsers),
      // Для UI що потребує реальних даних
      newToday: det.filter(function(d){ return (d.found_at||'').slice(0,10) === new Date().toISOString().slice(0,10); }).length,
      pendingReview: sts.pending || det.filter(function(d){ return !d.status||d.status==='Виявлено'; }).length
    }
  };
}
