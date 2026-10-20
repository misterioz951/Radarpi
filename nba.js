(function(){
'use strict';
/* ===== NBA · Radar de patrones (fuentes gratis: ESPN + The Odds API) ===== */
const NE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/',NW='https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/',NO='https://api.the-odds-api.com/v4/sports/basketball_nba/';
const NC=Object.assign({keys:'',games:3,per:8,day:0,news:'',sgo:'',bdl:''},LS('nbcfg',{}));
const NB={g:[],od:null,sel:{},ln:{},reg:{},picks:LS('nbapicks',[]),ki:0};
const nz=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
const Phi=x=>{const t=1/(1+.2316419*Math.abs(x)),p=.3989423*Math.exp(-x*x/2)*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p};
const nbj=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(r.status+' '+u.replace(/\?.*/,'').split('/').slice(-2).join('/'));return r.json()};
async function pool(a,n,f){const o=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<a.length){const k=i++;try{o[k]=await f(a[k],k)}catch(e){o[k]=null}}}));return o}
function nbCdf(k,m,v){if(k<0)return 0;if(v<=m*1.02){let t=Math.exp(-m),s=t;for(let i=1;i<=k;i++){t*=m/i;s+=t}return Math.min(1,s)}const r=m*m/(v-m),p=r/(r+m);let t=Math.pow(p,r),s=t;for(let i=1;i<=k;i++){t*=(i-1+r)/i*(1-p);s+=t}return Math.min(1,s)}
const seasonEnd=()=>{const d=new Date();return d.getMonth()>=8?d.getFullYear()+1:d.getFullYear()};

// ---- Estadísticas de jugadores (ESPN gamelog), cache compacto ----
function parseGL(j){const nm=j.names||j.labels||[],ix=n=>nm.indexOf(n),iM=ix('MIN'),iP=ix('PTS'),iR=ix('REB'),iA=ix('AST'),i3=ix('3PT'),ev=j.events||{},out=[];
  for(const st of j.seasonTypes||[]){if(!/regular/i.test(st.displayName||''))continue;for(const c of st.categories||[])for(const e of c.events||[]){const s=e.stats||[],m=ev[e.eventId]||{};out.push({d:String(m.gameDate||'').slice(0,10),r:[+s[iM]||0,+s[iP]||0,+s[iR]||0,+s[iA]||0,+String(s[i3]||'0').split('-')[0]||0]})}}
  return out}
async function glog(id){
  const C=LS('nba_gl',{}),c=C[id];if(c&&Date.now()-c.t<18*36e5)return c.g;
  const se=seasonEnd(),cut=(se-1)+'-10-01';let all=parseGL(await nbj(NW+'athletes/'+id+'/gamelog'));
  if(all.filter(x=>x.d>=cut).length<10)try{all=all.concat(parseGL(await nbj(NW+'athletes/'+id+'/gamelog?season='+(se-1))))}catch{}
  const seen=new Set(),g=all.filter(x=>x.d&&!seen.has(x.d)&&seen.add(x.d)).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,15).map(x=>x.r.concat(x.d>=cut?1:0));
  const C2=LS('nba_gl',{});C2[id]={t:Date.now(),g};for(const k in C2)if(Date.now()-C2[k].t>36e5*36)delete C2[k];SV('nba_gl',C2);return g}
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
const rowsOf=ev=>{const R=[];for(const b of ev.bookmakers||[])for(const m of b.markets||[])for(const o of m.outcomes||[])R.push({k:m.key+'|'+nz(o.description||o.name)+'|'+(o.description?o.name:''),p:o.point,q:o.price});return R};
async function nbOdds(games){
  const ev=await nbo('odds',{regions:'us',markets:'h2h,spreads,totals'}),out={};
  for(const e of ev){const g=games.find(x=>nz(x.h.n)===nz(e.home_team)&&nz(x.a.n)===nz(e.away_team));if(g)out[g.id]={eid:e.id,o:bestOf(rowsOf(e))}}
  await pool(games.filter(g=>out[g.id]),2,async g=>{const j=await nbo('events/'+out[g.id].eid+'/odds',{regions:'us',markets:'player_points,player_rebounds,player_assists,player_threes,player_points_rebounds_assists'});Object.assign(out[g.id].o,bestOf(rowsOf(j)))});
  return out}

// ---- Modelo de partido (ritmo/anotación de los últimos juegos) ----
async function teamForm(id){const se=seasonEnd(),res=[];
  for(const q of ['','?season='+(se-1)]){try{const j=await nbj(NE+'teams/'+id+'/schedule'+q);for(const e of j.events||[]){const c=(e.competitions||[])[0];if(!c||!(c.status&&c.status.type&&c.status.type.completed))continue;const me=c.competitors.find(x=>x.team.id==id),op=c.competitors.find(x=>x.team.id!=id),f=x=>+(x.score&&x.score.value!=null?x.score.value:x.score);if(f(me)>0)res.push({d:e.date,pf:f(me),pa:f(op)})}}catch{}if(res.length>=10)break}
  const a=res.sort((x,y)=>y.d.localeCompare(x.d)).slice(0,12);if(a.length<4)return null;return{pf:a.reduce((t,x)=>t+x.pf,0)/a.length,pa:a.reduce((t,x)=>t+x.pa,0)/a.length,n:a.length}}
