/* Review gallery controls, outside the product frame. */
(() => {
  const names=['POS order','POS settlement','POS lock','POS incidents','Back-office menu','Report detail'];
  const params=new URLSearchParams(location.search);
  let direction=params.get('direction')==='frost'?'frost':'paper';
  let selected=Math.max(0,MOCKUPS.findIndex(x=>x.path===params.get('screen')));
  const defaults=['linecontrols','card','incident','default','default','default'];
  const frame=document.querySelector('iframe'),state=document.querySelector('#state'),box=document.querySelector('.framebox');
  const nav=document.querySelector('.screens');
  MOCKUPS.forEach((m,i)=>{ const b=document.createElement('button');b.textContent=names[i];b.type='button';b.onclick=()=>{selected=i;fillStates();render();};nav.append(b); });
  function fillStates(initial){
    state.replaceChildren(...MOCKUPS[selected].states.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));
    const requested=initial||defaults[selected];
    if(MOCKUPS[selected].states.some(s=>s[0]===requested))state.value=requested;
  }
  function fit(){
    const m=MOCKUPS[selected];const scale=Math.min(1,(document.querySelector('.stage').clientWidth-34)/m.width);
    frame.style.width=m.width+'px';frame.style.height=m.height+'px';frame.style.transform=`scale(${scale})`;
    box.style.width=m.width*scale+'px';box.style.height=m.height*scale+'px';
    document.querySelector('#dimensions').textContent=`${m.width} × ${m.height} · preview ${Math.round(scale*100)}%`;
  }
  function render(){
    const m=MOCKUPS[selected],url=`${direction}/${m.path}?state=${encodeURIComponent(state.value)}`;
    frame.src=url;document.querySelector('#fullsize').href=url;
    document.querySelectorAll('[data-direction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===direction)));
    [...nav.children].forEach((b,i)=>{if(i===selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    history.replaceState(null,'',`?direction=${direction}&screen=${encodeURIComponent(m.path)}&state=${encodeURIComponent(state.value)}`);fit();
  }
  document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{direction=b.dataset.direction;render();});
  state.onchange=render;window.addEventListener('resize',fit);fillStates(params.get('state'));render();
})();
