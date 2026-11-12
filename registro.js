/* RadarPi · registro.js — registro auditable de picks, solo-añadir y encadenado con SHA-256.
   Cada evento guarda el hash del anterior: si alguien edita o borra uno, verify() lo detecta.
   Es "a prueba de manipulación visible", no "imposible de manipular": quien borre los datos del navegador borra también el registro (por eso existe «Exportar»). */
(()=>{'use strict';
const MODEL_VERSION='radarpi-js-poisson-v4',FEATURE_SET='fs1-forma+mercado+contraste';
const $=s=>document.querySelector(s),num=x=>Number.isFinite(+x)&&x!==null&&x!==''?+x:null,r4=x=>x==null?null:Math.round(x*1e4)/1e4;
const canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(x=>[x,v[x]])):v);
async function sha(s){try{if(crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch{}
  let h=0x811c9dc5;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return 'weak-'+h.toString(16)}
// ---- almacenamiento: IndexedDB (solo add/getAll; no se expone put ni delete) con respaldo en memoria ----
let persistent=true;const memEv=[];
const dbp=new Promise(res=>{try{if(!window.indexedDB){persistent=false;return res(null)}const r=indexedDB.open('radarpi-ledger',1),to=setTimeout(()=>{persistent=false;res(null)},4000);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('events'))r.result.createObjectStore('events',{keyPath:'seq',autoIncrement:true})};
  r.onsuccess=()=>{clearTimeout(to);res(r.result)};r.onerror=r.onblocked=()=>{clearTimeout(to);persistent=false;res(null)}}catch{persistent=false;res(null)}});
async function all(){const db=await dbp;if(!db)return memEv.slice();return new Promise(res=>{try{const q=db.transaction('events').objectStore('events').getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>res([])}catch{res([])}})}
async function put(ev){const db=await dbp;if(!db){ev.seq=memEv.length+1;memEv.push(ev);return}await new Promise(res=>{try{const t=db.transaction('events','readwrite');t.objectStore('events').add(ev);t.oncomplete=res;t.onerror=t.onabort=res}catch{res()}})}
// ---- cadena ----
let chain=Promise.resolve(),last=null,state=null;
const ready=(async()=>{const E=await all();last=E.length?E[E.length-1].hash:'GENESIS';state=new Map();
  for(const e of E){const s=state.get(e.pick_id)||{};if(e.type==='pick'){s.q=e.data.odds_pick;s.qc=e.data.odds_close;s.res=null;s.gone=false}else if(e.type==='odds_update')s.q=e.data.odds_pick;else if(e.type==='close')s.qc=e.data.odds_close;else if(e.type==='result')s.res=e.data.result;else if(e.type==='removed')s.gone=true;state.set(e.pick_id,s)}})();
const append=(type,pick_id,data)=>chain=chain.then(async()=>{await ready;const ev={type,pick_id,ts:new Date().toISOString(),data,prev_hash:last};ev.hash=await sha(last+canon({type,pick_id,ts:ev.ts,data}));await put(ev);last=ev.hash}).catch(()=>{});
// ---- construcción del registro (null = missing; nada se inventa) ----
function rec(module,o){const ev=o.p_final!=null&&o.odds_pick>1?o.p_final*o.odds_pick-1:null,
  d={module,model_version:MODEL_VERSION,feature_set_version:FEATURE_SET,market:o.market,selection:o.selection,league:o.league||null,match:o.match||null,kickoff:o.kickoff||null,
  p_raw:o.p_raw,p_market_implied:o.odds_pick>1?r4(1/o.odds_pick):null,p_devig:o.p_devig,p_calibrated:o.p_calibrated,p_final:o.p_final,p_ensemble:null,
  odds_open:null,odds_pick:o.odds_pick,odds_close:o.odds_close,ts_pick:o.ts_pick||null,
  edge:o.p_final!=null&&o.p_devig!=null?r4(o.p_final-o.p_devig):null,ev:r4(ev),kelly_full:ev!=null&&ev>0?r4(ev/(o.odds_pick-1)):(ev!=null?0:null),
  stake:o.stake,data_source:o.data_source||null,backfilled:!!o.backfilled,
  backend_model_version:o.bk?o.bk.model_version:null,backend_params_sha:o.bk?o.bk.params_sha:null,p_backend_raw:o.bk?r4(o.bk.p_raw):null,p_backend_calibrated:o.bk?r4(o.bk.p_calibrated):null,backend_calib_level:o.bk?o.bk.calib_level:null,
  clv_price:null,ev_vs_close:null};
  d.missing=Object.keys(d).filter(k=>d[k]===null);return d}
