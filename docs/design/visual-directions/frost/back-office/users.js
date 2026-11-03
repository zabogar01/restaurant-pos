/* DESIGN-023: local review drawings, not authentication or seeded configuration.
   Native credential values are read once at submit, never kept in the fixture ledger. */
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], O=window.Office;
  const state=new URLSearchParams(location.search).get('state')||'default';
  const clone=x=>JSON.parse(JSON.stringify(x)), esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const set=s=>O.setState(s), focus=s=>$(s)?.focus(), label=c=>({KITCHEN:'Kitchen',CASHIER:'Cashier',MANAGER:'Manager'}[c]);
  // The sign-in cooldown's own format (login.js): zero parts omitted, e.g. 5 min, 4 min 59 s, 59 s.
  const duration=n=>[n>=60?Math.floor(n/60)+' min':'',n%60?n%60+' s':''].filter(Boolean).join(' ');
  let actor='iqbal';
  let records=[['iqbal','M. Iqbal','MANAGER',true,'m.iqbal'],['ana','Ana R.','CASHIER',true,null],['halim','S. Halim','KITCHEN',true,null],['ayu','Ratna Ayu','MANAGER',true,'r.ayu'],['putra','D. Putra','CASHIER',true,'d.putra'],['sari','R. Sari','CASHIER',false,null],['wibowo','B. Wibowo','KITCHEN',false,null],['dewi','Dewi Lestari','MANAGER',false,'d.lestari']].map(([staffUserId,name,classification,isActive,username])=>({staffUserId,name,classification,isActive,username}));
  let server=clone(records), read='ready',partial=false,failRead=false,editor=null,pending=null,held=null,decision=null,confirmation=null,gate='active',heldDecision=false,heldConfirm=false,queuedIncident=false,otherMode=false,seq=0,reads=0,cooldown=0;
  const commands=[],errors=new Map(),keys=['name','currentPassword','pin','username','password'],credentialKeys=keys.slice(1);
  const find=id=>records.find(r=>r.staffUserId===id),serverRow=id=>server.find(r=>r.staffUserId===id),response=()=>$('#fixture-response').value;
  window.UserFixture={commands,get reads(){return reads;},get rows(){return clone(records);},get draft(){return editor?{op:editor.op,id:editor.id,name:editor.name,target:editor.target,unknown:editor.unknown}:null;},get pending(){return !!pending;},get cooldown(){return cooldown;},finish:r=>finish(r),failRead(){failRead=true;}};
  function clearCredentials(explain=false){credentialKeys.forEach(k=>$('#user-'+k).value='');if(editor){editor.secretTouched=false;if(explain)$('#credentials-cleared').hidden=false;}}
  function fieldError(k,text=''){const el=$('#user-'+k),error=$('#user-'+k+'-error');if(text)errors.set(k,text);else errors.delete(k);error.textContent=text;error.hidden=!text;el.setAttribute('aria-describedby','user-'+k+'-help'+(text?' '+error.id:''));if(text)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');}
  function clearErrors(){keys.forEach(k=>fieldError(k));}
  function notice(title='',body='',kind='status'){const el=$('#form-notice');el.hidden=!title;el.dataset.kind=kind;el.setAttribute('role',kind==='failure'?'alert':'status');$('#notice-title').textContent=title;$('#notice-body').textContent=body;}
  function status(text=''){const el=$('#page-status');el.hidden=!text;el.textContent=text;}
  function fields(){if(!editor)return [];const {op,subject,target}=editor;
    if(op==='create')return ['name',...(target==='KITCHEN'?[]:target==='CASHIER'?['pin']:['pin','username','password'])];
    if(op==='move')return [...(subject.classification==='KITCHEN'?['pin']:[]),...(target==='MANAGER'?[...(subject.username?[]:['username']),'password']:[])];
    if(op==='own-password')return ['currentPassword','password'];if(op==='own-pin')return ['currentPassword','pin'];
    return op==='password'?['password']:['pin'];
  }
  function warning(op,r,target){
    if(op==='own-pin')return 'Your POS sessions will end on their next action. This back-office session will continue.';
    if(op==='own-password')return 'Your other POS and back-office sessions will end on their next action. This back-office session will continue.';
    if(op==='create'||op==='reactivate')return '';
    if(r.classification==='KITCHEN')return op==='deactivate'?r.name+' will be inactive. Kitchen staff have no PIN or sign-in sessions. You can reactivate this person later.':r.name+' currently has no sign-in sessions. After this change, they must sign in to use '+(target==='MANAGER'?'the POS or back office.':'the POS.');
    // A cashier has POS sessions only; a manager has both. Name only what this person has.
    return r.name+'’s '+(r.classification==='MANAGER'?'POS and back-office sessions':'POS sessions')+' will end on their next action. '+(op==='deactivate'?'They cannot sign in while inactive. You can reactivate this person later.':target==='KITCHEN'?'Their PIN will be removed. They will no longer sign in.':target==='CASHIER'&&r.classification==='MANAGER'?'Their back-office login will no longer work. They can sign in at the POS.':'They must sign in again.');
  }
  function firstField(){if(!editor)return $('#new-user');return editor.op==='move'?$('#user-classification'):$('#user-'+fields()[0]);}
  function dirty(){return !!editor&&(!!pending||editor.unknown||editor.secretTouched||editor.name!==editor.openingName||editor.target!==editor.openingTarget);}
  function rowButtons(r){const own=r.staffUserId===actor;const b=(op,text)=>'<button type="button" class="office-button small'+(op==='deactivate'?' danger':'')+'" data-action="'+op+'" data-id="'+r.staffUserId+'" aria-label="'+text+' — '+esc(r.name)+'">'+text+'</button>';
    if(own)return b('own-password','Change my password')+b('own-pin','Change my PIN');
    if(!r.isActive)return b('reactivate','Reactivate');
    return b('move','Change role')+(r.classification!=='KITCHEN'?b('pin','Reset PIN'):'')+(r.classification==='MANAGER'?b('password','Reset password'):'')+b('deactivate','Deactivate');
  }
  function renderList(){const active=document.activeElement, restore=active?.matches('#user-rows button')?'[data-action="'+active.dataset.action+'"][data-id="'+active.dataset.id+'"]':null;const known=read==='ready'||partial;
    $('#list-facts').textContent=read==='ready'?records.filter(r=>r.isActive).length+' active · '+records.filter(r=>!r.isActive).length+' inactive':'';
    $('#users-list').hidden=!known;$('#read-state').hidden=read==='ready';
    $('#read-state').innerHTML=read==='loading'?'<p role="status">Loading staff…</p>':read==='failed'?'<div class="office-notice" role="alert"><strong>'+(partial?'The staff list may be out of date':'Staff could not be loaded')+'</strong><p>'+(partial?'The rows below are the ones this page knows, including your latest change. Try again to read the full list.':'Try again to read the staff list.')+'</p><button class="office-button" id="retry-read">Try again</button></div>':'';
    $('#user-rows').innerHTML=[...records.filter(r=>r.isActive),...records.filter(r=>!r.isActive)].map(r=>'<tr data-id="'+r.staffUserId+'" data-active="'+r.isActive+'" data-selected="'+(editor?.id===r.staffUserId)+'"><td>'+esc(r.name)+(r.staffUserId===actor?'<span class="user-detail">You · Signed in</span>':'')+(r.username?'<span class="user-detail">'+(r.classification==='MANAGER'?'Username: ':'Retained username: ')+esc(r.username)+(r.classification!=='MANAGER'?' · No back-office access':'')+'</span>':'')+'</td><td>'+label(r.classification)+(r.classification==='KITCHEN'?'<span class="user-detail">No sign-in</span>':'')+'</td><td>'+(r.isActive?'Active':'Inactive')+'</td><td><div class="office-actions">'+rowButtons(r)+'</div></td></tr>').join('');
    $$('[data-action],#new-user').forEach(b=>{const off=!!pending||(!known&&b.id==='new-user');b.setAttribute('aria-disabled',String(off));b.tabIndex=off?-1:0;});
    if(restore)$(restore)?.focus({preventScroll:true});
    if(pending?.discarded)status('Waiting for an earlier save to finish. Nothing will be sent again.');
  }
  function renderForm(){
    $('#user-editor').hidden=!editor;$('#users-workspace').classList.toggle('editing',!!editor);if(!editor)return;
    const {op,subject:r,target}=editor,create=op==='create';
    $('#editor-title').textContent=create?'Add person':({move:'Change role',pin:'Reset PIN',password:'Reset password','own-pin':'Change my PIN','own-password':'Change my password',reactivate:'Reactivate'}[op]+' — '+r.name);
    $('#form-context').textContent=create?'Create a named person. Choose the classification before entering credentials.':op==='move'?'Current classification: '+label(r.classification)+'. '+(target==='MANAGER'?'Promotion always sets a new password.':target==='KITCHEN'?'The PIN is removed.':'The POS PIN is '+(r.classification==='KITCHEN'?'set.':'kept.')):op==='reactivate'?'Set a new PIN to reactivate '+r.name+'.':r.name+' · '+label(r.classification);
    $('#classification-field').hidden=!(create||op==='move');
    const options=create?['KITCHEN','CASHIER','MANAGER']:['KITCHEN','CASHIER','MANAGER'].filter(c=>c!==r.classification);
    $('#user-classification').innerHTML=options.map(c=>'<option value="'+c+'">'+label(c)+(c==='KITCHEN'?' · no sign-in':'')+'</option>').join('');$('#user-classification').value=target;
    $('#classification-help').textContent=create?'Kitchen needs a name only. Cashiers need a PIN. Managers also need a back-office login.':'Choose the new classification. Changing this choice clears every credential field.';
    const visible=fields();keys.forEach(k=>{$('#'+k+'-field').hidden=!visible.includes(k);$('#user-'+k).disabled=!!pending;});
    $('#user-name').value=editor.name;$('#user-classification').disabled=!!pending;
    $('#stored-username').hidden=!(op==='move'&&target==='MANAGER'&&r.username);$('#stored-username').textContent=r?.username?'Retained username: '+r.username+' · This username cannot change.':'';
    const w=warning(op,r,target);$('#session-warning').hidden=!w;$('#session-warning').textContent=w;
    $('#save-user').textContent=op==='reactivate'?'Reactivate with new PIN':'Save';
    $('#save-user').disabled=!!pending||!!editor.blocked||(cooldown>0&&op.startsWith('own-'));
    $('#save-hint').textContent=pending?'Wait for the save result.':editor.blocked?'Return to the staff list and choose an action on the current person.':cooldown>0&&op.startsWith('own-')?'Wait for the cooldown before saving.':'Nothing is sent until you save.';
    $('#changed-actions').hidden=!editor.blocked;
    if(cooldown>0&&op.startsWith('own-'))$('#user-currentPassword').disabled=true;
  }
  function fitPanel(){if(!editor||gate==='ended')return;const panel=$('#user-editor'),content=$('#users-content');
    // Available space comes from measured container geometry, not a new design token.
    const available=content.getBoundingClientRect().bottom-panel.getBoundingClientRect().top-parseFloat(getComputedStyle(content).paddingBottom);
    panel.style.maxHeight=Math.max(0,available)+'px';
  }
  function render(){renderList();renderForm();fitPanel();}
  new ResizeObserver(()=>fitPanel()).observe($('#users-content'));
  $('#users-content').addEventListener('scroll',()=>requestAnimationFrame(fitPanel));

  function openEditor(op,id=null,opener=null,target=null){clearCredentials();const r=id?clone(find(id)):null;
    editor={op,id,subject:r,name:'',openingName:'',target:target||(op==='create'?'KITCHEN':op==='move'?(r.classification==='KITCHEN'?'CASHIER':'MANAGER') :null),opener:opener||'#new-user',secretTouched:false,unknown:false,blocked:false};
    if(op==='move'&&editor.target===r.classification)editor.target='CASHIER';editor.openingTarget=editor.target;
    clearErrors();notice();status();$('#credentials-cleared').hidden=true;render();firstField().focus();set(op==='create'?'create-'+editor.target.toLowerCase():op);
    if(cooldown>0&&op.startsWith('own-')){fieldError('currentPassword','Wait '+duration(cooldown)+' before trying your current password again.');focus('#form-notice');notice('Password verification is cooling down','Wait '+duration(cooldown)+'. This is the same cooldown used at sign-in.','failure');}
  }
  function closeEditor(restore=true){const opener=editor?.opener;clearCredentials();editor=null;clearErrors();notice();$('#user-name').value='';render();if(restore)$(opener)?.focus();}
  function reread(){reads++;if(failRead){failRead=false;read='failed';partial=false;return false;}records=clone(server);read='ready';partial=false;return true;}
  function validate(){clearErrors();const values={};for(const k of fields())values[k]=$('#user-'+k).value;
    if('name'in values){values.name=values.name.trim();editor.name=values.name;$('#user-name').value=values.name;fieldError('name',!values.name?'Enter a name.':[...values.name].length>64?'Use 64 characters or fewer.':/\p{Cc}/u.test(values.name)?'Remove control characters from the name.':'');}
    if('pin'in values)fieldError('pin',/^[0-9]{6}$/.test(values.pin)?'':'Enter exactly six digits, 0–9.');
    if('username'in values){values.username=values.username.trim().replace(/[A-Z]/g,c=>c.toLowerCase());$('#user-username').value=values.username;fieldError('username',/^[a-z0-9][a-z0-9._-]{2,31}$/.test(values.username)?'':'Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit.');}
    if('password'in values)fieldError('password',[...values.password].length<8||[...values.password].length>128?'Use 8–128 characters. Spaces count.':'');
    if('currentPassword'in values)fieldError('currentPassword',!values.currentPassword?'Enter your current password.':values.currentPassword.length>1024?'Use 1024 characters or fewer.':'');
    if(errors.size){focus('#user-'+errors.keys().next().value);return null;}return values;
  }
  function submit(){if(!editor||pending||editor.blocked||(cooldown>0&&editor.op.startsWith('own-')))return;const values=validate();if(!values)return;
    // Deliberately exclude secrets from the mock request ledger and pending state.
    const cmd={op:editor.op,id:editor.id,name:editor.op==='create'?values.name:editor.subject.name,target:editor.target,username:values.username,fields:Object.keys(values),form:true};send(cmd,response());
  }
  function send(cmd,result){status();pending={...cmd,createdId:'created-'+(++seq),discarded:false};commands.push({op:cmd.op,id:cmd.id,fields:cmd.fields||[],target:cmd.target});
    if(editor)editor.unknown=false;
    if(cmd.form){notice('Saving…','Wait for the result. Your draft is kept.');render();focus('#form-notice');}else{render();status((cmd.op==='deactivate'?'Deactivating ':'Reactivating ')+cmd.name+'…');focus('#page-status');}
    set('saving-'+cmd.op);if(result!=='pending')finish(result);
  }
  function apply(cmd){let r=serverRow(cmd.id);if(cmd.op==='create'){r={staffUserId:cmd.createdId,name:cmd.name,classification:cmd.target,isActive:true,username:cmd.username||null};server.push(r);}
    else if(r){if(cmd.op==='move'){r.classification=cmd.target;if(cmd.target==='MANAGER'&&cmd.username)r.username=cmd.username;}else if(cmd.op==='deactivate')r.isActive=false;else if(cmd.op==='reactivate')r.isActive=true;}
    if(!r)return null;const at=records.findIndex(x=>x.staffUserId===r.staffUserId);if(at<0)records.push(clone(r));else records[at]=clone(r);if(read==='failed')partial=true;return r;
  }
  function resultFocus(id){const b=$('#user-rows tr[data-id="'+id+'"] button');(b||$('#new-user')).focus();}
  function unknownCopy(cmd){const readText=read==='failed'?'The list could not be refreshed.':'The list has been refreshed.';
    let body=cmd.name+': the outcome could not be confirmed. '+readText+' Nothing was sent again.';
    if(cmd.form)body+=' Your draft is kept; enter credentials again.';
    if(cmd.op==='own-password')body+=' The list cannot show whether your password changed. For your next change, try the new password you chose as Current password first. If it is refused, try your previous password. Each wrong attempt counts towards your sign-in cooldown.';
    if(cmd.op==='pin'||cmd.op==='password')body+=' The list cannot confirm the reset or whether this person’s sessions ended.';
    return body;
  }
  function finish(result,cmd=pending){if(!cmd)return;clearCredentials(true);
    if(gate!=='active'||decision){held={result,cmd,sessionRefused:result==='idle'||result==='ended'};return;}
    pending=null;
    if(result==='idle'||result==='ended'){render();notice();expire(result);return;}
    if(result==='session-refused'){render();if(cmd.form&&!cmd.discarded){notice('Nothing was saved','Enter credentials again, then press Save.');firstField().focus();}else if(!cmd.discarded){status(cmd.name+' was not changed. Use its row action to try again.');focus('#page-status');}return;}
    if(result==='saved'){
      const r=apply(cmd);if(!r)return finish('not-found',cmd);render();if(cmd.discarded){status();return;}if(cmd.form)closeEditor(false);
      const text=cmd.op==='create'?' added.':cmd.op==='move'?' changed to '+label(r.classification)+'.':cmd.op==='deactivate'?' deactivated.':cmd.op==='reactivate'?' reactivated.':cmd.op.includes('password')?'’s password changed.':'’s PIN changed.';
      status(r.name+text+(cmd.op==='own-pin'||cmd.op==='own-password'?' This back-office session continues.':''));resultFocus(r.staffUserId);/* Walk 4 follows the person: kitchen has no sessions; a cashier has POS sessions; a manager has both. */$('#cross-client').hidden=cmd.op!=='deactivate'||r.classification==='KITCHEN';$('#cross-bo').hidden=r.classification!=='MANAGER';set('saved-'+cmd.op);return;
    }
    if(result.startsWith('unknown')){if(result==='unknown-read-failed')failRead=true;reread();render();if(cmd.discarded){status();return;}
      if(cmd.form){editor.unknown=true;editor.lastCommand={op:cmd.op,name:cmd.name,form:true};notice('Outcome not confirmed',unknownCopy(cmd));firstField().focus();}else{status(unknownCopy(cmd));focus('#page-status');}set('unknown-'+cmd.op);return;
    }
    if(['duplicate-pin','duplicate-username','user-changed','not-found'].includes(result)){
      if(result==='user-changed'){const r=serverRow(cmd.id);if(r)r.isActive=false;}
      if(result==='not-found')server=server.filter(r=>r.staffUserId!==cmd.id);
      reread();
    }
    if(cmd.discarded){render();status();return;}
    if(result==='duplicate-pin'&&cmd.op==='reactivate'&&!cmd.form){openEditor('reactivate',cmd.id,'[data-action="reactivate"][data-id="'+cmd.id+'"]');}
    if(result.startsWith('duplicate-')&&editor){const k=result==='duplicate-pin'?'pin':'username';notice();render();fieldError(k,k==='pin'?(cmd.op==='reactivate'?'That PIN is already in use. Enter a new PIN to reactivate this person.':'That PIN is already in use. Choose a different PIN.'):'That username is already in use. Choose another username.');focus('#user-'+k);set(result);return;}
    if(result==='wrong-password'||result==='throttled'){
      if(result==='throttled')cooldown=300;render();fieldError('currentPassword',result==='throttled'?'Wait '+duration(cooldown)+' before trying your current password again.':'Incorrect current password. Try again.');
      if(result==='throttled'){notice('Password verification is cooling down','Wait '+duration(cooldown)+'. This is the same cooldown used at sign-in.','failure');focus('#form-notice');}else focus('#user-currentPassword');set(result);return;
    }
    let title='Something went wrong',body='Nothing was saved. Your draft is kept. Enter credentials again, then press Save to try again.';
    if(result==='own-account'){title='This action cannot change your own account';body='Use Change my password or Change my PIN on your own row. You cannot deactivate yourself or change your own role.';}
    if(result==='user-changed'){title=cmd.name+' changed while you were editing';body='Nothing was saved. '+(read==='failed'?'The staff list could not be refreshed. Try again reads the list only.':'The staff list has been refreshed.')+' Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person.';}
    if(result==='not-found'){title=cmd.name+' could not be found';body='Nothing was saved. '+(read==='failed'?'The staff list could not be refreshed.':'The staff list has been refreshed.')+' Return to the staff list to choose another person.';}
    if(editor){editor.blocked=['own-account','user-changed','not-found'].includes(result);render();notice(title,body,'failure');if(editor.blocked)focus('#form-notice');else firstField().focus();}
    else{render();status(title+'. '+(result==='failure'?cmd.name+' was not changed. Use its row action to try again.':body));focus('#page-status');}set(result);
  }
  function flush(){if(held&&gate==='active'&&!decision){const a=held;held=null;finish(a.sessionRefused?'session-refused':a.result,a.cmd);}}
  function emergency(id){const el=$(id);el.hidden=!O.kitchen;if(O.kitchen){el.querySelector('strong').textContent=O.kitchenIncident.title;el.querySelector('p').textContent=O.kitchenIncident.identity;}}
  function toggle(id){const r=find(id);if(!r)return;status();if(r.isActive){confirmation={id,opener:'[data-action="deactivate"][data-id="'+id+'"]'};$('#deactivate-title').textContent='Deactivate '+r.name+'?';$('#deactivate-copy').textContent=warning('deactivate',r);$('#keep-active').setAttribute('aria-label','Keep active — '+r.name);$('#confirm-deactivate').setAttribute('aria-label','Deactivate '+r.name);emergency('#deactivate-emergency');O.open($('#deactivate-confirm'),$('#keep-active'));set('deactivate');}else send({op:'reactivate',id,name:r.name},response());}
  function keepActive(){const target=confirmation?.opener;confirmation=null;O.close($('#deactivate-confirm'),$(target));set('default');afterModal();}
  $('#keep-active').onclick=keepActive;$('#deactivate-confirm').addEventListener('cancel',e=>{e.preventDefault();keepActive();});
  $('#confirm-deactivate').onclick=()=>{const r=find(confirmation.id);confirmation=null;$('#deactivate-confirm').close();send({op:'deactivate',id:r.staffUserId,name:r.name},response());afterModal();};
  function afterModal(){if(queuedIncident&&gate==='active'&&!decision&&!confirmation){queuedIncident=false;leave(()=>location.href=O.emergency.querySelector('a').href,'rail');}}
  function depart(action){if(pending&&editor)pending.discarded=true;closeEditor();flush();action();}
  function leave(action,reason='cancel'){
    if(!dirty()){depart(action);return;}
    decision={action,prior:document.documentElement.dataset.state};const uncertain=!!pending||editor.unknown;
    $('#departure-title').textContent=reason==='logout'?'Log out and discard your changes?':'Discard unsaved changes?';$('#stay').textContent=reason==='logout'?'Keep this draft':'Stay';$('#discard').textContent=reason==='logout'?'Discard changes and log out':'Discard';
    $('#departure-copy').textContent=reason==='logout'?'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.':uncertain?'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.':'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
    $('#departure-uncertain').hidden=!(reason==='logout'&&uncertain);emergency('#departure-emergency');O.open($('#departure'),$('#stay'));set(uncertain?(pending?'leave-pending':'leave-unknown'):'unsaved');
  }
  function workFocus(){return pending?(pending.form?$('#form-notice'):$('#page-status')):firstField();}
  function stay(){const prior=decision?.prior;decision=null;O.close($('#departure'),workFocus());if(prior)set(prior);if(gate==='idle')O.open($('#users-reauth'),$('#resume-password'));else{flush();afterModal();}}
  $('#stay').onclick=stay;$('#departure').addEventListener('cancel',e=>{e.preventDefault();stay();});
  $('#discard').onclick=()=>{const action=decision.action;decision=null;$('#departure').close();depart(action);};

  function expire(mode){
    gate=mode;heldDecision=!!decision;heldConfirm=!!confirmation;clearCredentials(true);
    $('#users-frame').inert=true;
    if(mode==='ended'){$('#departure').close();$('#deactivate-confirm').close();$('#users-reauth').close();$('#users-frame').hidden=true;$('#users-login').hidden=false;$('#username').value='';$('#password').value='';focus('#username');set(heldConfirm?'bo01-confirm':heldDecision?'bo01-decision':'bo01-draft');}
    else{resetResume();emergency('#reauth-emergency');O.open($('#users-reauth'),$('#resume-password'));set(heldConfirm?'reauth-confirm':heldDecision?'reauth-decision':'reauth');}
  }
  function resetResume(){clearCredentials(true);$('#back-manager').textContent='Back to '+find(actor).username;otherMode=false;$('#reauth-title').textContent='Your session timed out';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=true;$('#resume-username').value=find(actor).username;$('#resume-password').value='';$('#resume-error').hidden=true;$('#different-manager').hidden=false;$('#back-manager').hidden=true;$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#resume').hidden=false;$('#resume').textContent='Continue';$('#reauth-description').textContent='Your unsaved changes are kept. Continue as '+find(actor).username+' to resume them.';}
  function resume(sameManager){clearCredentials(true);
    gate='active';$('#users-reauth').close();$('#users-login').hidden=true;$('#users-frame').hidden=false;$('#users-frame').inert=false;$('#password').value='';$('#resume-password').value='';
    if(sameManager){render();
      if(heldConfirm&&confirmation)O.open($('#deactivate-confirm'),$('#keep-active'));
      else if(heldDecision&&decision)O.open($('#departure'),$('#stay'));
      else if(held)flush();
      else if(pending)workFocus().focus();
      else if(editor){firstField().focus();set('draft-restored');}
      else focus('#new-user');
      if(queuedIncident&&!decision&&!confirmation){queuedIncident=false;leave(()=>location.href=O.emergency.querySelector('a').href,'rail');}
    }else{
      decision=null;confirmation=null;pending=null;held=null;$('#departure').close();$('#deactivate-confirm').close();closeEditor(false);clearCredentials();actor=actor==='iqbal'?'ayu':'iqbal';status();$('.office-actor').textContent=find(actor).name+' · Manager';render();focus('#new-user');set('default');
    }heldDecision=false;heldConfirm=false;
  }
  $('#users-reauth').addEventListener('cancel',e=>e.preventDefault());
  $('#users-reauth').addEventListener('keydown',e=>{if(e.key==='Tab')e.stopPropagation();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}});
  $('#users-reauth').addEventListener('close',()=>{if(gate==='idle'&&!$('#users-reauth').open&&!$('#departure').open)O.open($('#users-reauth'),$('#resume-password'));});
  $('#different-manager').onclick=()=>{clearCredentials(true);$('#resume-password').value='';$('#resume-fields').hidden=true;$('#different-manager').hidden=true;$('#resume').hidden=true;$('#stay-manager').hidden=false;$('#choose-manager').hidden=false;$('#reauth-title').textContent='Sign in as a different manager?';$('#reauth-description').textContent='The current manager’s unsaved changes will not be available to the manager signing in.';$('#idle-logout').hidden=true;focus('#stay-manager');};
  $('#stay-manager').onclick=()=>{resetResume();focus('#resume-password');};
  $('#choose-manager').onclick=()=>{clearCredentials(true);otherMode=true;$('#reauth-title').textContent='Sign in as a different manager';$('#reauth-description').textContent='Enter your own username and password. The current manager’s unsaved changes will not be available to you.';$('#idle-logout').hidden=false;$('#resume-fields').hidden=false;$('#resume-username').readOnly=false;$('#resume-username').value='';$('#resume-password').value='';$('#stay-manager').hidden=true;$('#choose-manager').hidden=true;$('#back-manager').hidden=false;$('#resume').hidden=false;$('#resume').textContent='Sign in';focus('#resume-username');};
  $('#back-manager').onclick=()=>{resetResume();focus('#resume-password');};
  $('#resume-form').onsubmit=e=>{e.preventDefault();if(otherMode&&!$('#resume-username').value.trim()){focus('#resume-username');return;}if(!$('#resume-password').value){$('#resume-error').hidden=false;focus('#resume-password');return;}resume(!otherMode||$('#resume-username').value.trim().toLowerCase()===find(actor).username);};
  $('#held-sign-in').onsubmit=e=>{e.preventDefault();let first;for(const id of ['username','password']){const missing=!$('#'+id).value;$('#'+id+'-error').hidden=!missing;$('#'+id).setAttribute('aria-invalid',String(missing));if(missing){$('#'+id).setAttribute('aria-describedby',id+'-error');first||=$('#'+id);}else $('#'+id).removeAttribute('aria-describedby');}if(first)return first.focus();resume($('#username').value.trim().toLowerCase()===find(actor).username);};
  $('#idle-logout').onclick=()=>{$('#users-reauth').close();leave(()=>{gate='ended';location.href=O.logout.href;},'logout');};
  $('#queue-incidents').onclick=()=>{queuedIncident=true;$('#reauth-description').textContent='Continue as '+find(actor).username+' to open print incidents. Your unsaved changes are kept.';focus('#resume-password');};
  $('#new-user').onclick=()=>{if($('#new-user').getAttribute('aria-disabled')!=='true')leave(()=>openEditor('create'),'switch');};
  $('#user-rows').onclick=e=>{const b=e.target.closest('button');if(!b||pending)return;const {action,id}=b.dataset;leave(()=>['deactivate','reactivate'].includes(action)?toggle(id):openEditor(action,id,'[data-action="'+action+'"][data-id="'+id+'"]'),'switch');};
  $('#user-form').onsubmit=e=>{e.preventDefault();submit();};$('#cancel-user').onclick=()=>leave(()=>set('default'));
  $('#return-list').onclick=()=>leave(()=>set('default'));
  keys.forEach(k=>$('#user-'+k).oninput=()=>{if(!editor)return;if(k==='name')editor.name=$('#user-name').value;else editor.secretTouched=true;fieldError(k);});
  $('#user-username').onblur=()=>{const e=$('#user-username');e.value=e.value.trim().replace(/[A-Z]/g,c=>c.toLowerCase());};
  $('#user-classification').onchange=()=>{if(!editor||pending)return;editor.target=$('#user-classification').value;clearCredentials(true);clearErrors();renderForm();(fields().find(k=>k!=='name')?$('#user-'+fields().find(k=>k!=='name')):$('#user-classification')).focus();set('classification-switch');};
  $('#read-state').onclick=e=>{if(!e.target.closest('#retry-read'))return;reread();render();if(editor?.unknown)notice('Outcome not confirmed',unknownCopy(editor.lastCommand));if(editor?.blocked)focus('#form-notice');else firstField().focus();};
  $('#finish-command').onclick=()=>finish(response()==='pending'?'saved':response());$('#fixture-idle').onclick=()=>expire('idle');$('#fixture-ended').onclick=()=>expire('ended');$('#fail-read').onclick=()=>{failRead=true;};
  $('#finish-wait').onclick=()=>{cooldown=0;fieldError('currentPassword');notice();renderForm();if(editor?.op.startsWith('own-'))focus('#user-currentPassword');};
  setInterval(()=>{if(!cooldown)return;cooldown--;if(editor?.op.startsWith('own-')){fieldError('currentPassword',cooldown?'Wait '+duration(cooldown)+' before trying your current password again.':'');$('#notice-body').textContent='Wait '+duration(cooldown)+'. This is the same cooldown used at sign-in.';if(!cooldown){notice();renderForm();}}},1000);
  document.addEventListener('click',e=>{const a=e.target.closest('.bo a');if(!a||e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.closest('.office-fixture'))return;e.preventDefault();leave(()=>location.href=a.href,a.classList.contains('office-logout')?'logout':'rail');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&gate==='active'&&!decision&&!confirmation&&editor){e.preventDefault();leave(()=>set('default'));}});
  const entryURL=location.href;history.replaceState({userEntry:true},'',entryURL);history.pushState({userWork:true},'',entryURL);
  window.addEventListener('popstate',()=>{if(dirty()){history.pushState({userWork:true},'',entryURL);leave(()=>{editor=null;history.go(-2);},'back');}});

  /* Direct review URLs use the same forms and result handlers as interactive walks.
     Values shown inside secret inputs are only native input state; no echo is drawn. */
  const spec=window.USER_CASES[state]||{};
  if(state==='only-manager'){records=records.filter(r=>r.staffUserId===actor);server=clone(records);}
  if(state==='overflow'){records.push(...Array.from({length:40},(_,i)=>({staffUserId:'long-'+i,name:i===0?'W'.repeat(64):'Staff member '+(i+1),classification:'MANAGER',isActive:i<30,username:i===0?'w'.repeat(32):'manager.'+i})));server=clone(records);}
  if(state==='loading')read='loading';if(state==='load-error')read='failed';render();
  if(spec.op){
    if(spec.op==='deactivate'){toggle(spec.id||'ana');if(spec.result){$('#fixture-response').value=spec.result;$('#confirm-deactivate').click();}}
    else if(spec.op==='reactivate'&&!spec.form){send({op:'reactivate',id:spec.id||'sari',name:find(spec.id||'sari').name},spec.result||'pending');}
    else{
      const id=spec.id??null;openEditor(spec.op,id,id?'[data-action="'+spec.op+'"][data-id="'+id+'"]':'#new-user',spec.target);
      if(spec.op==='create'&&spec.draft){editor.name='Nadia Pratiwi';renderForm();}
      if(spec.switch){editor.name='Nadia Pratiwi';$('#user-name').value=editor.name;$('#user-classification').value='MANAGER';$('#user-classification').dispatchEvent(new Event('change'));}
      if(spec.error){const [k,error]=spec.error;if(state.endsWith('-long'))$('#user-'+k).value='W'.repeat(k==='name'?65:k==='username'?33:k==='password'?129:1025);if(state.endsWith('-short'))$('#user-'+k).value=k==='pin'?'123':k==='username'?'ab':'short';if(state.endsWith('-format'))$('#user-'+k).value=k==='pin'?'１２３４５６':'_invalid';if(state.endsWith('-control'))$('#user-'+k).value='Name\u0007';fieldError(k,error);focus('#user-'+k);}
      if(spec.result){if(spec.partial){read='failed';partial=false;if(spec.result==='user-changed')failRead=true;}send({op:editor.op,id:editor.id,name:editor.op==='create'?'Nadia Pratiwi':editor.subject.name,target:editor.target,username:editor.target==='MANAGER'&&!editor.subject?.username?'n.pratiwi':undefined,fields:fields(),form:true},spec.result);}
    }
    if(spec.leave){if(editor)editor.secretTouched=true;leave(()=>set('default'),spec.leave);}
    if(spec.gate)expire(spec.gate);
    if(spec.restored){expire('idle');resume(true);}
  }
  // Keep the requested gallery state stable; later interactions set their own state.
  set(state);
})();
