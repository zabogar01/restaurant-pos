/* DESIGN-016 read-only landing fixture. No order command or service. */
(() => {
  const $=s=>document.querySelector(s), O=window.Office;
  let state=document.documentElement.dataset.state;
  const rows=[['Table 2','Dining room','19:38','155.925'],['Table 3','Terrace','20:02','80.000'],['Table 6','Dining room','20:14','421.000']];
  function render(next){
    state=next;O.setState(next);
    if(next==='phase0'){
      $('.office-title').textContent='Back office';$('#today-content').replaceChildren();return;
    }
    const reading=next==='loading'||next==='error',empty=next==='empty'||next==='ready';
    $('#today-status').hidden=!reading;$('#today-data').hidden=reading;
    // A failed read cannot assert which business day is open.
    $('.office-day').hidden=reading;
    $('#today-status').replaceChildren();
    if(reading){
      const heading=document.createElement('strong');heading.textContent=next==='loading'?'Loading Today…':'Today could not be loaded';$('#today-status').append(heading);
      if(next==='error'){const text=document.createElement('p');text.textContent='Try again to read the business day and open orders.';const retry=document.createElement('button');retry.className='office-button';retry.textContent='Try again';retry.onclick=()=>{render('loading');setTimeout(()=>{render('default');$('#orders-title').tabIndex=-1;$('#orders-title').focus();},650);};$('#today-status').append(text,retry);}
      return;
    }
    const shown=empty?[]:next==='overflow'?[...rows,...Array.from({length:33},(_,i)=>[i===0?'Garden pavilion — extended family celebration and adjoining terrace tables':'Table '+(i+7),i===0?'Upper terrace and covered garden pavilion':'Dining room','20:'+String(15+i).padStart(2,'0'),i===0?'999.999.999':String(100+i)+'.000'])]:rows;
    $('#orders-summary').textContent=next==='empty'?'Nothing has been ordered yet.':next==='ready'?'No orders remain open. Review the day at End of day.':shown.length+' orders remain open. End of day cannot close while orders are open.';
    $('#orders-empty').hidden=!empty;$('#orders-table').hidden=empty;
    $('#orders-rows').replaceChildren(...shown.map(row=>{const tr=document.createElement('tr');row.forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;if(i===2)td.className='time';if(i===3)td.className='num';tr.append(td);});return tr;}));
    if(next==='overflow')$('.office-actor').textContent='Ratna Ayu Kartikasari Prameswari · Manager';
  }
  render(state);
})();
