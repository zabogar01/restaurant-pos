/* DESIGN-018: deterministic review fixtures, never a service, a settings store or an authentication store. */
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], O=window.Office;
  const initial=document.documentElement.dataset.state;
  const ME='M. Iqbal', OTHER='Ratna Ayu', NOW='21 Oct 2026, 14:40', EARLIER='21 Oct 2026, 14:32';
  // The settings view carries the installation constants (ADR-012 rule 5); these are their display words.
  const FACTS={currency:'IDR · Indonesian rupiah',precision:'0 · amounts are whole rupiah'};
  const FIELDS=[
    {key:'tax',id:'tax-rate',rate:true,label:'Tax rate',empty:'Enter the tax rate.'},
    {key:'service',id:'service-rate',rate:true,label:'Service charge',empty:'Enter the service charge rate.'},
    {key:'outlet',id:'outlet-name',max:64,empty:'Enter the outlet name.',control:'Remove control characters from the outlet name.'},
    {key:'address',id:'address',max:200,lines:3,empty:'Enter the address.',control:'Remove control characters from the address. Line breaks are allowed.'},
    {key:'phone',id:'phone',max:32,phone:true,empty:'Enter the phone number.'},
    {key:'npwpd',id:'npwpd',max:32,optional:true,control:'Remove control characters from the NPWPD.'},
    {key:'footer',id:'footer',max:120,empty:'Enter the footer line.',control:'Remove control characters from the footer line.'}];
  const RATE={format:'Enter a number, such as 10 or 10,5.',negative:'Use 0 or more.',over:'Use 100 or less.',decimals:'Use at most four decimal places.'};
  const TEXT={lines:'Use three lines or fewer.',phone:'Use only digits, spaces and + - . ( ) /.',long:n=>'Use '+n+' characters or fewer.'};
  const METHOD={empty:'Enter a method name.',long:'Use 32 characters or fewer.',control:'Remove control characters from the name.',duplicate:'An active payment method already uses this name. Choose another name.',reactivate:'An active payment method already uses this name. Rename this inactive method, save, then reactivate it.'};
  const FORM={failure:'Nothing was saved. Your draft is kept. Press Save to try again.',waiting:'Waiting for an earlier save to finish. Nothing will be sent again.'};
  const V4={tax:100000,service:50000,outlet:'Warung Sederhana',address:'Jl. Melati No. 12\nKebayoran Baru\nJakarta Selatan 12160',phone:'021 555 0134',npwpd:'P.2.0012345.07.001',footer:'Terima kasih atas kunjungan Anda'};
  const LONGEST={tax:999999,service:1,outlet:'Rumah Makan Padang Sederhana Sejahtera Cabang Kebayoran Baru Dua',address:'Jalan Raya Kebayoran Lama No. 128, Blok C, Ruko Permata Hijau Indah Lantai 2\nKelurahan Grogol Utara, Kecamatan Kebayoran Lama\nKota Administrasi Jakarta Selatan, DKI Jakarta 12210, Indonesia ABCDEFGHIJ',phone:'+62 21 5550 1340 / 0812 345 6789',npwpd:'P.2.0012345.07.001 / 2026-000123',footer:'Terima kasih atas kunjungan Anda. Simpan struk ini sebagai bukti pembayaran yang sah. Kritik dan saran: 021 5550 1340 AB'};
  const LONGEST_METHOD='Voucher Makan Karyawan ABCDEFGHI';
  const seedMethods=()=>[{id:'m1',name:'Bank transfer',active:true},{id:'m2',name:'Meal voucher',active:true},{id:'m3',name:'Staff account',active:true},{id:'m4',name:'Gift card',active:false}];

  // `server` is the fixture's stand-in for the database; `current` is what this page last read or was answered.
  let server={version:4,at:'12 Oct 2026, 14:05',by:ME,values:{...V4}}, current=null, sRead='ready', factsWithheld=false;
  const reread=()=>{current=server&&{...server,values:{...server.values}};};
  let form=null, confirm=null;
  let methods=seedMethods(), mRead='ready', partial=false, failNextRead=false, mEditor=null, mResult='';
  let inFlight=null, settled=null, commands=0, rereads=0, statusCommand=null, instant=false;
  const busy=()=>!!inFlight;
  let session='active', departure=null, heldDecision=false, heldConfirm=false, otherMode=false, queueIncidents=false, lastField=null;
  $('.office-day')?.remove();

  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const set=s=>O.setState(s);
  const field=f=>$('#'+f.id);
  const byKey=k=>FIELDS.find(f=>f.key===k);

  /* The rate field (DESIGN-018 rule): a percent with a comma or full stop, at most four places, 0 to 100. */
  function percentText(ppm){const whole=Math.floor(ppm/10000),fraction=String(ppm%10000).padStart(4,'0').replace(/0+$/,'');return fraction?whole+','+fraction:String(whole);}
  function parseRate(raw){
    let v=raw.trim();if(v.endsWith('%'))v=v.slice(0,-1).trim();
    if(!v)return {error:'empty'};
    if(/^-\s*[0-9]*(?:[.,][0-9]*)?$/.test(v)&&/[0-9]/.test(v))return {error:'negative'};
    const m=/^([0-9]*)(?:[.,]([0-9]*))?$/.exec(v);if(!m||!/[0-9]/.test(v))return {error:'format'};
    const whole=m[1].replace(/^0+(?=[0-9])/,'')||'0',fraction=m[2]||'';
    if(fraction.length>4)return {error:'decimals'};
    // Production converts `whole + '.' + fraction` with rateFromPercent; this fixture adds the parts.
    const ppm=Number(whole)*10000+Number(fraction.padEnd(4,'0'));
    if(ppm>1000000)return {error:'over'};
    return {ppm};
  }
  const display=(f,v)=>f.rate?percentText(v):(v??'');
  const shown=(f,v)=>f.rate?percentText(v)+'%':(v??'Not set');
  const same=(a,b)=>FIELDS.every(f=>(a[f.key]??null)===(b[f.key]??null));
  const facts=()=>current?'Version '+current.version+' · In force since '+current.at+' · Saved by '+current.by:'Not saved yet. Saving creates version 1.';

  /* ---------- Settings: read view, form and its notices ---------- */
  function renderSettings(){
    const ready=sRead==='ready';
    $$('[data-fact=currency]').forEach(e=>e.textContent=FACTS.currency);$$('[data-fact=precision]').forEach(e=>e.textContent=FACTS.precision);
    $('#version-facts').textContent=ready&&!factsWithheld?facts():'';
    const read=$('#settings-read');
    read.innerHTML=sRead==='loading'?'<div class="office-notice" role="status">Loading settings…</div>':sRead==='failed'?'<div class="office-notice" role="alert"><strong>Settings could not be loaded</strong><p>Try again to read the settings.</p><button type="button" class="office-button" id="retry-settings">Try again</button></div>':!current&&!form?'<div class="office-empty"><div class="office-empty-title">No settings saved yet</div><p>Enter the rates and receipt details. Saving creates version 1.</p><button type="button" class="office-button" id="enter-settings">Enter settings</button></div>':'';
    read.hidden=!read.innerHTML;
    $('#retry-settings')?.addEventListener('click',()=>{sRead='loading';renderAll();setTimeout(()=>{sRead='ready';reread();renderAll();set('default');firstOpener()?.focus();},350);});
    $('#enter-settings')?.addEventListener('click',()=>{if(!busy())leave(()=>openSettings('tax',null),'switch');});
    $('#settings-view').hidden=!ready||!current||!!form;
    if(current)$$('[data-show]').forEach(e=>{const f=byKey(e.dataset.show),v=current.values[f.key];e.textContent=shown(f,v);e.dataset.empty=String(v==null);});
    $('#settings-form').hidden=!form||!ready;
  }
  function describe(f){
    const parts=[];if(!$('#'+f.id+'-error').hidden)parts.push(f.id+'-error');if(!$('#'+f.id+'-current').hidden)parts.push(f.id+'-current');parts.push(f.id+'-help');
    field(f).setAttribute('aria-describedby',parts.join(' '));
  }
  function setError(f,msg){const e=$('#'+f.id+'-error');e.hidden=!msg;e.textContent=msg;field(f).setAttribute('aria-invalid',msg?'true':'false');describe(f);}
  function setCurrent(f,value){const e=$('#'+f.id+'-current');e.hidden=value===undefined;e.textContent=value===undefined?'':'Now in force: '+(f.rate?percentText(value)+'%':value??'not set');describe(f);}
  function setNotice(kind,title,body,extra={}){
    const n=$('#settings-notice');n.hidden=!kind;n.dataset.kind=kind||'';n.setAttribute('role',kind==='failure'||kind==='stale'?'alert':'status');
    n.querySelector('strong').textContent=title||'';n.querySelector('p').textContent=body||'';
    $('#stale-choices').hidden=!extra.choices;$('#retry-settings-read').hidden=!extra.retry;
    $('#save-hint').hidden=!extra.choices;$('#save-settings').disabled=!!extra.choices||inFlight?.kind==='settings';
    $('#save-settings').setAttribute('aria-describedby',extra.choices?'save-hint':'');
  }
  function lockFields(on){FIELDS.forEach(f=>field(f).disabled=on);$('#save-settings').disabled=on||!$('#stale-choices').hidden;}
  function openSettings(focusKey='tax',opener=focusKey,focus=true){
    clearStatuses();
    lastField=null;
    form={base:current?.version??null,baseValues:current?{...current.values}:null,opening:{},opener,uncertain:false,stale:null};
    FIELDS.forEach(f=>{const v=current?display(f,current.values[f.key]):'';field(f).value=v;form.opening[f.key]=v;setError(f,'');setCurrent(f);});
    $('#settings-form-title').textContent=current?'Edit settings':'Enter settings';
    $('#settings-context').textContent=current?'Changes apply to orders opened after you save. Orders already open keep the settings they opened with.':'Nothing is saved yet. Enter every rate and detail; saving creates version 1.';
    setNotice('');lockFields(false);renderAll();
    if(focus)field(byKey(focusKey||'tax')).focus();
  }
  const settingsDirty=()=>!!form&&FIELDS.some(f=>field(f).value!==form.opening[f.key]);
  function closeSettings(moveFocus=true){
    if(inFlight?.kind==='settings'&&inFlight.form===form)inFlight.discarded=true;
    const opener=form?.opener;form=null;FIELDS.forEach(f=>{setError(f,'');setCurrent(f);});setNotice('');renderAll();
    if(moveFocus)(opener&&!$('#settings-view').hidden?$('[data-change="'+opener+'"]'):firstOpener())?.focus({preventScroll:true});
  }
  function firstOpener(){return !$('#settings-view').hidden?$('[data-change=tax]'):$('#enter-settings')||$('#new-method');}
  function check(){
    const values={},errors=[];
    for(const f of FIELDS){
      const el=field(f);let msg='';
      if(f.rate){const r=parseRate(el.value);if(r.error)msg=r.error==='empty'?f.empty:RATE[r.error];else values[f.key]=r.ppm;if(msg)errors.push([f,msg,'rate-'+r.error]);continue;}
      el.value=el.value.trim();const v=el.value;let kind='';
      if(!v){if(!f.optional){msg=f.empty;kind='required';}}
      else if(v.length>f.max){msg=TEXT.long(f.max);kind='long';}
      else if(f.lines&&v.split('\n').length>f.lines){msg=TEXT.lines;kind='address-lines';}
      else if(f.phone&&!/^[0-9 +\-.()/]+$/.test(v)){msg=TEXT.phone;kind='phone';}
      else if(/\p{Cc}/u.test(f.lines?v.replace(/\n/g,''):v)){msg=f.control;kind='control';}
      if(msg)errors.push([f,msg,kind]);else values[f.key]=v||null;
    }
    return {values,errors};
  }
  function submitSettings(response=$('#fixture-response').value){
    if(!form||inFlight||!$('#stale-choices').hidden)return;
    const {values,errors}=check();FIELDS.forEach(f=>setError(f,''));
    if(errors.length){errors.forEach(([f,msg])=>setError(f,msg));field(errors[0][0]).focus();set('invalid-'+errors[0][2]);return;}
    const changed=form.baseValues?['tax','service'].filter(k=>values[k]!==form.baseValues[k]):[];
    if(changed.length)return openConfirm(values,changed,response);
    send({kind:'settings',op:'save',values,base:form.base,form},response);
  }
  function openConfirm(values,changed,response){
    confirm={values,changed,response};
    $('#confirm-changes').innerHTML=changed.map(k=>'<li>'+byKey(k).label+' from '+percentText(form.baseValues[k])+'% to '+percentText(values[k])+'%</li>').join('');
    $('#confirm-also').hidden=!FIELDS.some(f=>!f.rate&&(values[f.key]??null)!==(form.baseValues[f.key]??null));
    alertCopy('#confirm-emergency');O.open($('#rate-confirm'),$('#confirm-back'));set('confirm-rates');
  }
  function backToEditing(){const k=confirm?.changed[0]||'tax';confirm=null;$('#rate-confirm').close();field(byKey(k)).focus();set('edit');flushAnswer();}
  $('#rate-confirm').addEventListener('cancel',e=>{e.preventDefault();backToEditing();});
  $('#confirm-back').onclick=backToEditing;
  $('#confirm-save').onclick=()=>{const c=confirm;confirm=null;$('#rate-confirm').close();send({kind:'settings',op:'save',values:c.values,base:form.base,form},c.response);};
  function commit(values,by,at){server={version:(server?.version??0)+1,at,by,values:{...values}};}
  function otherSave(by=OTHER){commit({...server.values,service:55000,phone:'021 555 0199'},by,EARLIER);}
  function showStale(kind){
    form.stale=current;const differing=FIELDS.filter(f=>{const r=f.rate?parseRate(field(f).value):null;const draft=f.rate?(r.error?NaN:r.ppm):(field(f).value.trim()||null);return draft!==(current.values[f.key]??null);});
    FIELDS.forEach(f=>setCurrent(f,differing.includes(f)?current.values[f.key]:undefined));
    const versionLine=kind==='stale'?'Nothing was saved. Version '+current.version+' was saved by '+current.by+' on '+current.at+', after you started. ':'The outcome could not be confirmed. The settings have been read again: version '+current.version+', saved by '+current.by+' on '+current.at+', is now in force. It may be this save. ';
    const compare=differing.length?'Fields where it differs from your draft show its value. ':'It has the same values as your draft. ';
    setNotice(kind==='stale'?'stale':'unknown',kind==='stale'?'Settings changed while you were editing':'Outcome not confirmed',versionLine+compare+(kind==='stale'?'Choose which to keep.':'Your draft is kept; nothing was sent again. Choose which to keep.'),{choices:true});
    $('#settings-notice').focus();
  }
  $('#keep-draft').onclick=()=>{
    const v=form.stale;form.base=v.version;form.baseValues={...v.values};form.stale=null;
    setNotice('kept','Your changes now build on version '+v.version,'Nothing has been saved yet. Press Save to save them.');$('#save-settings').focus();
  };
  $('#use-current').onclick=()=>{
    const v=form.stale;form.base=v.version;form.baseValues={...v.values};form.stale=null;
    FIELDS.forEach(f=>{const d=display(f,v.values[f.key]);field(f).value=d;form.opening[f.key]=d;setError(f,'');setCurrent(f);});
    setNotice('used','The form now shows version '+v.version,'Nothing was saved. Edit it and save, or Cancel to close.');field(FIELDS[0]).focus();
  };
  $('#retry-settings-read').onclick=()=>{
    $('#retry-settings-read').disabled=true;
    setTimeout(()=>{$('#retry-settings-read').disabled=false;factsWithheld=false;reread();rereads++;renderAll();if(!form)return;if(current?.version!==form.base){showStale('unknown');set('unknown-changed');}else{unknownSame();set('unknown');}},350);
  };
  function unknownSame(){setNotice('unknown','Outcome not confirmed','The outcome could not be confirmed. The settings have been read again; version '+current.version+' is in force. Your draft is kept; nothing was sent again.');field(FIELDS[0]).focus();}
  function finishSettings(response,cmd){
    const silent=cmd.discarded||cmd.form!==form;
    if(response==='stale')otherSave();
    let outcome=response;
    if(response==='saved'||response==='stale')outcome=cmd.base!==(server?.version??null)?'stale':server&&same(cmd.values,server.values)?'unchanged':'saved';
    if(outcome==='saved'||response==='unknown-changed')commit(cmd.values,ME,NOW);
    // The answer to a save carries the version now current; a refusal or an unknown outcome rereads.
    if(outcome==='saved'||outcome==='unchanged'||outcome==='stale'||response==='unknown'||response==='unknown-changed')reread();
    if(outcome==='stale'||response.startsWith('unknown'))rereads++;
    if(silent){status('settings','');renderAll();return;}
    lockFields(false);
    if(outcome==='saved'||outcome==='unchanged'){
      closeSettings();status('settings',outcome==='saved'?'Settings saved as version '+current.version+'. Orders opened from now on use them.':'Nothing changed. Version '+current.version+' is still in force.');set(outcome);return;
    }
    if(outcome==='stale'){showStale('stale');set('stale');return;}
    if(response==='failure'||response==='not-found'||response==='duplicate'){setNotice('failure','Something went wrong',FORM.failure);field(FIELDS[0]).focus();set('failure');return;}
    form.uncertain=true;
    if(response==='unknown-read-failed'){factsWithheld=true;renderAll();setNotice('unknown','Outcome not confirmed','The outcome could not be confirmed. The settings could not be read again. Your draft is kept; nothing was sent again.',{retry:true});field(FIELDS[0]).focus();set('unknown-read-failed');return;}
    if(current.version!==form.base){showStale('unknown');set('unknown-changed');return;}
    unknownSame();set('unknown');
  }

  /* ---------- Payment methods: BO-05's list, panel and status commands ---------- */
  const sorted=()=>[...methods].sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name,'en',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id));
  function renderMethods(){
    const usable=mRead==='ready'||partial;
    $('#method-count').textContent=mRead==='ready'?methods.filter(m=>m.active).length+' active · '+methods.filter(m=>!m.active).length+' inactive custom methods':'';
    const read=$('#methods-read');
    read.innerHTML=mRead==='loading'?'<div class="office-notice" role="status">Loading payment methods…</div>':partial?'<div class="office-notice" role="alert"><strong>The list may be out of date</strong><p>Payment methods could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list.</p><button type="button" class="office-button" id="retry-methods">Try again</button></div>':mRead==='failed'?'<div class="office-notice" role="alert"><strong>Payment methods could not be loaded</strong><p>Try again to read the payment methods.</p><button type="button" class="office-button" id="retry-methods">Try again</button></div>':'';
    read.hidden=!read.innerHTML;
    $('#retry-methods')?.addEventListener('click',()=>readMethods(true));
    $('#methods-list').hidden=!usable;$('#methods-empty').hidden=!usable||methods.length>0;
    const active=document.activeElement,restore=active?.dataset.edit?['edit',active.dataset.edit]:active?.dataset.toggle?['toggle',active.dataset.toggle]:null;
    const inert=busy();
    const holderName=mResult==='duplicate'?$('#method-name').value.toLowerCase():null;
    const fixed=[['cash','Cash'],['card','Card']].map(([id,name])=>'<tr data-fixed="'+id+'"><td>'+name+'</td><td class="table-status">Always offered</td><td></td></tr>').join('');
    $('#method-rows').innerHTML=fixed+sorted().map(m=>{
      const holder=holderName!==null&&m.active&&m.id!==mEditor?.id&&m.name.toLowerCase()===holderName;
      return '<tr data-id="'+m.id+'" data-active="'+m.active+'" data-selected="'+(m.id===mEditor?.id)+'" data-holder="'+holder+'"><td>'+esc(m.name)+(holder?'<span class="table-holder">Name in use</span>':'')+'</td><td class="table-status">'+(m.active?'Active':'Inactive')+'</td><td><button type="button" class="office-button small" data-edit="'+m.id+'" aria-label="Edit '+esc(m.name)+' — '+(m.active?'active':'inactive')+'" aria-disabled="'+inert+'"'+(inert?' tabindex="-1"':'')+'>Edit</button><button type="button" class="office-button small" data-toggle="'+m.id+'" aria-label="'+(m.active?'Deactivate ':'Reactivate ')+esc(m.name)+'"'+(inert?' disabled':'')+'>'+(m.active?'Deactivate':'Reactivate')+'</button></td></tr>';
    }).join('');
    if(restore&&session==='active'&&!departure)$('#method-rows').querySelector('[data-'+restore[0]+'="'+restore[1]+'"]')?.focus({preventScroll:true});
    $('#method-editor').hidden=!mEditor;$('#methods-workspace').classList.toggle('editing',!!mEditor);
  }
  function readMethods(retry){
    mRead='loading';partial=false;renderAll();
    setTimeout(()=>{if(failNextRead){failNextRead=false;mRead='failed';}else mRead='ready';renderAll();if(retry){set(mRead==='ready'?'default':'methods-load-error');$('#new-method').focus();}},350);
  }
  function openMethod(id=null,focus=true){
    clearStatuses();const m=methods.find(m=>m.id===id);mEditor={id,original:m?.name||'',opener:id};mResult='';
    $('#method-name').value=mEditor.original;$('#method-name').disabled=false;$('#save-method').disabled=false;
    $('#method-editor-title').textContent=m?'Edit '+m.name:'New payment method';
    $('#method-context').textContent=m?(m.active?'Active method. Changes keep this method’s history.':'Inactive method. Saving its name does not reactivate it.'):'Choose the name cashiers will see when they take payment.';
    methodError('');methodNotice('');renderAll();if(focus)$('#method-name').focus();
  }
  function closeMethod(moveFocus=true){
    if(inFlight?.kind==='method'&&inFlight.editor===mEditor)inFlight.discarded=true;
    const opener=mEditor?.opener;mEditor=null;mResult='';renderAll();
    if(moveFocus)($('#method-rows').querySelector('[data-edit="'+opener+'"]')||$('#new-method')).focus({preventScroll:true});
  }
  const methodDirty=()=>!!mEditor&&$('#method-name').value!==mEditor.original;
  function methodError(text){const e=$('#method-error');e.hidden=!text;e.textContent=text;$('#method-name').setAttribute('aria-invalid',text?'true':'false');$('#method-name').setAttribute('aria-describedby',text?'method-error method-help':'method-help');if(text)$('#method-name').focus();}
  function methodNotice(kind,title,body){const n=$('#method-notice');n.hidden=!title;n.dataset.kind=kind;n.setAttribute('role',kind==='failure'?'alert':'status');n.innerHTML=title?'<strong>'+esc(title)+'</strong><p>'+esc(body)+'</p>':'';}
  function submitMethod(response=$('#fixture-response').value){
    if(!mEditor||inFlight)return;
    $('#method-name').value=$('#method-name').value.trim();const v=$('#method-name').value;
    const error=!v?METHOD.empty:v.length>32?METHOD.long:/\p{Cc}/u.test(v)?METHOD.control:'';
    if(error){methodError(error);set(!v?'method-invalid-empty':v.length>32?'method-invalid-long':'method-invalid-control');return;}
    methodError('');const m=methods.find(m=>m.id===mEditor.id);
    if(response==='saved'&&(!m||m.active)&&methods.some(o=>o.active&&o.id!==mEditor.id&&o.name.toLowerCase()===v.toLowerCase()))response='duplicate';
    send({kind:'method',op:'save',id:mEditor.id,name:v,editor:mEditor},response);
  }
  function changeStatus(id,response=$('#fixture-response').value){
    if(inFlight)return;const m=methods.find(m=>m.id===id),op=m.active?'deactivate':'reactivate';
    if(response==='saved'&&op==='reactivate'&&methods.some(o=>o.active&&o.id!==id&&o.name.toLowerCase()===m.name.toLowerCase()))response='duplicate';
    send({kind:'method',op,id,name:m.name,editor:null},response);
  }
  function applyMethod(cmd){
    let m=methods.find(m=>m.id===cmd.id);
    if(cmd.op==='save'){if(m)m.name=cmd.name;else{m=methods.find(x=>x.id===cmd.createdId)||{id:cmd.createdId,name:cmd.name,active:true};if(!methods.includes(m))methods.push(m);}}
    else if(m)m.active=cmd.op==='reactivate';
    if(mRead==='failed')partial=true;
    return m?.id;
  }
  function finishMethod(response,cmd){
    if(response==='stale')response='saved';
    const silent=cmd.discarded||(cmd.op==='save'&&cmd.editor!==mEditor);
    if(silent)status('methods','');
    if(response==='saved'){
      const id=applyMethod(cmd);renderAll();if(silent)return;
      if(cmd.op==='save')closeMethod(false);
      ($('#method-rows').querySelector('[data-edit="'+id+'"]'))?.focus({preventScroll:true});
      status('methods',cmd.name+(cmd.op==='save'?' saved.':cmd.op==='deactivate'?' deactivated. It is kept for history.':' reactivated.'));
      set(partial?'method-partial':cmd.op==='save'?'method-saved':cmd.op==='deactivate'?'method-deactivated':'method-reactivated');return;
    }
    if(response.startsWith('unknown')){
      rereads++;const failed=response==='unknown-read-failed'||failNextRead;failNextRead=false;
      if(failed){mRead='failed';partial=false;}else{mRead='ready';partial=false;applyMethod(cmd);}
      renderAll();if(silent)return;
      if(cmd.op!=='save'){statusCommand=cmd;status('methods',cmd.name+': the outcome could not be confirmed. '+(failed?'The list could not be refreshed.':'The list has been refreshed.')+' Nothing was sent again.');$('#methods-status').focus();set('method-unknown-'+cmd.op);return;}
      mResult='unknown';$('#method-name').disabled=false;$('#save-method').disabled=false;
      methodNotice('unknown','Outcome not confirmed',failed?'The outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again.':'The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.');$('#method-name').focus();set('method-unknown');return;
    }
    if(silent){if(response==='duplicate'||response==='not-found')rereads++;renderAll();return;}
    $('#method-name').disabled=false;$('#save-method').disabled=false;
    if(response==='duplicate'){
      rereads++;const reactivation=cmd.op==='reactivate';if(reactivation)openMethod(cmd.id);
      mResult='duplicate';methodNotice('');renderAll();methodError(reactivation?METHOD.reactivate:METHOD.duplicate);
      set(reactivation?'method-duplicate-reactivate':mEditor.id?'method-duplicate-rename':'method-duplicate-create');return;
    }
    if(response==='not-found')rereads++;
    if(cmd.op==='save'){mResult='failure';methodNotice('failure','Something went wrong',FORM.failure);renderAll();$('#method-name').focus();}
    else{status('methods','Something went wrong. '+cmd.name+' was not changed. Use its row action to try again.');renderAll();$('#methods-status').focus();}
    set('method-failure');
  }

  /* ---------- One command at a time on this screen ---------- */
  function send(cmd,response){
    clearStatuses();commands++;cmd.createdId='method-'+commands;cmd.discarded=false;inFlight=cmd;
    if(cmd.kind==='settings'){form.uncertain=false;setNotice('pending','Saving…','Wait for the result. Your draft is kept.');lockFields(true);renderAll();$('#settings-notice').focus();set('saving');}
    else if(cmd.op==='save'){mResult='pending';$('#save-method').disabled=true;$('#method-name').disabled=true;methodNotice('pending','Saving…','Wait for the result. Your draft is kept.');renderAll();$('#method-notice').focus();set('method-saving');}
    else{status('methods',(cmd.op==='deactivate'?'Deactivating ':'Reactivating ')+cmd.name+'…');renderAll();$('#methods-status').focus();set('method-pending-'+cmd.op);}
    if(response==='pending')return;if(instant)finish(response,cmd);else setTimeout(()=>finish(response,cmd),450);
  }
  function finish(response,cmd=inFlight){
    if(!cmd)return;
    // A previous manager's command: its success lands silently; nothing is announced or focused.
    if(cmd.foreign){if(response==='saved'||response==='unknown-changed'){if(cmd.kind==='method')applyMethod(cmd);else if(cmd.base===(server?.version??null)&&!(server&&same(cmd.values,server.values)))commit(cmd.values,ME,NOW);}renderAll();return;}
    if(response==='idle'||response==='ended'){
      inFlight=null;
      if(cmd.kind==='settings'){setNotice('');lockFields(false);}
      else if(cmd.op==='save'){mResult='';methodNotice('');$('#method-name').disabled=false;$('#save-method').disabled=false;}
      else status('methods',cmd.name+' was not changed. Use its row action to try again.');
      renderAll();if(session==='active'||(response==='ended'&&session!=='ended'))expire(response);return;
    }
    if(departure||confirm||session!=='active'){settled={response,cmd};return;}
    inFlight=null;
    if(cmd.kind==='settings')finishSettings(response,cmd);else finishMethod(response,cmd);
    renderAll();
  }
  function flushAnswer(){if(settled&&session==='active'&&!departure&&!confirm){const a=settled;settled=null;finish(a.response,a.cmd);}}
  function status(part,text){const s=$('#'+part+'-status');s.hidden=!text;s.textContent=text;}
  function clearStatuses(){status('settings','');status('methods','');statusCommand=null;}
  function renderOpeners(){
    const on=busy();
    $$('[data-change]').forEach(b=>{b.setAttribute('aria-disabled',String(on));b.tabIndex=on?-1:0;});
    const off=on||(mRead!=='ready'&&!partial);$('#new-method').setAttribute('aria-disabled',String(off));$('#new-method').tabIndex=off?-1:0;
    if($('#enter-settings'))$('#enter-settings').disabled=on;
    if(inFlight?.discarded)status(inFlight.kind==='settings'?'settings':'methods',FORM.waiting);
  }
  function renderAll(){renderSettings();renderMethods();renderOpeners();}

  /* ---------- Departure: one form at a time; the open form decides ---------- */
  const openForm=()=>form?'settings':mEditor?'method':null;
  const dirty=()=>form?settingsDirty():methodDirty();
  const uncertain=()=>(!!inFlight&&!inFlight.discarded&&inFlight.op==='save'&&(inFlight.kind==='settings'?!!form:!!mEditor))||!!form?.uncertain||(!!mEditor&&mResult==='unknown');
  function alertCopy(target){const area=$(target);area.hidden=!O.kitchen;if(O.kitchen){area.querySelector('strong').textContent=O.kitchenIncident.title;area.querySelector('p').textContent=O.kitchenIncident.identity;}}
  function depart(action){if(form)closeSettings();if(mEditor)closeMethod();flushAnswer();action();renderOpeners();}
  function leave(action,reason='cancel'){
    if(!openForm()||(!dirty()&&!uncertain())){depart(action);return;}
    const which=openForm();departure={action,reason,which,focus:document.activeElement,prior:document.documentElement.dataset.state};
    $('#departure-title').textContent=reason==='logout'?'Log out and discard your changes?':'Discard unsaved changes?';
    $('#stay').textContent=reason==='logout'?'Keep this draft':'Stay';$('#discard').textContent=reason==='logout'?'Discard changes and log out':'Discard';
    $('#departure-copy').textContent=reason==='logout'?'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.':uncertain()?'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.':'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
    $('#departure-uncertain').hidden=!(reason==='logout'&&uncertain());
    alertCopy('#departure-emergency');$('#departure-emergency p:last-of-type').textContent=reason==='logout'?'Decide whether to keep this draft or discard it before opening print incidents.':'Decide whether to stay or discard before opening print incidents.';
    O.open($('#departure'),$('#stay'));
    const pendingSave=!!inFlight&&!inFlight.discarded;
    set(uncertain()?(pendingSave?'leave-pending':'leave-unknown'):which==='method'?(reason==='cancel'?'method-unsaved':reason==='switch'?'method-unsaved-switch':'unsaved-'+reason):reason==='cancel'?'unsaved':'unsaved-'+reason);
  }
  function workFocus(){
    if(inFlight&&!inFlight.discarded)return inFlight.kind==='settings'?$('#settings-notice'):$('#method-notice');
    if(form)return lastField&&$('#settings-form').contains(lastField)&&!lastField.disabled?lastField:field(FIELDS[0]);
    return $('#method-name');
  }
  function stay(){
    const focusTarget=workFocus(),prior=departure?.prior;departure=null;O.close($('#departure'),focusTarget);
    if(prior)set(prior);
    if(session==='idle')O.open($('#settings-reauth'),$('#resume-password'));else flushAnswer();
  }
  $('#departure').addEventListener('cancel',e=>{e.preventDefault();stay();});
  $('#stay').onclick=stay;
  $('#discard').onclick=()=>{const action=departure?.action;departure=null;$('#departure').close();depart(action||(()=>{}));};

  /* ---------- M-6 and BO-01 (DESIGN-012, DESIGN-015, D's working-area rule) ---------- */
  function expire(mode){
    session=mode;heldDecision=$('#departure').open;heldConfirm=$('#rate-confirm').open;
    if(mode==='ended'){
      $('#departure').close();$('#rate-confirm').close();$('#settings-reauth').close();
      $('#settings-frame').hidden=true;$('#settings-content').removeAttribute('role');$('#settings-login').hidden=false;$('#settings-login').setAttribute('role','main');
      $('#username').value='';$('#password').value='';$('#username').focus();set(heldConfirm?'bo01-confirm':'bo01-draft');
    }else{resetResume();alertCopy('#reauth-emergency');O.open($('#settings-reauth'),$('#resume-password'));set(heldConfirm?'reauth-confirm':'reauth');}
  }
  function resetResume(){otherMode=false;$('#reauth-title').textContent='Your session timed out';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=true;$('#resume-username').value='m.iqbal';$('#resume-password').value='';$('#resume-error').hidden=true;$('#different-manager').hidden=false;$('#back-manager').hidden=true;$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#resume').hidden=false;$('#resume').textContent='Continue';$('#reauth-description').textContent='Your unsaved changes are kept. Continue as m.iqbal to resume them.';}
  function resume(sameManager){
    session='active';$('#settings-reauth').close();$('#password').value='';$('#resume-password').value='';$('#settings-login').hidden=true;$('#settings-login').removeAttribute('role');$('#settings-frame').hidden=false;$('#settings-content').setAttribute('role','main');
    if(sameManager){
      renderAll();
      if(heldConfirm&&confirm){O.open($('#rate-confirm'),$('#confirm-back'));set('confirm-rates');}
      else if(heldDecision&&departure){O.open($('#departure'),$('#stay'));set(departure.which==='method'?'method-unsaved':'unsaved');}
      else if(settled)flushAnswer();
      else if(inFlight&&!inFlight.discarded){set(inFlight.kind==='settings'?'saving':inFlight.op==='save'?'method-saving':'method-pending-'+inFlight.op);(inFlight.kind==='settings'?$('#settings-notice'):inFlight.op==='save'?$('#method-notice'):$('#methods-status')).focus();}
      else if(form||mEditor){workFocus().focus();set(form?(form.uncertain?'unknown':'edit'):'method-rename');}
      else{set('default');firstOpener()?.focus();}
      if(queueIncidents){queueIncidents=false;leave(()=>location.href=O.emergency.querySelector('a').href,'rail');}
    }else{
      departure=null;confirm=null;$('#departure').close();$('#rate-confirm').close();
      if(inFlight)inFlight.foreign=true;if(settled)settled.cmd.foreign=true;inFlight=null;
      if(form)closeSettings(false);if(mEditor)closeMethod(false);FIELDS.forEach(f=>field(f).value='');$('#method-name').value='';
      $('.office-actor').textContent='Ratna Ayu · Manager';clearStatuses();flushAnswer();renderAll();
      if(!current)openSettings('tax',null,false);
      set(current?'default':'first-run');firstOpener()?.focus();if(!current)field(FIELDS[0]).focus();
    }
    heldDecision=false;heldConfirm=false;
  }
  $('#settings-reauth').addEventListener('cancel',e=>e.preventDefault());
  $('#settings-reauth').addEventListener('keydown',e=>{if(e.key==='Tab')e.stopPropagation();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}});
  $('#settings-reauth').addEventListener('close',()=>{if(session==='idle'&&!$('#settings-reauth').open&&!$('#departure').open)O.open($('#settings-reauth'),$('#resume-password'));});
  $('#different-manager').onclick=()=>{$('#resume-fields').hidden=true;$('#different-manager').hidden=true;$('#resume').hidden=true;$('#stay-manager').hidden=false;$('#choose-manager').hidden=false;$('#reauth-title').textContent='Sign in as a different manager?';$('#reauth-description').textContent='The current manager’s unsaved changes will not be available to the manager signing in.';$('#idle-logout').hidden=true;$('#stay-manager').focus();};
  $('#stay-manager').onclick=()=>{resetResume();$('#resume-password').focus();};
  $('#choose-manager').onclick=()=>{otherMode=true;$('#reauth-title').textContent='Sign in as a different manager';$('#reauth-description').textContent='Enter your own username and password. The current manager’s unsaved changes will not be available to you.';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=false;$('#resume-username').value='';$('#resume-password').value='';$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#back-manager').hidden=false;$('#resume').hidden=false;$('#resume').textContent='Sign in';$('#resume-username').focus();};
  $('#back-manager').onclick=()=>{resetResume();$('#resume-password').focus();};
  $('#resume-form').onsubmit=e=>{e.preventDefault();if(otherMode&&!$('#resume-username').value){$('#resume-username').focus();return;}if(!$('#resume-password').value){$('#resume-error').hidden=false;$('#resume-password').focus();return;}resume(!otherMode||$('#resume-username').value.trim().toLowerCase()==='m.iqbal');};
  $('#held-sign-in').onsubmit=e=>{e.preventDefault();let first;for(const id of ['username','password']){const missing=!$('#'+id).value;$('#'+id+'-error').hidden=!missing;$('#'+id).setAttribute('aria-invalid',String(missing));if(missing){$('#'+id).setAttribute('aria-describedby',id+'-error');first||=$('#'+id);}else $('#'+id).removeAttribute('aria-describedby');}if(first)return first.focus();resume($('#username').value.trim().toLowerCase()==='m.iqbal');};
  $('#idle-logout').onclick=()=>{heldDecision=false;$('#settings-reauth').close();leave(()=>{session='ended';location.href=O.logout.href;},'logout');};
  $('#queue-incidents').onclick=()=>{queueIncidents=true;$('#reauth-description').textContent='Continue as m.iqbal to open print incidents. Your unsaved changes are kept.';$('#resume-password').focus();};

  /* ---------- Controls ---------- */
  $('#settings-view').onclick=e=>{const b=e.target.closest('[data-change]');if(!b||busy())return;leave(()=>openSettings(b.dataset.change),'switch');};
  $('#settings-form').onsubmit=e=>{e.preventDefault();submitSettings();};
  $('#cancel-settings').onclick=()=>leave(()=>set('default'));
  FIELDS.forEach(f=>{field(f).addEventListener('input',()=>setError(f,''));field(f).addEventListener('focus',()=>{lastField=field(f);});});
  $('#new-method').onclick=()=>{if($('#new-method').getAttribute('aria-disabled')!=='true')leave(()=>openMethod(),'switch');};
  $('#method-rows').onclick=e=>{const b=e.target.closest('button');if(!b||busy())return;if(b.dataset.edit)leave(()=>openMethod(b.dataset.edit),'switch');else if(b.dataset.toggle)leave(()=>changeStatus(b.dataset.toggle),'switch');};
  $('#method-form').onsubmit=e=>{e.preventDefault();submitMethod();};
  $('#cancel-method').onclick=()=>leave(()=>set('default'));
  $('#method-name').oninput=()=>{methodError('');if(mResult==='duplicate'){mResult='';renderAll();}};
  $('#finish-command').onclick=()=>{if(inFlight)finish($('#fixture-response').value==='pending'?'saved':$('#fixture-response').value);};
  $('#simulate-idle').onclick=()=>expire('idle');$('#simulate-ended').onclick=()=>expire('ended');
  $('#other-saves').onclick=()=>{if(server)otherSave();};
  $('#fail-methods-read').onclick=()=>{failNextRead=true;};
  document.addEventListener('click',e=>{
    const a=e.target.closest('.bo a');if(!a||a.closest('.office-fixture'))return;
    e.preventDefault();const own=a.dataset.nav==='settings';leave(()=>{if(own)set('default');else location.href=a.href;},a===O.logout?'logout':'rail');
  });
  // A second fixture history entry permits real Back/Forward without leaving file review.
  history.replaceState({settingsFixture:true},'',location.href);history.pushState({settingsFixture:true},'',location.href);
  window.addEventListener('popstate',()=>{if(openForm()){history.pushState({settingsFixture:true},'',location.href);leave(()=>set('default'),'back');}});
  document.addEventListener('keydown',e=>{
    if(e.altKey&&['i','e'].includes(e.key.toLowerCase())){e.preventDefault();expire(e.key.toLowerCase()==='i'?'idle':'ended');return;}
    if(e.key==='Escape'&&session==='active'&&!$('#departure').open&&!$('#rate-confirm').open&&openForm()){e.preventDefault();leave(()=>set('default'),'escape');}
  });
  // Local fixture observations for the design check, never production API or persistence.
  window.SettingsFixture={get commands(){return commands;},get rereads(){return rereads;},get pending(){return busy();},get version(){return server?.version??null;},get shown(){return current?.version??null;},percentText,parseRate};

  /* ---------- Direct states ---------- */
  const s=initial, typeInto=(k,v)=>{field(byKey(k)).value=v;};
  instant=true;
  if(['first-run','first-run-closed'].includes(s))server=null;
  if(s==='loading'){sRead='loading';mRead='loading';}
  if(s==='load-error')sRead='failed';
  if(['longest','edit-longest'].includes(s))server.values={...LONGEST};
  if(s==='methods-empty')methods=[];
  if(s==='methods-load-error')mRead='failed';
  if(s==='methods-overflow')methods=Array.from({length:40},(_,i)=>({id:'many-'+i,name:i===0?LONGEST_METHOD:'Voucher '+String(i+1).padStart(2,'0'),active:i<34}));
  if(s==='method-duplicate-reactivate')methods.find(m=>m.id==='m4').name='Bank transfer';
  if(s==='saved')commit({...V4,tax:110000},ME,NOW);
  reread();
  if(s==='method-saved'||s==='method-partial')methods.find(m=>m.id==='m2').name='Lunch voucher';
  if(s==='method-deactivated')methods.find(m=>m.id==='m2').active=false;
  if(s==='method-reactivated')methods.find(m=>m.id==='m4').active=true;
  if(s==='method-partial'){mRead='failed';partial=true;}
  renderAll();
  const settingsForm=['first-run','edit','edit-service','edit-longest','confirm-rates','saving','stale','stale-reauth','failure','unknown','unknown-changed','unknown-read-failed','unsaved','unsaved-escape','unsaved-back','unsaved-rail','unsaved-logout','unsaved-switch','leave-pending','leave-unknown','reauth','bo01-draft','reauth-confirm','bo01-confirm'].includes(s)||s.startsWith('invalid-');
  if(settingsForm){
    openSettings(s==='edit-service'?'service':'tax',s==='first-run'?null:s==='edit-service'?'service':'tax',s!=='first-run');
    if(!['first-run','edit','edit-service','edit-longest'].includes(s)&&!s.startsWith('invalid-'))typeInto('tax','11');
    const invalid={'invalid-rate-empty':[['tax','']],'invalid-rate-format':[['service','lima']],'invalid-rate-negative':[['tax','-5']],'invalid-rate-over':[['tax','110']],'invalid-rate-decimals':[['service','5,12345']],'invalid-required':[['outlet',''],['address',''],['phone',''],['footer','']],'invalid-long':[['outlet',LONGEST.outlet+'X'],['address',LONGEST.address+'X'],['phone',LONGEST.phone+'0'],['npwpd',LONGEST.npwpd+'X'],['footer',LONGEST.footer+'X']],'invalid-address-lines':[['address',V4.address+'\nIndonesia']],'invalid-control':[['outlet','Warung\u0007 Sederhana'],['footer','Terima kasih\u001b']],'invalid-phone':[['phone','WA 0812 3456 7890']]}[s];
    if(invalid){invalid.forEach(([k,v])=>typeInto(k,v));submitSettings('saved');}
    if(s==='confirm-rates'||s.endsWith('-confirm'))submitSettings('saved');
    if(s==='saving'||s==='leave-pending')send({kind:'settings',op:'save',values:{...V4,tax:110000},base:4,form},'pending');
    if(s==='failure'){setNotice('failure','Something went wrong',FORM.failure);field(FIELDS[0]).focus();}
    const answer={'stale':'stale','stale-reauth':'stale','unknown':'unknown','leave-unknown':'unknown','unknown-changed':'unknown-changed','unknown-read-failed':'unknown-read-failed'}[s];
    if(answer){const cmd={kind:'settings',op:'save',values:{...V4,tax:110000},base:4,form};commands++;if(s==='stale-reauth'){otherSave(ME);finishSettings('saved',cmd);}else finishSettings(answer,cmd);}
    if(s.startsWith('unsaved')||s.startsWith('leave-'))leave(()=>{if(s==='unsaved-logout')location.href=O.logout.href;else if(s==='unsaved-switch')openMethod('m2');else set('default');},s==='unsaved'||s.startsWith('leave-')?'cancel':s.replace('unsaved-',''));
    if(s.startsWith('reauth'))expire('idle');if(s.startsWith('bo01'))expire('ended');
  }
  const methodForm={'method-create':null,'method-invalid-empty':null,'method-invalid-long':null,'method-invalid-control':null,'method-duplicate-create':null,'method-rename':'m2','method-saving':'m2','method-failure':'m2','method-unknown':'m2','method-unsaved':'m2','method-unsaved-switch':'m2','method-duplicate-rename':'m3','method-rename-inactive':'m4'};
  if(s in methodForm){
    openMethod(methodForm[s]);const name={'method-invalid-empty':'','method-invalid-long':LONGEST_METHOD+'J','method-invalid-control':'Meal\u0007 voucher','method-duplicate-create':'Meal voucher','method-duplicate-rename':'meal voucher','method-saving':'Lunch voucher','method-failure':'Lunch voucher','method-unknown':'Lunch voucher','method-unsaved':'Lunch voucher','method-unsaved-switch':'Lunch voucher'}[s];
    if(name!==undefined)$('#method-name').value=name;
    if(s.startsWith('method-invalid')||s.startsWith('method-duplicate-'))submitMethod('saved');
    if(s==='method-saving')submitMethod('pending');
    if(s==='method-failure'){mResult='failure';methodNotice('failure','Something went wrong',FORM.failure);$('#method-name').focus();}
    if(s==='method-unknown'){commands++;finishMethod('unknown',{kind:'method',op:'save',id:'m2',name:'Lunch voucher',editor:mEditor,createdId:'method-x'});}
    if(s==='method-unsaved')leave(()=>set('default'),'cancel');
    if(s==='method-unsaved-switch')leave(()=>openSettings('tax'),'switch');
  }
  if(s==='method-duplicate-reactivate')changeStatus('m4','duplicate');
  if(s==='method-pending-deactivate')changeStatus('m2','pending');
  if(s==='method-unknown-deactivate'){commands++;finishMethod('unknown',{kind:'method',op:'deactivate',id:'m2',name:'Meal voucher',editor:null});}
  if(s==='saved')status('settings','Settings saved as version 5. Orders opened from now on use them.');
  if(s==='unchanged')status('settings','Nothing changed. Version 4 is still in force.');
  if(s==='method-saved')status('methods','Lunch voucher saved.');
  if(s==='method-partial'){status('methods','Lunch voucher saved.');$('[data-edit=m2]').focus();}
  if(s==='method-deactivated')status('methods','Meal voucher deactivated. It is kept for history.');
  if(s==='method-reactivated')status('methods','Gift card reactivated.');
  instant=false;renderOpeners();set(s);
})();
