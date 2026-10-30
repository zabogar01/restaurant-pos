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
  const emptyOrder = /empty$|loading|error/.test(state);
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
  let flow, selected = 'meals', stale = false, pointer = false, heldArchive = null;
  let categories = [{id:'meals',name:'Meals',ids:['nasi','tea','water']}];
  const api = window.ServedCatalogFixture = {items,base:emptyOrder?'empty':quick?'quick':'default',start,refresh,escape,fmt};
  function start(bridge) {
    flow = bridge;
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
      actions.setAttribute('aria-label','Add an item before using order actions');
      actions.innerHTML=['Discount','Void order',...(quick?[]:['Send to kitchen']),quick?'Settle — sends the order to the kitchen':'Settle'].map(t=>`<button type="button" class="btn btn--off ${t.startsWith('Settle')?'btn--primary':''}" aria-disabled="true" aria-describedby="served-action-reason">${t}</button>`).join('')+'<span class="muted" id="served-action-reason">Add an item first.</span>';
    }
    if(state==='served-single') categories[0].ids=['nasi'];
    if(state==='served-extremes') categories[0].ids=['collisionA','collisionB','long','water','longReal'];
    if(state==='served-categories') categories=Array.from({length:24},(_,i)=>({id:'cat-'+i,name:i===0?'W'.repeat(32):'Category '+(i+1),ids:i===0?['nasi','tea','water']:['tea']}));
    if(state==='served-overflow') categories[0].ids=Array.from({length:80},(_,i)=>{const id='menu-'+i;items[id]={name:'Menu item '+(i+1),price:45000,groups:[],served:true};return id;});
    selected=categories[0].id;
    const rail=$('.catrail');rail.hidden=false;rail.setAttribute('aria-label','Menu categories');
    $('.menuarea').innerHTML='<div id="served-status" class="served-status" role="status" aria-live="polite"></div><div id="served-read"></div><div class="menugrid served-grid" aria-label="Menu items"></div>';
    const grid=$('.served-grid');
    grid.addEventListener('pointerdown',()=>pointer=true);
    const release=()=>{pointer=false;if(heldArchive){const id=heldArchive;heldArchive=null;archive(id);}};
    window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
    renderCategories();renderGrid();
    if(state.includes('empty')) showRead('empty');
    if(state.includes('loading')) showRead('loading');
    if(state.includes('error')) showRead(state.endsWith('internal')?'internal':'error');
    if(state.includes('stale')) refresh('failed');
    if(state==='served-86') refresh('86');
    if(state==='served-restored') {refresh('86');refresh('restore');}
    if(state==='served-archived') refresh('archive');
    if(state==='served-price') {flow.setModel([{id:'nasi',name:'Nasi Goreng',unit:45000n,q:1,detail:'',round:0}]);refresh('price');}
    if(state.startsWith('served-item-')||state.startsWith('quick-served-item-')) {
      const suffix=state.split('item-')[1];
      const id=({none:'nasi',variants:'variants',modifiers:'modifiers',both:'both',many:'many',extremes:'extreme',floor:'floor',long:'long',indonesian:'longReal'})[suffix]||'both';
      if(['86','archived','price','options','removed'].includes(suffix))items[id].groups.forEach(g=>g.selected=[0]);
      flow.openItem(id,$('[data-item]'));
      if(['86','archived','price','options','removed'].includes(suffix))api.sheetRefresh(suffix);
    }
    if(state==='served-line-long'||state==='served-line-indonesian'||state==='quick-served-line') {
      const item=items[state==='served-line-indonesian'?'longReal':state==='quick-served-line'?'nasi':'long'];
      flow.setModel([{id:'served-line',name:item.name,unit:BigInt(item.price),q:1,detail:'',round:0}]);
      if(state==='quick-served-line')flow.openEdit(0,$('[data-edit]'),3);
    }
  }
  function status(text) { $('#served-status').textContent=text; }
  function renderCategories() {
    $('.catrail').innerHTML=categories.map(c=>`<button type="button" class="cat ${c.id===selected?'cat--on':''}" data-category="${c.id}" aria-pressed="${c.id===selected}">${escape(c.name)}</button>`).join('');
    $$('[data-category]').forEach(b=>b.onclick=()=>{selected=b.dataset.category;renderCategories();renderGrid();$(`[data-category="${selected}"]`).focus();});
  }
  function renderGrid() {
    $('.served-grid').innerHTML=(categories.find(c=>c.id===selected)?.ids||[]).map(id=>{
      const item=items[id], off=!!item.unavailable;
      return `<button type="button" class="tile ${off?'tile--off':''}" data-item="${id}" aria-disabled="${off}" aria-label="${escape(item.name)}, ${fmt(item.price)}${off?', unavailable, 86':''}"><span class="served-tile-name">${escape(item.name)}</span><span class="served-tile-bottom"><span class="tile__p">${fmt(item.price)}</span>${off?'<span class="tag tag--86">86</span>':''}</span></button>`;
    }).join('');
    $$('[data-item]').forEach(b=>b.onclick=()=>{if(!items[b.dataset.item].unavailable)flow.openItem(b.dataset.item,b);});
  }
  function showRead(kind) {
    $('.catrail').hidden=true;$('.served-grid').hidden=true;
    const read=$('#served-read');
    if(kind==='empty') read.innerHTML='<div class="empty served-empty" tabindex="-1" id="served-empty"><b>No menu items yet</b><div>There is nothing to add yet. A manager adds the menu in the back office.</div></div>';
    else if(kind==='loading') read.innerHTML='<div class="served-loading" role="status"><div class="loadinglabel">LOADING MENU</div><div class="skel skel--w80"></div><div class="skel skel--w60"></div><div class="skel skel--w40"></div></div>';
    else {
      read.innerHTML=`<div class="notice served-read-error" role="alert"><div class="notice__t">${kind==='internal'?'Something went wrong':'The system is unavailable'}</div><div>${kind==='internal'?'Try again. If the problem continues, ask a manager for help.':'Wait a moment, then try again.'}</div><button type="button" class="btn" id="served-retry">Try again</button></div>`;
      $('#served-retry').onclick=()=>{showRead('loading');refresh('success');$('.cat').focus();};
      $('#served-retry').focus();
    }
  }
  function archive(id) {
    const button=$(`[data-item="${id}"]`), focused=document.activeElement===button;
    // A blank slot survives the current category visit; remaining hit targets never move.
    if(button) {button.replaceWith(Object.assign(document.createElement('div'),{className:'served-removed-slot'}));}
    categories.forEach(c=>c.ids=c.ids.filter(x=>x!==id));
    status(`${items[id].name} is no longer on the menu.`);
    if(focused)$(`[data-category="${selected}"]`).focus();
  }
  function refresh(kind,id='nasi') {
    if(kind==='failed') {stale=true;status('The menu may be out of date. You can keep taking orders.');return;}
    if(kind==='success') {stale=false;status('');$('#served-read').innerHTML='';$('.catrail').hidden=false;$('.served-grid').hidden=false;return;}
    if(kind==='archive') {if(pointer){heldArchive=id;return;}archive(id);return;}
    const b=$(`[data-item="${id}"]`), item=items[id];
    if(kind==='86'||kind==='restore') {
      item.unavailable=kind==='86';
      if(b){b.classList.toggle('tile--off',item.unavailable);b.setAttribute('aria-disabled',String(item.unavailable));b.setAttribute('aria-label',`${item.name}, ${fmt(item.price)}${item.unavailable?', unavailable, 86':''}`);$('.tag',b)?.remove();if(item.unavailable)$('.served-tile-bottom',b).insertAdjacentHTML('beforeend','<span class="tag tag--86">86</span>');}
      if(!stale)status('Menu availability updated.');
    }
    if(kind==='price'){item.price=50000;if(b){$('.tile__p',b).textContent=fmt(item.price);b.setAttribute('aria-label',`${item.name}, ${fmt(item.price)}`);}}
  }
})();
