/* M-6 local fixture. No credential is checked; response and duration values are illustrative. */
(() => {
  const credentialCopy = {
    label: 'Password',
    wrong: 'Incorrect password. Try again.',
    missing: 'Enter your password.'
  };
  const $=s=>document.querySelector(s), O=window.Office;
  const dialog=$('#reauth-dialog'), logout=$('#logout-dialog'), secret=$('#credential');
  const before={name:'Evening service',choice:'First choice',mode:'standard',limit:'12'};
  window.officeDraftOriginal=Object.freeze(before);
  $('#draft-name').value='Evening service — revised';
  $('#draft-choice').value='Second choice';
  $('#draft [value=alternate]').checked=true;
  $('#draft-limit').value='twelve';
  let departure=O.logout.href;
  let resumeFocus=$('#draft-limit'), selection=[0,6], timer, verifyingTimer, returnToReauth=false, queued=false;
  const accounts=new Map(), idled='m.iqbal', manager=$('#manager');
  let other=false, priorState='reauth', separate=false;
  const account=(username=manager.value)=>{const key=username.trim().toLowerCase();if(!accounts.has(key))accounts.set(key,{failures:0,expires:0});const value=accounts.get(key);if(value.expires&&value.expires<=Date.now()){value.expires=0;value.failures=0;}return value;};
  const remaining=username=>Math.max(0,Math.ceil((account(username).expires-Date.now())/1000));
  let reauthRequired=false, departureState='none', departureFocus;
  $('#credential-label').textContent=credentialCopy.label;
  $('#reauth-alert strong').textContent=O.kitchenIncident.title;
  $('#reauth-alert [data-incident-identity]').textContent=O.kitchenIncident.identity;
  $('#scroll-samples').innerHTML=Array.from({length:24},(_,i)=>'<p>Sample '+(i+1)+' · Edited values stay in the form while this content scrolls.</p>').join('');
  function remember() {
    const focused=document.activeElement;
    if(focused) { resumeFocus=focused; selection=typeof focused.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null; }
  }
  function start(state='reauth') {
    if(separate)return;
    if(!reauthRequired)remember();
    reauthRequired=true; render(state); O.open(dialog, state==='reauth-other-confirm'?$('#stay-manager'):other?manager:secret.disabled ? $('#other-manager') : secret);
  }
  const wait=seconds=>[seconds>=60?Math.floor(seconds/60)+' min':'',seconds%60?seconds%60+' s':''].filter(Boolean).join(' ');
  function message(node,title,body) {
    const heading=document.createElement('strong');heading.textContent=title;
    node.replaceChildren(heading,document.createElement('br'),document.createTextNode(body));
  }
  function logoutCooldown() {
    const left=reauthRequired&&!other?remaining(idled):0;
    $('#logout-cooldown').hidden=!left;
    $('#logout-cooldown').textContent=left?'This username is locked for '+wait(left)+'. Logging out does not end its cooldown. Other managers can sign in with their own usernames. Waiting here keeps your draft.':'';
  }
  function cooldown() {
    const left=remaining();
    if(other)message($('#cooldown'),'This username is locked for '+wait(left),'This username is cooling down. Other managers can sign in with their own usernames.');
    else $('#cooldown').textContent='This username is cooling down. Try again in '+wait(left)+'. You can sign in as a different manager or log out.';
    logoutCooldown();
    if(!left) { clearInterval(timer); account().failures=0; if(dialog.open){render(other?'reauth-other':'reauth');secret.focus();} }
  }
  function render(state) {
    O.setState(state); clearInterval(timer);
    const confirmation=state==='reauth-other-confirm';
    const wasOther=other;other=state.startsWith('reauth-other')&&!confirmation;
    manager.value=other?(wasOther?manager.value:''):idled;
    manager.readOnly=!other;
    const pending=state.endsWith('-verifying'), locked=state.endsWith('-throttled');
    manager.disabled=pending;
    $('#reauth-title').textContent=confirmation?'Sign in as a different manager?':other?'Sign in as a different manager':'Your session timed out';
    $('#reauth-description').textContent=confirmation?'The current manager’s unsaved changes will not be available to the manager signing in.':other?'Enter your own username and password. The current manager’s unsaved changes will not be available to you.':'Your unsaved changes are kept. Continue as m.iqbal to resume them.';
    $('#credential-fields').hidden=confirmation;
    $('#other-manager').hidden=other||confirmation;$('#other-manager').disabled=pending;
    $('#back-manager').hidden=!other;$('#back-manager').disabled=pending;
    $('#stay-manager').hidden=!confirmation;$('#choose-manager').hidden=!confirmation;
    $('#reauth-logout').hidden=confirmation;$('#reauth-logout').disabled=pending;
    $('#continue').hidden=confirmation;
    secret.disabled=pending||locked||confirmation; $('#continue').disabled=pending||locked||confirmation;
    $('#queue-incidents').disabled=pending;
    $('#continue').textContent=other?(pending?'Signing in…':'Sign in'):pending?'Verifying…':'Continue';
    $('#verify-form').setAttribute('aria-busy',String(pending));
    $('#verify-result').disabled=pending||locked;
    $('#reauth-alert').hidden=!(O.kitchen||state==='reauth-kitchen');
    $('#cooldown').hidden=!locked;
    const error=state.endsWith('-error');
    secret.setAttribute('aria-invalid',String(error));
    $('#credential-message').textContent=error?credentialCopy.wrong:'';
    if(error&&other)message($('#credential-message'),'Sign-in failed','Check your username and password, then try again.');
    if(error) { secret.value=''; secret.focus(); }
    if(locked) { secret.value=''; cooldown(); $('#cooldown-announcement').textContent=$('#cooldown').textContent; if(remaining())timer=setInterval(cooldown,1000); }
    else $('#cooldown-announcement').textContent='';
  }
  function resume() {
    clearInterval(timer);secret.value='';account().failures=0;reauthRequired=false;
    const restoredFocus=resumeFocus, restoredSelection=selection;
    O.close(dialog,restoredFocus);
    if(restoredFocus.setSelectionRange && restoredSelection)restoredFocus.setSelectionRange(...restoredSelection);
    selection=restoredSelection;
    O.setState('resumed');$('#resume-status').hidden=false;
    if(queued) { queued=false; askLogoutOrLeave('incidents'); }
  }
  function separateArea() {
    clearInterval(timer);secret.value='';reauthRequired=false;separate=true;
    if(dialog.open)dialog.close();
    // Hide the old work without deciding whether its storage is retained or destroyed.
    [...$('#office-content').children].forEach(e=>e.hidden=true);
    [...$('.bonav').children].forEach(e=>e.hidden=true);
    $('.office-day').hidden=true;O.emergency.hidden=true;
    const receipt=$('.office-receipt');if(receipt)receipt.hidden=true;
    $('.office-title').textContent='Back office';$('.office-actor').textContent='R. Ayu · Manager';
    O.setState('other-signed-in');O.logout.focus();
  }
  function askLogoutOrLeave(destination='logout', href) {
    departureState=document.documentElement.dataset.state;departureFocus=document.activeElement;
    departure=href || (destination==='incidents'?O.incidents:O.logout.href);
    returnToReauth=dialog.open;
    $('#logout-title').textContent=destination==='incidents'?'Leave this draft to open print incidents?':destination==='navigation'?'Discard this draft before leaving?':'Log out and discard your changes?';
    $('#logout-description').textContent=destination==='incidents'?'Your session has resumed. Opening print incidents will discard this fixture’s unsaved changes. Keep the draft to return to it.':'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.';
    $('#confirm-logout').textContent=destination==='incidents'?'Discard changes and open incidents':destination==='navigation'?'Discard changes and leave':'Discard changes and log out';
    $('#confirm-logout').href=departure;
    if(destination==='navigation')$('#logout-description').textContent='Your unsaved changes will be lost when you leave this draft. Keep the draft to continue editing.';
    logoutCooldown();
    if(!$('#reauth-alert').hidden && !logout.querySelector('.office-emergency')){const alert=$('#reauth-alert').cloneNode(true);alert.removeAttribute('id');alert.querySelector('button').remove();alert.querySelector('p:last-child').textContent='The kitchen still needs attention while you decide whether to keep this draft.';logout.querySelector('header').after(alert);}
    if(dialog.open)dialog.close();
    O.open(logout,$('#keep-session'));O.setState(returnToReauth?'reauth-logout':'unsaved');
  }
  dialog.addEventListener('cancel',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog.open){e.preventDefault();e.stopImmediatePropagation();}},true);
  dialog.addEventListener('close',()=>{if(reauthRequired&&!logout.open&&!dialog.open)O.open(dialog,secret.disabled?$('#reauth-logout'):secret);});
  logout.addEventListener('cancel',e=>{e.preventDefault();$('#keep-session').click();});
  logout.addEventListener('close',()=>{if(reauthRequired&&!logout.open&&!dialog.open)O.open(dialog,secret.disabled?$('#other-manager'):secret);});
  $('#idle').onclick=()=>start();
  document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='i'&&!dialog.open&&!logout.open){e.preventDefault();start();}});
  $('#verify-form').onsubmit=e=>{
    e.preventDefault(); if($('#continue').disabled)return;
    if(other&&!manager.value){$('#credential-message').textContent='Enter your username.';manager.focus();return;}
    if(!secret.value){$('#credential-message').textContent=credentialCopy.missing;secret.setAttribute('aria-invalid','true');secret.focus();return;}
    if(secret.value.length>1024||other&&manager.value.length>256){const oversized=other&&manager.value.length>256?manager:secret;render(other?'reauth-other-error':'reauth-error');oversized.focus();return;}
    const result=$('#verify-result').value;render(other?'reauth-other-verifying':'reauth-verifying');
    verifyingTimer=setTimeout(()=>{
      if(!dialog.open)return;
      if(result==='resumed'){if(other)separateArea();else resume();}
      else { account().failures++;if(account().failures>=5)account().expires=Date.now()+300000;render((other?'reauth-other':'reauth')+(remaining()?'-throttled':'-error')); if(!secret.disabled)secret.focus(); }
    },650);
  };
  $('#other-manager').onclick=()=>{priorState=document.documentElement.dataset.state;secret.value='';render('reauth-other-confirm');$('#stay-manager').focus();};
  $('#stay-manager').onclick=()=>{render(remaining()?'reauth-throttled':priorState==='reauth-throttled'?'reauth':priorState);$('#other-manager').focus();};
  $('#choose-manager').onclick=()=>{render('reauth-other');if(remaining())render('reauth-other-throttled');manager.focus();};
  $('#back-manager').onclick=()=>{manager.value='';secret.value='';render('reauth');if(remaining())render('reauth-throttled');(secret.disabled?$('#other-manager'):secret).focus();};
  manager.oninput=()=>{if(!other)return;secret.value='';render(remaining()?'reauth-other-throttled':'reauth-other');};
  $('#reauth-logout').onclick=()=>{clearTimeout(verifyingTimer);askLogoutOrLeave();};
  O.logout.addEventListener('click',e=>{if(separate)return;e.preventDefault();askLogoutOrLeave();});
  document.addEventListener('click',e=>{const a=e.target.closest('.bo a');if(a&&a!==O.logout){e.preventDefault();askLogoutOrLeave('navigation',a.href);}});
  $('#keep-session').onclick=()=>{logout.close();if(returnToReauth){start(remaining()?(other?'reauth-other-throttled':'reauth-throttled'):departureState.endsWith('-throttled')||departureState.endsWith('-verifying')?(other?'reauth-other':'reauth'):departureState);}else{O.setState(departureState);departureFocus?.focus({preventScroll:true});}};
  $('#queue-incidents').onclick=()=>{queued=true;$('#queue-incidents').textContent='Print incidents will open after sign-in';secret.focus();};
  $('#confirm-logout').onclick=()=>{reauthRequired=false;$('#draft').reset();};
  const initial=document.documentElement.dataset.state;
  if(initial.endsWith('-throttled'))accounts.set(initial==='reauth-other-throttled'?'r.ayu':idled,{failures:0,expires:Date.now()+300000});
  if(initial.startsWith('reauth')) {
    resumeFocus.focus();resumeFocus.setSelectionRange(...selection);
    const sampleOther=['reauth-other-error','reauth-other-throttled','reauth-other-verifying'].includes(initial);
    start(sampleOther?'reauth-other':initial==='reauth-logout'?'reauth':initial);
    // Response-state deep links simulate a typed sample, never a form-opening default.
    if(sampleOther){manager.value='r.ayu';render(initial);manager.focus();}
    if(initial==='reauth-logout')askLogoutOrLeave();
  }else if(initial==='other-signed-in')separateArea();
  else if(initial==='resumed'){resumeFocus.focus();resumeFocus.setSelectionRange(...selection);$('#resume-status').hidden=false;}
  else if(initial==='unsaved'){O.setState('none');askLogoutOrLeave('navigation','patterns.html');}
})();