function gameModel(g){if(!g.h.f||!g.a.f)return null;const hp=(g.h.f.pf+g.a.f.pa)/2+1.5,ap=(g.a.f.pf+g.h.f.pa)/2-1.5;return{hp,ap,tot:hp+ap,mar:hp-ap}}

// ---- Escaneo ----
// Líneas gratis de ESPN (spread y total). Solo traen la línea, no el precio.
function espnLn(c,h,a){const o=(c.odds||[])[0];if(!o)return null;const r={},d=String(o.details||'').trim(),m=d.match(/^([A-Z]{2,4})\s+([+-]?\d+(?:\.\d+)?)$/);
  if(m){const n=+m[2];if(m[1]===h.ab)r.sp=n;else if(m[1]===a.ab)r.sp=-n}else if(/^(EVEN|PK)$/i.test(d))r.sp=0;
  if(o.overUnder!=null&&+o.overUnder>150)r.ou=+o.overUnder;
  return(r.sp!=null||r.ou!=null)?r:null}
async function nbTeam(g,s,inj){
  s.f=await teamForm(s.id);
  const ro=await nbj(NE+'teams/'+s.id+'/roster'),A=(ro.athletes||[]).flatMap(x=>x.items||[x]).filter(x=>x&&x.id);
  const L=await pool(A,6,async a=>({a,g:await glog(a.id)}));
  const all=L.filter(x=>x&&x.g&&x.g.length>=3).map(x=>{const n=x.a.displayName||x.a.fullName,r0=nzInj(((x.a.injuries||[])[0]||{}).status),s0=ns(n)||inj[nz(n)]||(r0?{s:r0,c:''}:null);return{id:x.a.id,n,pos:(x.a.position||{}).abbreviation||'',st:s0?s0.s:'',nt:s0?s0.c:'',tm:s.ab,g:x.g,mn:x.g.slice(0,8).reduce((t,r)=>t+r[0],0)/Math.min(8,x.g.length)}});
  const outMin=all.filter(p=>p.st==='out'&&p.mn>=14).reduce((t,p)=>t+p.mn,0);s.out=all.filter(p=>p.st==='out'&&p.mn>=10).map(p=>p.n);s.boost=1+Math.min(.12,outMin/240*.5);
  s.pl=all.filter(p=>p.mn>=14&&p.st!=='out').sort((a,b)=>b.mn-a.mn).slice(0,NB.hunt?Math.min(NC.per,6):NC.per)}
async function nbScan(hunt){const msg=$('#nbmsg'),bs=[$('#nbgo'),$('#nbhunt')].filter(Boolean);bs.forEach(b=>b.disabled=true);NB.hunt=hunt===true;
  try{const d=new Date(Date.now()+NC.day*864e5),ds=d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate());msg.textContent='Buscando partidos…';
    const sb=await nbj(NE+'scoreboard?dates='+ds);
    NB.g=(sb.events||[]).filter(e=>!(e.status&&e.status.type&&e.status.type.completed)&&!(e.status&&e.status.type&&e.status.type.state==='in')).slice(0,NB.hunt?12:NC.games).map(e=>{const c=e.competitions[0],t=h=>{const x=c.competitors.find(y=>y.homeAway===h).team;return{id:x.id,n:x.displayName,ab:x.abbreviation}};const g={id:e.id,date:e.date,h:t('home'),a:t('away'),pl:[]};g.ln=espnLn(c,g.h,g.a);return g});
    if(!NB.g.length){msg.textContent='No hay partidos NBA sin jugar para ese día.';$('#nbres').innerHTML='';return}
    let oddsErr='';NB.od=null;if(NC.keys.trim()){msg.textContent='Cuotas…';try{NB.od=await nbOdds(NB.g)}catch(e){oddsErr=' Cuotas: '+e.message+'.'}}
    const inj=await nbInj(),T=[];NB.g.forEach(g=>{T.push([g,g.h]);T.push([g,g.a])});let k=0;
    await pool(T,3,async([g,s])=>{try{await nbTeam(g,s,inj)}catch(e){s.f=s.f||null;s.pl=s.pl||[];s.out=s.out||[]}msg.textContent='Equipos y jugadores '+(++k)+'/'+T.length+'…'});
    const nOd=NB.od?Object.keys(NB.od).length:0;
    msg.textContent='Listo. '+NB.g.length+' partidos.'+(NB.od?' Cuotas reales en '+nOd+' (~'+(3+5*nOd)+' créditos).':(NC.keys.trim()?'':' Sin llave de The Odds API: solo lecturas del modelo con líneas de ESPN, sin cuota real.'))+oddsErr;
    nbDraw()}
  catch(e){msg.textContent='Error: '+e.message+'. Usa «Probar fuentes».'}finally{bs.forEach(b=>b.disabled=false)}}

