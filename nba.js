(function(){
'use strict';
/* ===== NBA · Radar de patrones (ESPN temporada actual + The Odds API) ===== */
const NE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/',NW='https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/',NO='https://api.the-odds-api.com/v4/sports/basketball_nba/';
async function nbFetchESPN(url,options){let err='';try{const r=await fetch(url,options);if(r.ok)return r;err='HTTP '+r.status}catch(e){err=e&&e.message||'fallo de red'}for(const make of [u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u),u=>'https://corsproxy.io/?url='+encodeURIComponent(u)]){try{const r=await fetch(make(url),options);if(r.ok)return r;err+='; proxy HTTP '+r.status}catch(e){err+='; proxy '+(e&&e.message||'fallo de red')}}throw new Error('ESPN no respondió ('+err+').')}
const NC=Object.assign({alt:false,lp:false,keys:'',games:3,per:8,day:0,news:'',sgo:'',bdl:'',apisports:''},LS('nbcfg',{}));
const NB={g:[],od:null,sel:{},ln:{},reg:{},picks:LS('nbapicks',[]),ki:0,tab:'all'};
const nz=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
const Phi=x=>{const t=1/(1+.2316419*Math.abs(x)),p=.3989423*Math.exp(-x*x/2)*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p};
const nbj=async u=>{const r=await nbFetchESPN(u);return r.json()};
async function pool(a,n,f){const o=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<a.length){const k=i++;try{o[k]=await f(a[k],k)}catch(e){o[k]=null}}}));return o}
function nbCdf(k,m,v){if(k<0)return 0;if(v<=m*1.02){let t=Math.exp(-m),s=t;for(let i=1;i<=k;i++){t*=m/i;s+=t}return Math.min(1,s)}const r=m*m/(v-m),p=r/(r+m);let t=Math.pow(p,r),s=t;for(let i=1;i<=k;i++){t*=(i-1+r)/i*(1-p);s+=t}return Math.min(1,s)}
const seasonEnd=()=>{const d=new Date();return d.getMonth()>=8?d.getFullYear()+1:d.getFullYear()};
// El plan gratuito de API-Sports limita NBA a temporadas históricas (2022–2024).
const apiSportsFreeSeason=()=>2024;

// ---- Fuente alternativa real para estadísticas de jugadores: API-NBA (API-Sports) ----
const AN='https://v2.nba.api-sports.io';
async function nbaApi(path){
  const key=String(NC.apisports||'').trim();if(!key)throw new Error('falta la llave API-NBA en Ajustes → Fuentes y ajustes de NBA');
  const r=await fetch(AN+path,{headers:{'x-apisports-key':key}});
  if(!r.ok)throw new Error('API-NBA HTTP '+r.status);
  const j=await r.json();if(j.errors&&Object.keys(j.errors).length)throw new Error(JSON.stringify(j.errors));
  return j.response||[];
}
async function nbaApiTeams(){
  const season=String(apiSportsFreeSeason()),C=LS('nba_api_teams_v2',null);
  if(C&&C.season===season&&Date.now()-C.t<7*864e5&&Array.isArray(C.v))return C.v;
  const v=await nbaApi('/teams?league=standard&season='+season);
  if(!v.length)throw new Error('API-NBA no devolvió equipos para la temporada '+season);
  SV('nba_api_teams_v2',{t:Date.now(),season,v});return v;
}
function nbaApiTeamMatch(teams,ab){
  const aliases={GSW:['GS','GSW','GOLDEN STATE'],NYK:['NY','NYK','NEW YORK'],NOP:['NO','NOP','NEW ORLEANS'],SAS:['SA','SAS','SAN ANTONIO'],UTA:['UTAH','UTA'],PHX:['PHO','PHX','PHOENIX'],BKN:['BKN','BROOKLYN'],LAC:['LAC','LA CLIPPERS'],LAL:['LAL','LA LAKERS'],CHA:['CHA','CHARLOTTE']};
  const want=aliases[ab]||[ab];
  return teams.find(t=>want.includes(String(t.code||t.abbreviation||'').toUpperCase()))||teams.find(t=>want.some(x=>nz(t.name||'').includes(nz(x))||nz(t.nickname||'').includes(nz(x))))||null;
}
async function nbaApiTeamPlayers(ab){
  const season=String(apiSportsFreeSeason()),cacheKey='nba_api_teamstats_v2',C=LS(cacheKey,{}),ck=season+'_'+ab;
  if(C[ck]&&Date.now()-C[ck].t<6*36e5)return C[ck].v;
  const teams=await nbaApiTeams(),team=nbaApiTeamMatch(teams,ab);
  if(!team)throw new Error('API-NBA no encontró equipo '+ab);
  // Al inicio de temporada actual puede haber 0-2 partidos: mezcla temporada actual y anterior.
  const [cur,prev]=await Promise.all([
    nbaApi('/players/statistics?team='+team.id+'&season='+season).catch(()=>[]),
    nbaApi('/players/statistics?team='+team.id+'&season='+(+season-1)).catch(()=>[])
  ]);
  const raw=cur.map(x=>({...x,_currentSeason:true})).concat(prev.map(x=>({...x,_currentSeason:false})));
  const by={};
  for(const x of raw){
    const p=x.player||{},g=x.game||{},n=p.name||[p.firstname,p.lastname].filter(Boolean).join(' ')||x.player_name||'';
    if(!n)continue;
    const id=String(p.id||x.player_id||nz(n));
    const mins=x.min??x.minutes??x.played??0;
    let min=0;if(typeof mins==='number')min=mins;else {const mm=String(mins).match(/(\d+)(?::(\d+))?/);if(mm)min=+mm[1]+(+mm[2]||0)/60;}
    const num=(...vals)=>{for(const v of vals){const z=Number(v);if(v!==null&&v!==''&&Number.isFinite(z))return z}return 0};
    const date=String(g.date||g.date_start||g.datetime||x.date||'').slice(0,10);
    const row={d:date,id:String(g.id||g.game_id||date),r:[min,num(x.points,x.pts),num(x.totReb,x.total_rebounds,x.rebounds,x.reb),num(x.assists,x.ast),num(x.tpm,x.three_points_made,x.three_pointers_made,x.threes),x._currentSeason?1:0]};
    if(!by[id])by[id]={id,n,pos:p.pos||p.position||'',g:[]};by[id].g.push(row);
  }
  const out=Object.values(by).map(p=>({...p,g:p.g.filter(x=>x.r[0]>0||x.r.slice(1,5).some(v=>v>0)).sort((a,b)=>b.d.localeCompare(a.d)).filter((x,i,a)=>i===a.findIndex(y=>y.id===x.id)).slice(0,15).map(x=>x.r.concat(x.d))})).filter(p=>p.g.length>=3);
  C[ck]={t:Date.now(),v:out};for(const k of Object.keys(C))if(Date.now()-C[k].t>3*864e5)delete C[k];SV(cacheKey,C);return out;
}

// ---- Estadísticas de jugadores (ESPN gamelog), cache compacto ----
function parseGL(j){
  if(!j||typeof j!=='object')return [];
  const labels=Array.isArray(j.names)?j.names:(Array.isArray(j.labels)?j.labels:[]);
  const ix=(...names)=>{for(const n of names){const i=labels.findIndex(x=>String(x).toUpperCase()===n);if(i>=0)return i}return -1};
  const iM=ix('MIN','MINUTES'),iP=ix('PTS','POINTS'),iR=ix('REB','REBOUNDS'),iA=ix('AST','ASSISTS'),i3=ix('3PT','3PM','3P');
  const ev=j.events||{},out=[];
  const pushEvent=(e,st)=>{
    if(!e)return;
    const eid=String(e.eventId||e.id||e.gameId||''),meta=ev[eid]||ev[Number(eid)]||{};
    let date=e.gameDate||e.date||e.game_date||meta.gameDate||meta.date||meta.startDate||'';
    if(!date&&typeof meta==='string')date=meta;
    date=String(date||'').slice(0,10);
    const stats=e.stats||e.statistics||[];
    const get=(i,...keys)=>{
      let v=i>=0&&Array.isArray(stats)?stats[i]:undefined;
      if(v==null&&!Array.isArray(stats)&&stats&&typeof stats==='object'){for(const k of keys)if(stats[k]!=null){v=stats[k];break}}
      if(v==null&&Array.isArray(stats)){for(const x of stats)if(x&&typeof x==='object'&&keys.includes(String(x.name||x.label||x.abbreviation||'').toUpperCase())){v=x.value??x.displayValue;break}}
      return v;
    };
    const min=get(iM,'MIN','MINUTES'),pts=get(iP,'PTS','POINTS'),reb=get(iR,'REB','REBOUNDS'),ast=get(iA,'AST','ASSISTS'),threes=get(i3,'3PT','3PM','3P');
    const minutes=parseFloat(String(min??'0').replace(':','.'))||0;
    const number=v=>{const n=parseFloat(String(v??'0').replace(',','.'));return Number.isFinite(n)?n:0};
    const made=String(threes??'0').match(/^\s*(\d+)/);
    out.push({d:date,r:[minutes,number(pts),number(reb),number(ast),made?+made[1]:number(threes)]});
  };
  const types=Array.isArray(j.seasonTypes)?j.seasonTypes:[];
  for(const st of types){
    const title=String(st.displayName||st.name||'');
    if(title&&!/regular|season|career/i.test(title))continue;
    for(const c of st.categories||[]){
      for(const e of c.events||[])pushEvent(e,st);
    }
  }
  // Algunas respuestas ESPN cambian el anidamiento: intenta leer categorías/eventos raíz.
  if(!out.length){
    const cats=j.categories||j.events||[];
    if(Array.isArray(cats))for(const c of cats)for(const e of (c.events||[]))pushEvent(e,c);
  }
  return out.filter(x=>x.r.some(v=>v>0));
}
async function glog(id){
  const C=LS('nba_gl_v2',{}),c=C[id];if(c&&Date.now()-c.t<6*36e5&&c.g&&c.g.length)return c.g;
  const se=seasonEnd(),cut=(se-1)+'-10-01';let all=[];
  try{all=parseGL(await nbj(NW+'athletes/'+id+'/gamelog'))}catch{}
  if(all.filter(x=>x.d>=cut).length<10){
    for(const url of [NW+'athletes/'+id+'/gamelog?season='+(se-1),NW+'athletes/'+id+'/gamelog?season='+(se-1)+'&seasontype=2']){
      try{const extra=parseGL(await nbj(url));all=all.concat(extra);if(all.filter(x=>x.d>=cut).length>=10)break}catch{}
    }
  }
  const seen=new Set(),g=all.filter(x=>x.d&&!seen.has(x.d)&&seen.add(x.d)).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,15).map(x=>x.r.concat(x.d>=cut?1:0));
  const C2=LS('nba_gl_v2',{});C2[id]={t:Date.now(),g};for(const k in C2)if(Date.now()-C2[k].t>36e5*36)delete C2[k];SV('nba_gl_v2',C2);return g
}
const STX={pts:['PTS',1],reb:['REB',2],ast:['AST',3],tp:['3PM',4],pra:['PRA',0]};
const val=(r,s)=>s==='pra'?r[1]+r[2]+r[3]:r[STX[s][1]];
function proj(rows,s){const a=rows.filter(r=>r[0]>=8).slice(0,12).map(r=>val(r,s));if(a.length<3)return null;let w=0,m=0;a.forEach((x,i)=>{const k=i<5?1.4:.6;m+=x*k;w+=k});m/=w;
  const mu=a.reduce((t,x)=>t+x,0)/a.length,v=a.reduce((t,x)=>t+(x-mu)**2,0)/Math.max(1,a.length-1);
  return{a,m,v:Math.max(v,m*1.05),med:[...a].sort((x,y)=>x-y)[a.length>>1],cur:rows.filter(r=>r[5]&&r[0]>=8).length}}
