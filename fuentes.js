/* RadarPi · fuentes.js — fuentes gratuitas (ESPN, football-data.co.uk, football-data.org), papelera con «Deshacer» y copia automática en IndexedDB.
   API-Football se conserva intacta en app.js/corners.js; aquí solo se añaden alternativas y protecciones. */
(()=>{'use strict';
const $=s=>document.querySelector(s),ready=f=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f):f();
const ls=k=>{try{return localStorage.getItem(k)||''}catch{return ''}};
// ---------- IndexedDB clave-valor (una entrada por clave; si IndexedDB falla, memoria) ----------
let db=null;const mem=new Map();
const dbReady=new Promise(res=>{try{if(!window.indexedDB)return res(null);const r=indexedDB.open('radarpi-store',1),to=setTimeout(()=>res(null),4000);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('kv'))r.result.createObjectStore('kv')};
  r.onsuccess=()=>{clearTimeout(to);db=r.result;res(db)};r.onerror=r.onblocked=()=>{clearTimeout(to);res(null)}}catch{res(null)}});
const kvGet=async k=>{await dbReady;if(!db)return mem.get(k);return new Promise(res=>{try{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(undefined)}catch{res(mem.get(k))}})};
const kvSet=async(k,v)=>{mem.set(k,v);await dbReady;if(!db)return false;return new Promise(res=>{try{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res(true);t.onerror=t.onabort=()=>res(false)}catch{res(false)}})};
const cache=async(k,ttl,fn)=>{const h=await kvGet(k);if(h&&ttl>0&&Date.now()-h.t<ttl)return h.v;const v=await fn();await kvSet(k,{t:Date.now(),v});return v};
async function J(u,o={}){let r;try{r=await fetch(u,{...o,signal:AbortSignal.timeout?AbortSignal.timeout(14000):undefined})}catch(e){const x=new Error(e&&e.name==='TimeoutError'?'tiempo agotado':'sin conexión o bloqueado');x.kind='network';throw x}
  if(!r.ok){const x=new Error('HTTP '+r.status);x.kind=r.status===429?'rate':(r.status===401||r.status===403)?'auth':'api';throw x}return r}
const px=u=>{const p=ls('radarpi_proxy').trim();return p?p+encodeURIComponent(u):u};
// ---------- nombres de equipos (para cruzar fuentes) ----------
const ALIAS={'man city':'manchester city','man united':'manchester united','nott m forest':'nottingham forest','nottm forest':'nottingham forest','ath madrid':'atletico madrid','ath bilbao':'athletic','athletic club':'athletic','wolves':'wolverhampton wanderers','tottenham':'tottenham hotspur','sociedad':'real sociedad','betis':'real betis','espanol':'espanyol','vallecano':'rayo vallecano','celta':'celta vigo','inter':'internazionale','inter milan':'internazionale','milan':'ac milan','ein frankfurt':'eintracht frankfurt','m gladbach':'borussia monchengladbach','leverkusen':'bayer leverkusen','dortmund':'borussia dortmund','bayern munich':'bayern munchen','paris sg':'paris saint germain','st etienne':'saint etienne'};
const norm=s=>{const n=String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\b(fc|cf|afc|sc|ac|cd|club|the|calcio|fk)\b/g,' ').replace(/\s+/g,' ').trim();return ALIAS[n]||n};
const same=(a,b)=>{const x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||(x.length>5&&y.length>5&&(x.includes(y)||y.includes(x))))};
// ---------- 1) ESPN: córners en vivo, finalizados e historial (sin llave) ----------
const EB='https://site.api.espn.com/apis/site/v2/sports/soccer/';
async function espnStats(league,ev,ttl){return cache('es_'+league+'_'+ev,ttl??90*864e5,async()=>{const j=await(await J(EB+league+'/summary?event='+ev)).json(),out={t:{},st:j.header?.competitions?.[0]?.status?.type?.state||''};
  for(const t of j.boxscore?.teams||[]){const s=(t.statistics||[]).find(z=>/corner/i.test((z.name||'')+' '+(z.label||''))),v=s&&parseFloat(s.displayValue??s.value);if(t.team?.id!=null&&Number.isFinite(v))out.t[String(t.team.id)]=v}return out})}
const liveCorners=async(league,ev)=>(await espnStats(league,ev,45e3)).t;
const dstr=t=>new Date(t).toISOString().slice(0,10).replace(/-/g,'');
async function leagueResults(league){return cache('er_'+league,6*3600e3,async()=>{const j=await(await J(EB+league+'/scoreboard?limit=400&dates='+dstr(Date.now()-75*864e5)+'-'+dstr(Date.now()))).json();
  return (j.events||[]).map(e=>{const c=e.competitions?.[0],H=c?.competitors?.find(x=>x.homeAway==='home'),A=c?.competitors?.find(x=>x.homeAway==='away');
    return (e.status||c?.status)?.type?.completed&&H&&A?{id:e.id,d:e.date,h:String(H.team?.id),a:String(A.team?.id)}:null}).filter(Boolean)})}