// ---- Dibujo ----
const f1=x=>x.toFixed(1);
function nbPropOpts(g,p,s){const P=proj(p.g,s);if(!P)return null;const bs=(p.tm===g.h.ab?g.h:g.a).boost||1;P.m*=bs;P.v*=bs;P.bs=bs;const od=NB.od&&NB.od[g.id]&&NB.od[g.id].o,mk={pts:'player_points',reb:'player_rebounds',ast:'player_assists',tp:'player_threes',pra:'player_points_rebounds_assists'}[s],ov=od&&od[mk+'|'+nz(p.n)+'|Over'],un=od&&od[mk+'|'+nz(p.n)+'|Under'],key=g.id+p.id+s;
  const L=NB.ln[key]!=null?NB.ln[key]:(ov?ov.p:Math.floor(P.med)+.5),po=pOver(P,L),side=(o,pr,name)=>{const q=o&&o.p===L?o.q:null;return{name,pr,q,e:q?pr*q-1:null}};
  return{P,L,key,ov:side(ov,po,'Más'),un:side(un,1-po,'Menos'),real:!!ov}}
function propBlk(g,p,s){const o=nbPropOpts(g,p,s);if(!o)return '<p class="status">Pocos partidos para proyectar.</p>';const {P,L,key}=o,a=[...P.a].slice(0,10).reverse(),mx=Math.max(L*1.5,...a,1);
  const bars=a.map(x=>`<div class="nb-b"><i class="${x>L?'ok':'no'}" style="height:${Math.max(4,x/mx*100)}%"></i><span>${x}</span></div>`).join('');
  const sd=x=>{NB.reg[key+x.name]={t:`${p.n} ${STX[s][0]} ${x.name} ${L}`,p:x.pr,q:x.q,g:g.h.ab+'-'+g.a.ab,st:STX[s][0]};return `<button class="nb-s${x.e!=null&&x.e>.03?' va':''}" onclick="nbLog('${key+x.name}')"><b>${x.name} ${L}</b><span>${Math.round(x.pr*100)}%</span><small>${x.q?'@'+x.q+(x.e!=null?' · valor '+(x.e>=0?'+':'')+Math.round(x.e*100)+'%':''):'justa @'+(1/x.pr).toFixed(2)}</small></button>`};
  return `<div class="nb-bars" style="--ln:${L/mx*100}%">${bars}<u></u></div><div class="nb-ln">Proy. <b>${f1(P.m)}</b> · mediana ${P.med} · línea <input type="number" step=".5" value="${L}" onchange="NB.ln['${key}']=+this.value;nbDraw()"> ${o.real?'<em>cuota EE. UU.</em>':'<em>sin línea real</em>'}</div><div class="nb-sd">${sd(o.ov)}${sd(o.un)}</div>${P.cur<5?'<p class="status">Pocos juegos de esta temporada: se usa también la anterior y se recorta la confianza.</p>':''}${P.bs>1.02?'<p class="status">+'+Math.round((P.bs-1)*100)+'% por bajas del equipo.</p>':''}`}
function gameRows(g){const m=gameModel(g);if(!m)return '<p class="status">Sin datos suficientes del equipo.</p>';const ob=[...(g.a.out||[]).map(x=>g.a.ab+' '+esc(x)),...(g.h.out||[]).map(x=>g.h.ab+' '+esc(x))];
  return `<p class="nb-pj">Proyección: ${g.a.ab} <b>${Math.round(m.ap)}</b> – ${g.h.ab} <b>${Math.round(m.hp)}</b> · total ${f1(m.tot)}${ob.length?'<br><small>Bajas: '+ob.join(', ')+'</small>':''}</p>`+gameCands(g).map((c,i)=>{const k=g.id+'G'+i;NB.reg[k]={t:g.a.ab+'@'+g.h.ab+' '+c.n,p:c.p,q:c.q,g:'',st:'Partido'};return `<div class="nb-gr"><span>${c.n}</span><b>${Math.round(c.p*100)}%</b><small>${c.q?'@'+c.q+' · valor '+Math.round((c.p*c.q-1)*100)+'%':'justa @'+(1/c.p).toFixed(2)}</small>${c.q?`<button class="btn s" onclick="nbLog('${k}')">＋</button>`:''}</div>`}).join('')}
// ---- Motor de picks NBA (mismas reglas de fondo que fútbol: cuota real, valor, ancla al mercado, veto) ----
function nbAll(g){const C=[];
  gameCands(g).forEach((c,i)=>C.push({k:'TG'+g.id+i,kind:'Partido',n:c.n,full:g.a.ab+'@'+g.h.ab+' · '+c.n,p:c.p,q:c.q,fair:c.fair==null?null:c.fair,real:true}));
  [g.h,g.a].forEach(s=>s.pl.forEach(p=>Object.keys(STX).forEach(st=>{const o=nbPropOpts(g,p,st);if(!o)return;const a=o.ov.q,b=o.un.q,pf=a&&b?[(1/a)/(1/a+1/b),(1/b)/(1/a+1/b)]:[null,null];
    [o.ov,o.un].forEach((x,i)=>C.push({k:'T'+o.key+x.name,kind:STX[st][0],n:p.n+' '+STX[st][0]+' '+x.name+' '+o.L,full:p.n+' '+STX[st][0]+' '+x.name+' '+o.L,p:x.pr,q:x.q,fair:pf[i],real:o.real,cur:o.P.cur,na:o.P.a.length,bs:o.P.bs}))})));
  return C}
