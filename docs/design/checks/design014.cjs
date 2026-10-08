/* Each execution requires the owner's approval. Set PLAYWRIGHT_MODULE; optional
   CHROME_PATH and DESIGN014_OUTPUT. Evidence stays outside the repository. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const base=path.resolve('docs/design/visual-directions'),out=process.env.DESIGN014_OUTPUT||'/tmp/design014-evidence';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],result={checks:[],states:[]};
 const check=(ok,name,detail)=>result.checks.push({name,passed:!!ok,...(detail?{detail}:{})});
 p.on('pageerror',e=>errors.push(e.message));
 const url=(state='default',extra='')=>pathToFileURL(path.join(base,'frost/back-office/audit.html')).href+'?state='+state+extra;
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'manifest.js'),'utf8'),ctx);
 const inspectReadOnly=async label=>{
  check(!/\bPIN\b|password|sign-in failures|cooldown started|security telemetry|BO-14/i.test(await p.locator('body').innerText()),'whole document has no secret or telemetry '+label);
  const unexpected=await p.evaluate(()=>{
   const buttons={'clear-filters':'Clear filters','clear-empty':'Clear filters',newer:'Newer',older:'Older',retry:'Try again','close-detail':'Close'};
   const nav={today:['Today','today.html'],eod:['End of day','end-of-day.html'],reports:['Reports','reports.html'],audit:['Audit','audit.html'],menu:['Menu','menu.html'],tables:['Tables','tables.html'],users:['Staff','users.html'],presets:['Discount presets','presets.html'],settings:['Settings','settings.html'],incidents:['Printing','incidents.html']};
   return [...document.querySelectorAll('button,a,input,select,textarea,summary,[role="button"],[role="link"],[contenteditable="true"]')].filter(e=>{
    const text=e.textContent.trim();
    if(e.tagName==='BUTTON')return !(buttons[e.id]===text||(text==='Open'&&e.dataset.open&&e.closest('[data-entry]')?.dataset.entry===e.dataset.open));
    if(e.tagName==='SELECT')return !['filter-day','filter-action','filter-outcome','filter-person'].includes(e.id);
    if(e.tagName==='SUMMARY')return !(e.closest('.office-fixture')&&text==='Review fixtures · outside the product');
    if(e.tagName!=='A')return true;
    const u=new URL(e.href),file=u.pathname.split('/').pop(),route=nav[e.dataset.nav];
    if(e.closest('.bonav')&&route)return !(text===route[0]&&file===route[1]);
    if(e.matches('.office-logout'))return !(text==='Log out'&&file==='login.html');
    if(e.closest('.office-emergency'))return !(text==='Open print incidents'&&file==='incidents.html');
    if(e.matches('.office-receipt'))return !(text==='1 receipt failed · Table 1 · 20:14'&&file==='incidents.html');
    if(e.closest('.office-fixture'))return !(text==='All audit states'&&file==='index.html'&&u.searchParams.get('screen')==='back-office/audit.html');
    // Hidden authoring controls are outside the product, but still checked explicitly.
    if(e.closest('.wfbar'))return !((text==='← All screens'&&file==='index.html')||(file==='audit.html'&&WF.states.some(([state,label])=>state===u.searchParams.get('state')&&label===text)));
    return true;
   }).map(e=>e.outerHTML);
  });
  check(unexpected.length===0,'only allowed read-only controls '+label,unexpected);
 };
 await p.goto(url());const states=await p.evaluate(()=>WF.states.map(s=>s[0]));
 check(JSON.stringify(states)===JSON.stringify(ctx.window.MOCKUPS.find(x=>x.path==='back-office/audit.html').states.map(s=>s[0])),'all states registered');
 const details={
  refund:['T8-0610','Charged','Refunded','Net','184.800','original order total remains 184.800','Wed 7 Oct 2026 · 00:20 WIB','Tue 6 Oct 2026'],
  void:['T7-0610','Order total before void','Void value','132.000'],
  self:['T12-0610','Self-approved','88.000'],
  line:['T4-0610','1 × Burger · Round 2','50.000','155.925','108.675','47.250'],
  'line-second':['T11-0610','1 × Iced tea · Round 1','20.000','75.600','56.700','18.900'],
  apply:['T10-0610','Discount before','Discount after','Percentage · 10%','200.000','180.000'],
  replace:['T10-0610','Percentage · 10%','Fixed amount · 25.000','180.000','175.000'],
  remove:['T10-0610','Fixed amount · 25.000','None','175.000','200.000'],
  preset:['Q17-0610','Approval not required','Neighbour discount','100.000','95.000'],
  failed:['T2-0610','Approval failed','None · Approval not granted','wrong side'],
  cancelled:['T5-0610','Approval cancelled','None · Approval not granted','prompt was abandoned'],
  'refused-refund':['T3-0510','Approved · refused','REFUSED','BUSINESS_DAY_CLOSED','Rina Putri','M. Iqbal','Tue 6 Oct 2026 · 00:06 WIB','Business day closed after approval.','Refusal code · illustrative'],
  'refused-void':['T6-0610','Approved · refused','REFUSED','ORDER_NOT_OPEN','Rina Putri','M. Iqbal','Order settled after approval.','Refusal code · illustrative'],
  cooldown:['T9-0610','Approval request refused · cooldown','None · Approval not granted'],
  takeover:['Q18-0610','Checkout lease','M. Iqbal','Approval not required'],
  kitchen:['T1-0610','Kitchen work ticket · Round 2','Sent 19:58 WIB','M. Iqbal'],
  cancellation:['T4-0610','Cancellation ticket · Round 2','Cancelled 20:02 WIB','M. Iqbal'],
  long:['CATER-0610','Ratna Ayu Kartikasari Prameswari','Deactivated','999.999.999']
 };
 for(const state of states){
  await p.goto(url(state));
  const measurement=await p.evaluate(()=>({state:document.documentElement.dataset.state,width:document.querySelector('.bo').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth,contentOverflow:document.querySelector('main').scrollWidth-document.querySelector('main').clientWidth,dialogOverflow:document.querySelector('#audit-detail').scrollWidth-document.querySelector('#audit-detail').clientWidth,rows:[...document.querySelectorAll('[data-entry]')].map(e=>e.dataset.entry)}));
  result.states.push(measurement);check(measurement.state===state,'reachable '+state);check(measurement.overflow===0&&measurement.contentOverflow===0&&measurement.dialogOverflow===0,'no horizontal overflow '+state,measurement);
  check(await p.locator('#audit-rows [data-outcome="success"]').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)+1)),'Succeeded stays on one line '+state);
  await inspectReadOnly(state);
  if(state.startsWith('entry-')){
   const id=state.slice(6),text=await p.locator('#audit-dialog').innerText();
   check(await p.locator('#audit-dialog').isVisible()&&details[id].every(s=>text.includes(s)),'subject and values '+id,text);
   const noAmounts=['failed','cancelled','refused-refund','refused-void','cooldown','takeover','kitchen','cancellation'].includes(id);
   check(await p.locator('#audit-detail .audit-amounts').count()===(noAmounts?0:1),'amount presence '+id);
   const neighbours={refund:['155.925','108.675','50.000','75.600'],line:['184.800','20.000','75.600','56.700','18.900'],'line-second':['184.800','155.925','108.675','50.000','47.250']};
   if(neighbours[id])check(neighbours[id].every(value=>!text.includes(value)),'no neighbouring monetary values '+id);
   if(id==='refused-void')check(!text.includes('BUSINESS_DAY_CLOSED')&&!text.includes('Order’s business day')&&!text.includes('T6-0510'),'void never implies an open order in a closed day');
   if(id==='cooldown')check(!text.includes('code')&&!/APPROVAL_|REFUSED/.test(text),'cooldown has plain label and no invented code');
   if(id==='refund')check(!/order total[^.]*\b0\b/i.test(text),'refund does not rewrite order total');
   for(let n=0;n<3;n++){await p.keyboard.press('Tab');check(await p.evaluate(()=>document.activeElement.closest('dialog')?.id==='audit-dialog'),'contained Tab '+id+'/'+n);}
   await p.screenshot({path:path.join(out,state+'.png')});
   await p.keyboard.press('Escape');check(await p.evaluate(id=>document.activeElement.dataset.open===id,id),'Escape restores originating entry '+id);
  }else await p.screenshot({path:path.join(out,state+'.png')});

 }
 await p.goto(url());
 result.geometry=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{frame:rect('.bo'),nav:rect('.bonav'),top:rect('.botop'),brand:rect('.bonav__brand'),field:rect('#filter-day'),rowAction:rect('[data-open]'),padding:getComputedStyle(document.querySelector('main')).padding,body:getComputedStyle(document.body).fontSize};});
 check(result.geometry.frame.width===1440&&result.geometry.frame.height===900&&result.geometry.nav.width===220&&result.geometry.top.height===64&&result.geometry.brand.height===64&&result.geometry.padding==='24px'&&result.geometry.body==='14px','shared frame unchanged',result.geometry);
 check(result.geometry.field.height===40&&result.geometry.rowAction.height===28,'shared field and row-action density');
 const rowIds=()=>p.locator('[data-entry]').evaluateAll(es=>es.map(e=>e.dataset.entry));
 const filterValues=()=>p.locator('#audit-filters select').evaluateAll(es=>es.map(e=>e.value));
 check((await rowIds())[0]==='refund'&&(await p.locator('[data-entry="refund"] .time').innerText())==='00:20\nWed 7 Oct','after-midnight entry sorts first with occurrence date');
 await p.locator('#filter-day').selectOption('2026-10-05');check((await p.locator('#page-label').innerText()).includes('of 8')&&(await rowIds()).every(s=>s.startsWith('older-')),'business-day filter narrows');
 await p.locator('#clear-filters').click();check((await p.locator('#page-label').innerText()).includes('of 48'),'clear restores all entries');
 const chronology=[];
 do{
  chronology.push(...await p.locator('[data-entry] .time').allInnerTexts());
  if(await p.locator('#older').isDisabled())break;
  await p.locator('#older').click();
 }while(true);
 const timestamps=chronology.map(s=>{const [time,date]=s.split('\n');return Number(date.match(/\d+/)[0])*1440+Number(time.slice(0,2))*60+Number(time.slice(3));});
 check(timestamps.length===48&&timestamps.every((value,i)=>i===0||value<=timestamps[i-1]),'all pages sort by occurrence across midnight');
 await p.locator('#filter-action').selectOption('refund');check((await rowIds()).join(',')==='refund,cooldown,refused-refund','action filter narrows');
 await p.locator('#filter-outcome').selectOption('refused');check((await rowIds()).join(',')==='refused-refund','outcome combines with action');
 await p.locator('#filter-person').selectOption('iqbal');check((await rowIds()).join(',')==='refused-refund','person matches approver with combined filters');
 await p.locator('#filter-day').selectOption('2026-10-06');check((await rowIds()).join(',')==='refused-refund','four filters combine by entry business day');
 await p.locator('#filter-person').selectOption('former');check(await p.locator('#audit-list').isHidden()&&(await p.locator('#read-status').innerText()).includes('No entries match'),'combined no-match empty');
 await p.locator('#clear-empty').click();check((await p.locator('#page-label').innerText()).includes('of 48'),'no-match clear restores list');
 await p.locator('#filter-person').selectOption('former');check((await rowIds()).join(',')==='long','deactivated actor remains searchable');
 await p.locator('#clear-filters').click();await p.locator('#filter-outcome').selectOption('failed');check((await rowIds()).join(',')==='failed','outcome filter alone narrows');
 await p.goto(url('overflow'));await p.locator('#filter-action').selectOption('apply');const first=await rowIds(),filters=await filterValues();
 await p.locator('#older').click();const second=await rowIds();
 check(!first.some(id=>second.includes(id))&&(await p.locator('#page-label').innerText()).includes('Page 2'),'Older shows distinct entries');
 check(JSON.stringify(filters)===JSON.stringify(await filterValues()),'filters persist across pages');
 const target=second[2],label=await p.locator('#page-label').innerText();
 await p.locator('[data-open="'+target+'"]').focus();await p.keyboard.press('Enter');
 check(await p.locator('#audit-dialog').isVisible(),'keyboard opens entry');
 await p.keyboard.press('Shift+Tab');check(await p.evaluate(()=>!!document.activeElement.closest('#audit-dialog')),'contained Shift+Tab');
 await p.locator('#close-detail').click();
 check((await p.locator('#page-label').innerText())===label&&JSON.stringify(filters)===JSON.stringify(await filterValues())&&JSON.stringify(second)===JSON.stringify(await rowIds()),'detail preserves filter page and entries');
 check(await p.evaluate(id=>document.activeElement.dataset.open===id,target),'Close returns focus to originating entry');
 await p.locator('[data-open="'+target+'"]').click();await p.reload();check((await p.locator('#audit-title').innerText()).includes('Q'),'paged subject survives reload');await p.keyboard.press('Escape');
 check((await p.locator('#page-label').innerText())===label&&JSON.stringify(filters)===JSON.stringify(await filterValues()),'reload and close preserve filtered page');
 await p.locator('#newer').click();check(JSON.stringify(first)===JSON.stringify(await rowIds()),'Newer restores first page');
 for(const state of ['default','overflow']){
  await p.goto(url(state));const padding=await p.locator('#audit-rows td').first().evaluate(e=>getComputedStyle(e).padding);
  await p.locator('#filter-person').selectOption('former');await p.locator('#clear-filters').click();
  check(await p.locator('#audit-rows td').first().evaluate(e=>getComputedStyle(e).padding)===padding,'clear preserves '+state+' density');
  await p.reload();check(await p.locator('#audit-rows td').first().evaluate(e=>getComputedStyle(e).padding)===padding,'reload preserves '+state+' density');
  check(padding===(state==='overflow'?'9px 12px':'15px 12px'),'explicit '+state+' density',padding);
 }
 await p.goto(url());await p.locator('#filter-action').selectOption('line');await p.locator('#filter-outcome').selectOption('success');
 for(const [id,values,absent] of [['line',['50.000','47.250'],['20.000','18.900']],['line-second',['20.000','18.900'],['50.000','47.250']]]){
  const text=await p.locator('[data-entry="'+id+'"] td').nth(6).innerText();check(values.every(v=>text.includes(v))&&absent.every(v=>!text.includes(v)),'line summary uses its own values '+id,text);
 }
 await p.screenshot({path:path.join(out,'distinct-line-summaries.png')});
 await p.locator('#clear-filters').click();await p.locator('#filter-outcome').selectOption('refused');
 const voidSummary=await p.locator('[data-entry="refused-void"] td').nth(6).innerText(),refundSummary=await p.locator('[data-entry="refused-refund"] td').nth(6).innerText();
 check(voidSummary.includes('Order settled after approval.')&&!voidSummary.includes('Business day closed')&&refundSummary.includes('Business day closed after approval.')&&!refundSummary.includes('ORDER_NOT_OPEN'),'refusal summaries come from their own records');
 await p.screenshot({path:path.join(out,'distinct-refusals.png')});
 await p.goto(url('empty'));check(await p.locator('#audit-filters select:disabled').count()===4&&await p.locator('#clear-filters').isDisabled()&&!(await p.locator('#read-status').innerText()).includes('Clear'),'new-install empty offers no false filter recovery');
 for(const state of ['loading','error']){await p.goto(url(state));check(await p.locator('[data-entry]').count()===0&&await p.locator('#page-label').textContent()==='','unread rows and counts withheld '+state);}
 await p.locator('#retry').click();check((await p.locator('#read-status').innerText()).includes('Reading'),'retry visibly reads');await p.waitForSelector('[data-entry]');check(await p.locator('[data-entry]').count()===12,'retry recovers list');
 await p.goto(url('overflow'));await p.locator('.bocontent').evaluate(e=>e.scrollTop=450);
 result.sticky=await p.locator('th').first().boundingBox();check(Math.abs(result.sticky.y-64)<1,'sticky header meets content edge',result.sticky);check(await p.evaluate(()=>!!document.elementFromPoint(300,65)?.closest('th')),'no row above sticky header');await p.screenshot({path:path.join(out,'overflow-scrolled.png')});
 await p.goto(url('entry-long'));await p.locator('#close-detail').click();await p.locator('[data-entry="long"]').scrollIntoViewIfNeeded();
 result.long=await p.locator('[data-entry="long"]').evaluate(e=>({text:e.innerText,overflow:e.scrollWidth-e.clientWidth,amounts:[...e.querySelectorAll('.audit-money')].map(n=>({text:n.innerText,width:n.getBoundingClientRect().width,scroll:n.scrollWidth,client:n.clientWidth}))}));
 check(result.long.overflow===0&&result.long.amounts.every(a=>a.scroll<=a.client),'long name and amount fit',result.long);await p.screenshot({path:path.join(out,'long-row.png')});
 for(const file of ['shell','patterns','menu','report-detail','incidents']){
  await p.goto(pathToFileURL(path.join(base,'frost/back-office/'+file+'.html')).href);
  const href=await p.locator('[data-nav="audit"]').getAttribute('href');check(new URL(href,p.url()).pathname.endsWith('/frost/back-office/audit.html'),'Frost Audit destination '+file);
 }
 await p.goto(url('default','&alerts=both'));const alert=await p.locator('.office-emergency').innerText();await p.locator('[data-open="refund"]').click();await inspectReadOnly('dialog with both alerts');await p.keyboard.press('Escape');check(await p.locator('.office-receipt').isVisible()&&(await p.locator('.office-emergency').innerText())===alert,'reading detail retains global alerts');
 await p.goto(pathToFileURL(path.join(base,'index.html')).href+'?direction=frost&screen=back-office/audit.html&state=entry-refund');check((await p.locator('iframe').getAttribute('src')).includes('audit.html?state=entry-refund'),'gallery opens selected audit state');
 for(const [file,count] of [['menu',38],['report-detail',9]])check(fs.readFileSync(path.join(base,'frost/back-office/'+file+'.html'),'utf8').split('\n').filter(l=>l.includes('prototype/')).length===count,'authored prototype count '+file);
 const artifactFiles=fs.readdirSync(path.join(base,'frost/back-office')).filter(f=>/\.(html|js)$/.test(f));
 check(artifactFiles.every(f=>!fs.readFileSync(path.join(base,'frost/back-office',f),'utf8').includes('prototype/back-office/audit.html')),'no old BO-12 destinations');
 check(errors.length===0,'no page JavaScript errors',errors);result.errors=errors;
 result.failures=result.checks.filter(c=>!c.passed);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({states:states.length,passed:result.checks.length-result.failures.length,total:result.checks.length,geometry:result.geometry,sticky:result.sticky,errors,failures:result.failures},null,2));
 await browser.close();if(result.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
