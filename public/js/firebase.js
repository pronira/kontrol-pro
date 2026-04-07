/* ══ Firebase API Layer ══ */
var firebaseConfig = {
  apiKey: "AIzaSyCXK1SaCqIPW7oXQU62yioxiz-8czqgPEs",
  authDomain: "kontrol-pro.firebaseapp.com",
  projectId: "kontrol-pro",
  storageBucket: "kontrol-pro.firebasestorage.app",
  messagingSenderId: "1081707372949",
  appId: "1:1081707372949:web:13c103b04b0c490240969c"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
var storage = firebase.storage();
db.enablePersistence({synchronizeTabs: true}).catch(function(err) {
  console.warn('Firestore offline persistence error:', err.code);
});
var DEFAULT_API = '';
var API = '';
var SETTINGS_KEYS = ['k4_dr','k4_tp','k4_push','k4_theme','k4_def_rem','k4_org_order','k4_org_status','k4_custom_types','k4_org_freq'];
var _settingsSyncTimer = null;


/* ─── FIRESTORE HELPERS ─── */
function tsToStr(ts) {
  if (!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '';
  var r = p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear();
  var hh = d.getHours(), mm = d.getMinutes();
  if (!((hh===23&&mm===59)||(hh===0&&mm===0)||(hh===12&&mm===0))) r += ' '+p2(hh)+':'+p2(mm);
  return r;
}


function strToTs(s) {
  if (!s) return null;
  var d = pD(s);
  return d ? firebase.firestore.Timestamp.fromDate(d) : null;
}


function docToRow(doc) {
  var d = doc.data();
  var id = doc.id;
  return {
    row: id,
    num: d.num || 0,
    type: d.type || '',
    inNum: d.inpNum || d.inNum || '',
    docDate: d.inpDate_str || tsToStr(d.inpDate) || '',
    from: d.from || '',
    name: d.title || '',
    desc: d.task || '',
    deadline: d.deadline_str || tsToStr(d.deadline) || '',
    recurring: d.recurring || '',
    periodEnd: d.periodEnd_str || tsToStr(d.periodEnd) || '',
    parentId: (d.parentId && d.parentId !== 0 && d.parentId !== '0') ? (String(d.parentId).indexOf('ctrl_') === 0 ? d.parentId : 'ctrl_' + String(d.parentId).padStart(4, '0')) : '',
    done: d.done ? true : false,
    docLink: d.docLink || '',
    respLink: d.respLink || '',
    doneDate: d.doneDate_str || tsToStr(d.doneDate) || '',
    respNum: d.respNum || '',
    sampleResp: d.sample || '',
    reportTo: d.reportOrg || '',
    email: d.reportEmail || '',
    log: d.log || '',
    executor: d.executor || '',
    reminder: Array.isArray(d.reminders) ? d.reminders.join(',') : (d.reminders || ''),
    files: typeof d.files === 'string' ? d.files : JSON.stringify(d.files || []),
    notes: d.notes || '',
    tags: d.tags || [],
    year: d.year || new Date().getFullYear(),
    extraDates: typeof d.extraDates === 'string' ? d.extraDates : JSON.stringify(d.extraDates || [])
  };
}


function orgToRow(doc) {
  var d = doc.data();
  return {
    row: doc.id,
    name: d.shortName || d.name || '',
    fullName: d.fullName || '',
    orgType: d.category || d.level || '',
    email: d.email || '',
    phone: d.phone || '',
    contact: d.contactPersons ? (Array.isArray(d.contactPersons) && d.contactPersons.length ? d.contactPersons[0].name || '' : '') : '',
    parentRow: d.parentRow || '',
    address: d.address || '',
    website: d.website || '',
    notes: d.note || d.notes || '',
    birthday: d.birthday || '',
    edrpou: d.edrpou || '',
    tabNum: d.tabNum || '',
    hireDate: d.hireDate || '',
    abbreviation: d.abbreviation || '',
    category: d.category || '',
    status: d.status || '',
    deletedAt: d.deletedAt || '',
    deletedName: d.deletedName || '',
    socials: d.socials || ''
  };
}


/* ─── NEXT NUM GENERATOR ─── */
async function getNextNum() {
  var ref = db.collection('counters').doc('controls');
  try {
    var result = await db.runTransaction(async function(t) {
      var snap = await t.get(ref);
      var cur = snap.exists ? (snap.data().lastNum || 0) : 0;
      var next = cur + 1;
      t.set(ref, {lastNum: next}, {merge: true});
      return next;
    });
    return result;
  } catch(e) {
    var snap = await db.collection('controls').orderBy('num', 'desc').limit(1).get();
    return snap.empty ? 1 : (snap.docs[0].data().num || 0) + 1;
  }
}

/* ─── FIREBASE API LAYER ─── */
/* Replaces api() and apiP() — all actions now go through Firestore */

function api(p) {
  return handleAction(p);
}


function apiP(d) {
  if (CUR_USER) d._user = CUR_USER.login;
  return handleAction(d);
}


async function handleAction(params) {
  var action = params.action;
  try {
    switch(action) {

      case 'getAll':
        return await fbGetAll();

      case 'addDoc':
        return await fbAddDoc(params);

      case 'editDoc':
        return await fbEditDoc(params);

      case 'delDoc':
        return await fbDelDoc(params);

      case 'markDone':
        return await fbMarkDone(params);

      case 'addOrg':
        return await fbAddOrg(params);

      case 'editOrg':
        return await fbEditOrg(params);

      case 'getUsers':
        return await fbGetUsers();

      case 'login':
        return await fbLogin(params);

      case 'resetAdmin':
        return await fbResetAdmin(params);

      case 'uploadFile':
        return await fbUploadFile(params);

      case 'writeLog':
        return await fbWriteLog(params);

      case 'getLog':
        return await fbGetLog(params);

      case 'checkBirthdays':
        return {ok: true, created: 0};

      case 'requestDelete':
        return await fbRequestDelete(params);

      case 'getPendingDeletes':
        return await fbGetPendingDeletes();

      case 'approveDelete':
        return await fbApproveDelete(params);

      case 'testEmail':
        return {ok: true, message: 'Email \u043d\u0435 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454\u0442\u044c\u0441\u044f \u0432 Firebase \u0432\u0435\u0440\u0441\u0456\u0457'};

      case 'backup':
        return await fbBackup();

      case 'addComm':
      case 'editComm':
        return await fbSaveComm(params);

      case 'delComm':
        return await fbDelComm(params);

      case 'addMember':
        return await fbAddMember(params);

      case 'delMeet':
        return await fbDelMeet(params);

      case 'addUser':
      case 'editUser':
        return await fbSaveUser(params);

      default:
        console.warn('Unknown action:', action);
        return {ok: true};
    }
  } catch(err) {
    console.error('Firebase error:', action, err);
    return {error: err.message};
  }
}


/* ─── GET ALL DATA ─── */
async function fbGetAll() {
  var [controlsSnap, orgsSnap, commsSnap, meetsSnap, decisSnap, membersSnap] = await Promise.all([
    db.collection('controls').orderBy('num', 'desc').get(),
    db.collection('organizations').get(),
    db.collection('commissions').get(),
    db.collection('meetings').get(),
    db.collection('decisions').get(),
    db.collection('commission_members').get()
  ]);

  var docs = controlsSnap.docs.map(docToRow);
  var orgs = orgsSnap.docs.map(orgToRow);
  var comms = commsSnap.docs.map(function(d) { var data = d.data(); data.row = d.id; data.uid = d.id; return data; });
  var meets = meetsSnap.docs.map(function(d) { var data = d.data(); data.row = d.id; data.uid = d.id; return data; });
  var decisions = decisSnap.docs.map(function(d) { var data = d.data(); data.row = d.id; data.uid = d.id; return data; });
  var members = membersSnap.docs.map(function(d) { var data = d.data(); data.row = d.id; return data; });

  return {docs: docs, orgs: orgs, comms: comms, meets: meets, decisions: decisions, members: members};
}


/* ─── ADD DOCUMENT ─── */
async function fbAddDoc(p) {
  var num = await getNextNum();
  var docId = 'ctrl_' + String(num).padStart(4, '0');

  var data = {
    num: num,
    type: p.type || '',
    inpNum: p.inNum || '',
    inpDate: strToTs(p.docDate),
    inpDate_str: p.docDate || '',
    from: p.from || '',
    title: p.name || '',
    task: p.desc || '',
    deadline: strToTs(p.deadline),
    deadline_str: p.deadline || '',
    recurring: p.recurring || '\u041d\u0456',
    periodEnd: strToTs(p.periodEnd),
    periodEnd_str: p.periodEnd || '',
    parentId: p.parentId ? (String(p.parentId).indexOf('ctrl_') === 0 ? p.parentId : (parseInt(p.parentId) || 0)) : 0,
    done: false,
    docLink: p.docLink || '',
    respLink: p.respLink || '',
    doneDate: null,
    doneDate_str: '',
    respNum: p.respNum || '',
    sample: p.sampleResp || '',
    reportOrg: p.reportTo || '',
    reportEmail: p.email || '',
    executor: p.executor || '',
    reminders: p.reminder ? p.reminder.split(',') : [],
    files: p.files || '[]',
    notes: p.notes || '',
    tags: p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : [],
    extraDates: p.extraDates || '[]',
    year: strToTs(p.docDate) ? strToTs(p.docDate).toDate().getFullYear() : new Date().getFullYear(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    log: [{date: new Date().toLocaleString('uk-UA'), user: (CUR_USER ? CUR_USER.login : ''), action: '\u0421\u0442\u0432\u043e\u0440\u0435\u043d\u043e'}]
  };

  await db.collection('controls').doc(docId).set(data);
  return {ok: true, row: docId};
}


/* ─── EDIT DOCUMENT ─── */
async function fbEditDoc(p) {
  var docId = p.row;
  if (!docId) return {error: 'No row'};

  var upd = {
    type: p.type || '',
    inpNum: p.inNum || '',
    inpDate: strToTs(p.docDate),
    inpDate_str: p.docDate || '',
    from: p.from || '',
    title: p.name || '',
    task: p.desc || '',
    deadline: strToTs(p.deadline),
    deadline_str: p.deadline || '',
    recurring: p.recurring || '\u041d\u0456',
    periodEnd: strToTs(p.periodEnd),
    periodEnd_str: p.periodEnd || '',
    docLink: p.docLink || '',
    respLink: p.respLink || '',
    sample: p.sampleResp || '',
    reportOrg: p.reportTo || '',
    reportEmail: p.email || '',
    executor: p.executor || '',
    reminders: p.reminder ? p.reminder.split(',') : [],
    files: p.files || '[]',
    notes: p.notes || '',
    tags: p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : [],
    extraDates: p.extraDates || '[]',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    log: firebase.firestore.FieldValue.arrayUnion({date: new Date().toLocaleString('uk-UA'), user: (CUR_USER ? CUR_USER.login : ''), action: '\u041e\u043d\u043e\u0432\u043b\u0435\u043d\u043e'})
  };

  // Recalculate year if docDate changed
  if (p.docDate) {
    var dt = pD(p.docDate);
    if (dt) upd.year = dt.getFullYear();
  }

  await db.collection('controls').doc(docId).update(upd);
  return {ok: true, row: docId};
}


/* ─── DELETE DOCUMENT ─── */
async function fbDelDoc(p) {
  await db.collection('controls').doc(p.row).delete();
  return {ok: true};
}


/* ─── MARK DONE ─── */
async function fbMarkDone(p) {
  var now = new Date();
  var dateStr = p2(now.getDate())+'.'+p2(now.getMonth()+1)+'.'+now.getFullYear();
  await db.collection('controls').doc(p.row).update({
    done: true,
    doneDate: firebase.firestore.Timestamp.fromDate(now),
    doneDate_str: dateStr,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    log: firebase.firestore.FieldValue.arrayUnion({date: now.toLocaleString('uk-UA'), user: (CUR_USER ? CUR_USER.login : ''), action: '\u0412\u0438\u043a\u043e\u043d\u0430\u043d\u043e'})
  });
  return {ok: true};
}


/* ─── ADD ORG ─── */
async function fbAddOrg(p) {
  var snap = await db.collection('organizations').get();
  var num = snap.size + 1;
  var docId = 'org_' + String(num).padStart(4, '0');

  await db.collection('organizations').doc(docId).set({
    shortName: p.name || '',
    name: p.name || '',
    fullName: p.fullName || '',
    category: p.orgType || p.category || '',
    level: p.orgType || '',
    email: p.email || '',
    phone: p.phone || '',
    contactPersons: p.contact ? [{name: p.contact}] : [],
    parentRow: p.parentRow || '',
    address: p.address || '',
    website: p.website || '',
    note: p.notes || '',
    birthday: p.birthday || '',
    edrpou: p.edrpou || '',
    tabNum: p.tabNum || '',
    hireDate: p.hireDate || '',
    abbreviation: '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return {ok: true, row: docId};
}


/* ─── EDIT ORG ─── */
async function fbEditOrg(p) {
  var docId = p.row;
  if (!docId) return {error: 'No row'};

  var upd = {updatedAt: firebase.firestore.FieldValue.serverTimestamp()};
  if (p.name !== undefined) { upd.shortName = p.name; upd.name = p.name; }
  if (p.fullName !== undefined) upd.fullName = p.fullName;
  if (p.orgType !== undefined) { upd.category = p.orgType; upd.level = p.orgType; }
  if (p.email !== undefined) upd.email = p.email;
  if (p.phone !== undefined) upd.phone = p.phone;
  if (p.contact !== undefined) upd.contactPersons = [{name: p.contact}];
  if (p.parentRow !== undefined) upd.parentRow = p.parentRow;
  if (p.address !== undefined) upd.address = p.address;
  if (p.website !== undefined) upd.website = p.website;
  if (p.notes !== undefined) upd.note = p.notes;
  if (p.birthday !== undefined) upd.birthday = p.birthday;
  if (p.edrpou !== undefined) upd.edrpou = p.edrpou;
  if (p.tabNum !== undefined) upd.tabNum = p.tabNum;
  if (p.hireDate !== undefined) upd.hireDate = p.hireDate;
  if (p.category !== undefined) upd.category = p.category;

  await db.collection('organizations').doc(docId).update(upd);
  return {ok: true};
}


/* ─── LOGIN ─── */
async function fbLogin(p) {
  var snap = await db.collection('users').where('login', '==', p.login).get();
  if (snap.empty) {
    // Try by name for migrated users
    snap = await db.collection('users').get();
    var found = null;
    snap.forEach(function(doc) {
      var d = doc.data();
      if ((d.login || d.name || '').toLowerCase() === p.login.toLowerCase()) found = doc;
    });
    if (!found) return {error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u043b\u043e\u0433\u0456\u043d'};
    var data = found.data();
    if (data.password && data.password !== p.password) return {error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'};
    return {ok: true, user: {login: data.login || data.name, name: data.name, role: data.role || 'user', perms: data.perms || '{}', row: found.id}};
  }
  var doc = snap.docs[0];
  var data = doc.data();
  if (data.password && data.password !== p.password) return {error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c'};
  return {ok: true, user: {login: data.login, name: data.name, role: data.role || 'user', perms: data.perms || '{}', row: doc.id}};
}


/* ─── RESET ADMIN ─── */
async function fbResetAdmin(p) {
  if (p.secret !== 'pishchanobrid2024') return {error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u043a\u043b\u044e\u0447'};
  var snap = await db.collection('users').where('login', '==', 'admin').get();
  if (snap.empty) {
    await db.collection('users').doc('user_admin').set({
      login: 'admin', password: 'admin', name: '\u0410\u0434\u043c\u0456\u043d\u0456\u0441\u0442\u0440\u0430\u0442\u043e\u0440', role: 'admin',
      perms: JSON.stringify({docs:'full',inbox:'full',myday:'full',calendar:'full',orgs:'full',comms:'full',reports:'full',settings:'full',users:'full'}),
      status: 'active', createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    await snap.docs[0].ref.update({password: 'admin'});
  }
  return {ok: true, message: '\u0421\u043a\u0438\u043d\u0443\u0442\u043e! admin / admin'};
}


/* ─── UPLOAD FILE ─── */
async function fbUploadFile(p) {
  if (!p.fileData) return {error: 'No file data'};
  var fileName = p.fileName || ('file_' + Date.now());
  var ref = storage.ref('uploads/' + Date.now() + '_' + fileName);

  // Convert base64 to blob
  var byteString = atob(p.fileData.split(',').pop());
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  var blob = new Blob([ab], {type: p.fileType || 'application/octet-stream'});

  var snapshot = await ref.put(blob);
  var url = await snapshot.ref.getDownloadURL();
  return {ok: true, fileUrl: url};
}


/* ─── WRITE LOG ─── */
async function fbWriteLog(p) {
  await db.collection('activity_log').add({
    user: p.user || '',
    action: p.logAction || p.action || '',
    details: p.details || '',
    docRow: p.docRow || '',
    date: firebase.firestore.FieldValue.serverTimestamp(),
    dateStr: new Date().toLocaleString('uk-UA')
  });
  return {ok: true};
}


/* ─── GET LOG ─── */
async function fbGetLog(p) {
  var limit = p.limit || 200;
  var snap = await db.collection('activity_log').orderBy('date', 'desc').limit(limit).get();
  var log = snap.docs.map(function(d) {
    var data = d.data();
    return {date: data.dateStr || '', user: data.user || '', action: data.action || '', details: data.details || ''};
  });
  return {ok: true, log: log};
}


/* ─── REQUEST DELETE ─── */
async function fbRequestDelete(p) {
  await db.collection('pending_deletes').doc(p.row).set({
    row: p.row, user: p.user || '', date: firebase.firestore.FieldValue.serverTimestamp()
  });
  return {ok: true};
}


/* ─── GET PENDING DELETES ─── */
async function fbGetPendingDeletes() {
  var snap = await db.collection('pending_deletes').get();
  var pending = [];
  for (var i = 0; i < snap.docs.length; i++) {
    var pd = snap.docs[i].data();
    var docRef = db.collection('controls').doc(pd.row);
    var docSnap = await docRef.get();
    if (docSnap.exists) {
      var dd = docSnap.data();
      pending.push({row: pd.row, name: dd.title || '', type: dd.type || '', from: dd.from || '', user: pd.user});
    }
  }
  return {ok: true, pending: pending};
}


/* ─── APPROVE DELETE ─── */
async function fbApproveDelete(p) {
  await db.collection('controls').doc(p.row).delete();
  await db.collection('pending_deletes').doc(p.row).delete();
  return {ok: true};
}


/* ─── BACKUP ─── */
async function fbBackup() {
  var snap = await db.collection('controls').get();
  var data = snap.docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
  var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'kontroli_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  return {ok: true};
}


/* ─── SAVE COMMISSION ─── */
async function fbSaveComm(p) {
  var data = {
    name: p.name || '', commType: p.commType || '', basis: p.basis || '',
    dateCreated: p.dateCreated || '', head: p.head || '', deputy: p.deputy || '',
    secretary: p.secretary || '', members: p.members || '[]',
    periodicity: p.periodicity || '', status: p.status || '',
    notes: p.notes || '', endDate: p.endDate || '', endReason: p.endReason || '',
    newCommission: p.newCommission || '', basisDoc: p.basisDoc || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (p.row && p.action === 'editComm') {
    await db.collection('commissions').doc(p.row).update(data);
    return {ok: true};
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.uid = 'comm_' + Date.now();
    var ref = await db.collection('commissions').add(data);
    return {ok: true, row: ref.id};
  }
}


/* ─── DELETE COMMISSION ─── */
async function fbDelComm(p) {
  await db.collection('commissions').doc(p.row).delete();
  return {ok: true};
}


/* ─── ADD MEMBER ─── */
async function fbAddMember(p) {
  await db.collection('commission_members').add({
    commId: p.commId || '', name: p.name || '', role: p.role || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return {ok: true};
}


/* ─── DELETE MEETING ─── */
async function fbDelMeet(p) {
  await db.collection('meetings').doc(p.row).delete();
  return {ok: true};
}


/* ─── GET USERS ─── */
async function fbGetUsers() {
  var snap = await db.collection('users').get();
  var users = snap.docs.map(function(d) {
    var data = d.data();
    return {row: d.id, login: data.login || '', name: data.name || '', role: data.role || 'user', status: data.status || 'active', perms: data.perms || '{}'};
  });
  return {ok: true, users: users};
}


/* ─── SAVE USER ─── */
async function fbSaveUser(p) {
  var data = {
    login: p.login || '', name: p.name || '', role: p.role || 'user',
    status: p.status || 'active', perms: p.perms || '{}',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (p.password) data.password = p.password;

  if (p.row && p.action === 'editUser') {
    await db.collection('users').doc(p.row).update(data);
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('users').add(data);
  }
  return {ok: true};
}

function saveSettingsToFirestore() {
  if (!CUR_USER || !CUR_USER.login) return;
  var settings = {};
  SETTINGS_KEYS.forEach(function(k) { var v = localStorage.getItem(k); if (v !== null) settings[k] = v; });
  db.collection('user_settings').doc(CUR_USER.login).set(settings, {merge: true}).catch(function(){});
}

function loadSettingsFromFirestore() {
  if (!CUR_USER || !CUR_USER.login) return;
  db.collection('user_settings').doc(CUR_USER.login).get().then(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    SETTINGS_KEYS.forEach(function(k) {
      if (data[k] !== undefined && data[k] !== null) {
        var local = localStorage.getItem(k);
        if (!local || local === '{}' || local === '[]') {
          localStorage.setItem(k, data[k]);
        }
      }
    });
    // Reload affected vars
    try { DR = JSON.parse(localStorage.getItem('k4_dr') || '{}'); } catch(e){}
    try { TP = JSON.parse(localStorage.getItem('k4_tp') || '[]'); } catch(e){}
    PU = localStorage.getItem('k4_push') === '1';
  }).catch(function(){});
}

function startSettingsSync() {
  loadSettingsFromFirestore();
  if (_settingsSyncTimer) clearInterval(_settingsSyncTimer);
  _settingsSyncTimer = setInterval(saveSettingsToFirestore, 300000);
}

