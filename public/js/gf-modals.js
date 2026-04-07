/* ═══════════════════════════════════════════════════════════
   gf-modals.js — Модальні вікна GrantFlow
   Редактор картки, статус, форма джерела, пікер, призначення
   ═══════════════════════════════════════════════════════════ */

/* ══════════ 1. РЕДАКТОР КАРТКИ ══════════ */

function gfOpenEditor(id){
  var item=(GF.data.detected||[]).find(function(d){return(d._id||d.detected_id)===id;});
  if(!item){alert('Запис не знайдено.');return;}
  var m=gfId('gfEditorModal');if(!m)return;
  m.classList.remove('hidden');
  /* Fill fields */
  var fields={
    'gfe-id':item._id||item.detected_id,'gfe-title':item.raw_title,
    'gfe-desc':item.full_desc||item.short_desc,'gfe-deadline':item.deadline,
    'gfe-amount':item.amount_text,'gfe-applicants':item.applicants,
    'gfe-goal':item.criteria,'gfe-conditions':item.participation_conditions,
    'gfe-donor':item.donor,'gfe-geo':item.geography,
    'gfe-tags':item.tags,'gfe-topics':item.topics,
    'gfe-src-url':item.source_url,'gfe-det-url':item.detail_url,
    'gfe-notes':item.notes
  };
  Object.keys(fields).forEach(function(fid){
    var el=gfId(fid);if(el)el.value=fields[fid]||'';
  });
  /* Preview iframe */
  var url=item.detail_url||item.source_url||'';
  var fr=gfId('gfe-frame');
  if(fr)fr.src=url||'about:blank';
}

function gfCloseEditor(){
  var m=gfId('gfEditorModal');if(m)m.classList.add('hidden');
  var fr=gfId('gfe-frame');if(fr)fr.src='about:blank';
}

async function gfSaveEditor(){
  var id=(gfId('gfe-id')||{}).value;if(!id)return;
  var data={
    raw_title:(gfId('gfe-title')||{}).value||'',
    full_desc:(gfId('gfe-desc')||{}).value||'',
    short_desc:((gfId('gfe-desc')||{}).value||'').slice(0,500),
    deadline:(gfId('gfe-deadline')||{}).value||'',
    amount_text:(gfId('gfe-amount')||{}).value||'',
    applicants:(gfId('gfe-applicants')||{}).value||'',
    criteria:(gfId('gfe-goal')||{}).value||'',
    participation_conditions:(gfId('gfe-conditions')||{}).value||'',
    donor:(gfId('gfe-donor')||{}).value||'',
    geography:(gfId('gfe-geo')||{}).value||'',
    tags:(gfId('gfe-tags')||{}).value||'',
    topics:(gfId('gfe-topics')||{}).value||'',
    source_url:(gfId('gfe-src-url')||{}).value||'',
    detail_url:(gfId('gfe-det-url')||{}).value||'',
    notes:(gfId('gfe-notes')||{}).value||''
  };
  try{
    await gfUpd(GFC.detected,id,data);
    await gfLog('detected',id,'edit','','','Редагування картки');
    gfCloseEditor();
    gfToast('Збережено','var(--green)');
    await gfRefresh();
  }catch(e){alert('Помилка: '+e.message);}
}

function gfEditorOpenUrl(){
  var url=(gfId('gfe-det-url')||{}).value||(gfId('gfe-src-url')||{}).value;
  if(url)window.open(url,'_blank');
}

/* ══════════ 2. ЗМІНА СТАТУСУ (з причиною) ══════════ */


/* Виділений текст → в коментар при відкритті модалки */
window.GF_LAST_SELECTION = '';
document.addEventListener('selectionchange', function() {
  var s = window.getSelection ? window.getSelection().toString().trim() : '';
  /* Зберігаємо тільки якщо є текст — клік без виділення не скидає */
  if (s.length > 1) window.GF_LAST_SELECTION = s;
});

var GF_REJECT_REASONS=(function(){
  var r=['Крайня дата минула','Не наша географія','Не наш тип заявника','Не наша тематика',
    'Не підходимо за кількістю населення','Потрібен партнер','Складні вимоги',
    'Недостатня сума','Дублікат'];
  r.sort(function(a,b){return a.localeCompare(b,'uk');});
  return ['Інше'].concat(r);
})();
var GF_APPROVE_REASONS=['Підходить за темою','Підходить за заявниками','Підходить за дедлайном',
  'Корисний запис','Інше'];

