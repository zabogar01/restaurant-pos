/* DESIGN-022 local drawings only. No API, persistence or credential submission.
   The records and response chooser demonstrate answers; they are never seed data. */
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], O=window.Office;
  const params=new URLSearchParams(location.search), state=params.get('state')||'default';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const set=s=>O.setState(s), focus=s=>$(s)?.focus();
  const money=s=>s.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const percent=s=>{const n=BigInt(s),f=(n%10000n).toString().padStart(4,'0').replace(/0+$/,'');return (n/10000n).toString()+(f?','+f:'');};
  const kindLabel=k=>k==='PERCENTAGE'?'Percentage':'Fixed amount';
  const valueLabel=r=>r.value.kind==='PERCENTAGE'?percent(r.value.ratePpm)+'%':money(r.value.amount);
  let records=[['staff','Staff meal','PERCENTAGE','100000',true],['regular','Regular customer','PERCENTAGE','50000',true],['recovery','Service recovery','FIXED','25000',true],['comp','Comp','PERCENTAGE','1000000',true],['opening','Opening week','PERCENTAGE','150000',false],['old-recovery','Service recovery','FIXED','5000',false]].map(([presetId,name,kind,n,isActive])=>({presetId,name,value:kind==='PERCENTAGE'?{kind,ratePpm:n}:{kind,amount:n},isActive}));
  // facts is the version most recently read or answered (shown); listVersion is the version the list's rows stand at (D:1818-1823).
  let server=clone(records), version=12, facts=12, listVersion=12, read='ready', partial=false, failRead=false;
  let editor=null, pending=null, held=null, decision=null, confirmation=null, gate='active', heldDecision=false, heldConfirm=false, queuedIncident=false, lastField=null, selection=null, otherMode=false, seq=0;
  const commands=[], errors=new Map();let reads=0;
  const find=id=>records.find(r=>r.presetId===id), serverRow=id=>server.find(r=>r.presetId===id);
  const response=()=>$('#fixture-response').value;
  window.PresetFixture={commands,get reads(){return reads;},get rows(){return records;},get draft(){return editor&&clone(editor.draft);},get base(){return editor?.base;},get version(){return version;},get listVersion(){return listVersion;},get pending(){return !!pending;},get stale(){return !!editor?.stale;},get unknown(){return !!editor?.unknown;},parsePercent,parseMoney,other(change){if(change)change(server);version++;},failRead(){failRead=true;},finish:r=>finish(r)};
  function parsePercent(raw){
    const s=raw.trim().replace(/%$/,'').trim();if(!s)return {error:'Enter a percentage.'};
    if(s.startsWith('-'))return {error:'Use 0 or more.'};
    if(!/^(?:[0-9]+(?:[.,][0-9]*)?|[.,][0-9]+)$/.test(s))return {error:'Enter a number, such as 10 or 10,5.'};
    const [whole='',frac='']=s.replace(',','.').split('.');if(frac.length>4)return {error:'Use at most four decimal places.'};
    const n=BigInt(whole||'0')*10000n+BigInt(frac.padEnd(4,'0'));if(n>1000000n)return {error:'Use 100 or less.'};return {value:n.toString()};
  }
  function parseMoney(raw){
    const s=raw.trim();if(!s)return {error:'Enter a fixed amount.'};if(s.startsWith('-'))return {error:'Use 0 or more.'};
    if(!/^(?:[0-9]+|[0-9]{1,3}(?:\.[0-9]{3})+)$/.test(s))return {error:'Enter whole rupiah, such as 10.000.'};
    const n=BigInt(s.replaceAll('.',''));if(n>99999999n)return {error:'Use 99.999.999 or less.'};return {value:n.toString()};
  }
  function draftFor(row){return row?{name:row.name,kind:row.value.kind,percent:row.value.kind==='PERCENTAGE'?percent(row.value.ratePpm):'',amount:row.value.kind==='FIXED'?money(row.value.amount):''}:{name:'',kind:'PERCENTAGE',percent:'',amount:''};}
  function values(d){const p=d.kind==='PERCENTAGE'?parsePercent(d.percent):parseMoney(d.amount);return {name:d.name.trim(),value:d.kind==='PERCENTAGE'?{kind:d.kind,ratePpm:p.value??d.percent}:{kind:d.kind,amount:p.value??d.amount}};}
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const dirty=()=>!!editor&&(!!pending||editor.unknown||!same(values(editor.draft),values(editor.opening)));
  function notice(title='',body='',kind='status'){const el=$('#form-notice');el.hidden=!title;el.dataset.kind=kind;el.setAttribute('role',kind==='failure'||kind==='stale'?'alert':'status');$('#notice-title').textContent=title;$('#notice-body').textContent=body;}
  function status(text=''){const el=$('#page-status');el.hidden=!text;el.textContent=text;}
  function fieldError(key,text){const field=$('#preset-'+key),err=$('#preset-'+key+'-error');if(text)errors.set(key,text);else errors.delete(key);err.textContent=text||'';err.hidden=!text;field.setAttribute('aria-describedby','preset-'+key+'-help'+(text?' '+err.id:''));if(text)field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');}
  function clearErrors(){for(const k of ['name','percent','amount'])fieldError(k,'');}
  function validate(){
    clearErrors();const d=editor.draft;d.name=d.name.trim();$('#preset-name').value=d.name;
    fieldError('name',!d.name?'Enter a preset name.':[...d.name].length>32?'Use 32 characters or fewer.':/\p{Cc}/u.test(d.name)?'Remove control characters from the name.':'');
    const k=d.kind==='PERCENTAGE'?'percent':'amount',n=k==='percent'?parsePercent(d[k]):parseMoney(d[k]);fieldError(k,n.error);
    if(errors.size){focus('#preset-'+errors.keys().next().value);return false;}return true;
  }
  function renderList(){
    const active=document.activeElement, restore=$('#preset-rows').contains(active)?(active.dataset.edit?'[data-edit="'+active.dataset.edit+'"]':active.dataset.toggle?'[data-toggle="'+active.dataset.toggle+'"]':null):null;
    const known=read==='ready'||partial;$('#list-facts').textContent=read==='ready'?records.filter(r=>r.isActive).length+' active · '+records.filter(r=>!r.isActive).length+' inactive · Catalog version '+facts:'';
    $('#presets-list').hidden=!known||!records.length;$('#empty-state').hidden=!known||!!records.length;
    $('#read-state').hidden=read==='ready';
    $('#read-state').innerHTML=read==='loading'?'<p role="status">Loading discount presets…</p>':read==='failed'?'<div class="office-notice" role="alert"><strong>'+(partial?'The preset list may be out of date':'Discount presets could not be loaded')+'</strong><p>'+(partial?'The rows below are the ones this page knows, including your latest change. Try again to read the full list.':'Try again to read the discount presets.')+'</p><button class="office-button" id="retry-read" type="button">Try again</button></div>':'';
    const ordered=[...records.filter(r=>r.isActive),...records.filter(r=>!r.isActive)];
    $('#preset-rows').innerHTML=ordered.map(r=>'<tr data-id="'+r.presetId+'" data-active="'+r.isActive+'" data-selected="'+(editor?.id===r.presetId)+'"><td>'+esc(r.name)+(editor?.holder===r.presetId?'<span class="table-holder">Name in use</span>':'')+'</td><td class="num"><span class="preset-value">'+valueLabel(r)+'</span><span class="preset-kind">'+kindLabel(r.value.kind)+'</span></td><td>'+(r.isActive?'Active':'Inactive')+'</td><td><button type="button" class="office-button small" data-edit="'+r.presetId+'" aria-label="Edit '+esc(r.name)+' — '+(r.isActive?'active':'inactive')+'">Edit</button><button type="button" class="office-button small'+(r.isActive?' danger':'')+'" data-toggle="'+r.presetId+'" aria-label="'+(r.isActive?'Deactivate ':'Reactivate ')+esc(r.name)+'">'+(r.isActive?'Deactivate':'Reactivate')+'</button></td></tr>').join('');
    $$('[data-edit],[data-toggle],#new-preset').forEach(b=>{const off=!!pending||(!known&&b.id==='new-preset');b.setAttribute('aria-disabled',String(off));b.tabIndex=off?-1:0;});
    if(restore)$(restore)?.focus({preventScroll:true});
    if(pending?.discarded)status('Waiting for an earlier save to finish. Nothing will be sent again.');
  }
  function renderForm(){
    $('#preset-editor').hidden=!editor;$('#presets-workspace').classList.toggle('editing',!!editor);if(!editor)return;
    const d=editor.draft;$('#editor-title').textContent=editor.id?'Edit '+editor.opening.name:'New preset';
    $('#form-context').textContent=(editor.id?(editor.active?'':'Inactive preset. Saving does not reactivate it. '):'Choose the name staff will see at the POS. ')+'Changes apply only to discounts chosen afterwards. Orders already carrying this preset keep their saved name and value.';
    $('#form-version').textContent=read==='failed'?'':'Catalog version '+facts;
    $('#percent-field').hidden=d.kind!=='PERCENTAGE';$('#amount-field').hidden=d.kind!=='FIXED';
    $('#kind-percent').checked=d.kind==='PERCENTAGE';$('#kind-fixed').checked=d.kind==='FIXED';
    for(const k of ['name','percent','amount'])$('#preset-'+k).value=d[k];
    $$('#preset-form input').forEach(e=>e.disabled=!!pending);
    const choice=editor.stale&&read==='ready'&&editor.current;
    $('#stale-choices').hidden=!choice;for(const k of ['name','kind','value'])$('#current-'+k).hidden=true;
    if(choice){const c=editor.current,v=values(d);$('#current-same').hidden=!same(v,{name:c.name,value:c.value});$('#current-status').textContent='Current status: '+(c.isActive?'Active':'Inactive')+'.';
      for(const [key,diff,text] of [['name',v.name!==c.name,c.name],['kind',d.kind!==c.value.kind,kindLabel(c.value.kind)],['value',!same(v.value,c.value),valueLabel(c)+(c.value.kind==='FIXED'?' · IDR':'')]]){const e=$('#current-'+key);e.hidden=!diff;e.textContent='Current '+key+': '+text+' · Differs from your draft';}
    }
    if(gate==='active')$('#preset-editor').scrollIntoView({block:'nearest'});
    $('#save-preset').disabled=!!pending||!!editor.stale;
    $('#save-hint').textContent=pending?'Wait for the save result.':editor.stale?(read==='failed'?'Read the current preset before choosing which values to keep.':'Choose Keep my changes or Use current preset before saving.'):'Nothing is sent until you save.';
  }
  function render(){renderList();renderForm();}
  function openEditor(id=null,opener=null){
    const r=id?find(id):null;if(id&&!r)return;
    const d=draftFor(r);editor={id,active:r?.isActive??true,draft:d,opening:clone(d),base:listVersion,opener:opener||(id?'[data-edit="'+id+'"]':'#new-preset'),unknown:false,stale:false,current:null,holder:null};
    clearErrors();notice();status();render();lastField=$('#preset-name');focus('#preset-name');set(id?(r.isActive?(r.value.kind==='FIXED'?'edit-fixed':'edit-percent'):'edit-inactive'):'create-percent');
  }
  function closeEditor(restore=true){const opener=editor?.opener;editor=null;clearErrors();notice();render();if(restore&&opener)focus(opener);}
  function reread(){reads++;if(failRead){failRead=false;read='failed';partial=false;return false;}records=clone(server);facts=version;listVersion=version;read='ready';partial=false;return true;}
  function staleNotice(){
    const current=editor.id&&find(editor.id);editor.current=current?clone(current):null;
    const body=read==='failed'?'The current preset could not be read. Your draft is kept. Try again reads the list; nothing is sent again.':editor.unknown?'The catalog has been read again at version '+facts+'. It may include this save. Your draft is kept; nothing was sent again. Choose which values to keep.':'Nothing was saved. The catalog has been read again at version '+facts+'. Your draft is kept. Choose which values to keep.';
    notice(editor.unknown?'Outcome not confirmed':'The catalog changed while you were editing',body,'stale');render();focus('#form-notice');
  }
  function submit(){if(!editor||pending||editor.stale||!validate())return;send({op:editor.id?'edit':'create',id:editor.id,name:editor.draft.name,values:values(editor.draft),expected:editor.id?editor.base:null},response());}
  function send(cmd,result){
    status();if(editor)editor.holder=null;cmd.discarded=false;cmd.createdId='created-'+(++seq);pending=cmd;commands.push(clone(cmd));
    if(cmd.op==='edit'||cmd.op==='create'){editor.unknown=false;notice('Saving…','Wait for the result. Your draft is kept.');render();focus('#form-notice');set('saving');}
    else{status((cmd.op==='deactivate'?'Deactivating ':'Reactivating ')+cmd.name+'…');render();focus('#page-status');set('pending-'+cmd.op);}
    if(result!=='pending')finish(result);
  }
  function apply(cmd){
    let r=serverRow(cmd.id);let unchanged=false;
    if(cmd.op==='create'){r={presetId:cmd.createdId,...clone(cmd.values),isActive:true};server.push(r);}
    else if(!r)return null;
    else if(cmd.op==='edit'){unchanged=same({name:r.name,value:r.value},cmd.values);Object.assign(r,clone(cmd.values));}
    else {const active=cmd.op==='reactivate';unchanged=r.isActive===active;r.isActive=active;}
    if(!unchanged)version++;
    return {row:clone(r),version,unchanged};
  }
  function applyAnswer(answer){const at=records.findIndex(r=>r.presetId===answer.row.presetId);if(at<0)records.push(clone(answer.row));else records[at]=clone(answer.row);facts=answer.version;if(read==='ready'&&answer.version===listVersion+(answer.unchanged?0:1))listVersion=answer.version;if(read==='failed')partial=true;}
  function finish(result,cmd=pending){
    if(!cmd)return;
    if(gate!=='active'||decision){held={result,cmd,sessionRefused:gate!=='active'&&(result==='idle'||result==='ended')};return;}
    pending=null;
    const form=cmd.op==='edit'||cmd.op==='create',silent=cmd.discarded;
    if(result==='session-refused'){
      if(form&&!silent){notice();render();focus('#preset-name');}
      else if(!silent){render();status(cmd.name+' was not changed. Use its row action to try again.');focus('#page-status');}
      return;
    }
    if(result==='idle'||result==='ended'){
      if(form&&!silent){notice();render();}else if(!silent)status(cmd.name+' was not changed. Use its row action to try again.');
      render();expire(result);return;
    }
    if(result==='stale'||result==='stale-menu'){
      if(cmd.op==='edit'){if(result==='stale'){const r=serverRow(cmd.id);r.name='Staff dining';r.value={kind:'PERCENTAGE',ratePpm:'125000'};}version++;result='saved';}
      else result='saved';
    }
    if(result==='saved'){
      if(cmd.op==='edit'&&cmd.expected!==version)result='stale';
      else if(cmd.op!=='create'&&!serverRow(cmd.id))result='not-found';
      else{const candidate=cmd.values?.name||cmd.name,active=cmd.op==='create'||cmd.op==='reactivate'||serverRow(cmd.id)?.isActive;
        if(cmd.op!=='deactivate'&&active&&server.some(r=>r.presetId!==cmd.id&&r.isActive&&r.name.toLowerCase()===candidate.toLowerCase()))result='duplicate';}
    }
    if(result==='saved'){
      const answer=apply(cmd);if(!answer){finish('not-found',cmd);return;}applyAnswer(answer);render();if(silent){status();return;}
      if(form)closeEditor(false);const r=answer.row;
      status(answer.unchanged?r.name+': nothing changed. Catalog version '+answer.version+' is still current.':r.name+(form?' saved.':cmd.op==='deactivate'?' deactivated. It is hidden from the POS picker; existing orders keep it.':' reactivated. Staff can choose it at the POS.'));
      focus('[data-edit="'+r.presetId+'"]');set(read==='failed'?'partial':answer.unchanged?'unchanged':form?'saved':cmd.op==='deactivate'?'deactivated':'reactivated');return;
    }
    if(result.startsWith('unknown')){
      if(result==='unknown-changed')apply(cmd);if(result==='unknown-read-failed')failRead=true;reread();render();if(silent){status();return;}
      if(!form){status(cmd.name+': the outcome could not be confirmed. '+(read==='failed'?'The list could not be refreshed.':'The list has been refreshed.')+' Nothing was sent again.');focus('#page-status');set('unknown-'+cmd.op);return;}
      editor.unknown=true;if(read==='ready'&&cmd.op==='edit'&&facts!==editor.base){editor.stale=true;staleNotice();set('unknown-changed');}
      else{notice('Outcome not confirmed','The outcome could not be confirmed. '+(read==='failed'?'The list could not be refreshed.':'The list has been refreshed.')+' Your draft is kept; nothing was sent again.');render();focus('#preset-name');set(result);}return;
    }
    if(result==='stale'){
      reread();if(silent){render();status();return;}
      editor.stale=true;editor.unknown=false;staleNotice();set(read==='failed'?'stale-read-failed':'stale');return;
    }
    if(result==='duplicate'){
      reread();if(silent){render();status();return;}
      if(!form)openEditor(cmd.id);
      editor.holder=server.find(r=>r.isActive&&r.presetId!==cmd.id&&r.name.toLowerCase()===(cmd.values?.name||cmd.name).toLowerCase())?.presetId;
      notice();fieldError('name','An active preset already uses this name. '+(form?'Choose another name.':'Rename this inactive preset, save, then reactivate it.'));
      render();focus('#preset-name');set('duplicate-'+(cmd.op==='create'?'create':cmd.op==='edit'?'edit':'reactivate'));return;
    }
    if(result==='not-found')reread();render();if(silent){status();return;}
    if(form){notice('Something went wrong','Nothing was saved. Your draft is kept. Press Save to try again.','failure');focus('#preset-name');set(result==='not-found'?'not-found':'failure');}
    else{status('Something went wrong. '+cmd.name+' was not changed. Use its row action to try again.');focus('#page-status');set('status-failure');}
  }
  function flush(){if(held&&gate==='active'&&!decision){const a=held;held=null;finish(a.sessionRefused?'session-refused':a.result,a.cmd);}}
  function chooseCurrent(keep){if(!editor?.current)return;const c=clone(editor.current);editor.base=facts;editor.opening=draftFor(c);editor.active=c.isActive;if(!keep)editor.draft=draftFor(c);editor.stale=false;clearErrors();notice(editor.unknown?'Outcome not confirmed':'',editor.unknown?'Your draft now builds on catalog version '+facts+'. The earlier save is still unconfirmed. Nothing was sent again.':'');render();focus(keep?'#save-preset':'#preset-name');}
  function emergency(id){const el=$(id);el.hidden=!O.kitchen;if(O.kitchen){el.querySelector('strong').textContent=O.kitchenIncident.title;el.querySelector('p').textContent=O.kitchenIncident.identity;}}
  function toggle(id){const r=find(id);if(!r)return;status();if(r.isActive){confirmation={id,opener:'[data-toggle="'+id+'"]'};$('#deactivate-title').textContent='Deactivate “'+r.name+'”?';$('#keep-active').setAttribute('aria-label','Keep active — '+r.name);$('#confirm-deactivate').setAttribute('aria-label','Deactivate '+r.name);emergency('#deactivate-emergency');O.open($('#deactivate-confirm'),$('#keep-active'));set('deactivate');}else send({op:'reactivate',id,name:r.name,expected:null},response());}
  function keepActive(){const target=confirmation?.opener;confirmation=null;O.close($('#deactivate-confirm'),$(target));set('default');afterModal();}
  $('#keep-active').onclick=keepActive;$('#deactivate-confirm').addEventListener('cancel',e=>{e.preventDefault();keepActive();});
  $('#confirm-deactivate').onclick=()=>{const r=find(confirmation.id);confirmation=null;$('#deactivate-confirm').close();send({op:'deactivate',id:r.presetId,name:r.name,expected:null},response());afterModal();};
  function afterModal(){if(queuedIncident&&gate==='active'&&!decision&&!confirmation){queuedIncident=false;leave(()=>location.href=O.emergency.querySelector('a').href,'rail');}}
  function depart(action){if(pending&&editor)pending.discarded=true;closeEditor();flush();action();}
  function leave(action,reason='cancel'){
    if(!dirty()){depart(action);return;}
    decision={action,prior:document.documentElement.dataset.state};const uncertain=!!pending||editor.unknown;
    $('#departure-title').textContent=reason==='logout'?'Log out and discard your changes?':'Discard unsaved changes?';$('#stay').textContent=reason==='logout'?'Keep this draft':'Stay';$('#discard').textContent=reason==='logout'?'Discard changes and log out':'Discard';
    $('#departure-copy').textContent=reason==='logout'?'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.':uncertain?'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.':'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
    $('#departure-uncertain').hidden=!(reason==='logout'&&uncertain);emergency('#departure-emergency');O.open($('#departure'),$('#stay'));set(uncertain?(pending?'leave-pending':'leave-unknown'):'unsaved'+(reason==='cancel'?'':'-'+reason));
  }
  function workFocus(){if(pending)return pending.op==='edit'||pending.op==='create'?$('#form-notice'):$('#page-status');return editor?$('#preset-name'):$('#new-preset');}
  function stay(){const prior=decision?.prior;decision=null;O.close($('#departure'),workFocus());if(prior)set(prior);if(gate==='idle')O.open($('#presets-reauth'),$('#resume-password'));else{flush();afterModal();}}
  $('#stay').onclick=stay;$('#departure').addEventListener('cancel',e=>{e.preventDefault();stay();});
  $('#discard').onclick=()=>{const action=decision.action;decision=null;$('#departure').close();depart(action);};
  /* Session drawings retain the actual mounted form. A different manager drops it. */
  function expire(mode){
    gate=mode;heldDecision=!!decision;heldConfirm=!!confirmation;lastField=document.activeElement;
    selection=lastField instanceof HTMLInputElement?{start:lastField.selectionStart,end:lastField.selectionEnd}:null;
    $('#presets-frame').inert=true;
    if(mode==='ended'){$('#departure').close();$('#deactivate-confirm').close();$('#presets-reauth').close();$('#presets-frame').hidden=true;$('#presets-login').hidden=false;$('#username').value='';$('#password').value='';focus('#username');set(heldConfirm?'bo01-confirm':heldDecision?'bo01-decision':'bo01-draft');}
    else{resetResume();emergency('#reauth-emergency');O.open($('#presets-reauth'),$('#resume-password'));set(heldConfirm?'reauth-confirm':heldDecision?'reauth-decision':'reauth');}
  }
  function resetResume(){otherMode=false;$('#reauth-title').textContent='Your session timed out';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=true;$('#resume-username').value='m.iqbal';$('#resume-password').value='';$('#resume-error').hidden=true;$('#different-manager').hidden=false;$('#back-manager').hidden=true;$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#resume').hidden=false;$('#resume').textContent='Continue';$('#reauth-description').textContent='Your unsaved changes are kept. Continue as m.iqbal to resume them.';}
  function resume(sameManager){
    gate='active';$('#presets-reauth').close();$('#presets-login').hidden=true;$('#presets-frame').hidden=false;$('#presets-frame').inert=false;$('#password').value='';$('#resume-password').value='';
    if(sameManager){render();
      if(heldConfirm&&confirmation)O.open($('#deactivate-confirm'),$('#keep-active'));
      else if(heldDecision&&decision)O.open($('#departure'),$('#stay'));
      else if(held)flush();
      else if(pending)workFocus().focus();
      else if(editor){focus('#preset-name');if(lastField===$('#preset-name')&&selection)lastField.setSelectionRange(selection.start,selection.end);set(editor.draft.kind==='FIXED'?'edit-fixed':'edit-percent');}
      else focus('#new-preset');
      if(queuedIncident&&!decision&&!confirmation){queuedIncident=false;leave(()=>location.href=O.emergency.querySelector('a').href,'rail');}
    }else{
      decision=null;confirmation=null;pending=null;held=null;$('#departure').close();$('#deactivate-confirm').close();closeEditor(false);for(const k of ['name','percent','amount'])$('#preset-'+k).value='';status();$('.office-actor').textContent='Ratna Ayu · Manager';render();focus('#new-preset');set('default');
    }heldDecision=false;heldConfirm=false;
  }
  $('#presets-reauth').addEventListener('cancel',e=>e.preventDefault());
  $('#presets-reauth').addEventListener('keydown',e=>{if(e.key==='Tab')e.stopPropagation();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}});
  $('#presets-reauth').addEventListener('close',()=>{if(gate==='idle'&&!$('#presets-reauth').open&&!$('#departure').open)O.open($('#presets-reauth'),$('#resume-password'));});
  $('#different-manager').onclick=()=>{$('#resume-fields').hidden=true;$('#different-manager').hidden=true;$('#resume').hidden=true;$('#stay-manager').hidden=false;$('#choose-manager').hidden=false;$('#reauth-title').textContent='Sign in as a different manager?';$('#reauth-description').textContent='The current manager’s unsaved changes will not be available to the manager signing in.';$('#idle-logout').hidden=true;focus('#stay-manager');};
  $('#stay-manager').onclick=()=>{resetResume();focus('#resume-password');};
  $('#choose-manager').onclick=()=>{otherMode=true;$('#reauth-title').textContent='Sign in as a different manager';$('#reauth-description').textContent='Enter your own username and password. The current manager’s unsaved changes will not be available to you.';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=false;$('#resume-username').value='';$('#resume-password').value='';$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#back-manager').hidden=false;$('#resume').hidden=false;$('#resume').textContent='Sign in';focus('#resume-username');};
  $('#back-manager').onclick=()=>{resetResume();focus('#resume-password');};
  $('#resume-form').onsubmit=e=>{e.preventDefault();if(otherMode&&!$('#resume-username').value.trim()){focus('#resume-username');return;}if(!$('#resume-password').value){$('#resume-error').hidden=false;focus('#resume-password');return;}resume(!otherMode||$('#resume-username').value.trim().toLowerCase()==='m.iqbal');};
  $('#held-sign-in').onsubmit=e=>{e.preventDefault();let first;for(const id of ['username','password']){const missing=!$('#'+id).value;$('#'+id+'-error').hidden=!missing;$('#'+id).setAttribute('aria-invalid',String(missing));if(missing){$('#'+id).setAttribute('aria-describedby',id+'-error');first||=$('#'+id);}else $('#'+id).removeAttribute('aria-describedby');}if(first)return first.focus();resume($('#username').value.trim().toLowerCase()==='m.iqbal');};
  $('#idle-logout').onclick=()=>{$('#presets-reauth').close();leave(()=>{gate='ended';location.href=O.logout.href;},'logout');};
  $('#queue-incidents').onclick=()=>{queuedIncident=true;$('#reauth-description').textContent='Continue as m.iqbal to open print incidents. Your unsaved changes are kept.';focus('#resume-password');};
  $('#new-preset').onclick=()=>{if($('#new-preset').getAttribute('aria-disabled')!=='true')leave(()=>openEditor(),'switch');};
  $('#preset-rows').onclick=e=>{const b=e.target.closest('button');if(!b||pending)return;if(b.dataset.edit)leave(()=>openEditor(b.dataset.edit),'switch');else if(b.dataset.toggle)leave(()=>toggle(b.dataset.toggle),'switch');};
  $('#preset-form').onsubmit=e=>{e.preventDefault();submit();};$('#cancel-preset').onclick=()=>leave(()=>set('default'));
  for(const k of ['name','percent','amount'])$('#preset-'+k).oninput=()=>{if(!editor)return;editor.draft[k]=$('#preset-'+k).value;fieldError(k,'');if(k==='name'&&editor.holder){editor.holder=null;renderList();}};
  $$('[name=kind]').forEach(input=>input.onchange=()=>{if(!editor||pending)return;editor.draft.kind=input.value;fieldError('percent','');fieldError('amount','');renderForm();focus(input.value==='FIXED'?'#preset-amount':'#preset-percent');set('kind-switch');});
  $('#keep-draft').onclick=()=>chooseCurrent(true);$('#use-current').onclick=()=>chooseCurrent(false);
  $('#read-state').onclick=e=>{if(!e.target.closest('#retry-read'))return;reread();render();if(editor?.stale)staleNotice();else if(editor?.unknown){if(editor.id&&facts!==editor.base){editor.stale=true;staleNotice();}else{notice('Outcome not confirmed','The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.');focus('#preset-name');}}else focus(editor?'#preset-name':'#new-preset');};
  $('#finish-command').onclick=()=>finish(response()==='pending'?'saved':response());$('#fixture-idle').onclick=()=>expire('idle');$('#fixture-ended').onclick=()=>expire('ended');$('#other-saves').onclick=()=>{version++;};$('#fail-read').onclick=()=>{failRead=true;};
  document.addEventListener('click',e=>{const a=e.target.closest('.bo a');if(!a||e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.closest('.office-fixture'))return;e.preventDefault();leave(()=>location.href=a.href,a.classList.contains('office-logout')?'logout':'rail');});
  document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='i'){e.preventDefault();expire('idle');}if(e.altKey&&e.key.toLowerCase()==='e'){e.preventDefault();expire('ended');}if(e.key==='Escape'&&gate==='active'&&!decision&&!confirmation&&editor){e.preventDefault();leave(()=>set('default'));}});
  // The fixture keeps a same-URL entry to draw Back/Forward departure without beforeunload.
  const entryURL=location.href;history.replaceState({presetEntry:true},'',entryURL);history.pushState({presetWork:true},'',entryURL);
  window.addEventListener('popstate',()=>{if(dirty()){history.pushState({presetWork:true},'',entryURL);leave(()=>{editor=null;history.go(-2);},'back');}});

  /* Review states are reached through the same controls and responses as the walks. */
  if(state==='empty'){records=[];server=[];version=0;facts=0;listVersion=0;}
  if(state==='overflow'){
    records=Array.from({length:48},(_,i)=>({presetId:'long-'+i,name:i===0?'W'.repeat(32):'Preset '+String(i+1).padStart(2,'0'),value:i%3===0?{kind:'FIXED',amount:'99999999'}:{kind:'PERCENTAGE',ratePpm:i%3===1?'1000000':'123456'},isActive:i<36}));server=clone(records);
  }
  if(state==='loading'||state==='load-error')listVersion=null;if(state==='loading')read='loading';if(state==='load-error')read='failed';render();
  const listStates=['default','empty','loading','load-error','overflow'];
  if(!listStates.includes(state)){
    if(['deactivate','deactivated','reactivated','pending-deactivate','pending-reactivate','unknown-deactivate','unknown-reactivate','status-failure','duplicate-reactivate','reauth-confirm','bo01-confirm'].includes(state)){
      if(['reactivated','pending-reactivate','unknown-reactivate','duplicate-reactivate'].includes(state)){
        const id=state==='duplicate-reactivate'?'old-recovery':'opening',r=find(id);send({op:'reactivate',id,name:r.name,expected:null},state==='pending-reactivate'?'pending':state==='unknown-reactivate'?'unknown':'saved');
      }else{
        toggle('staff');if(!['deactivate','reauth-confirm','bo01-confirm'].includes(state)){$('#fixture-response').value=state==='pending-deactivate'?'pending':state==='unknown-deactivate'?'unknown':state==='status-failure'?'failure':'saved';$('#confirm-deactivate').click();}
      }
      if(state==='reauth-confirm')expire('idle');if(state==='bo01-confirm')expire('ended');
    }else{
      const create=['create-percent','create-fixed','duplicate-create'].includes(state);
      openEditor(create?null:state==='edit-inactive'?'opening':state==='edit-fixed'||state.startsWith('invalid-amount')?'recovery':'staff');
      if(state==='create-fixed'){editor.draft.kind='FIXED';renderForm();focus('#preset-name');}
      if(state==='kind-switch'){editor.draft.percent='12,3456';editor.draft.kind='FIXED';editor.draft.amount='25.000';renderForm();focus('#preset-amount');}
      if(state.startsWith('invalid-')){const [,field,why]=state.split('-');const vals={empty:'',long:'W'.repeat(33),control:'Staff\u0007 meal',negative:'-1',format:field==='percent'?'1.000,5':'1000.5',decimals:'10,50000',over:field==='percent'?'100,0001':'100.000.000'};editor.draft[field]=vals[why];renderForm();validate();}
      if(['duplicate-create','duplicate-edit'].includes(state)){editor.draft.name='Regular customer';if(create)editor.draft.percent='10';renderForm();submit();}
      if(['saving','saved','unchanged','failure','not-found','unknown','unknown-changed','unknown-read-failed','partial','leave-pending','leave-unknown','stale','stale-menu','stale-reauth','stale-read-failed'].includes(state)){
        if(!['unchanged','stale-menu'].includes(state))editor.draft.name='Staff lunch';
        if(state==='partial'){read='failed';partial=false;}if(state==='stale-read-failed')failRead=true;
        renderForm();const result=['saving','leave-pending'].includes(state)?'pending':state==='leave-unknown'?'unknown':state.startsWith('stale')?(state==='stale-menu'?'stale-menu':'stale'):['saved','unchanged','partial'].includes(state)?'saved':state;
        $('#fixture-response').value=result;
        if(state==='stale-reauth'){expire('idle');resume(true);}submit();
        if(['leave-pending','leave-unknown'].includes(state))leave(()=>set('default'));
      }
      if(['unsaved','unsaved-switch','unsaved-logout','reauth','bo01-draft','reauth-decision','bo01-decision'].includes(state)){
        editor.draft.name='Staff lunch';renderForm();
        if(state.startsWith('unsaved')||state.endsWith('decision'))leave(state==='unsaved-switch'?()=>openEditor('recovery'):()=>set('default'),state==='unsaved-logout'?'logout':state==='unsaved-switch'?'switch':'cancel');
        if(state.startsWith('reauth'))expire('idle');if(state.startsWith('bo01'))expire('ended');
      }
    }
  }
  $('#fixture-response').value='saved';set(state);
})();