function nbCands(g){const out=[],veto=[];
  for(const c of nbAll(g)){
    if(!c.real||c.q==null||c.q<1.01)continue;
    if(c.fair!=null&&c.p-c.fair>.12){veto.push({n:c.n,p:c.p,ref:c.fair});continue}
    const pr=c.fair!=null?.5*c.p+.5*c.fair:c.p,e=pr*c.q-1;
    if(c.q<1.3||c.q>2.8||pr<.54||e<.02||e>.22)continue;
    const sc=pr*.6+Math.min(e,.12)*1.5+(c.kind==='Partido'?.01:0)-(c.cur!=null&&c.cur<5?.03:0)-(c.fair==null?.02:0);
    out.push(Object.assign({},c,{p:pr,pm:c.p,e,sc}))}
  return{out:out.sort((a,b)=>b.sc-a.sc),veto}}
// Sin cuota real: solo mercados de partido (con línea de ESPN o moneyline) y con tope de stake bajo.
function nbLean(g){if(!gameModel(g))return null;const c=nbAll(g).filter(x=>x.kind==='Partido'&&x.q==null&&x.p>=.58).sort((a,b)=>b.p-a.p)[0];return c?Object.assign({},c,{e:null,sc:c.p}):null}
// Pick de jugador sin cuota real: busca una línea conservadora (segunda peor marca de los últimos 10) que el modelo y el historial respaldan.
function nbLeanProp(g){let best=null;
  [g.h,g.a].forEach(s=>s.pl.forEach(p=>{if(p.st||p.mn<20)return;Object.keys(STX).forEach(st=>{
    const P=proj(p.g,st);if(!P||P.cur<5||P.a.length<8)return;
    const bs=s.boost||1,a=P.a.slice(0,10),srt=[...a].sort((x,y)=>x-y),L=srt[1]-.5;
    if(L<.5||L<.6*P.med)return;
    const hits=a.filter(x=>x>L).length/a.length,po=pOver({m:P.m*bs,v:P.v*bs,cur:P.cur},L),pe=(hits*a.length+2)/(a.length+4),pp=Math.min(po,pe);
    if(hits<.8||pp<.66)return;
    const c={k:'TP'+g.id+p.id+st,kind:STX[st][0],n:p.n+' '+STX[st][0]+' Más '+L,full:p.n+' '+STX[st][0]+' Más '+L,p:pp,q:null,e:null,fair:null,real:false,cur:P.cur,na:a.length,bs,hits:a.filter(x=>x>L).length+'/'+a.length,sc:pp};
    if(!best||c.sc>best.sc)best=c})}));
  return best}
function nbStake(c){let b=c.p>=.7?7:c.p>=.63?6:c.p>=.58?5:4;
  if(c.e==null||c.e<.03)b=Math.min(b,3);else if(c.e<.06)b=Math.min(b,5);else if(c.e<.1)b=Math.min(b,6);
  if(c.fair==null)b=Math.min(b,4);
  if(c.kind!=='Partido'&&((c.cur!=null&&c.cur<5)||(c.na!=null&&c.na<8)))b=Math.min(b,4);
  if(c.bs>1.02)b-=1;
  return Math.max(1,Math.min(9,b))}
function nbWhy(g,veto){
  if(!gameModel(g))return 'Sin datos suficientes de los equipos (ESPN no devolvió sus últimos partidos).';
  if(!NB.od)return 'No hay cuotas reales para este partido (falta la llave de The Odds API o no se emparejó). Sin cuota no se puede comprobar el valor.';
  if(veto&&veto.length){const v=veto.sort((a,b)=>(b.p-b.ref)-(a.p-a.ref))[0];return 'El modelo está mucho más optimista que el mercado en '+esc(v.n)+' (modelo '+Math.round(v.p*100)+'% contra '+Math.round(v.ref*100)+'% del mercado). Se descarta: suele ser error del modelo.'}
  return 'Ningún mercado cumple a la vez cuota de 1,30 a 2,80, probabilidad de 54% o más y valor de 2% a 22%.'}