function gfOpenStatusModal(id,status,hintReason){
  var m=gfId('gfStatusModal');if(!m)return;
  gfId('gfs-id').value=id;
  gfId('gfs-status').value=status;
  var isReject=status==='Не підходить'||status==='Видалено первинно';
  /* Виділений текст → в коментар (тільки для відхилення) */
  var _sel = window.GF_LAST_SELECTION || '';
  window.GF_LAST_SELECTION = '';
  gfId('gfs-comment').value = (isReject && _sel) ? _sel : '';
  var reasons=isReject?GF_REJECT_REASONS:GF_APPROVE_REASONS;
  var sel=gfId('gfs-reason');
  sel.innerHTML=reasons.map(function(r){return'<option value="'+gfE(r)+'">'+gfE(r)+'</option>';}).join('');
  /* Автовибір причини */
  if (hintReason) {
    var _sel2 = gfId('gfs-reason');
    if (_sel2) for (var _i = 0; _i < _sel2.options.length; _i++) {
      if (_sel2.options[_i].value === hintReason) { _sel2.selectedIndex = _i; break; }
    }
  }
  gfId('gfStatusTitle').textContent = isReject ? 'Чому не підходить?' : 'Позначити корисним';
  m.style.display='block';
  setTimeout(function(){ var t=gfId('gfs-comment'); if(t)t.focus(); }, 60);
}

function gfCloseStatusModal(){var m=gfId('gfStatusModal');if(m)m.style.display='none';var c=gfId('gfs-comment');if(c)c.value='';window.GF_LAST_SELECTION='';}

async function gfSubmitStatus(){
  var id=(gfId('gfs-id')||{}).value;
  var status=(gfId('gfs-status')||{}).value;
  var reason=(gfId('gfs-reason')||{}).value;
  var comment=(gfId('gfs-comment')||{}).value.trim();
  try{
    /* Optimistic update */
    var det=GF.data.detected||[];
    for(var i=0;i<det.length;i++){
      if((det[i]._id||det[i].detected_id)===id){
        det[i].status=status; det[i].status_reason=reason;
        det[i].status_comment=comment;
        det[i].status_changed_at=new Date().toISOString();
        break;
      }
    }
    gfCloseStatusModal(); gfCloseEditor(); gfRender();
    await gfSetDetectedStatus(id,status,reason,comment);
    await gfLog('detected',id,'status_change','',status,reason+' '+comment);
    gfToast(status==='Корисне'?'✓ Корисне':'✕ Відхилено', status==='Корисне'?'var(--green)':'var(--red)');
  }catch(e){alert('Помилка: '+e.message);await gfRefresh();}
}

/* ══════════ 3. ФОРМА ДЖЕРЕЛА ══════════ */

function gfOpenSourceForm(sourceId){
  var m=gfId('gfSourceModal');if(!m)return;
  var defaults={source_name:'',source_url:'https://',source_type:'page',parser_mode:'page_links',
    source_status:'active',source_priority:'high',source_topics:'',source_keywords:'',
    item_limit:'20',fetch_details:'true',first_scan_mode:'true',link_include:'',link_exclude:'',
    donor_hint:'',geography_hint:'',applicants_hint:'',scan_window_days:'7',scan_interval_min:'1',notes:''};
  var data=Object.assign({},defaults);
  if(sourceId){
    var src=(GF.data.sources||[]).find(function(s){return(s._id||s.source_id)===sourceId;});
    if(src) Object.keys(src).forEach(function(k){if(src[k]!=null)data[k]=src[k];});
  }
  gfId('gfSrcFormTitle').textContent=sourceId?'Редагування джерела':'Нове джерело';
  gfId('gfsf-id').value=sourceId||'';
  var fields=['source_name','source_url','source_type','parser_mode','source_status',
    'source_priority','source_topics','source_keywords','item_limit','link_include',
    'link_exclude','donor_hint','geography_hint','applicants_hint','scan_window_days',
    'scan_interval_min','notes'];
  fields.forEach(function(f){
    var el=gfId('gfsf-'+f);
    if(!el)return;
    if(el.type==='checkbox')el.checked=String(data[f])==='true';
    else el.value=data[f]||'';
  });
  var chk1=gfId('gfsf-fetch_details');if(chk1)chk1.checked=String(data.fetch_details)==='true';
  var chk2=gfId('gfsf-first_scan_mode');if(chk2)chk2.checked=String(data.first_scan_mode)==='true';
  m.classList.remove('hidden');
}

function gfCloseSourceForm(){var m=gfId('gfSourceModal');if(m)m.classList.add('hidden');}

async function gfSaveSourceForm(){
  var id=(gfId('gfsf-id')||{}).value;
  var payload={};
  var fields=['source_name','source_url','source_type','parser_mode','source_status',
    'source_priority','source_topics','source_keywords','item_limit','link_include',
    'link_exclude','donor_hint','geography_hint','applicants_hint','scan_window_days',
    'scan_interval_min','notes'];
  fields.forEach(function(f){
    var el=gfId('gfsf-'+f);if(el)payload[f]=el.value||'';
  });
  var chk1=gfId('gfsf-fetch_details');if(chk1)payload.fetch_details=chk1.checked?'true':'false';
  var chk2=gfId('gfsf-first_scan_mode');if(chk2)payload.first_scan_mode=chk2.checked?'true':'false';
  if(!payload.source_name||!payload.source_url){alert('Назва і URL обов\'язкові.');return;}
  try{
    if(id){payload.source_id=id;await gfUpd(GFC.sources,id,payload);}
    else{await gfSaveSource(payload);}
    gfCloseSourceForm();
    gfToast('Джерело збережено','var(--green)');
    await gfRefresh();
  }catch(e){alert('Помилка: '+e.message);}
}

