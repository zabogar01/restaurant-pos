/* Read-only BO-12 fixture. No service, authentication or order commands. */
(() => {
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const initial = document.documentElement.dataset.state;
  const days = {'2026-10-07':'Wed 7 Oct 2026','2026-10-06':'Tue 6 Oct 2026','2026-10-05':'Mon 5 Oct 2026'};
  const people = {rina:'Rina Putri',iqbal:'M. Iqbal',sari:'Sari Wulandari',former:'Ratna Ayu Kartikasari Prameswari'};
  const actions = {refund:'Refund',void:'Whole-order void',line:'Fired-line void',apply:'Discount apply',replace:'Discount replace',remove:'Discount remove',takeover:'Checkout takeover',kitchen:'Kitchen-ticket reprint',cancellation:'Cancellation reprint'};
  const outcomes = {success:'Succeeded',failed:'Approval failed',cancelled:'Approval cancelled',refused:'Approved · refused',cooldown:'Approval request refused · cooldown'};
  const outcomeNotes = {success:'The action was completed.',failed:'Approval failed. The action was not performed.',cancelled:'Approval was cancelled. The action was not performed.',refused:'Approval succeeded, but the server refused the action. The order was unchanged.',cooldown:'The actor requested approval while manager approval was cooling down. The request was refused; the action was not performed.'};
  const money = n => new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(n);
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const records = [
    {id:'refund',occurredDate:'2026-10-07',time:'00:20',action:'refund',order:'T8-0610',place:'Table 8',reason:'The meal was returned after payment.',amounts:[['Charged',184800],['Refunded',184800],['Net',0]],note:'The original order total remains 184.800. This full refund reverses the charge.'},
    {id:'refused-refund',time:'00:06',action:'refund',outcome:'refused',order:'T3-0510',place:'Table 3',reason:'A duplicate meal was charged.',code:'BUSINESS_DAY_CLOSED',orderDay:'2026-10-05',refusal:'Business day closed after approval.',note:'The order’s business day closed after approval and before the refund could be committed.'},
    {id:'refused-void',time:'22:14',action:'void',outcome:'refused',order:'T6-0610',place:'Table 6',reason:'The guest left before the fired meal arrived.',code:'ORDER_NOT_OPEN',refusal:'Order settled after approval.',note:'Another client settled the order after approval and before this void could be committed.'},
    {id:'cooldown',time:'22:10',action:'refund',outcome:'cooldown',approver:null,order:'T9-0610',place:'Table 9',reason:'The guest returned the meal.'},
    {id:'failed',time:'22:08',action:'line',outcome:'failed',approver:null,order:'T2-0610',place:'Table 2',subject:'1 × Fries · Round 1',reason:'The wrong side was sent.'},
    {id:'cancelled',time:'22:06',action:'void',outcome:'cancelled',approver:null,order:'T5-0610',place:'Table 5',reason:'The guest requested cancellation.',note:'The approval prompt was abandoned.'},
    {id:'self',time:'21:42',action:'void',actor:'iqbal',order:'T12-0610',place:'Table 12',reason:'Duplicate order sent to the kitchen.',amounts:[['Order total before void',88000],['Void value',88000]]},
    {id:'void',time:'21:30',action:'void',order:'T7-0610',place:'Table 7',reason:'The guest left after the order was sent.',amounts:[['Order total before void',132000],['Void value',132000]]},
    {id:'remove',time:'21:12',action:'remove',order:'T10-0610',place:'Table 10',beforeDiscount:'Service recovery · Free-form · Fixed amount · 25.000',afterDiscount:'None',amounts:[['Order total before',175000],['Order total after',200000]]},
    {id:'replace',time:'21:10',action:'replace',order:'T10-0610',place:'Table 10',beforeDiscount:'Service recovery · Free-form · Percentage · 10%',afterDiscount:'Service recovery · Free-form · Fixed amount · 25.000',amounts:[['Order total before',180000],['Order total after',175000]]},
    {id:'apply',time:'21:08',action:'apply',order:'T10-0610',place:'Table 10',beforeDiscount:'None',afterDiscount:'Service recovery · Free-form · Percentage · 10%',amounts:[['Order total before',200000],['Order total after',180000]]},
    {id:'takeover',time:'20:30',action:'takeover',actor:'iqbal',approver:null,order:'Q18-0610',place:'Quick sale 18',subject:'Checkout lease',note:'M. Iqbal took over checkout. No money moved in this action.'},
    {id:'cancellation',time:'20:06',action:'cancellation',actor:'iqbal',approver:null,order:'T4-0610',place:'Table 4',subject:'Cancellation ticket · Round 2 · 1 × Burger',ticketTime:'Cancelled 20:02 WIB',note:'Back-office reprint of the cancellation ticket. The audit outcome does not confirm physical delivery.'},
    {id:'kitchen',time:'20:04',action:'kitchen',actor:'iqbal',approver:null,order:'T1-0610',place:'Table 1',subject:'Kitchen work ticket · Round 2 · 1 × Burger, 1 × Fries',ticketTime:'Sent 19:58 WIB',note:'Back-office reprint of the work ticket. The audit outcome does not confirm physical delivery.'},
    {id:'line',time:'20:02',action:'line',order:'T4-0610',place:'Table 4',subject:'1 × Burger · Round 2',reason:'The guest cancelled the burger.',amounts:[['Line snapshot · tax included',50000],['Order total before',155925],['Order total after',108675],['Order-total reduction',47250]],note:'A 10% order discount and 5% service charge apply. The cancelled line’s value and the order-total reduction are different.'},
    {id:'line-second',time:'20:00',action:'line',order:'T11-0610',place:'Table 11',subject:'1 × Iced tea · Round 1',reason:'The wrong drink was sent.',amounts:[['Line snapshot · tax included',20000],['Order total before',75600],['Order total after',56700],['Order-total reduction',18900]],note:'A 10% order discount and 5% service charge apply.'},
    {id:'preset',time:'19:45',action:'apply',actor:'sari',approver:null,order:'Q17-0610',place:'Quick sale 17',beforeDiscount:'None',afterDiscount:'Neighbour discount · Preset · Percentage · 5%',amounts:[['Order total before',100000],['Order total after',95000]]},
    {id:'long',time:'19:30',action:'void',actor:'former',order:'CATER-0610',place:'Catering order',reason:'The duplicated catering order was sent in error. The original booking remains separate.',amounts:[['Order total before void',999999999],['Void value',999999999]]}
  ].map(r=>({day:'2026-10-06',occurredDate:'2026-10-06',actor:'rina',approver:'iqbal',outcome:'success',...r}));
  // Distinct older orders make paging and combined filters observable, not self-links.
  for(let i=0;i<30;i++) records.push({id:'older-'+(i+1),day:i<22?'2026-10-06':'2026-10-05',occurredDate:i<22?'2026-10-06':'2026-10-05',time:(18-Math.floor(i/6)).toString().padStart(2,'0')+':'+(55-(i%6)*8).toString().padStart(2,'0'),actor:i%2?'rina':'sari',approver:null,outcome:'success',action:'apply',order:'Q'+(40+i)+'-'+(i<22?'0610':'0510'),place:'Quick sale '+(40+i),beforeDiscount:'None',afterDiscount:'Neighbour discount · Preset · Percentage · 5%',amounts:[['Order total before',100000+i*10000],['Order total after',(100000+i*10000)*95/100]]});
  records.sort((a,b)=>(b.occurredDate+'T'+b.time).localeCompare(a.occurredDate+'T'+a.time));
  const filters = {day:$('#filter-day'),action:$('#filter-action'),outcome:$('#filter-outcome'),person:$('#filter-person')};
  for(const [key,labels] of Object.entries({action:actions,outcome:outcomes,person:people})) {
    Object.entries(labels).forEach(([value,label])=>filters[key].add(new Option(label+(value==='former'?' · Deactivated':''),value)));
  }
  Object.entries(filters).forEach(([key,field])=>{const value=params.get(key);if(value&&[...field.options].some(o=>o.value===value))field.value=value;});
  if(initial==='nomatch'&&!params.has('action')){filters.action.value='refund';filters.person.value='former';}
  const pageSize=12;
  let page=Math.max(0,(Number.parseInt(params.get('page'),10)||1)-1);
  let readState=['empty','loading','error'].includes(initial)?initial:'ready';
  let listState=initial==='overflow'?'overflow':'default';
  let current,opener;
  function matches(){return records.filter(r=>(filters.day.value==='all'||r.day===filters.day.value)&&(filters.action.value==='all'||r.action===filters.action.value)&&(filters.outcome.value==='all'||r.outcome===filters.outcome.value)&&(filters.person.value==='all'||r.actor===filters.person.value||r.approver===filters.person.value));}
  function sync(state=current?'entry-'+current.id:listState){
    const u=new URL(location.href);u.searchParams.set('state',state);
    Object.entries(filters).forEach(([key,field])=>u.searchParams.set(key,field.value));
    u.searchParams.set('page',page+1);
    if(current)u.searchParams.set('entry',current.id);else u.searchParams.delete('entry');
    // Generated older rows use the registered default state plus an entry identity.
    if(current&&!WF.states.some(s=>s[0]===state))u.searchParams.set('state',listState);
    u.searchParams.set('list',listState);
    history.replaceState(null,'',u);document.documentElement.dataset.state=u.searchParams.get('state');
  }
  function person(key){return escape(people[key])+(key==='former'?'<small>Deactivated</small>':'');}
  function outcome(r){return '<span class="audit-outcome" data-outcome="'+r.outcome+'">'+outcomes[r.outcome]+'</span>';}
  function amounts(rows,summary=false){return rows.map(([label,value])=>summary?'<span>'+escape(label)+'</span><strong class="audit-money">'+money(value)+'</strong>':'<dt>'+escape(label)+'</dt><dd class="audit-money">'+money(value)+'</dd>').join('');}
  function summary(r){
    if(r.outcome!=='success')return r.code?escape(r.refusal)+'<small>REFUSED · '+escape(r.code)+' (illustrative)</small>':'Action not performed.';
    if(r.amounts)return '<div class="audit-summary-money">'+amounts(r.action==='line'?r.amounts.filter(([label])=>['Line snapshot · tax included','Order-total reduction'].includes(label)).map(([label,value])=>[label==='Line snapshot · tax included'?'Line value':'Order reduction',value]):r.amounts.map(([k,v])=>[k.replace('Order total before void','Before void').replace('Order total before','Before').replace('Order total after','After'),v]),true)+'</div>';
    return r.action==='takeover'?'Checkout lease taken over.':escape(r.subject)+'<small>'+escape(r.ticketTime)+'</small>';
  }
  function render(){
    const readable=readState==='ready';
    Object.values(filters).forEach(f=>f.disabled=!readable);$('#clear-filters').disabled=!readable;
    $('#audit-list').hidden=!readable;$('#audit-rows').replaceChildren();$('#page-label').textContent='';
    const status=$('#read-status');status.className='';status.replaceChildren();status.setAttribute('aria-busy',String(readState==='loading'));
    if(!readable){
      status.className=readState==='empty'?'office-empty':'office-notice';
      status.innerHTML=readState==='empty'?'<strong>No entries yet</strong><p>Recorded actions and approval outcomes will appear here.</p>':readState==='loading'?'<strong>Reading audit entries…</strong><p>Entries and counts will appear when the read completes.</p>':'<strong>Audit entries could not be read</strong><p>Try again to read the log.</p><button class="office-button office-small-space" id="retry">Try again</button>';
      return;
    }
    const rows=matches();page=Math.min(page,Math.max(0,Math.ceil(rows.length/pageSize)-1));
    if(!rows.length){$('#audit-list').hidden=true;status.className='office-empty';status.innerHTML='<strong>No entries match</strong><p>Change the filters or clear them to see the log.</p><button class="office-button" id="clear-empty">Clear filters</button>';return;}
    $('#page-label').textContent='Entries '+(page*pageSize+1)+'–'+Math.min((page+1)*pageSize,rows.length)+' of '+rows.length+' · Page '+(page+1)+' of '+Math.ceil(rows.length/pageSize);
    $('#newer').disabled=page===0;$('#older').disabled=(page+1)*pageSize>=rows.length;
    $('.audit-table').classList.toggle('audit-tight',listState==='overflow');
    $('#audit-rows').innerHTML=rows.slice(page*pageSize,(page+1)*pageSize).map(r=>'<tr data-entry="'+r.id+'"><td class="time">'+r.time+'<small>'+days[r.occurredDate].replace(' 2026','')+'</small></td><td class="audit-action">'+actions[r.action]+'</td><td>'+outcome(r)+'</td><td class="audit-person">'+person(r.actor)+'</td><td class="audit-person">'+(r.approver?person(r.approver)+(r.actor===r.approver?'<small>Self-approved</small>':''):'None')+'</td><td>'+escape(r.place)+'<small>'+r.order+'</small></td><td>'+summary(r)+'</td><td class="row-action"><button class="office-button small" data-open="'+r.id+'" aria-label="Open '+escape(actions[r.action])+': '+r.order+' at '+r.time+'">Open</button></td></tr>').join('');
  }
  function open(r,button){
    current=r;opener=button;button.focus({preventScroll:true});
    $('#audit-title').textContent=actions[r.action]+' · '+r.order;
    const fact=(label,value)=>'<dt>'+label+'</dt><dd>'+value+'</dd>';
    const approver=r.approver?person(r.approver)+(r.actor===r.approver?' · Self-approved':''):r.outcome==='success'?'None · Approval not required':'None · Approval not granted';
    $('#audit-detail').innerHTML='<div class="office-notice">'+outcome(r)+'<p>'+outcomeNotes[r.outcome]+'</p></div><dl class="audit-facts">'+fact('Occurred',days[r.occurredDate]+' · '+r.time+' WIB')+fact('Business day',days[r.day])+fact('Actor',person(r.actor))+fact('Approver',approver)+fact('Order',escape(r.place)+' · '+r.order)+(r.orderDay?fact('Order’s business day',days[r.orderDay]):'')+(r.subject?fact('Subject',escape(r.subject)):'')+(r.ticketTime?fact('Original ticket',r.ticketTime):'')+(r.code?fact('Outcome code','REFUSED')+fact('Refusal code · illustrative',r.code)+fact('Refusal reason',escape(r.refusal)):'')+(r.beforeDiscount?fact('Discount before',escape(r.beforeDiscount))+fact('Discount after',escape(r.afterDiscount)):'')+'</dl>'+(r.outcome==='success'&&r.amounts?'<section class="audit-amounts"><h3>Amounts · IDR</h3><dl>'+amounts(r.amounts)+'</dl></section>':'')+(r.reason?'<section class="audit-reason"><h3>Business reason</h3><p>'+escape(r.reason)+'</p></section>':'')+(r.note?'<p class="office-muted">'+escape(r.note)+'</p>':'');
    Office.open($('#audit-dialog'),$('#close-detail'));sync();
  }
  function close(){current=null;Office.close($('#audit-dialog'),opener);sync();}
  function clear(){Object.values(filters).forEach(f=>f.value='all');page=0;render();sync();}
  $('#audit-filters').addEventListener('submit',e=>e.preventDefault());
  $('#audit-filters').addEventListener('change',()=>{page=0;render();sync();});
  $('#clear-filters').addEventListener('click',clear);
  $('#read-status').addEventListener('click',e=>{
    if(e.target.id==='clear-empty'){clear();$('#clear-filters').focus();}
    if(e.target.id==='retry'){readState='loading';render();sync('loading');setTimeout(()=>{readState='ready';render();sync();$('#filter-day').focus();},650);}
  });
  for(const [id,delta] of [['newer',-1],['older',1]])$('#'+id).addEventListener('click',()=>{page+=delta;render();sync();$('.bocontent').scrollTop=0;if($('#'+id).disabled)$('#'+(id==='older'?'newer':'older')).focus();});
  $('#audit-rows').addEventListener('click',e=>{const button=e.target.closest('[data-open]');if(button)open(records.find(r=>r.id===button.dataset.open),button);});
  $('#close-detail').addEventListener('click',close);
  $('#audit-dialog').addEventListener('cancel',e=>{e.preventDefault();close();});
  if(params.get('list')==='overflow')listState='overflow';
  const entryId=params.get('entry')||(initial.startsWith('entry-')?initial.slice(6):null);
  const requested=records.find(r=>r.id===entryId);
  if(requested&&readState==='ready'){
    const index=matches().indexOf(requested);
    if(index>=0){page=Math.floor(index/pageSize);render();open(requested,$('[data-open="'+requested.id+'"]'));}
    else render();
  }else render();
})();
