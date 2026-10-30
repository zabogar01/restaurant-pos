/* DESIGN-021. Run from the checkout root. The lead runs this browser check.
   PLAYWRIGHT_MODULE points to Playwright; evidence stays outside the repo. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root=path.resolve('docs/design/visual-directions'),out=process.env.DESIGN_EVIDENCE_DIR||'/tmp/design021-evidence';
const report={checks:[],measurements:[],errors:[]};
report.sources=Object.fromEntries(['frost-order-flow.js','frost-served-catalog.js','frost-served-catalog.css','frost/pos/order.html','manifest.js'].map(f=>[f,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));let browser;
const check=(passed,name,detail)=>report.checks.push({passed:!!passed,name,...(!passed?{detail}:{})});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>report.errors.push(e.message));
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'manifest.js'),'utf8'),ctx);
 const registered=ctx.window.MOCKUPS.find(x=>x.path==='pos/order.html').states;
 const states=registered.filter(([s])=>s.includes('served'));
 const go=async s=>{
  await p.goto(pathToFileURL(path.join(root,'frost/pos/order.html')).href+'?state='+s);
  // Remove only the review chrome, preserving the product's 1280×800 device.
  await p.addStyleTag({content:'.wfbar,.device__caption{display:none!important}.wfmain,.devicewrap{padding:0!important;margin:0!important}.wfmain{display:block!important}body{margin:0!important;padding:0!important}'});
 };
 await go('served');
 const wf=await p.evaluate(()=>WF.states.map(s=>s[0]));
 check(states.every(([s])=>wf.includes(s))&&wf.filter(s=>s.includes('served')).length===states.length,'all served states registered in WF and manifest');
 check(registered[0][0]==='default','gallery retains original first state');
 for(const [state] of states){
  await go(state);
  const m=await p.evaluate(()=>{
   const visible=e=>!!e.getClientRects().length;
   const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,client:e.clientWidth,scroll:e.scrollWidth};};
   const all=s=>[...document.querySelectorAll(s)].filter(visible);
   return {doc:{client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth},pos:box(document.querySelector('.pos')),tiles:all('.served-grid .tile').map(box),categories:all('.cat').map(box),options:all('.served-drawer [data-option]').map(box),presets:all('[data-preset]').map(box),footer:all('.served-drawer .sheet__foot .btn').map(box),sheet:all('.served-drawer .sheet').map(box),body:all('.served-drawer .sheet__body').map(e=>({...box(e),height:e.clientHeight,scrollHeight:e.scrollHeight})),lines:all('.line__n').map(e=>({text:e.textContent,...box(e),whiteSpace:getComputedStyle(e).whiteSpace,overflow:getComputedStyle(e).overflow})),prices:all('.served-grid .tile__p').map(box)};
  });report.measurements.push({state,...m});
  check(m.doc.scroll<=m.doc.client&&m.pos.w===1280&&m.pos.h===800,'1280×800 without document overflow '+state,m);
  check([...m.options,...m.presets].every(r=>r.w>=48&&r.h>=72&&r.scroll<=r.client+1),'option and preset touch targets/text fit '+state);
  check(m.footer.every(r=>r.h>=72&&r.x>=0&&r.x+r.w<=820&&r.y>=64&&r.y+r.h<=800),'footer controls stay visible '+state,m.footer);
  check(m.tiles.every(r=>r.w===150&&r.h===96)&&m.prices.every(r=>r.scroll<=r.client+1),'fixed tiles and complete price '+state,m.tiles.slice(0,2));
  check(!await p.locator('.pos a[href*="back-office"]').count(),'no cross-client product navigation '+state);
  if(state.startsWith('quick'))check(!await p.locator('.actions :visible').filter({hasText:/^Send .*kitchen$/}).count(),'counter has no fire '+state);
  if(['served-extremes','served-item-extremes','served-item-many','served-line-long','served-line-indonesian','served-item-indonesian','served-presets','served-presets-many','served-empty','served-error','served-stale','served-item-removed','served-item-order-bound'].includes(state))await p.screenshot({path:path.join(out,state+'.png')});
 }
 // Scroll owners keep the final control reachable while the footer stays fixed.
 for(const [state,owner,last] of [['served-item-many','.served-drawer .sheet__body','[data-option]'],['served-presets-many','.served-drawer .sheet__body','[data-preset]'],['served-categories','.catrail','[data-category]'],['served-overflow','.served-grid','[data-item]']]){
  await go(state);const before=await p.locator('.served-drawer .sheet__foot').count()?await p.locator('.served-drawer .sheet__foot').boundingBox():null;
  await p.locator(last).last().scrollIntoViewIfNeeded();const m=await p.locator(owner).evaluate(e=>({height:e.clientHeight,scrollHeight:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth,scrollTop:e.scrollTop}));
  check(m.scrollHeight>m.height&&m.scrollTop>0&&m.scrollWidth<=m.width,'independent scroll reaches final control '+state,m);
  if(before)check(JSON.stringify(before)===JSON.stringify(await p.locator('.served-drawer .sheet__foot').boundingBox()),'scroll retains footer '+state);
  report.measurements.push({state:state+'-scrolled',owner:m});await p.screenshot({path:path.join(out,state+'-scrolled.png')});
 }
 await go('served');await p.getByRole('link',{name:'Discount',exact:true}).click();check(await p.locator('[data-preset]').count()===5,'served Discount opens current picker in place');
 // Read failures, retry focus, and threshold/clear without focus stealing.
 await go('served-error');check(await p.evaluate(()=>document.activeElement.id)==='served-retry','first failure focuses Try again');
 await p.getByRole('button',{name:'Try again',exact:true}).click();check(await p.locator('.served-grid').isVisible()&&await p.evaluate(()=>document.activeElement.classList.contains('cat')),'retry success focuses first category');
 await go('served');await p.locator('[data-item=nasi]').focus();
 await p.evaluate(()=>ServedCatalogFixture.refresh('failed'));check(await p.locator('#served-status').textContent()==='','no stale notice on first failed poll');
 await p.evaluate(()=>ServedCatalogFixture.refresh('failed'));check((await p.locator('#served-status').textContent()).includes('may be out of date'),'second failure shows quiet notice');
 await p.evaluate(()=>ServedCatalogFixture.refresh('success'));check(await p.locator('#served-status').textContent()===''&&await p.evaluate(()=>document.activeElement.dataset.item)==='nasi','successful refresh clears notice without moving focus');
 // Availability changes hold the exact slot and focus; archive leaves a hole.
 const before=await p.locator('[data-item=tea]').boundingBox();await p.evaluate(()=>ServedCatalogFixture.refresh('86'));
 check(JSON.stringify(before)===JSON.stringify(await p.locator('[data-item=tea]').boundingBox())&&await p.locator('[data-item=nasi]').getAttribute('aria-disabled')==='true','86 never moves neighboring tile');
 await p.locator('[data-item=nasi]').evaluate(e=>e.click());check(!await p.locator('.served-drawer').count(),'86 tile cannot open a sheet');
 await p.evaluate(()=>ServedCatalogFixture.refresh('restore'));check(await p.locator('[data-item=nasi]').getAttribute('aria-disabled')==='false','restore re-enables same tile');
 await p.locator('[data-item=nasi]').focus();await p.evaluate(()=>ServedCatalogFixture.refresh('archive'));
 check((await p.locator('[data-item=tea]').boundingBox()).x<before.x&&await p.evaluate(()=>document.activeElement.dataset.category)==='meals','archive reflows and focused removal returns to category');
 // Every item goes through the one sheet, including zero and no-option items.
 await go('served');await p.locator('[data-item=water]').click();check(await p.locator('#flow-title').textContent()==='Drinking Water'&&await p.locator('[data-option]').count()===0,'no-option tile opens M-2');
 await p.locator('.flow-save').click();check((await p.locator('.lines').textContent()).includes('Drinking Water'),'explicit Add commits served item');
 await go('served-item-both');check(await p.locator('.flow-save').isDisabled(),'no default variant; Add waits');
 await p.locator('[data-group="0"][data-option="1"]').click();await p.locator('[data-group="1"][data-option="0"]').click();
 check(await p.locator('#served-unit').textContent()==='40.000'&&!await p.locator('.flow-save').isDisabled(),'variant and flat modifier resolve displayed unit');
 await p.evaluate(()=>ServedCatalogFixture.sheetRefresh('86'));check(await p.locator('.flow-save').isDisabled()&&await p.locator('[data-group="0"][data-option="1"]').getAttribute('aria-pressed')==='true','mid-sheet 86 retains choices and disables Add');
 check(!await p.locator('[data-step="1"]').isDisabled(),'86 keeps usable quantity stepper');
 await go('served-item-floor');check(await p.locator('#served-unit').textContent()==='0','negative resolved unit floors at zero');
 await go('served-item-both');await p.locator('[data-group="0"][data-option="0"]').click();await p.locator('[data-group="0"][data-option="0"]').focus();await p.evaluate(()=>ServedCatalogFixture.sheetRefresh('removed'));
 check(await p.evaluate(()=>document.activeElement.id)==='option-group-0'&&await p.locator('.flow-save').isDisabled()&&(await p.locator('#served-sheet-notice').textContent()).includes('Regular'),'removed selected variant named, cleared, focused group retained');
 await go('served-item-line-bound');check(await p.locator('[data-step="1"]').isDisabled()&&!await p.locator('.flow-save').isDisabled(),'plus stops at line money bound');
 await go('served-item-order-bound');check(await p.locator('.flow-save').isDisabled()&&(await p.locator('#served-add-reason').textContent()).includes('Order total'),'Add refuses order monetary ceiling');
 await go('served-item-choice-bound');check(await p.locator('.flow-save').isDisabled()&&(await p.locator('#served-add-reason').textContent()).includes('Line total'),'option choice at one can exceed ceiling');
 for(const state of ['served-line-bound','quick-served-line-bound']){await go(state);check(await p.locator('.flow-save').isDisabled()&&!await p.locator('[data-step="-1"]').isDisabled(),'line editor ceiling and usable minus '+state);await p.locator('[data-step="-1"]').click();check(await p.locator('#served-add-reason').textContent()==='','decreasing clears ceiling '+state);}
 await go('served-item-modifier-removed');check(!await p.locator('.flow-save').isDisabled()&&(await p.locator('#served-sheet-notice').textContent()).includes('Fried egg'),'removed modifier clears price but leaves valid variant');
 await go('served-item-restored');check(await p.locator('#served-sheet-notice').isHidden()&&!await p.locator('.flow-save').isDisabled(),'restoration clears availability notice');
 await go('served-item-reorder');check(await p.locator('[data-option-id="option-0-0"]').getAttribute('aria-pressed')==='true'&&await p.locator('#served-sheet-notice').isHidden(),'option identity survives reorder with no notice');
 await go('served-category-empty');check(await p.locator('.cat').isVisible()&&(await p.locator('.served-grid').textContent()).includes('No items in this category yet.'),'empty active category stays selectable');
 for(const state of ['served-presets-loading','served-presets-error']){await go(state);check(await p.locator('.served-freeform').isVisible()&&!await p.locator('[data-preset]').count(),'free-form survives preset read '+state);}
 await go('served-fireblocked');check((await p.locator('.served-fire-notice').textContent()).includes('Nasi Goreng, Jasmine Tea are 86’d')&&await p.locator('.actions button').filter({hasText:'Send 2 to kitchen'}).isDisabled(),'plural served fire refusal');
 // Full names in sheet and order; collision is deliberate, price and full sheet distinguish.
 await go('served-extremes');
 for(const id of ['collisionA','collisionB','long','longReal']){
  const name=await p.locator('[data-item="'+id+'"]').getAttribute('aria-label');await p.locator('[data-item="'+id+'"]').click();
  check(name.startsWith(await p.locator('#flow-title').textContent()),'full accessible and sheet name '+id);await p.locator('[data-cancel]').click();
 }
 for(const state of ['served-line-long','served-line-indonesian']){await go(state);const m=await p.locator('.line').evaluate(e=>{const n=e.querySelector('.line__n'),r=e.getBoundingClientRect(),slot=e.querySelector('.line__x').getBoundingClientRect();return {name:n.textContent,full:n.scrollHeight<=n.clientHeight&&n.scrollWidth<=n.clientWidth,slot:{w:slot.width,h:slot.height,right:slot.right},right:r.right};});check(m.full&&m.slot.w===56&&m.slot.h>=56&&m.slot.right<=m.right,'full order name and trailing slot '+state,m);}
 // The picker describes a choice only: no fixture discount arithmetic added here.
 await go('served-presets');check((await p.locator('#served-presets').textContent()).includes('12,3456%')&&(await p.locator('#served-presets').textContent()).includes('99.999.999 off'),'decimal precision and stored fixed value shown');
 check(await p.locator('[data-preset=zero-fixed]').count()===1&&await p.locator('[data-preset=zero-rate]').count()===1,'both zero preset kinds shown');
 await p.locator('[data-preset=regular]').focus();await p.evaluate(()=>ServedCatalogFixture.deactivatePreset('regular',true));check(!await p.locator('[data-preset=regular]').count()&&await p.evaluate(()=>document.activeElement.id)==='preset-heading'&&await p.locator('#preset-change').isHidden(),'deactivation silently removes entry and focuses heading');
 await go('served-presets-empty');check(await p.locator('.served-freeform').isVisible()&&!await p.locator('[data-preset]').count(),'no presets keeps free-form route');
 // The twelve old pictures remain item-specific and all previous states execute.
 for(const state of wf.filter(s=>!s.includes('served'))){await go(state);}
 for(const [id,name] of Object.entries({burger:'Burger',wings:'Chicken Wings',steak:'Steak',fish:'Fish & Chips',salad:'Caesar Salad',soup:'Soup of the Day',fries:'Fries',rings:'Onion Rings',soda:'Soda',coffee:'Coffee',beer:'Beer',wine:'House Wine'})){await go('sheet-item-'+id);check(await p.locator('#flow-title').textContent()===name,'legacy item sheet '+id);}
 check(!report.errors.length,'no page errors',report.errors);
 report.summary={states:states.length,passed:report.checks.filter(x=>x.passed).length,total:report.checks.length};
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(report,null,2));await browser.close();
 console.log(JSON.stringify({...report.summary,failures:report.checks.filter(x=>!x.passed),errors:report.errors,evidence:out},null,2));
 if(report.checks.some(x=>!x.passed))process.exitCode=1;
})().catch(async e=>{report.aborted=String(e);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(report,null,2));console.error(e);if(browser)await browser.close();process.exitCode=1;});
