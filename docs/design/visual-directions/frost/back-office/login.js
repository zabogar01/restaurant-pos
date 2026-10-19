/* DESIGN-016 local presentation only. No request, credential fixture or browser storage. */
(() => {
  const $=s=>document.querySelector(s), username=$('#username'), password=$('#password');
  const notice=$('#login-notice'), title=$('#notice-title'), body=$('#notice-body'), retry=$('#retry'), submit=$('#sign-in');
  const waits=new Map();
  const key=()=>username.value.trim().toLowerCase();
  const seconds=()=>Math.max(0,Math.ceil(((waits.get(key())||0)-Date.now())/1000));
  const duration=n=>[n>=60?Math.floor(n/60)+' min':'',n%60?n%60+' s':''].filter(Boolean).join(' ');
  let state=document.documentElement.dataset.state, timer, pending, announcedKey=null;
  const copy={
    error:['Sign-in failed','Check your username and password, then try again.'],
    'session-ended':['Your session has ended','Sign in again to continue.'],
    forbidden:['Manager access required','This account cannot use the back office. Sign in with a manager account.'],
    unavailable:['The system is unavailable','Wait a moment, then try again.'],
    unexpected:['Something went wrong','Try again. If the problem continues, ask a manager for help.']
  };
  function setState(next){state=next;document.documentElement.dataset.state=next;const u=new URL(location.href);u.searchParams.set('state',next);history.replaceState(null,'',u);}
  function tick(){
    const left=seconds();
    if(!left){clearInterval(timer);render('default',false);/* Do not steal focus while a username is being edited. */if(document.activeElement!==username)password.focus();return;}
    title.textContent='This username is locked for '+duration(left);
  }
  function render(next, focus=true){
    clearInterval(timer);setState(next);
    const loading=next==='loading', lookup=next.startsWith('lookup-'), locked=next==='throttled';
    const kind=next.startsWith('oversize-')?'error':next==='session-ended-draft'||next==='overflow'?'session-ended':lookup?next.slice(7):next;
    notice.hidden=!copy[kind]&&!locked;notice.removeAttribute('role');notice.removeAttribute('aria-live');
    $('#draft-note').hidden=!['session-ended-draft','overflow'].includes(next);
    title.textContent=copy[kind]?.[0]||'';body.textContent=copy[kind]?.[1]||'';
    if(!notice.hidden&&!locked)notice.setAttribute('role','alert');
    retry.hidden=!['unavailable','unexpected'].includes(kind);
    username.disabled=loading||lookup;password.disabled=loading||lookup||locked;submit.disabled=loading||lookup||locked;
    submit.textContent=loading?'Signing in…':'Sign in';$('#login-form').setAttribute('aria-busy',String(loading));
    for(const field of [username,password]){const invalid=next==='invalid-'+field.id;field.setAttribute('aria-invalid',String(invalid));$('#'+field.id+'-error').hidden=!invalid;}
    if(next!=='loading')password.value='';
    if(!locked){$('#lock-announcement').textContent='';announcedKey=null;}
    if(locked){
      body.textContent='This username is cooling down. Other managers can sign in with their own usernames.';
      notice.setAttribute('aria-live','off');tick();
      if(announcedKey!==key()){$('#lock-announcement').textContent=title.textContent+'. '+body.textContent;announcedKey=key();}
      timer=setInterval(tick,1000);
    }
    $('#simulate-response').disabled=loading||lookup;$('#login-response').disabled=loading||lookup;
    if(!focus)return;
    if(lookup)retry.focus();
    else if(['error','unavailable','unexpected','invalid-password','oversize-password'].includes(next))password.focus();
    else if(!loading)username.focus();
  }
  function response(result){
    password.value='';
    if(result==='success'){location.href='today.html?state=phase0';return;}
    if(result==='throttled')waits.set(key(),Date.now()+300000);
    render(result);
  }
  $('#login-form').onsubmit=e=>{
    e.preventDefault();if(submit.disabled)return;
    if(!username.value.trim()){render('invalid-username');return;}
    if(!password.value){render('invalid-password');return;}
    if(username.value.length>256){render('oversize-username');return;}
    if(password.value.length>1024){render('oversize-password');return;}
    const result=$('#login-response').value;render('loading',false);
    pending=setTimeout(()=>response(result),650);
  };
  username.addEventListener('input',()=>{
    if(username.disabled)return;
    // Compare account identities, retaining each deadline; never move focus on input.
    if(seconds())render('throttled',false);
    else if(state==='throttled')render('default',false);
    else if(state==='invalid-username'){username.setAttribute('aria-invalid','false');$('#username-error').hidden=true;}
  });
  retry.onclick=()=>{
    if(state.startsWith('lookup-')){retry.disabled=true;$('#login-form').setAttribute('aria-busy','true');pending=setTimeout(()=>{retry.disabled=false;render('default');},650);}
    else {render(seconds()?'throttled':'default',false);if(!password.disabled)password.focus();}
  };
  $('#simulate-response').onclick=()=>response($('#login-response').value);
  $('#finish-wait').onclick=()=>{waits.set(key(),0);if(state==='throttled')tick();};
  if(state==='throttled')waits.set(key(),Date.now()+281000);
  render(state);
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(pending);password.value='';});
})();
