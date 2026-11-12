/* RadarPi · monitor.js — SOLO OBSERVA. No cambia peticiones, respuestas, cuotas ni decisiones.
   1) Estado de las fuentes: cuenta llamadas, último éxito, último error, límites y pausas.
   2) Historial de cuotas: guarda una captura por partido y casa cada vez que la app descarga cuotas (IndexedDB, acumulativo).
   Debe cargarse ANTES que el resto de scripts para ver todas las llamadas. */
(()=>{'use strict';
const APP_VERSION='radarpi-9.1-panel',LSK='radarpi_mon_v1';
const lsj=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const dayK=(t=Date.now())=>new Date(t).toISOString().slice(0,10);
// ---------- servicios conocidos ----------
const SVC={
  oddspapi:{n:'OddsPapi · cuotas de Fútbol',cap:{per:'mes',n:250,nota:'plan gratis según la app; es un estimado: cuenta solo llamadas hechas desde este dispositivo'}},
  oddsapi:{n:'The Odds API · cuotas de Córners y NBA',cap:{per:'mes',n:500,nota:'plan gratis habitual; si el servidor informa su contador, se muestra ese'}},
  apifootball:{n:'API-Football',cap:{per:'día',n:100,nota:'plan gratis habitual; cuenta solo llamadas de este dispositivo (la llave puede usarse en otros sitios)'}},
  espn:{n:'ESPN · partidos y estadísticas',cap:null,own:{host:'site.api.espn.com',n:900}},
  fdu:{n:'football-data.co.uk · CSV históricos',cap:null,own:{host:'www.football-data.co.uk',n:60}},
  fdorg:{n:'football-data.org · tablas',cap:null,own:{host:'api.football-data.org',n:200}},
  balldontlie:{n:'balldontlie · NBA',cap:null},sportsgameodds:{n:'SportsGameOdds · NBA',cap:null},nbaapi:{n:'API-Sports NBA',cap:null},
  brave:{n:'Brave Search',cap:null},groq:{n:'Groq (IA)',cap:null},openrouter:{n:'OpenRouter (IA)',cap:null},gemini:{n:'Gemini (IA)',cap:null},
  proxy_publico:{n:'Proxy público (CORS)',cap:null},proxy_propio:{n:'Tu proxy de Cloudflare',cap:null}};
const HOST={'api.oddspapi.io':'oddspapi','api.the-odds-api.com':'oddsapi','v3.football.api-sports.io':'apifootball','site.api.espn.com':'espn','site.web.api.espn.com':'espn',
  'www.football-data.co.uk':'fdu','api.football-data.org':'fdorg','api.balldontlie.io':'balldontlie','api.sportsgameodds.com':'sportsgameodds','v2.nba.api-sports.io':'nbaapi',
  'api.search.brave.com':'brave','api.groq.com':'groq','openrouter.ai':'openrouter','generativelanguage.googleapis.com':'gemini','corsproxy.io':'proxy_publico','api.allorigins.win':'proxy_publico'};
function classify(url){try{const u=new URL(url,location.href);let h=u.hostname;
  if(h.endsWith('.workers.dev')){const t=u.searchParams.get('u');if(t){try{h=new URL(t).hostname}catch{}}else return 'proxy_propio'}
  return HOST[h]||null}catch{return null}}
// ---------- estado persistente (pequeño) ----------
let S=lsj(LSK)||{};let dirty=false,saveT=0;
const st=id=>S[id]||(S[id]={calls:{},ok:null,err:null,lim:null,hdr:null});
function save(){dirty=true;if(saveT)return;saveT=setTimeout(()=>{saveT=0;if(!dirty)return;dirty=false;try{
  const cut=dayK(Date.now()-62*864e5);for(const v of Object.values(S))for(const d of Object.keys(v.calls))if(d<cut)delete v.calls[d];localStorage.setItem(LSK,JSON.stringify(S))}catch{}},1500)}
function note(id,kind,status,msg){const s=st(id),t=Date.now();msg=String(msg||'').replace(/\s+/g,' ').slice(0,180);
  if(kind==='ok'){s.ok={t};return}
  const e={t,status,msg};s.err=e;if(kind==='limit')s.lim=e}
function record(id,res,err,url){const s=st(id),d=dayK();s.calls[d]=(s.calls[d]||0)+1;save();
  if(err){note(id,'err',0,'sin conexión o bloqueado: '+(err&&err.message||err));return}
  const h=k=>{try{return res.headers.get(k)}catch{return null}};
  if(id==='oddsapi'){const r=h('x-requests-remaining'),u=h('x-requests-used');if(r!=null||u!=null){s.hdr={t:Date.now(),remaining:r==null?null:+r,used:u==null?null:+u}}}
  if(id==='apifootball'){const r=h('x-ratelimit-requests-remaining'),l=h('x-ratelimit-requests-limit');if(r!=null){s.hdr={t:Date.now(),remaining:+r,limit:l==null?null:+l}}}
  if(res.ok){
    if(id==='apifootball'){res.clone().text().then(t=>{try{const j=JSON.parse(t),er=j&&j.errors,bad=er&&(Array.isArray(er)?er.length:Object.keys(er).length);
      if(bad){const m=JSON.stringify(er);note(id,/limit|quota|request|rate/i.test(m)?'limit':'err',200,m)}else note(id,'ok')}catch{note(id,'ok')}}).catch(()=>note(id,'ok'));return}
    note(id,'ok');return}
  const kind=(res.status===429||res.status===402)?'limit':'err';note(id,kind,res.status,'HTTP '+res.status);
  res.clone().text().then(t=>{const s2=st(id);if(s2.err&&s2.err.status===res.status&&Date.now()-s2.err.t<5000){s2.err.msg=('HTTP '+res.status+' '+t).replace(/\s+/g,' ').slice(0,180);if(s2.lim&&s2.lim.t===s2.err.t)s2.lim.msg=s2.err.msg;save()}}).catch(()=>{})}
// ---------- estado calculado para el panel ----------
function paused(id){const out=[],ls=k=>{try{return localStorage.getItem(k)}catch{return null}};
  if(id==='apifootball'&&ls('radarpi_af_off')==='1')out.push('Pausada por ti en Ajustes → «Pausar API-Football».');
  const own=SVC[id]&&SVC[id].own;if(own){const cd=+ls('radarpi_cool_'+own.host);if(cd>Date.now())out.push('Pausa automática de seguridad hasta las '+new Date(cd).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})+' (el servidor respondió 429/403).')}
  return out}