const shr=(p,cur)=>.5+(p-.5)*(NB.k||.75)*(cur>=5?1:.73);
const pOver=(P,L)=>shr(1-nbCdf(Math.floor(L),P.m,P.v),P.cur);

// ---- Cuotas (The Odds API, gratis 500 créditos/mes; varias llaves con relevo) ----
async function nbo(path,params){const ks=NC.keys.split(/[\s,]+/).filter(Boolean);if(!ks.length)throw new Error('sin llave');
  for(;;){const r=await fetch(NO+path+'?'+new URLSearchParams({...params,apiKey:ks[NB.ki]||ks[0],oddsFormat:'decimal'}));
    if(!r.ok){if([401,429].includes(r.status)&&NB.ki<ks.length-1){NB.ki++;toast('Llave agotada: usando la siguiente');continue}throw new Error('The Odds API '+r.status)}return r.json()}}
function bestOf(rows){const g={};for(const x of rows)(g[x.k]=g[x.k]||[]).push(x);const o={};
  for(const k in g){const c={};g[k].forEach(x=>c[x.p]=(c[x.p]||0)+1);const p=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];o[k]={p:p==='undefined'?null:+p,q:Math.max(...g[k].filter(x=>String(x.p)===p).map(x=>x.q))}}return o}
const rowsOf=ev=>{const R=[];for(const b of ev.bookmakers||[])for(const m of b.markets||[])for(const o of m.outcomes||[])R.push({k:m.key+'|'+nz(o.description||o.name)+'|'+(o.description?o.name:'')+(/_alternate$/.test(m.key)?'@'+o.point:''),p:o.point,q:o.price});return R};
async function nbOdds(games){
  const ev=await nbo('odds',{regions:'us',markets:'h2h,spreads,totals'}),out={};
  const lt=s=>nz(s).split(' ').pop();for(const e of ev){const g=games.find(x=>lt(x.h.n)===lt(e.home_team)&&lt(x.a.n)===lt(e.away_team));if(g)out[g.id]={eid:e.id,o:bestOf(rowsOf(e))}}
  NB.perr=[];NB.pn=0;await pool(games.filter(g=>out[g.id]),2,async g=>{try{const j=await nbo('events/'+out[g.id].eid+'/odds',{regions:'us',markets:'player_points,player_rebounds,player_assists,player_threes,player_points_rebounds_assists'+(NC.alt?',player_points_alternate,player_rebounds_alternate,player_assists_alternate,player_threes_alternate':'')}),o=bestOf(rowsOf(j));if(Object.keys(o).length){NB.pn++;Object.assign(out[g.id].o,o)}else NB.perr.push(g.a.ab+'@'+g.h.ab+': sin props publicados todavía')}catch(e){NB.perr.push(g.a.ab+'@'+g.h.ab+': '+e.message)}});
  return out}

// ---- Modelo de partido (ritmo/anotación de los últimos juegos) ----
async function teamForm(id){const se=seasonEnd(),res=[];
  for(const q of ['','?season='+(se-1)]){try{const j=await nbj(NE+'teams/'+id+'/schedule'+q);for(const e of j.events||[]){const c=(e.competitions||[])[0];if(!c||!(c.status&&c.status.type&&c.status.type.completed))continue;if(e.seasonType&&+e.seasonType.type===1)continue;const me=c.competitors.find(x=>x.team.id==id),op=c.competitors.find(x=>x.team.id!=id),f=x=>+(x.score&&x.score.value!=null?x.score.value:x.score);if(f(me)>0)res.push({d:e.date,pf:f(me),pa:f(op)})}}catch{}if(res.length>=10)break}
  const a=res.sort((x,y)=>y.d.localeCompare(x.d)).slice(0,12);if(a.length<4)return null;return{pf:a.reduce((t,x)=>t+x.pf,0)/a.length,pa:a.reduce((t,x)=>t+x.pa,0)/a.length,n:a.length,dts:a.slice(0,5).map(x=>x.d)}}
// ---- Rival, ritmo y descanso (ESPN standings, gratis y sin llave) ----
async function nbRatings(force){
  const c=LS('nb_rt',null);if(!force&&c&&Date.now()-c.t<6*36e5)return c.v;
  const base='https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
  const read=async q=>{const r=await nbFetchESPN(base+q).catch(()=>null);if(!r)return null;const j=await r.json(),es=[],t={};
    const walk=x=>{if(x.standings&&x.standings.entries)es.push(...x.standings.entries);(x.children||[]).forEach(walk)};walk(j);
    for(const e of es){const st={};(e.stats||[]).forEach(q=>st[q.name]=q.value);
      const gp=+st.gamesPlayed||((+st.wins||0)+(+st.losses||0)),pf=st.avgPointsFor!=null?+st.avgPointsFor:+st.pointsFor/gp,pa=st.avgPointsAgainst!=null?+st.avgPointsAgainst:+st.pointsAgainst/gp;
      if(gp>0&&pf>80&&pa>80&&e.team)t[e.team.id]={gp,pf,pa}}
    return Object.keys(t).length>=20?t:null};
  const cur=await read('').catch(()=>null),prev=await read('?season='+(seasonEnd()-1)).catch(()=>null);
  if(!cur&&!prev)return null;
  // Al inicio de temporada pesa la anterior: la actual entra poco a poco (como si la anterior fueran 15 juegos).
  const t={};let S=0,N=0;
  for(const id of new Set([...Object.keys(cur||{}),...Object.keys(prev||{})])){
    const a=cur&&cur[id],b=prev&&prev[id],g0=a?a.gp:0,w=b?15:0,d=g0+w;if(!d)continue;
    const pf=((a?a.pf*g0:0)+(b?b.pf*w:0))/d,pa=((a?a.pa*g0:0)+(b?b.pa*w:0))/d;t[id]={gp:g0,pf,pa};S+=pf;N++}
  if(N<20)return null;
  const v={L:S/N,t};SV('nb_rt',{t:Date.now(),v});return v}
function nbRest(g,s){const f=s.f;if(!f||!f.dts||!f.dts.length)return{b2b:false,n4:0,d:null};const t=Date.parse(g.date),h=(t-Date.parse(f.dts[0]))/36e5;
  return{b2b:h<30,n4:f.dts.filter(d=>(t-Date.parse(d))/36e5<100).length,d:h}}
const restPen=r=>r.b2b?1.8:(r.n4>=2?.8:0),restF=r=>r.b2b?.97:(r.n4>=2?.985:(r.d!=null&&r.d>=72?1.01:1));
function nbCtx(g,tm,s){const mine=tm===g.h.ab?g.h:g.a,opp=tm===g.h.ab?g.a:g.h,L=NB.rt&&NB.rt.L,r=nbRest(g,mine);let def=1,pace=1;
  if(L&&opp.r&&mine.r){def=1+(Math.max(.9,Math.min(1.1,opp.r.pa/L))-1)*.7;pace=Math.pow(Math.max(.96,Math.min(1.04,(opp.r.pf+opp.r.pa+mine.r.pf+mine.r.pa)/(4*L))),.5)}
  const d=Math.pow(def,({pts:1,pra:.7,ast:.5,tp:.5,reb:.2})[s]??.5);
  return{f:d*pace*restF(r),def:d,pace,rest:restF(r),r}}
const nbCtxNote=c=>{const x=c&&c.cx;if(!x)return '';const p=[],pc=v=>(v>1?'+':'')+Math.round((v-1)*100)+'%';
  if(Math.abs(x.def-1)>.008)p.push('defensa rival '+(x.def>1?'permisiva':'sólida')+' ('+pc(x.def)+')');
  if(Math.abs(x.pace-1)>.008)p.push('ritmo del partido '+pc(x.pace));
  if(x.r&&x.r.b2b)p.push('back-to-back (−3%)');else if(x.r&&x.r.n4>=2)p.push('3.er juego en 4 noches (−1.5%)');else if(x.rest>1)p.push('equipo descansado (+1%)');
  return p.length?'<div class="mr-s" style="margin-top:6px">Contexto: '+p.join(' · ')+'</div>':''};
