/* DESIGN-015 drawing only: counts masked positions, never stores a PIN or sends a request. */
(() => {
  const state=document.documentElement.dataset.state;
  const keys=[...document.querySelectorAll('.keypad button')];
  const confirm=document.querySelector('[data-confirm]');
  const blocked=state==='throttled'||state==='loading';
  let length=state==='short-pin'?3:state==='ready'||state==='loading'?6:0;
  const paint=()=>{
    document.querySelectorAll('.pindot').forEach((dot,i)=>dot.classList.toggle('pindot--on',i<length));
    document.querySelector('.pindots').setAttribute('aria-label',length+' of 6 digits entered');
    keys.forEach(key=>{key.disabled=blocked;});
    confirm.disabled=blocked||length!==6;
    keys.forEach(key=>{
      key.style.color=key.disabled?'var(--ink4)':key===confirm?'var(--bg)':'var(--ink)';
      key.style.background=key.disabled?'var(--unavailable, var(--bg3))':key===confirm?'var(--ink)':'';
      key.style.borderStyle=key.disabled?'dashed':'solid';
    });
  };
  const change=delta=>{
    if(blocked)return;
    length=Math.max(0,Math.min(6,length+delta));
    document.querySelector('[data-when="error"]').hidden=true;
    paint();
  };
  keys.forEach(key=>{key.onclick=()=>{
    if(key===confirm){if(!confirm.disabled)location.href=state==='draft'?'settlement.html?state=reauth':state==='incident'?'incidents.html':'floor.html';}
    else change(key.hasAttribute('data-delete')?-1:1);
  };});
  document.addEventListener('keydown',event=>{
    if(event.target.closest('a, input, select, textarea, [data-retry]'))return;
    if(/^[0-9]$/.test(event.key)){event.preventDefault();change(1);}
    if(event.key==='Backspace'){event.preventDefault();change(-1);}
    if(event.key==='Enter'){event.preventDefault();if(!confirm.disabled)confirm.click();}
  });
  document.querySelectorAll('[data-retry]').forEach(button=>{button.onclick=()=>{
    button.closest('.notice').hidden=true;length=0;paint();keys[0].focus();
  };});
  paint();
})();
