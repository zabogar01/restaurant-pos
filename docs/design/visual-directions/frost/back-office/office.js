/* Shared presentation and local fixtures only: no authentication or printer service. */
(() => {
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const state = document.documentElement.dataset.state || 'none';
  const nav = $('.bonav');
  const routes = [
    ['Trading', [['Today','today.html','today'],['End of day','end-of-day.html','eod']]],
    ['History', [['Reports','reports.html','reports'],['Audit','audit.html','audit']]],
    ['Configuration', [['Menu','menu.html','menu'],['Tables','tables.html','tables'],['Staff','users.html','users'],['Discount presets','presets.html','presets'],['Settings','settings.html','settings']]],
    ['Hardware', [['Printing','incidents.html','incidents']]]
  ];
  if (!nav.children.length) {
    nav.innerHTML = '<div class="bonav__brand">Back office</div>';
    routes.forEach(([section, entries]) => {
      const heading = document.createElement('div');
      heading.className = 'bonav__sec'; heading.textContent = section; nav.append(heading);
      entries.forEach(([label, file, key]) => {
        const a = document.createElement('a'); a.textContent = label;
        a.href = key === 'menu' ? file : '../../../prototype/back-office/' + file;
        a.dataset.nav = key; nav.append(a);
      });
    });
  }
  const active = nav.querySelector(`[data-nav="${window.WF.nav}"]`);
  if (active) active.setAttribute('aria-current','page');
  const top = $('.botop');
  // Reuse authored logout destinations on existing pages, preserving their link ledger.
  const legacy = nav.querySelector('[href$="login.html"]');
  const logout = legacy || document.createElement('a');
  logout.href = legacy ? legacy.getAttribute('href') : '../../../prototype/back-office/login.html';
  logout.textContent = 'Log out'; logout.className = 'office-logout';
  const oldActor = legacy && legacy.parentElement;
  if (oldActor) oldActor.remove();
  top.insertAdjacentHTML('beforeend','<span class="office-day">Business day · Tue 6 Oct</span><span class="office-actor">M. Iqbal · Manager</span>');
  top.append(logout);
  const incidents = '../../../prototype/back-office/incidents.html';
  const kitchenIncident = {title:'Kitchen ticket did not print',identity:'1 failed ticket · Table 1, round 2 · Sent 19:58'};
  const alertMode = params.get('alerts') || (['none','kitchen','receipt','both'].includes(state) ? state : (state === 'reauth-kitchen' ? 'kitchen' : 'none'));
  const kitchen = alertMode === 'kitchen' || alertMode === 'both';
  const receipt = alertMode === 'receipt' || alertMode === 'both';
  const emergency = document.createElement('section');
  emergency.className = 'office-emergency'; emergency.hidden = !kitchen;
  emergency.setAttribute('aria-label','Kitchen print emergency');
  emergency.innerHTML = '<div><strong>'+kitchenIncident.title+'</strong><p>'+kitchenIncident.identity+'</p></div><a class="office-button" href="'+incidents+'">Open print incidents</a>';
  top.after(emergency);
  if (receipt) {
    const chip = document.createElement('a'); chip.href = incidents;
    chip.className = 'office-button small office-receipt';
    chip.textContent = '1 receipt failed · Table 1 · 20:14';
    chip.setAttribute('aria-label', chip.textContent + ' — open print incidents');
    top.insertBefore(chip, $('.office-day'));
  }
  // URL-scoped incident fixtures survive navigation without contaminating other reviews.
  function decorate(a) {
    if (alertMode === 'none' || !a.href || !a.href.includes('.html') || a.href.includes('/index.html')) return;
    const u = new URL(a.href); u.searchParams.set('alerts',alertMode); a.href = u;
  }
  document.querySelectorAll('.bo a').forEach(decorate);
  document.addEventListener('click', e => { const a=e.target.closest('a'); if(a && a.closest('.bo')) decorate(a); }, true);

  let opener;
  function open(dialog, focus) {
    if (!dialog.open) { opener = document.activeElement; dialog.showModal(); }
    const body=dialog.querySelector('.office-dialog__body');
    if(body && body.scrollHeight>body.clientHeight){body.tabIndex=0;body.setAttribute('role','region');body.setAttribute('aria-labelledby',dialog.getAttribute('aria-labelledby'));}
    else if(body){body.removeAttribute('tabindex');body.removeAttribute('role');body.removeAttribute('aria-labelledby');}
    (focus || dialog.querySelector('button:not(:disabled), input:not(:disabled), [tabindex]'))?.focus();
  }
  function close(dialog, restore = opener) { dialog.close(); restore?.focus({preventScroll:true}); }
  document.addEventListener('keydown', e => {
    const d = document.querySelector('dialog[open]');
    if (!d || e.key !== 'Tab') return;
    const all = [...d.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex="0"]')].filter(x => !x.disabled && x.getClientRects().length);
    const first=all[0], last=all[all.length-1];
    if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); }
  });
  function setState(value) {
    document.documentElement.dataset.state=value;
    const u=new URL(location.href);u.searchParams.set('state',value);history.replaceState(null,'',u);
  }
  window.Office = {open,close,setState,kitchen,receipt,incidents,kitchenIncident,emergency,logout};
})();
