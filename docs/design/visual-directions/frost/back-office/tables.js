/* DESIGN-017: deterministic review fixtures, never a service or an authentication store. */
(() => {
  const $=s=>document.querySelector(s), O=window.Office;
  const initial=document.documentElement.dataset.state;
  const seed=()=>[{id:'t1',label:'Table 1',active:true},{id:'t2',label:'Table 2',active:true},{id:'t3',label:'Table 3',active:true},{id:'t4',label:'Terrace 1',active:false}];
  const longest='Terrace ABCDEFGHIJKLMNOPQRSTUVWX';
  let rows=seed(), editor=null, result='', read='ready', pending=false, inFlight=null, departure=null, session='active', heldDecision=false, otherMode=false, queueIncidents=false;
  let commands=0, rereads=0, settledResponse=null, statusCommand=null;
  $('.office-day')?.remove();
  const copy={empty:'Enter a table label.',long:'Use 32 characters or fewer.',control:'Remove control characters from the label.',duplicate:'An active table already uses this label. Choose another label.',reactivate:'An active table already uses this label. Rename this inactive table, save, then reactivate it.',unknown:'The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.',unknownRead:'The outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again.',failure:'Nothing was saved. Your draft is kept. Press Save to try again.',waiting:'Waiting for an earlier save to finish. Nothing will be sent again.'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const current=()=>rows.find(r=>r.id===editor?.id);
  const dirty=()=>!!editor && $('#table-label').value!==editor.original;
  const uncertain=()=>pending || result.startsWith('unknown');
  const set=s=>O.setState(s);
  function status(text){$('#table-status').hidden=!text;$('#table-status').textContent=text;}
  function clearStatus(){status('');$('#phase-note').hidden=true;statusCommand=null;}
  function notice(kind,title,body){const n=$('#form-notice');n.hidden=!title;n.dataset.kind=kind;n.setAttribute('role',kind==='failure'?'alert':'status');n.innerHTML=title?'<strong>'+esc(title)+'</strong><p>'+esc(body)+'</p>':'';}
  function fieldError(text){const e=$('#label-error');e.hidden=!text;e.textContent=text;$('#table-label').setAttribute('aria-invalid',text?'true':'false');$('#table-label').setAttribute('aria-describedby',text?'label-error label-help':'label-help');if(text)$('#table-label').focus();}
  function renderList(){
    const active=document.activeElement;const restore=active?.dataset.edit?['edit',active.dataset.edit]:active?.dataset.toggle?['toggle',active.dataset.toggle]:null;
    $('#table-count').textContent=read==='ready'?rows.filter(r=>r.active).length+' active · '+rows.filter(r=>!r.active).length+' inactive':'';
    $('#tables-list').hidden=read!=='ready'||!rows.length;$('#read-state').hidden=read==='ready'&&!!rows.length;
    $('#new-table').setAttribute('aria-disabled',String(read!=='ready'||pending));$('#new-table').tabIndex=read!=='ready'||pending?-1:0;$('#new-table').hidden=read==='ready'&&!rows.length&&!editor&&!pending;
    $('#read-state').innerHTML=read==='loading'?'<div class="office-notice" role="status">Loading tables…</div>':read==='failed'?'<div class="office-notice" role="alert"><strong>Tables could not be loaded</strong><p>Try again to read the table list.</p><button class="office-button" id="retry-list">Try again</button></div>':!rows.length?'<div class="office-empty"><div class="office-empty-title">No tables yet</div><p>Create your first table to set up the floor.</p><button class="office-button" id="first-table">New table</button></div>':'';
    $('#retry-list')?.addEventListener('click',()=>{read='loading';renderList();setTimeout(()=>{read='ready';renderList();if(editor){if(result.startsWith('unknown')){notice('unknown','Outcome not confirmed',copy.unknown);set('unknown');}$('#table-label').focus();}else{if(statusCommand){status(statusUnknownCopy(statusCommand));set('unknown-'+statusCommand.op);}else set('default');$('#new-table').focus();}},350);});
    if($('#first-table')){$('#first-table').hidden=!!editor||pending;$('#first-table').addEventListener('click',()=>{if(!pending)openForm();});}
    const sorted=[...rows].sort((a,b)=>Number(b.active)-Number(a.active)||a.label.localeCompare(b.label,'en',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id));
    $('#table-rows').innerHTML=sorted.map(r=>{
      const holder=result==='duplicate'&&r.active&&r.id!==editor?.id&&r.label.toLowerCase()===$('#table-label').value.toLowerCase();
      return '<tr data-id="'+r.id+'" data-active="'+r.active+'" data-selected="'+(r.id===editor?.id)+'" data-holder="'+holder+'"><td>'+esc(r.label)+(holder?'<span class="table-holder">Label in use</span>':'')+'</td><td class="table-status">'+(r.active?'Active':'Inactive')+'</td><td><button class="office-button small" data-edit="'+r.id+'" aria-label="Edit '+esc(r.label)+' — '+(r.active?'active':'inactive')+'" '+'aria-disabled="'+pending+'"'+(pending?' tabindex="-1"':'')+'>Edit</button><button class="office-button small" data-toggle="'+r.id+'" aria-label="'+(r.active?'Deactivate ':'Reactivate ')+esc(r.label)+'" '+(pending?'disabled':'')+'>'+(r.active?'Deactivate':'Reactivate')+'</button></td></tr>';
    }).join('');
    if(restore&&session==='active'&&!departure)$('#table-rows').querySelector('[data-'+restore[0]+'="'+restore[1]+'"]')?.focus({preventScroll:true});
  }
  function focusOpener(id){($('#table-rows').querySelector('[data-edit="'+id+'"]')||(!$('#new-table').hidden?$('#new-table'):$('#first-table'))).focus({preventScroll:true});}
  function openForm(id=null,focus=true){
    clearStatus();const r=rows.find(r=>r.id===id);editor={id,original:r?.label||'',returnId:id};result='';
    $('#table-editor').hidden=false;$('#tables-workspace').classList.add('editing');$('#table-label').value=editor.original;$('#table-label').readOnly=false;
    $('#editor-title').textContent=r?'Edit '+r.label:'New table';
    $('#editor-context').textContent=r?(r.active?'Active table. Changes keep this table’s history.':'Inactive table. Saving its label does not reactivate it.'):'Choose the label staff will see on the floor.';
    $('#save-table').disabled=false;$('#table-label').disabled=false;fieldError('');notice('','','');renderList();if(focus)$('#table-label').focus();
  }
  function closeForm(focusId=editor?.returnId,moveFocus=true){
    if(inFlight?.editor===editor)inFlight.discarded=true;
    editor=null;result='';$('#table-editor').hidden=true;$('#tables-workspace').classList.remove('editing');renderList();
    if(moveFocus)focusOpener(focusId);
  }
  function snapshot(op='save',id=editor?.id){
    const r=rows.find(r=>r.id===id);
    return {op,id,label:op==='save'?$('#table-label').value:r.label,editor:op==='save'?editor:null,discarded:false,createdId:'created-'+commands};
  }
  function applyRecord(command){
    let r=rows.find(r=>r.id===command.id);
    if(command.op==='save'){
      if(r)r.label=command.label;
      else{r=rows.find(r=>r.id===command.createdId);if(!r){r={id:command.createdId,label:command.label,active:true};rows.push(r);}}
    }else if(r)r.active=command.op==='reactivate';
    return r?.id;
  }
  function applyCommand(command,silent=false){
    const id=applyRecord(command);renderList();if(silent)return;
    const outcome=command.op==='save'?'saved':command.op==='deactivate'?'deactivated':'reactivated';
    if(command.op==='save')closeForm(id);else focusOpener(id);
    status(command.label+' '+(outcome==='saved'?'saved.':outcome==='deactivated'?'deactivated. It is kept for history.':'reactivated.'));set(outcome);
  }
  function duplicate(command=snapshot()){
    pending=false;rereads++;const wasReactivate=command.op==='reactivate';
    if(wasReactivate)openForm(command.id);
    if(!rows.some(r=>r.active&&r.id!==command.id&&r.label.toLowerCase()===command.label.toLowerCase()))rows.push({id:'holder-'+rereads,label:command.label,active:true});
    result='duplicate';$('#save-table').disabled=false;$('#table-label').disabled=false;notice('','','');fieldError(wasReactivate?copy.reactivate:copy.duplicate);renderList();
    set(wasReactivate?'duplicate-reactivate':editor.id?'duplicate-rename':'duplicate-create');
  }
  function statusUnknownCopy(command,failedRead=false){return command.label+': the outcome could not be confirmed. '+(failedRead?'The list could not be refreshed.':'The list has been refreshed.')+' Nothing was sent again.';}
  function unknown(failedRead=false,command=snapshot(),silent=false){
    pending=false;rereads++;read=failedRead?'failed':'ready';
    // Model the applied-but-unconfirmed reread; the command outcome stays unknown.
    if(!failedRead)applyRecord(command);
    if(silent){renderList();return;}
    if(command.op!=='save'){
      statusCommand=command;status(statusUnknownCopy(command,failedRead));renderList();$('#table-status').focus();set('unknown-'+command.op);return;
    }
    result=failedRead?'unknown-read-failed':'unknown';$('#save-table').disabled=false;$('#table-label').disabled=false;
    notice('unknown','Outcome not confirmed',failedRead?copy.unknownRead:copy.unknown);renderList();$('#table-label').focus();set(failedRead?'unknown-read-failed':'unknown');
  }
  function finish(response,command=inFlight){
    if(!command)return;
    // A previous manager's command: never announced or focused in the new manager's area.
    if(command.discarded&&command!==inFlight){if(response==='saved')applyRecord(command);renderList();return;}
    if(response==='idle'||response==='ended'){
      pending=false;inFlight=null;result='';notice('','','');$('#save-table').disabled=false;$('#table-label').disabled=false;
      status(command.op!=='save'?command.label+' was not changed. Use its row action to try again.':'');renderList();
      if(session==='active'||(response==='ended'&&session!=='ended'))expire(response==='idle'?'idle':'ended');return;
    }
    if(departure||session!=='active'){settledResponse={response,command};return;}
    pending=false;inFlight=null;$('#save-table').disabled=false;$('#table-label').disabled=false;
    const silent=command.discarded||(command.op==='save'&&command.editor!==editor);
    if(silent)status('');
    if(response==='saved')return applyCommand(command,silent);
    if(response.startsWith('unknown'))return unknown(response==='unknown-read-failed',command,silent);
    if(silent){if(response==='duplicate'||response==='not-found')rereads++;renderList();return;}
    if(response==='duplicate')return duplicate(command);
    if(response==='failure'||response==='not-found'){
      if(response==='not-found')rereads++;
      if(command.op==='save'){result='failure';notice('failure','Something went wrong',copy.failure);renderList();$('#table-label').focus();}
      else{status('Something went wrong. '+command.label+' was not changed. Use its row action to try again.');renderList();$('#table-status').focus();}
      set('failure');return;
    }
    if(response==='rejected'&&command.op==='deactivate'){
      status(command.label+' was not deactivated. Order ORD-1042 is open at this table. Settle or void that order at the POS, then try again.');$('#phase-note').hidden=false;renderList();focusOpener(command.id);set('rejected-phase2');return;
    }
    applyCommand(command,silent);
  }
  function flushAnswer(){if(settledResponse&&session==='active'&&!departure){const answer=settledResponse;settledResponse=null;finish(answer.response,answer.command);}}
  function send(command,response){
    clearStatus();pending=true;commands++;command.createdId='created-'+commands;inFlight=command;
    if(command.op==='save'){
      result='pending';$('#save-table').disabled=true;$('#table-label').disabled=true;
      notice('pending','Saving…','Wait for the result. Your draft is kept.');renderList();$('#form-notice').focus();set('saving');
    }else{
      status((command.op==='deactivate'?'Deactivating ':'Reactivating ')+command.label+'…');renderList();$('#table-status').focus();set('pending-'+command.op);
    }
    if(response!=='pending')setTimeout(()=>finish(response,command),450);
  }
  function submit(response=$('#table-response').value){
    if(!editor||pending)return;
    $('#table-label').value=$('#table-label').value.trim();const value=$('#table-label').value;
    const error=!value?copy.empty:value.length>32?copy.long:/\p{Cc}/u.test(value)?copy.control:'';
    if(error){fieldError(error);set(!value?'invalid-empty':value.length>32?'invalid-long':'invalid-control');return;}
    fieldError('');
    if(response==='saved'&&(!current()||current().active)&&rows.some(r=>r.active&&r.id!==editor.id&&r.label.toLowerCase()===value.toLowerCase()))response='duplicate';
    send(snapshot(),response);
  }
  function changeStatus(id,response=$('#table-response').value){
    if(pending)return;const r=rows.find(r=>r.id===id),command=snapshot(r.active?'deactivate':'reactivate',id);
    if(response==='saved'&&command.op==='reactivate'&&rows.some(other=>other.active&&other.id!==id&&other.label.toLowerCase()===r.label.toLowerCase()))response='duplicate';
    send(command,response);
  }
  function alertCopy(target){
    const area=$(target);area.hidden=!O.kitchen;if(O.kitchen){area.querySelector('strong').textContent=O.kitchenIncident.title;area.querySelector('p').textContent=O.kitchenIncident.identity;}
  }
  function depart(action){if(editor)closeForm();flushAnswer();action();if(pending&&inFlight?.discarded)status(copy.waiting);}
  function leave(action,reason='cancel'){
    if(!editor||(!dirty()&&!uncertain())){depart(action);return;}
    departure={action,reason,prior:document.documentElement.dataset.state,focus:document.activeElement};
    $('#departure-title').textContent=reason==='logout'?'Log out and discard your changes?':'Discard unsaved changes?';
    $('#stay').textContent=reason==='logout'?'Keep this draft':'Stay';$('#discard').textContent=reason==='logout'?'Discard changes and log out':'Discard';
    $('#departure-copy').textContent=reason==='logout'?'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.':uncertain()?'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.':'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
    $('#departure-uncertain').hidden=!(reason==='logout'&&uncertain());
    alertCopy('#departure-emergency');$('#departure-emergency p:last-of-type').textContent=reason==='logout'?'Decide whether to keep this draft or discard it before opening print incidents.':'Decide whether to stay or discard before opening print incidents.';O.open($('#departure'),$('#stay'));
    set(uncertain()?(pending?'leave-pending':'leave-unknown'):reason==='cancel'?'unsaved':'unsaved-'+reason);
  }
  function stay(){
    const prior=departure?.prior;departure=null;O.close($('#departure'),pending?$('#form-notice'):$('#table-label'));if(prior)set(prior);
    if(session==='idle')O.open($('#table-reauth'),$('#resume-password'));
    else flushAnswer();
  }
  $('#departure').addEventListener('cancel',e=>{e.preventDefault();stay();});
  $('#stay').onclick=stay;
  $('#discard').onclick=()=>{const action=departure?.action;departure=null;$('#departure').close();depart(action||(()=>{}));};
  function expire(mode){
    session=mode;heldDecision=$('#departure').open;
    if(mode==='ended'){
      $('#departure').close();$('#table-reauth').close();$('#table-editor').hidden=true;$('#table-frame').hidden=true;$('#tables-content').removeAttribute('role');$('#table-login').hidden=false;$('#table-login').setAttribute('role','main');$('#username').value='';$('#password').value='';$('#username').focus();set(heldDecision?'bo01-decision':'bo01-draft');
    }else{
      resetResume();alertCopy('#reauth-emergency');O.open($('#table-reauth'),$('#resume-password'));set(heldDecision?'reauth-decision':'reauth');
    }
  }
  function resetResume(){otherMode=false;$('#reauth-title').textContent='Your session timed out';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=true;$('#resume-username').value='m.iqbal';$('#resume-password').value='';$('#resume-error').hidden=true;$('#different-manager').hidden=false;$('#back-manager').hidden=true;$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#resume').hidden=false;$('#resume').textContent='Continue';$('#reauth-description').textContent='Your unsaved changes are kept. Continue as m.iqbal to resume them.';}
  function resume(same){
    session='active';$('#table-reauth').close();$('#password').value='';$('#resume-password').value='';$('#table-login').hidden=true;$('#table-login').removeAttribute('role');$('#table-frame').hidden=false;$('#tables-content').setAttribute('role','main');
    if(same){
      $('#table-editor').hidden=!editor;
      if(heldDecision&&departure){O.open($('#departure'),$('#stay'));set('unsaved');}
      else if(settledResponse)flushAnswer();
      else if(pending){set(inFlight.op==='save'?'saving':'pending-'+inFlight.op);(editor?$('#form-notice'):$('#table-status')).focus();}
      else if(editor){set(result.startsWith('unknown')?'unknown':'rename');$('#table-label').focus();}
      else{set('default');$('#new-table').focus();}
      if(queueIncidents){queueIncidents=false;leave(()=>location.href=O.emergency.querySelector('a').href,'rail');}
    }else{
      departure=null;$('#departure').close();if(editor)closeForm(null,false);
      if(inFlight)inFlight.discarded=true;if(settledResponse)settledResponse.command.discarded=true;pending=false;inFlight=null;$('#table-label').value='';$('.office-actor').textContent='Ratna Ayu · Manager';clearStatus();flushAnswer();renderList();$('#new-table').focus();set('default');
    }
    heldDecision=false;
  }
  $('#table-reauth').addEventListener('cancel',e=>e.preventDefault());
  $('#table-reauth').addEventListener('keydown',e=>{if(e.key==='Tab')e.stopPropagation();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}});
  $('#table-reauth').addEventListener('close',()=>{if(session==='idle'&&!$('#table-reauth').open&&!$('#departure').open)O.open($('#table-reauth'),$('#resume-password'));});
  $('#different-manager').onclick=()=>{
    $('#resume-fields').hidden=true;$('#different-manager').hidden=true;$('#resume').hidden=true;$('#stay-manager').hidden=false;$('#choose-manager').hidden=false;
    $('#reauth-title').textContent='Sign in as a different manager?';$('#reauth-description').textContent='The current manager’s unsaved changes will not be available to the manager signing in.';$('#idle-logout').hidden=true;$('#stay-manager').focus();
  };
  $('#stay-manager').onclick=()=>{resetResume();$('#resume-password').focus();};
  $('#choose-manager').onclick=()=>{otherMode=true;$('#reauth-title').textContent='Sign in as a different manager';$('#reauth-description').textContent='Enter your own username and password. The current manager’s unsaved changes will not be available to you.';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=false;$('#resume-username').value='';$('#resume-password').value='';$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#back-manager').hidden=false;$('#resume').hidden=false;$('#resume').textContent='Sign in';$('#resume-username').focus();};
  $('#back-manager').onclick=()=>{resetResume();$('#resume-password').focus();};
  $('#resume-form').onsubmit=e=>{e.preventDefault();if(otherMode&&!$('#resume-username').value){$('#resume-username').focus();return;}if(!$('#resume-password').value){$('#resume-error').hidden=false;$('#resume-password').focus();return;}resume(!otherMode||$('#resume-username').value.trim().toLowerCase()==='m.iqbal');};
  $('#held-sign-in').onsubmit=e=>{e.preventDefault();let first;for(const id of ['username','password']){const missing=!$('#'+id).value;$('#'+id+'-error').hidden=!missing;$('#'+id).setAttribute('aria-invalid',String(missing));if(missing){$('#'+id).setAttribute('aria-describedby',id+'-error');first||=$('#'+id);}else $('#'+id).removeAttribute('aria-describedby');}if(first)return first.focus();resume($('#username').value.trim().toLowerCase()==='m.iqbal');};
  $('#idle-logout').onclick=()=>{heldDecision=false;$('#table-reauth').close();leave(()=>{session='ended';location.href=O.logout.href;},'logout');};
  $('#queue-incidents').onclick=()=>{queueIncidents=true;$('#reauth-description').textContent='Continue as m.iqbal to open print incidents. Your unsaved changes are kept.';$('#resume-password').focus();};
  $('#new-table').onclick=()=>{if(!pending&&read==='ready')leave(()=>openForm());};
  $('#table-rows').onclick=e=>{const b=e.target.closest('button');if(!b||pending)return;if(b.dataset.edit)leave(()=>openForm(b.dataset.edit));else if(b.dataset.toggle)leave(()=>changeStatus(b.dataset.toggle));};
  $('#table-form').onsubmit=e=>{e.preventDefault();submit();};
  $('#cancel-table').onclick=()=>leave(()=>{set('default');});
  $('#table-label').oninput=()=>{fieldError('');if(result==='duplicate'){result='';renderList();}};
  $('#finish-command').onclick=()=>{if(pending)finish($('#table-response').value==='pending'?'saved':$('#table-response').value);};
  $('#simulate-idle').onclick=()=>expire('idle');$('#simulate-ended').onclick=()=>expire('ended');
  document.addEventListener('click',e=>{
    const a=e.target.closest('.bo a');if(!a||a.closest('.office-fixture'))return;
    e.preventDefault();const own=a.dataset.nav==='tables';leave(()=>{if(own){set('default');}else location.href=a.href;},a===O.logout?'logout':'rail');
  });
  // A second fixture history entry permits real Back/Forward without leaving file review.
  history.replaceState({tableFixture:true},'',location.href);history.pushState({tableFixture:true},'',location.href);
  window.addEventListener('popstate',()=>{if(editor){history.pushState({tableFixture:true},'',location.href);leave(()=>{set('default');},'back');}});
  document.addEventListener('keydown',e=>{
    if(e.altKey&&['i','e'].includes(e.key.toLowerCase())){e.preventDefault();expire(e.key.toLowerCase()==='i'?'idle':'ended');return;}
    if(e.key==='Escape'&&session==='active'&&!$('#departure').open&&editor){e.preventDefault();leave(()=>{set('default');},'escape');}
  });
  // Local fixture observations for the design check, never production API or persistence.
  window.TableFixture={get commands(){return commands;},get rereads(){return rereads;},get pending(){return pending;}};
  if(initial==='empty')rows=[];
  if(initial==='loading')read='loading';if(initial==='load-error')read='failed';
  if(initial==='overflow')rows=Array.from({length:60},(_,i)=>({id:'floor-'+i,label:i===0?longest:'Table '+String(i+1).padStart(2,'0'),active:i<52}));
  renderList();
  const formStates=['create','rename','rename-inactive','invalid-empty','invalid-long','invalid-control','saving','duplicate-create','duplicate-rename','duplicate-reactivate','failure','unknown','unknown-read-failed','unsaved','unsaved-escape','unsaved-back','unsaved-rail','unsaved-logout','leave-pending','leave-unknown','reauth','bo01-draft','reauth-decision','bo01-decision'];
  if(formStates.includes(initial)){
    const creating=['create','invalid-empty','invalid-long','invalid-control','duplicate-create'].includes(initial);
    const inactive=['rename-inactive','duplicate-reactivate'].includes(initial);
    if(initial==='duplicate-reactivate')rows.find(r=>r.id==='t4').label='Table 1';
    openForm(creating?null:inactive?'t4':'t2');
    if(!['create','rename','rename-inactive','duplicate-reactivate'].includes(initial))$('#table-label').value='Window 2';
    if(initial==='invalid-empty'){$('#table-label').value='';fieldError(copy.empty);}
    if(initial==='invalid-long'){$('#table-label').value=longest+'Z';fieldError(copy.long);}
    if(initial==='invalid-control'){$('#table-label').value='Table\u0007 2';fieldError(copy.control);}
    if(initial.startsWith('duplicate')){if(initial!=='duplicate-reactivate')$('#table-label').value='Table 1';duplicate(initial==='duplicate-reactivate'?snapshot('reactivate','t4'):snapshot());}
    if(initial==='failure'){result='failure';notice('failure','Something went wrong',copy.failure);$('#table-label').focus();}
    if(['saving','leave-pending','pending-deactivate','pending-reactivate'].includes(initial))submit('pending');
    if(initial.startsWith('unknown')||initial==='leave-unknown')unknown(initial==='unknown-read-failed');
    if(initial.startsWith('unsaved')||initial.startsWith('leave-')||initial.endsWith('-decision'))leave(()=>{if(initial==='unsaved-logout')location.href=O.logout.href;else{set('default');}},initial==='unsaved'?'cancel':initial.replace('unsaved-',''));
    if(initial.startsWith('reauth'))expire('idle');if(initial.startsWith('bo01'))expire('ended');
  }
  if(['pending-deactivate','pending-reactivate','unknown-deactivate','unknown-reactivate'].includes(initial)){const id=initial.endsWith('-reactivate')?'t4':'t2';if(initial.startsWith('pending'))changeStatus(id,'pending');else unknown(false,snapshot(initial.endsWith('-reactivate')?'reactivate':'deactivate',id));}
  if(initial==='saved'){rows.find(r=>r.id==='t2').label='Window 2';renderList();status('Window 2 saved.');}
  if(initial==='deactivated'){rows.find(r=>r.id==='t2').active=false;renderList();status('Table 2 deactivated. It is kept for history.');}
  if(initial==='reactivated'){rows.find(r=>r.id==='t4').active=true;renderList();status('Terrace 1 reactivated.');}
  if(initial==='rejected-phase2'){$('#phase-note').hidden=false;status('Table 3 was not deactivated. Order ORD-1042 is open at this table. Settle or void that order at the POS, then try again.');}
  set(initial);
})();
