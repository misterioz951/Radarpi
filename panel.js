/* RadarPi · panel.js — panel de análisis de SOLO LECTURA (pestaña Modelo).
   Lee el registro auditable, el monitor de fuentes y el historial de cuotas. No escribe picks, stakes ni ajustes y no genera recomendaciones. */
(()=>{'use strict';
const $=s=>document.querySelector(s),ND='No disponible',SMALL=30;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(x,d=1)=>x==null?ND:(x*100).toFixed(d)+'%',num=(x,d=3)=>x==null?ND:x.toFixed(d);
const fmtT=t=>t?new Date(t).toLocaleString('es',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):null;
const AVISO='Este panel mide rendimiento histórico y no constituye una recomendación de apuesta';
// ---------- cálculo (funciones puras) ----------
const resOf=r=>r==='w'?'w':r==='l'?'l':(r==='v'||r==='void')?'v':null;
function perfStats(R){
  const n=R.length,dec=R.filter(r=>resOf(r.res)==='w'||resOf(r.res)==='l'),W=dec.filter(r=>resOf(r.res)==='w').length,L=dec.length-W,V=R.filter(r=>resOf(r.res)==='v').length,
    hit=dec.length?W/dec.length:null,rr=R.filter(r=>resOf(r.res)&&r.odds>1),roi=rr.length?rr.reduce((a,r)=>a+(resOf(r.res)==='w'?r.odds-1:resOf(r.res)==='l'?-1:0),0)/rr.length:null,
    bp=dec.filter(r=>r.p!=null&&r.p>=0&&r.p<=1),brier=bp.length?bp.reduce((a,r)=>a+(r.p-(resOf(r.res)==='w'?1:0))**2,0)/bp.length:null,
    bh=bp.length?bp.filter(r=>resOf(r.res)==='w').length/bp.length:null,
    clvs=R.filter(r=>r.odds>1&&r.close>1).map(r=>r.odds/r.close-1),
    bins=Array.from({length:10},(_,i)=>({lo:i/10,hi:(i+1)/10,n:0,p:0,w:0}));
  for(const r of bp){const b=bins[Math.min(9,Math.floor(r.p*10))];b.n++;b.p+=r.p;b.w+=resOf(r.res)==='w'?1:0}
  return{n,pend:n-dec.length-V,dec:dec.length,W,L,V,hit,roi,nRoi:rr.length,brier,nBrier:bp.length,brierRef:bh==null?null:bh*(1-bh),
    clv:clvs.length?clvs.reduce((a,b)=>a+b,0)/clvs.length:null,clvPos:clvs.length?clvs.filter(x=>x>0).length/clvs.length:null,nClv:clvs.length,
    curve:bins.filter(b=>b.n).map(b=>({rango:b.lo.toFixed(1)+'–'+b.hi.toFixed(1),n:b.n,prevista:b.p/b.n,observada:b.w/b.n})),small:dec.length<SMALL}}
function groupStats(R,key){const g=new Map();for(const r of R){const k=key(r)||ND;(g.get(k)||g.set(k,[]).get(k)).push(r)}return[...g].map(([k,v])=>({k,s:perfStats(v)})).sort((a,b)=>b.s.n-a.s.n)}
async function ledgerRows(){if(!window.RadarLedger)return null;const E=await RadarLedger.all(),M=new Map();
  for(const e of E){const r=M.get(e.pick_id)||{id:e.pick_id,res:null};
    if(e.type==='pick')Object.assign(r,{module:e.data.module,market:e.data.market,league:e.data.league,source:e.data.data_source,p:e.data.p_final,odds:e.data.odds_pick,close:e.data.odds_close});
    else if(e.type==='odds_update')r.odds=e.data.odds_pick;else if(e.type==='close')r.close=e.data.odds_close;else if(e.type==='result')r.res=e.data.result;else if(e.type==='removed')r.removed=true;M.set(e.pick_id,r)}
  return[...M.values()]}
// ---------- estilos ----------
const css=document.createElement('style');css.textContent='.pn-aviso{border:2px solid #E0B84A;border-radius:10px;padding:10px 12px;margin:0 0 12px;font-weight:600}.pn-warn{border-left:4px solid #E0B84A;padding:6px 10px;margin:8px 0}.pn-note{font-size:.85em;opacity:.85;margin:6px 0}'+
  '.pn-t{width:100%;border-collapse:collapse;font-size:.85em}.pn-t th,.pn-t td{padding:5px 6px;border-bottom:1px solid rgba(128,128,128,.3);text-align:right}.pn-t th:first-child,.pn-t td:first-child{text-align:left}.pn-wrap{overflow-x:auto}'+
  '.pn-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0}.pn-k{border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:8px}.pn-k b{display:block;font-size:1.15em}.pn-k span{font-size:.8em;opacity:.8}'+
  '.pn-badge{display:inline-block;border:1px solid currentColor;border-radius:99px;padding:2px 9px;font-size:.85em;font-weight:600}.pn-svc{border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:10px;margin:8px 0}.pn-svc p{margin:3px 0}';
document.head.appendChild(css);
// ---------- 1) rendimiento ----------
const kpi=(t,v,s)=>`<div class="pn-k"><span>${t}</span><b>${v}</b>${s?`<span>${s}</span>`:''}</div>`;
const smallTag=s=>s.small?` <span class="pn-badge">⚠ muestra pequeña</span>`:'';
function curveSvg(c){if(!c.length)return'';const W=210,P=28,x=v=>P+v*(W-P-8),y=v=>W-P-v*(W-P-8);
  return`<svg viewBox="0 0 ${W} ${W}" width="210" height="210" role="img" aria-label="Curva de calibración: probabilidad prevista contra frecuencia observada"><line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke="currentColor" stroke-dasharray="4 3" opacity=".5"/>`+
    `<rect x="${x(0)}" y="${y(1)}" width="${x(1)-x(0)}" height="${y(0)-y(1)}" fill="none" stroke="currentColor" opacity=".4"/>`+
    c.map(b=>`<circle cx="${x(b.prevista)}" cy="${y(b.observada)}" r="${Math.min(9,2+Math.sqrt(b.n))}" fill="currentColor" opacity="${b.n<10?.35:.85}"/>`).join('')+
    `<text x="${W/2}" y="${W-4}" font-size="9" text-anchor="middle" fill="currentColor">prevista</text><text x="9" y="${W/2}" font-size="9" text-anchor="middle" fill="currentColor" transform="rotate(-90 9 ${W/2})">observada</text></svg>`}
function groupTable(title,G){return`<h4>${title}</h4><div class="pn-wrap"><table class="pn-t"><tr><th>Grupo</th><th>Picks</th><th>Resueltos</th><th>Aciertos</th><th>Hit rate</th><th>ROI</th><th>Brier</th><th>CLV medio (n)</th></tr>`+
  G.map(({k,s})=>`<tr><td>${esc(k)}${smallTag(s)}</td><td>${s.n}</td><td>${s.dec}</td><td>${s.W}</td><td>${pct(s.hit)}</td><td>${pct(s.roi)}</td><td>${num(s.brier)}</td><td>${s.clv==null?ND:pct(s.clv)+' ('+s.nClv+')'}</td></tr>`).join('')+'</table></div>'}
let PM='all';
async function renderPerf(){const box=$('#pn-perf');if(!box)return;const all=await ledgerRows();
  if(!all){box.innerHTML='<p class="status">No disponible: el registro auditable no está cargado.</p>';return}
  const R=PM==='all'?all:all.filter(r=>r.module===PM),s=perfStats(R),rem=R.filter(r=>r.removed).length;
  box.innerHTML=`<div class="pn-aviso" role="note">${AVISO}</div>
  <label>Módulo <select id="pn-mod"><option value="all">Todos</option><option value="futbol">Fútbol</option><option value="corners">Córners</option></select></label> <button class="btn s" id="pn-perf-r" type="button">Actualizar</button>
  ${R.length?'':'<p class="status">No disponible: aún no hay picks en el registro auditable.</p>'}
  ${s.small&&R.length?`<div class="pn-warn" role="alert"><b>⚠ Muestra pequeña:</b> solo ${s.dec} pick${s.dec===1?'':'s'} resuelto${s.dec===1?'':'s'} (se necesitan al menos ${SMALL} por grupo). Las cifras de abajo no son concluyentes.</div>`:''}
  <div class="pn-kpis">${kpi('Picks registrados',s.n,`${s.dec} resueltos · ${s.V} nulos · ${s.pend} pendientes`)}${kpi('Aciertos',s.dec?`${s.W} de ${s.dec}`:ND)}${kpi('Hit rate',pct(s.hit),`n = ${s.dec}`)}
  ${kpi('ROI (stake plano 1)',pct(s.roi),`n = ${s.nRoi}`)}${kpi('Brier',num(s.brier),s.brierRef==null?`n = ${s.nBrier}`:`n = ${s.nBrier} · referencia ${num(s.brierRef)}`)}${kpi('CLV real medio',s.clv==null?ND:pct(s.clv),s.clv==null?'sin cuota de cierre guardada':`${pct(s.clvPos,0)} positivos · n = ${s.nClv}`)}</div>
  <p class="pn-note">CLV = cuota del pick / cuota de cierre − 1, con la última cuota que la app guardó antes del partido; sin escaneo cerca del cierre no hay dato. ROI con 1 unidad por pick resuelto: no usa tus stakes. Brier de referencia = el de predecir siempre la tasa de acierto observada (menor es mejor).${rem?` Incluye ${rem} pick${rem===1?'':'s'} que borraste de la app: el registro auditable los conserva.`:''}</p>
  <h4>Curva de calibración${smallTag(s)}</h4>${s.curve.length?`<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">${curveSvg(s.curve)}<div class="pn-wrap" style="flex:1;min-width:210px"><table class="pn-t"><tr><th>Rango</th><th>n</th><th>Prevista</th><th>Observada</th></tr>${s.curve.map(b=>`<tr><td>${b.rango}${b.n<10?' ⚠':''}</td><td>${b.n}</td><td>${pct(b.prevista)}</td><td>${pct(b.observada)}</td></tr>`).join('')}</table><p class="pn-note">⚠ = menos de 10 picks en el rango. Puntos cerca de la diagonal = probabilidades bien calibradas.</p></div></div>`:`<p class="status">${ND}: faltan picks resueltos con probabilidad.</p>`}
  ${R.length?groupTable('Por mercado',groupStats(R,r=>r.market))+groupTable('Por liga',groupStats(R,r=>r.league))+groupTable('Por fuente de datos',groupStats(R,r=>r.source)):''}`;
  $('#pn-mod').value=PM;$('#pn-mod').onchange=e=>{PM=e.target.value;renderPerf()};$('#pn-perf-r').onclick=async()=>{try{await RadarLedger.sync()}catch{}renderPerf()}}
// ---------- 2) estado de las fuentes ----------
const BADGE={ok:'🟢 Funcionando',sin_datos:'⚪ Sin datos',error:'🔴 Error',limite:'🟠 Límite alcanzado',pausado:'⏸ Servicio pausado'};
function renderSrc(){const box=$('#pn-src');if(!box||!window.RadarMon)return;const L=RadarMon.ids().map(RadarMon.status);
  box.innerHTML=`<p class="pn-note">Los contadores cubren solo las llamadas hechas desde este dispositivo desde que existe este monitor. «Sin datos» significa que todavía no hubo llamadas correctas; no es un error. Nada se oculta ni se estima: lo que no se sabe aparece como «${ND}».</p><button class="btn s" id="pn-src-r" type="button">Actualizar</button>`+
  L.map(x=>{const q=x.cuota,e=x.ultimo_error;return`<div class="pn-svc"><p><b>${esc(x.nombre)}</b> <span class="pn-badge">${BADGE[x.estado]}</span></p>
  <p>Llamadas: hoy ${x.hoy} · este mes ${x.mes}</p>
  <p>Cuota ${q?esc(q.per):''}: ${q?(q.usada==null?`usada ${ND}`:`usada ${q.usada}`)+` de ${q.limite==null?ND:q.limite} · restante ${q.restante==null?ND:q.restante} <i>(${esc(q.fuente)})</i><br><small>${esc(q.nota)}</small>`:`${ND} (sin cuota oficial publicada)`}</p>
  <p>Última actualización correcta: ${x.ultimo_ok?fmtT(x.ultimo_ok):'Nunca registrada'}</p>
  <p>Último error: ${e?`${fmtT(e.t)} · ${e.status?'HTTP '+e.status:'red'} · ${esc(e.msg)}`:'Ninguno registrado'}</p>
  <p>Pausas activas: ${x.pausas.length?x.pausas.map(esc).join(' '):'Ninguna'}</p></div>`}).join('');
  $('#pn-src-r').onclick=renderSrc}
// ---------- 3) historial de cuotas ----------
const HS={match:null,snaps:[],book:null,market:null,sel:null};
function dl(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
function chartSvg(P){if(!P.length)return`<p class="status">${ND}: sin capturas para esta combinación.</p>`;const W=300,Hh=170,pl=38,pr=10,pt=10,pb=24,t0=+new Date(P[0][0]),t1=+new Date(P[P.length-1][0]),span=Math.max(1,t1-t0),lo=Math.min(...P.map(p=>p[1])),hi=Math.max(...P.map(p=>p[1])),sp=Math.max(0.02,hi-lo),
  x=t=>pl+((t-t0)/span)*(W-pl-pr),y=v=>Hh-pb-((v-lo)/sp)*(Hh-pt-pb),pts=P.map(p=>`${P.length===1?(W/2):x(+new Date(p[0]))},${y(p[1])}`).join(' ');
  return`<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Evolución de la cuota en el tiempo"><rect x="${pl}" y="${pt}" width="${W-pl-pr}" height="${Hh-pt-pb}" fill="none" stroke="currentColor" opacity=".35"/>`+
   `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/>`+P.map(p=>`<circle cx="${P.length===1?(W/2):x(+new Date(p[0]))}" cy="${y(p[1])}" r="3" fill="currentColor"/>`).join('')+
   `<text x="2" y="${y(hi)+3}" font-size="9" fill="currentColor">${hi.toFixed(2)}</text><text x="2" y="${y(lo)+3}" font-size="9" fill="currentColor">${lo.toFixed(2)}</text>`+
   `<text x="${pl}" y="${Hh-8}" font-size="9" fill="currentColor">${fmtT(P[0][0])}</text><text x="${W-pr}" y="${Hh-8}" font-size="9" text-anchor="end" fill="currentColor">${fmtT(P[P.length-1][0])}</text></svg>`}
function series(){const P=[];for(const s of HS.snaps){if(s.bookmaker!==HS.book)continue;const r=s.rows.find(r=>r[0]===HS.market&&r[1]===HS.sel);if(r)P.push([s.captured_at,r[2]])}return P.sort((a,b)=>a[0]<b[0]?-1:1)}
async function renderOdds(){const box=$('#pn-odds');if(!box||!window.RadarMon)return;const H=RadarMon.history,c=await H.counts(),ms=(await H.matches()).sort((a,b)=>a.last_seen<b.last_seen?1:-1),f=await H.first();
  const books=[...new Set(HS.snaps.map(s=>s.bookmaker))],mk=[...new Set(HS.snaps.filter(s=>s.bookmaker===HS.book).flatMap(s=>s.rows.map(r=>r[0])))].sort(),sels=[...new Set(HS.snaps.filter(s=>s.bookmaker===HS.book).flatMap(s=>s.rows.filter(r=>r[0]===HS.market).map(r=>r[1])))].sort(),P=HS.match&&HS.sel?series():[];
  const opt=(arr,cur,lbl)=>arr.map(a=>`<option value="${esc(a)}"${a===cur?' selected':''}>${esc(lbl?lbl(a):a)}</option>`).join('');
  box.innerHTML=`<p class="pn-note">Guarda una captura por partido y casa cada vez que la app descarga cuotas (OddsPapi: la casa elegida en Ajustes; The Odds API: las casas que devuelva). Es acumulativo y no altera las cuotas ni las decisiones.${H.persistent()?'':' <b>⚠ Sin IndexedDB: el historial vive solo en memoria y se perderá al cerrar.</b>'}</p>
  <p><b>${c.rows}</b> cuotas en <b>${c.snaps}</b> capturas · <b>${c.matches}</b> partidos · <b>${c.scans}</b> escaneos${f?' · desde '+fmtT(f):''}</p>
  <div class="tools"><button class="btn s" id="pn-csv" type="button">Exportar CSV</button><button class="btn s" id="pn-json" type="button">Exportar JSON</button><button class="btn s" id="pn-odds-r" type="button">Actualizar</button><span id="pn-exp" class="status" role="status"></span></div>
  ${ms.length?`<label>Partido <select id="pn-m"><option value="">Elige un partido…</option>${opt(ms.map(m=>m.match_id),HS.match,id=>{const m=ms.find(x=>x.match_id===id);return`${m.home} vs ${m.away} · ${m.kickoff?fmtT(m.kickoff):ND} (${m.n_snaps} capturas)`})}</select></label>`:`<p class="status">${ND}: aún no hay capturas. Se guardan solas la próxima vez que escanees cuotas.</p>`}
  ${HS.match?`<label>Casa <select id="pn-b">${opt(books,HS.book)}</select></label> <label>Mercado <select id="pn-k">${opt(mk,HS.market)}</select></label> <label>Selección <select id="pn-s">${opt(sels,HS.sel)}</select></label>
  ${chartSvg(P)}${P.length?`<div class="pn-wrap"><table class="pn-t"><tr><th>Captura</th><th>Cuota</th></tr>${P.slice(-15).reverse().map(p=>`<tr><td>${fmtT(p[0])}</td><td>${p[1].toFixed(2)}</td></tr>`).join('')}</table></div><p class="pn-note">${P.length} captura${P.length===1?'':'s'}. Variación entre la primera y la última: ${((P[P.length-1][1]/P[0][1]-1)*100).toFixed(1)}%. Aún sin alertas: primero debe acumularse historial.</p>`:''}`:''}`;
  const ex=async fmt=>{$('#pn-exp').textContent='Preparando…';try{const b=await H.exportAll(fmt);dl('radarpi-historial-cuotas-'+new Date().toISOString().slice(0,10)+'.'+fmt,b);$('#pn-exp').textContent='Exportado ('+Math.round(b.size/1024)+' KB).'}catch(e){$('#pn-exp').textContent='Error al exportar: '+e.message}};
  $('#pn-csv').onclick=()=>ex('csv');$('#pn-json').onclick=()=>ex('json');$('#pn-odds-r').onclick=renderOdds;
  const pick=async()=>{HS.snaps=await H.snaps(HS.match);const bs=[...new Set(HS.snaps.map(s=>s.bookmaker))];HS.book=bs.includes(HS.book)?HS.book:bs[0];norm();renderOdds()},
    norm=()=>{const m=[...new Set(HS.snaps.filter(s=>s.bookmaker===HS.book).flatMap(s=>s.rows.map(r=>r[0])))].sort();HS.market=m.includes(HS.market)?HS.market:(m.includes('1X2')?'1X2':m[0]);
      const s=[...new Set(HS.snaps.filter(s=>s.bookmaker===HS.book).flatMap(s=>s.rows.filter(r=>r[0]===HS.market).map(r=>r[1])))].sort();HS.sel=s.includes(HS.sel)?HS.sel:s[0]};
  if($('#pn-m'))$('#pn-m').onchange=e=>{HS.match=e.target.value||null;HS.book=HS.market=HS.sel=null;HS.snaps=[];HS.match?pick():renderOdds()};
  if($('#pn-b'))$('#pn-b').onchange=e=>{HS.book=e.target.value;norm();renderOdds()};if($('#pn-k'))$('#pn-k').onchange=e=>{HS.market=e.target.value;HS.sel=null;norm();renderOdds()};if($('#pn-s'))$('#pn-s').onchange=e=>{HS.sel=e.target.value;renderOdds()}}
// ---------- montaje ----------
function mount(){const root=$('#panel-root');if(!root||root.dataset.m)return;root.dataset.m='1';
  root.innerHTML=`<div class="pn-aviso" role="note">${AVISO}</div>
  <details class="card grp" id="d-perf"><summary>📊 Rendimiento del modelo (solo lectura)</summary><div id="pn-perf"></div></details>
  <details class="card grp" id="d-src"><summary>🛰 Estado de las fuentes</summary><div id="pn-src"></div></details>
  <details class="card grp" id="d-odds"><summary>📈 Historial de cuotas</summary><div id="pn-odds"></div></details>`;
  [['d-perf',renderPerf],['d-src',renderSrc],['d-odds',renderOdds]].forEach(([id,f])=>$('#'+id).addEventListener('toggle',()=>{if($('#'+id).open)f()}))}
window.RadarPanel={perfStats,groupStats,ledgerRows,AVISO,_render:{perf:renderPerf,src:renderSrc,odds:renderOdds}};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