function gameModel(g){if(!g.h.f||!g.a.f)return null;
  const L=NB.rt&&NB.rt.L,rh=g.h.r,ra=g.a.r;let hp,ap;
  if(L&&rh&&ra){const pfh=.5*g.h.f.pf+.5*rh.pf,pah=.5*g.h.f.pa+.5*rh.pa,pfa=.5*g.a.f.pf+.5*ra.pf,paa=.5*g.a.f.pa+.5*ra.pa;hp=L+.85*((pfh-L)+(paa-L))+1.5;ap=L+.85*((pfa-L)+(pah-L))-1.5}
  else{hp=(g.h.f.pf+g.a.f.pa)/2+1.5;ap=(g.a.f.pf+g.h.f.pa)/2-1.5}
  const r1=nbRest(g,g.h),r2=nbRest(g,g.a);hp-=restPen(r1);ap-=restPen(r2);
  return{hp,ap,tot:hp+ap,mar:hp-ap,rest:{h:r1,a:r2},rt:!!(L&&rh&&ra)}}

// ---- Escaneo ----
// Líneas gratis de ESPN (spread y total). Solo traen la línea, no el precio.
function espnLn(c,h,a){const o=(c.odds||[])[0];if(!o)return null;const r={},d=String(o.details||'').trim(),m=d.match(/^([A-Z]{2,4})\s+([+-]?\d+(?:\.\d+)?)$/);
  if(m){const n=+m[2];if(m[1]===h.ab)r.sp=n;else if(m[1]===a.ab)r.sp=-n}else if(/^(EVEN|PK)$/i.test(d))r.sp=0;
  if(o.overUnder!=null&&+o.overUnder>150)r.ou=+o.overUnder;
  return(r.sp!=null||r.ou!=null)?r:null}
async function nbTeam(g,s,inj){
  s.f=g.src==='API-NBA'?null:await teamForm(s.id);
  let all=[];
  // ESPN sigue siendo la primera fuente. Si falla o no trae historial suficiente, API-NBA aporta estadísticas reales por equipo.
  try{
    if(g.src==='API-NBA')throw new Error('calendario alternativo');
    const ro=await nbj(NE+'teams/'+s.id+'/roster'),A=(ro.athletes||[]).flatMap(x=>x.items||[x]).filter(x=>x&&x.id);
    const L=await pool(A,6,async a=>({a,g:await glog(a.id)}));
    all=L.filter(x=>x&&x.g&&x.g.length>=3).map(x=>{const n=x.a.displayName||x.a.fullName,r0=nzInj(((x.a.injuries||[])[0]||{}).status),s0=ns(n)||inj[nz(n)]||(r0?{s:r0,c:''}:null);return{id:x.a.id,n,pos:(x.a.position||{}).abbreviation||'',st:s0?s0.s:'',nt:s0?s0.c:'',tm:s.ab,g:x.g,mn:x.g.slice(0,8).reduce((t,r)=>t+r[0],0)/Math.min(8,x.g.length),src:'ESPN'}});
  }catch(e){s.espnPlayerErr=e.message}
  // No mezclar estadísticas históricas de API-NBA (2022–2024) con picks actuales.
  const outMin=all.filter(p=>p.st==='out'&&p.mn>=14).reduce((t,p)=>t+p.mn,0);s.out=all.filter(p=>p.st==='out'&&p.mn>=10).map(p=>p.n);s.boost=1+Math.min(.12,outMin/240*.5);
  s.pl=all.filter(p=>p.mn>=14&&p.st!=='out'&&p.g&&p.g.length>=3).sort((a,b)=>b.mn-a.mn).slice(0,NB.hunt?Math.min(NC.per,6):NC.per)}
async function nbScan(hunt){const msg=$('#nbmsg'),bs=[$('#nbgo'),$('#nbhunt')].filter(Boolean);bs.forEach(b=>b.disabled=true);NB.hunt=hunt===true;
  try{const d=new Date(Date.now()+NC.day*864e5),ds=d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate()),apiDate=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());msg.textContent='Buscando partidos…';
    let sb=null,espnError='';try{sb=await nbj(NE+'scoreboard?dates='+ds)}catch(e){espnError=e.message}
    NB.g=(sb&&sb.events||[]).filter(e=>!(e.status&&e.status.type&&e.status.type.completed)&&!(e.status&&e.status.type&&e.status.type.state==='in')).slice(0,NB.hunt?12:NC.games).map(e=>{const c=e.competitions[0],t=h=>{const x=c.competitors.find(y=>y.homeAway===h).team;return{id:x.id,n:x.displayName,ab:x.abbreviation}};const g={id:e.id,date:e.date,h:t('home'),a:t('away'),pl:[],src:'ESPN'};g.ln=espnLn(c,g.h,g.a);return g});
    // No usar calendario histórico de API-NBA como si fueran partidos actuales.
    if(!NB.g.length){msg.textContent='No hay partidos NBA sin jugar para ese día.'+(espnError?' ESPN: '+espnError+'.':'');$('#nbres').innerHTML='';return}
    let oddsErr='';NB.od=null;if(NC.keys.trim()){msg.textContent='Cuotas…';try{NB.od=await nbOdds(NB.g)}catch(e){oddsErr=' Cuotas: '+e.message+'.'}}
    NB.rt=null;try{NB.rt=await nbRatings()}catch{}
    NB.g.forEach(g=>{g.h.r=NB.rt&&NB.rt.t[g.h.id]||null;g.a.r=NB.rt&&NB.rt.t[g.a.id]||null});
    const inj=await nbInj(),T=[];NB.g.forEach(g=>{T.push([g,g.h]);T.push([g,g.a])});let k=0;
    await pool(T,3,async([g,s])=>{try{await nbTeam(g,s,inj)}catch(e){s.f=s.f||null;s.pl=s.pl||[];s.out=s.out||[]}msg.textContent='Equipos y jugadores '+(++k)+'/'+T.length+'…'});
    const nOd=NB.od?Object.keys(NB.od).length:0;
    msg.textContent='Listo. '+NB.g.length+' partidos ('+(NB.g.some(g=>g.src==='API-NBA')?'calendario API-NBA':'calendario ESPN')+').' +(NB.od?' Props de jugadores publicados en '+(NB.pn||0)+' partido(s).'+((NB.perr||[]).length?' ('+NB.perr.slice(0,2).join(' · ')+')':''):'')+(NB.rt?' Rival y ritmo: ratings de temporada aplicados.':' Sin ratings de temporada (ESPN standings): solo forma reciente.')+(NB.od?' Cuotas reales en '+nOd+' (~'+(3+5*nOd)+' créditos).':(NC.keys.trim()?'':' Sin llave de The Odds API: solo lecturas del modelo con líneas de ESPN, sin cuota real.'))+oddsErr;
    nbDraw()}
  catch(e){msg.textContent='Error: '+e.message+'. Usa «Probar fuentes».'}finally{bs.forEach(b=>b.disabled=false)}}

// ---- Dibujo ----
const f1=x=>x.toFixed(1);
function nbPropOpts(g,p,s){const P=proj(p.g,s);if(!P)return null;const bs=(p.tm===g.h.ab?g.h:g.a).boost||1;const cx=nbCtx(g,p.tm,s);P.m*=bs*cx.f;P.v*=bs*cx.f;P.bs=bs;P.cx=cx;const od=NB.od&&NB.od[g.id]&&NB.od[g.id].o,mk={pts:'player_points',reb:'player_rebounds',ast:'player_assists',tp:'player_threes',pra:'player_points_rebounds_assists'}[s],ov=od&&od[mk+'|'+nz(p.n)+'|Over'],un=od&&od[mk+'|'+nz(p.n)+'|Under'],key=g.id+p.id+s;
  const L=NB.ln[key]!=null?NB.ln[key]:(ov?ov.p:Math.floor(P.med)+.5),po=pOver(P,L),side=(o,pr,name)=>{const q=o&&o.p===L?o.q:null;return{name,pr,q,e:q?pr*q-1:null}};
  return{P,L,key,ov:side(ov,po,'Más'),un:side(un,1-po,'Menos'),real:!!ov}}
function propBlk(g,p,s){const o=nbPropOpts(g,p,s);if(!o)return '<p class="status">Pocos partidos para proyectar.</p>';const {P,L,key}=o,a=[...P.a].slice(0,10).reverse(),mx=Math.max(L*1.5,...a,1);
  const bars=a.map(x=>`<div class="nb-b"><i class="${x>L?'ok':'no'}" style="height:${Math.max(4,x/mx*100)}%"></i><span>${x}</span></div>`).join('');
  const sd=x=>{NB.reg[key+x.name]={t:`${p.n} ${STX[s][0]} ${x.name} ${L}`,p:x.pr,q:x.q,g:g.h.ab+'-'+g.a.ab,st:STX[s][0],gid:g.id,ko:g.date,meta:{t:'pr',pid:p.id,stat:s,side:x.name,line:L}};return `<button class="nb-s${x.e!=null&&x.e>.03?' va':''}" onclick="nbLog('${key+x.name}')"><b>${x.name} ${L}</b><span>${Math.round(x.pr*100)}%</span><small>${x.q?'@'+x.q+(x.e!=null?' · valor '+(x.e>=0?'+':'')+Math.round(x.e*100)+'%':''):'justa @'+(1/x.pr).toFixed(2)}</small></button>`};
  return `<div class="nb-bars" style="--ln:${L/mx*100}%">${bars}<u></u></div><div class="nb-ln">Proy. <b>${f1(P.m)}</b> · mediana ${P.med} · línea <input type="number" step=".5" value="${L}" onchange="NB.ln['${key}']=+this.value;nbDraw()"> ${o.real?'<em>cuota EE. UU.</em>':'<em>sin línea real</em>'}</div><div class="nb-sd">${sd(o.ov)}${sd(o.un)}</div>${P.cur<5?'<p class="status">Pocos juegos de esta temporada: se usa también la anterior y se recorta la confianza.</p>':''}${P.bs>1.02?'<p class="status">+'+Math.round((P.bs-1)*100)+'% por bajas del equipo.</p>':''}${nbCtxNote({cx:P.cx})}`}
