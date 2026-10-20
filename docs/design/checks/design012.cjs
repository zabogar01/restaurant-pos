/* Run from the repository root after owner approval for installed headless Chrome.
   Set PLAYWRIGHT_MODULE to an installed Playwright module. Optional CHROME_PATH
   overrides installed macOS Chrome. Evidence stays outside the repository. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Set PLAYWRIGHT_MODULE to an installed Playwright module before running this check.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const base=path.resolve('docs/design/visual-directions'),out=process.env.DESIGN_EVIDENCE_DIR||'/tmp/design012-evidence/round2';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[],results={checks:[]};p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 const url=(file,state,extra='')=>pathToFileURL(path.join(base,'frost/back-office',file+'.html')).href+'?state='+state+extra;
 const check=(ok,label,detail)=>{results.checks.push({label,passed:!!ok});if(!ok)failures.push({label,detail});};
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'manifest.js'),'utf8'),ctx);
 results.states=[];
 for(const file of ['shell','patterns','menu','report-detail']) {
  await p.goto(url(file,file==='shell'?'none':file==='patterns'?'fields':'default'));
  const states=await p.evaluate(()=>WF.states);
  const registered=ctx.window.MOCKUPS.find(m=>m.path==='back-office/'+file+'.html').states.map(s=>s[0]);
  check(states.every(s=>registered.includes(s[0]))&&registered.length===states.length,'manifest states '+file,{states,registered});
  for(const [state] of states){
   await p.goto(url(file,state));
   const r=await p.evaluate(()=>({state:document.documentElement.dataset.state,title:document.title,bodyVisible:document.querySelector('.bo').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth,dialog:[...document.querySelectorAll('dialog[open]')].map(e=>({width:e.getBoundingClientRect().width,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})),focus:document.activeElement.id}));
    results.states.push({file,...r});check(r.state===state,'reachable '+file+'/'+state,r);check(!r.overflow,'no document horizontal overflow '+file+'/'+state,r);
    await p.screenshot({path:path.join(out,file+'-'+state+'.png')});
  }
 }
 await p.goto(url('shell','both'));
 results.geometry=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {nav:rect('.bonav'),brand:rect('.bonav__brand'),top:rect('.botop'),padding:getComputedStyle(document.querySelector('.bocontent')).padding,body:getComputedStyle(document.querySelector('.bo')).fontSize,emergencyAction:rect('.office-emergency .office-button'),receiptAction:rect('.office-receipt'),field:rect('#draft-name')};});
 check(results.geometry.nav.width===220&&results.geometry.brand.height===64&&results.geometry.top.height===64,'shell dimensions',results.geometry);
 check(results.geometry.padding==='24px'&&results.geometry.body==='14px'&&results.geometry.emergencyAction.height===36&&results.geometry.receiptAction.height===28&&results.geometry.field.height===40,'control dimensions',results.geometry);
 await p.screenshot({path:path.join(out,'shell-both.png')});
 const before=await p.locator('.bomain > .office-emergency').boundingBox();await p.locator('.bocontent').evaluate(e=>e.scrollTop=e.scrollHeight);
  const after=await p.locator('.bomain > .office-emergency').boundingBox();results.scroll={before,after,scrollTop:await p.locator('.bocontent').evaluate(e=>e.scrollTop)};check(JSON.stringify(before)===JSON.stringify(after)&&results.scroll.scrollTop>0,'emergency fixed after longest scroll',results.scroll);
  await p.goto(url('shell','reauth'));
  for(let i=0;i<4;i++){await p.keyboard.press('Escape');check(await p.locator('#reauth-dialog').evaluate(e=>e.open),'direct load Escape '+(i+1));}
  await p.locator('#reauth-dialog').evaluate(e=>e.close());await p.waitForFunction(()=>document.querySelector('#reauth-dialog').open);
  await p.locator('#draft-name').evaluate(e=>e.focus());check(await p.evaluate(()=>!!document.activeElement.closest('#reauth-dialog')),'unexpected close guard retains inert draft');
 await p.goto(url('shell','reauth-logout'));
 for(const key of ['Escape','Escape','Tab','Shift+Tab','Escape']){await p.keyboard.press(key);check(await p.evaluate(()=>document.querySelector('#reauth-dialog').open||document.querySelector('#logout-dialog').open),'N1 logout decision key '+key);}
 await p.locator('#reauth-logout').click();await p.locator('#logout-dialog').evaluate(e=>e.close());await p.waitForFunction(()=>document.querySelector('#reauth-dialog').open);
 await p.locator('#draft-name').evaluate(e=>e.focus());check(await p.evaluate(()=>!!document.activeElement.closest('#reauth-dialog')),'N1 forced logout close keeps draft inert');
 await p.goto(url('shell','reauth-throttled'));
 const announced=await p.locator('#cooldown-announcement').textContent();await p.waitForTimeout(1100);
 check(await p.locator('#cooldown-announcement').textContent()===announced,'N3 lockout announcement does not tick');
  for(const id of ['cooldown','logout-cooldown'])check(await p.locator('#'+id).getAttribute('aria-live')==='off'&&!await p.locator('#'+id).getAttribute('role'),'N3 timer is not a live region '+id);
  await p.goto(url('shell','reauth-other-throttled'));
  const otherAnnounced=await p.locator('#cooldown-announcement').textContent();
  check(/^This username is locked for .+\. This username is cooling down\. Other managers can sign in with their own usernames\.$/.test(otherAnnounced),'N3 other-manager snapshot separates title and body');
  await p.evaluate(()=>{window.announcementWrites=0;new MutationObserver(records=>window.announcementWrites+=records.length).observe(document.querySelector('#cooldown-announcement'),{childList:true,characterData:true,subtree:true});});
  await p.waitForTimeout(1100);await p.locator('#manager').press('End');await p.locator('#manager').press('Space');
  await p.locator('#manager').fill(' R.AYU ');
  check(await p.locator('#cooldown-announcement').textContent()===otherAnnounced&&await p.evaluate(()=>window.announcementWrites)===0&&await p.locator('#continue').isDisabled(),'N3 trailing-space and case edits never rewrite locked account announcement');
  await p.locator('#manager').fill('another.manager');check(await p.locator('#cooldown-announcement').textContent()===''&&await p.locator('#continue').isEnabled(),'N3 leaving locked account clears snapshot');
  await p.locator('#manager').fill('r.ayu');check((await p.locator('#cooldown-announcement').textContent()).startsWith('This username is locked for ')&&await p.locator('#continue').isDisabled(),'N3 returning to locked account announces newly present lock');
  for(const state of ['reauth','reauth-throttled','reauth-other-throttled','reauth-other-confirm']){
   await p.goto(url('shell',state));
   const focus=state==='reauth-other-confirm'?'stay-manager':state==='reauth-other-throttled'?'manager':state==='reauth-throttled'?'other-manager':'credential';
   await p.locator('#reauth-dialog').evaluate(e=>e.close());await p.waitForFunction(()=>document.querySelector('#reauth-dialog').open);
   check(await p.evaluate(()=>document.activeElement.id)===focus&&await p.evaluate(()=>document.documentElement.dataset.state)===state,'N1 direct close restores shared focus '+state);
   if(state==='reauth-other-confirm')continue;
   await p.locator('#reauth-logout').click();await p.locator('#logout-dialog').evaluate(e=>e.close());await p.waitForFunction(()=>document.querySelector('#reauth-dialog').open);
   check(await p.evaluate(()=>document.activeElement.id)===focus&&await p.evaluate(()=>document.documentElement.dataset.state)===state&&new URL(p.url()).searchParams.get('state')===state,'N1 forced logout close restores state and shared focus '+state);
   if(state==='reauth-other-throttled')check(await p.locator('#manager').inputValue()==='r.ayu'&&await p.locator('#continue').isDisabled(),'N1 forced close retains other account cooldown');
  }
 await p.goto(url('shell','none'));
 await p.locator('#draft-name').fill('Owner-edited fixture');await p.locator('#draft-choice').selectOption({label:'First choice'});await p.locator('[name=mode][value=standard]').check();await p.locator('#draft-limit').focus();await p.locator('#draft-limit').evaluate(e=>e.setSelectionRange(1,4));
 const snapshot=()=>p.evaluate(()=>({values:[...new FormData(document.querySelector('#draft')).entries()],error:document.querySelector('#draft-error').textContent,invalid:document.querySelector('#draft-limit').getAttribute('aria-invalid'),focus:document.activeElement.id,selection:[document.activeElement.selectionStart,document.activeElement.selectionEnd]}));
  const draftBefore=await snapshot();await p.keyboard.press('Alt+i');check(await p.locator('#reauth-dialog').evaluate(e=>e.open),'idle opens M6');for(let i=0;i<4;i++){await p.keyboard.press('Escape');check(await p.locator('#reauth-dialog').evaluate(e=>e.open),'M6 resists repeated Escape '+i);}
 let trapped=true;for(let i=0;i<16;i++){await p.keyboard.press(i<8?'Tab':'Shift+Tab');trapped=trapped&&await p.evaluate(()=>!!document.activeElement.closest('#reauth-dialog'));}check(trapped,'M6 focus trap');
 await p.locator('#credential').fill('fixture');await p.locator('#continue').click();await p.waitForFunction(()=>document.documentElement.dataset.state==='resumed');const draftAfter=await snapshot();results.draft={before:draftBefore,after:draftAfter};check(JSON.stringify(draftBefore)===JSON.stringify(draftAfter),'exact draft focus selection validation preservation',results.draft);await p.screenshot({path:path.join(out,'shell-resumed.png')});
 await p.keyboard.press('Alt+i');await p.locator('#reauth-dialog summary').click();await p.locator('#verify-result').selectOption('reauth-error');
 for(let i=0;i<5;i++){await p.locator('#credential').fill('fixture');await p.locator('#continue').click();await p.waitForFunction(()=>document.documentElement.dataset.state!=='reauth-verifying');if(i<4)check(await p.locator('#credential').inputValue()===''&&await p.locator('#credential').evaluate(e=>e===document.activeElement),'wrong secret cleared and focused '+i);}
 check(await p.locator('#continue').isDisabled()&&await p.locator('#reauth-logout').isEnabled(),'five-failure lockout actions');results.throttle=await p.locator('#cooldown').innerText();
   await p.locator('#reauth-logout').click();results.logoutCooldown=await p.locator('#logout-cooldown').innerText();check(/This username is locked/.test(results.logoutCooldown)&&/Other managers can sign in/.test(results.logoutCooldown)&&/Waiting here keeps your draft/.test(results.logoutCooldown)&&/\d+ (min|s)/.test(results.logoutCooldown),'logout explains per-account cooldown',results.logoutCooldown);await p.screenshot({path:path.join(out,'shell-throttled-logout.png')});await p.locator('#keep-session').click();check(await p.locator('#continue').isDisabled(),'lockout survives keep draft');
   await p.locator('#other-manager').click();check(await p.locator('#stay-manager').evaluate(e=>e===document.activeElement),'other-manager acknowledgement initially keeps current manager');await p.locator('#stay-manager').click();check(await p.locator('#continue').isDisabled(),'declining switch retains idled cooldown');
    await p.locator('#other-manager').click();await p.locator('#choose-manager').click();check(await p.locator('#continue').isEnabled()&&await p.locator('#manager').isEditable(),'other manager is not blocked by idled account');
    check(await p.locator('#manager').inputValue()==='','other-manager choice opens with empty username');
    await p.locator('#reauth-logout').click();check(await p.locator('#logout-cooldown').isHidden()&&await p.locator('#logout-cooldown').textContent()==='','other-manager logout omits even idled account cooldown');await p.locator('#keep-session').click();
   await p.locator('#back-manager').click();check(await p.locator('#continue').isDisabled(),'return restores idled wait');
  await p.goto(url('shell','reauth-kitchen'));await p.screenshot({path:path.join(out,'shell-reauth-kitchen.png')});check(await p.locator('#reauth-alert').isVisible(),'kitchen above scrim');
  await p.locator('#queue-incidents').click();await p.locator('#credential').fill('fixture');await p.locator('#continue').click();await p.waitForSelector('#logout-dialog[open]');check((await p.locator('#confirm-logout').getAttribute('href')).includes('incidents.html'),'queued incident destination');await p.locator('#keep-session').click();check(await p.locator('#draft-name').inputValue()==='Evening service — revised','queued navigation can preserve draft');
    await p.goto(url('shell','reauth-other'));check(await p.locator('#manager').inputValue()===''&&await p.locator('#credential').inputValue()===''&&await p.locator('#manager').evaluate(e=>e===document.activeElement)&&await p.locator('#manager').isEditable(),'different manager username empty editable and focused');await p.locator('#manager').fill('r.ayu');
   await p.locator('#reauth-dialog summary').click();await p.locator('#verify-result').selectOption('reauth-error');
   for(let i=0;i<5;i++){await p.locator('#credential').fill('short');await p.locator('#continue').click();await p.waitForFunction(()=>document.documentElement.dataset.state!=='reauth-other-verifying');}
    check(await p.locator('#continue').isDisabled(),'short credentials reach simulated verification and count on other account');
    await p.locator('#reauth-logout').click();check(await p.locator('#logout-cooldown').isHidden()&&await p.locator('#logout-cooldown').textContent()==='','other-manager logout omits submitted account cooldown');await p.screenshot({path:path.join(out,'shell-other-throttled-logout.png')});await p.locator('#keep-session').click();check(await p.locator('#continue').isDisabled()&&await p.locator('#manager').inputValue()==='r.ayu','declining logout preserves current other-account wait');
   await p.locator('#manager').fill('third.manager');check(await p.locator('#continue').isEnabled()&&await p.locator('#cooldown').isHidden(),'editing username removes unrelated lock');await p.locator('#manager').fill(' R.AYU ');check(await p.locator('#continue').isDisabled(),'normalized username restores original wait');
    await p.locator('#back-manager').click();check(await p.locator('#continue').isEnabled(),'other failures do not block idled manager');
    await p.locator('#other-manager').click();await p.locator('#choose-manager').click();check(await p.locator('#manager').inputValue()===''&&await p.locator('#credential').inputValue()==='','reopening after Back clears both fields');await p.locator('#manager').fill('r.ayu');check(await p.locator('#continue').isDisabled(),'clearing identity does not erase its account wait');
    await p.goto(url('shell','reauth-other'));await p.locator('#manager').fill('r.ayu');await p.locator('#credential').fill('sample');await p.locator('#continue').click();await p.waitForFunction(()=>document.documentElement.dataset.state==='other-signed-in');check(await p.locator('#draft').isHidden()&&await p.locator('.office-actor').innerText()==='R. Ayu · Manager','other manager enters separate empty area without draft');await p.keyboard.press('Alt+i');check(!await p.locator('#reauth-dialog').evaluate(e=>e.open)&&await p.locator('#draft').isHidden(),'old fixture idle shortcut cannot reopen prior manager work');
   await p.clock.install();await p.goto(url('shell','reauth-throttled'));await p.clock.fastForward(260000);check(/\b[34]\d s\b/.test(await p.locator('#cooldown').innerText())&&!/0 min/.test(await p.locator('#cooldown').innerText()),'subminute duration omits minutes');await p.clock.fastForward(41000);check(await p.locator('#cooldown').isHidden()&&await p.locator('#continue').isEnabled(),'zero ends cooldown without submission');
  results.focusRestoration=[];
  for(const selector of ['#idle','[data-nav=menu]','.office-logout']){
   await p.goto(url('shell','none'));await p.locator(selector).focus();
   if(selector==='#idle')await p.locator(selector).click();else await p.keyboard.press('Alt+i');
   await p.locator('#credential').fill('fixture');await p.locator('#continue').click();await p.waitForFunction(()=>document.documentElement.dataset.state==='resumed');
   const restored=await p.locator(selector).evaluate(e=>e===document.activeElement);results.focusRestoration.push({selector,restored});check(restored,'restore timeout focus '+selector);
  }
  await p.goto(url('shell','none'));await p.locator('[data-nav=menu]').click();check(await p.locator('#logout-dialog').evaluate(e=>e.open)&&await p.evaluate(()=>document.documentElement.dataset.state)==='unsaved','plain leave is not reauth logout');await p.locator('#keep-session').click();check(await p.evaluate(()=>document.documentElement.dataset.state)==='none'&&await p.locator('[data-nav=menu]').evaluate(e=>e===document.activeElement),'declining navigation restores original state and focus');
  for(const state of ['fields','fields-focused','fields-invalid','fields-readonly','fields-disabled']){
   await p.goto(url('patterns',state));
   for(const selector of ['#sample-text','#sample-secret','#sample-select','[name=mode][value=standard]']){
    const field=p.locator(selector);
    if(state==='fields-disabled'){check(await field.isDisabled(),'disabled '+selector);continue;}
    await field.focus();check(await field.evaluate(e=>e===document.activeElement),'focusable '+state+'/'+selector);
   }
   if(state==='fields-readonly'){
    await p.locator('#sample-select').focus();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
    await p.locator('[name=mode][value=alternate]').click();check(await p.locator('#sample-select').inputValue()==='First choice'&&await p.locator('[name=mode][value=standard]').isChecked(),'readonly choices retain values');
    await p.locator('#sample-select').evaluate(e=>{e.value='Second choice';e.dispatchEvent(new Event('change',{bubbles:true}));});check(await p.locator('#sample-select').inputValue()==='First choice','readonly change event restores value');await p.locator('#leave').click();await p.waitForURL('**/shell.html*');check(!p.url().includes('patterns.html'),'readonly attempted change does not prompt discard');
   }
  }
 await p.goto(url('patterns','fields'));await p.screenshot({path:path.join(out,'patterns-fields.png')});await p.locator('#open-dialog').click();let dialogTrap=true;for(let i=0;i<8;i++){await p.keyboard.press(i<4?'Tab':'Shift+Tab');dialogTrap=dialogTrap&&await p.evaluate(()=>!!document.activeElement.closest('#pattern-dialog'));}check(dialogTrap,'ordinary dialog traps both directions');
 results.dialog=await p.locator('#pattern-dialog').evaluate(e=>({width:e.getBoundingClientRect().width,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,bodyOverflow:e.querySelector('.office-dialog__body').scrollHeight-e.querySelector('.office-dialog__body').clientHeight}));check(results.dialog.width===640&&results.dialog.top>=24&&results.dialog.bottom<=876&&results.dialog.bodyOverflow>0,'dialog geometry',results.dialog);
  await p.locator('#close-dialog').focus();await p.keyboard.press('Shift+Tab');check(await p.locator('#pattern-dialog-body').evaluate(e=>e===document.activeElement&&e.getAttribute('role')==='region'&&e.getAttribute('aria-labelledby')==='pattern-dialog-title'),'overflowing body reachable and named');
  const scrollBefore=await p.locator('#pattern-dialog-body').evaluate(e=>e.scrollTop);await p.keyboard.press('PageDown');await p.waitForFunction(before=>document.querySelector('#pattern-dialog-body').scrollTop>before,scrollBefore);results.keyboardScroll=await p.locator('#pattern-dialog-body').evaluate(e=>e.scrollTop);
  await p.keyboard.press('Control+End');await p.waitForTimeout(250);results.dialogAfterKeyboard=await p.locator('#pattern-dialog').evaluate(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,scrollTop:e.querySelector('.office-dialog__body').scrollTop,headTop:e.querySelector('header').getBoundingClientRect().top,footBottom:e.querySelector('footer').getBoundingClientRect().bottom}));check(results.dialogAfterKeyboard.headTop>=24&&results.dialogAfterKeyboard.footBottom<=876,'keyboard scroll keeps dialog head and actions visible');await p.screenshot({path:path.join(out,'patterns-dialog.png')});await p.locator('#close-dialog').click();check(await p.locator('#open-dialog').evaluate(e=>e===document.activeElement),'dialog restores opener');
 await p.locator('#sample-text').fill('');await p.locator('#save').click();check(await p.locator('#text-error').isVisible(),'native field validation');await p.locator('#sample-text').fill('A preserved edit');await p.locator('#command-response').selectOption('refused');await p.locator('#save').click();await p.waitForFunction(()=>document.documentElement.dataset.state==='refused');check(await p.locator('#sample-text').inputValue()==='A preserved edit','refusal keeps edit');
 await p.locator('#command-response').selectOption('unknown');await p.locator('#save').click();await p.waitForFunction(()=>document.documentElement.dataset.state==='unknown');check(await p.locator('#save').isDisabled(),'unknown cannot repeat save');await p.waitForFunction(()=>document.documentElement.dataset.state==='reconciled');check((await p.locator('#command-status').innerText()).includes('No second request'),'unknown rereads');
  await p.locator('#sample-text').fill('Stay with this edit');await p.locator('#leave').click();await p.locator('#stay').click();check(await p.locator('#sample-text').inputValue()==='Stay with this edit','unsaved stay preserves edits');
   results.uncertainNavigation=[];
   for(const state of ['pending','unknown'])for(const selector of ['.bomain > .office-emergency a','.office-receipt','.office-logout','[data-nav=menu]']){
    await p.goto(url('patterns',state,'&alerts=both'));const target=await p.locator(selector).getAttribute('href');
    await p.locator(selector).click();check(await p.locator('#unsaved-dialog').evaluate(e=>e.open),'uncertain navigation opens decision '+state+'/'+selector);
    const copy=await p.locator('#unsaved-description').innerText();check(copy.includes('may or may not have succeeded')&&copy.includes('Leaving does not send it again'),'truthful uncertain departure '+state+'/'+selector);
    if(state==='unknown'&&selector.includes('office-emergency'))await p.screenshot({path:path.join(out,'patterns-unknown-leave.png')});
    await p.locator('#stay').click();check(await p.evaluate(()=>document.documentElement.dataset.state)===state&&await p.locator('#save').isDisabled(),'stay retains uncertainty '+state+'/'+selector);
    await p.locator(selector).click();await p.locator('#discard').click();await p.waitForURL(u=>u.pathname===new URL(target).pathname);const reached=new URL(p.url()).pathname===new URL(target).pathname&&new URL(p.url()).searchParams.get('alerts')===new URL(target).searchParams.get('alerts');results.uncertainNavigation.push({state,selector,reached});check(reached,'confirmed departure reaches target '+state+'/'+selector);
   }
   await p.goto(url('patterns','unknown'));await p.getByRole('button',{name:'Check saved sample',exact:true}).click();await p.waitForFunction(()=>document.documentElement.dataset.state==='reconciled');
  await p.goto(url('patterns','load-error'));await p.getByRole('button',{name:'Try again',exact:true}).click();await p.waitForFunction(()=>document.documentElement.dataset.state==='table');check(await p.locator('#sample-rows tr').count()===12,'failed read recovers rows');
  await p.goto(url('patterns','destructive'));await p.locator('#confirm-remove').click();check(await p.locator('#removed-result').isVisible()&&await p.locator('#open-destructive').isHidden(),'named removal result');
  await p.goto(url('patterns','table'));await p.locator('.bocontent').evaluate(e=>e.scrollTop+=220);results.sticky=await p.locator('.office-table th').first().boundingBox();check(Math.abs(results.sticky.y-64)<1,'table header meets scroll owner edge',results.sticky);check(await p.evaluate(()=>!!document.elementFromPoint(300,65).closest('th')),'no row in band above sticky header');await p.screenshot({path:path.join(out,'patterns-table-scrolled.png')});
  await p.locator('#next').click();check((await p.locator('#page-label').innerText()).includes('13–24'),'paging changes rows');check(await p.locator('#sample-rows button').first().getAttribute('aria-label')==='View sample: Sample 13','row name includes visible label');await p.locator('#sample-rows button').first().click();check((await p.locator('#pattern-dialog-title').innerText())==='Sample 13','row action preserves subject');await p.reload();check(await p.locator('#pattern-dialog-title').innerText()==='Sample 13','row subject survives reload');await p.locator('#close-dialog').click();check(await p.evaluate(()=>document.documentElement.dataset.state)==='table-page-2','row close restores page 2 state');await p.reload();check((await p.locator('#page-label').innerText()).includes('13–24'),'restored URL reloads page 2');await p.locator('#open-destructive').click();await p.locator('#cancel-remove').click();check(await p.evaluate(()=>document.documentElement.dataset.state)==='table-page-2','cancel removal restores original state');
  await p.goto(url('shell','reauth-kitchen'));check(await p.locator('#reauth-alert [data-incident-identity]').innerText()===await p.locator('.bomain > .office-emergency p').innerText(),'shared incident identity');
  for(const file of ['menu','report-detail']){await p.goto(url(file,'kitchen'));await p.screenshot({path:path.join(out,file+'-kitchen.png')});check(await p.locator('.bomain > .office-emergency').isVisible(),file+' kitchen state');}
  await p.goto(url('patterns','fields','&alerts=both'));const identity=await p.locator('.bomain > .office-emergency').innerText();await p.locator('[data-nav=menu]').click();check(await p.locator('.bomain > .office-emergency').innerText()===identity&&await p.locator('.office-receipt').isVisible(),'both alerts survive navigation to Menu');
  await p.goto(url('shell','none','&alerts=both'));check(await p.locator('.bomain > .office-emergency').isVisible()&&await p.locator('.office-receipt').isVisible(),'incoming alert context survives default shell state');
  results.prototypeLinks={};for(const file of ['shell','patterns','menu','report-detail']){await p.goto(url(file,file==='shell'?'both':file==='patterns'?'fields':'kitchen'));results.prototypeLinks[file]=await p.locator('a[href*="prototype/"]').evaluateAll(links=>links.map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')})));}
  await p.goto(pathToFileURL(path.join(base,'index.html')).href+'?direction=frost&screen=back-office/shell.html&state=reauth');await p.waitForSelector('iframe');check((await p.locator('iframe').getAttribute('src')).includes('shell.html?state=reauth'),'gallery routes new artifact');
  await p.goto(pathToFileURL(path.join(base,'paper/back-office/menu.html')).href);const paperGallery=await p.locator('.wfbar a').first().getAttribute('href');check(paperGallery==='../../index.html?direction=paper','Paper All screens keeps direction');await p.goto(new URL(paperGallery,p.url()).href);check((await p.locator('iframe').getAttribute('src')).startsWith('paper/'),'Paper gallery destination');
  for(const file of ['frost/pos/lock.html','../prototype/pos/lock.html','../prototype/back-office/login.html']){
   await p.setViewportSize(file.includes('/pos/')?{width:1280,height:800}:{width:1440,height:900});
   const href=pathToFileURL(path.resolve(base,file)).href;await p.goto(href);const states=await p.evaluate(()=>WF.states);
   for(const [state] of states){await p.goto(href+'?state='+state);check(await p.evaluate(()=>document.documentElement.dataset.state)===state,'sign-in artifact reachable '+file+'/'+state);await p.screenshot({path:path.join(out,file.replaceAll('/','-')+'-'+state+'.png')});}
   if(file.includes('/pos/')){await p.goto(href+'?state=incident');for(let i=0;i<5;i++)await p.getByRole('button',{name:'1',exact:true}).click();await p.keyboard.press('Enter');check(p.url().includes('lock.html'),'incident short PIN stays locked '+file);await p.getByRole('button',{name:'1',exact:true}).click();await p.getByRole('button',{name:'Continue',exact:true}).click();await p.waitForURL('**/incidents.html');check(p.url().includes('incidents.html'),'incident confirmation destination '+file);}
  }
  results.errors=errors;results.failures=failures;check(errors.length===0,'no script errors',errors);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({states:results.states.length,checks:results.checks.length,geometry:results.geometry,dialog:results.dialog,throttle:results.throttle,errors,failures},null,2));await browser.close();if(failures.length||errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
