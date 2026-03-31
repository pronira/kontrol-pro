/* ══ Recurring Logic ══ */
var REC_DAYS_UA = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
var REC_MON_UA = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
var REC_WORK_DAYS = [1,1,1,1,1,0,0]; // Пн-Пт робочі


function onRecChange() {
  var val = el('df-rc').value;
  var subs = ['rec-daily','rec-monthly','rec-quarterly','rec-yearly','rec-custom'];
  subs.forEach(function(id) { var e = el(id); if(e) e.classList.remove('show'); });

  if (val === 'Щоденно') {
    el('rec-daily').classList.add('show');
    initDailyDays(true); // workdays pre-selected
  } else if (val === 'Щотижня') {
    el('rec-daily').classList.add('show');
    initDailyDays(false); // nothing pre-selected, user picks day
  } else if (val === 'Щомісяця') {
    el('rec-monthly').classList.add('show');
    initMonthPicker('rec-mon-list');
  } else if (val === 'Щокварталу') {
    el('rec-quarterly').classList.add('show');
  } else if (val === 'Щороку') {
    el('rec-yearly').classList.add('show');
    initMonthPicker('rec-yr-mons');
    document.querySelectorAll('#rec-yr-mons .rec-mon').forEach(function(b){ b.classList.remove('on'); });
  } else if (val === 'Довільні дати') {
    el('rec-custom').classList.add('show');
  }
}


function initDailyDays(workdaysOn) {
  var cont = el('rec-daily-days');
  var h = '';
  for (var i = 0; i < 7; i++) {
    var on = workdaysOn ? (REC_WORK_DAYS[i] ? ' on' : '') : '';
    var isWeekend = (i === 5 || i === 6);
    var style = isWeekend ? ' style="color:var(--red)"' : '';
    h += '<div class="rec-day' + on + '" data-day="' + i + '"' + style + ' onclick="this.classList.toggle(\'on\')">' + REC_DAYS_UA[i] + '</div>';
  }
  cont.innerHTML = h;
}


function initMonthPicker(contId) {
  var cont = el(contId);
  if (cont.children.length > 0) return;
  var h = '';
  for (var i = 0; i < 12; i++) {
    h += '<div class="rec-mon on" data-mon="' + i + '" onclick="this.classList.toggle(\'on\')">' + REC_MON_UA[i] + '</div>';
  }
  cont.innerHTML = h;
}


function addRecCustomDate() {
  var cont = el('rec-custom-dates');
  cont.insertAdjacentHTML('beforeend', '<div style="display:flex;gap:3px;align-items:center;margin-bottom:2px"><input type="date" style="font-size:.74rem;flex:1"><button type="button" style="background:none;border:none;color:var(--red);cursor:pointer" onclick="this.parentElement.remove()">✕</button></div>');
}

