/* DESIGN-009 walkable design fixtures. No API, persisted money, audit or printer. */
(() => {
  const list = window.WF.id === 'POS-05';
  const params = new URLSearchParams(location.search);
  const initial = WF.states.some(s => s[0] === params.get('state')) ? params.get('state') : 'default';
  const app = document.querySelector('.co-app');
  const fmt = n => BigInt(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const a = (text,href,cls='') => `<a class="co-button ${cls}" href="${href}">${text}</a>`;
  const b = (text,action,cls='',attrs='') => `<button type="button" class="co-button ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
  const presets = ['Wrong dish served','Customer complaint','Charged in error'];
  const rows = [
    {id:'split',name:'Table 1',time:'20:14',state:'default',tenders:[['Card',100000],['Cash',55925]]},
    {id:'cash',name:'Table 7',time:'20:11',state:'cash',tenders:[['Cash',200000]],change:44075},
    {id:'custom',name:'Table 4',time:'20:04',state:'custom',tenders:[['Card',40000],['Card',30000],['Meal voucher',20000],['Card',10000],['Staff account',20000],['Cash',35925]]},
    {id:'refunded',name:'Table 3',time:'19:58',state:'refunded',tenders:[['Cash',155925]],refunded:true},
    {id:'zero',name:'Table 6',time:'19:41',state:'zero',tenders:[],zero:true},
    {id:'quick',name:'Quick sale',time:'19:20',state:'quick',tenders:[['Card',173250]],quick:true}
  ];
  function header(title,back,tag='') {return `<header class="co-head"><a class="co-back" href="${back[1]}">← ${back[0]}</a><h1>${title}</h1>${tag?`<span class="co-tag">${tag}</span>`:''}<div class="co-actor"><span>Ana R. · Cashier</span><span class="co-idle">90s</span>${a('Release','lock.html')}</div></header>`;}
  function notice(title,copy='',warn=false){return `<div class="co-notice ${warn?'co-warning':''}" role="status"><strong>${title}</strong>${copy?`<p>${copy}</p>`:''}</div>`;}
  function pad(action,confirm=false){return `<div class="co-pad">${['1','2','3','4','5','6','7','8','9','←','0',confirm?'▶':'Clear'].map(x=>`<button class="co-key ${x==='▶'?'co-primary':''}" data-action="${action}" data-key="${x}" aria-label="${x==='←'?'Delete last digit':x==='▶'?'Approve this refund':x}">${x}</button>`).join('')}</div>`;}
  function sheet(title,content,foot){return `<section class="co-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header class="co-sheethead"><h2 id="sheet-title">${title}</h2><span class="co-tag">${list?'FILTER':'MANAGER REQUIRED'}</span></header><div class="co-sheetbody">${content}</div><footer class="co-foot">${foot}</footer></section>`;}
  function focusDialog(){const dialog=app.querySelector('[role=dialog]');app.querySelectorAll(':scope > :not([role=dialog]):not(.co-scrim)').forEach(e=>e.inert=!!dialog);if(dialog){const first=dialog.querySelector('button:not(:disabled),input,a');first?.focus({preventScroll:true});}}
  app.addEventListener('keydown',e=>{const dialog=app.querySelector('[role=dialog]');if(!dialog||e.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],input')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  if(list){
    // F7: Apply filters the list at once; there is no separate Search step.
    // F3: under the closed-day banner the open day lists first, then the closed day, reprint only.
    let state=initial, filter=initial.startsWith('filter-')?initial.slice(7):null;
    let table=initial==='nomatch'?'Table 12':'Any',time='Any',amount=initial==='nomatch'?'500000':'';
    let draft='',timeField='from',from='1800',to='2100',invalid='';
    const closed=initial==='dayclosed'||initial==='dayclosed-start';
    const home=closed?initial:'default';
    const newDay=initial==='dayclosed'?[{id:'newday',name:'Quick sale',time:'23:40',state:'quick',tenders:[['Card',173250]],quick:true}]:[];
    const matches=r=>(table==='Any'||r.name===table)&&(!amount||total(r)===Number(amount))&&(time==='Any'||(r.time>=time.split('–')[0]&&r.time<=time.split('–')[1]));
    function row(r,context){
      const query=new URLSearchParams(context==='closed-day'?{state:'dayclosed',order:r.state,time:r.time}:{state:r.state,order:r.state,time:r.time,...(context==='open-day'?{list:'dayclosed'}:{})});
      return `<a class="co-row" href="closed-order.html?${query}"><span>${r.time}</span><span>${r.name}</span><span>${r.zero?'Comp 100% · no payment taken':r.id.startsWith('history')&&r.state==='custom'?'Card · Meal voucher · Staff account · Cash':r.tenders.map(t=>`${t[0]} ${fmt(t[1])}`).join(' · ')}${r.change?`<div class="co-muted">Change ${fmt(r.change)} · contribution ${fmt(total(r))}</div>`:''}${r.refunded?' <span class="co-tag">REFUNDED</span>':''}</span><span class="co-money">${fmt(total(r))}</span></a>`;
    }
    const nomatch=`<div class="co-empty"><h2>No matching orders</h2><p>No order matches these table, time and amount filters.</p>${b('Clear filters','reset')}</div>`;
    function draw(){
      const filtering=table!=='Any'||time!=='Any'||!!amount;
      const base=state==='overflow'?Array.from({length:36},(_,i)=>({...rows[i%rows.length],id:`history-${i}`,time:`${String(20-Math.floor(i/6)).padStart(2,'0')}:${String(54-i%6*8).padStart(2,'0')}`})):rows;
      const messages={empty:['No closed orders yet today','Orders appear here once they are closed.'],loading:['Loading closed orders…','Reading this business day’s orders.'],error:['Could not load closed orders','Try again to read this business day.']};
      let listed;
      if(messages[state])listed=`<div class="co-empty"><h2>${messages[state][0]}</h2><p>${messages[state][1]}</p>${state==='error'?b('Retry','reset'):''}</div>`;
      else if(closed){
        const open=newDay.filter(matches),old=rows.filter(matches);
        listed=!open.length&&!old.length&&filtering?nomatch:
          `<div class="co-group">Business day open · 26 Sep</div>${open.length?open.map(r=>row(r,'open-day')).join(''):`<div class="co-note">${filtering?'No matching orders in this business day.':'No orders closed yet in this business day.'}</div>`}`+
          `<div class="co-group">Closed day · 25 Sep · reprint only</div>${old.length?old.map(r=>row(r,'closed-day')).join(''):'<div class="co-note">No matching orders from the closed day.</div>'}`;
      }
      else{const shown=base.filter(matches);listed=shown.length?shown.map(r=>row(r,'')).join(''):nomatch;}
      app.innerHTML=header('Closed orders',['Floor',closed?'floor.html?state=dayclosed':'floor.html'],'DAY OPEN')+
        (closed?notice('25 Sep · Business day closed at 23:14','The open day’s orders are listed first. Orders from 25 Sep follow, read-only: reprinting still works, refunds are unavailable.',true):'<div class="co-note">Business day open · 25 Sep</div>')+
        `<div class="co-toolbar">${[['Table / quick sale',table,'table'],['Closed at',time,'time'],['Total',amount?fmt(amount):'Any','amount']].map(([label,value,key])=>`<div class="co-filter"><span class="co-label">${label}</span>${b(value+' · Set','filter-'+key)}</div>`).join('')}${b('Reset','reset')}</div>`+
        `<div class="co-listhead"><span>Closed at</span><span>Order</span><span>Payment taken</span><span class="co-money">Total</span></div><div class="co-scroll" tabindex="0" aria-label="Closed orders">${listed}</div>`;
      if(filter){
        let body='';
        if(filter==='table')body=`<p>Choose the table, or Quick sale.</p><div class="co-options">${['Any','Quick sale',...Array.from({length:12},(_,i)=>`Table ${i+1}`)].map(t=>b(t,'choose-table',draft===t?'co-selected':'',`data-value="${t}"`)).join('')}</div>`;
        if(filter==='amount')body=`<p>Match the exact order total. Enter whole rupiah.</p><div class="co-totalrow"><span>Total</span><output class="co-field">${draft?fmt(draft):'Any'}</output></div>${pad('filter-key')}`;
        if(filter==='time')body=`<p>Closed between · 24-hour time</p><div class="co-options">${b('From '+clock(from),'time-from',timeField==='from'?'co-selected':'')}${b('To '+clock(to),'time-to',timeField==='to'?'co-selected':'')}</div>${invalid?`<p class="co-invalid">${invalid}</p>`:''}${pad('time-key')}`;
        app.innerHTML+=sheet(filter==='table'?'Find by table':filter==='time'?'Find by closing time':'Find by amount',body,b('Cancel','cancel-filter')+b('Apply filter','apply-filter','co-primary co-button--large'));
        focusDialog();
      }
    }
    const clock=s=>s.padStart(4,'0').slice(0,2)+':'+s.padStart(4,'0').slice(2);
    app.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;
      if(['filter-table','filter-time','filter-amount'].includes(action)){filter=action.slice(7);draft=filter==='table'?table:amount;}
      if(action==='choose-table')draft=el.dataset.value;
      if(action==='cancel-filter')filter=null;
      if(action==='filter-key')draft=key(draft,el.dataset.key,9);
      if(action==='time-from'||action==='time-to')timeField=action.slice(5);
      if(action==='time-key'){if(timeField==='from')from=key(from,el.dataset.key,4);else to=key(to,el.dataset.key,4);invalid='';}
      if(action==='apply-filter'){
        if(filter==='time'){const valid=s=>s.length===4&&+s.slice(0,2)<24&&+s.slice(2)<60;if(!valid(from)||!valid(to)||from>to){invalid='Enter valid HH:MM times, with From no later than To.';draw();return;}time=clock(from)+'–'+clock(to);}
        else if(filter==='table')table=draft;else amount=draft;filter=null;
        if(state==='nomatch'||state.startsWith('filter-'))state='default';
      }
      if(action==='reset'){table='Any';time='Any';amount='';state=home;}
      draw();
    });
    if(filter)draft=filter==='table'?table:amount;
    draw();return;
  }
  function total(r){return r.zero?0:r.quick?173250:155925;}
  function key(value,k,max=9){return k==='Clear'?'':k==='←'?value.slice(0,-1):(value==='0'?'':value).concat(k).slice(0,max);}
  let state=initial;
  const selected=params.get('order')||({ 'sheet-ac25':'cash','sheet-custom':'custom','sheet-zero':'default','approval-edited':'default',zero:'zero',cash:'cash',custom:'custom',quick:'quick',refunded:'refunded',overflow:'long' }[initial]||'default');
  const long=selected==='long';
  const order=rows.find(r=>r.state===selected)||rows[0];
  const dayclosed=initial==='dayclosed';
  const newDayContext=params.get('list')==='dayclosed';
  let refunded=order.refunded||initial==='refunded', closedDay=dayclosed;
  const orderTotal=long?1559250:total(order);
  const subtotal=long?1650000:165000,discount=order.zero?165000:order.quick?0:long?165000:16500,service=order.zero?0:order.quick?8250:long?74250:7425;
  const defaults=()=>(long?[['Card',1559250]]:order.tenders).map(([name,n],i)=>({name,amount:BigInt(n-(name==='Cash'&&i===order.tenders.length-1?(order.change||0):0))}));
  let allocations=defaults();
  if(['sheet-edited','sheet-invalid','refund-error','day-refusal'].includes(initial))allocations=[{name:'Card',amount:80000n},{name:'Cash',amount:initial==='sheet-invalid'?55925n:75925n}];
  if(['sheet-zero','approval-edited'].includes(initial))allocations=[{name:'Card',amount:0n},{name:'Cash',amount:155925n}];
  const edited=()=>{const base=defaults();return allocations.length!==base.length||allocations.some((x,i)=>x.amount!==base[i].amount);};
  let reason=['approval','approval-edited','refund-error','day-refusal','sheet-edited','sheet-invalid','sheet-edit','sheet-zero'].includes(initial)?presets[0]:'';
  let overlay=initial.startsWith('sheet-')?'sheet':['approval','approval-edited'].includes(initial)?'approval':null;
  let editing=initial==='sheet-edit'?0:null,editValue='80000',other=initial==='sheet-other',otherText=initial==='sheet-other'?'Meal was cold':'',pin='';
  if(order.zero||refunded||closedDay)overlay=null;
  function refundable(){return !order.zero&&!refunded&&!closedDay;}
  function figures(){return `<aside class="co-summary"><div class="co-figures"><h2>What was charged</h2><div class="co-totalrow"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>${discount?`<div class="co-totalrow"><span>${order.zero?'Comp 100%':'Staff meal 10%'}</span><span>−${fmt(discount)}</span></div>`:''}<div class="co-totalrow"><span>Service charge 5%</span><span>${fmt(service)}</span></div><div class="co-totalrow co-grand"><span>Total</span><span>${fmt(orderTotal)}</span></div><p class="co-muted">Stored at close · figures do not change with today’s settings.</p></div><div class="co-actions">${b('Reprint receipt','reprint','co-button--large')}${refundable()?b('Refund this order','refund','co-button--large co-destructive'):''}${order.zero?'<p class="co-muted">No payment taken · fully discounted.</p>':refunded?'<p class="co-muted">Already refunded · this order is final.</p>':closedDay?'<p class="co-muted">Refund unavailable · business day closed.</p>':''}</div></aside>`;}
  function draw(){
    const unavailable=['loading','error'].includes(state);
    app.innerHTML=header(unavailable?'Closed order':order.name,['Closed orders','closed-orders.html'+(closedDay||newDayContext?'?state=dayclosed':'')],unavailable?'':refunded?'REFUNDED':'CLOSED');
    if(unavailable){app.innerHTML+=`<div class="co-empty"><h2>${state==='loading'?'Loading order…':'Could not load this order'}</h2><p>${state==='loading'?'Reading the stored order.':'No order details are available. Try again.'}</p>${state==='error'?b('Retry','retry-load'):''}</div>`;return;}
    let message=closedDay?notice('This order’s business day is closed','Reprinting still works. Refunds are unavailable.',true):'';
    if(refunded)message+=notice('REFUNDED · 20:31 · approved by M. Iqbal',`The whole order was refunded. Reason: ${esc(reason||presets[0])}.`);
    if(state==='refund-error')message+=notice('Refund failed · the order is unchanged',refundable()?'Your allocation and reason are kept. Review them, then enter a manager PIN for a new attempt. '+b('Review refund','refund'):'Nothing was refunded.',true);
    if(state==='day-refusal')message+=notice('Refund refused · business day closed during this attempt','Nothing was refunded. The order is unchanged. Reprinting still works. '+b('Return to order','accept-day'),true);
    if(state==='reprint')message+=notice('Receipt reprint FAILED','The order is still closed. '+a('View receipt incidents','incidents.html#receipt-1'),true);
    if(state==='reprint-unknown')message+=notice('Receipt delivery UNKNOWN','Check the printer before reprinting. '+a('View receipt incidents','incidents.html#receipt-1'),true);
    if(state==='reprint-sent')message+=notice('Reprint sent','');
    if(state==='reprint-printed')message+=notice('Receipt PRINTED · 20:26','Server-confirmed result. The original charged figures were used.');
    app.innerHTML+=`<div class="co-body"><div class="co-content co-scroll" tabindex="0" aria-label="Charged items and original payment"><div class="co-note">Closed ${esc(params.get('time')||order.time)} · Business day ${newDayContext?'26':'25'} Sep</div>${message}<div class="co-group">${long?'20':'2'} lines · charged items</div>${Array.from({length:long?10:1},()=>`<div class="co-line"><span class="co-quantity">1</span><div>Burger<div class="co-muted">Large (+20.000) · Extra cheese (+15.000)</div></div><span>135.000</span></div><div class="co-line"><span class="co-quantity">1</span><div>Soda</div><span>30.000</span></div>`).join('')}<div class="co-group">Original payment</div>${order.zero?'<div class="co-line">No payment taken · fully discounted</div>':(long?[['Card',1559250]]:order.tenders).map(([name,n])=>`<div class="co-line"><span>${name}</span><span>${fmt(n)}</span></div>`).join('')}${order.change?`<div class="co-line"><span>Change given</span><span>−${fmt(order.change)}</span></div><div class="co-line"><span>Cash contribution</span><span>${fmt(orderTotal)}</span></div>`:''}${refunded?`<div class="co-group">Money returned · full order</div>${allocations.filter(x=>x.amount>0n).map(x=>`<div class="co-line"><span>${x.name}</span><span>${fmt(x.amount)}</span></div>`).join('')}`:''}</div>${figures()}</div>`;
    if(overlay==='sheet')drawSheet();
    if(overlay==='approval')drawApproval();
    if(overlay)focusDialog();
  }
  function drawSheet(){
    const sum=allocations.reduce((n,x)=>n+x.amount,0n),difference=BigInt(orderTotal)-sum;
    let body='';
    if(editing!==null){body=`<div class="co-editor"><div><h2>${allocations[editing].name} · money back</h2><p class="co-muted">This changes the allocation only. The refund remains the whole order, ${fmt(orderTotal)}.</p><div class="co-totalrow"><output class="co-field">${editValue?fmt(editValue):'0'}</output></div><p>Other allocations: ${fmt(sum-allocations[editing].amount)}</p><p>Required total: ${fmt(orderTotal)}</p></div>${pad('allocation-key')}</div>`;
      app.innerHTML+=sheet('Edit refund allocation',body,b('Cancel edit','cancel-edit')+b('Keep amount','save-edit','co-primary co-button--large'));return;
    }
    if(other){body=`<p>Other — type a reason</p><input class="co-field co-reason" aria-label="Refund reason" value="${esc(otherText)}" maxlength="160"><div class="co-keyboard">${['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map(row=>`<div>${[...row].map(k=>`<button class="co-letter" data-action="letter" data-key="${k}">${k}</button>`).join('')}</div>`).join('')}<div>${b('Space','letter','', 'data-key=" "')}${b('Delete','letter','','data-key="←"')}${b('Clear','letter','','data-key="Clear"')}</div></div>`;
      app.innerHTML+=sheet('Reason — required',body,b('Cancel reason','cancel-other')+b('Keep reason','save-other','co-primary co-button--large',otherText.trim()?'':'disabled'));return;
    }
    body=notice(`Refund the whole order · ${fmt(orderTotal)}`,'Part of an order cannot be refunded. An order can be refunded once.')+
      `<p class="co-label">How the money goes back · tap an amount to edit</p>${allocations.map((x,i)=>`<div class="co-allocation"><span>${x.name}${x.amount===0n?' <span class="co-muted">· not refunded</span>':''}</span><button class="co-field" data-action="edit" data-index="${i}" aria-label="Edit ${x.name} allocation ${i+1}">${fmt(x.amount)}</button></div>`).join('')}<div class="co-totalrow"><strong>Allocated</strong><strong>${fmt(sum)} of ${fmt(orderTotal)}</strong></div>`+
      (difference?`<p class="co-invalid" role="alert">${difference>0n?`Allocate ${fmt(difference)} more`:`Reduce allocations by ${fmt(-difference)}`}. Allocations must equal ${fmt(orderTotal)} exactly.</p>`:'<p class="co-muted">Allocation equals the full order total.</p>')+(allocations.some(x=>x.amount===0n)?'<p class="co-muted">A row at 0 is not refunded and is left out of the refund.</p>':'')+
      `<p class="co-muted">Defaults to each original tender less its change.${order.change?` Cash: 200.000 − 44.075 = 155.925.`:''}</p><h3>Reason — required</h3><div class="co-options">${presets.map((r,i)=>b(r,'reason',reason===r?'co-selected':'',`data-index="${i}"`)).join('')}${b('Other — type a reason','other',reason&&!presets.includes(reason)?'co-selected':'')}</div>${reason&&!presets.includes(reason)?`<p>${esc(reason)}</p>`:''}${!reason?'<p class="co-muted">Select a reason before continuing.</p>':''}`;
    app.innerHTML+=sheet('Refund the whole order',body,b('Cancel','cancel-sheet')+b('Continue to manager PIN','continue','co-primary co-button--large',difference||!reason?'disabled':''));
  }
  function drawApproval(){
    app.innerHTML+=`<div class="co-scrim"></div><section class="co-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title"><header class="co-modalhead"><h2 id="approval-title">Manager PIN</h2><p>Refund ${order.name}, ${fmt(orderTotal)} — reason: ${esc(reason)}</p><p class="co-split">Money back: ${allocations.map(x=>x.amount===0n?`${esc(x.name)} not refunded`:`${esc(x.name)} ${fmt(x.amount)}`).join(' · ')}${edited()?' <span class="co-tag">ALLOCATION EDITED</span>':''}</p></header><div class="co-modalbody"><div class="co-dots" aria-label="${pin.length} of 6 digits entered">${Array.from({length:6},(_,i)=>`<span class="co-dot ${i<pin.length?'co-dot--on':''}"></span>`).join('')}</div>${pad('pin',true)}<p class="co-muted">Approves this refund only.</p></div><footer class="co-foot">${b('Cancel','cancel-approval')}<span class="co-muted">Cancelling changes nothing on the order.</span></footer></section>`;
    app.querySelector('[data-key="▶"]').disabled=pin.length!==6;
  }
  app.addEventListener('input',e=>{if(e.target.matches('.co-reason')){otherText=e.target.value;app.querySelector('[data-action="save-other"]').disabled=!otherText.trim();}});
  app.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;
    if(action==='refund'){overlay='sheet';editing=null;other=false;}
    if(action==='cancel-sheet')overlay=null;
    if(action==='edit'){editing=Number(el.dataset.index);editValue=String(allocations[editing].amount);}
    if(action==='allocation-key')editValue=key(editValue,el.dataset.key);
    if(action==='cancel-edit')editing=null;
    if(action==='save-edit'){allocations[editing].amount=BigInt(editValue||'0');editing=null;}
    if(action==='reason')reason=presets[Number(el.dataset.index)];
    if(action==='other'){other=true;otherText=presets.includes(reason)?'':reason;}
    if(action==='letter')otherText=el.dataset.key==='←'?otherText.slice(0,-1):el.dataset.key==='Clear'?'':(otherText+el.dataset.key).slice(0,160);
    if(action==='cancel-other')other=false;
    if(action==='save-other'&&otherText.trim()){reason=otherText.trim();other=false;}
    if(action==='continue'){overlay='approval';pin='';}
    if(action==='cancel-approval'){overlay='sheet';pin='';}
    if(action==='pin'){if(el.dataset.key==='▶'&&pin.length===6){refunded=true;state='refunded';overlay=null;pin='';}else pin=key(pin,el.dataset.key,6);}
    if(action==='reprint')state='reprint-sent';
    if(action==='accept-day'){closedDay=true;state='dayclosed';}
    if(action==='retry-load')state='default';
    draw();
  });
  if(state==='day-refusal')closedDay=true;
  draw();
})();