function gameRows(g){const m=gameModel(g);if(!m)return '<p class="status">Sin datos suficientes del equipo.</p>';const ob=[...(g.a.out||[]).map(x=>g.a.ab+' '+esc(x)),...(g.h.out||[]).map(x=>g.h.ab+' '+esc(x))];
  const rs=[];if(m.rest.h.b2b)rs.push(g.h.ab+' juega back-to-back');else if(m.rest.h.n4>=2)rs.push(g.h.ab+': 3.er juego en 4 noches');if(m.rest.a.b2b)rs.push(g.a.ab+' juega back-to-back');else if(m.rest.a.n4>=2)rs.push(g.a.ab+': 3.er juego en 4 noches');
  return `<p class="nb-pj">Proyección: ${g.a.ab} <b>${Math.round(m.ap)}</b> – ${g.h.ab} <b>${Math.round(m.hp)}</b> · total ${f1(m.tot)}${ob.length?'<br><small>Bajas: '+ob.join(', ')+'</small>':''}${rs.length?'<br><small>Descanso: '+rs.join(' · ')+'</small>':''}<br><small>${m.rt?'Incluye fuerza de ataque y defensa de cada equipo en la temporada.':'Solo forma reciente: no se pudieron leer los ratings de temporada.'}</small></p>`+gameCands(g).map((c,i)=>{const k=g.id+'G'+i;NB.reg[k]={t:g.a.ab+'@'+g.h.ab+' '+c.n,p:c.p,q:c.q,g:'',st:'Partido',gid:g.id,ko:g.date,meta:c.meta||null};return `<div class="nb-gr"><span>${c.n}</span><b>${Math.round(c.p*100)}%</b><small>${c.q?'@'+c.q+' · valor '+Math.round((c.p*c.q-1)*100)+'%':'justa @'+(1/c.p).toFixed(2)}</small>${c.q?`<button class="btn s" onclick="nbLog('${k}')">＋</button>`:''}</div>`}).join('')}
// ---- Motor de picks NBA (mismas reglas de fondo que fútbol: cuota real, valor, ancla al mercado, veto) ----
function nbAll(g){const C=[];
  gameCands(g).forEach((c,i)=>C.push({k:'TG'+g.id+i,kind:'Partido',n:c.n,full:g.a.ab+'@'+g.h.ab+' · '+c.n,p:c.p,q:c.q,fair:c.fair==null?null:c.fair,real:true,meta:c.meta||null}));
  [g.h,g.a].forEach(s=>s.pl.forEach(p=>Object.keys(STX).forEach(st=>{const o=nbPropOpts(g,p,st);if(!o)return;const a=o.ov.q,b=o.un.q,pf=a&&b?[(1/a)/(1/a+1/b),(1/b)/(1/a+1/b)]:[null,null];
    [o.ov,o.un].forEach((x,i)=>C.push({k:'T'+o.key+x.name,kind:STX[st][0],n:p.n+' '+STX[st][0]+' '+x.name+' '+o.L,full:p.n+' '+STX[st][0]+' '+x.name+' '+o.L,p:x.pr,q:x.q,fair:pf[i],real:o.real,cur:o.P.cur,na:o.P.a.length,bs:o.P.bs,cx:o.P.cx,arr:o.P.a.slice(0,10),L:o.L,side:x.name,meta:{t:'pr',pid:p.id,stat:st,side:x.name,line:o.L}}))})));
  // Líneas alternativas con cuota real (opcional): permiten líneas conservadoras que sí existen en la casa
  if(NC.alt){const od=NB.od&&NB.od[g.id]&&NB.od[g.id].o;if(od){const AM={pts:'player_points_alternate',reb:'player_rebounds_alternate',ast:'player_assists_alternate',tp:'player_threes_alternate'};
    [g.h,g.a].forEach(s=>s.pl.forEach(p=>Object.keys(AM).forEach(st=>{const pre=AM[st]+'|'+nz(p.n)+'|Over@',ks=Object.keys(od).filter(k=>k.startsWith(pre));if(!ks.length)return;const o=nbPropOpts(g,p,st);if(!o)return;
      ks.forEach(k=>{const a=od[k],L=a.p;if(L==null||a.q==null)return;const u=od[AM[st]+'|'+nz(p.n)+'|Under@'+L],fair=u&&u.q?(1/a.q)/(1/a.q+1/u.q):null,tx=p.n+' '+STX[st][0]+' Más '+L+' (alt.)';
        C.push({k:'TA'+g.id+p.id+st+L,kind:STX[st][0],n:tx,full:tx,p:pOver(o.P,L),q:a.q,fair,real:true,cur:o.P.cur,na:o.P.a.length,bs:o.P.bs,cx:o.P.cx,arr:o.P.a.slice(0,10),L,side:'Más',meta:{t:'pr',pid:p.id,stat:st,side:'Más',line:L}})})})))}}
  return C}
// Si un tipo de pick lleva 10+ resueltos y acierta 8+ puntos menos de lo que prometía, solo se propone con más exigencia
function nbGate(kind){const D=NB.picks.filter(x=>x.res&&x.st===kind);if(D.length<10)return null;const w=D.filter(x=>x.res==='w').length,pr=D.reduce((t,x)=>t+x.p,0)/D.length;return w/D.length<pr-.08?{p:.66,e:.04}:null}
function nbCands(g){const out=[],veto=[];
  for(const c of nbAll(g)){
    if(!c.real||c.q==null||c.q<1.01)continue;
    if(c.fair!=null&&c.p-c.fair>.12){veto.push({n:c.n,p:c.p,ref:c.fair});continue}
    const F=FM(),pr=c.fair!=null?.5*c.p+.5*c.fair:c.p,e=pr*c.q-1,pmin={r:.56,s:.56,b:.54,w:.5}[cfg.fm||'r']||.56;
    const GT=nbGate(c.kind);
    if(c.q<Math.max(F.qa,1.2)||c.q>Math.min(F.qb,2.6)||pr<pmin||e<Math.max(F.ea,.01)||e>.25||(GT&&(pr<GT.p||e<GT.e)))continue;
    const sc=pr*.6+Math.min(e,.12)*1.5+(c.kind==='Partido'?.01:0)-(c.cur!=null&&c.cur<5?.03:0)-(c.fair==null?.02:0);
    out.push(Object.assign({},c,{p:pr,pm:c.p,e,sc}))}
  return{out:out.sort((a,b)=>b.sc-a.sc),veto}}
// Sin cuota real: solo mercados de partido (con línea de ESPN o moneyline) y con tope de stake bajo.
function nbLean(g){if(!gameModel(g))return null;const c=nbAll(g).filter(x=>x.kind==='Partido'&&x.q==null&&x.p>=.55).sort((a,b)=>b.p-a.p)[0];return c?Object.assign({},c,{e:null,sc:c.p}):null}
// Pick de jugador sin cuota real: busca una línea conservadora (segunda peor marca de los últimos 10) que el modelo y el historial respaldan.
function nbLeanProp(g){let best=null;NB.dg=NB.dg||{n:0,ok:0};
  [g.h,g.a].forEach(s=>s.pl.forEach(p=>{if(p.st||p.mn<20)return;Object.keys(STX).forEach(st=>{
    const P=proj(p.g,st);NB.dg.n++;if(!P||P.a.length<8)return;NB.dg.ok++;
    const bs=s.boost||1,cx=nbCtx(g,p.tm,st);P.cx=cx;P.m*=cx.f;P.v*=cx.f;const a=P.a.slice(0,10),srt=[...a].sort((x,y)=>x-y),L=srt[1]-.5;
    if(L<.5||L<.6*P.med)return;
    const hits=a.filter(x=>x>L).length/a.length,po=pOver({m:P.m*bs,v:P.v*bs,cur:P.cur},L),pe=(hits*a.length+2)/(a.length+4),pp=Math.min(po,pe);
    if(hits<.8||pp<(P.cur>=5?.66:.6))return;
    const c={k:'TP'+g.id+p.id+st,kind:STX[st][0],n:p.n+' '+STX[st][0]+' Más '+L,full:p.n+' '+STX[st][0]+' Más '+L,p:pp,q:null,e:null,fair:null,real:false,cur:P.cur,na:a.length,bs,hits:a.filter(x=>x>L).length+'/'+a.length,sc:pp,cx:P.cx,arr:a,L,side:'Más',meta:{t:'pr',pid:p.id,stat:st,side:'Más',line:L}};
    if(!best||c.sc>best.sc)best=c})}));
  return best}
// Barras estilo props.cash: últimos 10 juegos contra la línea + aciertos de los últimos 5 y 10
function nbBars(c){if(!c.arr||c.L==null)return '';const a=[...c.arr].slice(0,10),over=c.side!=='Menos',hit=x=>over?x>c.L:x<c.L,o=[...a].reverse(),mx=Math.max(c.L*1.5,...a,1);
  const bars=o.map(x=>`<div class="nb-b"><i class="${hit(x)?'ok':'no'}" style="height:${Math.max(4,x/mx*100)}%"></i><span>${x}</span></div>`).join('');
  const hr=n=>{const z=a.slice(0,n),h=z.filter(hit).length;return `<span class="chip2 ${z.length&&h/z.length>=.7?'ok':'bad'}">Últ. ${n}: ${h}/${z.length}</span>`};
  const avg=a.reduce((t,x)=>t+x,0)/a.length;
  return `<div class="nb-bars" style="--ln:${c.L/mx*100}%">${bars}<u></u></div><div class="nb-ln">Línea <b>${c.L}</b> (${over?'más':'menos'}) · promedio <b>${f1(avg)}</b> · ${hr(5)} ${hr(10)}</div>`}
