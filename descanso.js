/* ===== Descanso: picks de la 2.ª parte (modelo en vivo con registro propio) =====
   1) Busca en ESPN los partidos EN DESCANSO de las ligas que tengas marcadas en Fútbol.
   2) Lee el 1.er tiempo (marcador, tiros, a puerta, córners, tarjetas, rojas, posesión) y recalcula la 2.ª parte con el modelo prepartido.
   3) Trae las cuotas EN VIVO de API-Football (1 llamada para ubicar los partidos + 1 por partido). Si no hay, puedes escribir tu cuota.
   4) Recomienda solo con ventaja real y sin que el mercado discrepe demasiado. Los picks se guardan en un REGISTRO APARTE («htpicks»). */
const HT={rows:{},std:{},busy:false,m:{}};
const HT_SB=s=>`https://site.api.espn.com/apis/site/v2/sports/soccer/${s}/scoreboard`;
const HT_SUM=(s,e)=>`https://site.web.api.espn.com/apis/site/v2/sports/soccer/${s}/summary?event=${e}`;
const HT_RULE={edge:.04,edgeNoRef:.07,gap:.12,qa:1.30,qb:2.60};   // ventaja mínima, discrepancia máxima con el mercado y rango de cuota
async function htJ(url){const r=await fetchESPN(url);if(!r||!r.ok)throw new Error('ESPN '+(r&&r.status));return r.json()}
async function htPool(items,n,fn){const out=[];let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k])}}));return out}
const htIsHT=e=>{const t=(e.status&&e.status.type)||{};return /HALFTIME/i.test(t.name||'')||/^(HT|half.?time)$/i.test(t.shortDetail||t.detail||'')};
async function htStd(slug){if(!(slug in HT.std))HT.std[slug]=await standings(slug).catch(()=>null);return HT.std[slug]}

// ---------- Modelo de la 2.ª parte ----------
// Base: 55% de los goles esperados del partido. Se ajusta con lo visto en el 1.er tiempo (tiros y goles), rojas y marcador.
function ht2H(i){
  let a=i.lh*.55,b=i.la*.55;const s=i.s;
  if(s&&s.h&&s.w){
    const xg=t=>t.sot!=null&&t.sh!=null?0.3*t.sot+0.08*Math.max(0,t.sh-t.sot):null,xh=xg(s.h),xw=xg(s.w);
    if(xh!=null&&xw!=null){
      const f=(x,g,e)=>Math.max(.8,Math.min(1.25,((0.7*x+0.3*g)+.35)/(e+.35)));
      a*=.6+.4*f(xh,i.hh,i.lh*.45);b*=.6+.4*f(xw,i.ha,i.la*.45);
    }
  }
  const rh=(s&&s.h&&s.h.r)||0,rw=(s&&s.w&&s.w.r)||0;
  if(rh){a*=Math.pow(.75,rh);b*=Math.pow(1.2,rh)}
  if(rw){b*=Math.pow(.75,rw);a*=Math.pow(1.2,rw)}
  const d=i.hh-i.ha;if(d>=1){a*=.95;b*=1.05}else if(d<=-1){a*=1.05;b*=.95}
  return[a,b];
}
function htMarkets(i){
  const[a,b]=ht2H(i);i.l2=[a,b];
  const pois=(l,k)=>{let p=Math.exp(-l);for(let x=1;x<=k;x++)p*=l/x;return p};
  const T=[1.5,2.5,3.5,4.5],over={};T.forEach(t=>over[t]=0);
  let H=0,D=0,V=0,bt=0,o05=0,o15=0,sum=0;
  for(let x=0;x<=9;x++)for(let y=0;y<=9;y++){
    const p=pois(a,x)*pois(b,y);sum+=p;const h=i.hh+x,v=i.ha+y;
    if(h>v)H+=p;else if(h===v)D+=p;else V+=p;
    if(h>0&&v>0)bt+=p;T.forEach(t=>{if(h+v>t)over[t]+=p});if(x+y>=1)o05+=p;if(x+y>=2)o15+=p;
  }
  const z=x=>x/sum;H=z(H);D=z(D);V=z(V);bt=z(bt);o05=z(o05);o15=z(o15);T.forEach(t=>over[t]=z(over[t]));
  const m=[['Local gana',H],['Empate',D],['Visitante gana',V],['Doble oportunidad 1X',H+D],['Doble oportunidad X2',D+V],['Doble oportunidad 12',H+V],
    ['Ambos marcan: sí',bt],['Ambos marcan: no',1-bt],['Segundo tiempo Over 0.5',o05],['Segundo tiempo Over 1.5',o15],['Segundo tiempo Under 1.5',1-o15]];
  T.forEach(t=>m.push(['Over '+t,over[t]],['Under '+t,1-over[t]]));
  return m.filter(([n,p])=>p>.03&&p<.97).map(([n,p])=>({n,p,pc:calF(p)}));
}

