/* Run from the repository root only after the owner's approval for this run.
   PLAYWRIGHT_MODULE is required; CHROME_PATH and DESIGN_EVIDENCE_DIR are optional.
   No credentials are recorded in evidence. The browser is a local fixture only. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL,fileURLToPath}=require('node:url');
if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Set PLAYWRIGHT_MODULE.');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const base=path.resolve('docs/design/visual-directions'),out=process.env.DESIGN_EVIDENCE_DIR||'/tmp/design016-evidence';
const url=(file,state)=>pathToFileURL(path.join(base,'frost/back-office',file+'.html')).href+'?state='+state;
let browser, progress;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const p=await browser.newPage(),results={checks:[],geometry:[],states:[]},failures=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const check=(ok,label,detail)=>{progress=label;results.checks.push({label,passed:!!ok});if(!ok)failures.push({label,detail});};
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'manifest.js'),'utf8'),ctx);
 const rect=selector=>p.locator(selector).boundingBox();
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080}]){
  await p.setViewportSize(viewport);
  for(const file of ['login','today']){
   const spec=ctx.window.MOCKUPS.find(x=>x.path==='back-office/'+file+'.html');
   await p.goto(url(file,'default'));
   check(JSON.stringify(await p.evaluate(()=>WF.states))===JSON.stringify(spec.states),'manifest matches '+file);
   for(const [state] of spec.states){
    await p.goto(url(file,state));
    const measure=await p.evaluate(()=>({state:document.documentElement.dataset.state,mains:document.querySelectorAll('main').length,overflow:document.documentElement.scrollWidth-innerWidth,contentOverflow:[...document.querySelectorAll('main')].some(e=>e.scrollWidth>e.clientWidth),focus:document.activeElement?.id,secretEmpty:!document.querySelector('input[type=password]')?.value}));
    results.states.push({file,state,width:viewport.width,...measure});
    check(measure.state===state&&measure.mains===1&&measure.overflow===0&&!measure.contentOverflow&&measure.secretEmpty,'state geometry '+file+'/'+state+'/'+viewport.width,measure);
    if(file==='today'){
     const links=await p.locator('.bo a').evaluateAll(es=>es.map(e=>e.href));
     check(links.every(x=>!x.includes('/pos/')&&!/prototype\/back-office\/(login|today)\.html/.test(x)),'Today destinations '+state);
     for(const href of links)check(fs.existsSync(fileURLToPath(new URL(href))),'existing destination '+new URL(href).pathname.split('/').pop());
     check(await p.locator('main button').count()===(state==='error'?1:0),'no order command '+state);
    }
    await p.screenshot({path:path.join(out,file+'-'+state+'-'+viewport.width+'.png')});
   }
  }
  await p.goto(url('login','error'));
  const login=await rect('.login-panel'),field=await rect('#username');
  check(login.width===420&&Math.abs(login.x-(viewport.width-420)/2)<1&&field.height===40,'login column and native field '+viewport.width,{login,field});
  const contrast=await p.locator('#login-notice').evaluate(e=>{
   const s=getComputedStyle(e),rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number),l=v=>rgb(v).map(n=>{n/=255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const a=l(s.color),b=l(s.backgroundColor);return {foreground:s.color,background:s.backgroundColor,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
  check(contrast.ratio>=4.5,'notice contrast '+viewport.width,contrast);
  await p.goto(url('today','incident'));
  const geometry={viewport,login,field,contrast,frame:await rect('.bo'),nav:await rect('.bonav'),top:await rect('.botop'),emergency:await rect('.office-emergency'),receipt:await rect('.office-receipt'),padding:await p.locator('main').evaluate(e=>getComputedStyle(e).padding)};
  check(geometry.frame.width===1440&&geometry.frame.x===(viewport.width-1440)/2&&geometry.nav.width===220&&geometry.top.height===64&&geometry.padding==='24px','frame geometry '+viewport.width,geometry);
  await p.locator('.office-emergency a').click();check(new URL(p.url()).pathname.endsWith('/frost/back-office/incidents.html'),'emergency reaches Frost incidents');
  await p.goto(url('today','overflow'));await p.locator('.bocontent').evaluate(e=>e.scrollTop=600);
  geometry.sticky={header:await rect('th:first-child'),content:await rect('.bocontent'),scroll:await p.locator('.bocontent').evaluate(e=>e.scrollTop)};
  check(geometry.sticky.scroll>0&&Math.abs(geometry.sticky.header.y-geometry.sticky.content.y)<1,'overflow header sticks at scroll edge '+viewport.width,geometry.sticky);
  check(await p.locator('.office-actor').innerText()==='Ratna Ayu Kartikasari Prameswari · Manager'&&await p.locator('#orders-rows').innerText().then(t=>t.includes('999.999.999')),'long name and amount retained '+viewport.width);
   await p.screenshot({path:path.join(out,'today-overflow-scrolled-'+viewport.width+'.png')});
   geometry.wrappedFrames=[];
   for(const file of ['menu','report-detail']){
    await p.goto(url(file,'default'));
    const wrapped={file,frame:await rect('.bo'),nav:await rect('.bonav'),top:await rect('.botop'),padding:await p.locator('.bocontent').evaluate(e=>getComputedStyle(e).padding),overflow:await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)};
    check(wrapped.frame.width===1440&&wrapped.frame.x===(viewport.width-1440)/2&&wrapped.nav.width===220&&wrapped.top.height===64&&wrapped.padding==='24px'&&wrapped.overflow===0,'wrapped frame geometry '+file+'/'+viewport.width,wrapped);
    geometry.wrappedFrames.push(wrapped);await p.screenshot({path:path.join(out,file+'-centred-'+viewport.width+'.png')});
   }
   results.geometry.push(geometry);
 }
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2));
 await p.setViewportSize({width:1440,height:900});
 const expected={error:['Sign-in failed','Check your username and password, then try again.'],forbidden:['Manager access required','This account cannot use the back office. Sign in with a manager account.'],unavailable:['The system is unavailable','Wait a moment, then try again.'],unexpected:['Something went wrong','Try again. If the problem continues, ask a manager for help.'],'session-ended':['Your session has ended','Sign in again to continue.']};
 for(const [state,copy] of Object.entries(expected)){await p.goto(url('login',state));check(await p.locator('#notice-title').textContent()===copy[0]&&await p.locator('#notice-body').textContent()===copy[1],'exact copy '+state);}
 const focusStates={default:'username','logged-out':'username','invalid-username':'username','invalid-password':'password','oversize-username':'username','oversize-password':'password',error:'password',unavailable:'password',unexpected:'password',forbidden:'username','session-ended':'username','lookup-unavailable':'retry','lookup-unexpected':'retry'};
 for(const [state,id] of Object.entries(focusStates)){await p.goto(url('login',state));check(await p.evaluate(()=>document.activeElement?.id)===id,'initial focus '+state);}
 await p.goto(url('login','default'));
 check(await p.locator('#username').getAttribute('name')==='username'&&await p.locator('#username').getAttribute('autocomplete')==='username'&&await p.locator('#password').getAttribute('name')==='password'&&await p.locator('#password').getAttribute('autocomplete')==='current-password','password-manager native semantics');
  await p.locator('#sign-in').click();check(await p.locator('#username-error').isVisible()&&await p.evaluate(()=>document.activeElement?.id)==='username','empty username validation');
  check(await p.locator('#password-error').isVisible()&&await p.locator('#username').getAttribute('aria-invalid')==='true'&&await p.locator('#password').getAttribute('aria-invalid')==='true'&&await p.locator('#username-error').textContent()==='Enter your username.'&&await p.locator('#password-error').textContent()==='Enter your password.','blank submit marks both missing fields');
  await p.goto(url('login','invalid-both'));
  check(await p.locator('#username-error').isVisible()&&await p.locator('#password-error').isVisible()&&await p.locator('#username').getAttribute('aria-invalid')==='true'&&await p.locator('#password').getAttribute('aria-invalid')==='true'&&await p.evaluate(()=>document.activeElement?.id)==='username','blank form deep link marks both fields and focuses first');
 await p.locator('#username').fill('review-account');await p.locator('#sign-in').click();check(await p.locator('#password-error').isVisible()&&await p.evaluate(()=>document.activeElement?.id)==='password','empty password validation');
 // Generated disposable text exercises shape checks. It is never photographed or returned.
 await p.locator('.office-fixture').evaluate(e=>e.open=true);await p.locator('#password').fill('x'.repeat(7));await p.locator('#login-response').selectOption('error');await p.locator('#sign-in').click();
 check(await p.locator('#username').isDisabled()&&await p.locator('#password').isDisabled()&&await p.locator('#sign-in').isDisabled(),'loading disables all credential controls');
 await p.waitForFunction(()=>document.documentElement.dataset.state==='error');
 check(await p.locator('#password').inputValue()===''&&await p.locator('#username').inputValue()==='review-account'&&await p.evaluate(()=>document.activeElement?.id)==='password','failure preserves username and clears/focuses secret');
  for(const field of ['username','password']){
  await p.goto(url('login','default'));await p.locator('#username').fill(field==='username'?'x'.repeat(257):'review-account');await p.locator('#password').fill('x'.repeat(field==='password'?1025:7));await p.locator('#sign-in').click();
  check(await p.evaluate(()=>document.documentElement.dataset.state)==='oversize-'+field&&await p.evaluate(()=>document.activeElement?.id)===field&&await p.locator('#password').inputValue()==='','oversize shape '+field);
  }
  await p.goto(url('login','default'));await p.locator('#username').fill('x'.repeat(257));await p.locator('#password').fill('x'.repeat(1025));await p.locator('#sign-in').click();
  check(await p.locator('#username').getAttribute('aria-invalid')==='true'&&await p.locator('#password').getAttribute('aria-invalid')==='true'&&await p.locator('#username-error').isVisible()&&await p.locator('#password-error').isVisible()&&await p.locator('#username-error').textContent()===expected.error[1]&&await p.locator('#password-error').textContent()===expected.error[1]&&await p.evaluate(()=>document.activeElement?.id)==='username'&&await p.locator('#password').inputValue()===''&&await p.locator('#username').inputValue().then(v=>v.length===257),'double oversize marks both fields, clears secret and focuses first without truncating username');
  await p.goto(url('login','default'));await p.locator('#username').fill('   ');await p.locator('#password').fill('x'.repeat(7));await p.locator('#sign-in').click();
  check(await p.evaluate(()=>document.documentElement.dataset.state)==='loading'&&await p.locator('#username').inputValue()==='   '&&await p.locator('#username').getAttribute('aria-invalid')==='false','nonempty whitespace username reaches loading unchanged');
  await p.goto(url('login','throttled'));
  check(await p.locator('#username').inputValue()==='m.iqbal'&&await p.locator('#username').isEditable()&&await p.locator('#password').inputValue()===''&&await p.locator('#password').isDisabled()&&await p.locator('#sign-in').isDisabled(),'direct throttle retains submitted fixture username and empty secret');
  await p.locator('#username').fill('');check(await p.locator('#sign-in').isEnabled()&&await p.locator('#password').isEnabled()&&await p.locator('#login-notice').isHidden(),'clearing submitted username does not lock empty key');
 await p.goto(url('login','default'));await p.locator('.office-fixture').evaluate(e=>e.open=true);await p.locator('#username').fill('review-account');await p.locator('#login-response').selectOption('throttled');await p.locator('#simulate-response').click();
 const announcement=await p.locator('#lock-announcement').textContent();await p.waitForTimeout(1100);
 check(await p.locator('#lock-announcement').textContent()===announcement&&await p.locator('#login-notice').getAttribute('aria-live')==='off'&&!await p.locator('#login-notice').getAttribute('role'),'N3 single announcement and nonlive clock');
 await p.locator('#username').fill('different-account');check(await p.locator('#sign-in').isEnabled()&&await p.locator('#login-notice').isHidden()&&await p.evaluate(()=>document.activeElement?.id)==='username','editing away unlocks and retains typing focus');
 await p.locator('#username').fill(' REVIEW-ACCOUNT ');check(await p.locator('#sign-in').isDisabled()&&!(await p.locator('#notice-title').textContent()).includes('5 min'),'normalized return restores elapsed wait');
 await p.locator('#finish-wait').click();check(await p.locator('#sign-in').isEnabled()&&await p.locator('#login-notice').isHidden()&&await p.evaluate(()=>document.activeElement?.id)==='password','deadline ends without submit and focuses password when not typing');
 for(const state of ['unavailable','unexpected']){await p.goto(url('login',state));await p.locator('#retry').click();check(await p.evaluate(()=>document.activeElement?.id)==='password'&&await p.locator('#password').inputValue()===''&&new URL(p.url()).pathname.endsWith('/login.html'),'credential retry requests fresh entry '+state);}
 for(const state of ['lookup-unavailable','lookup-unexpected']){await p.goto(url('login',state));check(await p.locator('#username').isDisabled()&&await p.locator('#password').isDisabled()&&await p.locator('#sign-in').isDisabled(),'lookup gate '+state);await p.locator('#retry').click();await p.waitForFunction(()=>document.documentElement.dataset.state==='default');check(await p.evaluate(()=>document.activeElement?.id)==='username','lookup recovery '+state);}
 await p.goto(url('login','session-ended-draft'));check(await p.locator('#draft-note').textContent()==='The previous session’s unsaved changes are stored on this tab and are not submitted automatically.'&&await p.locator('.office-actor').count()===0&&await p.locator('#draft').count()===0,'draft notice reveals no work or manager');
 await p.goto(url('login','session-ended'));check(await p.locator('#draft-note').isHidden(),'Phase 0 expiry has no draft claim');
 await p.goto(url('login','default'));await p.locator('.office-fixture').evaluate(e=>e.open=true);await p.locator('#simulate-response').click();await p.waitForURL('**/today.html?state=phase0');
 check(await p.locator('.bonav').evaluate(e=>e.children.length)===0&&await p.locator('main').evaluate(e=>e.children.length)===0&&await p.locator('.office-title').innerText()==='Back office'&&await p.locator('.office-actor').innerText()==='M. Iqbal · Manager','success enters empty Phase 0 frame');
 await p.locator('.office-logout').click();await p.waitForURL('**/login.html');await p.waitForFunction(()=>document.activeElement?.id==='username');check(await p.evaluate(()=>document.activeElement?.id)==='username'&&await p.locator('main').count()===1,'explicit logout focuses Username in one landmark');
 await p.goto(url('today','error'));await p.getByRole('button',{name:'Try again',exact:true}).click();check(await p.locator('#today-data').isHidden(),'Today retry withholds unread rows');await p.waitForFunction(()=>document.documentElement.dataset.state==='default');check(await p.locator('#orders-rows tr').count()===3,'Today retry recovers');
 await p.setViewportSize({width:1440,height:360});await p.goto(url('login','overflow'));await p.locator('#sign-in').scrollIntoViewIfNeeded();
 const overflow=await p.evaluate(()=>({scroll:scrollY,height:document.documentElement.scrollHeight,viewport:innerHeight,bottom:document.querySelector('#sign-in').getBoundingClientRect().bottom}));results.loginOverflow=overflow;
 check(overflow.height>overflow.viewport&&overflow.scroll>0&&overflow.bottom<=overflow.viewport,'short-height form scroll retains action',overflow);await p.screenshot({path:path.join(out,'login-overflow-short.png')});
 for(const file of ['login','today']){await p.goto(pathToFileURL(path.join(base,'index.html')).href+'?direction=frost&screen=back-office/'+file+'.html&state=overflow');check((await p.locator('iframe').getAttribute('src'))==='frost/back-office/'+file+'.html?state=overflow','gallery direct entry '+file);}
 check(errors.length===0,'no page errors',errors);
 results.errors=errors;results.failures=failures;fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2));
 await browser.close();console.log(JSON.stringify({passed:results.checks.filter(x=>x.passed).length,total:results.checks.length,failures,errors,evidence:out},null,2));if(failures.length||errors.length)process.exitCode=1;
})().catch(async e=>{console.error(e.stack);console.error("Last completed assertion: "+progress);if(browser)await browser.close();process.exitCode=1;});
