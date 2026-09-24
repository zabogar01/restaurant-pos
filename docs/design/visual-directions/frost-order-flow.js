/* DESIGN-007: walkable DESIGN fixtures only. No storage, API or printer.
   The option sets below are illustrative data, never a production catalogue.
   Monetary arithmetic is integer-exact, including half-up ratios. */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const fmt = n => BigInt(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const signed = n => (n < 0 ? '−' : '+') + fmt(n < 0 ? -n : n);
  const half = (n, d) => (n * 2n + d) / (d * 2n);
  const group = (name, many, options, selected = [0]) => ({name, many, options, selected});
  const items = {
    burger: {name:'Burger', price:100000, groups:[group('Size',false,[['Regular',0],['Large',20000],['Small',-10000]],[1]),group('Extras',true,[['Extra cheese',15000],['Bacon',20000],['No onion',0]],[0])]},
    wings: {name:'Chicken Wings',price:90000,groups:[group('Sauce',false,[['Buffalo',0],['BBQ',0],['Garlic butter',10000]])]},
    steak: {name:'Steak',price:240000,groups:[group('Doneness',false,[['Medium rare',0],['Medium',0],['Well done',0]]),group('Extras',true,[['Pepper sauce',10000],['Garlic butter',15000]],[0])]},
    fish: {name:'Fish & Chips',price:140000,groups:[group('Sauce',false,[['Tartare',0],['Chilli mayo',5000]]),group('Extras',true,[['Extra fish',60000]],[0])]},
    salad: {name:'Caesar Salad',price:75000,groups:[group('Extras',true,[['Grilled chicken',25000],['No croutons',0]],[0])]},
    soup: {name:'Soup of the Day',price:55000,groups:[group('Bread',false,[['With bread',0],['No bread',-5000]],[1])]},
    fries: {name:'Fries',price:40000,groups:[group('Seasoning',false,[['Salt',0],['Chilli',0]]),group('Extras',true,[['Cheese sauce',10000]],[])]},
    rings: {name:'Onion Rings',price:45000,groups:[group('Dip',false,[['Ketchup',0],['Garlic mayo',5000]],[1])]},
    soda: {name:'Soda',price:30000,groups:[]},
    coffee: {name:'Coffee',price:35000,groups:[group('Size',false,[['Regular',0],['Large',10000]],[1]),group('Extras',true,[['Extra shot',10000]],[])]},
    beer: {name:'Beer',price:65000,groups:[group('Size',false,[['Regular',0],['Large',25000]],[1])]},
    wine: {name:'House Wine',price:80000,groups:[group('Pour',false,[['Standard',0],['Small',-20000]],[1])]}
  };
  const state = document.documentElement.dataset.state;
  const isItem = state === 'sheet-item' || state === 'sheet-item86' || state.startsWith('sheet-item-');
  const isEdit = state.startsWith('sheet-line') || state.startsWith('quick-line');
  const isFire = state.startsWith('fire-') || state === 'fireerror';
  const quick = state.startsWith('quick');
  // Extend existing states by composing their established background, not a new screen.
  const base = isItem ? (state === 'sheet-item86' ? state : 'sheet-item') : isEdit ? (quick ? 'quick-line' : 'sheet-line') : isFire ? 'linecontrols' : state;
  if (base !== state) {
    $$('[data-when]').forEach(e => e.hidden = !e.dataset.when.split(/\s+/).includes(base));
    $$('[data-unless]').forEach(e => e.hidden = e.dataset.unless.split(/\s+/).includes(base));
    // No removed-line variant is combined with the new fixtures.
    $$('[data-gone]').forEach(e => e.hidden = true);
  }
  const panel = $('.orderpanel');
  const lines = $('.lines', panel);
  const totalsNode = () => $$('.totals',panel).find(e => !e.hidden);
  const burger = {id:'burger',name:'Burger',unit:135000n,q:1,detail:'Large (+20.000) · Extra cheese (+15.000)',round:1,time:'19:42',delivery:'printed'};
  const soda = {id:'soda',name:'Soda',unit:30000n,q:1,detail:'',round:2,time:'19:58',delivery:'printed'};
  const steak = {id:'steak',name:'Steak',unit:240000n,q:1,detail:'Medium rare (+0)',round:0};
  // Explicit snapshots for the existing drawings. Never infer order facts from
  // presentation text: a missing delivery label is not evidence of printing.
  const staffMeal = {name:'Staff meal',kind:'percent',value:10n};
  const comp = {name:'Comp',kind:'percent',value:100n};
  const tableWithPending = new Set(['linecontrols','eightysix','fireblocked','catalog',
    'sheet-item','sheet-item86','sheet-line','sheet-voidorder','lock-draft','lock-lease']);
  const overflowLines = [
    {...burger,q:2,detail:'Large · Extra cheese',delivery:null},
    {id:'of-fish',name:'Fish & Chips',unit:140000n,q:1,detail:'',round:1,time:'19:42',delivery:null},
    {...soda,q:4,round:1,time:'19:42',delivery:null},
    {id:'of-salad',name:'Caesar Salad',unit:75000n,q:1,voided:true,
      detail:'Voided 19:51 · approved by M. Iqbal',round:1,time:'19:42',delivery:null},
    {id:'of-wings',name:'Chicken Wings',unit:90000n,q:3,detail:'',round:2,time:'19:58',delivery:null},
    {id:'of-beer',name:'Beer',unit:65000n,q:2,detail:'',round:2,time:'19:58',delivery:null},
    {id:'of-rings',name:'Onion Rings',unit:45000n,q:1,detail:'',round:2,time:'19:58',delivery:null},
    {id:'of-coffee',name:'Coffee',unit:35000n,q:2,detail:'',round:0},
    {id:'of-cheese',name:'Cheesecake',unit:60000n,q:1,detail:'',round:0},
    {id:'of-wine',name:'House Wine',unit:80000n,q:1,detail:'',round:0}
  ];
  let model = quick ? [{...burger,id:'q-burger',round:0},{...soda,id:'q-soda',round:0}]
    : base==='overflow' ? overflowLines
    : ['empty','loading'].includes(base) ? []
    : [{...burger},{...soda},...(tableWithPending.has(base)?[{...steak}]:[])];
  const gone = new URLSearchParams(location.search).get('gone');
  if(gone && (quick||base==='overflow')) model=model.filter(l=>l.id!==gone);
  if(['eightysix','fireblocked','sheet-item86'].includes(base)) model.find(l=>l.id==='steak').unavailable=true;
  const discount = base==='zero' ? comp
    : quick || ['empty','loading','overflow'].includes(base) ? null : staffMeal;
  const isPending = line => !line.round && !line.voided;
  let drawer = null;
  let opener = null;
  const figures = list => {
    const subtotal=list.reduce((sum,l)=>sum+(l.voided?0n:l.unit*BigInt(l.q)),0n);
    const disc=discount?half(subtotal*discount.value,100n):0n, net=subtotal-disc;
    const service=half(net,20n), tax=half(net,11n);
    return {subtotal,disc,net,service,tax,total:net+service};
  };
  const totals = (list, preview=false) => {
    const f=figures(list);
    return `${preview?'<span class="label">After update · not saved yet</span>':''}<div class="t"><span>Subtotal</span><span class="mono">${fmt(f.subtotal)}</span></div>${discount?`<div class="t"><span>${discount.name} ${discount.value}%</span><span class="mono">−${fmt(f.disc)}</span></div>`:''}<div class="t"><span>Service charge 5%</span><span class="mono">${fmt(f.service)}</span></div><div class="t t--grand"><span>Total</span><span class="mono">${fmt(f.total)}</span></div><div class="t t--incl"><span>Includes tax 10%</span><span class="mono">${fmt(f.tax)}</span></div>`;
  };
  const deliveryCopy={queued:'sending · unconfirmed',printed:'printed',failed:'FAILED · not printed',unknown:'UNKNOWN · may have printed'};
  const heading = (round,time,delivery,focus=false) => `<div class="roundhead flow-round" ${focus?'id="new-round" tabindex="-1"':''}><span>Round ${round} · fired ${time}${delivery == null?'':' · '+deliveryCopy[delivery]}</span><span class="tag">MANAGER TO VOID</span></div>`;
  const row = (l,index) => l.voided
    ? `<div class="line line--void" data-flow-line="${index}"><div class="line__q">${l.q}</div><div class="line__b"><div class="line__n">${l.name}</div><div class="line__m">${l.detail}</div></div><div class="line__a">${fmt(l.unit*BigInt(l.q))}</div><div class="line__x line__x--empty"></div></div>`
    : `<div class="line" data-flow-line="${index}"><a class="line__t" href="order.html?state=${l.round?'sheet-voidline':quick?'quick-line':'sheet-line'}" ${l.round?'':'data-edit="'+index+'"'}><div class="line__q">${l.q}</div><div class="line__b"><div class="line__n">${l.name}${l.unavailable?' <span class="tag tag--86">86</span>':''}</div>${l.detail?`<div class="line__m">${l.detail}</div>`:''}</div><div class="line__a">${fmt(l.unit*BigInt(l.q))}</div></a>${l.round?'<div class="line__x line__x--empty"></div>':`<a class="line__x" href="#" data-remove="${index}" aria-label="Remove ${l.name}"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></a>`}</div>`;
  function renderOrder(focusRound=false) {
    let last=-1;
    lines.innerHTML=model.map((l,i)=>{
      let h='';
      if(l.round!==last) h=l.round?heading(l.round,l.time,l.delivery,focusRound&&l.round===Math.max(...model.map(x=>x.round))):`<div class="roundhead roundhead--pending">${quick?'Not sent to the kitchen yet':'Pending · not sent to the kitchen'}<span class="tag" style="margin-left:auto">REMOVE FREELY</span></div>`;
      last=l.round;
      return h+row(l,i);
    }).join('');
    const count=$('.orderpanel__head .muted:not([hidden])',panel);
    if(count) count.textContent=model.filter(l=>!l.voided).length+' lines'+(quick?' · not yet sent':'');
    totalsNode().innerHTML=totals(model);
    $$('[data-edit]',lines).forEach(a=>a.onclick=e=>{e.preventDefault();openEdit(Number(a.dataset.edit),a);});
    $$('[data-remove]',lines).forEach(a=>a.onclick=e=>{e.preventDefault();model.splice(Number(a.dataset.remove),1);renderOrder();});
    wireFire();
    if(focusRound) {
      const target=$('#new-round');
      target?.focus({preventScroll:true});
      if(target) lines.scrollTop=target.offsetTop-lines.offsetTop;
    }
  }
  function wireFire() {
    const button=$$('.actions .btn',panel).find(e=>!e.hidden&&/^Send /.test(e.textContent.trim()));
    if(!button || quick) return;
    const pending=model.filter(isPending).length;
    const blocked=model.some(l=>isPending(l)&&l.unavailable);
    const label=pending?`Send ${pending} to kitchen`:'Send to kitchen';
    const b=document.createElement('button');
    b.type='button'; b.className='btn'+(pending&&!blocked?'':' btn--off'); b.textContent=label; b.disabled=!pending||blocked;
    b.onclick=()=>{
      if(model.some(l=>isPending(l)&&l.unavailable)||!model.some(isPending))return;
      const next=Math.max(0,...model.map(l=>l.round))+1;
      model=model.map(l=>!isPending(l)?l:{...l,round:next,time:'20:14',delivery:'queued'});
      renderOrder(true); announce(`Round ${next} sent to the kitchen`);
    };
    button.replaceWith(b);
  }
  function announce(text) {
    let status=$('.flow-status',panel);
    if(!status){status=document.createElement('div');status.className='flow-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');lines.after(status);}
    status.textContent=text;
  }
  function dismiss() {
    drawer?.remove();drawer=null;panel.inert=false;
    $$('.tile--selected').forEach(e=>e.classList.remove('tile--selected'));
    if(opener?.isConnected)opener.focus();
  }
  function shell(name,price,secondary,source) {
    dismiss();opener=source;
    drawer=document.createElement('div');drawer.className='flow-drawer';
    drawer.innerHTML=`<div class="scrim scrim--sheet"></div><section class="sheet flow-sheet" role="dialog" aria-labelledby="flow-title"><div class="sheet__head"><h2 id="flow-title">${name}</h2><span class="mono flow-price">${fmt(price)}</span></div><div class="sheet__body"></div><div class="sheet__foot flow-foot"><div class="flow-secondary">${secondary}</div><div class="flow-commit"><div class="flow-stepper" role="group" aria-label="Quantity"><button type="button" class="btn" data-step="-1" aria-label="Decrease quantity">−</button><output class="field mono" aria-label="Quantity">1</output><button type="button" class="btn" data-step="1" aria-label="Increase quantity">+</button></div><button type="button" class="btn btn--primary flow-save"></button></div><div class="flow-bound muted" aria-live="polite"></div></div></section>`;
    $('.pos').append(drawer);panel.inert=true;
    $('[data-cancel]',drawer).onclick=dismiss;
    drawer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}});
    return $('.sheet__body',drawer);
  }
  function stepper(q,current,commit,update,disabled=false,adding=false) {
    const minus=$('[data-step="-1"]',drawer),plus=$('[data-step="1"]',drawer),save=$('.flow-save',drawer);
    const paint=()=>{
      $('output',drawer).textContent=q;
      minus.disabled=q===1;plus.disabled=q===99;
      for(const b of [minus,plus]){b.classList.toggle('btn--off',b.disabled);b.setAttribute('aria-disabled',String(b.disabled));}
      save.textContent=adding?'Add to order':`Update to ${q}`;
      save.disabled=disabled||(!adding&&q===current);save.classList.toggle('btn--off',save.disabled);save.setAttribute('aria-disabled',String(save.disabled));
      $('.flow-bound',drawer).textContent=q===99?'Maximum 99 per line. Increase is unavailable.':q===1?(adding?'Minimum 1 per line.':'Minimum 1. Use Remove line to remove this line.'):'Quantity · whole numbers, maximum 99';
      update(q);
    };
    minus.onclick=()=>{if(q>1){q--;paint();}};plus.onclick=()=>{if(q<99){q++;paint();}};
    save.onclick=()=>{commit(q);dismiss();};paint();
    return ()=>paint();
  }
  function openEdit(index,source,draft) {
    const line=model[index];if(!line||!isPending(line))return;
    const body=shell(line.name+' — pending',line.unit,'<button class="btn" data-cancel>Back</button><button class="btn btn--destructive" data-remove-current>Remove line</button>',source);
    body.innerHTML=`<div class="muted">${quick?'Nothing on a counter sale goes to the kitchen until settlement.':'This line has not been sent to the kitchen.'} Back discards changes.</div><div class="flow-line-total"><span>Line total</span><b class="mono" data-line-total></b></div><div class="muted" data-arithmetic></div><div class="totals flow-preview"></div>`;
    $('[data-remove-current]',drawer).onclick=()=>{model.splice(index,1);renderOrder();dismiss();};
    stepper(draft??line.q,line.q,q=>{line.q=q;renderOrder();},q=>{
      $('[data-line-total]',body).textContent=fmt(line.unit*BigInt(q));
      $('[data-arithmetic]',body).textContent=`${fmt(line.unit)} × ${q} = ${fmt(line.unit*BigInt(q))}`;
      $('.flow-preview',body).innerHTML=totals(model.map((l,i)=>i===index?{...l,q}:l),true);
    });
  }
  function openItem(id,source,initial=1,unavailable=false) {
    const item=items[id];
    if(!item)return;
    const groups=structuredClone(item.groups);
    const body=shell(item.name,item.price,'<button class="btn" data-cancel>Cancel</button>',source);
    source?.classList.add('tile--selected');
    body.innerHTML=(unavailable?'<div class="notice flow-unavailable"><div class="notice__t">Burger is no longer available</div><div>A manager marked it 86 while you were choosing. Your selections are kept so you can note them, but it cannot be added.</div></div>':'')+groups.map((g,i)=>`<span class="label">${g.name} — choose ${g.many?'any':'one'}</span><div class="flow-options ${id==='burger'&&i===1?'flow-extras':''}" role="group" aria-label="${g.name}">${g.options.map(([n,p],j)=>`<button type="button" class="btn ${g.selected.includes(j)?'btn--primary':''}" aria-pressed="${g.selected.includes(j)}" data-group="${i}" data-option="${j}">${n}${id==='burger'&&i===1?' ':'<br>'}${signed(p)}</button>`).join('')}</div>`).join('')+'<div class="flow-line-total"><span>Line total</span><b class="mono" data-line-total></b></div><div class="muted" data-arithmetic></div>';
    let unit;
    const repaint=stepper(initial,0,q=>{
      model.push({id,name:item.name,unit,q,detail:groups.flatMap(g=>g.selected.map(j=>`${g.options[j][0]} (${signed(g.options[j][1])})`)).join(' · '),round:0});renderOrder();
    },q=>{
      const mods=groups.flatMap(g=>g.selected.map(j=>g.options[j][1]));
      unit=BigInt(item.price)+mods.reduce((sum,p)=>sum+BigInt(p),0n);
      $('[data-line-total]',body).textContent=fmt(unit*BigInt(q));
      $('[data-arithmetic]',body).textContent=`(${fmt(item.price)}${mods.map(p=>' '+signed(p)).join('')}) × ${q} = ${fmt(unit*BigInt(q))}`;
    },unavailable,true);
    $$('[data-option]',body).forEach(b=>b.onclick=()=>{
      const g=groups[Number(b.dataset.group)],j=Number(b.dataset.option);
      g.selected=g.many?(g.selected.includes(j)?g.selected.filter(x=>x!==j):[...g.selected,j]):[j];
      $$('[data-option]',body).forEach(x=>{const selected=groups[Number(x.dataset.group)].selected.includes(Number(x.dataset.option));x.classList.toggle('btn--primary',selected);x.setAttribute('aria-pressed',String(selected));});repaint();
    });
  }
  if(isItem || isEdit) {
    if(isItem) {
      let id=state.replace('sheet-item-','');if(!items[id])id='burger';
      openItem(id,$(`.tile[href$="sheet-item-${id}"]`),state==='sheet-item-two'?2:state==='sheet-item-max'?99:1,state==='sheet-item86');
    } else openEdit(quick?0:2,$('.line__t[href$="'+(quick?'quick-line':'sheet-line')+'"]'),state.endsWith('changed')?3:state.endsWith('max')?99:1);
  }
  if(isFire) {
    $('.pos').classList.add('flow-fire');
    model=[{...burger},{...soda},{...steak},{id:'fries',name:'Fries',unit:40000n,q:2,detail:'Salt (+0)',round:0}];
    if(state!=='fire-ready') {
      const delivery=state==='fire-printed'?'printed':state==='fire-failed'||state==='fireerror'?'failed':state==='fire-unknown'||state==='fire-heading-width'?'unknown':'queued';
      model=model.map(l=>!isPending(l)?l:{...l,round:3,time:'20:14',delivery});
      if(state==='fire-heading-width') {
        model=[{...burger},...Array.from({length:10},(_,i)=>({...soda,round:i+2,time:'23:00'})),...model.slice(2).map(l=>({...l,round:12,time:'23:59'}))];
      }
      if(state==='fire-then-add')model.push({id:'coffee',name:'Coffee',unit:35000n,q:1,detail:'Regular (+0)',round:0});
      if(['failed','unknown'].includes(delivery)) {
        const emg=$('.emg');emg.hidden=false;
        $('.emg__t',emg).textContent=delivery==='failed'?'Kitchen ticket FAILED — Table 1, round 3':`Kitchen ticket UNKNOWN — Table 1, round ${state==='fire-heading-width'?12:3}`;
        $('.emg__s',emg).textContent=delivery==='failed'?'Ticket did not print. Open incidents to reprint; the order is unaffected.':'Ticket may have printed. Check with the kitchen before reprinting.';
      }
    }
    renderOrder(state!=='fire-ready'&&state!=='fire-then-add');
    if(state==='fire-queued')announce('Round 3 sent to the kitchen');
    if(state==='fire-then-add')lines.scrollTop=lines.scrollHeight;
  }
  // Fix every menu destination, with the current variant kept for the open sheet.
  $$('.menugrid a.tile').forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault();
    openItem(new URL(a.href).searchParams.get('state').replace('sheet-item-',''),a);
  }));
  if(!isFire) {
    // Count what this particular fixture holds. Locks retain their existing control.
    const send=$$('.actions .btn',panel).find(e=>e.getClientRects().length&&e.textContent.trim()==='Send to kitchen');
    if(send&&!state.startsWith('lock-')) {
      const pending=model.filter(isPending).length;
      send.textContent=pending?`Send ${pending} to kitchen`:'Send to kitchen';
      if(!pending||['fireblocked','eightysix','sheet-item86'].includes(state)){send.classList.add('btn--off');send.setAttribute('aria-disabled','true');send.removeAttribute('href');}
      else {send.onclick=e=>{e.preventDefault();wireFire();const b=$$('.actions button',panel).find(x=>x.textContent.startsWith('Send '));b?.click();};}
    }
  }
  $$('a.line__t[href$="sheet-line"], a.line__t[href$="quick-line"]',lines).forEach(a=>a.onclick=e=>{
    e.preventDefault();
    const visibleRows=$$('.line',lines).filter(x=>x.getClientRects().length);
    openEdit(visibleRows.indexOf(a.closest('.line')),a);
  });
  if(state==='fireblocked') {
    const notice=$('.orderpanel > .notice:not([hidden])'),line=$$('.line',lines).find(e=>e.getClientRects().length&&e.textContent.includes('Steak'));
    line.id='blocked-steak';line.tabIndex=-1;
    notice.innerHTML='<div class="notice__t">Steak is 86’d · cannot send</div><div>Remove the pending line or ask a manager to restore the item.</div><button class="btn btn--sm flow-show-line">Show Steak</button>';
    $('.flow-show-line',notice).onclick=()=>{line.focus({preventScroll:true});lines.scrollTop=line.offsetTop-lines.offsetTop;};
    lines.scrollTop=lines.scrollHeight;
  }
})();
