/* DESIGN-021: illustrative served snapshots, never a seed catalog or an API.
   Review transitions are exposed only through ServedCatalogFixture for checks. */
(() => {
  const state = document.documentElement.dataset.state;
  if (!state.includes('served')) return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => BigInt(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const quick = state.startsWith('quick');
  const emptyOrder = !state.endsWith('-order')&&!state.includes('presets')&&!state.includes('category')&&/empty$|loading|error/.test(state);
  const items = {
    nasi: {name:'Nasi Goreng',price:45000,groups:[],served:true},
    tea: {name:'Jasmine Tea',price:18000,groups:[],served:true},
    water: {name:'Drinking Water',price:0,groups:[],served:true},
    longReal: {name:'Nasi Goreng Kampung dengan Ayam Suwir dan Sambal Terasi Istimewa',price:65000,groups:[],served:true},
    collisionA: {name:'Nasi Goreng Kampung dengan Ayam Suwir dan Sambal Terasi Merah',price:65000,groups:[],served:true},
    collisionB: {name:'Nasi Goreng Kampung dengan Ayam Suwir dan Sambal Terasi Hijau',price:68000,groups:[],served:true},
    long: {name:'W'.repeat(64),price:99999999,groups:[],served:true}
  };
  const variants = () => ({name:'Variant',many:false,options:[['Regular',0],['Small',-10000],['Large',15000]],selected:[]});
  const modifiers = () => ({name:'Modifiers',many:true,options:[['Fried egg',5000],['Extra sambal',0]],selected:[]});
  items.variants={name:'Nasi Goreng',price:45000,groups:[variants()],served:true};
  items.modifiers={name:'Nasi Goreng',price:45000,groups:[modifiers()],served:true};
  items.both={name:'Nasi Goreng',price:45000,groups:[variants(),modifiers()],served:true};
  items.many={name:'Nasi Goreng',price:45000,groups:[{...variants(),options:Array.from({length:24},(_,i)=>['Variant '+(i+1),i*1000])},{...modifiers(),options:Array.from({length:32},(_,i)=>['Modifier '+(i+1),i*1000])}],served:true};
  items.extreme={name:'W'.repeat(64),price:99999999,groups:[{...variants(),options:[['W'.repeat(32),-99999999],['Large portion with special sambal',99999999]]},{...modifiers(),options:[['W'.repeat(32),99999999]]}],served:true};
  items.floor={name:'Nasi Goreng',price:45000,groups:[{...variants(),options:[['Small',-99999999]],selected:[0]}],served:true};
  items.lineBound={name:'Nasi Goreng banquet',price:60000000,groups:[],served:true};
  items.orderBound={name:'Nasi Goreng banquet',price:99999999,groups:[],served:true};
  let flow, selected = 'meals', failures = 0, stale = false, availabilityStatus = '', readKind = 'ready';
  let categories = [{id:'meals',name:'Meals',ids:['nasi','tea','water']}];
  const api = window.ServedCatalogFixture = {items,showRead,base:emptyOrder?'empty':quick?'quick':'default',start,refresh,escape,fmt};
  function start(bridge) {
    flow = bridge;
    api.orderRendered=()=>{
      renderFireNotice();
      wirePresets();
      if(!flow.getModel().length)return;
      const actions=$$('.orderpanel .actions').find(e=>!e.hidden);
      if(!actions?.querySelector('#served-action-reason'))return;
      actions.removeAttribute('aria-label');
      actions.innerHTML='<a class="btn" href="order.html?state=served-presets">Discount</a><a class="btn btn--destructive" href="order.html?state=sheet-voidorder">Void order</a>'+(!quick?'<button type="button" class="btn">Send to kitchen</button>':'')+`<a class="btn btn--primary ${quick?'btn--wide':''}" href="settlement.html?state=partial">${quick?'Settle — sends the order to the kitchen':'Settle'}</a>`;
      flow.wireFire();wirePresets();
    };
    $('.pos').classList.add('served-catalog');
    if (quick) {
      $$('.pos__bar h1').filter(e=>!e.hidden).forEach(e=>e.textContent='Quick sale');
      $$('.pos__bar > .tag').filter(e=>!e.hidden).forEach(e=>e.textContent='COUNTER');
      $$('.orderpanel__head b').filter(e=>!e.hidden).forEach(e=>e.textContent='Order · counter');
    }
    if(emptyOrder) {
      flow.setModel([]);
      $('.lines').innerHTML='<div class="empty served-order-empty"><b>No items yet</b><div>Add an item when the menu is available.</div></div>';
      const totals=$$('.orderpanel .totals').find(e=>!e.hidden);
      totals.innerHTML='<div class="t"><span>Subtotal</span><span class="mono">0</span></div><div class="t t--grand"><span>Total</span><span class="mono">0</span></div>';
      const actions=$$('.orderpanel .actions').find(e=>!e.hidden);
      actions.setAttribute('aria-label','Order actions');
      actions.innerHTML=['Discount','Void order',...(quick?[]:['Send to kitchen']),quick?'Settle — sends the order to the kitchen':'Settle'].map(t=>`<button type="button" class="btn btn--off ${t.startsWith('Settle')?'btn--primary':''}" aria-disabled="true" aria-describedby="served-action-reason">${t}</button>`).join('')+'<span class="muted" id="served-action-reason">Add an item first.</span>';
    }
    if(state==='served-single') categories[0].ids=['nasi'];
    if(state==='served-extremes'||state==='served-extremes-86') categories[0].ids=['collisionA','collisionB','long','water','longReal'];
    if(state==='served-categories') categories=Array.from({length:24},(_,i)=>({id:'cat-'+i,name:i===0?'W'.repeat(32):'Category '+(i+1),ids:i===0?['nasi','tea','water']:['tea']}));
    if(state==='served-overflow') categories[0].ids=Array.from({length:80},(_,i)=>{const id='menu-'+i;items[id]={name:'Menu item '+(i+1),price:45000,groups:[],served:true};return id;});
    selected=categories[0].id;
    const rail=$('.catrail');rail.hidden=false;rail.setAttribute('aria-label','Menu categories');
    $('.menuarea').innerHTML='<div id="served-status" class="served-status" role="status" aria-live="polite"></div><div id="served-read"></div><div class="menugrid served-grid" aria-label="Menu items"></div>';

    renderCategories();renderGrid();wirePresets();
    if(state.includes('empty')&&!state.includes('category')&&!state.includes('presets')) showRead('empty');
    if(state==='served-category-empty'){categories[0].ids=[];renderGrid();}
    if(state.includes('loading')) showRead('loading');
    if(state.includes('error')) showRead(state.includes('error-internal')?'internal':'error');
    if(state.includes('stale')) for(let i=0;i<2;i++)refresh('failed');
    if(state==='served-86') refresh('86');
    if(state==='served-extremes-86')refresh('86','long');
    if(state==='served-fireblocked-same'){flow.setModel([{id:'nasi',name:'Nasi Goreng',unit:45000n,q:1,detail:'Regular',round:0},{id:'nasi',name:'Nasi Goreng',unit:50000n,q:2,detail:'With fried egg',round:0}]);refresh('86','nasi');}
    if(state==='served-fireblocked'){flow.setModel([{id:'nasi',name:'Nasi Goreng',unit:45000n,q:1,detail:'',round:0},{id:'tea',name:'Jasmine Tea',unit:18000n,q:1,detail:'',round:0}]);refresh('86','nasi');refresh('86','tea');}
    if(state==='served-restored') {refresh('86');refresh('restore');}
    if(state==='served-archived') refresh('archive');
    if(state==='served-price') {flow.setModel([{id:'nasi',name:'Nasi Goreng',unit:45000n,q:1,detail:'',round:0}]);refresh('price');}
    if(state.startsWith('served-item-')||state.startsWith('quick-served-item-')) {
      const suffix=state.split('item-')[1];
      const id=({none:'nasi',variants:'variants',modifiers:'modifiers',both:'both',many:'many','many-removed':'many',extremes:'extreme',floor:'floor',long:'long',indonesian:'longReal','line-bound':'lineBound','order-bound':'orderBound','choice-bound':'extreme'})[suffix]||'both';
      if(['86','restored','archived','reappeared','price','changed','options','reorder','removed','modifier-removed','choice-bound'].includes(suffix))items[id].groups.forEach(g=>g.selected=[0]);
      if(suffix==='many-removed'){items[id].groups.forEach(g=>g.selected=[0]);items[id].groups[1].options[0][1]=5000;}
      categories[0].ids=[id,'tea','water'];renderGrid();
      if(suffix==='order-bound')flow.setModel([{id:'banquet',name:'Banquet order',unit:10000000n,q:1,detail:'',round:0}]);
      flow.openItem(id,$(`[data-item="${id}"]`));
      if(suffix==='many-removed'){const body=$('.served-drawer .sheet__body');body.scrollTop=body.scrollHeight;api.sheetRefresh('modifier-removed');}
      else if(suffix==='86')refresh('86',id);
      else if(suffix==='archived')refresh('archive',id);
      else if(suffix==='restored'){refresh('86',id);refresh('restore',id);}
      else if(suffix==='reappeared'){refresh('archive',id);refresh('reappear',id);}
      else if(suffix==='choice-bound'){document.querySelector('[data-group="0"][data-option="1"]').click();}
      else if(['price','changed','options','reorder','removed','modifier-removed'].includes(suffix))api.sheetRefresh(suffix);
    }
    if(state.includes('served-presets'))openPresets();
    if(state==='served-line-long'||state==='served-line-indonesian'||state==='quick-served-line'||state==='served-line-bound'||state==='quick-served-line-bound') {
      const item=items[state.endsWith('line-bound')?'lineBound':state==='served-line-indonesian'?'longReal':state==='quick-served-line'?'nasi':'long'];
      flow.setModel([{id:'served-line',name:item.name,unit:BigInt(item.price),q:1,detail:'',round:0}]);
      if(state==='quick-served-line'||state.endsWith('line-bound'))flow.openEdit(0,$('[data-edit]'),state.endsWith('bound')?2:3);
    }
  }
  function wirePresets() {
    $$('.orderpanel .actions a').filter(e=>!e.hidden&&e.textContent.trim()==='Discount').forEach(a=>a.onclick=e=>{e.preventDefault();openPresets();});
  }
  function renderFireNotice() {
    if(quick)return;
    const blocked=flow.getModel().filter(l=>!l.round&&!l.voided&&l.unavailable);
    let notice=$('.served-fire-notice');
    if(!blocked.length){notice?.remove();return;}
    if(!notice){notice=document.createElement('div');notice.className='notice served-fire-notice';$('.lines').after(notice);}
    const names=[...new Map(blocked.map(l=>[l.id,l.name])).values()];
    const singular=blocked.length===1;
    notice.innerHTML=`<div class="notice__t">Cannot send to the kitchen</div><div>${blocked.length} pending ${singular?'line is':'lines are'} no longer available: <b>${names.map(escape).join(', ')}</b>.</div><div>Void ${singular?'that line':'those lines'} or ask a manager to put the ${names.length===1?'item':'items'} back on.</div><button type="button" class="btn btn--sm" id="served-show-blocked">Show unavailable lines</button>`;
    $('#served-show-blocked').onclick=()=>{const i=flow.getModel().findIndex(l=>l.unavailable&&!l.round),line=$(`[data-flow-line="${i}"]`);if(line){line.tabIndex=-1;line.focus();line.scrollIntoView({block:'nearest'});}};
  }
  function openPresets() {
    const subtotal=flow.getModel().reduce((sum,l)=>sum+(l.voided?0n:l.unit*BigInt(l.q)),0n);
    let presets=[
      {id:'comp',name:'Comp',kind:'percent',value:1000000},
      {id:'regular',name:'Regular guest',kind:'percent',value:123456},
      {id:'recovery',name:'Service recovery',kind:'fixed',value:99999999},
      {id:'zero-fixed',name:'Zero amount',kind:'fixed',value:0},
      {id:'zero-rate',name:'Zero percent',kind:'percent',value:0}
    ];
    if(state.endsWith('empty'))presets=[];
    if(state.endsWith('many'))presets=Array.from({length:40},(_,i)=>({id:'preset-'+i,name:i===0?'W'.repeat(32):'Preset '+String(i+1).padStart(2,'0'),kind:i%2?'fixed':'percent',value:i%2?25000:123456}));
    // Stable server order in these examples; never sort by benefit or preselect.
    const source=$$('.actions .btn').find(e=>!e.hidden&&e.textContent==='Discount');
    const body=flow.shell('Discount',subtotal,'<button class="btn" data-cancel>Cancel</button>',source);
    $('.flow-price').remove();
    $('.served-drawer .sheet__head').insertAdjacentHTML('beforeend','<span class="muted">One per order</span>');
    $('.served-drawer .sheet__foot').innerHTML='<button type="button" class="btn" id="served-preset-cancel">Cancel</button>';
    $('#served-preset-cancel').onclick=flow.dismiss;
    body.innerHTML='<span class="label" id="preset-heading" tabindex="-1">Presets — no approval needed</span><div id="served-presets" class="served-presets"></div><span class="label">Anything else</span><a class="btn served-freeform" href="order.html?state=sheet-freeform">Other amount — needs a manager</a>';
    const value=p=>p.kind==='fixed'?fmt(p.value)+' off':(String(Math.floor(p.value/10000))+(p.value%10000?','+String(p.value%10000).padStart(4,'0').replace(/0+$/,''):'')+'%');
    function render() {
      $('#served-presets').innerHTML=presets.length?presets.map(p=>{

        return `<button type="button" class="btn served-preset" data-preset="${p.id}" aria-label="${escape(p.name)} — ${value(p)}"><span>${escape(p.name)}</span><span class="mono">${value(p)}</span></button>`;
      }).join(''):'<div class="empty served-preset-empty">No active presets. A manager can add or activate a preset in the back office.</div>';
      $$('[data-preset]').forEach(b=>b.onclick=()=>{
        const p=presets.find(p=>p.id===b.dataset.preset);
        if(!p)return;
        api.chosenPreset=structuredClone(p);flow.dismiss();
      });
    }
    render();
    api.deactivatePreset=(id='regular',aboutToChoose=false)=>{
      const p=presets.find(p=>p.id===id);if(!p)return;
      const focused=document.activeElement.dataset.preset===id;
      presets=presets.filter(p=>p.id!==id);
      $(`[data-preset="${id}"]`)?.remove();
      if(!presets.length)render();

      if(focused)$('#preset-heading').focus();
    };
    api.editPreset=()=>{const p=presets.find(p=>p.id==='regular');p.name='Returning guest';p.value=125000;const b=$('[data-preset=regular]');b.setAttribute('aria-label',p.name+' — '+value(p));b.firstElementChild.textContent=p.name;b.lastElementChild.textContent=value(p);};
    api.retryPresets=()=>{const focused=document.activeElement.id==='preset-retry';refresh('success');render();if(focused)$('#preset-heading').focus();};
    if(state.endsWith('removed'))api.deactivatePreset('regular');
    if(state.endsWith('changed'))api.editPreset();
    if(readKind==='loading')$('#served-presets').innerHTML='<div class="loadinglabel" role="status">LOADING PRESETS</div>';
    if(readKind==='error'||readKind==='internal'){ $('#served-presets').innerHTML=`<div class="notice" role="alert"><div class="notice__t">${readFailure(readKind).title}</div><div>${readFailure(readKind).body}</div><button type="button" class="btn" id="preset-retry">Try again</button></div>`;$('#preset-retry').onclick=api.retryPresets; }

  }
  function status(text) { $('#served-status').textContent=text; }
  function renderCategories() {
    $('.catrail').innerHTML=categories.map(c=>`<button type="button" class="cat ${c.id===selected?'cat--on':''}" data-category="${c.id}" aria-pressed="${c.id===selected}">${escape(c.name)}</button>`).join('');
    $$('[data-category]').forEach(b=>b.onclick=()=>{selected=b.dataset.category;renderCategories();renderGrid();$(`[data-category="${selected}"]`).focus();});
  }
  function renderGrid() {
    const ids=categories.find(c=>c.id===selected)?.ids||[];
    $('.served-grid').innerHTML=ids.map(id=>{
      const item=items[id], off=!!item.unavailable;
      return `<button type="button" class="tile ${off?'tile--off':''}" data-item="${id}" aria-disabled="${off}" aria-label="${escape(item.name)}, ${fmt(item.price)}${off?', unavailable, 86':''}"><span class="served-tile-name">${escape(item.name)}</span><span class="served-tile-bottom"><span class="tile__p">${fmt(item.price)}</span>${off?'<span class="tag tag--86">86</span>':''}</span></button>`;
    }).join('');
    if(!ids.length)$('.served-grid').innerHTML='<div class="served-category-empty">No items in this category yet.</div>';
    $$('[data-item]').forEach(b=>b.onclick=()=>{if(!items[b.dataset.item].unavailable)flow.openItem(b.dataset.item,b);});
  }
  function readFailure(kind) {
    return kind==='internal'?{title:'Something went wrong',body:'Try again. If the problem continues, ask a manager for help.'}:{title:'The system is unavailable',body:'Wait a moment, then try again.'};
  }
  function showRead(kind) {
    const active=document.activeElement;
    const lost=active===document.body||$('#served-read').contains(active)||$('.catrail').contains(active)||$('.served-grid').contains(active);
    readKind=kind;
    if($('#served-action-reason'))$('#served-action-reason').textContent='No items on this order yet.';
    $('.catrail').hidden=true;$('.served-grid').hidden=true;
    const read=$('#served-read');
    if(kind==='empty') read.innerHTML='<div class="empty served-empty" tabindex="-1" id="served-empty"><b>No menu items yet</b><div>There is nothing to add yet. A manager adds the menu in the back office.</div></div>';
    else if(kind==='loading') read.innerHTML='<div class="served-loading" role="status"><div class="loadinglabel">LOADING MENU</div><div class="skel skel--w80"></div><div class="skel skel--w60"></div><div class="skel skel--w40"></div></div>';
    else {
      read.innerHTML=`<div class="notice served-read-error" role="alert"><div class="notice__t">${readFailure(kind).title}</div><div>${readFailure(kind).body}</div><button type="button" class="btn" id="served-retry">Try again</button></div>`;
      $('#served-retry').onclick=()=>{const focused=document.activeElement.id==='served-retry';showRead('loading');refresh('success');if(focused)$('.cat').focus();};
      // Fresh-mount pictures start on body; a background failure keeps any surviving control focused.
      if(lost)$('#served-retry').focus();
    }
  }
  function archive(id) {
    const button=$(`[data-item="${id}"]`), focused=document.activeElement===button;
    // Only 86 holds a slot. Items absent from the current projection reflow.
    categories.forEach(c=>c.ids=c.ids.filter(x=>x!==id));
    button?.remove();
    if(!categories.find(c=>c.id===selected)?.ids.length)renderGrid();
    if(focused)$(`[data-category="${selected}"]`).focus();
  }
  function refresh(kind,id='nasi') {
    if(kind==='failed') {failures++;if(failures>=2){stale=true;availabilityStatus='';status('The menu may be out of date. You can keep taking orders.');}return;}
    if(kind==='success') {readKind='ready';if($('#served-action-reason'))$('#served-action-reason').textContent='Add an item first.';const lost=document.activeElement.id==='served-retry';failures=0;stale=false;status(availabilityStatus);$('#served-read').innerHTML='';$('.catrail').hidden=false;$('.served-grid').hidden=false;if(lost)$('.cat').focus();return;}
    // Every change below is an accepted current projection; unchanged polls retain status.
    if((kind==='86'||kind==='restore')&&!!items[id].unavailable===(kind==='86')){refresh('success');return;}
    failures=0;stale=false;availabilityStatus='';status('');
    if(api.sheetRefresh&&api.sheetItemId===id)api.sheetRefresh(kind==='archive'?'archived':kind==='reappear'?'restore':kind);
    if(kind==='archive') {archive(id);return;}
    if(kind==='reappear'){categories[0].ids.unshift(id);renderGrid();return;}
    if(kind==='category-removed'){const lost=document.activeElement.dataset.category===selected||document.activeElement.hasAttribute('data-item');categories=[{id:'drinks',name:'Drinks',ids:['tea','water']}];selected='drinks';renderCategories();renderGrid();if(lost)$('.cat').focus();return;}
    const b=$(`[data-item="${id}"]`), item=items[id];
    if(kind==='86'||kind==='restore') {
      item.unavailable=kind==='86';
      const affected=flow.getModel().filter(l=>l.id===id&&!l.round);
      affected.forEach(l=>l.unavailable=item.unavailable);
      if(affected.length)flow.renderOrder();else flow.wireFire();
      if(b){b.classList.toggle('tile--off',item.unavailable);b.setAttribute('aria-disabled',String(item.unavailable));b.setAttribute('aria-label',`${item.name}, ${fmt(item.price)}${item.unavailable?', unavailable, 86':''}`);$('.tag',b)?.remove();if(item.unavailable)$('.served-tile-bottom',b).insertAdjacentHTML('beforeend','<span class="tag tag--86">86</span>');}
      availabilityStatus='Menu availability updated.';status(availabilityStatus);
    }
    if(kind==='price'){item.price=50000;if(b){$('.tile__p',b).textContent=fmt(item.price);b.setAttribute('aria-label',`${item.name}, ${fmt(item.price)}`);}}
  }
})();