function getRecurringValue() {
  var base = el('df-rc').value;
  if (base === 'Ні') return 'Ні';

  if (base === 'Щоденно' || base === 'Щотижня') {
    var days = [];
    document.querySelectorAll('#rec-daily-days .rec-day.on').forEach(function(b) { days.push(REC_DAYS_UA[parseInt(b.getAttribute('data-day'))]); });
    if (days.length === 0) return base;
    if (days.length === 7) return 'Щоденно';
    if (base === 'Щоденно') return 'Щоденно (' + days.join(',') + ')';
    return 'Щотижня (' + days.join(',') + ')';
  }

  if (base === 'Щомісяця') {
    var mons = [];
    document.querySelectorAll('#rec-mon-list .rec-mon.on').forEach(function(b) {
      mons.push(parseInt(b.getAttribute('data-mon')) + 1);
    });
    var day = (el('rec-mon-day') || {}).value || '5';
    if (mons.length === 12) return 'Щомісяця ' + day + '-го';
    return 'Щомісяця (' + mons.join(',') + ') ' + day + '-го';
  }

  if (base === 'Щокварталу') {
    var mode = document.querySelector('input[name="rec-q-mode"]:checked');
    var modeVal = mode ? mode.value : 'last';
    var day = (el('rec-q-day') || {}).value || '5';
    if (modeVal === 'last') return 'Щокварталу (остан.) ' + day + '-го';
    return 'Щокварталу (перш.) ' + day + '-го';
  }

  if (base === 'Щороку') {
    var mons = [];
    document.querySelectorAll('#rec-yr-mons .rec-mon.on').forEach(function(b) {
      mons.push(parseInt(b.getAttribute('data-mon')) + 1);
    });
    var day = (el('rec-yr-day') || {}).value || '5';
    var mon = mons.length ? mons[0] : 1;
    return 'Щороку (' + mon + ') ' + day + '-го';
  }

  if (base === 'Довільні дати') {
    var dates = [];
    document.querySelectorAll('#rec-custom-dates input[type=date]').forEach(function(inp) {
      if (inp.value) { var pp = inp.value.split('-'); dates.push(pp[2]+'.'+pp[1]+'.'+pp[0]); }
    });
    if (dates.length) return 'Довільні (' + dates.join(';') + ')';
    return 'Ні';
  }

  return base;
}


// Restore recurring sub-form from saved value
function restoreRecurring(recStr) {
  if (!recStr || recStr === 'Ні') return;

  if (recStr.indexOf('Щоденно') === 0 || recStr.indexOf('Щотижня') === 0) {
    el('df-rc').value = recStr.indexOf('Щоденно') === 0 ? 'Щоденно' : 'Щотижня';
    onRecChange();
    // Parse days
    var match = recStr.match(/\(([^)]+)\)/);
    if (match) {
      var days = match[1].split(',').map(function(s){return s.trim()});
      document.querySelectorAll('#rec-daily-days .rec-day').forEach(function(b) {
        var dayName = REC_DAYS_UA[parseInt(b.getAttribute('data-day'))];
        if (days.indexOf(dayName) >= 0) b.classList.add('on'); else b.classList.remove('on');
      });
    }
  } else if (recStr.indexOf('Щомісяця') === 0) {
    el('df-rc').value = 'Щомісяця';
    onRecChange();
    var match = recStr.match(/\(([^)]+)\)/);
    if (match) {
      var mons = match[1].split(',').map(function(s){return parseInt(s.trim())});
      document.querySelectorAll('#rec-mon-list .rec-mon').forEach(function(b) {
        var m = parseInt(b.getAttribute('data-mon')) + 1;
        if (mons.indexOf(m) >= 0) b.classList.add('on'); else b.classList.remove('on');
      });
    }
    var dayMatch = recStr.match(/(\d+)-го/);
    if (dayMatch) el('rec-mon-day').value = dayMatch[1];
  } else if (recStr.indexOf('Щокварталу') === 0) {
    el('df-rc').value = 'Щокварталу';
    onRecChange();
    if (recStr.indexOf('перш') >= 0) {
      var rb = el('rq-first'); if (rb) rb.checked = true;
    }
    var dayMatch = recStr.match(/(\d+)-го/);
    if (dayMatch) el('rec-q-day').value = dayMatch[1];
  } else if (recStr.indexOf('Щороку') === 0) {
    el('df-rc').value = 'Щороку';
    onRecChange();
    var monMatch = recStr.match(/\((\d+)\)/);
    if (monMatch) {
      var targetMon = parseInt(monMatch[1]) - 1;
      document.querySelectorAll('#rec-yr-mons .rec-mon').forEach(function(b) {
        var m = parseInt(b.getAttribute('data-mon'));
        if (m === targetMon) b.classList.add('on'); else b.classList.remove('on');
      });
    }
    var dayMatch = recStr.match(/(\d+)-го/);
    if (dayMatch) el('rec-yr-day').value = dayMatch[1];
  }
}