function nbTicket(g,c,lean,veto,label){
  if(!c)return '<div class="nopick2"><b>Sin pick con ventaja clara</b><p>'+nbWhy(g,veto)+'</p></div>';
  NB.reg[c.k]={t:c.full,p:c.p,q:c.q,g:g.a.ab+'@'+g.h.ab,st:c.kind};
  const st=nbStake(c);
  return `<div class="tk ${lean?'':'A'}"><small class="tkl">${label||(lean?'LECTURA DEL MODELO · SIN CUOTA REAL':'PICK DE LA APP · SEGÚN REGLAS')}</small><div class="tk1"><b class="n">${esc(c.n)}</b></div>
<div class="tk2"><span><b>${Math.round(c.p*100)}%</b> prob.</span>${c.q?`<span>cuota <b>@${c.q}</b></span><span>valor <b>${c.e>=0?'+':''}${Math.round(c.e*100)}%</b></span>`:`<span>cuota mínima <b>@${(1.05/c.p).toFixed(2)}</b></span>`}<span>stake base <b>${st}/9</b></span></div>
<div class="meter${st>=5?' hi':''}" role="img" aria-label="Stake ${st} de 9">${Array.from({length:9},(_,k)=>`<i class="${k<st?'f':''}"></i>`).join('')}</div>
${c.hits?'<div class="mr-s" style="margin-top:6px">Superó esa línea en <b>'+c.hits+'</b> de sus últimos partidos. Verifica que tu casa tenga esa línea (o más baja) y confirma que juega.</div>':''}${lean?'<div class="tkw">Sin cuota real no hay valor comprobable. Solo úsalo si tu casa paga al menos la cuota mínima. Con una llave gratis de The Odds API la app verifica el valor.</div>':''}
<div class="acts2" style="margin-top:8px"><button class="btn s" onclick="nbLog('${c.k}')">＋ Registrar pick</button></div></div>`}
const nbPlayers=g=>[g.h,g.a].flatMap(s=>s.pl).sort((a,b)=>b.mn-a.mn).map(p=>{const s=NB.sel[p.id]||'pts';return `<div class="nb-p"><div class="nb-ph"><b>${esc(p.n)}</b><small>${p.tm} · ${p.pos} · ${Math.round(p.mn)} min${p.st?' · <i class="bad">'+({doubt:'Duda fuerte',q:'Duda'}[p.st]||p.st)+'</i>':''}</small></div><div class="nb-ch">${Object.keys(STX).map(k=>`<button class="${k===s?'on':''}" onclick="NB.sel['${p.id}']='${k}';nbDraw()">${STX[k][0]}</button>`).join('')}</div>${propBlk(g,p,s)}</div>`}).join('');
function nbCard(g){
  const R0=nbCands(g),best=R0.out[0]||null,lean=best?null:nbLean(g),pr=R0.out.find(c=>c.kind!=='Partido'&&(!best||c.k!==best.k)),pl=pr||((best&&best.kind!=='Partido')?null:nbLeanProp(g)),pcard=pl?nbTicket(g,pl,!pr,null,pr?'PICK DE JUGADOR · SEGÚN REGLAS':'PICK DE JUGADOR · SIN CUOTA REAL'):'<div class="nopick2"><b>Sin pick de jugador</b><p>Ningún jugador tiene una línea que cumpla en 8 de 10 partidos con minutos estables.</p></div>',tm=new Date(g.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return `<article class="card mc"><div class="mh"><span class="pill">NBA</span><span class="ko">${dlab(g.date)}${tm}</span></div><div class="mt"><b>${esc(g.a.n)}</b><em>@</em><b>${esc(g.h.n)}</b></div>
${nbTicket(g,best||lean,!best&&!!lean,R0.veto)}
${pcard}
<div class="acts2"><button class="btn" onclick="nbAI('${g.id}')">✦ Análisis IA</button></div><div class="ai" id="nbai${g.id}" hidden></div>
<details class="dd"><summary>Proyección, mercados y jugadores</summary>${gameRows(g)}<div class="sec">Jugadores</div>${nbPlayers(g)}</details></article>`}
function nbDraw(){nbK();const box=$('#nbres');if(!NB.g.length){box.innerHTML='';return}NB.reg={};
  let head='';
  if(NB.hunt){
    const real=NB.g.map(g=>({g,c:nbCands(g).out[0]})).filter(x=>x.c).sort((a,b)=>b.c.sc-a.c.sc).slice(0,3);
    const lean=real.length?[]:NB.g.flatMap(g=>[{g,c:nbLean(g)},{g,c:nbLeanProp(g)}]).filter(x=>x.c).sort((a,b)=>b.c.p-a.c.p).slice(0,3);
    const L=real.length?real:lean,isLean=!real.length;
    head=`<div class="card"><h2>Mejor pick NBA</h2><small>${L.length?(isLean?'Ningún mercado tiene cuota real con valor (o falta la llave de cuotas). Estas son las lecturas más fuertes del modelo, sin cuota verificada.':'Los '+L.length+' picks con mejor puntaje de '+NB.g.length+' partidos revisados. Cuota real, valor estimado entre 2% y 22% y sin contradecir al mercado.'):'De '+NB.g.length+' partidos revisados, ninguno tiene un pick que pase los filtros. Es normal: casi nunca hay.'}</small>${L.map(x=>`<div class="mt" style="margin-top:12px"><b>${esc(x.g.a.n)}</b><em>@</em><b>${esc(x.g.h.n)}</b></div>${nbTicket(x.g,x.c,isLean)}`).join('')}</div>`}
  box.innerHTML=head+NB.g.map(nbCard).join('');nbPicks()}
function nbLog(k){const r=NB.reg[k];if(!r)return;NB.picks.unshift({id:Date.now(),t:r.t,p:+r.p.toFixed(3),q:r.q,st:r.st||'',res:null,d:today()});SV('nbapicks',NB.picks);nbPicks();toast('Pick NBA registrado')}
function nbRes(i,v){NB.picks[i].res=v;SV('nbapicks',NB.picks);nbPicks()}
function nbK(){const D=NB.picks.filter(x=>x.res),w=D.filter(x=>x.res==='w').length,E=D.reduce((t,x)=>t+x.p,0);NB.k=Math.max(.45,Math.min(.85,.75*(D.length>=8?(w+6)/(E+6):1)))}
function nbPicks(){nbK();const D=NB.picks.filter(x=>x.res),w=D.filter(x=>x.res==='w').length,roi=D.filter(x=>x.q).reduce((t,x)=>t+(x.res==='w'?x.q-1:-1),0);
  const grp=(f,lab)=>{const ks=[...new Set(D.map(f))].sort();return ks.length?`<div class="sec">${lab}</div>`+ks.map(k=>{const a=D.filter(x=>f(x)===k);return rwRow(k,a.filter(x=>x.res==='w').length,a.length,Math.round(100*a.reduce((t,x)=>t+x.p,0)/a.length))}).join(''):''};
  $('#nbpk').innerHTML=`<div class="card"><h2>Modelo NBA</h2><small>${D.length?`${w} de ${D.length} acertados (${Math.round(100*w/D.length)}%) · ROI ${roi>=0?'+':''}${roi.toFixed(1)} u${D.length>=8?' · el motor ya ajusta su confianza con tu historial':' · con 8 resueltos empieza a calibrarse solo'}`:'Registra picks con ＋ y márcalos ✓ o ✗ para medir el motor.'}</small>${D.length>=3?grp(x=>x.st||'Sin tipo','Acierto por tipo de pick')+grp(x=>Math.round(x.p*10)*10+'%','Acierto por probabilidad'):''}</div><div class="card"><h2>Mis picks NBA</h2>${NB.picks.slice(0,30).map((x,i)=>`<div class="nb-t"><span>${esc(x.t)}<small>${x.d} · ${Math.round(x.p*100)}%${x.q?' @'+x.q:''}</small></span>${x.res?`<b class="${x.res==='w'?'ok':'bad'}">${x.res==='w'?'✓':'✗'}</b><button class="btn s" onclick="nbRes(${i},null)">↺</button>`:`<button class="btn s" onclick="nbRes(${i},'w')">✓</button><button class="btn s" onclick="nbRes(${i},'l')">✗</button>`}</div>`).join('')||'<small>Aún no hay picks.</small>'}</div>`}
async function nbTest(){const o=$('#nbmsg');const R=[];const t=async(n,f)=>{try{R.push('✔ '+n+': '+await f())}catch(e){R.push('✘ '+n+': '+e.message)}o.textContent=R.join(' · ')};
  let tid,pid;await t('Calendario ESPN',async()=>{const j=await nbj(NE+'scoreboard');tid=((j.events||[])[0]||{competitions:[{competitors:[{team:{id:13}}]}]}).competitions[0].competitors[0].team.id;return (j.events||[]).length+' partidos'});
  await t('Plantilla',async()=>{const j=await nbj(NE+'teams/'+(tid||13)+'/roster'),A=(j.athletes||[]).flatMap(x=>x.items||[x]);pid=A[0]&&A[0].id;return A.length+' jugadores'});
  await t('Estadísticas por jugador',async()=>{const g=parseGL(await nbj(NW+'athletes/'+pid+'/gamelog'));return g.length+' partidos leídos'});
  await t('Líneas ESPN (gratis)',async()=>{const j=await nbj(NE+'scoreboard');let n=0;for(const e of j.events||[]){const c=e.competitions[0],tm=x=>c.competitors.find(y=>y.homeAway===x).team;if(espnLn(c,{ab:tm('home').abbreviation},{ab:tm('away').abbreviation}))n++}return n+' partidos con línea'});
  if(NC.keys.trim())await t('The Odds API',async()=>{const j=await nbo('events',{});return j.length+' partidos con cuotas'});
  if(NC.sgo)await t('Sports Game Odds',async()=>{const r=await fetch('https://api.sportsgameodds.com/v2/events?leagueID=NBA&limit=1&apiKey='+encodeURIComponent(NC.sgo));if(!r.ok)throw new Error(r.status);return 'responde'});
  if(NC.bdl)await t('balldontlie',async()=>{const r=await fetch('https://api.balldontlie.io/v1/teams',{headers:{Authorization:NC.bdl}});if(!r.ok)throw new Error(r.status);return 'responde'});
  await t('Bajas ESPN',async()=>Object.keys(await nbInj()).length+' jugadores con parte médico')}

const nzInj=s=>{s=String(s||'').toLowerCase();return /\bout\b|fuera/.test(s)?'out':/doubt/.test(s)?'doubt':/question|day|gtd|probable/.test(s)?'q':''};
async function nbInj(){const o={};try{const j=await nbj(NE+'injuries');for(const t of j.injuries||[])for(const x of t.injuries||[]){const s=nzInj(x.status);if(s&&x.athlete)o[nz(x.athlete.displayName)]={s,c:x.shortComment||x.status}}}catch{}return o}
function ns(name){const nn=nz(name);if(nn.length<5)return null;for(const ln of String(NC.news||'').split('\n')){if(!nz(ln).includes(nn))continue;const w=ln.toLowerCase(),c=ln.trim().slice(0,90);
  if(/\b(out|fuera|baja|descartad|ruled out|inactiv)/.test(w))return{s:'out',c};if(/doubt|dudoso/.test(w))return{s:'doubt',c};if(/question|day-to-day|gtd|duda|probable/.test(w))return{s:'q',c}}return null}
function gameCands(g){const m=gameModel(g);if(!m)return [];const od=(NB.od&&NB.od[g.id]&&NB.od[g.id].o)||{},C=[],fp=(a,b)=>a&&b&&a.q&&b.q?(1/a.q)/(1/a.q+1/b.q):null,add=(n,p,o,fair)=>C.push({n,p:shr(p,9),q:o?o.q:null,fair}),mar=m.mar;
  const ln=g.ln||{},hw=od['h2h|'+nz(g.h.n)+'|'],aw=od['h2h|'+nz(g.a.n)+'|'],sh=od['spreads|'+nz(g.h.n)+'|']||(ln.sp!=null?{p:ln.sp,q:null}:null),sa=od['spreads|'+nz(g.a.n)+'|']||(ln.sp!=null?{p:-ln.sp,q:null}:null),ov=od['totals|over|']||(ln.ou!=null?{p:ln.ou,q:null}:null),un=od['totals|under|']||(ln.ou!=null?{p:ln.ou,q:null}:null);
  add('Gana '+g.h.ab,1-Phi(-mar/12),hw,fp(hw,aw));add('Gana '+g.a.ab,Phi(-mar/12),aw,fp(aw,hw));
  if(sh&&sa){add(g.h.ab+' '+(sh.p>0?'+':'')+sh.p,1-Phi((-sh.p-mar)/12),sh,fp(sh,sa));add(g.a.ab+' '+(sa.p>0?'+':'')+sa.p,1-Phi((mar-sa.p)/12),sa,fp(sa,sh))}
  if(ov&&un){add('Total más de '+ov.p,1-Phi((ov.p-m.tot)/17),ov,fp(ov,un));add('Total menos de '+un.p,Phi((un.p-m.tot)/17),un,fp(un,ov))}
  return C}
const lect=g=>{const c=gameCands(g).filter(x=>/^Gana/.test(x.n)).sort((a,b)=>b.p-a.p)[0];return c?' · '+c.n+' '+Math.round(c.p*100)+'%':''};
async function llm(messages){let err='';
  if(cfg.gq){try{const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cfg.gq},body:JSON.stringify({model:MODEL,temperature:0,max_completion_tokens:1800,messages})}),j=await r.json();if(r.ok&&j.choices)return j.choices[0].message.content;err='Groq: '+((j.error&&j.error.message)||r.status)}catch(e){err='Groq: '+e.message}}
  if(cfg.or){try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cfg.or,'HTTP-Referer':'https://github.com/','X-Title':'RadarPi'},body:JSON.stringify({model:'openrouter/free',temperature:0,max_tokens:1800,messages})}),j=await r.json();if(r.ok&&j.choices)return j.choices[0].message.content;err+=' OpenRouter: '+((j.error&&j.error.message)||r.status)}catch(e){err+=' OpenRouter: '+e.message}}
  throw new Error(err||'configura Groq u OpenRouter en Ajustes')}