async function history(league,tid,n=5){tid=String(tid);const ev=(await leagueResults(league)).filter(e=>e.h===tid||e.a===tid).sort((x,y)=>new Date(y.d)-new Date(x.d)).slice(0,n+3),rows=[];let miss=0;
  for(const e of ev){if(rows.length>=n)break;let s;try{s=await espnStats(league,e.id)}catch{miss++;continue}const home=e.h===tid,own=s.t[tid],opp=s.t[home?e.a:e.h];
    if(own==null||opp==null){miss++;if(!rows.length&&miss>=2)break;continue}rows.push({f:own,a:opp,h:home?1:0,d:e.d,fid:'espn_'+e.id})}
  return {rows,miss,seen:ev.length,src:'ESPN'}}
// ---------- 2) football-data.co.uk: CSV con córners (HC/AC) de ligas grandes ----------
const DIV={'eng.1':'E0','eng.2':'E1','esp.1':'SP1','ita.1':'I1','ger.1':'D1','fra.1':'F1','ned.1':'N1','por.1':'P1','bel.1':'B1','sco.1':'SC0','tur.1':'T1','gre.1':'G1'};
const season=()=>{const n=new Date(),y=n.getFullYear()%100,a=n.getMonth()>=7?y:(y+99)%100;return String(a).padStart(2,'0')+String((a+1)%100).padStart(2,'0')};
async function fduRows(league){const div=DIV[league];if(!div)return null;return cache('fdu_'+div+season(),12*3600e3,async()=>{
  const L=(await(await J(px('https://www.football-data.co.uk/mmz4281/'+season()+'/'+div+'.csv'))).text()).trim().split(/\r?\n/),H=L[0].split(',').map(s=>s.replace(/^\uFEFF/,'').trim()),ix=n=>H.indexOf(n),out=[];
  for(const l of L.slice(1)){const c=l.split(','),hc=c[ix('HC')],ac=c[ix('AC')];if(!c[ix('HomeTeam')]||hc===''||ac===''||hc==null||ac==null||!Number.isFinite(+hc)||!Number.isFinite(+ac))continue;
    const p=String(c[ix('Date')]).split('/');if(p.length<3)continue;out.push({d:(p[2].length===2?'20'+p[2]:p[2])+'-'+p[1]+'-'+p[0],h:c[ix('HomeTeam')],a:c[ix('AwayTeam')],hc:+hc,ac:+ac})}return out})}
async function fduHistory(league,team,n=5){const R=await fduRows(league);if(!R)return null;
  const rows=R.filter(r=>same(r.h,team)||same(r.a,team)).sort((x,y)=>y.d.localeCompare(x.d)).slice(0,n).map(r=>{const home=same(r.h,team);return {f:home?r.hc:r.ac,a:home?r.ac:r.hc,h:home?1:0,d:r.d}});
  return {rows,miss:0,seen:rows.length,src:'football-data.co.uk'}}
// ---------- 3) football-data.org (gratis, 12 ligas): tabla y resultados; NO trae córners ----------
const FDC={'eng.1':'PL','esp.1':'PD','ita.1':'SA','ger.1':'BL1','fra.1':'FL1','ned.1':'DED','por.1':'PPL','eng.2':'ELC','bra.1':'BSA','uefa.champions':'CL'};
const hasFdorg=()=>!!ls('radarpi_fdorg_key').trim();
async function fdorg(path,ttl=6*3600e3){if(!hasFdorg()){const e=new Error('Falta la llave de football-data.org');e.kind='auth';throw e}
  return cache('fdo_'+path,ttl,async()=>(await J(px('https://api.football-data.org/v4/'+path),{headers:{'X-Auth-Token':ls('radarpi_fdorg_key').trim()}})).json())}
async function tablePos(lg,hn,an){const c=FDC[lg];if(!c||!hasFdorg())return null;const j=await fdorg('competitions/'+c+'/standings'),t=((j.standings||[]).find(s=>s.type==='TOTAL')||{}).table||[];
  const f=n=>{const r=t.find(x=>same(x.team&&x.team.name,n)||same(x.team&&x.team.shortName,n));return r?r.position:null},h=f(hn),a=f(an);return h&&a?{h,a}:null}
// ---------- Papelera con «Deshacer» ----------
const KEYS={picks:'picks',bets:'bets',combipicks:'combipicks',corners:'radarpi_corners_picks_v1'};
function bar(msg,undo){let el=$('#rp-undo');if(el)el.remove();el=document.createElement('div');el.id='rp-undo';el.setAttribute('role','status');
  el.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9999;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;background:#0b2b30;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.35);font:14px system-ui,sans-serif';
  const s=document.createElement('span');s.textContent=msg;el.appendChild(s);
  if(undo){const b=document.createElement('button');b.textContent='Deshacer';b.style.cssText='border:0;border-radius:8px;padding:8px 12px;font-weight:700;background:#7ee0c3;color:#04221f';b.onclick=()=>{el.remove();try{undo()}catch{}};el.appendChild(b)}
  document.body.appendChild(el);setTimeout(()=>el.remove(),10000)}