// ---------- Cuotas en vivo (API-Football /odds/live) ----------
function htParseOdds(x){
  const q={},seen=[];
  for(const m of (x&&x.odds)||[]){
    const nm=String(m.name||''),L=nm.toLowerCase();seen.push(nm);
    const vals=(m.values||[]).filter(v=>!v.suspended&&+v.odd>1);
    const h1=/1st|first/.test(L),h2=/2nd|second/.test(L),put=(k,o)=>{if(k&&!(k in q))q[k]=+(+o).toFixed(2)};
    if(/^(fulltime result|match winner|1x2)$/.test(L))vals.forEach(v=>put({home:'Local gana',draw:'Empate',away:'Visitante gana'}[String(v.value).toLowerCase()],v.odd));
    else if(/double chance/.test(L)&&!h1&&!h2)vals.forEach(v=>put({'home/draw':'Doble oportunidad 1X','draw/away':'Doble oportunidad X2','home/away':'Doble oportunidad 12'}[String(v.value).toLowerCase().replace(/\s/g,'')],v.odd));
    else if(/both teams to score/.test(L)&&!h1&&!h2)vals.forEach(v=>put({yes:'Ambos marcan: sí',no:'Ambos marcan: no'}[String(v.value).toLowerCase()],v.odd));
    else if((/(match goals|over\/under|goals over\/under|total goals)/.test(L)&&!h1)||(h2&&/goals|over\/under|total/.test(L))){
      vals.forEach(v=>{
        const mm=String(v.value).match(/(over|under)\s*([\d.]+)?/i);if(!mm)return;
        const line=String(v.handicap!=null&&v.handicap!==''?v.handicap:mm[2]||'').replace(/[^\d.]/g,'');
        if(!/\.5$/.test(line))return;
        const side=mm[1][0].toUpperCase()+mm[1].slice(1).toLowerCase();
        if(h2){if(['0.5','1.5'].includes(line))put('Segundo tiempo '+side+' '+line,v.odd)}
        else if(['1.5','2.5','3.5','4.5'].includes(line))put(side+' '+line,v.odd);
      });
    }
  }
  return{q,seen,upd:x&&x.update||null,elapsed:x&&x.fixture&&x.fixture.status&&x.fixture.status.elapsed,blocked:!!(x&&x.status&&(x.status.blocked||x.status.finished))};
}
function htFair(q){
  const f={},pair=(a,b)=>{if(q[a]&&q[b]){const s=1/q[a]+1/q[b];f[a]=1/q[a]/s;f[b]=1/q[b]/s}};
  ['1.5','2.5','3.5','4.5'].forEach(t=>pair('Over '+t,'Under '+t));pair('Ambos marcan: sí','Ambos marcan: no');pair('Segundo tiempo Over 1.5','Segundo tiempo Under 1.5');pair('Segundo tiempo Over 0.5','Segundo tiempo Under 0.5');
  if(q['Local gana']&&q['Empate']&&q['Visitante gana']){
    const s=1/q['Local gana']+1/q['Empate']+1/q['Visitante gana'];['Local gana','Empate','Visitante gana'].forEach(k=>f[k]=1/q[k]/s);
    f['Doble oportunidad 1X']=f['Local gana']+f['Empate'];f['Doble oportunidad X2']=f['Empate']+f['Visitante gana'];f['Doble oportunidad 12']=f['Local gana']+f['Visitante gana'];
  }
  return f;
}
// Evalúa un mercado con una cuota: ventaja con la prob. calibrada, discrepancia con el mercado y veredicto.
function htEval(r,q,fair){
  const R=HT_RULE,edge=r.pc*q-1,pf=fair&&fair[r.n]!=null?fair[r.n]:null,gap=pf==null?null:r.pc-pf;
  let why='';
  if(q<R.qa||q>R.qb)why=`cuota fuera de @${R.qa.toFixed(2)}–@${R.qb.toFixed(2)}`;
  else if(edge<(pf==null?R.edgeNoRef:R.edge))why=`ventaja ${Math.round(edge*100)}% (mínimo ${Math.round((pf==null?R.edgeNoRef:R.edge)*100)}%)`;
  else if(gap!=null&&gap>R.gap)why=`el mercado discrepa mucho (${Math.round(gap*100)} pts): puede faltar algo que el modelo no ve`;
  return{q,edge,pf,gap,rec:!why,why,stk:edge>=.10&&(gap==null||gap<=.08)?2:1};
}