/* ══════════ 4. BULK OPERATIONS ══════════ */

var GF_BULK={};

function gfToggleBulk(id){
  if(GF_BULK[id])delete GF_BULK[id];else GF_BULK[id]=true;
  var el=gfId('gfchk_'+id);if(el)el.checked=!!GF_BULK[id];
  gfUpdateBulkBar();
}

function gfToggleAllBulk(){
  var boxes=document.querySelectorAll('.gf-bulk-chk');
  var allChecked=Object.keys(GF_BULK).length===boxes.length;
  GF_BULK={};
  if(!allChecked)boxes.forEach(function(el){GF_BULK[el.dataset.id]=true;el.checked=true;});
  else boxes.forEach(function(el){el.checked=false;});
  gfUpdateBulkBar();
}

function gfUpdateBulkBar(){
  var cnt=Object.keys(GF_BULK).length;
  var bar=gfId('gfBulkBar');
  if(bar)bar.style.display=cnt>0?'flex':'none';
  var el=gfId('gfBulkCnt');
  if(el)el.textContent=cnt;
}

async function gfBulkAction(status){
  var ids=Object.keys(GF_BULK);if(!ids.length)return;
  var reason=status==='Не підходить'?prompt('Причина (для всіх '+ids.length+'):','Не відповідає'):status;
  if(reason===null)return;
  try{
    for(var i=0;i<ids.length;i++){
      await gfSetDetectedStatus(ids[i],status,reason,'');
      /* Update local */
      var det=GF.data.detected||[];
      for(var j=0;j<det.length;j++){
        if((det[j]._id||det[j].detected_id)===ids[i]){
          det[j].status=status;det[j].status_reason=reason;break;
        }
      }
    }
    GF_BULK={};gfUpdateBulkBar();
    gfToast(status+': '+ids.length+' записів',status==='Корисне'?'var(--green)':'var(--red)');
    gfRender();
  }catch(e){alert('Помилка: '+e.message);await gfRefresh();}
}

/* ══════════ 5. ПІКЕР ДОВІДНИКІВ ══════════ */

var GF_PICKER_DEFAULTS={
  source_topics:['Освіта','Громади','Молодь','Культура','Ветерани','Інклюзія','Цифровізація','Енергетика','Соціальний захист','Екологія','Правозахист','Підприємництво','Медицина','Держуправління'],
  source_keywords:['грант','гранти','конкурс','можливість','funding','grant','call','program'],
  donor_hint:['USAID','UNDP','EU','UNICEF','IREX','House of Europe','Карітас','GIZ','Erasmus+'],
  geography_hint:['Вся Україна','Міжнародно','Громади','Кіровоградська','Черкаська','Полтавська'],
  applicants_hint:['Громади','ОМС','Громадські організації','Заклади освіти','Благодійні фонди','Молодіжні організації']
};
var GF_PICKER_FIELD=null;

function gfOpenPicker(field){
  GF_PICKER_FIELD=field;
  var m=gfId('gfPickerModal');if(!m)return;
  var input=gfId('gfsf-'+field);
  var current=(input?input.value:'').split(',').map(function(s){return s.trim();}).filter(Boolean);
  var opts=GF_PICKER_DEFAULTS[field]||[];
  var box=gfId('gfPickerList');
  box.innerHTML=opts.map(function(o){
    var chk=current.indexOf(o)>=0?'checked':'';
    return'<label style="display:flex;gap:8px;align-items:center;padding:5px 0"><input type="checkbox" value="'+gfE(o)+'" '+chk+'><span>'+gfE(o)+'</span></label>';
  }).join('');
  gfId('gfPickerCustom').value='';
  m.classList.remove('hidden');
}

function gfClosePicker(){var m=gfId('gfPickerModal');if(m)m.classList.add('hidden');GF_PICKER_FIELD=null;}

function gfApplyPicker(){
  if(!GF_PICKER_FIELD)return;
  var vals=Array.from(document.querySelectorAll('#gfPickerList input:checked')).map(function(c){return c.value;});
  var custom=(gfId('gfPickerCustom')||{}).value||'';
  if(custom)custom.split(',').forEach(function(v){v=v.trim();if(v&&vals.indexOf(v)<0)vals.push(v);});
  var input=gfId('gfsf-'+GF_PICKER_FIELD);
  if(input)input.value=vals.join(', ');
  gfClosePicker();
}