function nbStake(c){let b=c.p>=.7?7:c.p>=.63?6:c.p>=.58?5:4;
  if(c.e==null||c.e<.03)b=Math.min(b,3);else if(c.e<.06)b=Math.min(b,5);else if(c.e<.1)b=Math.min(b,6);
  if(c.fair==null)b=Math.min(b,4);
  if(c.kind!=='Partido'&&((c.cur!=null&&c.cur<5)||(c.na!=null&&c.na<8)))b=Math.min(b,4);
  if(c.bs>1.02)b-=1;
  return Math.max(1,Math.min(9,b))}
function nbWhy(g,veto){
  if(!gameModel(g))return 'Sin datos suficientes de los equipos (ESPN no devolvió sus últimos partidos).';
  const t=nbAll(g).filter(x=>x.kind==='Partido').sort((a,b)=>b.p-a.p)[0],dg=t?' Mejor lectura del modelo: '+esc(t.n)+' ('+Math.round(t.p*100)+'%), sin ventaja suficiente: partido parejo.':'';
  if(!NB.od)return 'Partido parejo para el modelo (ninguna lectura llega a 55%) y no hay cuotas reales (falta la llave de The Odds API o no se emparejó).'+dg;
  if(veto&&veto.length){const v=veto.sort((a,b)=>(b.p-b.ref)-(a.p-a.ref))[0];return 'El modelo está mucho más optimista que el mercado en '+esc(v.n)+' (modelo '+Math.round(v.p*100)+'% contra '+Math.round(v.ref*100)+'% del mercado). Se descarta: suele ser error del modelo.'}
  {const F=FM();return 'Ningún mercado cumple a la vez cuota de '+F.qa+' a '+F.qb+', probabilidad suficiente y valor de '+Math.round(Math.max(F.ea,.01)*100)+'% a '+Math.round(F.eb*100)+'% (filtro «'+({s:'estricto',b:'equilibrado',w:'amplio'}[cfg.fm||'b'])+'» de Ajustes).'+dg}}