function usageOwn(id){const o=SVC[id]&&SVC[id].own;if(!o)return null;const u=lsj('radarpi_use')||{};return u.d===dayK()?(u[o.host]||0):0}
function status(id){const s=st(id),sv=SVC[id],today=dayK(),mo=today.slice(0,7);let used=s.calls[today]||0,month=0;for(const [d,n] of Object.entries(s.calls))if(d.slice(0,7)===mo)month+=n;
  const pz=paused(id),own=usageOwn(id),cap=sv.cap;let quota=null;
  if(cap){const u=cap.per==='mes'?month:used,h=s.hdr;
    if(h&&h.remaining!=null)quota={fuente:'servidor',usada:h.used!=null?h.used:(h.limit!=null?h.limit-h.remaining:null),limite:h.limit!=null?h.limit:(h.used!=null?h.used+h.remaining:null),restante:h.remaining,per:cap.per,t:h.t,nota:'dato informado por el servidor'};
    else quota={fuente:'estimado',usada:u,limite:cap.n,restante:Math.max(0,cap.n-u),per:cap.per,nota:cap.nota}}
  else if(own!=null)quota={fuente:'limite propio',usada:own,limite:sv.own.n,restante:Math.max(0,sv.own.n-own),per:'día',nota:'límite propio de RadarPi para sus llamadas gratuitas; el servicio no publica una cuota oficial'};
  const hdr0=s.hdr&&s.hdr.remaining===0,capHit=quota&&quota.fuente!=='servidor'&&quota.restante===0,recentLim=s.lim&&(!s.ok||s.lim.t>=s.ok.t);
  let state;if(pz.length)state='pausado';else if(hdr0||capHit||recentLim)state='limite';else if(s.err&&(!s.ok||s.err.t>s.ok.t))state='error';else if(!s.ok&&!used&&!month)state='sin_datos';else if(!s.ok)state='sin_datos';else state='ok';
  return{id,nombre:sv.n,estado:state,hoy:used,mes:month,cuota:quota,ultimo_ok:s.ok?s.ok.t:null,ultimo_error:s.err||null,pausas:pz}}
// ---------- historial de cuotas (IndexedDB) ----------
let db=null,persistent=true;const mem={snaps:[],matches:new Map(),scans:new Map()};
const dbp=new Promise(res=>{try{if(!window.indexedDB){persistent=false;return res(null)}const r=indexedDB.open('radarpi-odds',1),to=setTimeout(()=>{persistent=false;res(null)},4000);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('snaps')){const s=d.createObjectStore('snaps',{keyPath:'id',autoIncrement:true});s.createIndex('match','match_id')}
    if(!d.objectStoreNames.contains('matches'))d.createObjectStore('matches',{keyPath:'match_id'});if(!d.objectStoreNames.contains('scans'))d.createObjectStore('scans',{keyPath:'scan_id'})};
  r.onsuccess=()=>{clearTimeout(to);db=r.result;res(db)};r.onerror=r.onblocked=()=>{clearTimeout(to);persistent=false;res(null)}}catch{persistent=false;res(null)}});