// ---------- Escaneo ----------
async function htAnalyze(slug,e,names){
  const c=e.competitions[0],H=c.competitors.find(x=>x.homeAway==='home'),W=c.competitors.find(x=>x.homeAway==='away');
  const i={ev:e.id,slug,liga:names[slug]||slug,ko:e.date,hn:H.team.displayName,wn:W.team.displayName,hh:+H.score||0,ha:+W.score||0};
  try{
    const j=await htJ(HT_SUM(slug,e.id)),ts=(j.boxscore&&j.boxscore.teams)||[];
    const g=(id,n)=>{const t=ts.find(x=>String(x.team&&x.team.id)===String(id)),s=t&&(t.statistics||[]).find(q=>q.name===n),v=s?parseFloat(s.displayValue):NaN;return isNaN(v)?null:v};
    const side=id=>({sh:g(id,'totalShots'),sot:g(id,'shotsOnTarget'),co:g(id,'wonCorners'),y:g(id,'yellowCards'),r:g(id,'redCards'),pos:g(id,'possessionPct')});
    if(ts.length===2)i.s={h:side(H.team.id),w:side(W.team.id)};
  }catch{}
  try{
    const[fa,fb]=await Promise.all([teamForm(slug,H.team.id),teamForm(slug,W.team.id)]);
    const A=st(fa),B=st(fb),SL=await htStd(slug);
    A.ss=SL&&SL.t[H.team.id];B.ss=SL&&SL.t[W.team.id];A.mu=SL?SL.mu:null;i.na=A.n;i.nb=B.n;
    if(A.n>=5&&B.n>=5){const mod=model(A,B);i.lh=mod.lh;i.la=mod.la}else i.short=true;
  }catch(err){i.err=String(err.message||err).slice(0,60)}
  if(i.lh!=null)i.m=htMarkets(i);
  return i;
}
async function htOddsFor(i,fx){
  // fx = lista de partidos en vivo de API-Football (ya pedida una vez). Se busca el que coincide por nombres y marcador.
  const hit=(fx||[]).map(f=>{const s=sim(i.hn,f.teams.home.name)+sim(i.wn,f.teams.away.name),v=sim(i.hn,f.teams.away.name)+sim(i.wn,f.teams.home.name);return{f,s:Math.max(s,v)}}).sort((a,b)=>b.s-a.s)[0];
  if(!hit||hit.s<1.15)return{err:'no encontré este partido entre los partidos en vivo de API-Football'};
  i.fid=hit.f.fixture.id;
  return htRefreshOdds(i);
}
async function htRefreshOdds(i){
  if(afBud()>=90)return{err:'límite propio de 90 solicitudes/día de API-Football alcanzado'};
  const j=await afGet('odds/live',{fixture:i.fid});afUse(1);
  const x=(j.response||[])[0];if(!x)return{err:'API-Football no tiene cuotas en vivo para este partido'};
  const o=htParseOdds(x);o.t=Date.now();
  if(o.blocked)return{err:'las cuotas están bloqueadas o el partido terminó',seen:o.seen};
  if(!Object.keys(o.q).length)return{err:'no pude leer mercados conocidos',seen:o.seen};
  return o;
}
async function htScan(){
  if(HT.busy)return;HT.busy=true;
  const box=$('#htBox'),msg=$('#htMsg'),btn=$('#htBtn');if(btn)btn.disabled=true;box.innerHTML='';
  try{
    if(!cfg.lg.length){msg.textContent='Elige al menos una liga en «Ligas y días».';return}
    msg.textContent=`Buscando partidos en descanso en ${cfg.lg.length} ligas…`;
    const names=Object.fromEntries(Object.entries(LG).map(([n,s])=>[s,n]));let fail=0;
    const found=(await htPool(cfg.lg,6,async slug=>{try{return((await htJ(HT_SB(slug))).events||[]).filter(htIsHT).map(e=>({slug,e}))}catch{fail++;return[]}})).flat();
    if(!found.length){msg.textContent=`Ningún partido en descanso ahora mismo en tus ligas${fail?` (${fail} no respondieron)`:''}. Vuelve a tocar cuando haya partidos en el entretiempo.`;return}
    msg.textContent=`${found.length} partido${found.length===1?'':'s'} en descanso. Calculando la 2.ª parte…`;
    HT.rows={};HT.m={};
    const res=await htPool(found,3,x=>htAnalyze(x.slug,x.e,names));
    res.forEach(i=>{HT.m[i.ev]={i,o:null,oerr:null}});
    box.innerHTML=res.map(i=>`<div id="htc_${i.ev}">${htCard(i.ev)}</div>`).join('')+'<p class="status">Experimental: el modelo usa la calibración del fútbol, pero en vivo todavía no está validado. Se recomienda solo con ventaja real y sin que el mercado discrepe mucho. Confirma la cuota de tu casa antes de apostar: en vivo cambia rápido.</p>';
    // cuotas en vivo automáticas
    if(cfg.af&&res.some(i=>i.m&&i.m.length)){
      msg.textContent='Trayendo cuotas en vivo de API-Football…';
      let fx=null;
      try{if(afBud()>=90)throw new Error('límite propio de 90 solicitudes/día alcanzado');fx=(await afGet('fixtures',{live:'all'})).response||[];afUse(1)}
      catch(err){res.forEach(i=>{HT.m[i.ev].oerr=String(err.message||err).slice(0,140)});}
      if(fx)for(const i of res){if(!(i.m&&i.m.length))continue;
        try{const o=await htOddsFor(i,fx);if(o.err)HT.m[i.ev].oerr=o.err,HT.m[i.ev].seen=o.seen;else HT.m[i.ev].o=o}
        catch(err){HT.m[i.ev].oerr=String(err.message||err).slice(0,140)}}
      res.forEach(i=>htRender(i.ev));
    }else if(!cfg.af){res.forEach(i=>{HT.m[i.ev].oerr='sin llave de API-Football en Ajustes: escribe tú la cuota';htRender(i.ev)})}
    msg.textContent=`${found.length} partido${found.length===1?'':'s'} en descanso${fail?` · ${fail} liga${fail===1?'':'s'} sin respuesta`:''}.`;
  }catch(err){msg.textContent='No se pudo leer ESPN: '+String(err.message||err).slice(0,80)}
  finally{HT.busy=false;if(btn)btn.disabled=false}
}
function htRender(ev){const el=document.getElementById('htc_'+ev);if(el)el.innerHTML=htCard(ev)}
async function htRefOdds(ev){
  const M=HT.m[ev];if(!M||!M.i.fid){toast('Este partido no está enlazado con API-Football.');return}
  const el=document.getElementById('htq_status_'+ev);if(el)el.textContent='Actualizando…';
  try{const o=await htRefreshOdds(M.i);if(o.err){M.oerr=o.err;M.seen=o.seen}else{M.o=o;M.oerr=null}}catch(err){M.oerr=String(err.message||err).slice(0,140)}
  htRender(ev);
}

