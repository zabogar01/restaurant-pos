/* Run once only with the owner's approval. Provide PLAYWRIGHT_MODULE and optionally
   CHROME_PATH. All captures and measurements remain outside the repository. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const base=path.resolve('docs/design/visual-directions'),out=process.env.DESIGN013_OUTPUT||'/tmp/design013-evidence';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],result={checks:[],states:[]};
 p.on('pageerror',e=>errors.push(e.message));
 const check=(ok,name,detail)=>{result.checks.push({name,passed:!!ok,...(detail?{detail}:{})});};
 const url=(file='incidents',state='default',extra='')=>pathToFileURL(path.join(base,'frost/back-office/'+file+'.html')).href+'?state='+state+extra;
 const row=id=>p.locator('[data-incident="'+id+'"]');
 const ids={kitchen:'ticket-1',cancel:'cancel-1',receipt:'receipt-1'};
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'manifest.js'),'utf8'),ctx);
 await p.goto(url());const states=await p.evaluate(()=>WF.states.map(s=>s[0]));
 check(JSON.stringify(states)===JSON.stringify(ctx.window.MOCKUPS.find(x=>x.path==='back-office/incidents.html').states.map(s=>s[0])),'every state registered');
 for(const state of states){
  await p.goto(url('incidents',state));
  const measurement=await p.evaluate(()=>({state:document.documentElement.dataset.state,width:document.querySelector('.bo').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth,contentOverflow:document.querySelector('.bocontent').scrollWidth-document.querySelector('.bocontent').clientWidth,rows:[...document.querySelectorAll('[data-incident]')].map(r=>({id:r.dataset.incident,kind:r.dataset.kind})),text:document.querySelector('main').innerText}));
  result.states.push(measurement);check(measurement.state===state,'reachable '+state);check(measurement.overflow===0&&measurement.contentOverflow===0,'no horizontal overflow '+state,measurement);
  if(state.includes('cancel'))check(measurement.text.includes('Cancellation ticket'),'cancellation remains named '+state);
  if(state.endsWith('-unknown')&&!state.includes('reprint'))check(measurement.text.includes('May already have printed.'),'uncertain delivery copy '+state);
  if(state.includes('reprint')||state.includes('reread')){const kind=state.split('-')[0];check(await row(ids[kind]).locator('[data-result]').count()===1,'result belongs to '+state);check(await p.locator('[data-result]').count()===1,'only one result '+state);}
  await p.screenshot({path:path.join(out,state+'.png')});
 }
 await p.goto(url());
 result.geometry=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{frame:rect('.bo'),nav:rect('.bonav'),top:rect('.botop'),banner:rect('.office-emergency'),kitchen:rect('[data-reprint="ticket-1"]'),receipt:rect('[data-reprint="receipt-1"]'),padding:getComputedStyle(document.querySelector('main')).padding,body:getComputedStyle(document.body).fontSize};});
 check(result.geometry.nav.width===220&&result.geometry.top.height===64&&result.geometry.padding==='24px'&&result.geometry.body==='14px','slice A frame retained',result.geometry);
 check(result.geometry.kitchen.height===36&&result.geometry.receipt.height===28,'recovery actions 36 and 28',result.geometry);
 for(const [kind,id] of Object.entries(ids))for(const response of ['sent','failed','unknown','printed']){
  await p.goto(url());const others=Object.values(ids).filter(x=>x!==id),before=await Promise.all(others.map(x=>row(x).innerHTML()));
  await p.locator('.office-fixture summary').click();await p.locator('#reprint-response').selectOption(response);
  await p.locator('[data-reprint="'+id+'"]').click();
  await p.waitForFunction(({id,response})=>{const e=document.querySelector('[data-result="'+id+'"]');return e&&(response==='sent'?e.innerText.includes('reprint sent.'):response==='failed'?e.innerText.includes('failed again.'):response==='unknown'?e.innerText.includes('outcome unknown.'):e.innerText.includes('server confirmed PRINTED'));},{id,response});
  check(JSON.stringify(before)===JSON.stringify(await Promise.all(others.map(x=>row(x).innerHTML()))),'other incidents unchanged '+kind+'/'+response);
  check(await row(id).getAttribute('data-kind')===kind,'class preserved '+kind+'/'+response);
  if(response==='unknown'){check(await row(id).locator('[data-result]').getAttribute('aria-busy')==='true'&&await p.locator('[data-reprint="'+id+'"]').isDisabled(),'automatic reread is busy '+kind);await p.waitForFunction(id=>document.querySelector('[data-result="'+id+'"]').dataset.outcome==='printed',id);check(await row(id).locator('[data-result]').getAttribute('aria-busy')==='false'&&(await row(id).innerText()).includes('server confirmed PRINTED'),'unknown reread confirms authoritative result '+kind);}
  check(await row(id).count()===1,'reprint never clears '+kind+'/'+response);
 }
 for(const kind of ['kitchen','cancel']){
  await p.goto(url('incidents',kind+'-failed'));const id=ids[kind];check(await p.locator('[data-clear="'+id+'"]').isDisabled(),'unchecked clear disabled '+kind);
  await p.locator('[data-checked="'+id+'"]').check();check(await p.locator('[data-clear="'+id+'"]').isEnabled(),'checked clear enabled '+kind);await p.locator('[data-clear="'+id+'"]').click();check(await p.locator('.office-emergency').isHidden()&&await p.locator('#read-status').innerText()==='Nothing outstanding\n\nNo unresolved print incidents.','last emergency clears '+kind);
 }
 await p.goto(url());await p.locator('.office-fixture summary').click();await p.locator('#resolve-pos').click();check(await row('ticket-1').count()===0&&await row('cancel-1').count()===1&&(await p.locator('#external-status').innerText()).includes('was cleared on the POS'),'cross-client identity and attribution');
 await p.goto(url('incidents','error'));await p.getByRole('button',{name:'Try again',exact:true}).click();check((await p.locator('#read-status').innerText()).includes('Reading'),'retry traverses loading');await p.waitForSelector('[data-incident]');check(await p.locator('[data-incident]').count()===3,'retry returns mixed table');
 // Round 2: each reread outcome, keyboard interleavings, and external clearance.
 for(const [kind,id] of Object.entries(ids))for(const response of ['unknown','failed','error','printed']){
  await p.goto(url('incidents',kind+'-reprint-unknown'));
  await p.locator('.office-fixture summary').click();await p.locator('#reread-response').selectOption(response);
  const others=Object.values(ids).filter(x=>x!==id),before=await Promise.all(others.map(x=>row(x).innerHTML()));
  await p.locator('[data-check="'+id+'"]').click();
  check(await p.locator('[data-reprint="'+id+'"]').isDisabled()&&await row(id).locator('[data-result]').getAttribute('aria-busy')==='true','reread in flight disables reprint '+kind+'/'+response);
  await p.waitForFunction(id=>document.querySelector('[data-result="'+id+'"]').getAttribute('aria-busy')==='false',id);
  const outcome=response==='printed'?'printed':'read-'+response;
  check(await row(id).locator('[data-result]').getAttribute('data-outcome')===outcome,'reread selects actual response '+kind+'/'+response);
  check(await p.locator('[data-reprint="'+id+'"]').isEnabled(),'completed reread restores explicit reprint '+kind+'/'+response);
  check(JSON.stringify(before)===JSON.stringify(await Promise.all(others.map(x=>row(x).innerHTML()))),'reread leaves other incidents unchanged '+kind+'/'+response);
  if(response==='unknown')check((await row(id).innerText()).includes('May already have printed. Check the printer before reprinting.'),'still unknown retains delivery warning '+kind);
  if(response==='failed')check((await row(id).innerText()).includes('The reread confirms it did not print.'),'failed reread is definite '+kind);
  if(response==='error'){
   check(await p.locator('[data-check="'+id+'"]').innerText()==='Try again','read error has retry '+kind);
   await p.locator('#reread-response').selectOption('unknown');await p.locator('[data-check="'+id+'"]').click();
   await p.waitForFunction(id=>document.querySelector('[data-result="'+id+'"]').dataset.outcome==='read-unknown',id);
   check(await p.locator('[data-reprint="'+id+'"]').isEnabled(),'read error retry recovers '+kind);
  }
  await p.reload();check(await p.locator('[data-reprint="'+id+'"]').isEnabled(),'completed reread remains recoverable after reload '+kind+'/'+response);
 }
 // Freeze fixture timers so the keyboard interleaving is deterministic.
 await p.clock.install();await p.clock.pauseAt(new Date());
 for(const target of ['reprint','check']){
  await p.goto(url('incidents',target==='check'?'kitchen-reprint-sent':'default'));
  await p.locator('.office-fixture summary').click();await p.locator('#reprint-response').selectOption('failed');
  await p.locator('[data-reprint="cancel-1"]').focus();await p.keyboard.press('Enter');
  if(target==='reprint'){
   // Cancellation result gets focus while sending; two Shift+Tabs return to the work reprint.
   await p.keyboard.press('Shift+Tab');await p.keyboard.press('Shift+Tab');
  }else await p.locator('[data-check="ticket-1"]').focus();
  check(await p.locator('[data-'+target+'="ticket-1"]').evaluate(e=>e===document.activeElement),'keyboard reaches other incident '+target);
  await p.clock.runFor(650);
  check(await p.locator('[data-'+target+'="ticket-1"]').evaluate(e=>e===document.activeElement),'asynchronous cancellation preserves other incident focus '+target);
  check(new URL(p.url()).searchParams.get('incidentResults').includes('cancel-1:failed'),'async completion updates context without exception '+target);
  if(target==='reprint'){
   await p.keyboard.press('Enter');
   check(await row('ticket-1').locator('[data-result]').getAttribute('data-outcome')==='pending'&&await row('cancel-1').locator('[data-result]').getAttribute('data-outcome')==='failed','Enter acts on intended kitchen incident');
  }
 }
 // A disappeared Check delivery control falls back within its own incident safely.
 await p.goto(url('incidents','kitchen-reprint-sent'));await p.locator('[data-check="ticket-1"]').focus();await p.keyboard.press('Enter');await p.clock.runFor(650);
 check(await row('ticket-1').evaluate(e=>e.contains(document.activeElement))&&new URL(p.url()).searchParams.get('incidentResults').includes('ticket-1:printed'),'missing control restores focus within original incident');
 // Simulate the unsolicited POS event without pointer/focus moving to the review button.
 for(const state of ['default','kitchen-failed']){
  await p.goto(url('incidents',state));const focus=state==='default'?'[data-reprint="cancel-1"]':'[data-nav="menu"]';await p.locator(focus).focus();
  const selector=state==='default'?'[data-incident="cancel-1"]':'.office-fixture';const before=await p.locator(selector).boundingBox();
  await p.evaluate(()=>document.querySelector('#resolve-pos').click());
  const after=await p.locator(selector).boundingBox();
  check(await p.locator(focus).evaluate(e=>e===document.activeElement),'POS clearance preserves unrelated focus '+state);
  check(before.y===after.y&&before.height===after.height,'POS clearance does not shift rows or following content '+state,{before,after});
  check(await p.locator('[data-cleared="ticket-1"]').isVisible()&&await p.locator('[data-cleared] button:enabled,[data-cleared] input:enabled').count()===0,'POS marker is present and non-interactive '+state);
  check((await p.locator('#external-status').textContent()).includes('was cleared on the POS'),'POS clearance announces attribution '+state);
  await p.screenshot({path:path.join(out,'pos-clearance-'+state+'.png')});
  await p.locator('.office-fixture summary').click();check(await p.locator('[data-cleared]').count()===0,'next manager action retires marker '+state);
 }
 await p.clock.resume();
 await p.goto(url('incidents','cleared-elsewhere'));await p.reload();check(await p.locator('[data-cleared="ticket-1"]').isVisible()&&(await p.locator('#external-status').textContent()).includes('was cleared on the POS'),'cleared-elsewhere survives reload');
 for(const state of ['loading','error']){
  await p.goto(url('incidents',state));check(await p.locator('#resolve-pos').isDisabled(),'POS simulation disabled before list read '+state);
  await p.evaluate(()=>document.querySelector('#resolve-pos').click());check(await p.locator('[data-incident]').count()===0&&await p.locator('#urgent-section').isHidden(),'unread page cannot render incident rows '+state);
 }
 for(const state of states.filter(s=>s.includes('reprint')||s.includes('reread'))){
  const mode=state.startsWith('kitchen')?'receipt':'kitchen';await p.goto(url('incidents',state,'&alerts='+mode));
  check(await p.locator('[data-incident]').count()===1&&await p.locator('[data-result]').count()===0,'excluded class respects incoming alerts '+state);
 }
 await p.goto(url());check((await row('cancel-1').innerText()).includes('Table 4')&&!(await row('ticket-1').innerText()).includes('Table 4'),'cancellation fixture belongs to another order');
 check((await row('cancel-1').innerText()).includes('Cancelled 20:02 WIB'),'cancellation time labelled');
 check((await p.locator('.office-emergency p').innerText()).startsWith('1 kitchen ticket · 1 cancellation'),'banner counts both emergency classes');
 await p.goto(url('incidents','overflow'));check((await p.locator('.office-emergency p').innerText()).startsWith('7 kitchen tickets · 7 cancellations'),'overflow banner counts each class');
 for(const state of ['kitchen-reprint-pending','kitchen-reprint-sent','kitchen-reprint-printed']){await p.goto(url('incidents',state));check(!/FAILED|PRINTED/.test(await p.locator('.office-emergency').innerText()),'banner avoids stale delivery '+state);}
 await p.goto(url('shell','kitchen'));const title=await p.locator('.bomain > .office-emergency strong').innerText(),identity=await p.locator('.bomain > .office-emergency p').innerText();
 await p.locator('.bomain > .office-emergency a').click();await p.locator('#confirm-logout').click();await p.waitForURL('**/incidents.html*');
 check(await p.locator('.office-emergency strong').innerText()===title&&await p.locator('.office-emergency p').innerText()===identity,'initial and carried banner wording identical');
 await p.goto(url('incidents','kitchen-reprint-sent'));result.resultBorder=await p.locator('[data-check="ticket-1"]').evaluate(e=>({border:getComputedStyle(e).borderColor,shared:getComputedStyle(document.querySelector('#resolve-pos')).borderColor}));check(result.resultBorder.border===result.resultBorder.shared,'result button retains shared control border',result.resultBorder);
 // Use actual incident links to carry surviving context through all adopted artifacts.
 result.navigation=[];
 for(const file of ['shell','patterns','menu','report-detail']){
  await p.goto(url(file,file==='shell'?'both':file==='patterns'?'fields':'default','&alerts=both'));
  await p.locator('.bomain > .office-emergency a').click();
  if(file==='shell')await p.locator('#confirm-logout').click();
  await p.waitForURL('**/frost/back-office/incidents.html*');check(await row('ticket-1').count()===1&&(await row('ticket-1').innerText()).includes('19:58'),'banner keeps Table 1 round 2 '+file);
  await p.locator('[data-checked="ticket-1"]').check();await p.locator('[data-clear="ticket-1"]').click();
  await p.locator('.office-fixture summary').click();await p.locator('.office-fixture a[href*="'+file+'.html"]').click();
  check(await p.locator('.bomain > .office-emergency').isHidden()&&await p.locator('.office-receipt').isVisible(),'last kitchen clears on '+file);
  await p.locator('.office-receipt').click();if(file==='shell')await p.locator('#confirm-logout').click();await p.waitForURL('**/frost/back-office/incidents.html*');
  check(await row('ticket-1').count()===0&&await row('receipt-1').count()===1,'receipt arrival preserves clearance '+file);
  await p.locator('[data-dismiss="receipt-1"]').click();check((await p.locator('#read-status').innerText()).includes('Nothing outstanding'),'dismiss yields factual empty '+file);
  await p.locator('.office-fixture summary').click();await p.locator('.office-fixture a[href*="'+file+'.html"]').click();
  check(await p.locator('.bomain > .office-emergency').isHidden()&&await p.locator('.office-receipt:visible').count()===0,'last receipt removes chip on '+file);
  check(await p.locator('a[href*="prototype/back-office/incidents.html"]').count()===0,'all BO13 destinations Frost '+file);result.navigation.push({file,url:p.url()});
 }
 await p.goto(url());await p.locator('[data-checked="ticket-1"]').check();await p.locator('[data-clear="ticket-1"]').click();check(await p.locator('.office-emergency').isVisible()&&(await p.locator('.office-emergency').innerText()).includes('1 cancellation'),'cancellation keeps emergency after work clears');await p.reload();check(await row('ticket-1').count()===0&&await row('cancel-1').count()===1,'clearance survives reload');
 await p.goto(url('incidents','overflow'));const bannerBefore=await p.locator('.office-emergency').boundingBox();await p.locator('.bocontent').evaluate(e=>e.scrollTop=450);
 result.sticky={header:await p.locator('.emergency-table th').first().boundingBox(),bannerBefore,bannerAfter:await p.locator('.office-emergency').boundingBox(),scroll:await p.locator('.bocontent').evaluate(e=>e.scrollTop)};
 check(result.sticky.header.y===144,'sticky header meets scroll owner edge',result.sticky);check(JSON.stringify(bannerBefore)===JSON.stringify(result.sticky.bannerAfter),'emergency remains fixed on scroll');check(await p.evaluate(()=>!!document.elementFromPoint(300,145).closest('th')),'no rows above sticky header');await p.screenshot({path:path.join(out,'overflow-scrolled.png')});
 const kinds=await p.locator('[data-incident]').evaluateAll(es=>es.map(e=>e.dataset.kind));check(kinds.join(',')===[...kinds].sort((a,b)=>['kitchen','cancel','receipt'].indexOf(a)-['kitchen','cancel','receipt'].indexOf(b)).join(','),'overflow emergency classes precede receipts');
 await p.goto(pathToFileURL(path.join(base,'index.html')).href+'?direction=frost&screen=back-office/incidents.html&state=cancel-reprint-unknown');check((await p.locator('iframe').getAttribute('src')).includes('incidents.html?state=cancel-reprint-unknown'),'gallery opens chosen incident state');
 result.errors=errors;check(!errors.length,'no JavaScript errors',errors);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({states:result.states.length,checks:result.checks.length,failed:result.checks.filter(x=>!x.passed),geometry:result.geometry,sticky:result.sticky,errors},null,2));await browser.close();if(result.checks.some(x=>!x.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