const rq=r=>new Promise(ok=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(undefined)});
let scan=null;
function scanId(source){const n=Date.now();if(!scan||scan.source!==source||n-scan.last>120000)scan={id:n.toString(36)+'-'+source,source,start:n,last:n,n_snaps:0,n_rows:0};scan.last=n;return scan}
async function addSnaps(list){if(!list.length)return;const sc=scanId(list[0].source),now=new Date().toISOString();
  for(const s of list){s.captured_at=now;s.app_version=APP_VERSION;s.scan_id=sc.id;sc.n_snaps++;sc.n_rows+=s.rows.length}
  const meta=l=>{const m={};for(const s of l){const x=m[s.match_id]||(m[s.match_id]={match_id:s.match_id,home:s.home,away:s.away,kickoff:s.kickoff,source:s.source,league:s.league||null,books:[],first_seen:s.captured_at,last_seen:s.captured_at,n_snaps:0});if(!x.books.includes(s.bookmaker))x.books.push(s.bookmaker);x.last_seen=s.captured_at;x.n_snaps++}return m};
  const M=meta(list),screc={scan_id:sc.id,source:sc.source,started_at:new Date(sc.start).toISOString(),last_at:now,n_snaps:sc.n_snaps,n_rows:sc.n_rows,app_version:APP_VERSION};
  await dbp;
  if(!db){for(const s of list){s.id=mem.snaps.length+1;mem.snaps.push(s)}for(const [k,v] of Object.entries(M)){const o=mem.matches.get(k);if(o){v.first_seen=o.first_seen;v.n_snaps+=o.n_snaps;v.books=[...new Set([...o.books,...v.books])]}mem.matches.set(k,v)}mem.scans.set(screc.scan_id,screc);return}
  await new Promise(done=>{try{const t=db.transaction(['snaps','matches','scans'],'readwrite'),S1=t.objectStore('snaps'),S2=t.objectStore('matches'),S3=t.objectStore('scans');
    for(const s of list)S1.add(s);S3.put(screc);
    for(const [k,v] of Object.entries(M)){const g=S2.get(k);g.onsuccess=()=>{const o=g.result;if(o){v.first_seen=o.first_seen;v.n_snaps+=o.n_snaps;v.books=[...new Set([...(o.books||[]),...v.books])]}S2.put(v)}}
    t.oncomplete=done;t.onerror=t.onabort=done}catch{done()}})}
