/* DESIGN-020 local review drawing. No API, credential submission or storage.
   URL subject/return snapshots are review plumbing only; S4c uses the real catalog read. */
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const params=new URLSearchParams(location.search), state=params.get('state')||'default';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const focus=s=>$(s)?.focus();
  const categories=[{id:'mains',name:'Mains',active:true,order:0},{id:'sides',name:'Sides',active:true,order:1},{id:'drinks',name:'Drinks',active:true,order:2},{id:'seasonal',name:'Seasonal',active:false,order:3}];
  const records=[['burger','Burger','mains','100000',3,3,true,true],['wings','Chicken Wings','mains','90000',0,1,true,true],['steak','Steak','mains','240000',3,2,true,true],['fish','Fish & Chips','mains','140000',0,0,true,true],['salad','Caesar Salad','mains','75000',2,2,true,true],['stew','Winter Stew','mains','110000',0,0,false,true],['fries','Fries','sides','40000',2,0,true,true],['soda','Soda','drinks','30000',0,0,true,false],['pie','Apple Pie','seasonal','65000',0,0,true,true],['iced','Spiced Iced Tea','seasonal','35000',0,0,true,false]].map(([id,name,category,price,variants,modifiers,active,available],order)=>({id,name,category,price,variants,modifiers,active,available,order}));
  const category=id=>categories.find(c=>c.id===id);
  // Only the fields drawn by BO-03 cross the URL. Option rows below are illustrative, not saved configuration.
  function readSnapshot(key){try{return JSON.parse(params.get(key));}catch{return null;}}
  const suppliedCategory=readSnapshot('fixtureCategory');
  if(suppliedCategory?.id===params.get('category')){const c=category(suppliedCategory.id);if(c)Object.assign(c,suppliedCategory);else categories.push(suppliedCategory);}
  const isNew=['new','duplicate-create','create-category-archived'].includes(state);
  let id=params.get('item')||(['archived'].includes(state)?'stew':state==='eightysix'?'soda':state==='none'?'fish':'burger');
  let row=records.find(x=>x.id===id), supplied=readSnapshot('fixtureItem');
  if(supplied?.id===id)row=supplied;
  // BO-03's overflow stress rows. The index is fixture identity only, never money.
  const stressIndex=/^long-\d+$/.test(id)?Number(id.slice(5)):-1;
  if(!row&&stressIndex>=0){row={id,name:('Menu item '+String(stressIndex+1).padStart(2,'0')+' ').padEnd(80,'W'),category:'mains',variants:3,modifiers:2,active:true,available:true,order:20+stressIndex};row.price='99999999';}
  let missing=(!isNew&&!row)||(isNew&&!category(params.get('category')||'mains'))||state==='not-found';
  const optionRows=(kind,n)=>Array.from({length:n},(_,i)=>({id:kind+'-'+(i+1),name:(kind==='variant'?['Regular','Large','Small']:['Extra cheese','Bacon','No onion'])[i]||kind+' '+(i+1),delta:(kind==='variant'?['0','20000','-10000']:['15000','20000','0'])[i]||'0'}));
  let server=isNew?null:row?{...copy(row),variants:optionRows('variant',row.variants),modifiers:optionRows('modifier',row.modifiers)}:null;
  const blank=()=>({id:null,name:'',category:params.get('category')||'mains',price:'',variants:[],modifiers:[]});
  let original=copy(server||blank()), draft=copy(original), current=copy(server), version=12, base=12, factsVersion=12;
  let pending=null, held=null, gate=null, decisionHeld=false, leaveAction=null, otherStep=0, unknown=false, stale=false, readFailed=false, refusedCategory=false, closed=false, seq=0, lastField='item-name', savedAnswer=null;
  const errors=new Map();
  const fx={commands:[],reads:0,get draft(){return draft;},get original(){return original;},get current(){return current;},get base(){return base;},get version(){return version;},get pending(){return !!pending;},get stale(){return stale;},get unknown(){return unknown;},get newItem(){return isNew&&!savedAnswer;},money:parseMoney,otherTab(){version++;},get changes(){return changes(original,draft);}};
  window.ItemFixture=fx;
  function money(s){return String(s).replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
  // A field shows a valid amount grouped, and anything else exactly as the manager typed it.
  function shown(raw,kind){const p=parseMoney(String(raw),kind);return p.value!==undefined?money(p.value):String(raw);}
  // All money stays string/BigInt. Dot is grouping, never a decimal separator.
  function parseMoney(raw,kind){
    const s=raw.trim();if(!s)return {error:kind==='base'?'Enter a base price.':'Enter a price change.'};
    if(kind!=='variant'&&s.startsWith('-'))return {error:'Use 0 or more.'};
    const pattern=kind==='variant'?/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)$/ : /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;
    if(!pattern.test(s))return {error:kind==='variant'?'Enter whole rupiah, such as 10.000 or -10.000.':'Enter whole rupiah, such as 10.000.'};
    const n=BigInt(s.replaceAll('.',''));
    if(n>99999999n||n< -99999999n)return {error:kind==='variant'?'Use a price change from -99.999.999 to 99.999.999.':'Use 99.999.999 or less.'};
    return {value:n.toString()};
  }
  const listKey=kind=>kind==='variant'?'variants':'modifiers';
  const optionId=(kind,r,field)=>kind+'-'+r.id+'-'+field;
  const normalized=d=>({...copy(d),name:d.name.trim(),price:parseMoney(d.price,'base').value||d.price,variants:d.variants.map(r=>({...r,name:r.name.trim(),delta:parseMoney(r.delta,'variant').value||r.delta})),modifiers:d.modifiers.map(r=>({...r,name:r.name.trim(),delta:parseMoney(r.delta,'modifier').value||r.delta}))});
  function changes(from,to){
    const a=normalized(from),b=normalized(to),result={fields:{},variants:{added:[],edited:[],removed:[],order:[]},modifiers:{added:[],edited:[],removed:[],order:[]}};
    for(const k of ['name','price','category'])if(a[k]!==b[k])result.fields[k]=b[k];
    for(const k of ['variants','modifiers']){
      const active=b[k].filter(r=>!r.removed),before=a[k].filter(r=>!r.removed);
      for(const r of active){const old=before.find(x=>x.id===r.id);if(!old)result[k].added.push({draftId:r.id,name:r.name,delta:r.delta});else{const change={id:r.id};for(const f of ['name','delta'])if(old[f]!==r[f])change[f]=r[f];if(Object.keys(change).length>1)result[k].edited.push(change);}}
      result[k].removed=before.filter(r=>!active.some(x=>x.id===r.id)).map(r=>r.id);
      if(before.map(r=>r.id).join()!==active.map(r=>r.id).join())result[k].order=active.map(r=>r.id);
    }return result;
  }
  function dirty(){return !closed&&(!!pending||unknown||JSON.stringify(normalized(draft))!==JSON.stringify(normalized(original)));}
  function showNotice(title,body,kind='status',takeFocus=false){$('#form-notice').hidden=!title;$('#notice-title').textContent=title;$('#notice-body').textContent=body;$('#form-notice').dataset.kind=kind;$('#form-notice').setAttribute('role',kind==='failure'||kind==='stale'?'alert':'status');if(takeFocus)focus('#form-notice');}
  function errorFor(field,text){if(text)errors.set(field,text);else errors.delete(field);const el=$('#'+field),error=$('#'+field+'-error');if(!el||!error)return;error.hidden=!text;error.textContent=text||'';if(text)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');const help=$('#'+field+'-help');el.setAttribute('aria-describedby',[text?error.id:'',help?.id||''].filter(Boolean).join(' '));}
  function nameError(raw,kind){const s=raw.trim(),limit=kind==='item'?64:32;return !s?'Enter '+(kind==='item'?'an item':'a '+kind)+' name.':[...s].length>limit?'Use '+limit+' characters or fewer.':/\p{Cc}/u.test(s)?'Remove control characters from the '+kind+' name.':'';}
  function validate(){
    errors.clear();draft.name=draft.name.trim();errorFor('item-name',nameError(draft.name,'item'));
    const selected=category(draft.category),staying=!isNew&&draft.category===original.category;
    errorFor('item-category',!selected?'Choose a category.':!selected.active&&!staying?'This category is archived. Choose another category.':'');
    const price=parseMoney(draft.price,'base');errorFor('item-price',price.error);if(price.value!==undefined)draft.price=price.value;
    for(const kind of ['variant','modifier']){
      const rows=draft[listKey(kind)].filter(r=>!r.removed),seen=new Set();
      for(const r of rows){r.name=r.name.trim();let e=nameError(r.name,kind);if(!e&&seen.has(r.name.toLowerCase()))e='Another '+kind+' uses this name. Choose another name.';seen.add(r.name.toLowerCase());errors.set(optionId(kind,r,'name'),e);const amount=parseMoney(r.delta,kind);errors.set(optionId(kind,r,'delta'),amount.error||'');if(amount.value!==undefined)r.delta=amount.value;}
    }
    for(const [k,v] of errors)if(!v)errors.delete(k);
    render();for(const [k,v] of errors)errorFor(k,v);if(errors.size)focus('#'+errors.keys().next().value);return !errors.size;
  }
  function options(kind){
    const rows=draft[listKey(kind)],active=rows.filter(r=>!r.removed);
    $('#'+kind+'-list').innerHTML=!rows.length?'<p class="item-list-empty">No '+(kind==='variant'?'variants':'modifiers')+' yet. Use Add '+kind+' to add the first choice.</p>':rows.map(r=>{
      const i=active.indexOf(r),name=r.name||'Unnamed '+kind,ref=esc(r.id);
      if(r.removed)return '<div class="item-option" data-kind="'+kind+'" data-option="'+ref+'" data-removed="true"><p><strong>'+esc(name)+'</strong><br>Will be removed when you save.</p><div class="office-actions"><button type="button" class="office-button small" data-option-action="undo" aria-label="Undo removal of '+kind+' '+esc(name)+'">Undo</button></div></div>';
      // Field labels and control names use the row's position, which every render keeps current;
      // a typed name would leave the buttons' names stale until the next render.
      const n=optionId(kind,r,'name'),d=optionId(kind,r,'delta'),label=(kind==='variant'?'Variant ':'Modifier ')+(i+1);
      return '<div class="item-option" data-kind="'+kind+'" data-option="'+ref+'" data-new="'+!!r.new+'"><div><div class="item-option-label"><label for="'+n+'">'+label+' name</label>'+(r.new?'<span>New · not saved yet</span>':'')+'</div><input class="office-field" id="'+n+'" value="'+esc(r.name)+'" data-option-field="name"><span class="office-error" id="'+n+'-error" hidden></span></div><div><div class="item-option-label"><label for="'+d+'">'+label+' price change</label></div><input class="office-field" id="'+d+'" value="'+esc(shown(r.delta,kind))+'" data-option-field="delta" inputmode="'+(kind==='variant'?'text':'numeric')+'"><span class="office-error" id="'+d+'-error" hidden></span></div><div class="office-actions">'+['up','down','remove'].map(action=>'<button type="button" class="office-button small'+(action==='remove'?' danger':'')+'" data-option-action="'+action+'" aria-label="'+(action==='remove'?'Remove':'Move '+action)+' '+label.toLowerCase()+'" '+((action==='up'&&i===0)||(action==='down'&&i===active.length-1)?'disabled':'')+'>'+(action==='remove'?'Remove':'Move '+action)+'</button>').join('')+'</div><p class="item-option-note" data-preview="'+ref+'"></p></div>';
    }).join('');
    preview();
  }
  function preview(){
    const p=parseMoney(draft.price,'base');
    for(const r of draft.variants){const el=$('[data-kind="variant"] [data-preview="'+r.id+'"]');if(!el)continue;const d=parseMoney(r.delta,'variant');if(p.error||d.error){el.textContent='Enter a valid base price and price change to see this variant’s price.';continue;}const sum=BigInt(p.value)+BigInt(d.value);el.textContent='Without modifiers: '+money(sum<0n?'0':sum.toString())+(sum<0n?' · Base price plus this change is below zero, so the price floors at 0.':sum>99999999n?' · More than the largest line total, 99.999.999.':'');}
  }
  function render(){
    $('#item-title').textContent=isNew&&!savedAnswer?'New item':(original.name||'Item editor');
    $('#item-status').textContent=isNew&&!savedAnswer?'Not saved yet':!original.active?'Archived item':original.available?'Available':'86 · Unavailable';
    $('#item-context').textContent=!isNew&&!original.active?'Archived item. Saving does not restore it. Availability and archive actions are on Menu. Existing orders keep their saved names and prices.':!isNew&&!original.available?'86 · Unavailable. Saving does not make it available. Availability and archive actions are on Menu. Existing orders keep their saved names and prices.':'Save the item, its variants and its modifiers together. Existing orders keep their saved names and prices.';
    $('#item-form').hidden=closed||missing;$('#closed-actions').hidden=!closed&&!missing;
    $('#item-name').value=draft.name;$('#item-price').value=shown(draft.price,'base');
    $('#item-category').innerHTML='<option value="">Choose a category</option>'+categories.filter(c=>c.active||c.id===draft.category||c.id===original.category).map(c=>'<option value="'+esc(c.id)+'" '+(c.id===draft.category?'selected ':'')+(!c.active&&c.id!==original.category?'disabled':'')+'>'+esc(c.name)+(c.active?'':' · Archived')+'</option>').join('');
    options('variant');options('modifier');
    $('#version-facts').textContent=readFailed?'':isNew&&!savedAnswer?'Not saved yet. This new item does not replace an existing item.':'Menu version '+factsVersion+' · Availability and archive status are managed on Menu.';
    $('#comparison').hidden=!stale||readFailed;$('#retry-read').hidden=!readFailed;
    $$('#item-form input,#item-form select,#add-variant,#add-modifier,[data-option-action]').forEach(e=>{if(pending)e.disabled=true;else if(!e.dataset.optionAction||e.dataset.optionAction==='remove'||e.dataset.optionAction==='undo')e.disabled=false;});
    $('#save-item').disabled=!!pending||stale||errors.size>0||refusedCategory;
    $('#save-hint').textContent=pending?'Wait for the save result.':stale?'Choose which version to keep before saving.':refusedCategory?'Choose an active category before saving.':errors.size?'Correct the marked fields before saving.':'All changes are saved together.';
    $('#save-item').setAttribute('aria-describedby','save-hint');
    for(const [k,v] of errors)errorFor(k,v);
  }
  function comparison(){
    if(!current)return;
    const mine=normalized(draft),differs=k=>mine[k]!==current[k];
    let html='<dl>'+[['Item name',current.name,differs('name')],['Category',category(current.category)?.name||current.category,differs('category')],['Base price',money(current.price),differs('price')],['Status',(!current.active?'Archived item · ':'')+(current.available?'Available':'86 · Unavailable'),false]].map(([k,v,d])=>'<dt>'+k+'</dt><dd'+(d?' data-differs="true"':'')+'>'+esc(v)+(d?'<span>Differs from your draft</span>':'')+'</dd>').join('')+'</dl>';
    for(const kind of ['variant','modifier']){const k=listKey(kind);html+='<h3>'+(kind==='variant'?'Variants':'Modifiers')+' · current order</h3><ol>'+current[k].map(r=>'<li>'+esc(r.name)+' · '+money(r.delta)+'</li>').join('')+'</ol>';if(!current[k].length)html+='<p>No '+k+'.</p>';for(const r of original[k].filter(r=>!current[k].some(x=>x.id===r.id)))html+='<p>'+esc(r.name)+' · Removed from the current item.</p>';}
    $('#current-values').innerHTML=html;
  }
  function removedChanged(){const changed=changes(original,draft);return ['variants','modifiers'].flatMap(k=>draft[k].filter(r=>!r.new&&!r.removed&&!current[k].some(x=>x.id===r.id)&&(changed[k].edited.some(x=>x.id===r.id)||(changed[k].order.length&&original[k].findIndex(x=>x.id===r.id)!==draft[k].filter(x=>!x.removed).findIndex(x=>x.id===r.id)))).map(r=>r.name));}
  function showStale(isUnknown=false){
    stale=true;unknown=isUnknown;comparison();const names=removedChanged();
    let body=isUnknown?'The menu has been read again at version '+factsVersion+'. It may include this save. Your draft is kept; nothing was sent again.':'Nothing was saved. The menu has been read again at version '+factsVersion+'. Your draft is kept.';
    if(JSON.stringify(normalized(draft))===JSON.stringify(normalized(current)))body+=' The current item has the same values as your draft.';
    if(names.length)body+=' Keep my changes will add '+names.join(', ')+' again as new choices because they were removed from the current item. Use current item drops them.';
    showNotice(isUnknown?'Outcome not confirmed':'The menu changed while you were editing',body,'stale');render();focus('#form-notice');
  }
  // Lead ruling: preserve intentional child changes over current rows. An externally removed,
  // untouched row disappears; a changed one becomes an explicitly new row, never a restore.
  function keepChildren(k){
    const before=normalized(original)[k],wanted=normalized(draft)[k],now=copy(current[k]),delta=changes(original,draft)[k];
    let merged=now.filter(r=>!delta.removed.includes(r.id));
    for(const r of wanted.filter(r=>!r.removed)){
      const old=before.find(x=>x.id===r.id),live=merged.find(x=>x.id===r.id),edit=delta.edited.find(x=>x.id===r.id);
      const moved=!!old&&delta.order.length>0&&before.findIndex(x=>x.id===r.id)!==wanted.filter(x=>!x.removed).findIndex(x=>x.id===r.id);
      if(!old)merged.push(copy(r));
      else if(live&&edit)Object.assign(live,edit);
      else if(!live&&(edit||moved)){r.id='new-'+(++seq);r.new=true;merged.push(copy(r));}
    }
    if(delta.order.length)merged.sort((a,b)=>{const order=r=>{const i=wanted.findIndex(x=>x.id===r.id);return i<0?wanted.length: i;};return order(a)-order(b);});
    // Retain pending-removal rows until the answered Save, with an Undo affordance.
    for(const r of wanted.filter(r=>r.removed&&now.some(x=>x.id===r.id)))merged.push(copy(r));
    return merged;
  }
  function chooseCurrent(keep){
    if(!stale||readFailed)return;
    if(keep){draft.variants=keepChildren('variants');draft.modifiers=keepChildren('modifiers');}else draft=copy(current);
    original=copy(current);base=factsVersion;stale=false;errors.clear();refusedCategory=false;readFailed=false;
    showNotice(keep?'Your changes are kept':'Current item loaded',keep?'Your changes now build on menu version '+base+'. Nothing has been saved yet. Review the marked fields, then press Save.':'The form now shows menu version '+base+'. Nothing was saved.');
    render();if(keep){if(validate())focus('#save-item');}else focus('#item-name');
  }
  function reread(succeeds=true){fx.reads++;readFailed=!succeeds;if(succeeds){current=copy(server);factsVersion=version;}}
  function summary(r){return {id:r.id,name:r.name,category:r.category,price:r.price,variants:r.variants.filter(x=>!x.removed).length,modifiers:r.modifiers.filter(x=>!x.removed).length,active:r.active??true,available:r.available??true,order:r.order??records.length};}
  function returnHref(answer=false){const q=new URLSearchParams({item:answer?savedAnswer.id:params.get('returnItem')||(!isNew?id:''),returnItem:params.get('returnItem')||'',category:answer?savedAnswer.category:original.category});if(answer){q.set('returnedItem',JSON.stringify(summary(savedAnswer)));if(answer==='unchanged'){q.set('saved','unchanged');q.set('version',String(version));}else q.set('saved','1');q.set('returnedCategory',JSON.stringify(category(savedAnswer.category)));}else if(row)q.set('returnedItem',JSON.stringify(row));return 'menu.html?'+q;}
  function submit(){
    if(closed||missing||pending||stale||refusedCategory)return;if(!validate())return;
    const value=normalized(draft),command={kind:isNew&&!savedAnswer?'create':'edit',item:id,expected:isNew&&!savedAnswer?null:base,changes:changes(original,draft),value};
    pending=command;unknown=false;showNotice('Saving…','Wait for the result. Your draft is kept.');fx.commands.push(copy(command));render();focus('#form-notice');const answer=$('#fixture-response').value;if(answer!=='pending')queueMicrotask(()=>finish(answer));
  }
  function apply(c){const next=copy(c.value);next.id=next.id||'created-item';for(const k of ['variants','modifiers'])next[k]=next[k].filter(r=>!r.removed).map(r=>{const clean={id:r.new?'saved-'+r.id:r.id,name:r.name,delta:r.delta};return clean;});next.active=next.active??true;next.available=next.available??true;const changed=JSON.stringify(normalized(server||blank()))!==JSON.stringify(normalized(next));if(changed)version++;server=next;return changed;}
  function finish(answer){
    if(!pending)return;if(gate||$('#departure').open){held=answer;return;}const c=pending;pending=null;
    if(c.departed){if(answer==='saved')apply(c);showNotice('','');$('#saved-result').hidden=true;return;}
    if(answer==='saved'&&c.expected!==null&&c.expected!==version)answer='stale';
    if(answer==='saved'&&!category(c.value.category)?.active&&(c.kind==='create'||c.value.category!==original.category))answer='category-archived';
    const holder=records.find(r=>(c.kind==='create'||r.id!==id)&&r.active&&r.name.toLowerCase()===c.value.name.toLowerCase());
    if(answer==='saved'&&(c.kind==='create'||original.active)&&holder)answer='duplicate';
    if(answer==='saved'){
      const changed=apply(c);base=version;factsVersion=version;savedAnswer=copy(server);original=copy(server);draft=copy(server);closed=true;errors.clear();render();$('#saved-result').hidden=false;$('#saved-result').textContent=changed?savedAnswer.name+' saved.':'Nothing changed. Menu version '+version+' is still current.';const result=changed?true:'unchanged';$('#return-menu').href=returnHref(result);focus('#return-menu');if(params.get('return')==='frost-menu'&&!['saved','unchanged'].includes(state))location.href=returnHref(result);return;
    }
    if(answer==='idle'||answer==='ended'){showNotice('Nothing was saved','Your draft is kept. Press Save to try again.');render();session(answer);return;}
    if(answer==='duplicate'){
      reread();render();const h=holder||records.find(r=>r.id==='burger');errorFor('item-name',category(h.category)?.active?'An active item already uses this name. Choose another name.':'An active item in an archived category still uses this name. Choose another name.');$('#duplicate-holder').hidden=false;$('#duplicate-holder').innerHTML='Name held by '+esc(h.name)+' in '+esc(category(h.category)?.name||h.category)+'. <a href="menu.html?item='+esc(h.id)+'">View item on Menu</a>';$('#save-item').disabled=true;focus('#item-name');return;
    }
    if(answer==='category-archived'){
      category(draft.category).active=false;version++;reread();refusedCategory=true;showNotice('The category was archived','Nothing was saved. Your draft is kept. Choose another category before saving.','failure');if(c.kind==='edit'){showStale();$('#notice-body').textContent+=' The destination category was archived. Choose another category after deciding which version to keep.';}render();errorFor('item-category','This category is archived. Choose another category.');focus(c.kind==='create'?'#item-category':'#form-notice');return;
    }
    if(answer==='stale'&&c.kind==='edit'){
      if(version===base){version++;server.price='110000';if(server.variants[0])server.variants[0].delta='5000';}reread();showStale();return;
    }
    if(answer.startsWith('unknown')){
      unknown=true;if(answer==='unknown-changed')apply(c);reread(answer!=='unknown-read-failed');
      if(!readFailed&&c.kind==='edit'&&factsVersion!==base){showStale(true);return;}
      showNotice('Outcome not confirmed',readFailed?'The item could not be read again. Your draft is kept; nothing was sent again. Try again reads the menu only.':'The menu has been read again. Your draft is kept; nothing was sent again.');render();focus('#item-name');return;
    }
    showNotice('Something went wrong','Nothing was saved. Your draft is kept. Press Save to try again.','failure');render();focus('#item-name');
  }
  function emergency(el,sentence,action=false){el.hidden=!Office.kitchen;if(!Office.kitchen)return;el.className='office-emergency';el.innerHTML='<div><strong>'+esc(Office.kitchenIncident.title)+'</strong><p>'+esc(Office.kitchenIncident.identity)+'</p><p>'+sentence+'</p></div>'+(action?'<button class="office-button" id="gate-incidents">Open print incidents after sign-in</button>':'');}
  function leave(action,logout=false){
    if(!dirty()){action();return;}leaveAction=action;
    $('#departure-title').textContent=logout?'Log out and discard your changes?':'Discard unsaved changes?';
    $('#departure-body').textContent=logout?'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.':pending||unknown?'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.':'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
    $('#departure-context').hidden=!logout||!(pending||unknown);$('#departure-context').textContent='The save may or may not have succeeded. Leaving does not send it again.';
    $('#stay').textContent=logout?'Keep this draft':'Stay';$('#discard').textContent=logout?'Discard changes and log out':'Discard';
    emergency($('#departure-emergency'),logout?'Decide whether to keep this draft or discard it before opening print incidents.':'Decide whether to stay or discard before opening print incidents.');Office.open($('#departure'),$('#stay'));
  }
  function restoreFocus(){const el=$('#'+lastField);if(el&&!el.disabled&&el.getClientRects().length)el.focus();else if(pending)focus('#form-notice');else focus('#item-name');}
  function stay(){Office.close($('#departure'),null);leaveAction=null;if(held&&!gate){const a=held;held=null;finish(a);}else if(gate==='idle')focus('#reauth-password');else restoreFocus();}
  function discard(){const action=leaveAction;leaveAction=null;Office.close($('#departure'),null);if(pending)pending.departed=true;closed=true;draft=copy(original);render();if(pending){$('#saved-result').hidden=false;$('#saved-result').textContent='Waiting for an earlier save to finish. Nothing will be sent again.';}if(held&&!gate){const a=held;held=null;finish(a);}action?.();}
  function resetReauth(){otherStep=0;$('#reauth-title').textContent='Your session timed out';$('#reauth-body').textContent='Your unsaved changes are kept. Continue as m.iqbal to resume them.';$('#reauth-fields').hidden=false;$('#reauth-user').value='m.iqbal';$('#reauth-user').readOnly=true;$('#other-manager').textContent='Sign in as a different manager';$('#resume').textContent='Continue';$('#reauth-logout').hidden=false;$('#reauth-error').hidden=true;}
  function session(kind){
    gate=kind;$('#reauth-password').value='';$('#signin-password').value='';resetReauth();
    if(kind==='idle'){$('#item-frame').inert=true;emergency($('#reauth-emergency'),'Continue your session to open print incidents.',true);Office.open($('#item-reauth'),$('#reauth-password'));}
    else{decisionHeld=$('#departure').open;if(decisionHeld)$('#departure').close();$('#item-reauth').close();$('#item-frame').hidden=true;$('#item-frame').inert=true;$('#item-signin').hidden=false;$('#item-main').removeAttribute('role');$('#item-signin').setAttribute('role','main');focus('#signin-user');}
  }
  function resume(same){
    $('#reauth-password').value='';$('#signin-password').value='';$('#item-reauth').close();$('#item-signin').hidden=true;$('#item-signin').removeAttribute('role');$('#item-main').setAttribute('role','main');$('#item-frame').hidden=false;$('#item-frame').inert=false;gate=null;
    if(!same){if(pending&&held==='saved')apply(pending);pending=null;held=null;leaveAction=null;decisionHeld=false;unknown=false;stale=false;errors.clear();$('#departure').close();draft=blank();original=copy(draft);closed=true;$('#duplicate-holder').hidden=true;$('.office-actor').textContent='Ratna Ayu · Manager';showNotice('','');$('#saved-result').hidden=true;render();$('#item-title').textContent='Item editor';$('#item-status').textContent='';$('#item-context').textContent='Choose an item on Menu to edit it.';$('#return-menu').href='menu.html';focus('#return-menu');return;}
    if(decisionHeld){decisionHeld=false;Office.open($('#departure'),$('#stay'));return;}if($('#departure').open){focus('#stay');return;}if(held){const a=held;held=null;finish(a);return;}restoreFocus();
  }
  function editEvent(e){
    const el=e.target;if(!el.matches('#item-form input,#item-form select')||pending)return;
    if(el.dataset.key)draft[el.dataset.key]=el.value;
    else if(el.dataset.optionField){const wrapper=el.closest('[data-option]'),r=draft[listKey(wrapper.dataset.kind)].find(r=>r.id===wrapper.dataset.option);r[el.dataset.optionField]=el.value;}
    lastField=el.id;errorFor(el.id,'');
    if(el.id==='item-name')$('#duplicate-holder').hidden=true;
    if(el.id==='item-category'&&category(draft.category)?.active)refusedCategory=false;
    $('#save-item').disabled=stale||refusedCategory||errors.size>0;$('#save-hint').textContent=stale?'Choose which version to keep before saving.':refusedCategory?'Choose an active category before saving.':errors.size?'Correct the marked fields before saving.':'All changes are saved together.';preview();
  }
  $('#item-form').addEventListener('input',editEvent);$('#item-form').addEventListener('change',editEvent);
  $('#item-form').addEventListener('focusin',e=>{if(e.target.matches('input,select'))lastField=e.target.id;});
  $('#item-form').onsubmit=e=>{e.preventDefault();submit();};
  function add(kind){if(pending)return;const r={id:'new-'+(++seq),name:'',delta:'0',new:true};draft[listKey(kind)].push(r);render();focus('#'+optionId(kind,r,'name'));}
  $('#add-variant').onclick=()=>add('variant');$('#add-modifier').onclick=()=>add('modifier');
  document.addEventListener('click',e=>{
    const b=e.target.closest('button,a');if(!b)return;
    if(b.dataset.optionAction){
      if(pending)return;const w=b.closest('[data-option]'),kind=w.dataset.kind,k=listKey(kind),r=draft[k].find(x=>x.id===w.dataset.option),action=b.dataset.optionAction;
      if(action==='remove'){if(r.new)draft[k]=draft[k].filter(x=>x!==r);else r.removed=true;for(const field of ['name','delta'])errors.delete(optionId(kind,r,field));render();if(r.new)focus('#add-'+kind);else focus('[data-option="'+r.id+'"] [data-option-action="undo"]');}
      else if(action==='undo'){r.removed=false;render();focus('#'+optionId(kind,r,'name'));}
      else{const active=draft[k].filter(x=>!x.removed),i=active.indexOf(r),other=active[i+(action==='up'?-1:1)];if(!other)return;const a=draft[k].indexOf(r),z=draft[k].indexOf(other);[draft[k][a],draft[k][z]]=[draft[k][z],draft[k][a]];render();const same=$('[data-option="'+r.id+'"] [data-option-action="'+action+'"]');(same.disabled?$('[data-option="'+r.id+'"] [data-option-action="'+(action==='up'?'down':'up')+'"]'):same).focus();}return;
    }
    if(b.id==='gate-incidents'){fx.incidentsQueued=true;$('#reauth-body').textContent='Continue as m.iqbal to open print incidents. Your unsaved changes are kept.';focus('#reauth-password');return;}
    if(b.tagName==='A'&&b.closest('#item-frame')&&!b.closest('.office-fixture')){e.preventDefault();const href=b.href,logout=b.classList.contains('office-logout');leave(()=>{if(logout){closed=true;session('ended');}else location.href=href;},logout);}
  });
  $('#keep-draft').onclick=()=>chooseCurrent(true);$('#use-current').onclick=()=>chooseCurrent(false);
  $('#cancel-edit').onclick=()=>leave(()=>location.href=returnHref());$('#stay').onclick=stay;$('#discard').onclick=discard;
  $('#departure').addEventListener('cancel',e=>{e.preventDefault();stay();});$('#item-reauth').addEventListener('cancel',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!gate&&!$('#departure').open&&!closed){e.preventDefault();leave(()=>location.href=returnHref());}});
  $('#retry-read').onclick=()=>{reread();if(stale)showStale(unknown);else if(unknown&&server&&factsVersion!==base&&!isNew)showStale(true);else{showNotice('Outcome not confirmed','The menu has been read again. Your draft is kept; nothing was sent again.');render();focus('#item-name');}};
  $('#fixture-idle').onclick=()=>session('idle');$('#fixture-ended').onclick=()=>session('ended');$('#fixture-other').onclick=()=>fx.otherTab();$('#finish-command').onclick=()=>finish($('#fixture-response').value==='pending'?'saved':$('#fixture-response').value);
  $('#reauth-logout').onclick=()=>leave(()=>{closed=true;session('ended');},true);
  $('#other-manager').onclick=()=>{if(otherStep){resetReauth();focus('#reauth-password');return;}otherStep=1;$('#reauth-title').textContent='Sign in as a different manager?';$('#reauth-body').textContent='The current manager’s unsaved changes will not be available to the manager signing in.';$('#reauth-fields').hidden=true;$('#other-manager').textContent='Stay with current manager';$('#resume').textContent='Continue to sign-in';$('#reauth-logout').hidden=true;focus('#other-manager');};
  $('#resume').onclick=()=>{
    if(otherStep===1){otherStep=2;$('#reauth-title').textContent='Sign in as a different manager';$('#reauth-body').textContent='Enter your own username and password. The current manager’s unsaved changes will not be available to you.';$('#reauth-fields').hidden=false;$('#reauth-user').readOnly=false;$('#reauth-user').value='';$('#reauth-password').value='';$('#other-manager').textContent='Back to m.iqbal';$('#resume').textContent='Sign in';focus('#reauth-user');return;}
    if(otherStep===2&&!$('#reauth-user').value.trim()){$('#reauth-error').textContent='Enter your username.';$('#reauth-error').hidden=false;focus('#reauth-user');return;}
    if(!$('#reauth-password').value){$('#reauth-error').textContent='Enter your password.';$('#reauth-error').hidden=false;focus('#reauth-password');return;}
    resume(otherStep===0||$('#reauth-user').value.trim()==='m.iqbal');if(fx.incidentsQueued){fx.incidentsQueued=false;leave(()=>location.href=Office.incidents);}
  };
  $('#signin-form').onsubmit=e=>{e.preventDefault();if(!$('#signin-user').value.trim()||!$('#signin-password').value){$('#signin-error').hidden=false;$('#signin-error').textContent=!$('#signin-user').value.trim()?'Enter your username.':'Enter your password.';focus(!$('#signin-user').value.trim()?'#signin-user':'#signin-password');return;}resume($('#signin-user').value.trim()==='m.iqbal');};
  // Same-document sentinel for the local browser Back/Forward departure walk. No unload prompt.
  history.replaceState({item:true},'',location.href);history.pushState({item:true},'',location.href);
  addEventListener('popstate',()=>{if(dirty()){history.pushState({item:true},'',location.href);leave(()=>{closed=true;history.go(-2);});}else history.back();});
  $('.office-day')?.remove();$('#return-menu').href=returnHref();render();focus('#item-name');
  // Addressable drawings. Result selection is outside the product.
  function answer(a){$('#fixture-response').value='pending';submit();finish(a);$('#fixture-response').value='saved';}
  function typeDraft(){draft.name=original.name+' special';if(draft.variants[0])draft.variants[0].delta='-20000';render();}
  if(state==='loading'||state==='load-error'||missing){
    $('#item-form').hidden=true;$('#item-status').textContent='';$('#item-context').hidden=true;$('#item-title').textContent='Item editor';
    $('#read-state').innerHTML=state==='loading'?'<div class="office-notice" role="status">Loading item…</div>':'<div class="office-notice" role="alert"><strong>'+(missing?'Item could not be found':'Item could not be loaded')+'</strong><p>'+(missing?'Return to Menu and choose the item again.':'Try again to read this item.')+'</p>'+(!missing?'<button class="office-button" id="retry-initial">Try again</button>':'')+'</div>';
    $('#retry-initial')?.addEventListener('click',()=>{fx.reads++;$('#read-state').innerHTML='';$('#item-context').hidden=false;render();focus('#item-name');});
  }
  if(['overflow','floor'].includes(state)){
    draft.name='Grilled mushrooms with roasted garlic and seasonal vegetables'.padEnd(64,'W');draft.price=state==='floor'?'100000':'99999999';
    for(const kind of ['variant','modifier'])draft[listKey(kind)]=Array.from({length:state==='floor'?3:18},(_,i)=>({id:kind+'-'+i,name:(kind==='variant'?'Serving ':'Extra ')+String(i+1).padStart(2,'0')+' '+ 'W'.repeat(kind==='variant'?21:23),delta:i===0&&kind==='variant'?'-99999999':i===1?'99999999':'0'}));
    original=copy(draft);server=copy(draft);current=copy(draft);render();
  }
  if(['remove-pending','remove-undone'].includes(state)){draft.variants[1].removed=true;render();if(state==='remove-undone'){$('[data-option="variant-2"] [data-option-action="undo"]').click();}}
  if(state==='reorder'){[draft.variants[0],draft.variants[1]]=[draft.variants[1],draft.variants[0]];render();}
  const badName=state.match(/^invalid-(item|variant|modifier)-(empty|long|control|duplicate)$/);
  if(badName){const [,kind,reason]=badName,limit=kind==='item'?64:32;const value=reason==='empty'?'':reason==='long'?'W'.repeat(limit+1):reason==='control'?'Name\u0007':'Regular';if(kind==='item')draft.name=value;else{const list=draft[listKey(kind)];list[1].name=reason==='duplicate'?list[0].name.toUpperCase():value;}validate();}
  const badMoney=state.match(/^invalid-(base|variant-delta|modifier-delta)-(empty|format|bounds|negative)$/);
  if(badMoney){const [,kind,reason]=badMoney,value=reason==='empty'?'':reason==='format'?'twelve':reason==='bounds'?'100000000':'-1';if(kind==='base')draft.price=value;else draft[kind==='variant-delta'?'variants':'modifiers'][0].delta=value;validate();}
  if(['duplicate-create','duplicate-rename','duplicate-archived-category'].includes(state)){draft.name=state==='duplicate-archived-category'?'Apple Pie':isNew?'Burger':'Chicken Wings';if(isNew)draft.price='100000';render();answer('duplicate');}
  if(['saving','saved','failure','unknown','unknown-changed','unknown-read-failed','leave-pending','leave-unknown','unsaved','unsaved-logout','reauth','bo01-draft','reauth-decision','bo01-decision','stale','stale-read-failed','stale-same','stale-removed','stale-duplicate','move-category-archived'].includes(state))typeDraft();
  if(['saving','leave-pending'].includes(state)){$('#fixture-response').value='pending';submit();}
  if(['saved','unchanged','failure','unknown','unknown-changed','unknown-read-failed'].includes(state))answer(state==='unchanged'?'saved':state);
  if(state==='leave-unknown')answer('unknown');
  if(['stale','stale-read-failed'].includes(state)){answer('stale');if(state==='stale-read-failed'){readFailed=true;showNotice('The menu changed while you were editing','Nothing was saved. Your draft is kept, but the current item could not be read. Try again to read it before choosing.','stale');render();focus('#form-notice');}}
  if(state==='stale-same'){draft=copy(original);version++;reread();showStale();}
  if(['stale-removed','stale-duplicate'].includes(state)){
    draft.variants[0].name='House size';server.variants=server.variants.filter(r=>r.id!=='variant-1');if(state==='stale-duplicate')server.variants.push({id:'external',name:'House size',delta:'0'});version++;reread();showStale();if(state==='stale-duplicate')chooseCurrent(true);
  }
  if(['create-category-archived','move-category-archived'].includes(state)){if(isNew){draft.name='Breakfast plate';draft.price='85000';}else draft.category='sides';render();answer('category-archived');}
  if(['unsaved','unsaved-logout','leave-pending','leave-unknown','reauth-decision','bo01-decision'].includes(state))leave(()=>state==='unsaved-logout'?session('ended'):location.href=returnHref(),state==='unsaved-logout');
  if(['reauth','reauth-decision'].includes(state))session('idle');if(['bo01-draft','bo01-decision'].includes(state))session('ended');
  // A saved name can never exceed 64 code points (S4a's check). BO-03's 80-unit stress rows are not
  // valid configuration, so they open with the refusal shown rather than looking valid.
  if(state==='default'&&!isNew&&!missing&&[...original.name].length>64)validate();
  document.documentElement.dataset.state=state;
})();
