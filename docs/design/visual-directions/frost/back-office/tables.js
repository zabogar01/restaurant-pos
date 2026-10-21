/* DESIGN-017: deterministic review fixtures, never a service or an authentication store. */
(() => {
  const $=s=>document.querySelector(s), O=window.Office;
  const initial=document.documentElement.dataset.state;
  const seed=()=>[{id:'t1',label:'Table 1',active:true},{id:'t2',label:'Table 2',active:true},{id:'t3',label:'Table 3',active:true},{id:'t4',label:'Terrace 1',active:false}];
  const longest='Terrace ABCDEFGHIJKLMNOPQRSTUVWXY';
  let rows=seed(), editor=null, result='', read='ready', pending=false, generation=0, departure=null, session='active', heldDecision=false, otherMode=false, queueIncidents=false;
  let commands=0, rereads=0, settledResponse=null;
  const copy={empty:'Enter a table label.',long:'Use 32 characters or fewer.',control:'Remove control characters from the label.',duplicate:'An active table already uses this label. Choose another label.',reactivate:'An active table already uses this label. Rename this inactive table, save, then reactivate it.',unknown:'The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again.',unknownRead:'The outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again.',failure:'Try again. If the problem continues, ask a manager for help.'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const current=()=>rows.find(r=>r.id===editor?.id);
  const dirty=()=>!!editor && $('#table-label').value!==editor.original;
  const uncertain=()=>pending || result.startsWith('unknown');
  const set=s=>O.setState(s);
  function status(text){$('#table-status').hidden=!text;$('#table-status').textContent=text;}
  function notice(kind,title,body){const n=$('#form-notice');n.hidden=!title;n.dataset.kind=kind;n.setAttribute('role',kind==='failure'?'alert':'status');n.innerHTML=title?'<strong>'+esc(title)+'</strong><p>'+esc(body)+'</p>':'';if(kind==='failure'){const retry=document.createElement('button');retry.type='button';retry.className='office-button office-small-space';retry.textContent='Try again';retry.onclick=()=>{notice('','','');$('#table-label').focus();};n.append(retry);}}
  function fieldError(text){const e=$('#label-error');e.hidden=!text;e.textContent=text;$('#table-label').setAttribute('aria-invalid',text?'true':'false');$('#table-label').setAttribute('aria-describedby',text?'label-error label-help':'label-help');if(text)$('#table-label').focus();}
  function renderList(){
    $('#table-count').textContent=read==='ready'?rows.filter(r=>r.active).length+' active · '+rows.filter(r=>!r.active).length+' inactive':'';
    $('#tables-list').hidden=read!=='ready'||!rows.length;$('#read-state').hidden=read==='ready'&&!!rows.length;
    $('#new-table').disabled=read!=='ready'||pending;$('#new-table').hidden=read==='ready'&&!rows.length;
    $('#read-state').innerHTML=read==='loading'?'<div class="office-notice" role="status">Loading tables…</div>':read==='failed'?'<div class="office-notice" role="alert"><strong>Tables could not be loaded</strong><p>Try again to read the table list.</p><button class="office-button" id="retry-list">Try again</button></div>':!rows.length?'<div class="office-empty"><div class="office-empty-title">No tables yet</div><p>Create your first table to set up the floor.</p><button class="office-button" id="first-table">New table</button></div>':'';
    $('#retry-list')?.addEventListener('click',()=>{read='loading';renderList();setTimeout(()=>{read='ready';renderList();if(editor){if(result.startsWith('unknown')){notice('unknown','Outcome not confirmed',copy.unknown);set('unknown');}$('#table-label').focus();}else{set('default');$('#new-table').focus();}},350);});
    $('#first-table')?.addEventListener('click',()=>openForm());
    const sorted=[...rows].sort((a,b)=>Number(b.active)-Number(a.active)||a.label.localeCompare(b.label,'en',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id));
    $('#table-rows').innerHTML=sorted.map(r=>'<tr data-id="'+r.id+'" data-active="'+r.active+'" data-selected="'+(r.id===editor?.id)+'" data-holder="'+(result==='duplicate'&&r.active&&r.id!==editor?.id&&r.label.toLowerCase()===$('#table-label').value.toLowerCase())+'"><td>'+esc(r.label)+'</td><td class="table-status">'+(r.active?'Active':'Inactive')+'</td><td><button class="office-button small" data-edit="'+r.id+'" aria-label="Edit '+esc(r.label)+' — '+(r.active?'active':'inactive')+'" '+(pending?'disabled':'')+'>Edit</button><button class="office-button small" data-toggle="'+r.id+'" aria-label="'+(r.active?'Deactivate ':'Reactivate ')+esc(r.label)+'" '+(pending?'disabled':'')+'>'+(r.active?'Deactivate':'Reactivate')+'</button></td></tr>').join('');
  }
  function openForm(id=null,op='save',focus=true){
    const r=rows.find(r=>r.id===id);editor={id,original:r?.label||'',op,returnId:id};result='';pending=false;
    $('#table-editor').hidden=false;$('#tables-workspace').classList.add('editing');$('#table-label').value=editor.original;$('#table-label').readOnly=op!=='save';
    $('#editor-title').textContent=op==='save'?(r?'Edit '+r.label:'New table'):(op==='deactivate'?'Deactivate ':'Reactivate ')+r.label;
    $('#editor-context').textContent=op==='save'?(r?(r.active?'Active table. Changes keep this table’s history.':'Inactive table. Saving its label does not reactivate it.'):'Choose the label staff will see on the floor.'):(op==='deactivate'?'This table will be inactive and kept for history.':'This table will be active again.');
    $('#save-table').disabled=false;$('#table-label').disabled=false;fieldError('');notice('','','');renderList();if(focus)$('#table-label').focus();
  }
  function closeForm(focusId=editor?.returnId){
    generation++;settledResponse=null;pending=false;editor=null;result='';$('#table-editor').hidden=true;$('#tables-workspace').classList.remove('editing');renderList();
    ($('#table-rows').querySelector('[data-edit="'+focusId+'"]')||$('#first-table')||$('#new-table')).focus();
  }
  function applyCommand(){
    const label=$('#table-label').value, r=current();let subject=r?.label||label,id=r?.id;
    if(editor.op==='save'){if(r)r.label=label;else{const row={id:'created-'+commands,label,active:true};rows.push(row);id=row.id;}subject=label;}
    else if(r)r.active=editor.op==='reactivate';
    const outcome=editor.op==='save'?'saved':editor.op==='deactivate'?'deactivated':'reactivated';
    closeForm(id);status(subject+' '+(outcome==='saved'?'saved.':outcome==='deactivated'?'deactivated. It is kept for history.':'reactivated.'));set(outcome);
  }
  function duplicate(){
    pending=false;result='duplicate';rereads++;const label=$('#table-label').value;
    if(!rows.some(r=>r.active&&r.id!==editor.id&&r.label.toLowerCase()===label.toLowerCase()))rows.push({id:'holder-'+rereads,label,active:true});
    const wasReactivate=editor.op==='reactivate';if(wasReactivate){editor.op='save';$('#table-label').readOnly=false;$('#editor-title').textContent='Edit '+current().label;$('#editor-context').textContent='Inactive table. Saving its label does not reactivate it.';}
    $('#save-table').disabled=false;$('#table-label').disabled=false;notice('','','');fieldError(wasReactivate?copy.reactivate:copy.duplicate);renderList();
    set(wasReactivate?'duplicate-reactivate':editor.id?'duplicate-rename':'duplicate-create');
  }
  function unknown(failedRead=false){
    pending=false;result=failedRead?'unknown-read-failed':'unknown';rereads++;
    // Draw the applied-but-unconfirmed case. A list observation never promotes the result to saved.
    if(!failedRead){const r=current();if(editor.op==='save'){if(r)r.label=$('#table-label').value;else if(!rows.some(r=>r.label===$('#table-label').value))rows.push({id:'unconfirmed',label:$('#table-label').value,active:true});}else if(r)r.active=editor.op==='reactivate';read='ready';}
    else read='failed';
    $('#save-table').disabled=false;$('#table-label').disabled=false;notice('unknown','Outcome not confirmed',failedRead?copy.unknownRead:copy.unknown);renderList();
    set(failedRead?'unknown-read-failed':editor.op==='save'?'unknown':'unknown-'+editor.op);
  }
  function finish(response){
    if(departure){settledResponse=response;return;}
    pending=false;$('#save-table').disabled=false;$('#table-label').disabled=false;
    if(response==='duplicate')return duplicate();
    if(response.startsWith('unknown'))return unknown(response==='unknown-read-failed');
    if(response==='failure'||response==='not-found'){if(response==='not-found')rereads++;result='failure';notice('failure','Something went wrong',copy.failure);renderList();set('failure');return;}
    if(response==='idle'||response==='ended'){result='';notice('','','');renderList();expire(response==='idle'?'idle':'ended');return;}
    if(response==='rejected'&&editor.op==='deactivate'){const name=current().label;closeForm();status(name+' was not deactivated. Order ORD-1042 is open at this table. Settle or void that order at the POS, then try again.');$('#phase-note').hidden=false;set('rejected-phase2');return;}
    applyCommand();
  }
  function submit(response=$('#table-response').value){
    if(!editor||pending)return;
    if(editor.op==='save'){
      $('#table-label').value=$('#table-label').value.trim();const value=$('#table-label').value;
      const error=!value?copy.empty:value.length>32?copy.long:/\p{Cc}/u.test(value)?copy.control:'';
      if(error){fieldError(error);set(!value?'invalid-empty':value.length>32?'invalid-long':'invalid-control');return;}
      fieldError('');
      if(response==='saved'&&(!current()||current().active)&&rows.some(r=>r.active&&r.id!==editor.id&&r.label.toLowerCase()===$('#table-label').value.toLowerCase()))response='duplicate';
    }else if(response==='saved'&&editor.op==='reactivate'&&rows.some(r=>r.active&&r.id!==editor.id&&r.label.toLowerCase()===current().label.toLowerCase()))response='duplicate';
    pending=true;commands++;const stamp=++generation;result='pending';$('#save-table').disabled=true;$('#table-label').disabled=true;
    notice('pending','Saving…','Wait for the result. Your draft is kept.');renderList();set(editor.op==='save'?'saving':'pending-'+editor.op);
    if(response!=='pending')setTimeout(()=>{if(stamp===generation&&session==='active')finish(response);},450);
  }
  function alertCopy(target){
    const area=$(target);area.hidden=!O.kitchen;if(O.kitchen){area.querySelector('strong').textContent=O.kitchenIncident.title;area.querySelector('p').textContent=O.kitchenIncident.identity;}
  }
  function leave(action,reason='cancel'){
    if(!editor||(!dirty()&&!uncertain())){action();return;}
    departure={action,reason,prior:document.documentElement.dataset.state,focus:document.activeElement};
    $('#departure-title').textContent=reason==='logout'?'Log out and discard your changes?':'Discard unsaved changes?';
    $('#departure-copy').textContent=uncertain()?'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.':'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
    alertCopy('#departure-emergency');O.open($('#departure'),$('#stay'));
    set(uncertain()?(pending?'leave-pending':'leave-unknown'):reason==='cancel'?'unsaved':'unsaved-'+reason);
  }
  function stay(){
    const prior=departure?.prior;departure=null;O.close($('#departure'),$('#table-label'));if(prior)set(prior);
    if(session==='idle')O.open($('#table-reauth'),$('#resume-password'));
    else if(settledResponse){const response=settledResponse;settledResponse=null;finish(response);}
  }
  $('#departure').addEventListener('cancel',e=>{e.preventDefault();stay();});
  $('#stay').onclick=stay;
  $('#discard').onclick=()=>{const action=departure?.action;departure=null;$('#departure').close();closeForm();action?.();};
  function expire(mode){
    if(!editor)openForm('t2');
    generation++;if(pending){pending=false;result='unknown';notice('unknown','Outcome not confirmed','The outcome could not be confirmed. Your draft is kept; nothing was sent again.');$('#save-table').disabled=false;$('#table-label').disabled=false;}
    session=mode;heldDecision=$('#departure').open;
    if(mode==='ended'){
      $('#departure').close();$('#table-reauth').close();$('#table-editor').hidden=true;$('#table-frame').hidden=true;$('#tables-content').removeAttribute('role');$('#table-login').hidden=false;$('#table-login').setAttribute('role','main');$('#username').value='';$('#password').value='';$('#username').focus();set(heldDecision?'bo01-decision':'bo01-draft');
    }else{
      resetResume();alertCopy('#reauth-emergency');O.open($('#table-reauth'),$('#resume-password'));set(heldDecision?'reauth-decision':'reauth');
    }
  }
  function resetResume(){otherMode=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=true;$('#resume-username').value='m.iqbal';$('#resume-password').value='';$('#resume-error').hidden=true;$('#different-manager').hidden=false;$('#back-manager').hidden=true;$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#resume').hidden=false;$('#resume').textContent='Continue';$('#reauth-description').textContent='Your unsaved changes are kept. Continue as m.iqbal to resume them.';}
  function resume(same){
    session='active';$('#table-reauth').close();$('#password').value='';$('#resume-password').value='';$('#table-login').hidden=true;$('#table-login').removeAttribute('role');$('#table-frame').hidden=false;$('#tables-content').setAttribute('role','main');
    if(same){$('#table-editor').hidden=false;if(heldDecision&&departure){O.open($('#departure'),$('#stay'));set('unsaved');}else{set(result.startsWith('unknown')?'unknown':'rename');$('#table-label').focus();}if(queueIncidents){queueIncidents=false;leave(()=>location.href=O.emergency.querySelector('a').href,'rail');}}
    else{departure=null;$('#departure').close();closeForm();$('#table-label').value='';$('.office-actor').textContent='Ratna Ayu · Manager';status('');set('default');}
    heldDecision=false;
  }
  $('#table-reauth').addEventListener('cancel',e=>e.preventDefault());
  $('#table-reauth').addEventListener('keydown',e=>{if(e.key==='Tab')e.stopPropagation();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}});
  $('#table-reauth').addEventListener('close',()=>{if(session==='idle'&&!$('#table-reauth').open&&!$('#departure').open)O.open($('#table-reauth'),$('#resume-password'));});
  $('#different-manager').onclick=()=>{
    $('#resume-fields').hidden=true;$('#different-manager').hidden=true;$('#resume').hidden=true;$('#stay-manager').hidden=false;$('#choose-manager').hidden=false;
    $('#reauth-description').textContent='Your unsaved changes will not be available to the manager signing in. Continue to sign in with a different manager’s username and password.';$('#stay-manager').focus();
  };
  $('#stay-manager').onclick=()=>{resetResume();$('#resume-password').focus();};
  $('#choose-manager').onclick=()=>{otherMode=true;$('#resume-fields').hidden=false;$('#resume-username').readOnly=false;$('#resume-username').value='';$('#resume-password').value='';$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#back-manager').hidden=false;$('#resume').hidden=false;$('#resume').textContent='Sign in';$('#resume-username').focus();};
  $('#back-manager').onclick=()=>{resetResume();$('#resume-password').focus();};
  $('#resume-form').onsubmit=e=>{e.preventDefault();if(otherMode&&!$('#resume-username').value){$('#resume-username').focus();return;}if(!$('#resume-password').value){$('#resume-error').hidden=false;$('#resume-password').focus();return;}resume(!otherMode||$('#resume-username').value.trim().toLowerCase()==='m.iqbal');};
  $('#held-sign-in').onsubmit=e=>{e.preventDefault();let first;for(const id of ['username','password']){const missing=!$('#'+id).value;$('#'+id+'-error').hidden=!missing;$('#'+id).setAttribute('aria-invalid',String(missing));if(missing){$('#'+id).setAttribute('aria-describedby',id+'-error');first||=$('#'+id);}else $('#'+id).removeAttribute('aria-describedby');}if(first)return first.focus();resume($('#username').value.trim().toLowerCase()==='m.iqbal');};
  $('#idle-logout').onclick=()=>{heldDecision=false;$('#table-reauth').close();leave(()=>{session='ended';location.href=O.logout.href;},'logout');};
  $('#queue-incidents').onclick=()=>{queueIncidents=true;$('#reauth-description').textContent='Continue as m.iqbal to open print incidents. Your unsaved changes are kept.';$('#resume-password').focus();};
  $('#new-table').onclick=()=>leave(()=>openForm());
  $('#table-rows').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.edit)leave(()=>openForm(b.dataset.edit));else if(b.dataset.toggle)leave(()=>{const r=rows.find(r=>r.id===b.dataset.toggle);openForm(r.id,r.active?'deactivate':'reactivate');submit();});};
  $('#table-form').onsubmit=e=>{e.preventDefault();submit();};
  $('#cancel-table').onclick=()=>leave(()=>{closeForm();set('default');});
  $('#table-label').oninput=()=>{fieldError('');if(result==='duplicate'){result='';renderList();}};
  $('#finish-command').onclick=()=>{if(pending)finish('saved');};
  $('#simulate-idle').onclick=()=>expire('idle');$('#simulate-ended').onclick=()=>expire('ended');
  document.addEventListener('click',e=>{
    const a=e.target.closest('.bo a');if(!a||a.closest('.office-fixture'))return;
    e.preventDefault();const own=a.dataset.nav==='tables';leave(()=>{if(own){closeForm();set('default');}else location.href=a.href;},a===O.logout?'logout':'rail');
  });
  // A second fixture history entry permits real Back/Forward without leaving file review.
  history.replaceState({tableFixture:true},'',location.href);history.pushState({tableFixture:true},'',location.href);
  window.addEventListener('popstate',()=>{if(editor){history.pushState({tableFixture:true},'',location.href);leave(()=>{closeForm();set('default');},'back');}});
  document.addEventListener('keydown',e=>{
    if(e.altKey&&['i','e'].includes(e.key.toLowerCase())){e.preventDefault();expire(e.key.toLowerCase()==='i'?'idle':'ended');return;}
    if(e.key==='Escape'&&session==='active'&&!$('#departure').open&&editor){e.preventDefault();leave(()=>{closeForm();set('default');},'escape');}
  });
  // Local fixture observations for the design check, never production API or persistence.
  window.TableFixture={get commands(){return commands;},get rereads(){return rereads;},get pending(){return pending;}};
  if(initial==='empty')rows=[];
  if(initial==='loading')read='loading';if(initial==='load-error')read='failed';
  if(initial==='overflow')rows=Array.from({length:60},(_,i)=>({id:'floor-'+i,label:i===0?longest:'Table '+String(i+1).padStart(2,'0'),active:i<52}));
  renderList();
  const formStates=['create','rename','rename-inactive','invalid-empty','invalid-long','invalid-control','saving','duplicate-create','duplicate-rename','duplicate-reactivate','failure','unknown','unknown-read-failed','pending-deactivate','unknown-deactivate','pending-reactivate','unknown-reactivate','unsaved','unsaved-escape','unsaved-back','unsaved-rail','unsaved-logout','leave-pending','leave-unknown','reauth','bo01-draft','reauth-decision','bo01-decision'];
  if(formStates.includes(initial)){
    const creating=['create','invalid-empty','invalid-long','invalid-control','duplicate-create'].includes(initial);
    const inactive=['rename-inactive','duplicate-reactivate','pending-reactivate','unknown-reactivate'].includes(initial);
    if(initial==='duplicate-reactivate')rows.find(r=>r.id==='t4').label='Table 1';
    const op=initial.includes('deactivate')?'deactivate':initial.includes('reactivate')?'reactivate':'save';
    openForm(creating?null:inactive?'t4':'t2',op);
    if(!['create','rename','rename-inactive','duplicate-reactivate','pending-deactivate','unknown-deactivate','pending-reactivate','unknown-reactivate'].includes(initial))$('#table-label').value='Window 2';
    if(initial==='invalid-empty'){$('#table-label').value='';fieldError(copy.empty);}
    if(initial==='invalid-long'){$('#table-label').value=longest+'Z';fieldError(copy.long);}
    if(initial==='invalid-control'){$('#table-label').value='Table\u0007 2';fieldError(copy.control);}
    if(initial.startsWith('duplicate')){if(initial!=='duplicate-reactivate')$('#table-label').value='Table 1';duplicate();}
    if(initial==='failure'){result='failure';notice('failure','Something went wrong',copy.failure);}
    if(['saving','leave-pending','pending-deactivate','pending-reactivate'].includes(initial))submit('pending');
    if(initial.startsWith('unknown')||initial==='leave-unknown')unknown(initial==='unknown-read-failed');
    if(initial.startsWith('unsaved')||initial.startsWith('leave-')||initial.endsWith('-decision'))leave(()=>{if(initial==='unsaved-logout')location.href=O.logout.href;else{closeForm();set('default');}},initial==='unsaved'?'cancel':initial.replace('unsaved-',''));
    if(initial.startsWith('reauth'))expire('idle');if(initial.startsWith('bo01'))expire('ended');
  }
  if(initial==='saved'){rows.find(r=>r.id==='t2').label='Window 2';renderList();status('Window 2 saved.');}
  if(initial==='deactivated'){rows.find(r=>r.id==='t2').active=false;renderList();status('Table 2 deactivated. It is kept for history.');}
  if(initial==='reactivated'){rows.find(r=>r.id==='t4').active=true;renderList();status('Terrace 1 reactivated.');}
  if(initial==='rejected-phase2'){$('#phase-note').hidden=false;status('Table 3 was not deactivated. Order ORD-1042 is open at this table. Settle or void that order at the POS, then try again.');}
  set(initial);
})();
