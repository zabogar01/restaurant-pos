/* Ask the owner before EACH run. Evidence must stay outside the repository.
   PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node docs/design/checks/design019.cjs */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
if(!process.env.PLAYWRIGHT_MODULE)throw Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const base=path.resolve('docs/design/visual-directions'),out=process.env.DESIGN_EVIDENCE_DIR||'/tmp/design019-evidence/run1';
const url=(state='default',extra='')=>pathToFileURL(path.join(base,'frost/back-office/menu.html')).href+'?state='+state+extra;
const report={checks:[],states:[],measurements:[],errors:[]};let browser;
const check=(passed,name,detail)=>report.checks.push({passed:!!passed,name,...(!passed?{detail}:{})});
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'manifest.js'),'utf8'),ctx);
 const spec=ctx.window.MOCKUPS.find(x=>x.path==='back-office/menu.html');
 const go=async(s='default',extra='')=>{await p.goto(url(s,extra));await p.waitForFunction(()=>!!window.MenuFixture);};
 const fx=key=>p.evaluate(k=>MenuFixture[k],key);
 const choose=answer=>p.evaluate(a=>document.querySelector('#fixture-response').value=a,answer);
 const finish=answer=>p.evaluate(a=>{document.querySelector('#fixture-response').value=a;document.querySelector('#finish-command').click();},answer);
 const focus=()=>p.evaluate(()=>document.activeElement.id||document.activeElement.getAttribute('aria-label'));
 const row=id=>p.locator('[data-item="'+id+'"]');
 const named=async id=>(await fx('items')).find(x=>x.id===id);
 const save=()=>p.locator('#save-menu').click();
 await go();check(JSON.stringify(await p.evaluate(()=>WF.states))===JSON.stringify(spec.states),'every state registered in gallery');
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080}]){
  await p.setViewportSize(viewport);
  for(const [state] of spec.states){
   await go(state);
   const m=await p.evaluate(()=>({state:document.documentElement.dataset.state,overflow:document.documentElement.scrollWidth-innerWidth,contentOverflow:document.querySelector('.bocontent').scrollWidth-document.querySelector('.bocontent').clientWidth,
    count:document.querySelector('#menu-count').textContent,categories:MenuFixture.categories.length,items:MenuFixture.items.length,
    passwords:[...document.querySelectorAll('input[type=password]')].every(x=>!x.value),day:!!document.querySelector('.office-day'),
    prices:[...document.querySelectorAll('[data-item] .num')].map(x=>x.textContent),rows:document.querySelectorAll('[data-item]').length,actions:document.querySelectorAll('[data-availability]').length,
    form:!document.querySelector('#menu-editor').hidden,commands:MenuFixture.commands,dialogs:[...document.querySelectorAll('dialog[open]')].map(x=>({id:x.id,top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom})),
    visibleMain:[...document.querySelectorAll('[role=main]')].filter(x=>x.getClientRects().length).length}));
   report.states.push({viewport,...m});
   check(m.state===state&&!m.overflow&&m.contentOverflow<=1&&m.passwords&&!m.day&&m.visibleMain===1,'state geometry and identity '+state+'/'+viewport.width,m);
   if(m.count)check(m.count===m.categories+' categories · '+m.items+' items','counts match '+state+'/'+viewport.width,m);
   check(m.rows===m.actions&&m.prices.every(x=>/^\d{1,3}(\.\d{3})*$/.test(x)),'every row keeps availability and whole base price '+state+'/'+viewport.width,m);
   check(m.dialogs.every(x=>x.top>=0&&x.bottom<=viewport.height),'dialogs contained '+state+'/'+viewport.width,m.dialogs);
   check(m.commands.every(c=>c.kind==='create'||c.kind==='state'?c.expected===null:Number.isInteger(c.expected)),'version carried only by edits '+state+'/'+viewport.width,m.commands);
   if(/^(pending|unknown|failure|session)-(86|available|category-|item-)/.test(state)||['eightysix','available','category-archived','category-restored','item-archived','item-restored','duplicate-category-restore','duplicate-item-restore','leaserejected'].includes(state))check(!m.form,'state command opens no form '+state+'/'+viewport.width);
   await p.screenshot({path:path.join(out,state+'-'+viewport.width+'.png')});
  }
  await go('rename');const rect=s=>p.locator(s).boundingBox();const geometry={viewport,frame:await rect('.bo'),nav:await rect('.bonav'),top:await rect('.botop'),editor:await rect('#menu-editor'),field:await rect('#menu-name'),padding:await p.locator('.bocontent').evaluate(e=>getComputedStyle(e).padding)};
  check(geometry.frame.width===1440&&geometry.frame.x===(viewport.width-1440)/2&&geometry.nav.width===220&&geometry.top.height===64&&geometry.field.height===40&&geometry.padding==='24px','shared geometry '+viewport.width,geometry);
  await go('overflow');await p.locator('.bocontent').evaluate(e=>e.scrollTop=850);geometry.overflow={header:await rect('thead th:first-child'),owner:await rect('.bocontent'),scroll:await p.locator('.bocontent').evaluate(e=>e.scrollTop)};
  check(Math.abs(geometry.overflow.header.y-geometry.overflow.owner.y)<1&&geometry.overflow.scroll>0,'sticky header meets scroll owner '+viewport.width,geometry.overflow);
  const longs=await p.evaluate(()=>({category:MenuFixture.categories[0].name.length,item:Math.max(...MenuFixture.items.map(x=>x.name.length)),bad:[...document.querySelectorAll('[data-item] td')].filter(x=>x.scrollWidth>x.clientWidth+1).length}));
  check(longs.category===32&&longs.item===80&&longs.bad===0,'long names and amounts fit '+viewport.width,longs);
  await p.screenshot({path:path.join(out,'overflow-scrolled-'+viewport.width+'.png')});report.measurements.push(geometry);
 }
 await p.setViewportSize({width:1440,height:900});
 // Every row, including archived items and items in archived categories.
 await go();const records=await fx('items');
 for(const r of records){
  await go();const link=new URL(await row(r.id).locator('[data-edit]').getAttribute('href'),p.url());
  check(link.pathname.endsWith('/frost/back-office/item-editor.html')&&link.searchParams.get('item')===r.id&&link.searchParams.get('category')===r.category&&link.searchParams.get('returnItem')===r.id,'Edit carries exact subject '+r.id,link.href);
  await row(r.id).locator('[data-availability]').click();
  check((await named(r.id)).available===!r.available&&(await p.locator('#page-status').innerText()).includes(r.name)&&!(await p.locator('#menu-editor').isVisible()),'availability changes only clicked subject '+r.id);
  check((await fx('items')).filter(x=>x.id!==r.id).every(x=>x.available===records.find(y=>y.id===x.id).available),'other availability unchanged '+r.id);
  await row(r.id).locator('[data-availability]').click();check((await named(r.id)).available===r.available,'availability reversal '+r.id);
  await row(r.id).locator('[data-item-state]').click();check((await named(r.id)).active===!r.active,'archive or restore keeps subject '+r.id);
  await row(r.id).locator('[data-item-state]').click();check((await named(r.id)).active===r.active,'archive or restore reversal '+r.id);
 }
 await go('empty');check(await p.locator('#menu-count').innerText()==='0 categories · 0 items','new installation empty');
 await p.locator('#new-category').click();await save();check(await p.locator('#name-error').innerText()==='Enter a name'&&(await fx('commands')).length===0,'empty create sends nothing');
 await p.locator('#menu-name').fill('  Breakfast  ');check(await p.locator('#save-menu').isEnabled(),'typing enables Create');await save();
 check((await fx('categories'))[0].name==='Breakfast'&&(await fx('commands'))[0].expected===null,'trimmed first category creates without version');
 check(await p.locator('[data-new-item]').count()===1,'first category offers first item');
 check(await p.locator('[data-reorder]').isDisabled()&&await p.locator('#reorder-categories').isDisabled(),'nothing to reorder in an empty scope');
 await go();check(await p.locator('[data-reorder=sides]').isDisabled()&&await p.locator('[data-reorder=mains]').isEnabled(),'Reorder items needs two active items');
 for(const [value,text] of [['C'.repeat(33),'Use 32 characters or fewer.'],['Main\u0007','Remove control characters from the name.']]){
  await go('category');await p.locator('#menu-name').fill(value);await save();check(await p.locator('#name-error').innerText()===text&&(await fx('commands')).length===0,'local category refusal '+text);
  await p.locator('#menu-name').fill('Breakfast');await save();check((await fx('categories')).some(x=>x.name==='Breakfast'),'validation recovers '+text);
 }
 for(const r of [{id:'mains',name:'Mains'},{id:'sides',name:'Sides'},{id:'seasonal',name:'Seasonal'}]){
  await go();await p.locator('[data-rename="'+r.id+'"]').click();check(await p.locator('#menu-name').inputValue()===r.name,'rename opens subject '+r.id);
  await p.locator('#cancel-edit').click();check(await focus()==='Rename category '+r.name,'clean Cancel restores subject '+r.id);
  await p.locator('[data-rename="'+r.id+'"]').click();await p.locator('#menu-name').fill(r.name+' revised');await p.locator('#cancel-edit').click();await p.locator('#stay').click();check(await p.locator('#menu-name').inputValue()===r.name+' revised','Stay retains subject '+r.id);
  await p.locator('#cancel-edit').click();await p.locator('#discard').click();check(await focus()==='Rename category '+r.name,'Discard restores subject '+r.id);
 }
 for(const state of ['stale','reorder-categories-stale','reorder-items-stale','unknown-changed','reorder-items-unknown']){
  await go(state);const before=await fx('commands'),baseVersion=await p.evaluate(()=>MenuFixture.form.base);const draft=await p.evaluate(()=>MenuFixture.form.order||document.querySelector('#menu-name').value);
  check(await p.locator('#save-menu').isDisabled()&&await p.locator('#comparison').isVisible()&&await focus()==='form-notice','stale requires explicit decision '+state);
  await p.locator('#keep-draft').click();check((await fx('commands')).length===before.length&&await p.evaluate(()=>MenuFixture.form.base===MenuFixture.version)&&await focus()==='save-menu','Keep rebases only by choice '+state);
  check(JSON.stringify(await p.evaluate(()=>MenuFixture.form.order||document.querySelector('#menu-name').value))===JSON.stringify(draft),'Keep retains draft '+state);
  await save();check((await fx('commands')).at(-1).expected>baseVersion&&!(await p.locator('#menu-editor').isVisible()),'explicit save after Keep '+state);
  await go(state);const count=(await fx('commands')).length;await p.locator('#use-current').click();check((await fx('commands')).length===count&&!await p.locator('#comparison').isVisible(),'Use current sends nothing '+state);
 }
 for(const scope of ['categories','items']){
  await go();await p.locator(scope==='categories'?'#reorder-categories':'[data-reorder=mains]').click();
  const first=await p.locator('#draft-order li').first().getAttribute('data-order-id');await p.locator('#draft-order li').first().locator('[data-delta="1"]').focus();await p.keyboard.press('Enter');
  check(await p.locator('#draft-order li').nth(1).getAttribute('data-order-id')===first,'keyboard reorder '+scope);await save();check((await fx('commands')).at(-1).expected===12,'reorder carries opening version '+scope);
 }
 for(const state of ['duplicate-create','duplicate-rename']){await go(state);check(await p.locator('#name-error').isVisible()&&await focus()==='menu-name','duplicate focuses field '+state);}
 for(const state of ['duplicate-category-restore','duplicate-item-restore']){await go(state);check((await p.locator('#page-status').innerText()).includes('Rename this archived')&&!await p.locator('#menu-editor').isVisible(),'restore duplicate remains page command '+state);}
 await go('duplicate-category-restore');await p.locator('[data-rename=seasonal]').click();await p.locator('#menu-name').fill('Seasonal specials');await save();check(!(await fx('categories')).find(x=>x.id==='seasonal').active,'rename does not restore');await p.locator('[data-category-state=seasonal]').click();check((await fx('categories')).find(x=>x.id==='seasonal').active,'restore after rename explicit');
 await go();const retained=await fx('items');await p.locator('[data-category-state=mains]').click();check(JSON.stringify(await fx('items'))===JSON.stringify(retained),'category archive leaves every item unchanged');
 await p.locator('[data-category-state=mains]').click();check(JSON.stringify(await fx('items'))===JSON.stringify(retained),'category restore leaves every item unchanged');
 for(const state of ['pending-86','pending-available','saving','reorder-categories-pending']){
  await go(state);check(await p.locator('#new-category').isDisabled()&&await p.locator('#menu-rows button:enabled').count()===0,'one command across screen '+state);const n=(await fx('commands')).length;await finish('saved');check((await fx('commands')).length===n,'settle does not resend '+state);
 }
 await go('unknown-read-failed');const n=(await fx('commands')).length;await p.locator('#retry-read').click();check((await fx('commands')).length===n&&(await p.locator('#form-notice').innerText()).includes('Outcome not confirmed'),'reread cannot infer success');
 await go('stale-read-failed');await p.locator('#retry-read').click();check(await p.locator('#comparison').isVisible()&&await p.locator('#save-menu').isDisabled(),'stale failed reread restores decision');
 await go('partial');check(await p.locator('#menu-count').innerText()===''&&await p.locator('#new-category').isEnabled()&&(await p.locator('#read-state').innerText()).includes('may be out of date'),'partial known rows counts withheld');
 // Same and different manager, through both gates, with a visible held draft.
 for(const state of ['reauth','bo01-draft'])for(const same of [true,false]){
  await go(state);const commands=(await fx('commands')).length;
  if(state==='reauth'){
   check(await p.locator('#menu-frame').evaluate(e=>e.inert)&&await p.locator('#menu-name').isVisible(),'M-6 work visible and inert');
   if(!same){await p.locator('#other-manager').click();await p.locator('#resume').click();await p.locator('#reauth-user').fill('ratna.ayu');}
   await p.locator('#reauth-password').fill('fixture');await p.locator('#resume').click();
  }else{check(await p.locator('dialog[open]').count()===0&&!await p.locator('#menu-frame').isVisible(),'BO-01 closes working dialogs');await p.locator('#signin-user').fill(same?'m.iqbal':'ratna.ayu');await p.locator('#signin-password').fill('fixture');await p.locator('#signin-form button').click();}
  check((await fx('commands')).length===commands,'session recovery never submits '+state+'/'+same);
  check(same?await p.locator('#menu-name').inputValue()==='Main plates'&&await focus()==='menu-name':!await p.locator('#menu-editor').isVisible()&&await p.locator('#menu-name').inputValue()==='','identity owns draft '+state+'/'+same);
 }
 for(const state of ['reauth-decision','bo01-decision']){
  await go(state);if(state.startsWith('reauth')){await p.locator('#reauth-password').fill('fixture');await p.locator('#resume').click();}else{await p.locator('#signin-user').fill('m.iqbal');await p.locator('#signin-password').fill('fixture');await p.locator('#signin-form button').click();}
  check(await p.locator('#departure').isVisible()&&await focus()==='stay','decision restored before draft '+state);await p.locator('#stay').click();check(await p.locator('#menu-name').inputValue()==='Main plates','held decision keeps draft '+state);
 }
 for(const answer of ['saved','idle','unknown']){
  await go('saving');await p.evaluate(()=>document.querySelector('#fixture-idle').click());await finish(answer);await p.locator('#reauth-password').fill('fixture');await p.locator('#resume').click();
  if(answer==='idle'){await p.locator('#reauth-password').fill('fixture');await p.locator('#resume').click();}
  check((await fx('commands')).length===1,'pending answer held across gate '+answer);
  check(answer==='saved'?!await p.locator('#menu-editor').isVisible():await p.locator('#menu-name').inputValue()==='Main plates','held answer preserves proper outcome '+answer);
 }
 for(const before of [true,false]){
  await go('saving');await p.locator('#cancel-edit').click();if(before)await finish('saved');await p.locator('#discard').click();if(!before)await finish('saved');
  check((await fx('categories')).find(x=>x.id==='mains').name==='Main plates'&&!await p.locator('#menu-editor').isVisible()&&!await p.locator('#page-status').isVisible(),'discard retains late authoritative record '+before);
 }
 await go('rename');await p.keyboard.press('Escape');check(await p.locator('#departure').isVisible(),'Escape offers departure');await p.locator('#stay').click();await p.goBack();check(await p.locator('#departure').isVisible(),'browser Back offers departure');await p.locator('#stay').click();
 await p.locator('[data-nav=tables]').click();check(await p.locator('#departure').isVisible(),'rail offers departure');await p.locator('#stay').click();
 await p.locator('.office-logout').click();check(await p.locator('#departure-title').innerText()==='Log out and discard your changes?'&&await p.locator('#stay').innerText()==='Keep this draft','built logout copy retained');
 await go('leaserejected');check((await p.locator('#page-status').innerText()).includes('Quick-sale order ORD-1048')&&(await p.locator('#page-status').innerText()).includes('Try again when payment is no longer in progress.')&&await p.locator('#phase-note').isVisible(),'lease named and marked Phase 4');
 await go('default','&alerts=both');await p.locator('[data-rename=mains]').click();await p.locator('#menu-name').fill('Main plates');await p.locator('.office-logout').click();check(await p.locator('#departure-emergency').isVisible(),'emergency retained in departure');
 await go();const href=await p.locator('[data-nav=menu]').getAttribute('href');check(new URL(href,p.url()).pathname.endsWith('/frost/back-office/menu.html'),'Menu rail resolves Frost');
 await p.goto(pathToFileURL(path.join(base,'index.html')).href+'?direction=frost&screen=back-office/menu.html&state=stale');check((await p.locator('iframe').getAttribute('src')).includes('menu.html?state=stale'),'gallery opens stale state');
 await p.goto(pathToFileURL(path.join(base,'index.html')).href+'?direction=paper&screen=back-office/menu.html');check(await p.locator('#state option').count()===8,'Paper state list retained');
 const css=fs.readFileSync(path.join(base,'frost/back-office/menu.css'),'utf8');check(!/#[0-9a-f]{3,8}\b|\b\d+(?:px|rem)\b|font-weight:\s*\d/.test(css),'no raw color size or weight');
 // Round 2 (review findings 1 to 7). Each assertion is written so that it reports, rather than aborts, against round 1.
 // F1: the list keeps its own version; an answer that skips one leaves it, so the next rename is refused stale.
 await go();const otherTab=await p.locator('#fixture-other').count();if(otherTab)await p.evaluate(()=>document.querySelector('#fixture-other').click());
 await row('steak').locator('[data-availability]').click();await p.locator('[data-rename=mains]').click();await p.locator('#menu-name').fill('Main plates');await save();
 check(otherTab&&await p.locator('#comparison').isVisible()&&(await p.locator('#form-notice').innerText()).startsWith('The menu changed while you were editing.')&&(await fx('categories')).find(x=>x.id==='mains').name==='Mains','F1 skipped answer: next rename refused stale');
 await go();await row('steak').locator('[data-availability]').click();await p.locator('[data-rename=mains]').click();await p.locator('#menu-name').fill('Main plates');await save();
 check((await fx('commands')).at(-1).expected===13&&(await fx('categories')).find(x=>x.id==='mains').name==='Main plates','F1 contiguous answer: list advances, rename accepted');
 // F2: 86 on an item the POS does not offer does not claim it is disabled in place.
 for(const id of ['pie','stew']){await go();await row(id).locator('[data-availability]').click();const text=await p.locator('#page-status').innerText();
  check(text===(await named(id)).name+' is now marked 86. It stays hidden from the POS while it or its category is archived.','F2 hidden item 86 result '+id,text);}
 await go();await row('steak').locator('[data-availability]').click();check((await p.locator('#page-status').innerText()).includes('disabled in place'),'F2 offered item keeps disabled in place');
 // F3: a reorder needs a complete read.
 for(const state of ['loading','error','partial']){await go(state);check(await p.locator('#reorder-categories').isDisabled()&&await p.locator('[data-reorder]').count()>0&&await p.locator('[data-reorder]:enabled').count()===0,'F3 reorder openers disabled '+state);}
 // F5: the Phase 1 rail, and the walk between its three pages.
 const phase1=[['menu','Menu'],['tables','Tables'],['settings','Settings']];
 for(const [from] of phase1)for(const [to,label] of phase1){
  await p.goto(pathToFileURL(path.join(base,'frost/back-office',from+'.html')).href);await p.waitForFunction(()=>!!document.querySelector('.bonav [aria-current=page]'));
  if(to==='menu')check(JSON.stringify(await p.locator('.bonav a').evaluateAll(a=>a.map(x=>x.textContent)))==='["Menu","Tables","Discount presets","Settings"]','F5 Phase 1 rail on '+from,await p.locator('.bonav a').evaluateAll(a=>a.map(x=>x.textContent)));
  const link=p.locator('.bonav [data-nav='+to+']');if(!await link.count()){check(false,'F5 walk '+from+' → '+to,'no entry');continue;}
  await link.click();await p.waitForFunction(f=>location.pathname.endsWith('/'+f+'.html')&&!!document.querySelector('.bonav [aria-current=page]'),to,{timeout:5000}).catch(()=>{});
  check(new URL(p.url()).pathname.endsWith('/frost/back-office/'+to+'.html')&&await p.locator('.bonav [aria-current=page]').innerText()===label,'F5 walk '+from+' → '+to);
 }
 // F6: accessible names begin with the visible label.
 await go();check(await row('soda').locator('[data-availability]').getAttribute('aria-label')==='Make available Soda'&&await row('steak').locator('[data-availability]').getAttribute('aria-label')==='Mark Steak 86','F6 availability names');
 for(const state of ['reorder-categories-edit','reorder-items-edit']){await go(state);check(await p.evaluate(()=>[...document.querySelectorAll('#draft-order li')].every(li=>{const n=li.querySelector('.menu-order-name').textContent.replace(/^\d+\. /,''),[u,d]=li.querySelectorAll('button');return u.getAttribute('aria-label')==='Move up '+n&&d.getAttribute('aria-label')==='Move down '+n;})),'F6 move names '+state);}
 // F7: 86 and Make available act at once over a dirty editor; archive and restore keep the decision, worded to continue.
 await go();await p.locator('[data-rename=mains]').click();await p.locator('#menu-name').fill('Main plates');await row('steak').locator('[data-availability]').click();
 if(await p.locator('#departure').isVisible()){await p.locator('#stay').click();check(false,'F7 86 acts at once over a dirty rename','departure opened');}
 else{
  check(!(await named('steak')).available&&await p.locator('#menu-name').inputValue()==='Main plates'&&await p.locator('#menu-editor').isVisible(),'F7 86 acts at once over a dirty rename');
  await row('soda').locator('[data-availability]').click();check((await named('soda')).available&&!await p.locator('#departure').isVisible()&&await p.locator('#menu-name').inputValue()==='Main plates','F7 Make available acts at once');
  await save();check((await fx('categories')).find(x=>x.id==='mains').name==='Main plates'&&(await fx('commands')).at(-1).expected===14&&!await p.locator('#menu-editor').isVisible(),'F7 Save after own availability writes accepted');
 }
 for(const target of ['[data-item-state=burger]','[data-category-state=sides]']){
  await go();await p.locator('[data-rename=mains]').click();await p.locator('#menu-name').fill('Main plates');await p.locator(target).click();
  check(await p.locator('#departure').isVisible()&&await p.locator('#departure-body').innerText()==='Your edits have not been saved. Stay to keep editing, or discard them to continue.','F7 '+target+' asks, worded to continue');
  if(await p.locator('#departure').isVisible())await p.locator('#stay').click();
 }
 // Round 3: Archive over a draft whose save is unknown continues rather than leaves.
 await go('unknown');await p.locator('[data-item-state=burger]').click();check(await p.locator('#departure').isVisible()&&await p.locator('#departure-body').innerText()==='The save may or may not have succeeded. Continuing does not send it again. Stay to keep the draft, or discard it to continue.','R3 Archive over an unknown save, worded to continue');if(await p.locator('#departure').isVisible())await p.locator('#stay').click();
 check(report.errors.length===0,'no page errors',report.errors);
 await browser.close();browser=null;
 report.failures=report.checks.filter(x=>!x.passed);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.checks.length-report.failures.length,total:report.checks.length,states:spec.states.length,errors:report.errors,failures:report.failures,measurements:report.measurements},null,2));if(report.failures.length)process.exitCode=1;
})().catch(async e=>{report.error=e.stack;fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(report,null,2));console.error(e);if(browser)await browser.close();process.exitCode=1;});