async function nbAI(id){const g=NB.g.find(x=>x.id==id),box=$('#nbai'+id);box.hidden=false;box.style.whiteSpace='pre-wrap';box.textContent='Analizando…';
  const m=gameModel(g),props=[];[g.h,g.a].forEach(s=>s.pl.forEach(p=>Object.keys(STX).forEach(st=>{const o=nbPropOpts(g,p,st);if(!o)return;const x=o.ov.pr>=o.un.pr?o.ov:o.un;props.push({jugador:p.n,equipo:p.tm,stat:STX[st][0],lado:x.name,linea:o.L,prob_pct:Math.round(x.pr*100),cuota:x.q,valor_pct:x.e!=null?Math.round(x.e*100):null,linea_real:o.real,ultimos10:o.P.a.slice(0,10),minutos:Math.round(p.mn),estado:p.st||null})})));
  props.sort((a,b)=>(b.linea_real-a.linea_real)||b.prob_pct-a.prob_pct);
  const data={partido:g.a.n+' @ '+g.h.n,proyeccion:m?{[g.a.ab]:Math.round(m.ap),[g.h.ab]:Math.round(m.hp),total:+m.tot.toFixed(1)}:null,mercados_partido:gameCands(g).map(c=>({mercado:c.n,prob_pct:Math.round(c.p*100),cuota:c.q})),bajas:{[g.h.ab]:g.h.out||[],[g.a.ab]:g.a.out||[]},bajas_pegadas_por_usuario:String(NC.news||'').slice(0,1500),props:props.slice(0,14)};
  try{box.textContent=await llm([{role:'system',content:'Eres analista escéptico de apuestas NBA. Usa solo los datos recibidos; no inventes lesiones, rachas ni cuotas. Las probabilidades salen de un modelo simple (últimos juegos, sin defensa rival ni ritmo), trátalas como estimaciones. Responde en español, breve: 1) lectura del partido, 2) hasta 3 picks (mercado, lado, línea, por qué, riesgo principal) solo si hay línea real y valor; si no, escribe "sin valor claro", 3) qué verificar antes de apostar (alineaciones, minutos). Sin garantías.'},{role:'user',content:JSON.stringify(data)}])}catch(e){box.textContent='Error de IA: '+e.message}}