const fut=k=>rec('futbol',{market:k.mk,selection:k.mk,league:k.liga,match:k.m,kickoff:k.ko,p_raw:r4(num(k.pm)),p_devig:r4(num(k.pf)),p_calibrated:r4(num(k.pc)),p_final:r4(num(k.pc!=null?k.pc:k.p)),odds_pick:num(k.q),odds_close:num(k.qc),ts_pick:k.savedAt,stake:num(k.stake!=null?k.stake:k.s),data_source:k.fc,bk:k.bk});
const cor=k=>rec('corners',{market:k.market,selection:k.side&&k.line!=null?k.side+' '+k.line:k.market,league:k.league,match:k.match,kickoff:k.ko,p_raw:r4(num(k.pModel)),p_devig:r4(num(k.pMarket)),p_calibrated:null,p_final:r4(num(k.prob)),odds_pick:num(k.odd),odds_close:null,ts_pick:k.created||k.savedAt||null,stake:num(k.stake),data_source:k.fh});
const nba=k=>rec('nba',{market:k.st||(k.meta&&k.meta.stat)||'NBA',selection:k.t,league:'NBA',match:k.t,kickoff:k.ko,p_raw:null,p_devig:null,p_calibrated:null,p_final:r4(num(k.p)),odds_pick:num(k.q),odds_close:null,ts_pick:null,stake:num(k.sk!=null?k.sk:k.stake),data_source:null});
const cmb=k=>rec('combi',{market:'Combinada',selection:k.key,league:(k.legs||[]).length&&k.legs.every(l=>l.league==='NBA')?'NBA':'Mixto',match:(k.legs||[]).map(l=>l.market).join(' + '),kickoff:null,p_raw:null,p_devig:null,p_calibrated:null,p_final:r4(num(k.p)),odds_pick:num(k.q),odds_close:null,ts_pick:k.created||null,stake:num(k.stake),data_source:null});
const rd=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
async function sync(){await ready;const cur=new Map();
  for(const k of rd('picks'))cur.set('f:'+k.id,[k,fut(k),k.res,k.qc]);for(const k of rd('radarpi_corners_picks_v1'))cur.set('c:'+k.id,[k,cor(k),k.res,null]);
  for(const k of rd('nbapicks'))cur.set('n:'+k.id,[k,nba(k),k.res,null]);for(const k of rd('combipicks'))cur.set('b:'+k.id,[k,cmb(k),k.res,null]);
  for(const [id,[k,d,res,qc]] of cur){const s=state.get(id);
    if(!s){d.backfilled=true;d.data_snapshot_id=(await sha(canon({id,p_raw:d.p_raw,p_devig:d.p_devig,odds:d.odds_pick,src:d.data_source}))).slice(0,12);append('pick',id,d);state.set(id,{q:d.odds_pick,qc:d.odds_close,res:null,gone:false});if(res)append('result',id,{result:res}),state.get(id).res=res;continue}
    if(d.odds_pick!=null&&d.odds_pick!==s.q){append('odds_update',id,{odds_pick:d.odds_pick});s.q=d.odds_pick}
    if(d.odds_close!=null&&d.odds_close!==s.qc){append('close',id,{odds_close:d.odds_close,clv_price:s.q>1?r4(s.q/d.odds_close-1):null,ev_vs_close:null});s.qc=d.odds_close}
    if(res&&res!==s.res){append('result',id,{result:res});s.res=res}}
  for(const [id,s] of state)if(!cur.has(id)&&!s.gone){append('removed',id,{note:'el pick desapareció de la app; el registro lo conserva'});s.gone=true}
  await chain}
async function verify(){const E=await all();let prev='GENESIS';for(const e of E){if(e.prev_hash!==prev)return{ok:false,n:E.length,bad:e.seq,why:'cadena rota'};
  const h=await sha(prev+canon({type:e.type,pick_id:e.pick_id,ts:e.ts,data:e.data}));if(h!==e.hash)return{ok:false,n:E.length,bad:e.seq,why:'contenido alterado'};prev=e.hash}return{ok:true,n:E.length,head:prev.slice(0,12),persistent}}
async function snapshotRows(){const E=await all(),M=new Map();for(const e of E){const r=M.get(e.pick_id)||{pick_id:e.pick_id};if(e.type==='pick')Object.assign(r,e.data,{ts_logged:e.ts});else if(e.type==='odds_update')Object.assign(r,e.data);else if(e.type==='close')Object.assign(r,e.data,{ts_close:e.ts,clv_price:e.data.clv_price!=null&&r.odds_pick>1&&e.data.odds_close>1?r4(r.odds_pick/e.data.odds_close-1):null});else if(e.type==='result')Object.assign(r,e.data,{ts_result:e.ts});else if(e.type==='removed')r.removed_at=e.ts;M.set(e.pick_id,r)}return[...M.values()]}
function dl(name,mime,txt){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:mime}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
async function exportJSON(){await sync();const E=await all();dl('radarpi-registro-'+new Date().toISOString().slice(0,10)+'.json','application/json',JSON.stringify({model_version:MODEL_VERSION,feature_set_version:FEATURE_SET,head:(await verify()).head,events:E}))}
async function exportCSV(){await sync();const R=await snapshotRows(),cols=[...new Set(R.flatMap(r=>Object.keys(r)))].filter(c=>c!=='missing');
  dl('radarpi-picks-'+new Date().toISOString().slice(0,10)+'.csv','text/csv',[cols.join(','),...R.map(r=>cols.map(c=>{const v=r[c];return v==null?'':'"'+String(v).replace(/"/g,'""')+'"'}).join(','))].join('\n'))}
window.RadarLedger={sync,verify,exportJSON,exportCSV,all,MODEL_VERSION,FEATURE_SET};
const init=()=>{const st=$('#led-status'),set=t=>{if(st)st.textContent=t};
  if($('#led-verify'))$('#led-verify').onclick=async()=>{set('Verificando…');await sync();const v=await verify();set(v.ok?'✓ Cadena íntegra · '+v.n+' eventos · huella '+v.head+(v.persistent?'':' · ⚠ sin IndexedDB: solo en memoria'):'✗ '+v.why+' en el evento '+v.bad)};
  if($('#led-json'))$('#led-json').onclick=()=>exportJSON();if($('#led-csv'))$('#led-csv').onclick=()=>exportCSV();
  setTimeout(sync,3500);setInterval(()=>{if(!document.hidden)sync()},30000);document.addEventListener('visibilitychange',()=>{if(document.hidden)sync()})};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
