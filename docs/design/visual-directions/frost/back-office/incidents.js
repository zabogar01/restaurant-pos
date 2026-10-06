/* BO-13 synthetic incident/read responses. No print service, audit write or order command. */
(() => {
  const $=s=>document.querySelector(s), O=window.Office, params=new URLSearchParams(location.search);
  const state=document.documentElement.dataset.state;
  const catalog=[
    {id:'ticket-1',kind:'kitchen',order:'Table 1',round:2,time:'19:58',lines:['1 × Burger','1 × Fries'],delivery:'FAILED'},
    {id:'cancel-1',kind:'cancel',order:'Table 1',round:2,time:'20:02',lines:['1 × Burger'],delivery:'UNKNOWN'},
    {id:'receipt-1',kind:'receipt',order:'Table 1',time:'20:14',amount:'155.925',delivery:'FAILED'}
  ];
  for(let i=0;i<18;i++){
    const kind=['kitchen','cancel','receipt'][i%3],n=i+2;
    catalog.push({id:kind+'-'+n,kind,order:i%4===0?'Quick sale '+n:'Table '+n,round:1,time:'20:'+String(15+i).padStart(2,'0'),lines:kind==='cancel'?['1 × Grilled chicken']:['2 × Grilled chicken with rice','1 × Iced tea'],amount:'100.000',delivery:i%2?'UNKNOWN':'FAILED'});
  }
  let rows=catalog.slice(0,3).map(r=>({...r}));
  const resultCopy={
    pending:['reprint is being sent…','Waiting for the request outcome.'],
    sent:['reprint sent.','Delivery is not yet confirmed.'],
    failed:['reprint failed again.','Check the printer before trying again.'],
    unknown:['reprint outcome unknown.','It may already have printed. Reading delivery status before saying more; no second print request is sent.'],
    printed:['— server confirmed PRINTED at 20:41.','']
  };
  const ticketName=r=>r.kind==='cancel'?'Cancellation ticket':r.kind==='receipt'?'Receipt':'Kitchen ticket';
  const subject=r=>ticketName(r)+' · '+r.order+(r.round?', round '+r.round:'')+' · '+r.time;
  const button=(label,run,small=false)=>{const b=document.createElement('button');b.type='button';b.className='office-button'+(small?' small':'');b.textContent=label;b.onclick=run;return b;};
  const text=(tag,value,cls='')=>{const el=document.createElement(tag);el.textContent=value;el.className=cls;return el;};
  const parseMap=key=>Object.fromEntries((params.get(key)||'').split(',').filter(Boolean).map(x=>x.split(':')));
  if(state==='overflow')rows=catalog.map(r=>({...r}));
  const single=state.match(/^(kitchen|cancel|receipt)-(failed|unknown)$/);
  if(single)rows=rows.filter(r=>r.kind===single[1]).map(r=>({...r,delivery:single[2].toUpperCase()}));
  if(state==='empty')rows=[];
  if(params.has('incidentIds'))rows=params.get('incidentIds').split(',').filter(Boolean).map(id=>catalog.find(r=>r.id===id)).filter(Boolean).map(r=>({...r}));
  else if(params.has('alerts')){
    const mode=params.get('alerts');
    rows=mode==='none'?[]:catalog.slice(0,3).filter(r=>r.kind==='kitchen'?(mode==='both'||mode==='kitchen'):r.kind==='receipt'?(mode==='both'||mode==='receipt'):false).map(r=>({...r}));
  }
  const deliveryMap=parseMap('incidentDelivery'),resultsMap=parseMap('incidentResults');
  rows.forEach(r=>{if(deliveryMap[r.id])r.delivery=deliveryMap[r.id];if(resultsMap[r.id])r.result=resultsMap[r.id];});
  const direct=state.match(/^(kitchen|cancel|receipt)-reprint-(pending|sent|failed|unknown|printed)$/);
  if(direct&&!params.has('incidentIds')){const r=rows.find(r=>r.kind===direct[1]);r.result=direct[2];if(['failed','unknown','printed'].includes(r.result))r.delivery=r.result==='failed'?'FAILED':r.result==='unknown'?'UNKNOWN':'PRINTED';}
  if(state.endsWith('-checked')){const r=rows.find(r=>r.kind===state.split('-')[0]);if(r)r.checked=true;}
  function announce(message){$('#incident-status').textContent=message;$('#incident-status').hidden=false;}
  function readState(value) {
    const box=$('#read-status');box.replaceChildren();box.hidden=false;box.className=value==='empty'?'office-empty':'office-notice';
    box.append(text('strong',value==='empty'?'Nothing outstanding':value==='loading'?'Reading print incidents…':'Could not read print incidents'));
    box.append(text('p',value==='empty'?'No unresolved print incidents.':value==='loading'?'The incident list is being read.':'The current list is unavailable. Check the printers and try again.'));
    if(value==='error')box.append(button('Try again',()=>{O.setState('loading');readState('loading');setTimeout(()=>{O.setState('default');render();},650);}));
  }
  function remove(r,elsewhere=false) {
    if(!elsewhere&&r.kind!=='receipt'&&!r.checked)return;
    rows=rows.filter(x=>x.id!==r.id);
    announce(subject(r)+(elsewhere?' was cleared on the POS.':r.kind==='receipt'?' warning dismissed.':' incident cleared.'));
    render();$('#incident-status').tabIndex=-1;$('#incident-status').focus({preventScroll:true});
  }
  function reread(r) {
    if(!rows.includes(r))return;
    r.reading=true;renderRow(r);
    setTimeout(()=>{if(!rows.includes(r))return;r.reading=false;r.result='printed';r.delivery='PRINTED';renderRow(r);O.setIncidents(rows);},650);
  }
  function reprint(r) {
    if(['pending','sent','unknown','printed'].includes(r.result))return;
    const response=$('#reprint-response').value;
    r.result='pending';r.checked=false;renderRow(r);O.setIncidents(rows);
    setTimeout(()=>{
      if(!rows.includes(r))return;
      r.result=response;
      if(['failed','unknown','printed'].includes(response))r.delivery=response==='failed'?'FAILED':response==='unknown'?'UNKNOWN':'PRINTED';
      renderRow(r);O.setIncidents(rows);
      if(response==='unknown')setTimeout(()=>reread(r),1400);
    },650);
  }
  function renderRow(r) {
    const old=document.querySelector('[data-incident="'+r.id+'"]'),tr=document.createElement('tr');tr.dataset.incident=r.id;tr.dataset.kind=r.kind;
    const receipt=r.kind==='receipt';
    const what=document.createElement('td');what.append(text('strong',receipt?r.order:ticketName(r),'incident-subject'));
    if(!receipt)what.append(text('span',r.order,'incident-meta'));
    if(r.kind==='cancel')what.append(text('span','Stop the cancelled work.','incident-meta'));
    const when=document.createElement('td');
    if(!receipt)when.append(text('span','Round '+r.round));
    when.append(text('span',r.time+' WIB','incident-meta incident-time'));
    const contents=document.createElement('td');
    if(receipt){contents.className='num';contents.textContent=r.amount;}
    else {const ul=document.createElement('ul');ul.className='incident-lines';r.lines.forEach(line=>ul.append(text('li',line)));contents.append(ul);}
    const delivery=document.createElement('td');delivery.append(text('strong',r.result==='pending'?'Sending…':r.result==='sent'?'Awaiting result':r.delivery));
    delivery.append(text('span',r.result==='pending'?'Waiting for the request outcome.':r.result==='sent'?'Reprint sent; delivery is not confirmed.':r.delivery==='UNKNOWN'?'May already have printed. Check the printer before reprinting.':r.delivery==='PRINTED'?'Confirmed by the server.':'Did not print.','incident-meta'));
    const recovery=document.createElement('td'),actions=document.createElement('div');actions.className='office-actions';
    const label=receipt?'Reprint receipt':r.kind==='cancel'?'Reprint cancellation':'Reprint ticket';
    const resend=button(label,()=>reprint(r),receipt);resend.dataset.reprint=r.id;resend.setAttribute('aria-label',label+': '+r.order+(r.round?', round '+r.round:'')+' · '+r.time);
    resend.disabled=['pending','sent','unknown','printed'].includes(r.result);actions.append(resend);
    if(receipt){const dismiss=button('Dismiss',()=>remove(r),true);dismiss.dataset.dismiss=r.id;dismiss.setAttribute('aria-label','Dismiss receipt warning: '+r.order+' · '+r.time);actions.append(dismiss);}
    recovery.append(actions);
    if(r.result){
      const box=document.createElement('div');box.className='office-notice incident-result';box.dataset.result=r.id;box.setAttribute('role','status');
      box.append(text('strong',ticketName(r)+' '+resultCopy[r.result][0]));
      const copy=r.reading?'Reading delivery status…':resultCopy[r.result][1]+(receipt?' The order remains closed.':' Check the kitchen has this '+(r.kind==='cancel'?'cancellation':'ticket')+' before clearing.');
      box.append(text('p',copy));
      if(['sent','unknown','pending'].includes(r.result)){const check=button('Check delivery status',()=>reread(r),receipt);check.dataset.check=r.id;check.disabled=!!r.reading;box.append(check);}
      recovery.append(box);
    }
    if(!receipt){
      const clearance=document.createElement('div');clearance.className='incident-recovery';
      const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=!!r.checked;input.dataset.checked=r.id;
      label.append(input,document.createTextNode('I checked: the kitchen has this '+(r.kind==='cancel'?'cancellation.':'ticket.')));
      const clear=button('Clear',()=>remove(r));clear.dataset.clear=r.id;clear.disabled=!r.checked;clear.setAttribute('aria-label','Clear '+ticketName(r).toLowerCase()+': '+r.order+', round '+r.round+' · '+r.time);
      input.onchange=()=>{r.checked=input.checked;clear.disabled=!r.checked;};clearance.append(label,clear);recovery.append(clearance);
    }
    tr.append(what,when,contents,delivery,recovery);
    if(old){const active=document.activeElement;const key=active?.dataset?.reprint?'reprint':active?.dataset?.check?'check':null;old.replaceWith(tr);if(key){const next=tr.querySelector('[data-'+key+']');if(!next.disabled)next.focus({preventScroll:true});else{const box=tr.querySelector('[data-result]');box.tabIndex=-1;box.focus({preventScroll:true});}}}
    else $(receipt?'#receipt-rows':'#urgent-rows').append(tr);
  }
  function render() {
    $('#read-status').hidden=true;$('#urgent-rows').replaceChildren();$('#receipt-rows').replaceChildren();
    const ordered=[...rows].sort((a,b)=>['kitchen','cancel','receipt'].indexOf(a.kind)-['kitchen','cancel','receipt'].indexOf(b.kind));
    ordered.forEach(renderRow);O.setIncidents(ordered);
    $('#urgent-section').hidden=!rows.some(r=>r.kind!=='receipt');$('#receipt-section').hidden=!rows.some(r=>r.kind==='receipt');
    $('#resolve-pos').disabled=!rows.some(r=>r.id==='ticket-1');
    if(!rows.length)readState('empty');
  }
  $('#resolve-pos').onclick=()=>{const r=rows.find(r=>r.id==='ticket-1');if(r)remove(r,true);};
  if(['loading','error'].includes(state))readState(state);
  else {render();if(state==='cleared-elsewhere'){const r=rows.find(r=>r.id==='ticket-1');if(r)remove(r,true);}}
})();
