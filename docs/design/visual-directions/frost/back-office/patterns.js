/* Walkable desktop patterns; responses below are explicitly synthetic. */
(() => {
  const $=s=>document.querySelector(s), O=window.Office;
  const form=$('#pattern-form'), fields=[...form.querySelectorAll('input,select')];
  let dirty=false, destination='shell.html', page=1, returnFocus, busy=false;
  const original=new FormData(form);
  const samples=Array.from({length:24},(_,i)=>({name:i===0?'Evening sample with a deliberately long descriptive name that wraps without hiding the amount or the row action':'Sample '+String(i+1).padStart(2,'0'),time:'20:'+String(i+10).padStart(2,'0'),amount:i===0?'155.925':(30000+i*1000).toLocaleString('id-ID')}));
  function table(number) {
    page=number;$('#sample-rows').replaceChildren();
    samples.slice((page-1)*12,page*12).forEach((row,i)=>{
      const tr=document.createElement('tr');
      for(const [text,cls] of [[row.name,''],[row.time,'time'],[row.amount,'num']]){const td=document.createElement('td');td.textContent=text;td.className=cls;tr.append(td);}
      const td=document.createElement('td'), button=document.createElement('button');td.className='row-action';button.className='office-button small';button.textContent='View sample';button.setAttribute('aria-label','View '+row.name);button.onclick=()=>showDetail(row,button);td.append(button);tr.append(td);$('#sample-rows').append(tr);
    });
    $('#page-label').textContent='Samples '+((page-1)*12+1)+'–'+page*12+' of 24 · Page '+page+' of 2';
    $('#previous').disabled=page===1;$('#next').disabled=page===2;
  }
  function showDetail(row,button) {
    returnFocus=button;$('#pattern-dialog-title').textContent=row.name;
    $('#pattern-dialog-body').textContent='Updated '+row.time+' WIB · Amount '+row.amount+' IDR. Read-only sample detail.';
    O.open($('#pattern-dialog'));O.setState('row-detail');
  }
  function errorFor(el) {return $('#'+el.getAttribute('aria-describedby'));}
  function validate() {
    let valid=true;
    [$('#sample-text'),$('#sample-secret'),$('#sample-select')].forEach(el=>{const invalid=!el.value.trim();el.setAttribute('aria-invalid',String(invalid));errorFor(el).hidden=!invalid;valid=valid&&!invalid;});
    const radio=$('#sample-radio'),missing=!form.querySelector('[name="mode"]:checked');radio.setAttribute('aria-invalid',String(missing));$('#radio-error').hidden=!missing;return valid&&!missing;
  }
  function notice(title,copy,action) {
    const box=$('#command-status');box.hidden=false;box.replaceChildren();
    const strong=document.createElement('strong');strong.textContent=title;box.append(strong);
    const p=document.createElement('p');p.textContent=copy;box.append(p);
    if(action){const b=document.createElement('button');b.className='office-button small';b.textContent=action.label;b.onclick=action.run;box.append(b);}
  }
  function command(state) {
    O.setState(state);busy=['pending','unknown'].includes(state);
    $('#save').disabled=busy;$('#leave').disabled=busy;
    // In-flight edits cannot diverge from the submitted fixture snapshot.
    fields.forEach(el=>el.disabled=busy);form.setAttribute('aria-busy',String(busy));
    if(state==='pending')notice('Saving Evening sample…','Your values are kept while the request is pending.');
    if(state==='saved'||state==='reconciled'){dirty=false;notice('Evening sample saved.',state==='reconciled'?'The reread confirms that the original request saved these values. No second request was sent.':'The local fixture confirmed the saved values.');}
    if(state==='refused')notice('Evening sample was not saved.','The fixture refused this change because the sample is no longer editable. Your edits are kept.');
    if(state==='unknown'){
      notice('Save outcome is not yet known.','The request may have succeeded. Reading the saved sample before deciding what happened. No second save will be sent.',{label:'Check saved sample',run:()=>{notice('Reading the saved sample…','Your local edits are still kept.');setTimeout(()=>command('reconciled'),650);}});
      // A read is simulated independently from the command. Never invoke submit here.
      form.dataset.reread='requested';
    }
  }
  function read(state,complete=false) {
    O.setState(state);$('#table-wrap').hidden=state!=='table';const box=$('#read-status');box.replaceChildren();
    $('#collection-count').textContent=state==='empty'?'0 samples · Whole rupiah · WIB':state==='table'?'24 samples · Whole rupiah · WIB':'Samples · Whole rupiah · WIB';
    if(state==='table')return;
    box.className=state==='empty'?'office-empty':'office-notice';
    const title=document.createElement('strong');title.textContent=state==='loading'?'Loading samples…':state==='empty'?'No samples yet':'Could not load samples';box.append(title);
    const p=document.createElement('p');p.textContent=state==='empty'?'There are no saved samples in this fixture. Create one to see a row here.':state==='loading'?'The collection is being read. Its count and rows are not yet known.':'No count or rows are shown because the read failed.';box.append(p);
    if(state!=='loading') {const button=document.createElement('button');button.className='office-button';button.textContent=state==='empty'?'Create sample':'Try again';button.onclick=()=>{if(state==='empty'){$('#sample-text').value='New sample';dirty=true;$('#sample-text').focus();}else read('loading',true);};box.append(button);}
    if(complete)setTimeout(()=>{table(1);read('table');},650);
  }
  form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
  form.onsubmit=e=>{e.preventDefault();if(busy)return;if(!validate()){O.setState('fields-invalid');form.querySelector('[aria-invalid="true"]')?.focus();return;}const result=$('#command-response').value;command('pending');setTimeout(()=>{command(result);if(result==='unknown')setTimeout(()=>command('reconciled'),1400);},650);};
  $('#open-dialog').onclick=()=>{
    returnFocus=$('#open-dialog');$('#pattern-dialog-title').textContent='Review Evening sample';
    $('#pattern-dialog-body').innerHTML='<p>This neutral fixture demonstrates a long dialog. Its title and Close action remain visible while the body scrolls.</p>'+Array.from({length:28},(_,i)=>'<p>Sample detail '+(i+1)+'. The manager can read this section without moving the dialog actions outside the viewport.</p>').join('');
    O.open($('#pattern-dialog'));O.setState('dialog');
  };
  $('#close-dialog').onclick=()=>{O.close($('#pattern-dialog'),returnFocus);O.setState('fields');};
  $('#pattern-dialog').addEventListener('cancel',e=>{e.preventDefault();$('#close-dialog').click();});
  $('#open-destructive').onclick=()=>{O.open($('#destructive-dialog'),$('#cancel-remove'));O.setState('destructive');};
  $('#cancel-remove').onclick=()=>{O.close($('#destructive-dialog'),$('#open-destructive'));O.setState('fields');};
  $('#destructive-dialog').addEventListener('cancel',e=>{e.preventDefault();$('#cancel-remove').click();});
  $('#confirm-remove').onclick=()=>{O.close($('#destructive-dialog'),$('#open-dialog'));$('#open-destructive').hidden=true;$('#removed-result').hidden=false;O.setState('removed');};
  function leave(href,opener){destination=href;returnFocus=opener;if(dirty){O.open($('#unsaved-dialog'),$('#stay'));O.setState('unsaved');}else location.href=destination;}
  $('#leave').onclick=()=>leave('shell.html',$('#leave'));
  document.addEventListener('click',e=>{const a=e.target.closest('.bo a');if(a&&(dirty||busy)){e.preventDefault();if(!busy)leave(a.href,a);}});
  $('#stay').onclick=()=>{O.close($('#unsaved-dialog'),returnFocus||$('#leave'));O.setState('fields');};
  $('#unsaved-dialog').addEventListener('cancel',e=>{e.preventDefault();$('#stay').click();});
  $('#discard').onclick=()=>{form.reset();dirty=false;location.href=destination;};
  $('#next').onclick=()=>{table(2);O.setState('table-page-2');$('#table-section').scrollIntoView();$('#previous').focus();};
  $('#previous').onclick=()=>{table(1);O.setState('table');$('#table-section').scrollIntoView();$('#next').focus();};
  $('#load-failure').onclick=()=>read('load-error');$('#load-empty').onclick=()=>read('empty');
  table(1);
  const state=document.documentElement.dataset.state;
  if(state==='fields-focused')$('#sample-text').focus();
  if(state==='fields-invalid'){fields.forEach(el=>{if(el.type==='radio')el.checked=false;else el.value='';});validate();}
  if(state==='fields-readonly') {
    fields.forEach(el=>{if(el.tagName==='SELECT'||el.type==='radio'){el.setAttribute('aria-readonly','true');el.classList.add('office-readonly');el.addEventListener('click',e=>e.preventDefault());el.addEventListener('keydown',e=>{if(e.key!=='Tab')e.preventDefault();});}else el.readOnly=true;});
    // Native select/radio lack readonly. Keep their selected values and prevent changes.
    form.addEventListener('change',()=>{fields.forEach(el=>{if(el.type==='radio')el.checked=el.value===original.get(el.name);else if(el.tagName==='SELECT')el.value=original.get(el.name);});});
    $('#readonly-note').hidden=false;$('#save').disabled=true;
  }
  if(state==='fields-disabled'){fields.forEach(el=>el.disabled=true);$('#sample-radio').disabled=true;$('#save').disabled=true;}
  if(state==='dialog')$('#open-dialog').click();
  if(state==='destructive')$('#open-destructive').click();
  if(state==='unsaved'){dirty=true;$('#sample-text').value='Evening sample — revised';$('#leave').click();}
  if(['loading','empty','load-error'].includes(state))read(state);
  if(['pending','saved','refused','unknown','reconciled'].includes(state)){dirty=true;$('#sample-text').value='Evening sample — revised';command(state);}
  if(state==='table-page-2')table(2);
  if(state==='table'||state==='table-page-2')$('#table-section').scrollIntoView();
  if(state==='row-detail')showDetail(samples[0],$('#sample-rows button'));
  if(state==='removed'){$('#open-destructive').hidden=true;$('#removed-result').hidden=false;}
})();
