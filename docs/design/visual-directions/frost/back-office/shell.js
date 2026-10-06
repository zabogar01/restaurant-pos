/* M-6 local fixture. All credential-dependent copy is collected here for Q4. */
(() => {
  const credentialCopy = {
    label: 'Password',
    wrong: 'Incorrect password. Try again.',
    missing: 'Enter your password.',
    other: 'This password belongs to another manager. Log out to switch.'
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
  let resumeFocus=$('#draft-limit'), selection=[0,6], failures=0, expires=0, timer, verifyingTimer, returnToReauth=false, queued=false;
  $('#credential-label').textContent=credentialCopy.label;
  $('#scroll-samples').innerHTML=Array.from({length:24},(_,i)=>'<p>Sample '+(i+1)+' · Edited values stay in the form while this content scrolls.</p>').join('');
  function remember() {
    const focused=document.activeElement;
    if(focused && focused.closest('#draft')) { resumeFocus=focused; selection=[focused.selectionStart,focused.selectionEnd]; }
  }
  document.addEventListener('focusin',remember);
  function start(state='reauth') {
    remember(); render(state); O.open(dialog, secret.disabled ? $('#reauth-logout') : secret);
  }
  function cooldown() {
    const left=Math.max(0,Math.ceil((expires-Date.now())/1000));
    $('#cooldown').textContent='Five attempts failed. Try again in '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+'. Log out is still available.';
    if(!left) { clearInterval(timer); render('reauth'); secret.focus(); }
  }
  function render(state) {
    O.setState(state); clearInterval(timer);
    const pending=state==='reauth-verifying', locked=state==='reauth-throttled';
    secret.disabled=pending||locked; $('#continue').disabled=pending||locked;
    $('#continue').textContent=pending?'Verifying…':'Continue';
    $('#verify-form').setAttribute('aria-busy',String(pending));
    $('#verify-result').disabled=pending||locked;
    $('#reauth-alert').hidden=!(O.kitchen||state==='reauth-kitchen');
    $('#cooldown').hidden=!locked;
    const error=state==='reauth-error'||state==='reauth-other';
    secret.setAttribute('aria-invalid',String(error));
    $('#credential-message').textContent=state==='reauth-error'?credentialCopy.wrong:state==='reauth-other'?credentialCopy.other:'';
    if(error) { secret.value=''; secret.focus(); }
    if(locked) { secret.value=''; if(expires<=Date.now())expires=Date.now()+300000; cooldown(); timer=setInterval(cooldown,1000); }
  }
  function resume() {
    clearInterval(timer);secret.value='';failures=0;
    const restoredFocus=resumeFocus, restoredSelection=[...selection];
    O.close(dialog,restoredFocus);
    if(restoredFocus.setSelectionRange && restoredSelection[0]!==null)restoredFocus.setSelectionRange(...restoredSelection);
    selection=restoredSelection;
    O.setState('resumed');$('#resume-status').hidden=false;
    if(queued) { queued=false; askLogoutOrLeave('incidents'); }
  }
  function askLogoutOrLeave(destination='logout', href) {
    departure=href || (destination==='incidents'?O.incidents:O.logout.href);
    returnToReauth=dialog.open;
    $('#logout-title').textContent=destination==='incidents'?'Leave this draft to open print incidents?':destination==='navigation'?'Discard this draft before leaving?':'Log out and discard your changes?';
    $('#logout-description').textContent=destination==='incidents'?'Your session has resumed. Opening print incidents will discard this fixture’s unsaved changes. Keep the draft to return to it.':'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.';
    $('#confirm-logout').textContent=destination==='incidents'?'Discard changes and open incidents':destination==='navigation'?'Discard changes and leave':'Discard changes and log out';
    $('#confirm-logout').href=departure;
    if(destination==='navigation')$('#logout-description').textContent='Your unsaved changes will be lost when you leave this draft. Keep the draft to continue editing.';
    if(!$('#reauth-alert').hidden && !logout.querySelector('.office-emergency')){const alert=$('#reauth-alert').cloneNode(true);alert.removeAttribute('id');alert.querySelector('button').remove();alert.querySelector('p:last-child').textContent='The kitchen still needs attention while you decide whether to keep this draft.';logout.querySelector('header').after(alert);}
    if(dialog.open)dialog.close();
    O.open(logout,$('#keep-session'));O.setState('reauth-logout');
  }
  dialog.addEventListener('cancel',e=>e.preventDefault());
  logout.addEventListener('cancel',e=>{e.preventDefault();$('#keep-session').click();});
  $('#idle').onclick=()=>start();
  document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='i'&&!dialog.open&&!logout.open){e.preventDefault();start();}});
  $('#verify-form').onsubmit=e=>{
    e.preventDefault(); if($('#continue').disabled)return;
    if(!secret.value){$('#credential-message').textContent=credentialCopy.missing;secret.setAttribute('aria-invalid','true');secret.focus();return;}
    const result=$('#verify-result').value;render('reauth-verifying');
    verifyingTimer=setTimeout(()=>{
      if(!dialog.open)return;
      if(result==='resumed')resume();
      else { failures++;render(failures>=5?'reauth-throttled':result); if(!secret.disabled)secret.focus(); }
    },650);
  };
  $('#reauth-logout').onclick=()=>{clearTimeout(verifyingTimer);askLogoutOrLeave();};
  O.logout.addEventListener('click',e=>{e.preventDefault();askLogoutOrLeave();});
  document.addEventListener('click',e=>{const a=e.target.closest('.bo a');if(a&&a!==O.logout){e.preventDefault();askLogoutOrLeave('navigation',a.href);}});
  $('#keep-session').onclick=()=>{logout.close();if(returnToReauth){start(expires>Date.now()?'reauth-throttled':'reauth');}else{O.setState('resumed');resumeFocus.focus();}};
  $('#queue-incidents').onclick=()=>{queued=true;$('#queue-incidents').textContent='Print incidents will open after sign-in';secret.focus();};
  $('#confirm-logout').onclick=()=>{$('#draft').reset();};
  const initial=document.documentElement.dataset.state;
  if(initial.startsWith('reauth')) {
    resumeFocus.focus();resumeFocus.setSelectionRange(...selection);
    start(initial==='reauth-logout'?'reauth':initial);
    if(initial==='reauth-logout')askLogoutOrLeave();
  }else if(initial==='resumed'){resumeFocus.focus();resumeFocus.setSelectionRange(...selection);$('#resume-status').hidden=false;}
})();
