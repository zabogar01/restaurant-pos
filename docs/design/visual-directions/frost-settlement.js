/* DESIGN-006 Round 2: navigation between drawings, not payment or PIN logic.
   Run after mockup.js has selected the named state and hidden other rows. */
(function () {
  const state = document.documentElement.dataset.state;
  const params = new URLSearchParams(window.location.search);
  const url = (source, suffix = '') => 'settlement.html?state=' + encodeURIComponent(source) + suffix;
  const visible = element => !element.closest('[hidden]');
  const cardStates = ['card', 'cardsplit', 'cardover', 'error-keyed'];
  const selected = cardStates.includes(state) ? 'card' : 'cash';

  document.querySelectorAll('[data-method]').forEach(control => {
    const method = control.dataset.method;
    if (method === selected) {
      control.classList.add('btn--primary', 'btn--selected');
      control.setAttribute('aria-current', 'true');
      if (state === 'pressed') control.classList.add('is-pressed');
    } else if (state === 'empty' || state === 'card') {
      control.href = url(method === 'cash' ? 'empty' : 'card');
    } else {
      // No method variant is drawn for this exact order/draft/rejection.
      // An unavailable fixture choice must never reset that context.
      control.classList.add('btn--off');
      control.setAttribute('aria-disabled', 'true');
      const status = document.createElement('span');
      status.className = 'method-status';
      status.textContent = 'Not drawn';
      control.append(status);
    }
  });

  const cancelExamples = { cancel: 'exact', 'cancel-empty': 'empty', 'cancel-multi': 'exactsplit' };
  const source = cancelExamples[state] || state;
  document.querySelectorAll('[data-cancel-open]').forEach(control => {
    control.href = url(source, '&cancel=1');
  });
  const cancel = document.querySelector('[data-cancel-modal]');
  const canCancel = !['takeover', 'leaselost'].includes(state);
  if (canCancel && (params.get('cancel') === '1' || cancelExamples[state])) {
    // Preserve the actual source drawing under the modal, including its
    // totals, method, pending/rejection notice, draft lines and keyed amount.
    document.querySelectorAll('.pos > div').forEach(element => {
      if (element.querySelector('.modal') && element !== cancel) element.hidden = true;
    });
    cancel.hidden = false;
    const rows = [...document.querySelectorAll('.pos__body .listrow')].filter(visible);
    const list = cancel.querySelector('[data-cancel-drafts]');
    let count = 0;
    rows.forEach(row => {
      const cells = [...row.children].filter(element => element.tagName === 'SPAN' && visible(element));
      const label = cells[0].textContent.trim();
      if (label !== 'Change given') count++;
      const summary = document.createElement('div');
      summary.className = 'rowflex spread';
      cells.forEach(cell => summary.append(cell.cloneNode(true)));
      list.append(summary);
    });
    list.hidden = rows.length === 0;
    const countLine = cancel.querySelector('[data-cancel-count]');
    countLine.hidden = count === 0;
    countLine.textContent = count === 1 ? 'One drafted payment line will be discarded.' : count + ' drafted payment lines will be discarded.';
    cancel.querySelector('[data-cancel-return]').href = url(source);
  }

  if (state === 'takeover') {
    const acknowledged = params.get('ack') === '1';
    document.querySelector('[data-takeover-pin]').hidden = !acknowledged;
    document.querySelector('[data-takeover-ack]').hidden = acknowledged;
    document.querySelector('[data-takeover-confirmed]').hidden = !acknowledged;
  }
  // The selected overlay blocks mouse and keyboard access to its background.
  if ([...document.querySelectorAll('.modal')].some(visible)) {
    document.querySelector('.pos__bar').inert = true;
    document.querySelector('.pos__body').inert = true;
  }
})();