window.nbCombiSource=async say=>{if(!NC.keys.trim())throw new Error('necesita llave de The Odds API (Ajustes NBA)');if(!NB.g.length||!NB.od){say&&say('NBA: escaneando…');await nbScan()}if(!NB.od)throw new Error('sin cuotas reales de NBA');
  return NB.g.map(g=>{const m=[],q={},fc={},put=(n,p,qq,fair)=>{if(!qq)return;m.push([n,p]);q[n]=qq;if(fair)fc[n]=fair};
    gameCands(g).forEach(c=>put(g.a.ab+'@'+g.h.ab+': '+c.n,c.p,c.q,c.fair));
    [g.h,g.a].forEach(s=>s.pl.forEach(p=>Object.keys(STX).forEach(st=>{const o=nbPropOpts(g,p,st);if(!o||!o.real)return;const a=o.ov.q,b=o.un.q,pf=a&&b?[(1/a)/(1/a+1/b),(1/b)/(1/a+1/b)]:[null,null];[o.ov,o.un].forEach((x,i)=>put(p.n+' '+x.name+' '+o.L+' '+STX[st][0],x.pr,x.q,pf[i]))})));
    return{nba:true,ev:g.id,slug:'nba',liga:'NBA',h:g.h.ab,w:g.a.ab,m:g.a.ab+' @ '+g.h.ab,hora:new Date(g.date).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),ko:g.date,hid:g.h.id,wid:g.a.id,casa:'The Odds API (EE. UU.)',p:[],A:{n:12},B:{n:12},mod:{m,fc},q}})};
