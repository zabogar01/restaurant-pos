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