// Mensaje según el motivo real por el que un pick no tiene cuota (antes siempre pedía la llave, aunque ya estuviera conectada)
function nbNoOddsNote(g,c){
  const key=NC.keys&&NC.keys.trim(),od=NB.od&&NB.od[g.id]&&NB.od[g.id].o;
  if(!key)return 'Sin cuota real no hay valor comprobable. Solo úsalo si tu casa paga al menos la cuota mínima. Con una llave gratis de The Odds API la app verifica el valor.';
  if(!od)return 'The Odds API está conectada, pero aún no devuelve cuotas de este partido (las casas suelen publicarlas pocas horas antes). Vuelve a escanear más tarde; mientras, usa este pick solo si tu casa paga al menos la cuota mínima.';
  const props=Object.keys(od).some(k=>k.startsWith('player_'));
  if(c&&c.kind!=='Partido'&&!props)return 'Hay cuotas del partido, pero The Odds API aún no publica props de jugadores para él. Vuelve a escanear más tarde.';
  return (c&&c.kind!=='Partido'?'Las casas de EE. UU. no ofrecen esa línea para este jugador.':'No hay cuota para este mercado de partido.')+' Confirma en tu casa que paga al menos la cuota mínima.';
}
function nbTicket(g,c,lean,veto,label){
  if(!c)return '<div class="nopick2"><b>Sin pick con ventaja clara</b><p>'+nbWhy(g,veto)+'</p></div>';
  const st=nbStake(c);
  NB.reg[c.k]={t:c.full,p:c.p,q:c.q,g:g.a.ab+'@'+g.h.ab,st:c.kind,sk:st,gid:g.id,ko:g.date,meta:c.meta||null};
  return `<div class="tk ${lean?'':'A'}"><small class="tkl">${label||(lean?'LECTURA DEL MODELO · SIN CUOTA REAL':'PICK DE LA APP · SEGÚN REGLAS')}</small><div class="tk1"><b class="n">${esc(c.n)}</b></div>
<div class="tk2"><span><b>${Math.round(c.p*100)}%</b> prob.</span>${c.q?`<span>cuota <b>@${c.q}</b></span><span>valor <b>${c.e>=0?'+':''}${Math.round(c.e*100)}%</b></span>`:`<span>cuota mínima <b>@${(1.05/c.p).toFixed(2)}</b></span>`}<span>stake base <b>${st}/9</b></span></div>
<div class="meter${st>=5?' hi':''}" role="img" aria-label="Stake ${st} de 9">${Array.from({length:9},(_,k)=>`<i class="${k<st?'f':''}"></i>`).join('')}</div>
${nbBars(c)}${nbCtxNote(c)}${c.hits?'<div class="mr-s" style="margin-top:6px">Superó esa línea en <b>'+c.hits+'</b> de sus últimos partidos. Verifica que tu casa tenga esa línea (o más baja) y confirma que juega.</div>':''}${lean?'<div class="tkw">'+nbNoOddsNote(g,c)+'</div>':''}
<div class="acts2" style="margin-top:8px"><button class="btn s" onclick="nbLog('${c.k}')">＋ Registrar pick</button></div></div>`}
const nbPlayers=g=>[g.h,g.a].flatMap(s=>s.pl).sort((a,b)=>b.mn-a.mn).map(p=>{const s=NB.sel[p.id]||'pts';return `<div class="nb-p"><div class="nb-ph"><b>${esc(p.n)}</b><small>${p.tm} · ${p.pos} · ${Math.round(p.mn)} min${p.st?' · <i class="bad">'+({doubt:'Duda fuerte',q:'Duda'}[p.st]||p.st)+'</i>':''}</small></div><div class="nb-ch">${Object.keys(STX).map(k=>`<button class="${k===s?'on':''}" onclick="NB.sel['${p.id}']='${k}';nbDraw()">${STX[k][0]}</button>`).join('')}</div>${propBlk(g,p,s)}</div>`}).join('');
function nbCard(g){
  const R0=nbCands(g),best=R0.out[0]||null,lean=best?null:nbLean(g),pr=R0.out.find(c=>c.kind!=='Partido'&&(!best||c.k!==best.k)),pl=pr||((best&&best.kind!=='Partido')?null:(NC.lp?nbLeanProp(g):null)),pcard=pl?nbTicket(g,pl,!pr,null,pr?'PICK DE JUGADOR · SEGÚN REGLAS':'PICK DE JUGADOR · SIN CUOTA REAL'):'<div class="nopick2"><b>Sin pick de jugador</b><p>Ningún jugador cumple la línea en 8 de 10 partidos con 20+ minutos y sin duda de lesión. Jugadores leídos: '+[g.h,g.a].reduce((t,x)=>t+x.pl.length,0)+(NB.g.length&&![g.h,g.a].some(x=>x.pl.length)?'. ESPN no devolvió estadísticas de jugadores para este partido: usa «Probar fuentes».':'. Con la temporada recién empezada se usan juegos de la temporada pasada y el filtro es más estricto.')+'</p></div>',tm=new Date(g.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const top=best||lean||pr||pl;
  const player=pr||pl;
  const topTxt=top?esc(top.n)+' · '+Math.round(top.p*100)+'%':'Sin pick destacado';
  const playerTxt=player?('Jugador: '+esc(player.n)+' · '+Math.round(player.p*100)+'%'):'Jugador: sin pick que pase los filtros';
  return `<details class="nb-game"><summary><span class="nb-game-title"><span class="pill">NBA</span><b>${esc(g.a.n)} @ ${esc(g.h.n)}</b><small>${dlab(g.date)}${tm}</small></span><span class="nb-game-picks"><b>${topTxt}</b><small>${playerTxt}</small></span><span class="nb-game-arrow">⌄</span></summary><article class="card mc"><div class="mh"><span class="pill">NBA</span><span class="ko">${dlab(g.date)}${tm}</span></div><div class="mt"><b>${esc(g.a.n)}</b><em>@</em><b>${esc(g.h.n)}</b></div>
${nbTicket(g,best||lean,!best&&!!lean,R0.veto)}
${pcard}
<div class="acts2"><button class="btn" onclick="nbAI('${g.id}')">✦ Análisis IA</button></div><div class="ai" id="nbai${g.id}" hidden></div>
<details class="dd"><summary>Proyección, mercados y jugadores</summary>${gameRows(g)}<div class="sec">Jugadores</div>${nbPlayers(g)}</details></article></details>`}
function nbDraw(){nbK();const box=$('#nbres');if(!NB.g.length){box.innerHTML='';return}NB.reg={};
  let head='';
  if(NB.hunt){
    const real=NB.g.map(g=>({g,c:nbCands(g).out[0]})).filter(x=>x.c).sort((a,b)=>b.c.sc-a.c.sc).slice(0,3);
    const lean=real.length?[]:NB.g.flatMap(g=>[{g,c:nbLean(g)},{g,c:(NC.lp?nbLeanProp(g):null)}]).filter(x=>x.c).sort((a,b)=>b.c.p-a.c.p).slice(0,3);
    const L=real.length?real:lean,isLean=!real.length;
    head=`<div class="card"><h2>Mejor pick NBA</h2><small>${L.length?(isLean?'Ningún mercado tiene cuota real con valor (o falta la llave de cuotas). Estas son las lecturas más fuertes del modelo, sin cuota verificada.':'Los '+L.length+' picks con mejor puntaje de '+NB.g.length+' partidos revisados. Cuota real, valor estimado entre 2% y 22% y sin contradecir al mercado.'):'De '+NB.g.length+' partidos revisados, ninguno tiene un pick que pase los filtros. Es normal: casi nunca hay.'}</small>${L.map(x=>`<div class="mt" style="margin-top:12px"><b>${esc(x.g.a.n)}</b><em>@</em><b>${esc(x.g.h.n)}</b></div>${nbTicket(x.g,x.c,isLean)}`).join('')}</div>`}
  box.innerHTML=head+NB.g.map(nbCard).join('');nbPicks()}
function nbLog(k){const r=NB.reg[k];if(!r)return;const kf=x=>x.meta?x.gid+JSON.stringify(x.meta):x.t+'|'+x.d;if(NB.picks.some(x=>kf(x)===kf({meta:r.meta,gid:r.gid||null,t:r.t,d:today()}))){toast('Ese pick ya está registrado');return}NB.picks.unshift({id:Date.now(),t:r.t,p:+r.p.toFixed(3),q:r.q,st:r.st||'',sk:r.sk||null,gid:r.gid||null,ko:r.ko||null,meta:r.meta||null,res:null,d:today()});SV('nbapicks',NB.picks);nbPicks();toast('Pick NBA registrado')}
function nbK(){const D=NB.picks.filter(x=>x.res),w=D.filter(x=>x.res==='w').length,E=D.reduce((t,x)=>t+x.p,0);NB.k=Math.max(.45,Math.min(.85,.75*(D.length>=8?(w+6)/(E+6):1)))}
// ---- Registro de aciertos NBA (mismo estilo del menú Modelo de fútbol) ----
function nbTab(t){NB.tab=t;nbPicks()}
function nbSetRes(id,r){const k=NB.picks.find(x=>String(x.id)===String(id));if(!k)return;k.res=r;SV('nbapicks',NB.picks);nbPicks()}
function nbDel(id){NB.picks=NB.picks.filter(x=>String(x.id)!==String(id));SV('nbapicks',NB.picks);nbPicks()}
// Resuelve solo los picks pendientes con el boxscore de ESPN (partido, spread, total y props de jugador)
async function nbAutoRes(manual){
  const P=NB.picks.filter(x=>!x.res&&x.gid&&x.meta);let n=0;
  if(!P.length){if(manual)toast('No hay picks pendientes con datos para resolver');return}
  const ids=[...new Set(P.map(x=>x.gid))];
  await pool(ids,3,async gid=>{
    const j=await nbj(NE+'summary?event='+gid),c=((j.header||{}).competitions||[])[0];
    if(!c||!(c.status&&c.status.type&&c.status.type.completed))return;
    const sc={};for(const x of c.competitors||[])sc[x.team.abbreviation]=+x.score;
    const box={};for(const t of (j.boxscore&&j.boxscore.players)||[]){const S=(t.statistics||[])[0];if(!S)continue;const lab=S.labels||[],ix=q=>lab.indexOf(q);
      for(const a of S.athletes||[]){const st=a.stats||[];if(!a.athlete)continue;box[a.athlete.id]={min:+st[ix('MIN')]||0,pts:+st[ix('PTS')]||0,reb:+st[ix('REB')]||0,ast:+st[ix('AST')]||0,tp:+String(st[ix('3PT')]||'0').split('-')[0]||0}}}
    const abs=Object.keys(sc);
    for(const pk of P.filter(x=>x.gid===gid)){const m=pk.meta;let r=null;
      const cmp=(v,l,over)=>v===l?'v':((over?v>l:v<l)?'w':'l');
      if(m.t==='ml'&&abs.length===2){const o=abs.find(x=>x!==m.tm);if(sc[m.tm]!=null&&sc[o]!=null)r=sc[m.tm]>sc[o]?'w':'l'}
      else if(m.t==='sp'&&abs.length===2){const o=abs.find(x=>x!==m.tm);if(sc[m.tm]!=null&&sc[o]!=null)r=cmp(sc[m.tm]-sc[o]+m.line,0,true)}
      else if(m.t==='tot'&&abs.length===2)r=cmp(sc[abs[0]]+sc[abs[1]],m.line,m.side==='over');
      else if(m.t==='pr'){const b=box[m.pid];if(!b||b.min<=0)r='v';else{const v=m.stat==='pra'?b.pts+b.reb+b.ast:b[m.stat];r=cmp(v,m.line,m.side!=='Menos')}}
      if(r){pk.res=r;n++}}
  });
  if(n){SV('nbapicks',NB.picks);nbPicks()}
  if(manual)toast(n?n+' picks resueltos':'Aún no terminan los partidos de tus picks pendientes');
}
function nbPicks(target='#nbpk',statsOnly=false,noMenu=false){if(arguments.length===0&&typeof mdlTab!=='undefined'&&mdlTab==='nba'&&document.querySelector('#nbamodel-body'))setTimeout(drawModel,0);nbK();
  const P=NB.picks,D=P.filter(x=>x.res==='w'||x.res==='l'),pend=P.filter(x=>!x.res).length,nW=D.filter(x=>x.res==='w').length,nL=D.length-nW,nV=P.filter(x=>x.res==='v').length,tab=statsOnly?'res':(NB.tab||'all');
  const pr=a=>a.length?Math.round(100*a.reduce((t,x)=>t+x.p,0)/a.length):0,hit=a=>a.length?Math.round(100*a.filter(x=>x.res==='w').length/a.length):0;
  const row=(t,a)=>a.length?rwRow(t,a.filter(x=>x.res==='w').length,a.length,pr(a)):'';
  const brier=D.length?D.reduce((t,x)=>t+Math.pow(x.p-(x.res==='w'?1:0),2),0)/D.length:null,Dq=D.filter(x=>x.q),roi=Dq.reduce((t,x)=>t+(x.res==='w'?x.q-1:-1),0);
  const tabs=[['all','Todos',P.length],['p','Pendientes',pend],['w','Acertados',nW],['l','Fallados',nL]];if(nV)tabs.push(['v','Nulos',nV]);
  const menu=(statsOnly||noMenu)?'':`<div class="seg m model-filter-bar" role="tablist" aria-label="Filtros del Modelo NBA">${tabs.map(([k,t,n])=>`<button type="button" role="tab" aria-selected="${tab===k}" class="${tab===k?'on':''}" onclick="nbTab('${k}')"><span>${t}</span><b class="${k==='w'?'ok':k==='l'?'bad':k==='p'?'pending':''}">${n}</b></button>`).join('')}</div><button class="btn" onclick="nbAutoRes(true)">Actualizar resultados</button>`;
  const item=x=>{const B=(r,t)=>`<button class="btn s ${x.res===r?'on':''}" onclick="nbSetRes(${x.id},'${r}')">${t}</button>`;
    return `<div class="bet ${x.res==='w'?'is-win':x.res==='l'?'is-loss':x.res==='v'?'is-void':'is-pending'}"><div class="bet-h"><b>${esc(x.t)}</b><span class="st ${x.res||'p'}">${{w:'Acertó',l:'Falló',v:'Nulo'}[x.res]||'Pendiente'}</span></div><small>${x.d} · ${esc(x.st||'Pick')} · modelo ${Math.round(x.p*100)}%${x.q?' · cuota '+x.q:' · sin cuota real'}${x.sk?' · Stake '+x.sk+'/9':''}</small><div>${B('w','Acertó')}${B('l','Falló')}${B('v','Nulo')}<button class="btn s" onclick="nbSetRes(${x.id},null)">↺</button><button class="btn s" onclick="nbDel(${x.id})">Borrar</button></div></div>`};
  let body='';
  if(tab==='res'){
    const gap=hit(D)-pr(D),V=D.length<10?{t:'Aún sin conclusiones',d:'Faltan '+Math.max(0,30-D.length)+' picks resueltos para sacar conclusiones. Mientras tanto no cambies reglas por rachas.'}:gap>=-3?{t:'Acierta lo que promete',d:'Las probabilidades parecen razonables. Confírmalo con el ROI.'}:gap>=-8?{t:'Algo optimista',d:'Acierta un poco menos de lo que dice. Sé prudente con el stake.'}:{t:'Demasiado optimista',d:'Acierta bastante menos de lo que promete. No te fíes de sus probabilidades altas.'};
    const rec=[...D].reverse().slice(-12).map(x=>`<i class="dot ${x.res==='w'?'G':'P'}">${x.res==='w'?'G':'P'}</i>`).join('');
    const bk=[[0,.5,'Menos de 50%'],[.5,.6,'50-60%'],[.6,.7,'60-70%'],[.7,.8,'70-80%'],[.8,1.01,'80% o más']],kinds=[...new Set(D.map(x=>x.st||'Sin tipo'))].sort(),bands=[[1,3,'Stake bajo 1–3'],[4,6,'Stake medio 4–6'],[7,9,'Stake alto 7–9']];
    body=`<p class="status"><b>Cómo leer las barras:</b> el relleno es lo que realmente acertó; la marca negra es lo que el modelo prometía. Si el relleno llega a la marca o la pasa, el modelo cumple. El % de acierto solo no demuestra rentabilidad: mira también el ROI. Los picks se resuelven con el botón «Actualizar resultados».</p>
    <div class="card"><div class="vhero">${ringSvg(nW,nL)}<div><h2>${V.t}</h2><p>${V.d}</p></div></div>
    <div class="counts"><span><b class="ok">${nW}</b>acertó</span><span><b class="bad">${nL}</b>falló</span><span><b>${pend}</b>pendientes</span>${nV?`<span><b>${nV}</b>nulos</span>`:''}</div>
    <div class="prog" role="progressbar" aria-valuenow="${Math.min(30,D.length)}" aria-valuemin="0" aria-valuemax="30"><i style="width:${Math.min(100,Math.round(D.length/30*100))}%"></i></div><small>${Math.min(30,D.length)} de 30 picks resueltos para sacar conclusiones</small>${rec?`<div class="dots"><small>Últimos resultados (de más viejo a más nuevo)</small><br>${rec}</div>`:''}</div>
    <div class="tiles"><div class="tile"><small>Prometía</small><b>${D.length?pr(D)+'%':'—'}</b><span>probabilidad media</span></div><div class="tile"><small>Acertó</small><b>${D.length?hit(D)+'%':'—'}</b><span>${D.length?delta(hit(D),pr(D)):'sin datos aún'}</span></div><div class="tile"><small>Brier (menor es mejor)</small><b>${brier!=null?brier.toFixed(3):'—'}</b><span>0.25 equivale a adivinar</span></div><div class="tile"><small>ROI (con cuota)</small><b class="${roi>=0?'ok':'bad'}">${Dq.length?(100*roi/Dq.length).toFixed(1)+'%':'—'}</b><span>${Dq.length?(roi>=0?'+':'')+roi.toFixed(1)+' u · '+Dq.length+' picks':'registra picks con cuota'}</span></div></div>
    ${D.length?`<div class="card"><h2>Por probabilidad</h2><small>Si el modelo dice 60%, de cada 10 picks debería acertar unos 6.</small>${bk.map(([x,y,t])=>row(t,D.filter(k=>k.p>=x&&k.p<y))).join('')}</div>
    <div class="card"><h2>Por tipo de pick</h2><small>Partido, puntos, rebotes, asistencias, triples o PRA: dónde le va mejor y peor.</small>${kinds.map(k=>row(k,D.filter(x=>(x.st||'Sin tipo')===k))).join('')}</div>
    <div class="card"><h2>Por nivel de stake</h2>${bands.map(([a,b,t])=>row(t,D.filter(x=>x.sk>=a&&x.sk<=b))).join('')||''}<small>Si el stake alto no acierta más que el bajo, el stake no está aportando.</small></div>`:'<p class="status">Aún no hay picks resueltos. Registra picks con «＋ Registrar pick» y pulsa «Actualizar resultados» cuando terminen los partidos.</p>'}`;
  }else if(tab==='s'){
    const S=P.filter(x=>x.sk>=1&&x.sk<=9);
    body=`<div class="card stake-summary"><h2>Resultados por Stake</h2><p class="mut">Solo cuenta picks con stake guardado.</p>${S.length?[1,2,3,4,5,6,7,8,9].map(st=>{const a=S.filter(x=>x.sk===st);if(!a.length)return '';const done=a.filter(x=>x.res==='w'||x.res==='l'),w=done.filter(x=>x.res==='w').length,rate=done.length?Math.round(100*w/done.length):null,tp=[...new Set(a.map(x=>x.st||'Pick'))];
      return `<div class="stake-row"><div class="stake-head"><b>Stake ${st}/9</b><span>${done.length?w+' de '+done.length+' aciertos · '+rate+'%':'Sin resultados resueltos'}</span></div><div class="stake-track"><i style="width:${rate==null?0:rate}%"></i></div><small>${done.length-w} fallos · ${a.filter(x=>!x.res).length} pendientes</small><div class="stake-markets">${tp.map(m=>`<span>${esc(m)} <b>${a.filter(x=>(x.st||'Pick')===m&&x.res==='w').length}✓ / ${a.filter(x=>(x.st||'Pick')===m&&x.res==='l').length}✕</b></span>`).join('')}</div></div>`}).join(''):'<p class="mut">Todavía no hay picks con stake guardado.</p>'}</div>`;
  }else{
    const sel=tab==='all'?P:tab==='p'?P.filter(x=>!x.res):tab==='v'?P.filter(x=>x.res==='v'):P.filter(x=>x.res===tab),T={all:['Todos los picks','No hay picks registrados todavía.'],w:['Picks acertados','No hay picks acertados todavía.'],l:['Picks fallados','No hay picks fallados todavía.'],p:['Pendientes','No hay picks pendientes.'],v:['Picks nulos','No hay picks nulos.']}[tab];
    body=`<div class="card"><h2>${T[0]} <small>(${sel.length})</small></h2>${tab==='p'?'<small>Pulsa «Actualizar resultados» cuando terminen los partidos. Si un jugador no jugó, queda como nulo. ↺ devuelve a pendiente.</small>':'<small>Si algún resultado está mal, corrígelo con los botones de cada pick.</small>'}${sel.slice(0,40).map(item).join('')||`<p class="mut">${T[1]}</p>`}</div>`;
  }
  const el=typeof target==='string'?$(target):target;if(el)el.innerHTML=menu+body}
async function nbTest(){const o=$('#nbmsg');const R=[];const t=async(n,f)=>{try{R.push('✔ '+n+': '+await f())}catch(e){R.push('✘ '+n+': '+e.message)}o.textContent=R.join(' · ')};
  let tid,pid;await t('Calendario ESPN',async()=>{const j=await nbj(NE+'scoreboard');tid=((j.events||[])[0]||{competitions:[{competitors:[{team:{id:13}}]}]}).competitions[0].competitors[0].team.id;return (j.events||[]).length+' partidos'});
  await t('Plantilla',async()=>{const j=await nbj(NE+'teams/'+(tid||13)+'/roster'),A=(j.athletes||[]).flatMap(x=>x.items||[x]);pid=A[0]&&A[0].id;return A.length+' jugadores'});
  await t('Estadísticas por jugador',async()=>{const j=await nbj(NW+'athletes/'+pid+'/gamelog'),g=parseGL(j);if(!g.length)throw new Error('0 partidos; etiquetas: '+JSON.stringify((j.labels||j.names||[]).slice(0,8))+'; seasonTypes: '+(j.seasonTypes||[]).length);return g.length+' partidos leídos'});
  await t('Ratings de equipos (ESPN standings)',async()=>{const v=await nbRatings(true);if(!v)throw new Error('sin datos de standings');return Object.keys(v.t).length+' equipos · promedio de liga '+v.L.toFixed(1)+' pts'});
  await t('Líneas ESPN (gratis)',async()=>{const j=await nbj(NE+'scoreboard');let n=0;for(const e of j.events||[]){const c=e.competitions[0],tm=x=>c.competitors.find(y=>y.homeAway===x).team;if(espnLn(c,{ab:tm('home').abbreviation},{ab:tm('away').abbreviation}))n++}return n+' partidos con línea'});
  if(NC.keys.trim())await t('The Odds API',async()=>{const j=await nbo('events',{});return j.length+' partidos con cuotas'});
  if(NC.sgo)await t('Sports Game Odds',async()=>{const r=await fetch('https://api.sportsgameodds.com/v2/events?leagueID=NBA&limit=1&apiKey='+encodeURIComponent(NC.sgo));if(!r.ok)throw new Error(r.status);return 'responde'});
  if(NC.bdl)await t('balldontlie',async()=>{const r=await fetch('https://api.balldontlie.io/v1/teams',{headers:{Authorization:NC.bdl}});if(!r.ok)throw new Error(r.status);return 'responde'});
  if(NC.apisports)R.push('⚠ API-NBA: omitida de los pronósticos; tu plan solo permite temporadas históricas. No se usarán datos de 2024');
  await t('Bajas ESPN',async()=>Object.keys(await nbInj()).length+' jugadores con parte médico')}

const nzInj=s=>{s=String(s||'').toLowerCase();return /\bout\b|fuera/.test(s)?'out':/doubt/.test(s)?'doubt':/question|day|gtd|probable/.test(s)?'q':''};
async function nbInj(){const o={};try{const j=await nbj(NE+'injuries');for(const t of j.injuries||[])for(const x of t.injuries||[]){const s=nzInj(x.status);if(s&&x.athlete)o[nz(x.athlete.displayName)]={s,c:x.shortComment||x.status}}}catch{}return o}
function ns(name){const nn=nz(name);if(nn.length<5)return null;for(const ln of String(NC.news||'').split('\n')){if(!nz(ln).includes(nn))continue;const w=ln.toLowerCase(),c=ln.trim().slice(0,90);
  if(/\b(out|fuera|baja|descartad|ruled out|inactiv)/.test(w))return{s:'out',c};if(/doubt|dudoso/.test(w))return{s:'doubt',c};if(/question|day-to-day|gtd|duda|probable/.test(w))return{s:'q',c}}return null}
function gameCands(g){const m=gameModel(g);if(!m)return [];const od=(NB.od&&NB.od[g.id]&&NB.od[g.id].o)||{},C=[],fp=(a,b)=>a&&b&&a.q&&b.q?(1/a.q)/(1/a.q+1/b.q):null,add=(n,p,o,fair,meta)=>C.push({n,p:shr(p,9),q:o?o.q:null,fair,meta}),mar=m.mar;
  const ln=g.ln||{},hw=od['h2h|'+nz(g.h.n)+'|'],aw=od['h2h|'+nz(g.a.n)+'|'],sh=od['spreads|'+nz(g.h.n)+'|']||(ln.sp!=null?{p:ln.sp,q:null}:null),sa=od['spreads|'+nz(g.a.n)+'|']||(ln.sp!=null?{p:-ln.sp,q:null}:null),ov=od['totals|over|']||(ln.ou!=null?{p:ln.ou,q:null}:null),un=od['totals|under|']||(ln.ou!=null?{p:ln.ou,q:null}:null);
  add('Gana '+g.h.ab,1-Phi(-mar/12),hw,fp(hw,aw),{t:'ml',tm:g.h.ab});add('Gana '+g.a.ab,Phi(-mar/12),aw,fp(aw,hw),{t:'ml',tm:g.a.ab});
  if(sh&&sa){add(g.h.ab+' '+(sh.p>0?'+':'')+sh.p,1-Phi((-sh.p-mar)/12),sh,fp(sh,sa),{t:'sp',tm:g.h.ab,line:sh.p});add(g.a.ab+' '+(sa.p>0?'+':'')+sa.p,1-Phi((mar-sa.p)/12),sa,fp(sa,sh),{t:'sp',tm:g.a.ab,line:sa.p})}
  if(ov&&un){add('Total más de '+ov.p,1-Phi((ov.p-m.tot)/17),ov,fp(ov,un),{t:'tot',side:'over',line:ov.p});add('Total menos de '+un.p,Phi((un.p-m.tot)/17),un,fp(un,ov),{t:'tot',side:'under',line:un.p})}
  return C}
const lect=g=>{const c=gameCands(g).filter(x=>/^Gana/.test(x.n)).sort((a,b)=>b.p-a.p)[0];return c?' · '+c.n+' '+Math.round(c.p*100)+'%':''};
async function llm(messages){let err='';
  if(cfg.gq){try{const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cfg.gq},body:JSON.stringify({model:MODEL,temperature:0,max_completion_tokens:1800,messages})}),j=await r.json();if(r.ok&&j.choices)return j.choices[0].message.content;err='Groq: '+((j.error&&j.error.message)||r.status)}catch(e){err='Groq: '+e.message}}
  if(cfg.or){try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cfg.or,'HTTP-Referer':'https://github.com/','X-Title':'RadarPi'},body:JSON.stringify({model:'openrouter/free',temperature:0,max_tokens:1800,messages})}),j=await r.json();if(r.ok&&j.choices)return j.choices[0].message.content;err+=' OpenRouter: '+((j.error&&j.error.message)||r.status)}catch(e){err+=' OpenRouter: '+e.message}}
  throw new Error(err||'configura Groq u OpenRouter en Ajustes')}
