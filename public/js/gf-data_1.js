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
  var s = await r.limit(lim || 600).get();
  var a = []; s.forEach(function(d) { a.push(Object.assign({_id:d.id}, d.data())); }); return a;
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
async function gfGetDetected() { return gfAll(GFC.detected, 'found_at', 'desc'); }
async function gfSaveDetected(d) {
  var id = d.detected_id || d._id || 'det_' + Date.now();
  delete d._id;
  d.detected_id = id;
  d.found_at = d.found_at || new Date().toISOString();
  await gfSet(GFC.detected, id, d);
  return id;
}
async function gfSetDetectedStatus(id, status, reason, comment) {
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
  var res = await Promise.all([
    gfGetDetected(), gfGetSources(), gfAll(GFC.archive), gfGetOpps(),
    gfAll(GFC.approvals), gfAll(GFC.assigns), gfAll(GFC.tasks),
    gfAll(GFC.notifs), gfAll(GFC.contacts)
  ]);
  var det=res[0], src=res[1], arch=res[2], opp=res[3],
      apr=res[4], asg=res[5], tsk=res[6], ntf=res[7], cnt=res[8];

  var now=new Date(), today=now.toISOString().slice(0,10),
      d7=new Date(now-7*864e5).toISOString().slice(0,10),
      d30=new Date(now-30*864e5).toISOString().slice(0,10),
      d365=new Date(now-365*864e5).toISOString().slice(0,10);

  var actSrc=src.filter(function(s){return s.source_status==='active';});
  var rejSt=['Не підходить','Видалено первинно'];
  var rej=det.filter(function(d){return rejSt.indexOf(d.status)>=0;});
  var appr=det.filter(function(d){return d.status==='Корисне'||d.status==='В базу';});

  function cntD(arr,f,from){return arr.filter(function(d){return(d[f]||'').slice(0,10)>=from;}).length;}
  var reasons={};
  rej.forEach(function(d){var r=d.status_reason||'Без причини';reasons[r]=(reasons[r]||0)+1;});

  function topU(arr,f){
    var m={};arr.forEach(function(d){var u=d[f]||'?';m[u]=(m[u]||0)+1;});
    return Object.keys(m).map(function(u){return{user:u,count:m[u]};})
      .sort(function(a,b){return b.count-a.count;}).slice(0,5);
  }

  return {
    detected:det, sources:src, archive:arch, opps:opp, approvals:apr,
    assigns:asg, tasks:tsk, notifs:ntf, contacts:cnt,
    overview:{
      detectedCount:det.length, oppCount:opp.length, sourcesCount:src.length,
      activeSources:actSrc.length,
      scansTotal:src.reduce(function(s,x){return s+(parseInt(x.found_count)||0);},0),
      deletedTotal:rej.length,
      pendingApprovals:apr.filter(function(a){return a.approval_status==='на погодженні';}).length,
      highPriority:det.filter(function(d){return(d.auto_priority==='high'||d.auto_priority==='critical')&&rejSt.indexOf(d.status)<0;}).length,
      deletedToday:cntD(rej,'status_changed_at',today), deleted7:cntD(rej,'status_changed_at',d7),
      deleted30:cntD(rej,'status_changed_at',d30), deleted365:cntD(rej,'status_changed_at',d365),
      approvedToday:cntD(appr,'status_changed_at',today), approved7:cntD(appr,'status_changed_at',d7),
      approved30:cntD(appr,'status_changed_at',d30), approved365:cntD(appr,'status_changed_at',d365),
      deletedReasons:reasons,
      topDeletedUsers:topU(rej,'status_changed_by'),
      topApprovedUsers:topU(appr,'status_changed_by')
    }
  };
}