// ---------- Tarjeta ----------
function htCard(ev){
  const M=HT.m[ev],i=M.i,s=i.s,o=M.o,q=o?o.q:{},fair=o?htFair(q):{};
  const sr=(l,a,b)=>a==null&&b==null?'':`<div class="ht-sr"><b>${a==null?'–':a}</b><span>${l}</span><b>${b==null?'–':b}</b></div>`;
  const stats=s?sr('Tiros',s.h.sh,s.w.sh)+sr('A puerta',s.h.sot,s.w.sot)+sr('Córners',s.h.co,s.w.co)+sr('Amarillas',s.h.y,s.w.y)+sr('Rojas',s.h.r,s.w.r)+sr('Posesión %',s.h.pos,s.w.pos):'';
  let body='';
  if(i.err)body=`<p class="status">No se pudo armar el modelo de este partido (${esc(i.err)}).</p>`;
  else if(i.short)body='<p class="status">Pocos partidos recientes de alguno de los equipos: sin picks para este partido.</p>';
  else if(!i.m||!i.m.length)body='<p class="status">Ningún mercado útil en este momento.</p>';
  else{
    const age=o&&o.t?Math.max(0,Math.round((Date.now()-o.t)/1000)):null;
    const head=`<div class="ht-meta"><span>Goles esperados 2.ª parte: <b>${i.l2[0].toFixed(2)}</b> · <b>${i.l2[1].toFixed(2)}</b></span><span>Historial: ${i.na}/${i.nb} partidos</span>${i.s?'':'<span class="bad">sin datos del 1.er tiempo</span>'}</div>`
      +(o?`<div class="ht-odds"><span class="ok">Cuotas en vivo · API-Football</span><span>hace ${age<90?age+' s':Math.round(age/60)+' min'}</span><button class="btn s" onclick="htRefOdds('${ev}')">↻ Actualizar</button></div>`
        :`<div class="ht-odds"><span class="bad">Sin cuotas automáticas</span>${M.oerr?`<small>${esc(M.oerr)}</small>`:''}${i.fid?`<button class="btn s" onclick="htRefOdds('${ev}')">↻ Reintentar</button>`:''}</div>`);
    const rows=i.m.filter(r=>r.pc>=.5&&r.pc<=.92).map(r=>{const k=ev+'_'+r.n.replace(/\W+/g,'');HT.rows[k]={i,r,key:k};const e=q[r.n]?htEval(r,q[r.n],fair):null;return{r,k,e}});
    rows.sort((x,y)=>(y.e&&y.e.rec)-(x.e&&x.e.rec)||((y.e?y.e.edge:-9)-(x.e?x.e.edge:-9))||y.r.pc-x.r.pc);
    const recs=rows.filter(x=>x.e&&x.e.rec);
    const line=({r,k,e})=>{
      const qv=e?e.q:'';
      return `<div class="ht-r${e&&e.rec?' rec':''}"><div class="ht-rh"><span>${esc(r.n)}</span><b>${Math.round(r.pc*100)}%</b></div>`
       +`<div class="ht-rm"><small>${e&&e.pf!=null?`Mercado ${Math.round(e.pf*100)}% · `:''}Cuota mínima @${(1.04/r.pc).toFixed(2)}</small><input type="number" step="0.01" min="1.01" inputmode="decimal" placeholder="Tu cuota" id="htq_${k}" value="${qv}" oninput="htOdd('${k}')"></div>`
       +`<div class="ht-v" id="htv_${k}">${e?htVerdict(k,e):''}</div></div>`};
    body=head
      +(o?(recs.length?`<div class="ht-sec">Recomendados ahora</div><div class="ht-ms">${recs.slice(0,4).map(line).join('')}</div>`:'<p class="status"><b>Sin valor claro ahora.</b> Ninguna cuota supera la ventaja mínima sin que el mercado discrepe. Esperar también es una buena decisión.</p>'):'')
      +`<details class="ht-more" ${o?'':'open'}><summary>${o?'Ver los demás mercados':'Mercados y cuota mínima'}</summary><div class="ht-ms">${rows.filter(x=>!(x.e&&x.e.rec)).slice(0,10).map(line).join('')}</div></details>`
      +(M.seen&&!o?`<details class="ht-more"><summary>Mercados que devolvió la fuente (para depurar)</summary><p class="status">${esc(M.seen.join(' · ')||'ninguno')}</p></details>`:'');
  }
  return `<article class="card htc"><div class="ht-h"><div><b>${esc(i.hn)} <em>${i.hh} – ${i.ha}</em> ${esc(i.wn)}</b><small>${esc(i.liga)} · descanso</small></div></div>${stats?`<div class="ht-st">${stats}</div>`:''}${body}</article>`;
}
function htVerdict(k,e){
  if(e.rec)return `<b class="ok">Valor +${Math.round(e.edge*100)}%</b>${e.gap!=null?` · mercado de acuerdo (${e.gap>=0?'+':''}${Math.round(e.gap*100)} pts)`:' · sin contraste de mercado'} · stake ${e.stk} <button class="btn s" onclick="htReg('${k}')">＋ Registrar</button>`;
  return `<b class="bad">No apostar</b> · ${esc(e.why)}`;
}
function htOdd(k){
  const o=HT.rows[k],el=document.getElementById('htv_'+k),inp=document.getElementById('htq_'+k);if(!o||!el||!inp)return;
  const q=+inp.value;if(!q||q<=1){el.innerHTML='';return}
  const M=HT.m[o.i.ev],fair=M&&M.o?htFair(M.o.q):{};
  el.innerHTML=htVerdict(k,htEval(o.r,q,fair));
}