const H={persistent:()=>persistent,
  async matches(){await dbp;if(!db)return[...mem.matches.values()];return await rq(db.transaction('matches').objectStore('matches').getAll())||[]},
  async snaps(id){await dbp;if(!db)return mem.snaps.filter(s=>s.match_id===id);return await rq(db.transaction('snaps').objectStore('snaps').index('match').getAll(id))||[]},
  async counts(){await dbp;if(!db)return{snaps:mem.snaps.length,matches:mem.matches.size,scans:mem.scans.size,rows:mem.snaps.reduce((a,s)=>a+s.rows.length,0)};
    const t=db.transaction(['snaps','matches','scans']),n=await Promise.all([rq(t.objectStore('snaps').count()),rq(t.objectStore('matches').count()),rq(t.objectStore('scans').count())]);
    const sc=await rq(db.transaction('scans').objectStore('scans').getAll())||[];return{snaps:n[0],matches:n[1],scans:n[2],rows:sc.reduce((a,x)=>a+(x.n_rows||0),0)}},
  async clear(){await dbp;mem.snaps.length=0;mem.matches.clear();mem.scans.clear();scan=null;if(!db)return;await new Promise(done=>{try{const t=db.transaction(['snaps','matches','scans'],'readwrite');['snaps','matches','scans'].forEach(n=>t.objectStore(n).clear());t.oncomplete=done;t.onerror=t.onabort=done}catch{done()}})},
  async first(){const m=await H.matches();return m.reduce((a,x)=>!a||x.first_seen<a?x.first_seen:a,null)},
  async exportAll(fmt){await dbp;const parts=[],head=['match_id','bookmaker','market','selection','odds','captured_at','source','app_version','scan_id','home','away','kickoff'],q=v=>v==null?'':'"'+String(v).replace(/"/g,'""')+'"';
    if(fmt==='csv')parts.push(head.join(',')+'\n');else parts.push('[');let first=true;
    const flat=s=>s.rows.map(r=>({match_id:s.match_id,bookmaker:s.bookmaker,market:r[0],selection:r[1],odds:r[2],captured_at:s.captured_at,source:s.source,app_version:s.app_version,scan_id:s.scan_id,home:s.home,away:s.away,kickoff:s.kickoff}));
    const emit=s=>{for(const o of flat(s)){if(fmt==='csv')parts.push(head.map(h=>q(o[h])).join(',')+'\n');else{parts.push((first?'':',')+JSON.stringify(o));first=false}}};
    if(!db)mem.snaps.forEach(emit);else await new Promise(done=>{const c=db.transaction('snaps').objectStore('snaps').openCursor();c.onsuccess=()=>{const cur=c.result;if(!cur)return done();emit(cur.value);cur.continue()};c.onerror=()=>done()});
    if(fmt!=='csv')parts.push(']');return new Blob(parts,{type:fmt==='csv'?'text/csv':'application/json'})}};
// ---------- lectura de cuotas de las respuestas (sobre una COPIA; la app recibe la respuesta original intacta) ----------
function split(n){let m;
  if(m=/^(.*?)(Over|Under) ([\d.]+)$/.exec(n))return[(m[1].trim()||'Goles')+' O/U '+m[3],m[2]];
  if(/^(Local gana|Empate|Visitante gana)$/.test(n))return['1X2',n];
  if(m=/^Ambos marcan: (sí|no)(?: \((.+)\))?$/.exec(n))return['Ambos marcan'+(m[2]?' ('+m[2]+')':''),m[1]==='sí'?'Sí':'No'];
  if(m=/^Doble oportunidad (.+)$/.exec(n))return['Doble oportunidad',m[1]];return['Otros',n]}
const nz=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
async function tapOddsPapi(res,url){const bm=new URL(url,location.href).searchParams.get('bookmaker'),arr=await res.json(),MK=(lsj('opmk_v6')||{}).v,P=(lsj('oppart')||{}).v;
  if(!Array.isArray(arr)||!bm||!MK||!P){H.skipped=(H.skipped||0)+1;return}
  const inv={};for(const [n,k] of Object.entries(MK))inv[k]=n;const out=[];
  for(const f of arr){const b=f.bookmakerOdds&&f.bookmakerOdds[bm];if(!b)continue;const h=P[f.participant1Id],w=P[f.participant2Id];if(!h||!w)continue;const rows=[];
    for(const [mid,m] of Object.entries(b.markets||{}))for(const [oid,o] of Object.entries(m.outcomes||{})){const nm=inv[mid+'_'+oid];if(!nm)continue;const pl=o.players&&o.players['0'];if(!pl||pl.active===false||!(pl.price>1))continue;const [mk,sel]=split(nm);rows.push([mk,sel,+pl.price])}
    if(rows.length)out.push({match_id:'op:'+nz(h)+'|'+nz(w)+'|'+String(f.startTime||'').slice(0,10),source:'oddspapi',bookmaker:bm,home:h,away:w,kickoff:f.startTime||null,league:null,rows})}
  await addSnaps(out)}
async function tapOddsApi(res){const j=await res.json(),list=Array.isArray(j)?j:(j&&j.bookmakers?[j]:[]),out=[];
  for(const e of list)for(const b of e.bookmakers||[]){const rows=[];for(const m of b.markets||[]){if(/^(player|batter|pitcher)_/.test(m.key)&&localStorage.getItem('radarpi_hist_props')!=='1')continue;for(const o of m.outcomes||[]){if(!(o.price>1))continue;
    rows.push([m.key,[o.description,o.name,o.point!=null?o.point:null].filter(x=>x!=null&&x!=='').join(' '),+o.price])}}
    if(rows.length)out.push({match_id:'oa:'+e.id,source:'the-odds-api',bookmaker:b.key,home:e.home_team,away:e.away_team,kickoff:e.commence_time,league:e.sport_key||null,source_updated_at:b.last_update||null,rows})}
  await addSnaps(out)}
// ---------- envoltorio de fetch: transparente ----------
const orig=window.fetch&&window.fetch.bind(window);
if(orig)window.fetch=function(input,init){let url='';try{url=typeof input==='string'?input:(input&&input.url)||String(input)}catch{}
  const id=classify(url);if(!id)return orig(input,init);
  return orig(input,init).then(res=>{try{record(id,res,null,url);
    if(res.ok&&id==='oddspapi'&&/\/odds-by-tournaments/.test(url))tapOddsPapi(res.clone(),url).catch(()=>{});
    else if(res.ok&&id==='oddsapi'&&/\/odds(\?|$)/.test(url))tapOddsApi(res.clone()).catch(()=>{})}catch{}return res},
    err=>{try{record(id,null,err,url)}catch{}throw err})};
window.RadarMon={APP_VERSION,SVC,status,ids:()=>Object.keys(SVC),history:H,classify,_split:split,_addSnaps:addSnaps};
})();