async function nbAI(id){const g=NB.g.find(x=>x.id==id),box=$('#nbai'+id);box.hidden=false;box.style.whiteSpace='normal';box.innerHTML='<p class="mr-s">Analizando…</p>';
  const m=gameModel(g),R0=nbCands(g),best=R0.out[0]||null,lean=best?null:nbLean(g),pr=R0.out.find(c=>c.kind!=='Partido'&&(!best||c.k!==best.k)),
    A=best||lean,B=pr||((best&&best.kind!=='Partido')?null:(NC.lp?nbLeanProp(g):null));
  const sum=(c,l)=>c?{id:l,pick:c.n,prob_pct:Math.round(c.p*100),cuota:c.q,valor_pct:c.e!=null?Math.round(c.e*100):null,cuota_real:!!c.q,ultimos10:c.arr||null,stake:nbStake(c)}:null;
  const data={partido:g.a.n+' @ '+g.h.n,proyeccion:m?{[g.a.ab]:Math.round(m.ap),[g.h.ab]:Math.round(m.hp),total:+m.tot.toFixed(1)}:null,picks:[sum(A,'A'),sum(B,'B')].filter(Boolean),bajas:{[g.h.ab]:g.h.out||[],[g.a.ab]:g.a.out||[]},contexto:m?{descanso:{[g.h.ab]:m.rest.h.b2b?'back-to-back':(m.rest.h.n4>=2?'3 juegos en 4 noches':'normal'),[g.a.ab]:m.rest.a.b2b?'back-to-back':(m.rest.a.n4>=2?'3 juegos en 4 noches':'normal')},ratings_temporada:m.rt}:null,bajas_pegadas_por_usuario:String(NC.news||'').slice(0,1200)};
  if(!data.picks.length){box.innerHTML='<p class="mr-s">Este partido no tiene pick que analizar.</p>';return}
  try{const t=await llm([{role:'system',content:'Eres analista escéptico de apuestas NBA. Usa solo los datos recibidos; no inventes lesiones, rachas ni cuotas. Los picks A y B ya los eligió la app con reglas fijas: no los cambies ni propongas otros. Para cada uno decide "apostar" o "no_apostar" (no_apostar solo con un motivo concreto en los datos: bajas, pocos juegos, sin cuota real, línea dudosa) y da una razón de máximo 25 palabras. Añade hasta 2 riesgos y hasta 2 cosas por verificar, de máximo 12 palabras cada una. Responde SOLO con JSON válido, sin texto fuera de él: {"A":{"decision":"apostar|no_apostar","razon":""},"B":{"decision":"apostar|no_apostar","razon":""},"riesgos":[],"verificar":[]}'},{role:'user',content:JSON.stringify(data)}]);
    let j=null;try{j=JSON.parse((t.match(/\{[\s\S]*\}/)||[''])[0])}catch{}
    if(!j){box.innerHTML='<details open class="afd"><summary><b>✦ Veredicto IA</b><small>Tocar para recoger</small></summary><p class="mr-s">'+esc(String(t).slice(0,500))+'</p></details>';return}
    const dec=d=>d==='apostar'?'<span class="chip2 ok">APOSTAR</span>':'<span class="chip2 bad">NO APOSTAR</span>',
      blk=(c,l,lab)=>c&&j[l]?`<div class="stake-row"><small class="tkl">${lab}</small><div class="stake-head"><b>${esc(c.n)}</b>${dec(j[l].decision)}</div><p class="mut">${esc(String(j[l].razon||'').slice(0,220))}</p></div>`:'',
      ls=(a,t)=>Array.isArray(a)&&a.length?`<p class="mr-s"><b>${t}:</b> ${a.slice(0,2).map(x=>esc(String(x).slice(0,100))).join(' · ')}</p>`:'';
    box.innerHTML='<details open class="afd"><summary><b>✦ Veredicto IA</b><small>Tocar para recoger</small></summary>'+blk(A,'A',A&&A.kind==='Partido'?'PICK DE PARTIDO':'PICK')+blk(B,'B','PICK DE JUGADOR')+ls(j.riesgos,'Riesgos')+ls(j.verificar,'Verifica antes de apostar')+'<p class="mr-s">Es una validación sobre los datos del modelo, no una garantía.</p></details>'
  }catch(e){box.innerHTML='<p class="bad">Error de IA: '+esc(e.message)+'</p>'}}
