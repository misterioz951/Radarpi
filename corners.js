/* RadarPi · Picks Especiales de Córners · motor v2
   Cambios del motor: promedios a favor Y en contra con peso a lo reciente y recorte hacia el promedio de liga, distribución binomial negativa
   (los córners varían más que un Poisson), probabilidad anclada a la cuota del mercado (sin margen), mercados Over y Under, y modelo en vivo
   que solo calcula lo que FALTA (los córners ya ocurridos no son aleatorios). */
(()=>{'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const K={picks:'radarpi_corners_picks_v1',an:'radarpi_corners_analyses_v1',cache:'radarpi_corners_cache_v3',odds:'radarpi_corners_oddsapi_key',af:'radarpi_corners_afkey',use:'radarpi_corners_af_usage'};
const KEY=K.picks,CACHE=K.cache,ODKEY=K.odds;
let mode='pre',busy=false,diag={reqs:0,issues:[]},lastResults=[],modelHost=null,mtab='res';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const cfgRead=()=>{try{return JSON.parse(localStorage.getItem('cfg')||'{}')}catch{return {}}};
const ownKey=()=>String(localStorage.getItem(K.af)||'').trim();
const getAF=()=>ownKey()||String(cfgRead().af||'').trim(),getOddsKey=()=>String(localStorage.getItem(ODKEY)||'').trim();
const picks=()=>read(K.picks,[]),savePicks=a=>write(K.picks,a),analyses=()=>read(K.an,[]);
const pct=x=>Math.round(x*100),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\b(fc|cf|afc|sc|ac|cd|club|the)\b/g,' ').replace(/\s+/g,' ').trim();
const similar=(a,b)=>{const A=norm(a).split(' ').filter(Boolean),B=norm(b).split(' ').filter(Boolean);if(!A.length||!B.length)return false;const n=A.filter(x=>B.some(y=>x===y||(x.length>3&&y.startsWith(x))||(y.length>3&&x.startsWith(y)))).length;return n/Math.min(A.length,B.length)>=.67};
const dateKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
async function fetchJSON(url,opts={},label='Proveedor'){const r=await fetch(url,{...opts,signal:AbortSignal.timeout?AbortSignal.timeout(14000):undefined});let j;try{j=await r.json()}catch{throw Error(label+': respuesta no JSON')};if(!r.ok)throw Error(label+' HTTP '+r.status+(j.message?': '+j.message:''));return {data:j,headers:r.headers};}

// ---------- parámetros del motor ----------
const MINODD=1.5,MAXODD=2.3,MINP=.55,MINEDGE=.03,MAXGAP=.15,W=.5,HN=5,SCANCAP=45;
const BASE={h:5.4,a:4.6,per:5.0};            // promedio de córners por equipo (local, visitante, genérico)
const PHI={total:1.3,team:1.2};              // sobredispersión: varianza = media × φ
const KIND={total:'córners totales',home:'córners del local',away:'córners del visitante'};

// ---------- errores y diagnóstico ----------
const HINT={auth:'La llave no es válida o no tiene acceso: revisa que esté completa, sin espacios, y que la cuenta esté activa.',plan:'Tu plan no incluye ese recurso (por ejemplo cuotas, esa liga o esa temporada).',limit:'Se alcanzó el límite de solicitudes: espera a mañana, usa otra llave o baja el número de partidos.',rate:'Demasiadas solicitudes por minuto: espera un minuto y vuelve a intentar.',scancap:'Tope de solicitudes de este escaneo: lo ya consultado queda guardado y el siguiente escaneo continúa.',nostats:'La liga o los partidos no publican estadísticas de córners.',noodds:'Ningún proveedor publica cuotas de córners para este partido (o tu plan no las incluye).',network:'Sin conexión o bloqueo del navegador: reintenta.',api:'La API devolvió un error: mira el detalle.'};
const ICON={auth:'🔑',plan:'🔒',limit:'⛔',rate:'⏱',scancap:'⏸',nostats:'◔',noodds:'¤',network:'📡',api:'⚠'};
const mkErr=(kind,msg,extra)=>Object.assign(new Error(msg),{kind},extra||{});
const issue=(match,stage,e)=>{diag.issues.push({match,stage,kind:e.kind||'api',msg:String(e.message||e).slice(0,200)})};
const todayK=()=>dateKey(Date.now());

// ---------- contador de solicitudes (por llave) ----------
function counter(){const own=!!ownKey(),k=own?K.use:'afUsed',u=read(k,{d:'',n:0});return {k,own,u:u.d===todayK()?u:{d:todayK(),n:0}}}
const dailyCap=()=>ownKey()?95:80;           // con la llave general se deja margen al resto de la app
function bump(){const {k,u}=counter();write(k,{d:u.d,n:u.n+1})}

// ---------- API-Football ----------
const AFBASE='https://v3.football.api-sports.io/';
async function http(url,opts,label){let r;try{r=await fetch(url,{...opts,signal:AbortSignal.timeout?AbortSignal.timeout(15000):undefined})}catch(e){throw mkErr('network',label+': '+(e&&e.name==='TimeoutError'?'tiempo agotado':'sin conexión o bloqueado por el navegador'))}let j=null;try{j=await r.json()}catch{}return {r,j}}
async function af(path,params={},opts={}){
  const key=getAF();if(!key)throw mkErr('auth','Falta la llave de API-Football (guárdala en este módulo o en Ajustes).');
  if(!opts.free){const {u}=counter();if(u.n>=dailyCap())throw mkErr('limit','Límite propio de '+dailyCap()+' solicitudes por día alcanzado (llevas '+u.n+').');if(diag.reqs>=SCANCAP)throw mkErr('scancap','Tope de '+SCANCAP+' solicitudes por escaneo alcanzado.')}
  const u=new URL(AFBASE+path);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const {r,j}=await http(u,{headers:{'x-apisports-key':key}},'API-Football');
  if(!opts.free){bump();diag.reqs=(diag.reqs||0)+1}
  const rem=r.headers&&r.headers.get&&r.headers.get('x-ratelimit-requests-remaining'),lim=r.headers&&r.headers.get&&r.headers.get('x-ratelimit-requests-limit');
  if(rem!=null&&rem!==''&&!isNaN(+rem)){diag.afRemaining=+rem;diag.afLimitDay=+lim}
  if(r.status===401||r.status===403)throw mkErr('auth','API-Football rechazó la llave (HTTP '+r.status+').');
  if(r.status===429)throw mkErr('rate','API-Football: demasiadas solicitudes seguidas (HTTP 429).');
  if(!r.ok)throw mkErr('api','API-Football HTTP '+r.status);
  const er=j&&j.errors;if(er&&(Array.isArray(er)?er.length:Object.keys(er).length)){const t=Array.isArray(er)?er.join(' · '):Object.entries(er).map(([a,b])=>a+': '+b).join(' · ');
    const kind=/token|key|access|suspend|account/i.test(t)?'auth':/rate/i.test(t)?'rate':/request|limit|quota/i.test(t)?'limit':/plan|subscription|season|free/i.test(t)?'plan':'api';throw mkErr(kind,'API-Football: '+t.slice(0,200))}
  return j?(j.response==null?[]:j.response):[]}
async function afStatus(){return af('status',{},{free:true})}

// ---------- caché (finalizados no cambian; el resto expira) ----------
async function cached(k,ttl,fn){const c=read(CACHE,{}),h=c[k];if(h&&Date.now()-h.t<ttl)return h.v;const v=await fn();const c2=read(CACHE,{});c2[k]={t:Date.now(),v};const ks=Object.keys(c2);if(ks.length>500)ks.sort((a,b)=>c2[a].t-c2[b].t).slice(0,ks.length-400).forEach(x=>delete c2[x]);write(CACHE,c2);return v}
const hasCache=(k,ttl)=>{const h=read(CACHE,{})[k];return !!(h&&Date.now()-h.t<ttl)};

// ---------- córners de un partido y de un equipo ----------
async function cornersOf(fid,ttl){return cached('fs_'+fid,ttl,async()=>{const r=await af('fixtures/statistics',{fixture:fid}),o={};for(const t of r){const s=(t.statistics||[]).find(z=>/corner kicks/i.test(z.type||''));if(s&&s.value!=null&&!isNaN(+s.value))o[t.team.id]=+s.value}return o})}
async function teamHistory(tid){return cached('th_'+tid,20*3600e3,async()=>{
  const fx=(await af('fixtures',{team:tid,last:HN,status:'FT'})).slice().sort((a,b)=>new Date(b.fixture.date)-new Date(a.fixture.date)),rows=[];let miss=0;
  for(const f of fx){if(rows.length>=HN)break;const fid=f.fixture&&f.fixture.id;if(!fid)continue;let m;
    try{m=await cornersOf(fid,30*864e5)}catch(e){if(['limit','auth','rate','scancap','plan'].includes(e.kind))throw e;miss++;continue}
    const home=f.teams.home.id===tid,opp=home?f.teams.away.id:f.teams.home.id;
    if(m[tid]==null||m[opp]==null){miss++;if(!rows.length&&miss>=2)break;continue}rows.push({f:m[tid],a:m[opp],h:home?1:0,d:f.fixture.date,fid})}
  return {rows,miss,seen:fx.length}})}

// ---------- modelo ----------
const wavg=(rows,key)=>{let sw=0,s=0;rows.forEach((r,i)=>{const w=Math.pow(.5,i/3);sw+=w;s+=w*r[key]});return sw?s/sw:null};   // vida media ≈ 3 partidos
const shrink=(v,n,base,k=3.5)=>(v*n+base*k)/(n+k);                                                                       // pocos partidos → se acerca al promedio de liga
function lambdas(hh,aa){const nH=hh.length,nA=aa.length,
  hF=shrink(wavg(hh,'f'),nH,BASE.per),hA=shrink(wavg(hh,'a'),nH,BASE.per),aF=shrink(wavg(aa,'f'),nA,BASE.per),aA=shrink(wavg(aa,'a'),nA,BASE.per),
  lh=clamp(BASE.h+(hF-BASE.per)*.8+(aA-BASE.per)*.8,2,9.5),la=clamp(BASE.a+(aF-BASE.per)*.8+(hA-BASE.per)*.8,1.5,8.5);
  return {lh,la,lt:lh+la,hF,hA,aF,aA,nH,nA}}
function nbCdf(k,m,phi){if(k<0)return 0;if(m<=0)return 1;if(phi<=1.001){let t=Math.exp(-m),s=t;for(let i=1;i<=k;i++){t*=m/i;s+=t}return Math.min(1,s)}const r=m/(phi-1),p=r/(r+m);let t=Math.pow(p,r),s=t;for(let i=1;i<=k;i++){t*=(i-1+r)/i*(1-p);s+=t}return Math.min(1,s)}
// Líneas: x.5 (sin reembolso) · enteras (si el total sale exacto se devuelve la apuesta) · de cuarto x.25/x.75 (mitad en cada línea vecina)
const isHalf=l=>Math.abs(l*2-Math.round(l*2))<1e-9;
const lineComps=l=>isHalf(l)?[[l,1]]:[[Math.floor(l*2)/2,.5],[Math.ceil(l*2)/2,.5]];
function sideProbs(mean,phi,cur,line,side){let w=0,l=0,p=0;
  for(const [c,k] of lineComps(line)){const r=c-cur,over=r<0?1:1-nbCdf(Math.floor(r),mean,phi),under=r<=0?0:nbCdf(Math.ceil(r)-1,mean,phi),push=Math.max(0,1-over-under);
    if(side==='over'){w+=k*over;l+=k*under}else{w+=k*under;l+=k*over}p+=k*push}
  return {w,l,push:p}}
const pOver=(mean,line,phi,cur=0)=>1-nbCdf(Math.floor(line)-cur,mean,phi);    // cur = córners que ya ocurrieron (en vivo)
function liveLambdas(pre,elapsed,cH,cA){const rem=Math.max(1,90-elapsed+2)/90,w=Math.min(.6,elapsed/(elapsed+60)),
  lh=(1-w)*pre.lh*rem+w*(cH/elapsed*90*rem),la=(1-w)*pre.la*rem+w*(cA/elapsed*90*rem);return {lh,la,lt:lh+la}}

// ---------- cuotas ----------
const BAD=/first half|1st half|second half|2nd half|half|1h|2h|period|handicap|race|1x2|3-?way|exact|odd\/even|odd even|asian/i;
function parseOddsRows(rows,isLive){const out=[];for(const b of rows||[]){for(const bet of (b.bets||b.odds||[])){const nm=String(bet.name||'');if(!/corner/i.test(nm)||BAD.test(nm))continue;const kind=/home/i.test(nm)?'home':/away/i.test(nm)?'away':'total';
  for(const v of bet.values||[]){if(v.suspended===true||v.suspended==='true')continue;const raw=String(v.value??'').trim();let side=null,line=NaN;const m=raw.match(/(Over|Under)\s*([0-9]+(?:\.[0-9]+)?)/i);
    if(m){side=m[1].toLowerCase();line=+m[2]}else if(/^(over|under)$/i.test(raw)){side=raw.toLowerCase();line=parseFloat(v.handicap)}
    const odd=Number(v.odd);if(side&&Number.isFinite(line)&&Number.isFinite(odd)&&odd>1)out.push({book:b.name||'API-Football',side,line,odd,kind,source:'API-Football'})}}}return out}
async function oddsApiSports(){const key=getOddsKey();if(!key)return [];return cached('oa_sports',30*60e3,async()=>{const {data}=await fetchJSON('https://api.the-odds-api.com/v4/sports/?apiKey='+encodeURIComponent(key),{},'The Odds API');return (data||[]).filter(x=>x.active&&/^soccer_/.test(x.key))})}
async function oddsApiEvents(){const sports=await oddsApiSports(),all=[];for(const s of sports){try{const {data}=await fetchJSON(`https://api.the-odds-api.com/v4/sports/${encodeURIComponent(s.key)}/events/?apiKey=${encodeURIComponent(getOddsKey())}`,{},'The Odds API');all.push(...(data||[]).map(e=>({...e,_sport:s.key,_title:s.title})));}catch(e){diag.oddsApiErr=e.message}}return all}
async function oddsApiCorners(event){const key=getOddsKey();if(!key)return [];return cached('oa_corner_'+event._sport+'_'+event.id,mode==='live'?45e3:5*60e3,async()=>{
  const u=`https://api.the-odds-api.com/v4/sports/${encodeURIComponent(event._sport)}/events/${encodeURIComponent(event.id)}/odds/?`+new URLSearchParams({apiKey:key,regions:'eu',markets:'alternate_totals_corners,alternate_team_totals_corners',oddsFormat:'decimal'});
  const {data,headers}=await fetchJSON(u,{},'The Odds API córners'),out=[];const rm=headers&&headers.get&&headers.get('x-requests-remaining');if(rm!=null&&rm!=='')diag.oddsRemaining=+rm;
  for(const b of data.bookmakers||[])for(const m of b.markets||[])for(const o of m.outcomes||[]){const side=String(o.name||'').toLowerCase(),line=Number(o.point),odd=Number(o.price);if((side==='over'||side==='under')&&Number.isFinite(line)&&odd>1)out.push({book:b.title||b.key,side,line,odd,team:o.description||'',scope:/team/.test(m.key)?'team':'total',source:'The Odds API'})}
  return out})}
function matchOddsEvent(f,events){const h=f.teams?.home?.name||f.home_team,a=f.teams?.away?.name||f.away_team,t=new Date(f.fixture?.date||f.commence_time).getTime();return events.map(e=>({e,sim:(similar(h,e.home_team)?1:0)+(similar(a,e.away_team)?1:0),dt:Math.abs(t-new Date(e.commence_time).getTime())})).filter(x=>x.sim===2&&x.dt<4*3600e3).sort((x,y)=>x.dt-y.dt)[0]?.e||null}
function groupMarkets(odds){const g=new Map();for(const o of odds){const k=o.kind+'|'+o.line;if(!g.has(k))g.set(k,{kind:o.kind,line:o.line,over:[],under:[]});g.get(k)[o.side].push(o)}
  const best=a=>a.slice().sort((x,y)=>y.odd-x.odd)[0]||null,out=[];
  for(const m of g.values()){const fairs=[],books=new Set([...m.over,...m.under].map(x=>x.book));for(const bk of books){const o=m.over.find(x=>x.book===bk),u=m.under.find(x=>x.book===bk);if(o&&u)fairs.push((1/o.odd)/(1/o.odd+1/u.odd))}
    fairs.sort((a,b)=>a-b);out.push({kind:m.kind,line:m.line,over:best(m.over),under:best(m.under),fairOver:fairs.length?fairs[fairs.length>>1]:null,twoSided:fairs.length>0})}
  return out}

// ---------- decisión ----------
function evaluate(lam,markets,cur){const res=[];
  for(const m of markets){const mean=m.kind==='total'?lam.lt:m.kind==='home'?lam.lh:lam.la,phi=m.kind==='total'?PHI.total:PHI.team,c=cur?(m.kind==='total'?cur.h+cur.a:m.kind==='home'?cur.h:cur.a):0,pO=pOver(mean,m.line,phi,c);
    for(const side of ['over','under']){const q=m[side];if(!q)continue;const sp=sideProbs(mean,phi,c,m.line,side),pm=sp.w+sp.l>0?sp.w/(sp.w+sp.l):.5,fair=m.fairOver!=null?(side==='over'?m.fairOver:1-m.fairOver):(1/q.odd)/1.06,gap=pm-fair,pf=fair+W*gap,edge=pf*q.odd-1;
      res.push({kind:m.kind,line:m.line,side,odd:q.odd,book:q.book,source:q.source||'API-Football',pm,fair,pf,gap,edge,twoSided:m.twoSided,mean,push:sp.push})}}return res}
function decide(res,nMin){const ok=[],rej={odd:0,gap:0,p:0,edge:0};
  for(const r of res){if(r.odd<MINODD||r.odd>MAXODD){rej.odd++;continue}if(Math.abs(r.gap)>MAXGAP){rej.gap++;continue}if(r.pf<MINP){rej.p++;continue}if(r.edge<MINEDGE){rej.edge++;continue}
    let s=r.pf>=.7?4:r.pf>=.65?3:r.pf>=.6?2:1;if(r.edge>=.08&&Math.abs(r.gap)<=.08)s++;if(nMin<5)s--;ok.push({...r,stake:clamp(s,1,5),score:r.pf*.6+Math.min(r.edge,.12)*1.5-Math.max(0,Math.abs(r.gap)-.08)})}
  ok.sort((a,b)=>b.score-a.score);return {ok,rej}}
const marketName=b=>(b.side==='over'?'Más de ':'Menos de ')+b.line+' '+KIND[b.kind]+(Number.isInteger(b.line)?' (se devuelve si sale '+b.line+')':isHalf(b.line)?'':' (línea de cuarto)');
const why=(rej)=>{const t=[];if(rej.odd)t.push(rej.odd+' fuera de cuota '+MINODD.toFixed(2)+'–'+MAXODD.toFixed(2));if(rej.gap)t.push(rej.gap+' donde el modelo se aleja más de '+pct(MAXGAP)+' pts del mercado');if(rej.p)t.push(rej.p+' con probabilidad menor a '+pct(MINP)+'%');if(rej.edge)t.push(rej.edge+' sin valor suficiente (menos de '+pct(MINEDGE)+'%)');return t.join(' · ')||'sin mercados evaluables'};

// ---------- partidos ----------
function parseEspnEvent(e,league){const c=e.competitions?.[0],home=c?.competitors?.find(x=>x.homeAway==='home'),away=c?.competitors?.find(x=>x.homeAway==='away');if(!home||!away)return null;return {fixture:{id:'espn_'+e.id,date:e.date,status:{short:e.status?.type?.state==='in'?'LIVE':'NS',elapsed:e.status?.displayClock?parseInt(e.status.displayClock,10):null}},league:{id:league,name:e.season?.name||league,country:''},teams:{home:{id:home.team?.id,name:home.team?.displayName},away:{id:away.team?.id,name:away.team?.displayName}},_source:'ESPN',_espn:e.id}}
async function espnFixtures(isLive){const leagues=['col.1','eng.1','eng.2','esp.1','ita.1','ger.1','fra.1','mex.1','arg.1','bra.1','ned.1','por.1','uefa.champions','uefa.europa','uefa.europa.conf','conmebol.libertadores','conmebol.sudamericana','usa.1','bel.1','tur.1','sco.1','gre.1','aut.1','sui.1','den.1','nor.1','swe.1','chi.1','uru.1','par.1','per.1','ecu.1','eng.fa','eng.league_cup','esp.copa_del_rey','ger.dfb_pokal','ita.coppa_italia','fra.coupe_de_france','ned.cup','por.taca.portugal','arg.copa','bra.copa_do_brazil'];const dates=isLive?[dateKey(Date.now())]:[dateKey(Date.now()),dateKey(Date.now()+864e5)];const out=[];let failures=0;for(let i=0;i<leagues.length;i+=8){const batch=leagues.slice(i,i+8);const got=await Promise.all(batch.flatMap(l=>dates.map(async d=>{try{const u=`https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/scoreboard?dates=${d.replace(/-/g,'')}`;const {data}=await fetchJSON(u,{},'ESPN');return (data.events||[]).map(e=>parseEspnEvent(e,l)).filter(Boolean)}catch{failures++;return []}})));got.forEach(a=>out.push(...a))}diag.espnFailures=failures;return out.filter(f=>isLive?f.fixture.status.short==='LIVE':new Date(f.fixture.date).getTime()>Date.now()-15*60e3)}
async function getFixtures(){let primary=[],espn=[];
  if(getAF()){
    if(mode==='pre'){for(const d of [0,1]){const day=dateKey(Date.now()+d*864e5);try{const r=await cached('af_fx_'+day,3*60e3,()=>af('fixtures',{date:day,timezone:'America/Bogota'}));primary.push(...r.filter(f=>['NS','TBD'].includes(f.fixture&&f.fixture.status&&f.fixture.status.short)))}catch(e){diag.afError=e.message;diag.afKind=e.kind}}}
    else{try{const r=await cached('af_live',45e3,()=>af('fixtures',{live:'all'}));primary=r.filter(f=>f.fixture&&f.fixture.status&&f.fixture.status.elapsed!=null&&f.fixture.status.elapsed>=20&&f.fixture.status.elapsed<=85&&['1H','2H'].includes(f.fixture.status.short))}catch(e){diag.afError=e.message;diag.afKind=e.kind}}}
  if(primary.length)diag.afFixtures=primary.length;
  try{espn=await cached('espn_'+mode,mode==='live'?45e3:3*60e3,()=>espnFixtures(mode==='live'));diag.espnFixtures=espn.length}catch(e){diag.espnFailures=(diag.espnFailures||0)+1}
  const merged=primary.map(f=>({...f,_source:'API-Football'}));
  for(const e of espn){const dup=merged.some(f=>similar(f.teams&&f.teams.home&&f.teams.home.name,e.teams.home.name)&&similar(f.teams&&f.teams.away&&f.teams.away.name,e.teams.away.name)&&Math.abs(new Date(f.fixture.date)-new Date(e.fixture.date))<4*3600e3);if(!dup)merged.push(e)}
  return merged}
function spreadByLeague(items,limit){const groups=new Map();for(const f of items){const k=String(f.league?.id||f.league?.name||'sin-liga');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(f)}const out=[];while(out.length<limit&&groups.size){for(const [k,a] of groups){if(a.length)out.push(a.shift());if(out.length>=limit)break;if(!a.length)groups.delete(k)}}return out}
async function research(match,league){const c=cfgRead();if(!c.br||!c.or)return {text:'Investigación IA no activada: configura Brave Search y OpenRouter en Ajustes.',source:'Sin IA'};try{const q=`football soccer ${match} ${league} corners recent form tactical wide attacks injuries team news`;const u='https://api.search.brave.com/res/v1/web/search?'+new URLSearchParams({q,count:'5',country:'CO',search_lang:'es'});const {data}=await fetchJSON(u,{headers:{Accept:'application/json','X-Subscription-Token':c.br}},'Brave Search');const articles=(data.web?.results||[]).slice(0,5).map(x=>({title:x.title,description:x.description,url:x.url}));if(!articles.length)return {text:'Brave Search no encontró noticias útiles verificables.',source:'Brave Search'};const prompt=`Resume solo lo que dicen estas fuentes sobre ${match} (${league}) y su posible efecto en córners. No inventes datos ni pronostiques cuotas. Señala hechos confirmados y dudas. Fuentes: ${JSON.stringify(articles)}`;const rr=await fetchJSON('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.or,'HTTP-Referer':'https://github.com/','X-Title':'RadarPi'},body:JSON.stringify({model:'openrouter/free',temperature:0,max_tokens:500,messages:[{role:'user',content:prompt}]})},'OpenRouter');return {text:rr.data.choices?.[0]?.message?.content||'Sin resumen IA',source:'Brave Search + OpenRouter',links:articles}}catch(e){return {text:'No se pudo completar la investigación: '+e.message,source:'IA no disponible'}}}

// ---------- análisis de un partido ----------
async function analyze(f,oaEvents){
  const h=f.teams.home,a=f.teams.away,id=f.fixture.id,match=h.name+' vs '+a.name,X={f,h,a,match,mode,id,lam:null,hist:null,odds:[],cands:[],best:null,rej:null,reason:'',live:null,books:[]};
  if(String(id).startsWith('espn_')){X.reason='Partido encontrado solo por ESPN: sin ID de API-Football no hay estadísticas de córners.';X.kind='nostats';return X}
  if(!getAF()){X.reason='Falta la llave de API-Football.';X.kind='auth';return X}
  const lid=f.league&&f.league.id;
  if(mode==='pre'&&lid&&hasCache('nl_'+lid,7*864e5)){X.kind='nostats';X.reason='La liga «'+((f.league&&f.league.name)||lid)+'» no publicó estadísticas de córners en la última comprobación (se vuelve a revisar en 7 días).';return X}
  let hh=null,aa=null;
  if(mode==='pre'||(hasCache('th_'+h.id,20*3600e3)&&hasCache('th_'+a.id,20*3600e3))){hh=await teamHistory(h.id);aa=await teamHistory(a.id)}
  let pre=null;
  if(hh&&aa){X.hist={hN:hh.rows.length,aN:aa.rows.length,miss:hh.miss+aa.miss};
    if(lid&&hh.rows.length===0&&aa.rows.length===0&&hh.miss>=2&&aa.miss>=2)await cached('nl_'+lid,7*864e5,async()=>1);
    if(hh.rows.length<4||aa.rows.length<4){X.kind='nostats';X.reason='Muestra insuficiente de córners (local '+hh.rows.length+', visitante '+aa.rows.length+' partidos con dato; '+(hh.miss+aa.miss)+' partidos sin estadística). Esa liga o competición probablemente no publica córners.';if(mode==='pre')return X}
    else{pre=lambdas(hh.rows,aa.rows);Object.assign(X.hist,{hF:pre.hF,hA:pre.hA,aF:pre.aF,aA:pre.aA})}}
  let lam=pre,cur=null;
  if(mode==='live'){const el=Number(f.fixture.status.elapsed)||0,cs=await cornersOf(id,45e3),cH=cs[h.id],cA=cs[a.id];
    if(cH==null||cA==null){X.kind='nostats';X.reason='API-Football no devuelve córners en vivo para este partido.';return X}
    const base=pre||{lh:BASE.h,la:BASE.a};lam=liveLambdas(base,el,cH,cA);cur={h:cH,a:cA};X.live={elapsed:el,cH,cA,preSource:pre?'historial del equipo':'promedios de liga',goals:(f.goals&&f.goals.home!=null)?f.goals.home+'-'+f.goals.away:null}}
  X.lam=lam;
  let odds=[];
  try{const r=await cached('afo_'+(mode==='live'?'l':'p')+id,mode==='live'?45e3:8*60e3,()=>af(mode==='live'?'odds/live':'odds',{fixture:id}));const r0=r[0]||{},rows=r0.bookmakers||(r0.odds?[{name:'API-Football en vivo',bets:r0.odds}]:[]);odds.push(...parseOddsRows(rows,mode==='live'))}
  catch(e){issue(match,'cuotas AF',e);if(['limit','auth','scancap'].includes(e.kind))throw e}
  const oe=matchOddsEvent(f,oaEvents||[]);
  if(oe){try{const rows=await oddsApiCorners(oe);for(const o of rows){const kind=o.scope==='team'?(similar(o.team,h.name)?'home':similar(o.team,a.name)?'away':null):'total';if(kind)odds.push({...o,kind})}}catch(e){diag.oddsApiErr=e.message;issue(match,'The Odds API',e)}}
  X.odds=odds;X.books=[...new Set(odds.map(o=>o.book))].slice(0,8);
  if(!odds.length){X.kind='noodds';X.reason='Sin cuotas de córners en las fuentes consultadas.';return X}
  if(!lam){X.kind='nostats';X.reason='Sin ritmo de córners calculable.';return X}
  const res=evaluate(lam,groupMarkets(odds),cur),nMin=X.hist?Math.min(X.hist.hN,X.hist.aN):5,d=decide(res,nMin);
  X.cands=d.ok.slice(0,3);X.best=d.ok[0]||null;X.rej=d.rej;X.nEval=res.length;
  if(!X.best){X.kind='novalue';X.reason='Ninguna línea cumple los filtros: '+why(d.rej)+'.'}
  return X}
const coldness=f=>[f.teams.home.id,f.teams.away.id].filter(id=>!hasCache('th_'+id,20*3600e3)).length;
function saveAnalyses(list){const all=analyses(),day=todayK();
  for(const x of list){const rec={id:String(x.id)+'|'+x.mode+'|'+day,t:Date.now(),mode:x.mode,league:(x.f.league&&x.f.league.name)||'',match:x.match,ko:x.f.fixture.date,fid:x.id,
    hN:x.hist&&x.hist.hN,aN:x.hist&&x.hist.aN,hF:x.hist&&x.hist.hF,hA:x.hist&&x.hist.hA,aF:x.hist&&x.hist.aF,aA:x.hist&&x.hist.aA,lam:x.lam&&{h:+x.lam.lh.toFixed(2),a:+x.lam.la.toFixed(2),t:+x.lam.lt.toFixed(2)},live:x.live,nOdds:x.odds.length,books:x.books,
    best:x.best&&{market:marketName(x.best),kind:x.best.kind,line:x.best.line,side:x.best.side,odd:x.best.odd,book:x.best.book,source:x.best.source,pModel:+x.best.pm.toFixed(3),pMarket:+x.best.fair.toFixed(3),pFinal:+x.best.pf.toFixed(3),edge:+x.best.edge.toFixed(3),stake:x.best.stake},reason:x.reason||'',kind:x.kind||(x.best?'pick':'')};
    const i=all.findIndex(z=>z.id===rec.id);if(i>=0)all[i]=rec;else all.unshift(rec)}
  all.length=Math.min(all.length,400);write(K.an,all)}

// ---------- pantalla: escáner ----------
const statusName=s=>s==='w'?'Acertado':s==='l'?'Fallado':s==='v'?'Nulo':'Pendiente';
const when=f=>{const d=new Date(f.fixture.date);return f.fixture.status&&f.fixture.status.elapsed!=null&&mode==='live'?(f.fixture.status.elapsed+"'"):d.toLocaleString('es',{weekday:'short',hour:'2-digit',minute:'2-digit'})};
function pickCard(x,i){const b=x.best,st=b.stake,H=x.hist,L=x.lam;
  const data=[['Promedios del local (a favor / en contra)',H&&H.hF!=null?H.hF.toFixed(1)+' / '+H.hA.toFixed(1):'—'],['Promedios del visitante (a favor / en contra)',H&&H.aF!=null?H.aF.toFixed(1)+' / '+H.aA.toFixed(1):'—'],['Muestra (partidos con dato)',H?H.hN+' y '+H.aN:'—'],
    [mode==='live'?'Córners que faltan (local / visitante / total)':'Córners esperados (local / visitante / total)',L.lh.toFixed(1)+' / '+L.la.toFixed(1)+' / '+L.lt.toFixed(1)],['Probabilidad del modelo',pct(b.pm)+'%'],['Probabilidad del mercado (sin margen)',pct(b.fair)+'%'+(b.twoSided?'':' (aprox.)')],['Probabilidad final (mezcla)',pct(b.pf)+'%'],['Casa y fuente',b.book+' · '+b.source],['Modalidad',mode==='live'?'En vivo · minuto '+x.live.elapsed+' · córners '+x.live.cH+'-'+x.live.cA:'Prepartido']];
  return `<article class="cn-card"><div class="cn-head"><span>${esc((x.f.league&&x.f.league.name)||'Liga')}${x.f.league&&x.f.league.country?' · '+esc(x.f.league.country):''}</span><span>${esc(when(x.f))}</span></div><b class="cn-match">${esc(x.match)}</b>
  <div class="tk"><small class="tkl">PICK DE CÓRNERS · SEGÚN REGLAS</small><div class="tk1"><b class="n">${esc(marketName(b))}</b></div><div class="tk2"><span><b>${pct(b.pf)}%</b> prob.</span><span>cuota <b>@${b.odd.toFixed(2)}</b></span><span>valor <b>${b.edge>=0?'+':''}${pct(b.edge)}%</b></span><span>stake <b>${st}/9</b></span></div><div class="meter${st>=5?' hi':''}" role="img" aria-label="Stake ${st} de 9">${Array.from({length:9},(_,k)=>`<i class="${k<st?'f':''}"></i>`).join('')}</div></div>
  ${x.cands.length>1?`<details class="more"><summary>Otras líneas con valor (${x.cands.length-1})</summary><div class="alts">${x.cands.slice(1).map(c=>`<span><b>${esc(marketName(c))}</b> ${pct(c.pf)}% @${c.odd.toFixed(2)}</span>`).join('')}</div></details>`:''}
  <details class="more"><summary>Datos del cálculo</summary><div class="cn-data">${data.map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div></details>
  ${x.intel?`<details class="more"><summary>Investigación web e IA · ${esc(x.intel.source)}</summary><p class="status">${esc(x.intel.text)}</p>${(x.intel.links||[]).map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title||l.url)}</a>`).join('<br>')}</details>`:''}
  ${b.push>.003?`<p class="status">${Number.isInteger(b.line)?'Línea entera: si el total termina justo en '+b.line+' te devuelven la apuesta':'Línea de cuarto: la apuesta se reparte entre dos líneas vecinas'} (≈${pct(b.push)}% de probabilidad). La probabilidad mostrada no cuenta ese caso.</p>`:''}<p class="status">Cuota de ${esc(b.book)}: confírmala en tu casa antes de apostar.</p><button class="btn" data-save="${i}" type="button">＋ Registrar pick</button></article>`}
function noPickCard(x){const kindTxt={nostats:'Sin estadísticas',noodds:'Sin cuotas',novalue:'Sin valor',auth:'Sin llave'}[x.kind]||'Solo análisis';
  return `<article class="cn-card muted"><div class="cn-head"><span>${esc((x.f.league&&x.f.league.name)||'Competición')}</span><span>${esc(kindTxt)}</span></div><b class="cn-match">${esc(x.match)}</b><div class="nopick2"><b>${x.kind==='novalue'?'Sin pick con ventaja clara':'No se pudo evaluar'}</b><small>${esc(x.reason)}</small></div>
  ${x.lam&&x.hist&&x.hist.hF!=null?`<small class="status">Córners esperados: ${x.lam.lh.toFixed(1)} + ${x.lam.la.toFixed(1)} = ${x.lam.lt.toFixed(1)} (muestra ${x.hist.hN}/${x.hist.aN})</small>`:''}</article>`}
function diagHTML(){const c=counter(),by={};diag.issues.forEach(i=>by[i.kind]=(by[i.kind]||0)+1);
  const kinds=Object.keys(by),src=[`ESPN: ${diag.espnFixtures??'—'} partidos · fallos ${diag.espnFailures??0}`,`API-Football: ${diag.afFixtures??0} partidos${diag.afError?' · '+esc(diag.afError):''}`,`The Odds API: ${getOddsKey()?'llave guardada':'sin llave'}${diag.oddsRemaining!=null?' · créditos restantes: '+diag.oddsRemaining:''}${diag.oddsApiErr?' · '+esc(diag.oddsApiErr):''}`,`IA: ${cfgRead().br&&cfgRead().or?'Brave + OpenRouter configurados':'sin Brave/OpenRouter en Ajustes'}`];
  return `<details class="corner-diagnostics" ${kinds.length||diag.afError?'open':''}><summary>Diagnóstico${kinds.length?' · '+kinds.length+' tipo(s) de problema':''}</summary>
  <div class="cn-diag"><div><b>Llave en uso:</b> ${ownKey()?'exclusiva de córners':getAF()?'general de Ajustes':'ninguna'} · <b>Solicitudes:</b> ${diag.reqs||0} en este escaneo · ${c.u.n}/${dailyCap()} hoy${diag.afRemaining!=null?' · restantes según API-Football: '+diag.afRemaining+(diag.afLimitDay?' de '+diag.afLimitDay:''):''}</div>
  ${src.map(s=>`<div>${s}</div>`).join('')}
  ${kinds.map(k=>`<div class="cn-iss"><b>${ICON[k]||'⚠'} ${by[k]} × ${esc(k)}</b><small>${esc(HINT[k]||'')}</small></div>`).join('')}
  ${diag.issues.length?`<details class="more"><summary>Detalle por partido (${diag.issues.length})</summary>${diag.issues.slice(0,25).map(i=>`<div class="cn-line"><b>${ICON[i.kind]||'⚠'} ${esc(i.match)}</b><small>${esc(i.stage)} · ${esc(i.msg)}</small></div>`).join('')}</details>`:''}</div></details>`}
async function scan(){if(busy)return;busy=true;diag={reqs:0,issues:[]};lastResults=[];const btn=$('#corner-run'),out=$('#corner-results');btn.disabled=true;out.innerHTML='<p class="status">Buscando partidos…</p>';
  try{const fixtures=await getFixtures();diag.fixtureCount=fixtures.length;
    if(!fixtures.length){out.innerHTML=`<div class="corner-empty"><b>No encontré partidos para este modo.</b><p>${mode==='live'?'No hay partidos en vivo entre los minutos 20 y 85 en las fuentes consultadas.':'ESPN y API-Football no devolvieron partidos para hoy y mañana.'}</p></div>${diagHTML()}`;return}
    const api=fixtures.filter(f=>!String(f.fixture.id).startsWith('espn_')),chosen=spreadByLeague(api.length?api:fixtures,mode==='pre'?10:12).sort((a,b)=>coldness(a)-coldness(b));
    let oa=[];if(getOddsKey()){try{oa=await oddsApiEvents();diag.oddsApiEvents=oa.length}catch(e){diag.oddsApiErr=e.message;issue('—','The Odds API',e)}}
    const results=[];let done=0;
    for(const f of chosen){out.innerHTML=`<p class="status">Analizando ${done+1} de ${chosen.length}… (${diag.reqs} solicitudes)</p>`;
      try{const x=await analyze(f,oa);results.push(x);if(x.kind&&['nostats','noodds'].includes(x.kind))issue(x.match,x.kind==='nostats'?'estadísticas':'cuotas',{kind:x.kind,message:x.reason})}
      catch(e){issue(f.teams.home.name+' vs '+f.teams.away.name,'análisis',e);if(['limit','auth','scancap'].includes(e.kind)){diag.stopped=e.kind;break}}done++}
    const withPick=results.filter(x=>x.best);let n=0;for(const x of withPick){if(n++<3)x.intel=await research(x.match,(x.f.league&&x.f.league.name)||'Fútbol')}
    lastResults=withPick;saveAnalyses(results);
    const sm=`<div class="corner-scan-summary"><b>${fixtures.length} partidos encontrados</b><span>${results.length} analizados · ${results.filter(x=>x.lam).length} con estadísticas · ${results.filter(x=>x.odds.length).length} con cuotas · ${withPick.length} picks</span></div>${diag.stopped?`<p class="status">⏸ ${esc(HINT[diag.stopped])}</p>`:''}`;
    out.innerHTML=sm+(withPick.length?withPick.map(pickCard).join(''):`<div class="corner-empty"><b>Ningún partido superó todos los filtros.</b><p>Reglas: cuota ${MINODD.toFixed(2)}–${MAXODD.toFixed(2)}, probabilidad final desde ${pct(MINP)}%, valor desde ${pct(MINEDGE)}% y modelo a menos de ${pct(MAXGAP)} puntos del mercado. No se rebajan para fabricar picks.</p></div>`)+results.filter(x=>!x.best).slice(0,6).map(noPickCard).join('')+diagHTML();
    out.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>savePick(+b.dataset.save))}
  catch(e){diag.issues.push({match:'—',stage:'general',kind:e.kind||'api',msg:e.message});out.innerHTML=`<div class="corner-empty"><b>No se pudo completar el análisis</b><p>${esc(e.message||'Error desconocido')}</p></div>${diagHTML()}`}
  finally{busy=false;btn.disabled=false}}
function savePick(i){const x=lastResults[i];if(!x||!x.best)return;const b=x.best,A=picks(),market=marketName(b),id=x.id+'|'+market+'|'+x.mode;
  if(A.some(z=>z.id===id)){if(typeof toast==='function')toast('Este pick ya está registrado.');return}
  A.push({id,fid:x.id,match:x.match,league:(x.f.league&&x.f.league.name)||'',home:x.h.name,away:x.a.name,hid:x.h.id,aid:x.a.id,ko:x.f.fixture.date,market,kind:b.kind,line:b.line,side:b.side,odd:b.odd,book:b.book,source:b.source,mode:x.mode,
    prob:+b.pf.toFixed(3),pModel:+b.pm.toFixed(3),pMarket:+b.fair.toFixed(3),edge:+b.edge.toFixed(3),stake:b.stake,twoSided:b.twoSided,hF:x.hist&&x.hist.hF,hA:x.hist&&x.hist.hA,aF:x.hist&&x.hist.aF,aA:x.hist&&x.hist.aA,hN:x.hist&&x.hist.hN,aN:x.hist&&x.hist.aN,
    lam:{h:+x.lam.lh.toFixed(2),a:+x.lam.la.toFixed(2),t:+x.lam.lt.toFixed(2)},live:x.live,res:null,date:new Date().toISOString()});
  if(savePicks(A)){if(typeof toast==='function')toast('Pick guardado en el Modelo de Córners.');renderModel(modelHost)}else if(typeof toast==='function')toast('⚠ No se pudo guardar: almacenamiento lleno.')}

// ---------- resolver automáticamente ----------
function settle(x,val){let u=0,w=0,l=0;for(const [c,k] of lineComps(x.line)){if(val===c)continue;const win=x.side==='over'?val>c:val<c;if(win){u+=k*(x.odd-1);w+=k}else{u-=k;l+=k}}return {res:w+l===0?'v':(w>=l?'w':'l'),units:u}}
async function resolvePending(){const msg=$('#cn-resmsg'),say=t=>{if(msg)msg.textContent=t};
  const P=picks(),todo=P.filter(x=>!x.res&&x.fid&&!String(x.fid).startsWith('espn_')&&Date.now()-new Date(x.ko||x.date).getTime()>110*60e3);
  if(!todo.length){say('No hay picks pendientes de partidos que ya hayan terminado.');return}
  diag={reqs:0,issues:[]};let ok=0,wait=0,fail=0;
  for(const x of todo.slice(0,8)){try{const fx=await af('fixtures',{id:x.fid}),st=fx[0]&&fx[0].fixture&&fx[0].fixture.status&&fx[0].fixture.status.short;
      if(!['FT','AET','PEN'].includes(st)){wait++;continue}
      const m=await cornersOf(x.fid,0),hv=m[x.hid],av=m[x.aid];if(hv==null||av==null){fail++;continue}
      const val=x.kind==='total'?hv+av:x.kind==='home'?hv:av,sr=settle(x,val);x.res=sr.res;x.units=sr.units;x.actual={h:hv,a:av,t:hv+av};x.result=hv+'-'+av+' ('+(hv+av)+' córners)';ok++}
    catch(e){fail++;if(['limit','auth','scancap','rate'].includes(e.kind)){say('⏸ '+e.message);break}}}
  savePicks(P);const txt=`Resueltos: ${ok} · aún sin terminar: ${wait} · sin dato: ${fail}. Cada pick usa 2 solicitudes.`;renderModel(modelHost);const m2=$('#cn-resmsg');if(m2)m2.textContent=txt}

// ---------- exportación ----------
function download(name,text,type){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
function exportJSON(){download('radarpi-modelo-corners.json',JSON.stringify({app:'RadarPi',tipo:'modelo-corners',version:2,creado:new Date().toISOString(),picks:picks(),analisis:analyses()},null,2),'application/json')}
function csvText(){const q=v=>{const s=v==null?'':String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s},
  cols=[['fecha','date'],['partido','match'],['liga','league'],['modalidad','mode'],['mercado','market'],['cuota','odd'],['casa','book'],['fuente','source'],['prob_final','prob'],['prob_modelo','pModel'],['prob_mercado','pMarket'],['valor','edge'],['stake','stake'],['prom_local_favor','hF'],['prom_local_contra','hA'],['prom_visit_favor','aF'],['prom_visit_contra','aA'],['muestra_local','hN'],['muestra_visit','aN'],['esperado_total',x=>x.lam&&x.lam.t],['resultado','res'],['corners_reales','result']];
  const rows=picks().map(x=>cols.map(([,k])=>{const v=typeof k==='function'?k(x):x[k];return q(typeof v==='number'?+v.toFixed(3):v)}).join(','));
  return '\ufeff'+cols.map(c=>c[0]).join(',')+'\n'+rows.join('\n')}
const exportCSV=()=>download('radarpi-modelo-corners.csv',csvText(),'text/csv;charset=utf-8');

// ---------- pantalla: Modelo de Córners ----------
function pickItem(x){const cls=x.res==='w'?'is-win':x.res==='l'?'is-loss':x.res==='v'?'is-void':'is-pending';
  return `<details class="model-pick ${cls}"><summary class="model-pick-summary"><div class="model-pick-main"><b>${esc(x.match)}</b><span>${esc(x.market)} · ${new Date(x.ko||x.date).toLocaleDateString('es',{day:'numeric',month:'short'})}</span></div><div class="model-pick-side"><span class="st ${x.res||'p'}">${statusName(x.res)}</span><b class="model-pick-arrow">＋</b></div></summary>
  <div class="model-pick-body"><div class="model-pick-metrics"><span><small>Modelo</small><b>${pct(x.prob)}%</b></span><span><small>Cuota</small><b>${Number(x.odd).toFixed(2)}</b></span><span><small>Stake</small><b>${x.stake}/9</b></span>${x.result?`<span><small>Real</small><b>${esc(x.result)}</b></span>`:''}</div>
  <small class="model-pick-note">${esc(x.mode==='live'?'En vivo':'Prepartido')} · ${esc(x.book||'')} · ${esc(x.source||'')}${x.hF!=null?` · Promedios ${x.hF.toFixed(1)}/${x.hA.toFixed(1)} y ${x.aF.toFixed(1)}/${x.aA.toFixed(1)} (muestra ${x.hN}-${x.aN})`:''}${x.lam?` · Esperado ${x.lam.t} córners`:''}${x.pMarket!=null?` · Mercado ${pct(x.pMarket)}% · Valor ${pct(x.edge)}%`:''}</small>
  <div class="model-pick-actions"><button class="btn s ${x.res==='w'?'on':''}" data-r="w" data-id="${esc(x.id)}">✓ Acertó</button><button class="btn s ${x.res==='l'?'on':''}" data-r="l" data-id="${esc(x.id)}">✕ Falló</button><button class="btn s" data-r="v" data-id="${esc(x.id)}">Nulo</button><button class="btn s" data-r="" data-id="${esc(x.id)}">↺ Pendiente</button><button class="btn s" data-del="${esc(x.id)}">Borrar</button></div></div></details>`}
function analysisItem(a){const b=a.best;return `<details class="model-pick ${b?'is-pending':'is-void'}"><summary class="model-pick-summary"><div class="model-pick-main"><b>${esc(a.match)}</b><span>${esc(a.league)} · ${new Date(a.t).toLocaleDateString('es',{day:'numeric',month:'short'})} · ${a.mode==='live'?'en vivo':'prepartido'}</span></div><div class="model-pick-side"><span class="st ${b?'p':'v'}">${b?'Con pick':'Sin pick'}</span><b class="model-pick-arrow">＋</b></div></summary>
  <div class="model-pick-body"><div class="model-pick-metrics">${a.lam?`<span><small>Esperado</small><b>${a.lam.t}</b></span>`:''}<span><small>Cuotas</small><b>${a.nOdds}</b></span>${a.hN!=null?`<span><small>Muestra</small><b>${a.hN}-${a.aN}</b></span>`:''}${b?`<span><small>Pick</small><b>${esc(b.market)} @${b.odd}</b></span>`:''}</div>
  <small class="model-pick-note">${a.hF!=null?`Promedios local ${a.hF.toFixed(1)}/${a.hA.toFixed(1)} · visitante ${a.aF.toFixed(1)}/${a.aA.toFixed(1)} (a favor/en contra). `:''}${b?`Modelo ${pct(b.pModel)}% · mercado ${pct(b.pMarket)}% · final ${pct(b.pFinal)}% · ${esc(b.book)}. `:''}${esc(a.reason||'')}${a.books&&a.books.length?' Casas: '+esc(a.books.join(', '))+'.':''}</small></div></details>`}
function renderModel(target){const host=typeof target==='string'?document.querySelector(target):target;if(!host)return;modelHost=host;
  const P=picks(),A=analyses(),D=P.filter(x=>x.res==='w'||x.res==='l'),W_=D.filter(x=>x.res==='w').length,pend=P.filter(x=>!x.res).length,units=D.reduce((t,x)=>t+(x.units!=null?x.units:(x.res==='w'?x.odd-1:-1)),0);
  const tabs=[['res','Resumen',''],['all','Todos',P.length],['p','Pendientes',pend],['w','Acertados',W_],['l','Fallados',D.length-W_],['an','Análisis',A.length]];if(!tabs.some(t=>t[0]===mtab))mtab='res';
  const grp=(f,lab)=>{const ks=[...new Set(D.map(f))].sort();return ks.length?`<div class="sec">${lab}</div>`+ks.map(k=>{const a=D.filter(x=>f(x)===k);return rwRow(k,a.filter(x=>x.res==='w').length,a.length,pct(a.reduce((t,x)=>t+x.prob,0)/a.length))}).join(''):''};
  let body='';
  if(mtab==='res'){body=`<div class="band"><div><small>Efectividad</small><b>${D.length?Math.round(100*W_/D.length)+'%':'—'}</b><small>${W_} de ${D.length}</small></div><div><small>Unidades</small><b class="${units>=0?'ok':'bad'}">${D.length?(units>=0?'+':'')+units.toFixed(1):'—'}</b><small>stake plano</small></div><div><small>Pendientes</small><b>${pend}</b><small>${P.length} registrados</small></div></div>
   ${D.length?`<div class="card">${rwRow('Todos los resueltos',W_,D.length,pct(D.reduce((t,x)=>t+x.prob,0)/D.length))}${grp(x=>x.side==='over'?'Más de (Over)':'Menos de (Under)','Por lado')}${grp(x=>KIND[x.kind]||x.kind,'Por tipo de línea')}${grp(x=>x.mode==='live'?'En vivo':'Prepartido','Por modalidad')}${grp(x=>Math.floor(x.prob*20)*5+'–'+(Math.floor(x.prob*20)*5+4)+'%','Por probabilidad prometida')}</div>`:'<div class="corner-empty">Registra picks y márcalos (o usa «Resolver pendientes») para ver tu rendimiento.</div>'}
   ${D.length<30?`<p class="status">Muestra pequeña (${D.length}): con menos de 30 picks no concluyas nada.</p>`:''}`}
  else if(mtab==='an'){body=A.length?A.slice(0,60).map(analysisItem).join('')+`<div class="tools"><button class="btn s" id="cn-clear-an" type="button">Borrar análisis guardados</button></div>`:'<div class="corner-empty">Aún no hay análisis guardados. Cada escaneo guarda aquí todos los partidos que revisó, tengan pick o no.</div>'}
  else{const f=P.filter(x=>mtab==='all'||(mtab==='p'?!x.res:x.res===mtab)).slice().reverse();body=f.length?f.map(pickItem).join(''):'<div class="corner-empty">Nada en esta sección.</div>'}
  host.innerHTML=`<section class="corner-model"><div class="seg m model-filter-bar" role="tablist" aria-label="Secciones del modelo de córners">${tabs.map(([k,t,n])=>`<button type="button" role="tab" aria-selected="${mtab===k}" class="${mtab===k?'on':''}" data-tab="${k}"><span>${t}</span>${n!==''?`<b class="${k==='w'?'ok':k==='l'?'bad':k==='p'?'pending':''}">${n}</b>`:''}</button>`).join('')}</div>
  <div class="tools cn-tools"><button class="btn s" id="cn-res" type="button">Resolver pendientes</button><button class="btn s" id="cn-exp" type="button">Exportar JSON</button><button class="btn s" id="cn-csv" type="button">Exportar CSV</button></div><p class="status" id="cn-resmsg" role="status"></p>${body}</section>`;
  host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{mtab=b.dataset.tab;renderModel(host)});
  host.querySelector('#cn-res').onclick=resolvePending;host.querySelector('#cn-exp').onclick=exportJSON;host.querySelector('#cn-csv').onclick=exportCSV;
  const ca=host.querySelector('#cn-clear-an');if(ca)ca.onclick=()=>{if(confirm('¿Borrar los análisis guardados? Tus picks registrados no se tocan.')){write(K.an,[]);renderModel(host)}};
  host.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const a=picks(),x=a.find(z=>z.id===b.dataset.id);if(!x)return;x.res=b.dataset.r||null;savePicks(a);renderModel(host)});
  host.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('¿Borrar este pick?'))return;savePicks(picks().filter(z=>z.id!==b.dataset.del));renderModel(host)})}

// ---------- pantalla: módulo ----------
function setMode(m){mode=m;document.querySelectorAll('[data-corner-mode]').forEach(b=>b.classList.toggle('on',b.dataset.cornerMode===m));$('#corner-run').textContent=m==='pre'?'Buscar partidos y analizar córners':'Buscar partidos en vivo';$('#corner-status').textContent=m==='pre'?'Prepartido: promedios de córners a favor y en contra de cada equipo, con la cuota de córners de las casas.':'En vivo (minutos 20–85): calcula solo los córners que faltan, según el ritmo previo y el del partido.'}
function keyBox(){const c=counter();return `<details class="corner-key-box"><summary>Llaves y estado de cuenta</summary>
  <label>API-Football · llave exclusiva de córners (opcional)<input id="corner-af-key" type="password" autocomplete="off" placeholder="Si la dejas vacía se usa la llave de Ajustes"></label>
  <div class="tools"><button class="btn s" id="corner-af-save" type="button">Guardar</button><button class="btn s" id="corner-af-test" type="button">Probar y ver estado</button><button class="btn s" id="corner-af-clear" type="button">Quitar</button></div>
  <p class="status" id="corner-af-state">${ownKey()?'Usando la llave exclusiva de córners.':getAF()?'Usando la llave general de Ajustes.':'Sin llave de API-Football.'} Solicitudes hoy (contadas por esta app): ${c.u.n}/${dailyCap()}.</p>
  <label>The Odds API (opcional)<input id="corner-odds-key" type="password" autocomplete="off" placeholder="Pega tu llave"></label>
  <div class="tools"><button class="btn s" id="corner-save-key" type="button">Guardar</button><button class="btn s" id="corner-odds-test" type="button">Probar</button></div><p class="status" id="corner-odds-state">Se guarda solo en este navegador y no sale en la copia de seguridad.</p></details>`}
async function testAF(){const el=$('#corner-af-state');el.textContent='Consultando estado…';diag={reqs:0,issues:[]};
  try{const s=await afStatus(),sub=s.subscription||{},rq=s.requests||{};el.innerHTML=`✔ Conectado · plan <b>${esc(sub.plan||'—')}</b> ${sub.active===false?'(inactivo)':''}${sub.end?' · vence '+esc(String(sub.end).slice(0,10)):''} · solicitudes hoy según la API: <b>${rq.current??'—'}</b> de <b>${rq.limit_day??'—'}</b>.`}
  catch(e){el.innerHTML=`✘ ${esc(e.message)}<br><small>${esc(HINT[e.kind]||'')}</small>`}}
async function testOdds(){const el=$('#corner-odds-state'),k=getOddsKey();if(!k){el.textContent='Primero guarda una llave.';return}el.textContent='Consultando…';
  try{const {data,headers}=await fetchJSON('https://api.the-odds-api.com/v4/sports/?apiKey='+encodeURIComponent(k),{},'The Odds API');const rem=headers&&headers.get&&headers.get('x-requests-remaining');el.textContent='✔ Conectada · '+(data||[]).filter(x=>/^soccer_/.test(x.key)).length+' competiciones de fútbol'+(rem?' · créditos restantes: '+rem:'')}
  catch(e){el.innerHTML='✘ '+esc(e.message)+'<br><small>'+(/401/.test(e.message)?'Llave inválida o créditos agotados.':/429/.test(e.message)?'Demasiadas solicitudes seguidas.':'Revisa tu conexión.')+'</small>'}}
function mount(){const root=$('#corners-root');if(!root)return;if(root.dataset.mounted==='1'){renderModel($('#corner-model-host'));return}root.dataset.mounted='1';
  root.innerHTML=`<div class="corners-hero"><div class="corners-kicker">MERCADO ESPECIALIZADO · MOTOR v2</div><h2>🎯 Picks Especiales</h2><p>Córners con promedios a favor y en contra, distribución realista, cuota del mercado y modo en vivo. Historial independiente.</p><div class="corners-tags"><span>Over y Under</span><span>Cuota ${MINODD.toFixed(2)}–${MAXODD.toFixed(2)}</span><span>Prepartido + en vivo</span></div></div>
  <div class="corner-mode-tabs"><button class="on" data-corner-mode="pre">◷ Prepartido</button><button data-corner-mode="live">● En vivo</button></div>
  <div class="corner-panel"><div class="corner-panel-head"><div><b>Escáner de córners</b><small id="corner-status"></small></div><span>⌁</span></div>${keyBox()}<button class="btn corner-run" id="corner-run">Buscar partidos y analizar córners</button><div id="corner-results" aria-live="polite"><div class="corner-empty">Pulsa analizar. El primer escaneo gasta más solicitudes porque descarga el historial de córners de cada equipo; después se reutiliza.</div></div></div>
  <div id="corner-model-host"></div>`;
  const ok=$('#corner-odds-key');ok.value=getOddsKey();const ak=$('#corner-af-key');ak.value=ownKey();
  $('#corner-af-save').onclick=()=>{const v=ak.value.trim();if(v)localStorage.setItem(K.af,v);else localStorage.removeItem(K.af);$('#corner-af-state').textContent=v?'Llave exclusiva guardada en este navegador.':'Se usará la llave general de Ajustes.'};
  $('#corner-af-clear').onclick=()=>{localStorage.removeItem(K.af);ak.value='';$('#corner-af-state').textContent='Llave exclusiva quitada.'};
  $('#corner-af-test').onclick=()=>{const v=ak.value.trim();if(v&&v!==ownKey())localStorage.setItem(K.af,v);testAF()};
  $('#corner-save-key').onclick=()=>{localStorage.setItem(ODKEY,ok.value.trim());$('#corner-odds-state').textContent='Llave guardada.'};$('#corner-odds-test').onclick=()=>{if(ok.value.trim()!==getOddsKey())localStorage.setItem(ODKEY,ok.value.trim());testOdds()};
  root.querySelectorAll('[data-corner-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.cornerMode));$('#corner-run').onclick=scan;setMode('pre');renderModel($('#corner-model-host'))}
window.initRadarCorners=()=>{try{mount()}catch(e){const root=$('#corners-root');if(root){root.dataset.mounted='';root.innerHTML=`<div class="corner-empty"><b>Error al cargar Picks Especiales</b><p>${esc(e&&e.message||e)}</p></div>`}console.error('RadarPi corners:',e)}};
window.renderRadarCornersModel=renderModel;
window.RadarCorners={sideProbs,settle,lambdas,liveLambdas,nbCdf,pOver,parseOddsRows,groupMarkets,evaluate,decide,wavg,shrink,marketName,csvText,analyze,savePick,_set:(m)=>{mode=m}};
})();
