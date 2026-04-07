/* ══ Print & Export ══ */

/* ─── PRINT RESOLUTION (4 per A4) ─── */
function printResolution(row) {
  var d = null; for (var i = 0; i < D.length; i++) { if (D[i].row == row) { d = D[i]; break; } } if (!d) return;
  function dateOnly(s) { var v = fD(s); return v ? v.split(' ')[0] : ''; }
  // Collect ALL control dates
  var allDates = [];
  // 1. Main deadline
  allDates.push({date: dateOnly(d.deadline), recurring: d.recurring || '', from: d.reportTo || '', desc: '', executor: d.executor || ''});
  // 2. Extra dates
  try { var extras = d.extraDates ? JSON.parse(d.extraDates) : [];
    extras.forEach(function(e) {
      var label = '';
      if (e.recurring && e.recurring !== 'Ні') {
        var recMap = {'Щоденно':'щоденно','Щотижня':'щотижня','Щомісяця':'щомісяця','Щокварталу':'щокварталу','Щороку':'щороку'};
        label = (recMap[e.recurring] || e.recurring) + (e.date ? ' до ' + (e.date.split(' ')[0]) : '');
      } else { label = e.date ? e.date.split(' ')[0] : ''; }
      allDates.push({date: label, recurring: e.recurring||'', from: e.reportTo||e.from||'', desc: e.desc||'', executor: e.executor||''});
    });
  } catch(ex) {}
  // 3. Children (recurring sub-rows)
  var children = D.filter(function(x) { var pid = String(x.parentId||''); return pid && pid === String(d.parentId||d.row) && x.row !== d.row; });
  children.sort(function(a,b) { var da=pD(a.deadline),db=pD(b.deadline); return (da||0)-(db||0); });
  children.forEach(function(c) {
    allDates.push({date: dateOnly(c.deadline), recurring: '', from: c.reportTo||'', desc: '', executor: c.executor||d.executor||''});
  });

  var w = window.open('', '_blank');
  var css = 'body{font-family:Arial,sans-serif;margin:0;padding:10mm 15mm}' +
    '@page{size:A4 portrait;margin:10mm}' +
    '.res{border:2px solid #000;padding:8mm 10mm;font-size:13px;min-height:calc(297mm - 40mm);box-sizing:border-box}' +
    '.res h3{font-size:18px;margin:0 0 5mm;text-align:center;border-bottom:2px solid #000;padding-bottom:3mm;text-transform:uppercase;letter-spacing:1px}' +
    '.rf{margin:2.5mm 0;font-size:13px;line-height:1.5}' +
    '.rf b{font-size:13px}' +
    '.cd-tbl{width:100%;border-collapse:collapse;margin:4mm 0;font-size:12px}' +
    '.cd-tbl td{border:1px solid #000;padding:2.5mm;vertical-align:top}' +
    '.cd-tbl .cb{width:16px;height:16px;border:2px solid #000;display:inline-block;vertical-align:middle}' +
    '.res-sign{display:flex;justify-content:space-between;margin-top:12mm;font-size:12px}' +
    '@media print{@page{size:A4 portrait;margin:10mm}.no-print{display:none!important}}';

  // Build dates table
  var tblH = '';
  if (allDates.length > 1 || (allDates.length === 1 && allDates[0].from)) {
    tblH = '<table class="cd-tbl">';
    tblH += '<tr style="background:#eee;font-weight:700"><td>Термін</td><td>Кому звітувати</td><td style="min-width:75px">Дата відповіді</td><td style="min-width:65px">№ відповіді</td><td style="width:14px;text-align:center">✓</td></tr>';
    allDates.forEach(function(dt) {
      var label = dt.date || '—';
      if (dt.desc) label += ', ' + dt.desc;
      tblH += '<tr><td>' + esc(label) + '</td><td>' + esc(dt.from || '') + '</td><td style="border-bottom:1px solid #ccc">&nbsp;</td><td style="border-bottom:1px solid #ccc">&nbsp;</td><td style="text-align:center"><span class="cb"></span></td></tr>';
    });
    tblH += '</table>';
  }

  var block = '<div class="res"><h3>РЕЗОЛЮЦІЯ</h3>' +
    '<div class="rf"><b>Від:</b> ' + esc(d.from || '') + '</div>' +
    '<div class="rf"><b>Вх. №:</b> ' + esc(d.inNum || '') + ' від ' + dateOnly(d.docDate) + '</div>' +
    '<div class="rf"><b>Тема:</b> ' + esc(d.name || '') + '</div>' +
    '<div class="rf"><b>Зміст:</b> ' + esc(d.desc || '') + '</div>' +
    '<div class="rf"><b>Виконавець:</b> ' + esc(d.executor || '') + '</div>' +
    '<div class="rf"><b>Термін:</b> ' + dateOnly(d.deadline) + '</div>' +
    (d.reportTo ? '<div class="rf"><b>Звітувати:</b> ' + esc(d.reportTo) + '</div>' : '') +
    tblH +
    '<div class="res-sign"><div>Голова ________________ / _______________</div><div style="text-align:right">«____» _____________ 20____ р.</div></div>' +
    '<div style="margin-top:8mm;border-top:1px dotted #999;padding-top:4mm;font-size:11px;color:#666">Підпис виконавця: ________________ Дата: ___.___.______</div></div>';
  w.document.write('<html><head><title>Резолюція</title><style>' + css + '.no-print{margin:10px auto;text-align:center}@media print{.no-print{display:none}}</style></head><body>' +
    '<div class="no-print"><button onclick="window.print()" style="padding:10px 30px;font-size:16px;cursor:pointer;background:#3b82f6;color:#fff;border:none;border-radius:8px;margin:5px">🖨 Друкувати</button><button onclick="window.close()" style="padding:10px 30px;font-size:16px;cursor:pointer;background:#666;color:#fff;border:none;border-radius:8px;margin:5px">✕ Закрити</button></div>' +
    block + '</body></html>');
  w.document.close();
}