// ---------- Registro aparte ----------
function htReg(k){
  const o=HT.rows[k],inp=document.getElementById('htq_'+k);if(!o||!inp)return;const q=+inp.value;if(!q||q<=1)return;
  const M=HT.m[o.i.ev],fair=M&&M.o?htFair(M.o.q):{},e=htEval(o.r,q,fair),{i,r}=o,P=LS('htpicks',[]);
  if(P.some(x=>x.ev===i.ev&&x.mk===r.n)){toast('Ya registraste este mercado en este partido.');return}
  P.push({id:Date.now()+'-'+Math.floor(Math.random()*1e4),t:Date.now(),ev:i.ev,slug:i.slug,m:i.hn+' vs '+i.wn,liga:i.liga,ko:i.ko,mk:r.n,
    p:+r.p.toFixed(3),pc:+r.pc.toFixed(3),pf:e.pf!=null?+e.pf.toFixed(3):null,q,s:e.stk,edge:+e.edge.toFixed(3),rec:e.rec,src:M&&M.o&&Math.abs(M.o.q[r.n]-q)<.005?'live':'manual',ht:[i.hh,i.ha],res:null});
  SV('htpicks',P);toast('Guardado en el registro de descanso.');htLogDraw();
}
async function htSettle(){
  const P=LS('htpicks',[]);let ch=0;
  for(const k of P){
    if(k.res||k.man||Date.now()-new Date(k.ko).getTime()<100*60000)continue;
    let f=null;try{f=await final(k.slug,k.ev)}catch{}
    if(!f||f.pending)continue;
    const ok=evalMk(k.mk,f.h,f.a,f.cor,f.crd,f.hh,f.ha);if(ok===null)continue;
    k.res=ok?'w':'l';k.sc=f.h+'-'+f.a;ch++;
  }
  SV('htpicks',P);return ch;
}
function htSet(id,res){const P=LS('htpicks',[]),k=P.find(x=>x.id===id);if(!k)return;k.res=res;k.man=res!==null;if(res===null)delete k.sc;SV('htpicks',P);htLogDraw()}
function htDel(id){if(!confirm('¿Borrar este pick del registro de descanso?'))return;SV('htpicks',LS('htpicks',[]).filter(x=>x.id!==id));htLogDraw()}
async function htLogRefresh(){const b=$('#htLogRef');if(b){b.disabled=true;b.textContent='Revisando…'}try{const n=await htSettle();toast(n?`${n} resultado${n===1?'':'s'} actualizado${n===1?'':'s'}.`:'Sin resultados nuevos todavía.')}catch{}htLogDraw()}
function htLogDraw(){
  const el=$('#htLog');if(!el)return;const P=LS('htpicks',[]).slice().sort((a,b)=>b.t-a.t),D=P.filter(k=>k.res==='w'||k.res==='l');
  if(!P.length){el.innerHTML='<details class="card htlog"><summary><b>Registro de descanso</b> <small>vacío</small></summary><p class="status">Aquí se guardan solo los picks de descanso que registres, separados del resto. Cuando haya resueltos verás acierto, retorno y si el modelo en vivo promete más de lo que cumple.</p></details>';return}
  const n=D.length,w=D.filter(k=>k.res==='w').length,pm=n?D.reduce((t,k)=>t+(k.pc||k.p),0)/n:0,st=D.reduce((t,k)=>t+(k.s||1),0),ret=D.reduce((t,k)=>t+(k.res==='w'?(k.s||1)*(k.q-1):-(k.s||1)),0);
  const grp=k=>/^Segundo tiempo/.test(k.mk)?'2.ª parte':/^(Over|Under)/.test(k.mk)?'Goles totales':/^Ambos/.test(k.mk)?'Ambos marcan':'Resultado';
  const G={};D.forEach(k=>{const g=G[grp(k)]=G[grp(k)]||{w:0,n:0,ret:0,st:0};g.n++;g.st+=k.s||1;if(k.res==='w'){g.w++;g.ret+=(k.s||1)*(k.q-1)}else g.ret-=(k.s||1)});
  const sum=n?`<div class="ht-lg"><div><b>${w}/${n}</b><small>acertados (${Math.round(w/n*100)}%)</small></div><div><b>${Math.round(pm*100)}%</b><small>prometía el modelo</small></div><div><b class="${ret>=0?'ok':'bad'}">${ret>=0?'+':''}${ret.toFixed(1)}</b><small>unidades (${st?Math.round(ret/st*100):0}% retorno)</small></div></div>${n<20?'<p class="status">Con menos de 20 picks resueltos, esto puede ser suerte: no decidas nada todavía.</p>':''}${Object.entries(G).map(([g,v])=>`<div class="tools"><span><b>${g}</b></span><span>${v.w}/${v.n} · ${v.ret>=0?'+':''}${v.ret.toFixed(1)} u</span></div>`).join('')}`:'<p class="status">Aún no hay picks resueltos.</p>';
  const list=P.slice(0,40).map(k=>{const ch=k.res==='w'?'<span class="ch ok">Ganado</span>':k.res==='l'?'<span class="ch bad">Perdido</span>':'<span class="ch am">Pendiente</span>';
    return `<div class="ht-li"><div><b>${esc(k.m)}</b><small>${esc(k.mk)} · @${k.q} · stake ${k.s} · ${Math.round((k.pc||k.p)*100)}% · ${k.src==='live'?'cuota en vivo':'cuota escrita'}${k.ht?` · descanso ${k.ht[0]}-${k.ht[1]}`:''}${k.sc?` · final ${k.sc}`:''}</small></div><div class="ht-lb">${ch}${k.res?`<button class="btn s" onclick="htSet('${k.id}',null)">↺</button>`:`<button class="btn s" onclick="htSet('${k.id}','w')">✓</button><button class="btn s" onclick="htSet('${k.id}','l')">✗</button>`}<button class="btn s" onclick="htDel('${k.id}')">🗑</button></div></div>`}).join('');
  el.innerHTML=`<details class="card htlog" open><summary><b>Registro de descanso</b> <small>${P.length} pick${P.length===1?'':'s'}</small></summary>${sum}<button class="btn s wide" id="htLogRef" onclick="htLogRefresh()">Actualizar resultados</button><div class="ht-lst">${list}</div></details>`;
}
(function(){const b=document.getElementById('htBtn');if(b)b.addEventListener('click',htScan);htLogDraw();htSettle().then(n=>{if(n)htLogDraw()}).catch(()=>{})})();