function nbInit(){$('#nba-root').innerHTML=`<div class="combo-page-head"><div class="combo-page-icon">🏀</div><div><h2>NBA</h2><p>Props de jugadores y partidos con fuentes gratis.</p></div></div>
<div class="card"><div class="seg m" id="nbday"><button class="${NC.day?'':'on'}" onclick="NC.day=0;nbSet()">Hoy</button><button class="${NC.day?'on':''}" onclick="NC.day=1;nbSet()">Mañana</button></div>
<div class="tools"><button class="btn" id="nbgo" onclick="nbScan(false)">Escanear NBA</button><button class="btn s" onclick="nbTest()">Probar fuentes</button></div><button class="btn s" id="nbhunt" type="button" style="width:100%;min-height:46px;margin:10px 0 0" onclick="nbScan(true)">Buscar el mejor pick NBA</button><p class="status" id="nbmsg" role="status"></p></div>
<details class="card cfgbox"><summary>Bajas de última hora (Telegram / X)</summary><label>Pega los mensajes: nombre completo + OUT / Duda / Questionable (uno por línea)<textarea rows="5" onchange="NC.news=this.value;nbSet()">${esc(NC.news)}</textarea></label><p class="status">Telegram y X no se pueden leer automáticamente desde una página gratis. Pegas el texto y la app lo cruza con las plantillas en el próximo escaneo. Las bajas oficiales de ESPN se leen solas.</p></details><div id="nbres"></div><div id="nbpk"></div>
<details class="card cfgbox"><summary>Ajustes NBA</summary><label>Llaves The Odds API (una por línea; si una se agota usa la siguiente)<textarea id="nbk" rows="3" autocomplete="off" onchange="NC.keys=this.value;nbSet()">${esc(NC.keys)}</textarea></label>
<label>Sports Game Odds (llave, opcional)<input type="password" value="${esc(NC.sgo)}" onchange="NC.sgo=this.value.trim();nbSet()"></label><label>balldontlie (llave, opcional)<input type="password" value="${esc(NC.bdl)}" onchange="NC.bdl=this.value.trim();nbSet()"></label><p class="status">Sports Game Odds y balldontlie quedan guardadas y se comprueban en «Probar fuentes»; todavía no alimentan los picks.</p><label>Partidos por escaneo<input type="number" min="1" max="10" value="${NC.games}" onchange="NC.games=Math.max(1,+this.value||3);nbSet()"></label><label>Jugadores por equipo<input type="number" min="3" max="12" value="${NC.per}" onchange="NC.per=Math.max(3,+this.value||8);nbSet()"></label>
<p class="status">«Buscar el mejor pick NBA» revisa hasta 12 partidos y, con llave, gasta ~3 créditos + 5 por partido. Cada partido con props gasta ~5 créditos y el resumen del día 3 (500 gratis al mes por cuenta). Las cuotas son de casas de EE. UU., como referencia; confirma la de tu casa.</p></details>`;nbPicks()}
function nbSet(){SV('nbcfg',NC);document.querySelectorAll('#nbday button').forEach((b,i)=>b.classList.toggle('on',i===NC.day))}
nbInit();
Object.assign(window,{NB,NC,nbScan,nbCard,nbTest,nbLog,nbRes,nbSet,nbDraw,nbAI});
})();