/* ─── DOC OVERLAY ─── */
function openDocOverlay(url) {
  if (!url) return;
  var previewUrl = url;
  // Google Drive file links - convert /view to /preview
  if (url.indexOf('drive.google.com') >= 0) {
    // Extract file ID from various formats
    var id = null;
    var m = url.match(/\/d\/([^\/\?#]+)/);
    if (m) id = m[1];
    if (!id) { m = url.match(/id=([^&#]+)/); if (m) id = m[1]; }
    if (id) {
      previewUrl = 'https://drive.google.com/file/d/' + id + '/preview';
    }
  } else if (url.indexOf('docs.google.com') >= 0) {
    previewUrl = url.replace(/\/(edit|view).*$/, '/preview');
  }
  var _ovFrame = el('doc-ov-frame');
  var _ovInner = el('doc-ov').querySelector('.doc-overlay-inner');
  var _ovSpin = _ovInner ? _ovInner.querySelector('.ov-spin') : null;
  if (!_ovSpin && _ovInner) { _ovSpin = document.createElement('div'); _ovSpin.className = 'ov-spin';
    _ovSpin.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3';
    _ovSpin.innerHTML = '<div class="spin" style="width:40px;height:40px;border-width:4px"></div>';
    _ovInner.appendChild(_ovSpin); }
  if (_ovSpin) _ovSpin.style.display = '';
  if (_ovFrame) { _ovFrame.style.opacity = '0';
    _ovFrame.onload = function(){ _ovFrame.style.opacity='1'; if(_ovSpin) _ovSpin.style.display='none'; };
    _ovFrame.src = previewUrl; }
  el('doc-ov').classList.add('open');
  el('doc-ov-url').href = url;
}

function closeOverlay() {
  el('doc-ov').classList.remove('open');
  el('doc-ov-frame').src = 'about:blank';
  var prev = document.querySelector('.res-preview');
  if (prev) { prev.remove(); var fr = el('doc-ov-frame'); if (fr) fr.style.display = ''; }
}

function printOverlay() {
  // Google Drive preview doesn't allow cross-origin print, open in new tab
  var frame = el('doc-ov-frame');
  var url = frame.src;
  // Convert /preview to /view for better print
  url = url.replace('/preview', '/view');
  var w = window.open(url, '_blank');
  if (w) setTimeout(function(){ try { w.print(); } catch(e){} }, 2000);
}

function triggerScan() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (file) {
      toast('📷 ' + file.name + ' (' + Math.round(file.size/1024) + ' КБ). Завантажте на Drive та вставте посилання.');
    }
  };
  input.click();
}


function scanDoc(inputId) {
  // Try to open scanner via Web API or prompt
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Mobile: open camera for document scan
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      toast('📷 Файл вибрано: ' + file.name + '. Завантажте на Google Drive і вставте посилання.');
      if (inputId) {
        var target = el(inputId);
        if (target) target.focus();
      }
    };
    input.click();
  } else {
    toast('📷 Камера недоступна. Скануйте документ і завантажте на Google Drive.');
  }
}

