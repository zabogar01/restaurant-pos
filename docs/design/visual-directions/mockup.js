/* Wireframe runtime. Renders prototype chrome and switches screen states from
   the query string. No application logic, no data, no arithmetic. */
(function () {
  var WF = window.WF || {};
  var states = WF.states || [['default', 'Default']];
  var params = new URLSearchParams(window.location.search);
  var active = params.get('state');
  if (!active || !states.some(function (s) { return s[0] === active; })) active = states[0][0];

  document.documentElement.setAttribute('data-state', active);

  /* Second axis: `gone` names one order line that has just been removed.
     It exists so that a per-line remove control can actually remove the line
     it sits on without inventing a whole screen state per line — the state
     vocabulary stays a list of behaviours, not a list of outcomes.
     `data-line="soda"`  hides the element once gone matches it.
     `data-gone="soda"`  shows the element only when gone matches it,
                         which is how each removal gets its own totals. */
  var gone = params.get('gone') || '';
  /* NB: not `data-gone` — the root element would then match the
     `[data-gone]` selector below and hide the entire page. */
  document.documentElement.setAttribute('data-removed-line', gone);

  function has(el, attr) {
    var v = el.getAttribute(attr);
    return v !== null && v.split(/\s+/).indexOf(active) !== -1;
  }
  function hasGone(el, attr) {
    var v = el.getAttribute(attr);
    return v !== null && gone !== '' && v.split(/\s+/).indexOf(gone) !== -1;
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-when]'), function (el) {
    if (!has(el, 'data-when')) el.hidden = true;
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-unless]'), function (el) {
    if (has(el, 'data-unless')) el.hidden = true;
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-line]'), function (el) {
    if (hasGone(el, 'data-line')) el.hidden = true;
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-gone]'), function (el) {
    if (!hasGone(el, 'data-gone')) el.hidden = true;
  });

  if (WF.nav) {
    var navlink = document.querySelector('[data-nav="' + WF.nav + '"]');
    if (navlink) navlink.setAttribute('aria-current', 'page');
  }

  var bar = document.querySelector('.wfbar');
  if (!bar) return;
  var target = WF.client === 'pos' ? '1280 x 800 - tablet landscape' : '1440 wide - desktop';
  var chips = states.map(function (s) {
    var cur = s[0] === active;
    return '<a class="wfchip" ' + (cur ? 'aria-current="true" ' : '') +
      'href="?state=' + encodeURIComponent(s[0]) + '">' + s[1] + '</a>';
  }).join('');
  bar.innerHTML =
    '<div class="wfbar__row">' +
      '<a href="../index.html">&larr; All screens</a>' +
      '<span class="wfbar__id">' + (WF.id || '') + '</span>' +
      '<span class="wfbar__name">' + (WF.name || '') + '</span>' +
      '<span class="wfbar__meta">' + target + '</span>' +
      '<span class="wfbar__meta">' + (WF.reqs || '') + '</span>' +
      (gone ? '<span class="wfbar__meta">line removed: ' + gone + '</span>' : '') +
    '</div>' +
    '<div class="wfbar__states">' + chips + '</div>';
})();

/* Presentation of existing fixtures only. No product state or services. */
(function () {
  const $ = (s) => [...document.querySelectorAll(s)];
  const icon = (path) => '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
  const arrow=icon('<path d="M5 12h14m-6-6 6 6-6 6"/>');
  const back=icon('<path d="M19 12H5m6-6-6 6 6 6"/>');
  const close=icon('<path d="m6 6 12 12M18 6 6 18"/>');
  const alert=icon('<path d="M12 6v8m0 4h.01"/>');
  $('.key').forEach(e=>{
    const t=e.textContent.trim();
    if(t==='▶'){e.innerHTML=arrow;e.setAttribute('aria-label','Continue');}
    if(t==='←'){e.innerHTML=back;e.setAttribute('aria-label','Delete last digit');}
  });
  $('.line__x:not(.line__x--empty)').forEach(e=>{e.innerHTML=close;e.setAttribute('aria-label',e.title || 'Remove pending line');});
  $('.emg__mark').forEach(e=>{e.innerHTML=alert;e.setAttribute('aria-hidden','true');});
  $('.btn').forEach(e=>{
    if (/^(Void order|Cancel payment|Remove line)$/.test(e.textContent.trim()))e.classList.add('btn--destructive');
    if(e.classList.contains('btn--off'))e.setAttribute('aria-disabled','true');
  });
  $('.roundhead').forEach(e=>{if(e.textContent.trim().startsWith('Pending'))e.classList.add('roundhead--pending');});
  $('.tile--off').forEach(e=>e.setAttribute('aria-disabled','true'));
  if(window.WF.id==='POS-03' && ['sheet-item','sheet-item86'].includes(document.documentElement.dataset.state)){
    const selected=document.querySelector('a.tile');if(selected) selected.classList.add('tile--selected');
  }
  if(window.WF.id==='POS-04'){
    $('.field').forEach(e=>{if(e.closest('.rowflex'))e.classList.add('amount-field');});
    $('.rowflex > .btn--primary').forEach(e=>{if(/^(Cash|Card)$/.test(e.textContent.trim()))e.classList.add('btn--selected');});
    const keys=document.querySelector('.pos__body .keypad');
    if(keys)keys.parentElement.classList.add('tender-body');
  }
  if(window.WF.id==='POS-07'){
    $('[style*="border:3px solid"]').forEach(e=>e.classList.add('incident--emergency'));
    $('[style*="border:1px solid var(--line);background:var(--bg2)"]').forEach(e=>e.classList.add('incident--warning'));
  }
  if(window.WF.id==='POS-01' && document.documentElement.dataset.state==='incident'){
    const pin=document.querySelector('.lock__box');
    pin.id='pin-entry';pin.setAttribute('tabindex','-1');
    const signIn=document.querySelector('.emg a');
    signIn.href='#pin-entry';signIn.addEventListener('click',()=>pin.focus());
    const next=document.querySelector('.keypad a.key:not([hidden])');
    if(next)next.href='incidents.html';
  }
  $('.modal').forEach((e,i)=>{
    e.setAttribute('role','dialog'); e.setAttribute('aria-modal','true');
    const h=e.querySelector('h2');if(h){h.id='dialog-title-'+i;e.setAttribute('aria-labelledby',h.id);}
  });
  // IDR is shown once per established monetary group; figures remain aligned.
  $('.totals .t--grand > span:first-child').forEach(e=>{e.textContent='Total · Rp';});
  if(window.WF.id==='BO-03')$('.dtable th').forEach(e=>{if(e.textContent.trim()==='Price')e.textContent='Price · Rp';});
  if(window.WF.id==='BO-11'){
    $('.botop b').forEach(e=>e.textContent+=' · IDR');
  }
})();
