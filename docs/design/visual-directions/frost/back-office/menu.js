/* DESIGN-019 local drawing. No API, storage, credential submission or timed integration. */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const params = new URLSearchParams(location.search), state = params.get('state') || 'default';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories = [
    {id:'mains',name:'Mains',active:true,order:0}, {id:'sides',name:'Sides',active:true,order:1},
    {id:'drinks',name:'Drinks',active:true,order:2}, {id:'seasonal',name:'Seasonal',active:false,order:3}
  ];
  const items = [
    ['burger','Burger','mains','100000',3,3,true,true], ['wings','Chicken Wings','mains','90000',0,1,true,true],
    ['steak','Steak','mains','240000',3,2,true,true], ['fish','Fish & Chips','mains','140000',0,0,true,true],
    ['salad','Caesar Salad','mains','75000',2,2,true,true], ['stew','Winter Stew','mains','110000',0,0,false,true],
    ['fries','Fries','sides','40000',2,0,true,true], ['soda','Soda','drinks','30000',0,0,true,false],
    ['pie','Apple Pie','seasonal','65000',0,0,true,true], ['iced','Spiced Iced Tea','seasonal','35000',0,0,true,false]
  ].map(([id,name,category,price,variants,modifiers,active,available],order)=>({id,name,category,price,variants,modifiers,active,available,order}));
  // version is the server's catalog version; listVersion is the version this page's list stands at (F1).
  let version=12, listVersion=12, form=null, pending=null, held=null, gate=null, leaveAction=null, savedDecision=false, otherStep=0;
  let read='ready', staleRead=false, holder=null, unknownSubject=null, actor='M. Iqbal';
  const fixture={commands:[],reads:0,get categories(){return categories;},get items(){return items;},get version(){return version;},get listVersion(){return listVersion;},otherTab(){version++;},get form(){return form;},get pending(){return !!pending;}};
  window.MenuFixture=fixture;
  const cat=id=>categories.find(x=>x.id===id), item=id=>items.find(x=>x.id===id);
  const byOrder=(a,b)=>a.order-b.order || a.name.localeCompare(b.name,undefined,{sensitivity:'base'}) || a.id.localeCompare(b.id);
  const cats=()=>[...categories].sort((a,b)=>Number(b.active)-Number(a.active)||byOrder(a,b));
  const scope=f=>f.kind==='categories'?categories.filter(x=>x.active).sort(byOrder):items.filter(x=>x.category===f.id&&x.active).sort(byOrder);
  const record=(kind,id)=>kind==='category'?cat(id):item(id);
  const money=s=>s.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const focus=s=>$(s)?.focus({preventScroll:false});
  const editSelector=(kind,id)=>kind==='category'?'[data-rename="'+id+'"]':'[data-edit="'+id+'"]';
  function notice(where,text,kind='status',takeFocus=false){const el=$(where);el.hidden=!text;el.textContent=text;el.dataset.kind=kind;el.setAttribute('role',kind==='failure'?'alert':'status');if(text&&takeFocus)el.focus();}
  function page(text,kind='status',takeFocus=true){notice('#page-status',text,kind,takeFocus);}
  function clearResult(){unknownSubject=null;page('', 'status',false);$('#phase-note').hidden=true;holder=null;}
  function editorHref(r,c){
    const query=new URLSearchParams({item:r?.id||'',category:c.id,return:'frost-menu',returnItem:r?.id||''});
    if(!r)query.set('state','new');
    // URL-only review plumbing. S4c replaces this snapshot with the real catalog read.
    if(r)query.set('fixtureItem',JSON.stringify(r));
    query.set('fixtureCategory',JSON.stringify({id:c.id,name:c.name,active:c.active,order:c.order}));
    return 'item-editor.html?'+query;
  }
  const button=(text,attr,name)=>'<button class="office-button small" '+attr+' aria-label="'+esc(name)+'">'+text+'</button>';
  function render(){
    $('#menu-count').textContent=read==='ready'?categories.length+' categories · '+items.length+' items':'';
    $('#menu-list').hidden=read==='loading'||read==='failed'||!categories.length;
    $('#menu-empty').hidden=read!=='ready'||!!categories.length;
    $('#reorder-categories').disabled=categories.filter(x=>x.active).length<2||!!pending||read!=='ready';
    $('#new-category').disabled=read==='loading'||!!pending;
    const rows=[];
    for(const c of cats()){
      const group=items.filter(r=>r.category===c.id).sort((a,b)=>Number(b.active)-Number(a.active)||byOrder(a,b));
      rows.push('<tr class="category-row" data-category="'+c.id+'"><td colspan="4"><div class="menu-category"><h2>'+esc(c.name)+(c.active?'':' · Archived category')+'</h2><div class="office-actions">'+button('Rename','data-rename="'+c.id+'"','Rename category '+c.name)+button(c.active?'Archive':'Restore','data-category-state="'+c.id+'"',(c.active?'Archive':'Restore')+' category '+c.name)+(c.active?button('Reorder items','data-reorder="'+c.id+'"','Reorder items in '+c.name)+'<a class="office-button small" data-new-item="'+c.id+'" href="'+esc(editorHref(null,c))+'" aria-label="New item in '+esc(c.name)+'">New item</a>':'')+'</div></div><span class="menu-category-note">'+(c.active?'Archiving this category hides its items from the POS without changing them.':'Hidden from the POS. Item status and availability are kept. Restore this category to show its active, available items again.')+(holder===c.id?' Name in use.':'')+'</span></td></tr>');
      if(!group.length)rows.push('<tr><td colspan="4">No items in this category yet.'+(c.active?' Use New item to add the first one.':' Restore the category before adding an item.')+'</td></tr>');
      for(const r of group){
        rows.push('<tr data-item="'+r.id+'" data-active="'+r.active+'" data-selected="'+(params.get('item')===r.id)+'"><td>'+esc(r.name)+(r.active?'':' <span class="menu-item-note">Archived item</span>')+'<span class="menu-item-note">'+r.variants+' variants · '+r.modifiers+' modifiers'+(holder===r.id?' · Name in use':'')+'</span></td><td class="num">'+money(r.price)+'</td><td><span class="menu-availability">'+(r.available?'Available':'86 · Unavailable')+'</span>'+button(r.available?'86':'Make available','data-availability="'+r.id+'"',(r.available?'Mark '+r.name+' 86':'Make available '+r.name))+(!r.active||!c.active?'<span class="menu-item-note">Hidden from the POS'+(!c.active?' · category archived':' · item archived')+'</span>':'')+'</td><td><div class="office-actions"><a class="office-button small" data-edit="'+r.id+'" href="'+esc(editorHref(r,c))+'" aria-label="Edit '+esc(r.name)+'">Edit</a>'+button(r.active?'Archive':'Restore','data-item-state="'+r.id+'"',(r.active?'Archive':'Restore')+' item '+r.name)+'</div></td></tr>');
      }
    }
    $('#menu-rows').innerHTML=rows.join('');
    $$('#menu-rows button').forEach(b=>b.disabled=!!pending);
    // A scope of fewer than two active items has no order to change, as with Reorder categories.
    // A reorder also needs a complete read (F3).
    $$('[data-reorder]').forEach(b=>{if(scope({kind:'items',id:b.dataset.reorder}).length<2||read!=='ready')b.disabled=true;});
    $$('#menu-rows a').forEach(a=>{if(pending){a.setAttribute('aria-disabled','true');a.tabIndex=-1;}});
    const load=$('#read-state');load.innerHTML='';
    if(read==='loading')load.innerHTML='<p role="status">Loading menu…</p>';
    if(read==='failed'||read==='partial')load.innerHTML='<div class="office-notice" role="alert"><strong>'+(read==='partial'?'The menu list may be out of date':'Menu could not be loaded')+'</strong><p>'+(read==='partial'?'The menu could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list.':'Try again to read the menu.')+'</p><button class="office-button" id="retry-read">Try again</button></div>';
    renderForm();
  }
  function renderForm(){
    $('#menu-editor').hidden=!form;if(!form)return;
    const reorder=form.kind==='categories'||form.kind==='items';
    $('#editor-title').textContent=form.title;
    $('#editor-context').textContent=reorder?'Move each row up or down, then save the full order. Archived records keep their stored order.':form.kind==='create'?'Choose the category name staff will see at the POS.':cat(form.id).active?'Rename this category. Existing orders keep their saved names.':'Archived category. Saving its name does not restore it.';
    $('#name-part').hidden=reorder;$('#draft-order').hidden=!reorder;
    $('#menu-name').disabled=!!pending;
    $('#save-menu').textContent=form.kind==='create'?'Create':reorder?'Save order':'Save';
    $('#save-menu').disabled=!!pending||!!form.stale||!!form.error;
    $('#save-menu').setAttribute('aria-describedby',form.stale?'choice-reason':'');
    $('#comparison').hidden=!form.stale||staleRead;
    if(reorder){
      $('#draft-order').innerHTML=form.order.map((id,i)=>{const r=form.kind==='categories'?cat(id):item(id);return '<li data-order-id="'+id+'"><span class="menu-order-name">'+(i+1)+'. '+esc(r.name)+'</span>'+button('Move up','data-move="'+id+'" data-delta="-1" '+(i===0||pending?'disabled':''),'Move up '+r.name)+button('Move down','data-move="'+id+'" data-delta="1" '+(i===form.order.length-1||pending?'disabled':''),'Move down '+r.name)+'</li>';}).join('');
    }
  }
  function openForm(kind,id,opener){
    clearResult();const r=cat(id),reorder=kind==='categories'||kind==='items';
    form={kind,id,base:listVersion,title:kind==='create'?'New category':kind==='rename'?'Rename '+r.name:kind==='categories'?'Reorder categories':'Reorder items in '+r.name,opener:opener||'#new-category',initial:kind==='create'?'':r?.name,error:'',stale:false,unknown:false};
    if(reorder){form.order=scope(form).map(x=>x.id);form.original=[...form.order];}
    $('#menu-name').value=form.initial||'';notice('#form-notice','');$('#name-error').hidden=true;$('#menu-name').removeAttribute('aria-invalid');$('#menu-name').setAttribute('aria-describedby','menu-name-help');staleRead=false;
    renderForm();reorder?focus('#draft-order button:not(:disabled)'):focus('#menu-name');
  }
  function dirty(){return form&&(pending||form.unknown||(form.order?form.order.join()!==form.original.join():$('#menu-name').value!==form.initial));}
  function closeForm(){if(!form)return;const opener=form?.opener||'#new-category';form=null;renderForm();focus(opener);}
  function emergency(el,sentence,action){
    el.hidden=!Office.kitchen;if(!Office.kitchen)return;
    el.className='office-emergency';el.innerHTML='<div><strong>'+esc(Office.kitchenIncident.title)+'</strong><p>'+esc(Office.kitchenIncident.identity)+'</p><p>'+sentence+'</p></div>'+(action?'<button class="office-button" id="gate-incidents">Open print incidents after sign-in</button>':'');
  }
  function leave(action,logout=false,command=false){
    if(!dirty()){if(form)closeForm();action();return;}
    leaveAction=action;
    $('#departure-title').textContent=logout?'Log out and discard your changes?':'Discard unsaved changes?';
    $('#departure-body').textContent=logout?'The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.':pending||form.unknown?(command?'The save may or may not have succeeded. Continuing does not send it again. Stay to keep the draft, or discard it to continue.':'The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave.'):command?'Your edits have not been saved. Stay to keep editing, or discard them to continue.':'Your edits have not been saved. Stay to keep editing, or discard them before leaving.';
    $('#departure-context').hidden=!logout||!(pending||form.unknown);$('#departure-context').textContent='The save may or may not have succeeded. Leaving does not send it again.';
    $('#stay').textContent=logout?'Keep this draft':'Stay';$('#discard').textContent=logout?'Discard changes and log out':'Discard';
    emergency($('#departure-emergency'),logout?'Decide whether to keep this draft or discard it before opening print incidents.':'Decide whether to stay or discard before opening print incidents.',false);
    Office.open($('#departure'),$('#stay'));
  }
  function stay(){Office.close($('#departure'),null);leaveAction=null;if(held&&!gate){const answer=held;held=null;finish(answer);}else if(gate==='idle')focus('#reauth-password');else form?.order?focus('#draft-order button:not(:disabled)'):focus('#menu-name');}
  function discard(){const action=leaveAction;leaveAction=null;if(pending)pending.departed=true;Office.close($('#departure'),null);closeForm();if(pending)page('Waiting for an earlier save to finish. Nothing will be sent again.','status',false);if(held&&!gate){const answer=held;held=null;finish(answer);}action?.();}
  function validation(){const s=$('#menu-name').value.trim();$('#menu-name').value=s;return !s?'Enter a name':s.length>32?'Use 32 characters or fewer.':/\p{Cc}/u.test(s)?'Remove control characters from the name.':'';}
  function fieldError(text){form.error=text;$('#name-error').textContent=text;$('#name-error').hidden=!text;$('#menu-name').setAttribute('aria-invalid',String(!!text));$('#menu-name').setAttribute('aria-describedby',text?'name-error menu-name-help':'menu-name-help');renderForm();focus('#menu-name');}
  function stale(unknown=false){
    form.stale=true;form.unknown=unknown;const reorder=!!form.order;
    const current=reorder?scope(form).map(x=>x.name).join(' → '):cat(form.id)?.name;
    $('#current-values').textContent=reorder?'Current order: '+current:'Current category name: '+current;
    notice('#form-notice',unknown?'Outcome not confirmed. The menu has been read again at version '+listVersion+'. It may include this save. Your draft is kept; nothing was sent again. Choose which to keep.':'The menu changed while you were editing. Nothing was saved. The menu has been read again at version '+listVersion+'. Your draft is kept. Choose which to keep.','failure',true);
    renderForm();
  }
  function chooseCurrent(keep){
    if(!form||staleRead)return;
    form.base=listVersion;form.stale=false;form.error='';
    if(form.order){form.original=scope(form).map(x=>x.id);if(!keep)form.order=[...form.original];}
    else{form.initial=cat(form.id).name;if(!keep)$('#menu-name').value=form.initial;}
    notice('#form-notice',keep?'Your changes now build on version '+listVersion+'. Nothing has been saved yet. Press '+(form.order?'Save order':'Save')+' to save them.':'The form now shows version '+listVersion+'. Nothing was saved. Edit it and save, or Cancel to close.');
    renderForm();keep?focus('#save-menu'):form.order?focus('#draft-order button:not(:disabled)'):focus('#menu-name');
  }
  function submit(){
    if(!form||pending||form.stale)return;
    if(!form.order){const error=validation();if(error){fieldError(error);return;}}
    const command={kind:form.kind,id:form.id,name:$('#menu-name').value,order:form.order?[...form.order]:null,expected:form.kind==='create'?null:form.base,editor:form,opener:form.opener};
    start(command);
  }
  function stateCommand(kind,id,action){
    const r=record(kind,id);clearResult();start({kind:'state',subject:kind,id,name:r.name,action,expected:null,opener:editSelector(kind,id)});
  }
  function pendingText(c){return c.action==='86'?'Marking '+c.name+' 86…':c.action==='available'?'Making '+c.name+' available…':c.action==='archive'?'Archiving '+c.name+'…':'Restoring '+c.name+'…';}
  function start(c){
    if(pending)return;clearResult();pending=c;fixture.commands.push({kind:c.kind,subject:c.subject,id:c.id,action:c.action,expected:c.expected});
    render();if(c.kind==='state')page(pendingText(c));else notice('#form-notice','Saving… Wait for the result. Your draft is kept.','status',true);
    const answer=$('#fixture-response').value;if(answer!=='pending')queueMicrotask(()=>finish(answer));
  }
  function apply(c,answered=true){
    let changed=true;
    if(c.kind==='state'){const r=record(c.subject,c.id),key=['86','available'].includes(c.action)?'available':'active',value=c.action==='available'||c.action==='restore';changed=r[key]!==value;r[key]=value;}
    else if(c.kind==='create'){c.id='category-'+(categories.length+1);categories.push({id:c.id,name:c.name,active:true,order:Math.max(-1,...categories.map(x=>x.order))+1});c.opener=editSelector('category',c.id);}
    else if(c.kind==='rename'){changed=cat(c.id).name!==c.name;cat(c.id).name=c.name;}
    else{const all=c.kind==='categories'?categories:items;changed=c.order.some((id,i)=>all.find(x=>x.id===id).order!==i);c.order.forEach((id,i)=>all.find(x=>x.id===id).order=i);}
    if(changed)version++;
    // A received answer moves the list only when it is this write and nothing else (F1). Only an availability answer
    // can arrive with an editor open, and the editor's base moves with the list (F7). An unknown outcome moves nothing.
    if(answered&&version===listVersion+(changed?1:0)){if(c.kind==='state'&&form&&form.base===listVersion)form.base=version;listVersion=version;}
    return changed;
  }
  function resultText(c,changed){
    if(c.kind==='state'){
      if(c.action==='86')return c.name+' is now marked 86.'+(!item(c.id).active||!cat(item(c.id).category).active?' It stays hidden from the POS while it or its category is archived.':' At the POS it is disabled in place, not removed.');
      if(c.action==='available')return c.name+' is available again.'+(!item(c.id).active||!cat(item(c.id).category).active?' It stays hidden from the POS while it or its category is archived.':'');
      if(c.subject==='category')return c.name+(c.action==='archive'?' archived. Its items are hidden from the POS; their status and availability are unchanged.':' restored. Its active, available items are shown at the POS again.');
      return c.name+(c.action==='archive'?' archived. It is kept for history.':' restored.')+(!cat(item(c.id).category).active?' Its category is archived, so it stays hidden from the POS.':'');
    }
    return !changed?'Nothing changed. Menu version '+version+' is still current.':c.order?(c.kind==='categories'?'Category order':'Item order in '+cat(c.id).name)+' saved.':c.name+' saved.';
  }
  function reread(succeeded=true){fixture.reads++;if(succeeded)listVersion=version;}
  function finish(answer){
    if(!pending)return;if(gate||$('#departure').open){held=answer;return;}
    const c=pending;pending=null;
    if(c.departed){if(answer==='saved')apply(c);const before=document.activeElement;const selector=before?.dataset.edit?editSelector('item',before.dataset.edit):before?.dataset.rename?editSelector('category',before.dataset.rename):null;render();page('', 'status',false);if(selector)focus(selector);return;}
    if(answer==='stale'&&(c.kind==='state'||c.kind==='create'))answer='saved';
    if(answer==='lease'&&!(c.kind==='state'&&c.action==='86'))answer='saved';
    if(answer==='saved'&&c.expected!==null&&c.expected!==version)answer='stale';
    if(answer==='saved'){
      let conflict;
      if(c.kind==='create'||c.kind==='rename')conflict=(c.kind==='create'||cat(c.id).active)&&categories.find(x=>x.active&&x.id!==c.id&&x.name.toLowerCase()===c.name.toLowerCase());
      if(c.kind==='state'&&c.action==='restore'){const all=c.subject==='category'?categories:items;conflict=all.find(x=>x.active&&x.id!==c.id&&x.name.toLowerCase()===c.name.toLowerCase());}
      if(conflict){holder=conflict.id;answer='duplicate';}
    }
    if(answer==='saved'){
      const changed=apply(c);if(read==='failed')read='partial';if(c.kind!=='state'){form=null;notice('#form-notice','');}render();page(resultText(c,changed),'status',false);focus(c.opener);return;
    }
    if(answer==='idle'||answer==='ended'){
      render();if(c.kind==='state')page(c.name+' was not changed. Use its row action to try again.','status',false);
      else notice('#form-notice','Nothing was saved. Your draft is kept. Press '+(c.kind==='create'?'Create':c.order?'Save order':'Save')+' to try again.');
      session(answer);return;
    }
    if(answer==='lease'){
      render();$('#phase-note').hidden=false;page(c.name+' was not marked 86. Quick-sale order ORD-1048 (opened 20:14) is being paid and includes this item. Try again when payment is no longer in progress.','failure');return;
    }
    if(answer==='duplicate'){
      reread();const all=c.kind==='state'&&c.subject==='item'?items:categories;holder=all.find(x=>x.active&&x.id!==c.id&&x.name.toLowerCase()===c.name.toLowerCase())?.id;render();
      if(c.kind==='state'){
        const noun=c.subject==='category'?'category':'item';page(c.name+' was not restored. An active '+noun+' already uses this name. Rename this archived '+noun+(noun==='item'?' in the item editor':'')+', save, then restore it.','failure');
      }else fieldError('An active category already uses this name. Choose another name.');
      return;
    }
    if(answer==='stale'){
      if(version===c.expected){version++;if(c.kind==='rename')cat(c.id).name='Main dishes';else scope(form).reverse().forEach((x,i)=>x.order=i);}reread();
      render();stale();return;
    }
    if(answer.startsWith('unknown')){
      const changed=answer==='unknown-changed';if(changed)apply(c,false);reread(answer!=='unknown-read-failed');
      if(answer==='unknown-read-failed')read='failed';render();
      if(c.kind==='state'){unknownSubject=c.name;page(c.name+': the outcome could not be confirmed. The menu '+(read==='failed'?'could not be':'has been')+' refreshed. Nothing was sent again.');}
      else{
        form.unknown=true;
        if(c.expected!==null&&version!==c.expected){stale(true);return;}
        else notice('#form-notice','Outcome not confirmed. The menu '+(read==='failed'?'could not be':'has been')+' refreshed. Your draft is kept; nothing was sent again.');
        form.order?focus('#draft-order button:not(:disabled)'):focus('#menu-name');
      }return;
    }
    render();if(c.kind==='state')page('Something went wrong. '+c.name+' was not changed. Use its row action to try again.','failure');
    else{notice('#form-notice','Something went wrong. Nothing was saved. Your draft is kept. Press '+(c.kind==='create'?'Create':c.order?'Save order':'Save')+' to try again.','failure');form.order?focus('#draft-order button:not(:disabled)'):focus('#menu-name');}
  }
  function session(kind){
    gate=kind;$('#reauth-password').value='';$('#signin-password').value='';otherStep=0;
    if(kind==='idle'){
      $('#menu-frame').inert=true;resetReauth();emergency($('#reauth-emergency'),'Continue your session to open print incidents.',true);Office.open($('#menu-reauth'),$('#reauth-password'));
    }else{
      savedDecision=$('#departure').open;if(savedDecision)$('#departure').close();$('#menu-reauth').close();$('#menu-frame').hidden=true;$('#menu-frame').inert=true;$('#menu-signin').hidden=false;$('#menu-main').removeAttribute('role');$('#menu-signin').setAttribute('role','main');focus('#signin-user');
    }
  }
  function resetReauth(){
    $('#reauth-title').textContent='Your session timed out';$('#reauth-body').textContent='Your unsaved changes are kept. Continue as m.iqbal to resume them.';$('#reauth-fields').hidden=false;$('#reauth-user').value='m.iqbal';$('#reauth-user').readOnly=true;$('#other-manager').textContent='Sign in as a different manager';$('#resume').textContent='Continue';$('#reauth-logout').hidden=false;
  }
  function resume(same){
    $('#reauth-password').value='';$('#signin-password').value='';$('#menu-reauth').close();$('#menu-signin').hidden=true;$('#menu-signin').removeAttribute('role');$('#menu-main').setAttribute('role','main');$('#menu-frame').hidden=false;$('#menu-frame').inert=false;gate=null;
    if(!same){
      if(pending)pending.departed=true;const old=pending,answer=held;pending=null;held=null;form=null;leaveAction=null;savedDecision=false;$('#departure').close();$('#menu-name').value='';actor='Ratna Ayu';$('.office-actor').textContent=actor+' · Manager';if(old&&answer==='saved')apply(old);render();clearResult();focus('#new-category');return;
    }
    if(savedDecision){savedDecision=false;Office.open($('#departure'),$('#stay'));return;}
    if($('#departure').open){focus('#stay');return;}
    if(held){const answer=held;held=null;finish(answer);return;}
    if(form)form.order?focus('#draft-order button:not(:disabled)'):focus('#menu-name');else focus('#new-category');
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button,a');if(!b)return;
    if(b.id==='gate-incidents'){$('#reauth-body').textContent='Continue as m.iqbal to open print incidents. Your unsaved changes are kept.';fixture.incidentsQueued=true;focus('#reauth-password');return;}
    if(b.id==='retry-read'){
      reread();read='ready';render();
      if(form?.stale){staleRead=false;stale(form.unknown);}
      else if(form?.unknown){notice('#form-notice','Outcome not confirmed. The menu has been refreshed. Your draft is kept; nothing was sent again.');form.order?focus('#draft-order button:not(:disabled)'):focus('#menu-name');}
      else if(unknownSubject)page(unknownSubject+': the outcome could not be confirmed. The menu has been refreshed. Nothing was sent again.');
      else page('The menu has been refreshed.','status',true);return;
    }
    if(b.closest('#menu-rows')&&pending){e.preventDefault();return;}
    if(b.dataset.rename){leave(()=>openForm('rename',b.dataset.rename,'[data-rename="'+b.dataset.rename+'"]'));return;}
    if(b.dataset.reorder){leave(()=>openForm('items',b.dataset.reorder,'[data-reorder="'+b.dataset.reorder+'"]'));return;}
    // Availability never changes a rename or a reorder scope, so it acts at once and the draft stays open (F7).
    if(b.dataset.availability){const id=b.dataset.availability;stateCommand('item',id,item(id).available?'86':'available');return;}
    if(b.dataset.categoryState){const id=b.dataset.categoryState;leave(()=>stateCommand('category',id,cat(id).active?'archive':'restore'),false,true);return;}
    if(b.dataset.itemState){const id=b.dataset.itemState;leave(()=>stateCommand('item',id,item(id).active?'archive':'restore'),false,true);return;}
    if(b.dataset.move){
      const i=form.order.indexOf(b.dataset.move),j=i+Number(b.dataset.delta);[form.order[i],form.order[j]]=[form.order[j],form.order[i]];renderForm();
      const target=$('[data-move="'+b.dataset.move+'"][data-delta="'+b.dataset.delta+'"]');(target.disabled?$('#draft-order [data-move="'+b.dataset.move+'"]:not(:disabled)'):target)?.focus();return;
    }
    if(b.tagName==='A'&&b.closest('#menu-frame')&&!b.closest('.office-fixture')){
      e.preventDefault();const href=b.href;leave(()=>{if(b.classList.contains('office-logout'))session('ended');else location.href=href;},b.classList.contains('office-logout'));
    }
  });
  $('#new-category').onclick=()=>leave(()=>openForm('create',null,'#new-category'));
  $('#reorder-categories').onclick=()=>leave(()=>openForm('categories',null,'#reorder-categories'));
  $('#menu-form').onsubmit=e=>{e.preventDefault();submit();};
  $('#menu-name').oninput=()=>{if(form?.error){form.error='';$('#name-error').hidden=true;$('#menu-name').removeAttribute('aria-invalid');$('#menu-name').setAttribute('aria-describedby','menu-name-help');renderForm();}};
  $('#cancel-edit').onclick=()=>leave(()=>closeForm());
  $('#keep-draft').onclick=()=>chooseCurrent(true);$('#use-current').onclick=()=>chooseCurrent(false);
  $('#stay').onclick=stay;$('#discard').onclick=discard;
  $('#departure').addEventListener('cancel',e=>{e.preventDefault();stay();});
  $('#menu-reauth').addEventListener('cancel',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!gate&&!$('#departure').open&&form){e.preventDefault();leave(()=>closeForm());}});
  $('#fixture-idle').onclick=()=>session('idle');$('#fixture-ended').onclick=()=>session('ended');
  $('#fixture-partial').onclick=()=>{read='partial';render();};
  // A write by another tab that this list has not read: the server's version moves, the list's does not.
  $('#fixture-other').onclick=()=>fixture.otherTab();
  $('#finish-command').onclick=()=>finish($('#fixture-response').value==='pending'?'saved':$('#fixture-response').value);
  $('#reauth-logout').onclick=()=>leave(()=>{form=null;session('ended');},true);
  $('#other-manager').onclick=()=>{
    if(otherStep){otherStep=0;resetReauth();focus('#reauth-password');return;}
    otherStep=1;$('#reauth-title').textContent='Sign in as a different manager?';$('#reauth-body').textContent='The current manager’s unsaved changes will not be available to the manager signing in.';$('#reauth-fields').hidden=true;$('#other-manager').textContent='Stay with current manager';$('#resume').textContent='Continue to sign-in';$('#reauth-logout').hidden=true;focus('#other-manager');
  };
  $('#resume').onclick=()=>{
    if(otherStep===1){otherStep=2;$('#reauth-title').textContent='Sign in as a different manager';$('#reauth-body').textContent='Enter your own username and password. The current manager’s unsaved changes will not be available to you.';$('#reauth-fields').hidden=false;$('#reauth-user').readOnly=false;$('#reauth-user').value='';$('#reauth-password').value='';$('#other-manager').textContent='Back to m.iqbal';$('#resume').textContent='Sign in';focus('#reauth-user');return;}
    if(!$('#reauth-password').value){$('#reauth-error').hidden=false;focus('#reauth-password');return;}
    const same=otherStep===0||$('#reauth-user').value.trim()==='m.iqbal';resume(same);if(fixture.incidentsQueued){fixture.incidentsQueued=false;leave(()=>location.href=Office.incidents);}
  };
  $('#signin-form').onsubmit=e=>{e.preventDefault();if(!$('#signin-user').value.trim()||!$('#signin-password').value){$('#signin-error').hidden=false;$('#signin-error').textContent=!$('#signin-user').value.trim()?'Enter your username.':'Enter your password.';focus(!$('#signin-user').value.trim()?'#signin-user':'#signin-password');return;}resume($('#signin-user').value.trim()==='m.iqbal');};
  // A same-document history sentinel permits a real Back/Forward departure decision.
  history.replaceState({menu:true},'',location.href);history.pushState({menu:true},'',location.href);
  window.addEventListener('popstate',()=>{if(dirty()){history.pushState({menu:true},'',location.href);leave(()=>{form=null;history.go(-2);});}else history.back();});
  $('.office-day')?.remove();$('#menu-main').setAttribute('role','main');
  if(state==='empty'){categories.length=0;items.length=0;version=0;listVersion=0;}
  if(state==='loading')read='loading';if(state==='error')read='failed';
  if(state==='overflow'){
    cat('mains').name='Category ABCDEFGHIJKLMNOPQRSTUVW';
    for(let i=0;i<48;i++)items.push({id:'long-'+i,name:('Menu item '+String(i+1).padStart(2,'0')+' ').padEnd(80,'W'),category:'mains',price:'99999999',variants:3,modifiers:2,active:true,available:true,order:20+i});
  }
  // URL-only review return plumbing, not product behaviour. S4c replaces it with the real list read.
  // Apply only the answered item. A missing originating category may be inserted solely to host it;
  // never replace an existing category or change another item. Count rules remain in render().
  let returned=null;
  try {
    const value=JSON.parse(params.get('returnedItem')), host=JSON.parse(params.get('returnedCategory'));
    if(value&&value.id===params.get('item')&&typeof value.name==='string'&&typeof value.price==='string'){
      if(!cat(value.category)&&host?.id===value.category)categories.push({id:host.id,name:host.name,active:host.active,order:host.order});
      if(cat(value.category)){
        returned={id:value.id,name:value.name,category:value.category,price:value.price,variants:value.variants,modifiers:value.modifiers,active:value.active,available:value.available,order:value.order};
        const old=item(returned.id);if(old)Object.assign(old,returned);else items.push(returned);
      }
    }
  }catch{/* A malformed review URL never changes the list. */}
  render();
  // An unchanged answer names the version still in force; it never claims a save. A clean return from a
  // new item has no record, so focus goes back to its opener (New category if that category is gone).
  if(returned){if(params.get('saved')==='1')page(returned.name+' saved.','status',false);else if(params.get('saved')==='unchanged'&&/^\d+$/.test(params.get('version')||''))page('Nothing changed. Menu version '+params.get('version')+' is still current.','status',false);focus(editSelector('item',returned.id));}
  else if(params.has('returnItem')&&!params.get('item')){const opener=$('[data-new-item="'+CSS.escape(params.get('category')||'')+'"]');opener?opener.focus():focus('#new-category');}
  function directForm(kind='rename',id='mains'){openForm(kind,id,kind==='create'?'#new-category':kind==='categories'?'#reorder-categories':kind==='items'?'[data-reorder="'+id+'"]':'[data-rename="'+id+'"]');if(kind==='rename')$('#menu-name').value='Main plates';}
  function directAnswer(answer){$('#fixture-response').value='pending';submit();finish(answer);$('#fixture-response').value='saved';}
  const formStates=['category','rename','rename-archived','category-invalid','invalid-long','invalid-control','saving','saved','duplicate-create','duplicate-rename','failure','unknown','unknown-changed','unknown-read-failed','stale','stale-read-failed','unsaved','unsaved-logout','leave-pending','leave-unknown','reauth','bo01-draft','reauth-decision','bo01-decision'];
  if(formStates.includes(state)){
    const create=['category','category-invalid','invalid-long','invalid-control','duplicate-create'].includes(state);
    directForm(create?'create':'rename',state==='rename-archived'?'seasonal':'mains');
    if(state==='category-invalid'){$('#menu-name').value='';submit();}
    if(state==='invalid-long'){$('#menu-name').value='C'.repeat(33);submit();}
    if(state==='invalid-control'){$('#menu-name').value='Main\u0007';submit();}
    if(state==='duplicate-create'){$('#menu-name').value='Mains';directAnswer('duplicate');}
    if(state==='duplicate-rename'){$('#menu-name').value='Sides';directAnswer('duplicate');}
    if(['saving','leave-pending'].includes(state)){$('#fixture-response').value='pending';submit();}
    if(['saved','failure','unknown','unknown-changed','unknown-read-failed'].includes(state))directAnswer(state);
    if(['stale','stale-read-failed'].includes(state)){directAnswer('stale');if(state==='stale-read-failed'){read='failed';listVersion=version-1;staleRead=true;render();notice('#form-notice','The menu changed while you were editing. Nothing was saved. Your draft is kept, but the current menu could not be read. Try again to read it before choosing.','failure',true);}}
    if(state==='leave-unknown')directAnswer('unknown');
    if(['unsaved','unsaved-logout','leave-pending','leave-unknown','reauth-decision','bo01-decision'].includes(state))leave(()=>state==='unsaved-logout'?session('ended'):closeForm(),state==='unsaved-logout');
    if(['reauth','reauth-decision'].includes(state))session('idle');
    if(['bo01-draft','bo01-decision'].includes(state))session('ended');
  }
  const directStates={eightysix:['item','steak','86'],available:['item','soda','available'],'category-archived':['category','mains','archive'],'category-restored':['category','seasonal','restore'],'item-archived':['item','burger','archive'],'item-restored':['item','stew','restore'],leaserejected:['item','steak','86'],'duplicate-category-restore':['category','seasonal','restore'],'duplicate-item-restore':['item','stew','restore']};
  if(directStates[state]){
    if(state==='duplicate-category-restore')cat('seasonal').name='Mains';if(state==='duplicate-item-restore')item('stew').name='Burger';
    $('#fixture-response').value='pending';stateCommand(...directStates[state]);finish(state==='leaserejected'?'lease':state.startsWith('duplicate')?'duplicate':'saved');$('#fixture-response').value='saved';
  }
  const match=state.match(/^(pending|unknown|failure|session)-(86|available|category-archive|category-restore|item-archive|item-restore)$/);
  if(match){
    const [,result,command]=match;const subject=command.startsWith('category')?'category':'item',action=command.split('-').at(-1),id=subject==='category'?(action==='restore'?'seasonal':'mains'):action==='restore'?'stew':action==='available'?'soda':'steak';
    $('#fixture-response').value='pending';stateCommand(subject,id,action);if(result!=='pending')finish(result==='session'?'idle':result);$('#fixture-response').value='saved';
  }
  const reorder=state.match(/^reorder-(categories|items)-(edit|pending|saved|stale|unknown)$/);
  if(reorder){const [,scope,result]=reorder;directForm(scope,scope==='items'?'mains':null);[form.order[0],form.order[1]]=[form.order[1],form.order[0]];renderForm();if(result==='pending'){$('#fixture-response').value='pending';submit();}else if(result!=='edit')directAnswer(result==='unknown'?'unknown-changed':result);}
  if(state==='partial'){cat('mains').name='Main plates';version++;listVersion=version;read='partial';render();page('Main plates saved.','status',false);focus('[data-rename="mains"]');}
  document.documentElement.dataset.state=state;
})();