window.nbCombiSource=async say=>{if(!NC.keys.trim())throw new Error('necesita llave de The Odds API (Ajustes → Fuentes y ajustes de NBA)');if(!NB.g.length||!NB.od){say&&say('NBA: escaneando…');await nbScan()}if(!NB.od)throw new Error('sin cuotas reales de NBA');
  return NB.g.map(g=>{const m=[],q={},fc={},put=(n,p,qq,fair)=>{if(!qq)return;m.push([n,p]);q[n]=qq;if(fair)fc[n]=fair};
    gameCands(g).forEach(c=>put(g.a.ab+'@'+g.h.ab+': '+c.n,c.p,c.q,c.fair));
    [g.h,g.a].forEach(s=>s.pl.forEach(p=>Object.keys(STX).forEach(st=>{const o=nbPropOpts(g,p,st);if(!o||!o.real)return;const a=o.ov.q,b=o.un.q,pf=a&&b?[(1/a)/(1/a+1/b),(1/b)/(1/a+1/b)]:[null,null];[o.ov,o.un].forEach((x,i)=>put(p.n+' '+x.name+' '+o.L+' '+STX[st][0],x.pr,x.q,pf[i]))})));
    return{nba:true,ev:g.id,slug:'nba',liga:'NBA',h:g.h.ab,w:g.a.ab,m:g.a.ab+' @ '+g.h.ab,hora:new Date(g.date).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),ko:g.date,hid:g.h.id,wid:g.a.id,casa:'The Odds API (EE. UU.)',p:[],A:{n:12},B:{n:12},mod:{m,fc},q}})};
// El escaneo de NBA que hace Combi es silencioso: guarda los datos pero no pinta nada en la pestaña NBA
const _nbCS=window.nbCombiSource;
window.nbCombiSource=async say=>{
  const had=!!(NB.g.length&&NB.od),ids=['#nbres','#nbmsg','#nbpk'],hold=ids.map(s=>{const e=$(s);return e?e.innerHTML:null});
  try{return await _nbCS(say)}
  finally{if(!had)ids.forEach((s,i)=>{const e=$(s);if(e&&hold[i]!==null){e.innerHTML=hold[i]}})}
};
function nbInit(){$('#nba-root').innerHTML=`<div class="combo-page-head"><div class="combo-page-icon">🏀</div><div><h2>NBA</h2><p>Props de jugadores y partidos con fuentes gratis.</p></div></div>
<div class="card"><div class="seg m" id="nbday"><button class="${NC.day?'':'on'}" onclick="NC.day=0;nbSet()">Hoy</button><button class="${NC.day?'on':''}" onclick="NC.day=1;nbSet()">Mañana</button></div>
<div class="tools"><button class="btn" id="nbgo" onclick="nbScan(false)">Escanear NBA</button><button class="btn s" onclick="nbTest()">Probar fuentes</button></div><button class="btn s" id="nbhunt" type="button" style="width:100%;min-height:46px;margin:10px 0 0" onclick="nbScan(true)">Buscar el mejor pick NBA</button><p class="status" id="nbmsg" role="status"></p></div>
<details class="card cfgbox"><summary>Bajas de última hora (opcional)</summary><label>Si te enteras de una baja que ESPN aún no marca, escríbela aquí: nombre completo + OUT o Duda (una por línea)<textarea rows="5" onchange="NC.news=this.value;nbSet()">${esc(NC.news)}</textarea></label><p class="status">No es obligatorio: las bajas oficiales de ESPN se leen solas. Lo que escribas aquí se aplica en el próximo escaneo.</p></details><div id="nbres"></div><div id="nbpk"></div>`;nbPicks();nbInitGeneralSettings()}
function nbInitGeneralSettings(){
  const fields={ 'nba-keys-general': 'keys', 'nba-sgo-general':'sgo', 'nba-apisports-general':'apisports', 'nba-bdl-general':'bdl', 'nba-games-general':'games', 'nba-per-general':'per' };
  Object.entries(fields).forEach(([id,key])=>{const e=document.getElementById(id);if(!e)return;e.value=NC[key]??'';e.addEventListener('change',()=>{if(key==='games')NC[key]=Math.max(1,Math.min(10,+e.value||3));else if(key==='per')NC[key]=Math.max(3,Math.min(12,+e.value||8));else NC[key]=e.value;nbSet();});});
  [['nba-alt-general','alt'],['nba-lp-general','lp']].forEach(([id,k])=>{const e=document.getElementById(id);if(!e)return;e.checked=!!NC[k];e.addEventListener('change',()=>{NC[k]=e.checked;nbSet();if(k==='lp')nbDraw()})});
  const save=document.getElementById('nba-settings-save');if(save)save.onclick=()=>{nbSet();const status=document.getElementById('nba-settings-status');if(status)status.textContent='Ajustes NBA guardados en este navegador.';};
}
function nbSet(){SV('nbcfg',NC);document.querySelectorAll('#nbday button').forEach((b,i)=>b.classList.toggle('on',i===NC.day))}
nbInit();nbAutoRes(false).catch(()=>{});
Object.assign(window,{NB,NC,nbScan,nbCard,nbTest,nbLog,nbTab,nbPicks,nbSetRes,nbDel,nbAutoRes,nbSet,nbDraw,nbAI});
})();