const Trash={toast:bar,
  async add(kind,label,item,undo){const l=(await kvGet('trash'))||[];l.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2,6),kind,label:String(label||'elemento').slice(0,80),item,t:Date.now()});
    await kvSet('trash',l.filter(x=>Date.now()-x.t<30*864e5).slice(0,80));bar('Borrado: '+String(label||'elemento').slice(0,50),undo)},
  list:async()=>((await kvGet('trash'))||[]).filter(x=>Date.now()-x.t<30*864e5),
  async restore(id){const l=(await kvGet('trash'))||[],it=l.find(x=>x.id===id),k=it&&KEYS[it.kind];if(!k)return false;
    let a=[];try{a=JSON.parse(localStorage.getItem(k)||'[]')}catch{}if(!a.some(x=>x&&x.id===it.item.id))a.push(it.item);
    try{localStorage.setItem(k,JSON.stringify(a))}catch{return false}await kvSet('trash',l.filter(x=>x.id!==id));return true}};
window.RadarTrash=Trash;
// ---------- Copia automática diaria en IndexedDB (7 días) + restauración si localStorage se vacía ----------
const SNAP=['picks','bets','nbapicks','combipicks','radarpi_corners_picks_v1','radarpi_corners_analyses_v1'],cnt=o=>Object.values(o).reduce((n,v)=>{try{return n+JSON.parse(v).length}catch{return n}},0);
const grab=()=>{const o={};for(const k of SNAP){const v=ls(k);if(v)o[k]=v}return o};
async function snapshot(){const now=grab();if(!cnt(now))return;const S=(await kvGet('snaps'))||{},d=new Date().toISOString().slice(0,10);S[d]=now;
  await kvSet('snaps',Object.fromEntries(Object.entries(S).sort().slice(-7)))}
async function checkRestore(){if(cnt(grab()))return;const S=(await kvGet('snaps'))||{},d=Object.keys(S).sort().pop();if(!d||!cnt(S[d]))return;
  if(confirm('No encuentro tus picks ni apuestas en este dispositivo, pero hay una copia automática del '+d+' ('+cnt(S[d])+' registros). ¿Restaurarla?')){try{for(const [k,v] of Object.entries(S[d]))localStorage.setItem(k,v);location.reload()}catch{}}}
// ---------- ajustes ----------
ready(()=>{
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch{}
  setTimeout(()=>{checkRestore().then(snapshot)},2500);setInterval(()=>{if(!document.hidden)snapshot()},10*60e3);
  const st=$('#s-status'),set=t=>{if(st)st.textContent=t};
  if($('#s-fdo')){$('#s-fdo').value=ls('radarpi_fdorg_key');$('#s-px').value=ls('radarpi_proxy');$('#s-afoff').checked=ls('radarpi_af_off')==='1';
    $('#s-save').onclick=()=>{try{localStorage.setItem('radarpi_fdorg_key',$('#s-fdo').value.trim());localStorage.setItem('radarpi_proxy',$('#s-px').value.trim());localStorage.setItem('radarpi_af_off',$('#s-afoff').checked?'1':'0');set('Guardado.')}catch{set('No se pudo guardar.')}};
    $('#s-test').onclick=async()=>{$('#s-save').click();const r=[];set('Probando…');
      try{const j=await(await J(EB+'eng.1/scoreboard')).json();r.push('ESPN ✓ ('+(j.events||[]).length+' partidos hoy)')}catch(e){r.push('ESPN ✗ '+e.message)}
      try{const x=await fduRows('eng.1');r.push('football-data.co.uk ✓ ('+x.length+' partidos con córners)')}catch(e){r.push('football-data.co.uk ✗ '+e.message+' (si es bloqueo/CORS, usa un proxy propio)')}
      if(hasFdorg()){try{await fdorg('competitions/PL/standings',0);r.push('football-data.org ✓')}catch(e){r.push('football-data.org ✗ '+e.message)}}else r.push('football-data.org: sin llave');
      set(r.join(' · '))}}
  const tc=$('#trash-card');if(tc)tc.addEventListener('toggle',async()=>{if(!tc.open)return;const box=$('#trash-list'),l=await Trash.list();
    box.innerHTML=l.length?l.map(x=>'<div class="tools"><span class="status">'+x.kind+' · '+x.label.replace(/[<&]/g,' ')+' · '+new Date(x.t).toLocaleDateString('es')+'</span><button class="btn s" data-r="'+x.id+'" type="button">Restaurar</button></div>').join(''):'<p class="status">La papelera está vacía.</p>';
    box.querySelectorAll('[data-r]').forEach(b=>b.onclick=async()=>{if(await Trash.restore(b.dataset.r)){b.textContent='Restaurado ✓';setTimeout(()=>location.reload(),600)}else b.textContent='No se pudo'})})});
window.RadarSrc={espnStats,liveCorners,history,fduHistory,fduRows,fdorg,hasFdorg,tablePos,same,kvGet,kvSet};
})();
