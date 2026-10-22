const $=s=>document.querySelector(s);
const LS=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const dlab=d=>{const k=iso(new Date(d));return k===today()?'':k===iso(new Date(Date.now()+864e5))?'Mañana · ':new Date(d).toLocaleDateString('es',{weekday:'short',day:'numeric'})+' · '};
const okDay=d=>{const k=iso(new Date(d));return k===today()||((cfg.dd||1)>=2&&k===iso(new Date(Date.now()+864e5)))};
function toast(t,ms){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),ms||2600)}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LG={
  "Colombia":"col.1","Premier League":"eng.1","Championship":"eng.2","La Liga":"esp.1","Serie A":"ita.1","Bundesliga":"ger.1","Ligue 1":"fra.1","Liga MX":"mex.1","Argentina":"arg.1","Brasileirão":"bra.1","Eredivisie":"ned.1","Primeira Liga":"por.1",
  "Champions League":"uefa.champions","Europa League":"uefa.europa","Conference League":"uefa.europa.conf","Libertadores":"conmebol.libertadores","Sudamericana":"conmebol.sudamericana","MLS":"usa.1",
  "Bélgica":"bel.1","Turquía":"tur.1","Escocia":"sco.1","Grecia":"gre.1","Austria":"aut.1","Suiza":"sui.1","Dinamarca":"den.1","Noruega":"nor.1","Suecia":"swe.1",
  "Chile":"chi.1","Uruguay":"uru.1","Paraguay":"par.1","Perú":"per.1","Ecuador":"ecu.1"
};
let cfg=Object.assign({fd:'',gq:'',or:'',br:'',g:3,b:70,m:12,u:2,qm:1.5,cq:1.5,af:'',dd:1,sm:5,hm:false,r:75,co:5,ta:5,ex:true,au:false,aa:false,iv:60,ok:'',bm:'',pn:true,lg:['col.1','eng.1','esp.1']},LS('cfg',{}));
cfg.lg=cfg.lg.filter(x=>Object.values(LG).includes(x));if(!cfg.lg.length)cfg.lg=['col.1','eng.1','esp.1'];
let openRes=false,autoRun=false,hunt=false,mdlTab='res',mdlAll=false;
let COMBI_CURRENT=[],combiTab='buscar';
let MODEL='openai/gpt-oss-120b';
let R=[],Rcombo=[],bets=LS('bets',[]);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>iso(new Date());

// pestañas
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
  if(b.dataset.t==='f'){b.classList.remove('dot');document.title='Radar de patrones'}
  ['f','c','n','r','m','a'].forEach(t=>{const el=$('#s-'+t);if(el)el.hidden=t!==b.dataset.t});
  if(b.dataset.t==='r')drawBets();
  if(b.dataset.t==='m')refreshModel();
  if(b.dataset.t==='c'){const cp=LS('combipicks',[]);$('#comboCount').textContent=cp.filter(x=>!x.res).length;if(combiTab==='modelo')drawCombiModel();}
});

// ligas
$('#comboCount').textContent=LS('combipicks',[]).filter(x=>!x.res).length;
function drawLg(){const lgn=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  $('#lg').innerHTML=Object.entries(LG).filter(([n])=>lgn(n).includes(lgn(($('#lgq')||{}).value||''))).map(([n,id])=>
  `<button class="chip ${cfg.lg.includes(id)?'on':''}" data-id="${id}">${n}</button>`).join('');
  $('#lg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const id=b.dataset.id;cfg.lg=cfg.lg.includes(id)?cfg.lg.filter(x=>x!==id):[...cfg.lg,id];SV('cfg',cfg);drawLg()})}
drawLg();$('#lgq').oninput=drawLg;
function updScan(){const e=$('#scansum');if(e)e.textContent='· '+cfg.lg.length+' ligas · '+((cfg.dd||1)>=2?'hoy y mañana':'hoy')}
function drawDd(){updScan();document.querySelectorAll('#dd button').forEach(b=>b.classList.toggle('on',+b.dataset.d===(cfg.dd||1)))}
document.querySelectorAll('#dd button').forEach(b=>b.onclick=()=>{cfg.dd=+b.dataset.d;SV('cfg',cfg);drawDd()});
drawDd();

// ajustes
$('#k-gq').value=cfg.gq;$('#k-gm').value=cfg.gk||'';$('#k-or').value=cfg.or||'';$('#k-br').value=cfg.br||'';$('#c-g').value=cfg.g;$('#c-b').value=cfg.b;$('#c-m').value=cfg.m;$('#c-qm').value=cfg.qm;$('#c-cq').value=cfg.cq||1.5;$('#c-af').value=cfg.af||'';$('#c-sm').value=cfg.sm;$('#c-hm').checked=cfg.hm;$('#c-afa').checked=!!cfg.afa;$('#c-fm').value=cfg.fm||'b';$('#c-afn').value=cfg.afn||8;$('#c-u').value=cfg.u;$('#c-r').value=cfg.r;$('#c-k').value=cfg.bk||'';$('#c-co').value=cfg.co;$('#c-ta').value=cfg.ta;$('#c-x').checked=cfg.ex;$('#c-au').checked=cfg.au;$('#c-aa').checked=cfg.aa;$('#c-iv').value=cfg.iv;$('#c-pn').checked=cfg.pn;$('#c-ok').value=cfg.ok;$('#c-ok2').value=cfg.ok2||'';$('#c-bm').value=cfg.bm;
$('#save').onclick=()=>{cfg.gq=$('#k-gq').value.trim();cfg.gk=$('#k-gm').value.trim();cfg.or=$('#k-or').value.trim();cfg.br=$('#k-br').value.trim();
  cfg.g=+$('#c-g').value||3;cfg.b=+$('#c-b').value||70;cfg.m=+$('#c-m').value||8;cfg.qm=+$('#c-qm').value||1.5;cfg.cq=Math.max(1.01,+$('#c-cq').value||1.5);cfg.af=$('#c-af').value.trim();cfg.sm=+$('#c-sm').value||5;cfg.hm=$('#c-hm').checked;cfg.afa=$('#c-afa').checked;cfg.fm=$('#c-fm').value;cfg.afn=Math.max(1,+$('#c-afn').value||8);cfg.u=+$('#c-u').value||2;cfg.r=+$('#c-r').value||75;cfg.bk=+$('#c-k').value||0;cfg.co=+$('#c-co').value||5;cfg.ta=+$('#c-ta').value||5;cfg.ex=$('#c-x').checked;cfg.au=$('#c-au').checked;cfg.aa=$('#c-aa').checked;cfg.iv=Math.max(15,+$('#c-iv').value||60);cfg.pn=$('#c-pn').checked;cfg.ok=$('#c-ok').value.trim();cfg.ok2=($('#c-ok2')||{value:cfg.ok2||''}).value.trim();op.i=0;cfg.bm=$('#c-bm').value.trim();SV('cfg',cfg);$('#save').textContent='Guardado'};

// ESPN puede bloquear o fallar desde algunas redes/navegadores. Se intenta directo y luego dos proxies públicos solo para ESPN.
async function fetchESPN(url,options){
  let err='';
  const timed=async (u,ms)=>{const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),ms);try{return await fetch(u,{...(options||{}),signal:ctl.signal})}finally{clearTimeout(timer)}};
  try{const r=await timed(url,4500);if(r.ok)return r;err='HTTP '+r.status;}catch(e){err=e&&e.name==='AbortError'?'tiempo agotado':(e&&e.message||'fallo de red');}
  const proxies=[u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u),u=>'https://corsproxy.io/?url='+encodeURIComponent(u)];
  for(const make of proxies){try{const r=await timed(make(url),2500);if(r.ok)return r;err+='; proxy HTTP '+r.status;}catch(e){err+='; proxy '+(e&&e.name==='AbortError'?'tiempo agotado':(e&&e.message||'fallo de red'));}}
  throw new Error('ESPN no respondió ('+err+'). Se omitió esta consulta para que el escaneo pueda continuar.');
}
// ESPN (API pública no oficial, sin llave). Sin rangos de fechas: partidos de hoy + calendario de cada equipo
async function espn(path){
  const r=await fetchESPN('https://site.api.espn.com/apis/site/v2/sports/soccer/'+path);
  return r.json();
}
const sc=x=>+(x.score&&x.score.value!=null?x.score.value:x.score);
// En Champions, Libertadores y Sudamericana el calendario de la competición es muy corto:
// se completa con la liga local de cada equipo (se descubre una vez y se guarda 30 días)
const CONT=['uefa.champions','uefa.europa','uefa.europa.conf','conmebol.libertadores','conmebol.sudamericana'];
const DOM=['eng.1','esp.1','ita.1','ger.1','fra.1','por.1','ned.1','bel.1','tur.1','sco.1','gre.1','aut.1','sui.1','cze.1','den.1','nor.1','swe.1','pol.1','ukr.1','cro.1','srb.1','cyp.1','isr.1','rou.1','bul.1','hun.1','svk.1','svn.1','fin.1','aze.1','geo.1','kaz.1','irl.1','wal.1','nir.1','isl.1','lva.1','est.1','ltu.1','mlt.1','blr.1','arm.1','mda.1','alb.1','bih.1','mkd.1','mne.1','arg.1','bra.1','col.1','chi.1','uru.1','par.1','per.1','ecu.1','bol.1','ven.1','mex.1','usa.1'];
async function domMap(){
  // Usa el mapa aprendido en escaneos anteriores; no fuerza una búsqueda global al iniciar.
  const c=LS('DOM5',null);return c&&Date.now()-c.t<14*864e5&&c.v?c.v:{};
}
// Descubre la liga doméstica del club cuando el mapa aún no conoce un equipo europeo.
// Prueba primero ligas frecuentes en lotes pequeños y se detiene al encontrar su calendario.
async function discoverDomestic(id){
  const key='DOMTEAM_'+String(id),cached=LS(key,null);
  if(cached&&Date.now()-cached.t<30*864e5)return cached.v||null;
  const priority=['eng.1','esp.1','ita.1','ger.1','fra.1','por.1','ned.1','bel.1','tur.1','sco.1','gre.1','aut.1','sui.1','cze.1','den.1','nor.1','swe.1','pol.1','ukr.1','cro.1','srb.1','cyp.1','isr.1','rou.1','bul.1','hun.1','svk.1','svn.1','fin.1','aze.1','geo.1','kaz.1','irl.1','wal.1','nir.1','isl.1','lva.1','est.1','ltu.1','mlt.1','blr.1','arm.1','mda.1','alb.1','bih.1','mkd.1','mne.1','arg.1','bra.1','col.1','chi.1','uru.1','par.1','per.1','ecu.1','bol.1','ven.1','mex.1','usa.1'];
  for(let i=0;i<priority.length;i+=8){
    const batch=priority.slice(i,i+8),found=await Promise.all(batch.map(async sl=>{try{const ev=await schedEvs(sl,id);return toGames(ev,id).length?sl:null}catch{return null}}));
    const sl=found.find(Boolean);if(sl){try{const m=await domMap();m[String(id)]=sl;SV('DOM5',{t:Date.now(),v:m});SV(key,{t:Date.now(),v:sl})}catch{}return sl;}
  }
  try{SV(key,{t:Date.now(),v:null})}catch{}return null;
}
const CAL=new Set(['arg.1','bra.1','col.1','chi.1','uru.1','par.1','per.1','ecu.1','bol.1','ven.1','usa.1','nor.1','swe.1','fin.1','isl.1','irl.1','conmebol.libertadores','conmebol.sudamericana']);
const prevSeason=sl=>{const d=new Date(),y=d.getFullYear();return CAL.has(sl)?y-1:(d.getMonth()>=6?y-1:y-2)};
async function schedEvs(sl,id,season){
  let j=null;try{j=await espn(`${sl}/teams/${id}/schedule`+(season?`?season=${season}`:''))}catch{}
  return ((j&&j.events)||[]).map(e=>[e,sl]);
}
function toGames(evs,id){
  evs=evs.slice().sort((a,b)=>a[0].date<b[0].date?-1:1);
  const v=[],vistos=new Set();
  for(const [e,sl] of evs){
    if(vistos.has(e.id))continue;
    const c0=e.competitions&&e.competitions[0];if(!c0)continue;
    const t=(c0.status||e.status||{}).type||{};if(!t.completed)continue;
    const me=c0.competitors.find(x=>String(x.team.id)===String(id)),ot=c0.competitors.find(x=>x!==me);
    if(!me||!ot)continue;
    const gf=sc(me),ga=sc(ot);if(isNaN(gf)||isNaN(ga))continue;
    vistos.add(e.id);v.push({id:e.id,sl,gf,ga,h:me.homeAway==='home',o:String(ot.team.id)});
  }
  return v;
}
// Si el equipo no está en el mapa de ligas locales, se busca su liga probando las ligas una por una (se guarda por equipo).
async function domOf(id,known){
  // Si el mapa cacheado no conoce al equipo, no sondear decenas de ligas durante el escaneo.
  const m=await domMap();return m[String(id)]||null;
}
// Fuerza del rival: cada partido del historial se ajusta por lo que ese rival suele marcar y recibir (tabla de su liga).
// Los goles crudos (gf, ga) se conservan para los patrones; el modelo usa gfa/gaa. En torneos continentales el ajuste se recorta a la mitad.
async function adjustForm(v,id){
  const dm=await domMap().catch(()=>({})),slOf=x=>CONT.includes(x.sl)?(dm[x.o]||null):x.sl,need=[...new Set(v.map(slOf).filter(Boolean))],S={};
  for(let i=0;i<need.length;i+=6)await Promise.all(need.slice(i,i+6).map(async s=>{S[s]=await standings(s).catch(()=>null)}));
  const cl=x=>Math.max(.6,Math.min(1.6,x));
  for(const x of v){
    const s=slOf(x),SL=s&&S[s],r=SL&&SL.t[x.o];
    if(!r||!SL.mu){x.gfa=x.gf;x.gaa=x.ga;continue}
    const k=Math.min(1,r.gp/12)*(CONT.includes(x.sl)?.5:1),sa=cl(1+((r.gf/r.gp)/SL.mu-1)*k),sd=cl(1+((r.ga/r.gp)/SL.mu-1)*k);
    x.gfa=+(x.gf/sd).toFixed(3);x.gaa=+(x.ga/sa).toFixed(3);
  }
}
async function teamForm(slug,id){
  const k='Y6'+slug+id,cc=LS(k,null);
  if(cc&&cc.d===today()&&(cc.v||[]).length>=5)return cc.v;
  let evs=await schedEvs(slug,id);
  const sls=[slug];
  // Torneos cortos (Champions, Europa, Libertadores…): se completa con la liga local del equipo.
  if(CONT.includes(slug)){
    let dom=await domOf(id,new Set(evs.map(x=>x[0].id)));
    // Si no existe mapeo guardado (frecuente en Europa/Conference al inicio de temporada),
    // localizar la competición doméstica real del club en vez de usar solo partidos UEFA.
    if(!dom)dom=await discoverDomestic(id);
    if(dom&&dom!==slug){sls.push(dom);evs=evs.concat(await schedEvs(dom,id))}
  }
  // Si aún hay menos de 10 partidos (inicio de temporada), se suma la temporada anterior de esas mismas competiciones.
  if(toGames(evs,id).length<10){
    for(const sl of sls)evs=evs.concat(await schedEvs(sl,id,prevSeason(sl)));
  }
  const out=toGames(evs,id).slice(-10);
  try{await adjustForm(out,id)}catch{}
  if(cfg.ex)await addExtra(slug,out,id);
  SV(k,{d:today(),v:out});return out;
}
// córners y tarjetas por partido (se guardan para siempre: un partido jugado no cambia)
async function ev(slug,eid){
  const k='S2'+eid,c=LS(k,null);if(c)return c;
  try{
    const r=await fetchESPN(`https://site.web.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eid}`).catch(()=>null);
    if(!r)return null;
    const j=await r.json(),o={};
    for(const t of (j.boxscore&&j.boxscore.teams)||[]){
      const g=n=>{const x=(t.statistics||[]).find(q=>q.name===n);return x?+x.displayValue:null};
      o[t.team.id]={c:g('wonCorners'),y:g('yellowCards'),r:g('redCards')};
    }
    for(const t of (j.rosters||[])){const id=t.team&&t.team.id;if(id==null)continue;(o[id]=o[id]||{}).s=(t.roster||[]).filter(p=>p.starter&&p.athlete&&p.athlete.id!=null).map(p=>String(p.athlete.id))}
    SV(k,o);return o;
  }catch{return null}
}
async function addExtra(slug,v,id){
  for(let i=0;i<v.length;i+=6){
    await Promise.all(v.slice(i,i+6).map(async x=>{
      const o=await ev(x.sl||slug,x.id);if(!o)return;
      const me=o[id],ot=Object.entries(o).find(([t])=>String(t)!==String(id));
      if(me&&me.s&&me.s.length)x.st=me.s;
      if(me&&me.c!=null&&!isNaN(me.c)){x.cf=me.c;x.y=(me.y||0)+(me.r||0)}
      if(ot&&ot[1].c!=null&&!isNaN(ot[1].c))x.ca=ot[1].c;
    }));
  }
}
function st(v){
  const n=v.length||1,win=x=>x.gf>x.ga,pc=k=>Math.round(100*k/n);
  const H=v.filter(x=>x.h===true),W=v.filter(x=>x.h===false);
  const avg=(a,f)=>{const z=a.map(f).filter(x=>x!=null&&!isNaN(x));return z.length>=3?z.reduce((s,x)=>s+x,0)/z.length:null};
  const wm=f=>{let s=0,w=0;v.forEach((x,i)=>{const k=Math.pow(0.9,v.length-1-i);s+=f(x)*k;w+=k});return w?s/w:0};
  let rs=0;for(let i=v.length-1;i>=0&&win(v[i]);i--)rs++;
  return{n:v.length,l:v.filter(x=>x.gf<x.ga).length,w:v.filter(win).length,
    gf:v.reduce((a,x)=>a+x.gf,0)/n,t:v.reduce((a,x)=>a+x.gf+x.ga,0)/n,
    gfw:wm(x=>x.gfa??x.gf),gaw:wm(x=>x.gaa??x.ga),adj:v.filter(x=>x.gfa!=null&&Math.abs(x.gfa-x.gf)+Math.abs(x.gaa-x.ga)>.01).length,
    gfH:avg(H,x=>x.gfa??x.gf),gaH:avg(H,x=>x.gaa??x.ga),gfA:avg(W,x=>x.gfa??x.gf),gaA:avg(W,x=>x.gaa??x.ga),
    b:pc(v.filter(x=>x.gf>0&&x.ga>0).length),low:pc(v.filter(x=>x.gf+x.ga<=2).length),
    cs:v.filter(x=>x.ga===0).length,fts:v.filter(x=>x.gf===0).length,
    hn:H.length,hw:H.filter(win).length,an:W.length,aw:W.filter(win).length,rs,
    cf:avg(v,x=>x.cf),ca:avg(v,x=>x.ca),y:avg(v,x=>x.y),sx:starters(v),fm:v.slice(-5).map(x=>x.gf>x.ga?'W':x.gf<x.ga?'L':'D').join('')}}
function starters(v){
  const w=v.filter(x=>x.st&&x.st.length),c={};
  w.forEach((x,i)=>{const rec=w.length-1-i;x.st.forEach(id=>{const e=c[id]||(c[id]=[0,0]);e[0]++;if(rec<5)e[1]++})});
  return{n:w.length,c};
}

// Modelo (Poisson): goles con forma reciente ponderada y separación local/visitante; córners y tarjetas si hay datos
function model(A,B){
  const sh=x=>0.7*x+0.3*1.35,pois=(l,k)=>{let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p};
  const cdf=(l,k)=>{let q=0;for(let i=0;i<=k;i++)q+=pois(l,i);return q};
  const cdfN=(l,k,r)=>{let q=Math.pow(r/(r+l),r),t=q;for(let i=0;i<k;i++){q*=(i+r)/(i+1)*l/(r+l);t+=q}return t}; // binomial negativa: córners y tarjetas varían más que un Poisson
  const bl=(sp,k,ov)=>sp!=null&&k>=3?0.5*sp+0.5*ov:ov;
  const mu=A.mu||1.35,wS=X=>X.ss?Math.min(0.6,X.ss.gp/(X.ss.gp+12)):0;
  // Regularización: cada razón de ataque/defensa se acerca a 1 como si hubiera K partidos 'promedio' (con 10 partidos, 6 de 16 son el promedio).
  // Antes era mucho más débil y dos razones altas multiplicadas inflaban los goles esperados.
  const K=6,shr=(x,n)=>(x*n+K)/(n+K);
  const att=(X,sp,k)=>{const f=shr(bl(sp,k,X.gfw)/mu,Math.min(10,X.n||10)),w=wS(X),q=X.ss?shr((X.ss.gf/X.ss.gp)/mu,X.ss.gp):f;return w*q+(1-w)*f};
  const def=(X,sp,k)=>{const f=shr(bl(sp,k,X.gaw)/mu,Math.min(10,X.n||10)),w=wS(X),q=X.ss?shr((X.ss.ga/X.ss.gp)/mu,X.ss.gp):f;return w*q+(1-w)*f};
  const lh=mu*att(A,A.gfH,A.hn)*def(B,B.gaA,B.an)*1.06,la=mu*att(B,B.gfA,B.an)*def(A,A.gaH,A.hn)*0.94;
  const rho=-0.1,tau=(i,j)=>i===0&&j===0?1-lh*la*rho:i===0&&j===1?1+lh*rho:i===1&&j===0?1+la*rho:i===1&&j===1?1-rho:1;
  let H=0,D=0,V=0,o15=0,o25=0,o35=0,o45=0,bt=0;const X={h2:0,v2:0,odd:0,g23:0,bo:0,ho:0,vo:0,hwn:0,vwn:0};
  for(let i=0;i<=9;i++)for(let j=0;j<=9;j++){
    const p=pois(lh,i)*pois(la,j)*tau(i,j);
    if(i>j)H+=p;else if(i===j)D+=p;else V+=p;
    if(i+j>=2)o15+=p;if(i+j>=3)o25+=p;if(i+j>=4)o35+=p;if(i+j>=5)o45+=p;if(i>0&&j>0)bt+=p;if(i-j>=2)X.h2+=p;if(j-i>=2)X.v2+=p;if((i+j)%2)X.odd+=p;if(i+j>=2&&i+j<=3)X.g23+=p;if(i>0&&j>0&&i+j>=3)X.bo+=p;if(i>j&&i+j>=3)X.ho+=p;if(j>i&&i+j>=3)X.vo+=p;if(i>j&&j===0)X.hwn+=p;if(j>i&&i===0)X.vwn+=p;
  }
  const T=H+D+V,h=H/T,d=D/T,v=V/T;
  // BTTS: combina Poisson con tasas observadas de gol y de porterías en cero.
  // Así no depende únicamente de los goles esperados ni sobrevalora un solo patrón.
  const rate=(x,k)=>x&&x.n?Math.max(0,Math.min(1,k/x.n)):0.5;
  const homeScores=(rate(A,A.n-A.fts)+rate(B,B.n-B.cs))/2;
  const awayScores=(rate(B,B.n-B.fts)+rate(A,A.n-A.cs))/2;
  const empiricalBTTS=Math.max(0.05,Math.min(0.95,homeScores*awayScores));
  const bttsRaw=bt/T;
  const bttsBlend=0.55*bttsRaw+0.45*empiricalBTTS;
  const btts=0.90*bttsBlend+0.05; // ligera regresión al 50% para reducir extremos con muestras pequeñas
  const m=[['Local gana',h],['Empate',d],['Visitante gana',v],['Doble oportunidad 1X',h+d],['Doble oportunidad X2',d+v],['Doble oportunidad 12',h+v],
    ['Over 1.5',o15/T],['Over 2.5',o25/T],['Over 3.5',o35/T],['Under 1.5',1-o15/T],['Under 2.5',1-o25/T],
    ['Ambos marcan: sí',btts],['Ambos marcan: no',1-btts],
    ['Local marca 1+ gol',1-pois(lh,0)],['Local marca 2+ goles',1-pois(lh,0)-pois(lh,1)],
    ['Visitante marca 1+ gol',1-pois(la,0)],['Visitante marca 2+ goles',1-pois(la,0)-pois(la,1)],
    ['Local deja arco en cero',pois(la,0)],['Visitante deja arco en cero',pois(lh,0)]];
  m.push(['Over 4.5',o45/T],['Under 3.5',1-o35/T]);
  m.push(['Under 4.5',1-o45/T],['Local gana por 2+ goles',X.h2/T],['Visitante gana por 2+ goles',X.v2/T],['Hándicap local +1.5',1-X.v2/T],['Hándicap visitante +1.5',1-X.h2/T],['Goles: 2 o 3',X.g23/T],['Goles impar',X.odd/T],['Goles par',1-X.odd/T],['Ambos marcan y Over 2.5',X.bo/T],['Local gana y Over 2.5',X.ho/T],['Visitante gana y Over 2.5',X.vo/T],['Local gana sin recibir gol',X.hwn/T],['Visitante gana sin recibir gol',X.vwn/T]);
  // Mercados por mitades: estimación EXPERIMENTAL usando un reparto genérico 45%/55% de los goles esperados.
  // No están calibrados por liga; se muestran para explorar, pero se excluyen de la selección automática de picks.
  const share1=.45,share2=.55,tot=lh+la,tot1=tot*share1,tot2=tot*share2;
  const pGoal1=1-Math.exp(-tot1),pGoal2=1-Math.exp(-tot2);
  const pOver15H1=1-Math.exp(-tot1)*(1+tot1);
  m.push(['Primer tiempo Over 0.5',pGoal1],['Primer tiempo Under 0.5',1-pGoal1],['Primer tiempo Over 1.5',pOver15H1],
    ['Segundo tiempo Over 0.5',pGoal2],['Gol en ambas mitades',pGoal1*pGoal2],
    ['Ambos marcan: sí (1er tiempo)',(1-Math.exp(-lh*share1))*(1-Math.exp(-la*share1))],
    ['Ambos marcan: sí (2do tiempo)',(1-Math.exp(-lh*share2))*(1-Math.exp(-la*share2))],
    ['Local marca en ambas mitades',(1-Math.exp(-lh*share1))*(1-Math.exp(-lh*share2))],
    ['Visitante marca en ambas mitades',(1-Math.exp(-la*share1))*(1-Math.exp(-la*share2))]);
  let lc=null,lk=null;
  if(A.cf!=null&&B.cf!=null&&A.ca!=null&&B.ca!=null){
    lc=0.8*((A.cf+B.ca)/2+(B.cf+A.ca)/2)+0.2*9.8;
    for(const x of [7,8,9,10,11,12])m.push([`Córners Over ${x}.5`,1-cdfN(lc,x,40)]);
    for(const x of [8,9,10,11])m.push([`Córners Under ${x}.5`,cdfN(lc,x,40)]);
  }
  if(A.y!=null&&B.y!=null){
    lk=0.7*(A.y+B.y)+0.3*4;
    for(const x of [2,3,4,5,6])m.push([`Tarjetas Over ${x}.5`,1-cdfN(lk,x,15)]);
    for(const x of [3,4,5,6])m.push([`Tarjetas Under ${x}.5`,cdfN(lk,x,15)]);
  }
  return{lh,la,lc,lk,m};
}

// ===== Cuotas automáticas: OddsPapi v4 (plan gratis: 250 peticiones/mes, todo se guarda en caché) =====
const OPB='https://api.oddspapi.io/v4/';
async function op(path,params){
  op.t=op.t||0;const w=1100-(Date.now()-op.t);if(w>0)await new Promise(r=>setTimeout(r,w));op.t=Date.now();
  const ks=[cfg.ok,cfg.ok2].filter(Boolean);op.i=Math.min(op.i||0,Math.max(0,ks.length-1));
  for(;;){
    const r=await fetch(OPB+path+'?'+new URLSearchParams({...(params||{}),apiKey:ks[op.i]||cfg.ok}));
    const t=await r.text();
    if(!r.ok){
      // Clave agotada o rechazada (401/402/403/429): pasa a la clave de respaldo y repite la petición
      if([401,402,403,429].includes(r.status)&&op.i<ks.length-1){op.i++;toast('Clave OddsPapi agotada: usando la clave de respaldo');continue}
      throw new Error('OddsPapi '+r.status+' '+t.slice(0,100));
    }
    return JSON.parse(t);
  }
}
async function cached(k,days,fn){const c=LS(k,null);if(c&&Date.now()-c.t<days*864e5)return c.v;const v=await fn();SV(k,{t:Date.now(),v});return v}
const TL={'col.1':[/colombia/i,/primera a|betplay|liga/i],'eng.1':[/england/i,/^premier league$/i],'eng.2':[/england/i,/^championship$/i],
  'esp.1':[/spain/i,/^la ?liga$/i],'ita.1':[/italy/i,/^serie a$/i],'ger.1':[/germany/i,/^bundesliga$/i],'fra.1':[/france/i,/^ligue 1$/i],
  'mex.1':[/mexico/i,/liga mx/i],'arg.1':[/argentina/i,/liga profesional|primera divisi/i],'bra.1':[/brazil/i,/serie a|brasileir/i],
  'ned.1':[/netherlands/i,/eredivisie/i],'por.1':[/portugal/i,/primeira liga|liga portugal/i],
  'uefa.champions':[/./,/champions league/i],
  'uefa.europa':[/./,/^(?!.*conference).*europa league/i],
  'uefa.europa.conf':[/./,/conference league/i],
  'bel.1':[/belgium/i,/pro league|jupiler/i],'tur.1':[/turkey|türkiye/i,/super lig|süper lig/i],
  'sco.1':[/scotland/i,/premiership/i],'gre.1':[/greece/i,/super league/i],'aut.1':[/austria/i,/bundesliga/i],
  'sui.1':[/switzerland/i,/super league/i],'den.1':[/denmark/i,/superliga/i],'nor.1':[/norway/i,/eliteserien/i],
  'swe.1':[/sweden/i,/allsvenskan/i],'chi.1':[/chile/i,/primera division|liga de primera/i],
  'uru.1':[/uruguay/i,/primera division/i],'par.1':[/paraguay/i,/primera division/i],
  'per.1':[/peru/i,/liga 1|primera division/i],'ecu.1':[/ecuador/i,/liga pro|serie a/i],
  'conmebol.libertadores':[/./,/libertadores/i],'conmebol.sudamericana':[/./,/sudamericana/i],'usa.1':[/usa|united states/i,/mls|major league soccer/i]};
const BADT=/women|femenin|u-?\d\d|youth|reserve|qualif|serie [bcd]|primera b|segunda|\b2\./i;
async function tourIds(){
  return cached('optour_v4',7,async()=>{
    const all=await op('tournaments',{sportId:10}),out={};
    for(const [slug,[c,n]] of Object.entries(TL)){
      const f=all.filter(t=>c.test(t.categoryName||'')&&n.test(t.tournamentName||'')&&!BADT.test(t.tournamentName||''));
      if(f.length)out[slug]=f.sort((a,b)=>(b.futureFixtures||0)-(a.futureFixtures||0))[0].tournamentId;
    }
    return out;
  });
}
async function mkMap(){
  return cached('opmk_v6',7,async()=>{
    const ms=await op('markets'),o={};
    for(const m of ms){
      if(+m.sportId!==10||m.playerProp)continue;
      const nm=m.marketName||'',h=m.handicap,oc=m.outcomes||[],ky=i=>m.marketId+'_'+oc[i].outcomeId;
      const per=String(m.period||'').toLowerCase().replace(/[^a-z0-9]/g,''),first=/firsthalf|1sthalf|half1|period1/.test(per)||/first half|1st half/i.test(nm),second=/secondhalf|2ndhalf|half2|period2/.test(per)||/second half|2nd half/i.test(nm),full=!first&&!second&&(!per||/^(fulltime|fullmatch|match|90min|regulation)$/.test(per));
      // Mapear por el nombre semántico del resultado, nunca por outcomeId supuesto:
      // los IDs pueden variar entre mercados/proveedores y podrían intercambiar Sí/No.
      const idx=re=>oc.findIndex(x=>re.test(String(x.outcomeName||'').trim().toLowerCase()));
      const isRes=!first&&!second&&(m.marketId===101||/^(full time result|match result|1x2|match winner|three way)/i.test(nm));
      // No basta el marketId: exigimos que el nombre identifique realmente BTTS.
      const isBtts=!first&&!second&&/both teams to score|\bbtts\b/i.test(nm)&&!/team total/i.test(nm);
      if(full&&isRes&&oc.length===3){
        const hi=idx(/^(1|home|local)$/),di=idx(/^(x|draw|empate)$/),ai=idx(/^(2|away|visitante)$/);
        if(hi>=0&&di>=0&&ai>=0&&new Set([hi,di,ai]).size===3){o['Local gana']=ky(hi);o['Empate']=ky(di);o['Visitante gana']=ky(ai)}
      }
      else if(full&&isBtts&&oc.length===2){
        const yi=idx(/^(yes|sí|si)$/),ni=idx(/^no$/);
        // Si los nombres no permiten distinguir ambos resultados, no importamos esas cuotas.
        if(yi>=0&&ni>=0&&yi!==ni){o['Ambos marcan: sí']=ky(yi);o['Ambos marcan: no']=ky(ni)}
      }
      else if(full&&oc.length===2&&idx(/^over/)>=0&&idx(/^under/)>=0){
        // Mercados de goles por equipo: solo se aceptan si el nombre identifica explícitamente local/visitante.
        const homeTotal=/(home|host).*(team|total|goal)|(team|total|goal).*(home|host)/i.test(nm);
        const awayTotal=/(away|visitor|visiting).*(team|total|goal)|(team|total|goal).*(away|visitor|visiting)/i.test(nm);
        const line=Number(h),oi=idx(/^over/),ui=idx(/^under/);
        if(homeTotal&&[0.5,1.5].includes(line)){if(line===0.5){o['Local marca 1+ gol']=ky(oi);o['Visitante deja arco en cero']=ky(ui)}else o['Local marca 2+ goles']=ky(oi)}
        else if(awayTotal&&[0.5,1.5].includes(line)){if(line===0.5){o['Visitante marca 1+ gol']=ky(oi);o['Local deja arco en cero']=ky(ui)}else o['Visitante marca 2+ goles']=ky(oi)}
      }
      else if(full&&/double chance/i.test(nm)&&oc.length===3){
        oc.forEach((x,i)=>{const n=String(x.outcomeName).replace(/\s/g,'').toUpperCase();
          const t={'1X':'Doble oportunidad 1X','X2':'Doble oportunidad X2','12':'Doble oportunidad 12'}[n];if(t)o[t]=ky(i)})}
      else if(oc.length===2&&idx(/^over/)>=0&&idx(/^under/)>=0&&!/team|player/i.test(nm)&&(full||first||second)){
        if((first||second)&&/corner|card|booking/i.test(nm))continue; // córners/tarjetas por mitad no se mezclan con los goles por mitad
        const pre=first?'Primer tiempo ':second?'Segundo tiempo ':/corner/i.test(nm)?'Córners ':/card|booking/i.test(nm)?'Tarjetas ':/^(over[ \/]?under|total goals?|goals? over[ \/]?under|match goals?)( full[ -]?time| 90 ?min(ute)?s?| regular time)?$/i.test(nm.trim())?'':null;
        if(pre===null||(!full&&!first&&!second&&pre===''))continue;
        o[`${pre}Over ${h}`]=ky(idx(/^over/));o[`${pre}Under ${h}`]=ky(idx(/^under/));
      }
      if((first||second)&&oc.length===2&&/both teams to score|\bbtts\b|ambos marcan/i.test(nm)){
        const yes=oc.findIndex(x=>/^(yes|sí|si)$/i.test(String(x.outcomeName||'').trim())),no=oc.findIndex(x=>/^no$/i.test(String(x.outcomeName||'').trim())),pre=first?'1er tiempo':'2do tiempo';
        if(yes>=0&&no>=0&&yes!==no){o[`Ambos marcan: sí (${pre})`]=ky(yes);/* experimental: no se usa para pick automático */}
      }
    }
    return o;
  });
}
async function loadOdds(bm,lg){
  bm=bm||cfg.bm;lg=lg||cfg.lg;const key='market-map-v6|'+bm+'|'+lg.join(','),cacheKey='odds_v6_'+bm,c=LS(cacheKey,null);
  if(autoRun&&!(c&&c.k===key))throw new Error('el escaneo automático no gasta cuotas; haz un escaneo manual');
  if(c&&c.k===key&&(Date.now()-c.t<3*36e5||autoRun))return c.v;
  const MK=await mkMap(),T=await tourIds(),P=await cached('oppart',30,()=>op('participants',{sportId:10}));
  const ids=lg.map(x=>T[x]).filter(Boolean);
  if(!ids.length)throw new Error('no encontré esas ligas en OddsPapi');
  let size=+(LS('opchunk',5))||5;const arr=[];
  for(let i=0;i<ids.length;){
    try{arr.push(...await op('odds-by-tournaments',{bookmaker:bm,tournamentIds:ids.slice(i,i+size).join(',')}));i+=size}
    catch(e){if(/too many/i.test(e.message)&&size>1){size=Math.max(1,Math.floor(size/2));SV('opchunk',size)}else throw e}
  }
  const keys=new Set(Object.values(MK).map(x=>x.split('_')[0])),out=[];
  for(const f of arr){
    const b=f.bookmakerOdds&&f.bookmakerOdds[bm];if(!b)continue;
    const t=new Date(f.startTime).getTime();if(t<Date.now()-36e5||t>Date.now()+48*36e5)continue;
    const pr={};
    for(const [mid,m] of Object.entries(b.markets||{})){
      if(!keys.has(mid))continue;
      for(const [oid,o] of Object.entries(m.outcomes||{})){const pl=o.players&&o.players['0'];if(pl&&pl.active!==false&&pl.price>1)pr[mid+'_'+oid]=pl.price}
    }
    out.push({h:P[f.participant1Id]||'',w:P[f.participant2Id]||'',t,pr});
  }
  const v={fx:out,mk:MK};SV(cacheKey,{k:key,t:Date.now(),v});return v;
}
const ALIAS={koln:'cologne',munchen:'munich',muenchen:'munich',wien:'vienna',praha:'prague',kobenhavn:'copenhagen',beograd:'belgrade',lisboa:'lisbon',internazionale:'inter',sankt:'st',saint:'st'};
const nz=s=>String(s).toLowerCase().replace(/ø/g,'o').replace(/æ/g,'ae').replace(/ß/g,'ss').replace(/ł/g,'l').replace(/đ/g,'d').replace(/œ/g,'oe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\b(fc|cf|afc|sc|ac|cd|club|de|the|1)\b/g,' ').split(/\s+/).filter(Boolean).map(w=>ALIAS[w]||w).join(' ');
function sim(a,b){
  const A=nz(a).split(/\s+/).filter(Boolean),B=nz(b).split(/\s+/).filter(Boolean);
  if(!A.length||!B.length)return 0;
  const m=(x,y)=>x===y||(x.length>=3&&y.startsWith(x))||(y.length>=3&&x.startsWith(y));
  return A.filter(x=>B.some(y=>m(x,y))).length/Math.min(A.length,B.length);
}
function oddsFx(OD,hf,wf,ko){
  if(!OD||!Array.isArray(OD.fx))return null;
  const t=new Date(ko).getTime();
  const cand=OD.fx.map(x=>({x,dh:sim(hf,x.h),da:sim(wf,x.w),dt:Math.abs(x.t-t)}))
    .filter(z=>z.dt<2.5*36e5&&z.dh>=0.67&&z.da>=0.67)
    .sort((a,b)=>(b.dh+b.da-a.dh-a.da)||(a.dt-b.dt));
  return cand[0]?cand[0].x:null;
}
// Si una línea más alta paga menos que una más baja, o el margen es absurdo, el mapeo es dudoso y se descarta.
function qSane(q){
  const bad=[],drop=(...ns)=>ns.forEach(n=>{if(q[n]!=null){delete q[n];bad.push(n)}});
  // Cuotas decimales fuera de rango o no numéricas no pasan al modelo.
  for(const n of Object.keys(q)){const v=Number(q[n]);if(!Number.isFinite(v)||v<1.01||v>100)drop(n);else q[n]=v;}
  const lines=pre=>Object.keys(q).filter(n=>n.startsWith(pre+'Over ')).map(n=>+n.slice(pre.length+5)).filter(Number.isFinite).sort((a,b)=>a-b);
  for(const pre of ['','Córners ','Tarjetas ']){
    const L=lines(pre);
    for(let i=1;i<L.length;i++){const a=`${pre}Over ${L[i-1]}`,b=`${pre}Over ${L[i]}`;if(q[a]!=null&&q[b]!=null&&q[b]+0.02<q[a])drop(a,b)}
    for(const l of L){const o=`${pre}Over ${l}`,u=`${pre}Under ${l}`;if(q[o]!=null&&q[u]!=null){const m=1/q[o]+1/q[u];if(m<0.99||m>1.2)drop(o,u)}}
  }
  if(q['Ambos marcan: sí']&&q['Ambos marcan: no']){const m=1/q['Ambos marcan: sí']+1/q['Ambos marcan: no'];if(m<0.99||m>1.2)drop('Ambos marcan: sí','Ambos marcan: no')}
  if(q['Local gana']&&q['Empate']&&q['Visitante gana']){const m=1/q['Local gana']+1/q['Empate']+1/q['Visitante gana'];if(m<0.99||m>1.25)drop('Local gana','Empate','Visitante gana','Doble oportunidad 1X','Doble oportunidad X2','Doble oportunidad 12')}
  oddsQ.last=bad;return q;
}
function oddsQ(OD,hf,wf,ko){
  oddsQ.last=[];
  const f=oddsFx(OD,hf,wf,ko);if(!f)return null;
  const q={};for(const [n,k] of Object.entries(OD.mk)){const v=+(f.pr&&f.pr[k]);if(Number.isFinite(v)&&v>1)q[n]=v}
  qSane(q);
  return Object.keys(q).length?q:null;
}
async function standings(slug){
  const k='ST'+slug,c=LS(k,null);if(c&&c.d===today())return c.v;
  const r=await fetchESPN(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`).catch(()=>null);
  if(!r)return null;
  const j=await r.json(),es=[],t={};let G=0,P=0;
  const walk=x=>{if(x.standings&&x.standings.entries)es.push(...x.standings.entries);(x.children||[]).forEach(walk)};walk(j);
  for(const e of es){
    const st={};(e.stats||[]).forEach(q=>st[q.name]=q.value);
    const gp=+st.gamesPlayed,gf=+st.pointsFor,ga=+st.pointsAgainst;
    if(gp>0&&!isNaN(gf)&&!isNaN(ga)){t[e.team.id]={gp,gf,ga};G+=gf;P+=gp}
  }
  const v=P?{mu:P>=30?G/P:1.35,t}:null;SV(k,{d:today(),v});return v;
}
// probabilidad "justa" de la casa de referencia: se le quita el margen a cada mercado
function fairP(q){
  const f={},g=(a,b)=>{if(q[a]&&q[b]){const x=1/q[a],y=1/q[b];f[a]=x/(x+y);f[b]=y/(x+y)}};
  if(q['Local gana']&&q['Empate']&&q['Visitante gana']){
    const x=[1/q['Local gana'],1/q['Empate'],1/q['Visitante gana']],s=x[0]+x[1]+x[2],h=x[0]/s,d=x[1]/s,v=x[2]/s;
    Object.assign(f,{'Local gana':h,'Empate':d,'Visitante gana':v,'Doble oportunidad 1X':h+d,'Doble oportunidad X2':d+v,'Doble oportunidad 12':h+v});
  }
  g('Ambos marcan: sí','Ambos marcan: no');g('Goles impar','Goles par');
  for(const l of ['1.5','2.5','3.5','4.5'])g('Over '+l,'Under '+l);
  for(const l of ['7.5','8.5','9.5','10.5','11.5','12.5','13.5'])g('Córners Over '+l,'Córners Under '+l);
  for(const l of ['2.5','3.5','4.5','5.5','6.5','7.5'])g('Tarjetas Over '+l,'Tarjetas Under '+l);
  return f;
}
// A = la casa paga más que Pinnacle Y el modelo también ve valor; B = confirmación parcial; C = solo el modelo
function tierOf(r,n){
  if(!r.q||!r.q[n]||!r.mod.raw)return null;
  const f=r.mod.f&&r.mod.f[n],pm=(r.mod.raw.find(x=>x[0]===n)||[0,0])[1],q=r.q[n];
  if(f==null||pm<0.35||pm>0.9)return null;
  const eM=f*q-1,eD=pm*q-1;
  if(eM>0.03&&eD>0.05)return 'A';
  if((eM>0.015&&eD>0.02)||eM>0.05)return 'B';
  if(eD>0.08&&eM>-0.02)return 'C';
  return null;
}
function best(r){
  if(!r.q)return null;let b=null;
  for(const [n,p] of r.mod.m){const q=r.q[n];if(!q||p<0.35||p>0.9)continue;const e=p*q-1;if(!b||e>b.e)b={n,q,e,p}}
  return b;
}
$('#bkfind').onclick=async()=>{
  cfg.ok=$('#c-ok').value.trim();cfg.ok2=($('#c-ok2')||{value:cfg.ok2||''}).value.trim();op.i=0;SV('cfg',cfg);const o=$('#bkres');o.textContent='Buscando…';
  try{
    const bs=await op('bookmakers'),L=(Array.isArray(bs)?bs:Object.values(bs)).filter(b=>/rush|betplay|betano|codere|wplay/i.test(JSON.stringify(b)));
    o.innerHTML=L.length?L.map(b=>{const sl=b.slug||b.bookmakerSlug||b.bookmaker||'';return `<button type="button" class="chip" data-s="${esc(sl)}">${esc(b.name||b.bookmakerName||sl)} · ${esc(sl)}</button>`}).join(''):'No encontré esas casas.';
    o.querySelectorAll('button').forEach(x=>x.onclick=()=>{$('#c-bm').value=x.dataset.s;cfg.bm=x.dataset.s;SV('cfg',cfg);x.classList.add('on')});
  }catch(e){o.textContent='Error: '+e.message}
};

// escáner
$('#go').onclick=async()=>{
  const msg=$('#msg');R=[];$('#res').innerHTML='';
  if(!cfg.lg.length){msg.textContent='Elige al menos una liga.';return}
  if(hunt&&(!cfg.ok||!cfg.bm)){msg.textContent='Para buscar picks con cuota necesitas la llave de OddsPapi y tu casa en Ajustes.';hunt=false;return}
  $('#go').disabled=true;$('#go').classList.add('busy');
  try{
    let leagues=hunt?Object.values(LG):cfg.lg;const cap=hunt?40:cfg.m;
    if(hunt){ // solo se piden cuotas de las ligas que tienen partidos en el periodo elegido (ahorra peticiones de OddsPapi)
      msg.textContent='Buscando ligas con partidos…';
      const ok=await Promise.all(leagues.map(async sl=>{try{for(const n of Array.from({length:cfg.dd||1},(_,k)=>k)){const j=await espn(`${sl}/scoreboard?dates=${iso(new Date(Date.now()+n*864e5)).replace(/-/g,'')}`);if((j.events||[]).some(x=>x.status.type.state==='pre'&&okDay(x.date)))return true}}catch{}return false}));
      leagues=leagues.filter((_,i)=>ok[i]);
      if(!leagues.length){msg.textContent='No hay partidos pendientes en ninguna liga para el periodo elegido.';return}
    }
    const names=Object.fromEntries(Object.entries(LG).map(([n,s])=>[s,n])),names0=names,bad0=[];let OD=null,ODP=null,diag='',mq=0,nShort=0,nNoQ=0;const enames=[];const STD={};
    if(cfg.ok){
      if(!cfg.bm)msg.textContent='Elige tu casa en Ajustes para traer cuotas.';
      else{msg.textContent='Cargando cuotas…';try{OD=await loadOdds(undefined,leagues);const T=await tourIds(),sin=leagues.filter(x=>!T[x]).map(x=>names0[x]||x);if(cfg.pn){try{ODP=await loadOdds('pinnacle',leagues);diag+=` Pinnacle: ${ODP.fx.length} partidos.`}catch(e){ODP=null;bad0.push('Pinnacle ('+e.message.slice(0,60)+')')}}
      diag+=` Cuotas de ${cfg.bm}: ${OD.fx.length} partidos en las próximas 48 h.`+(sin.length?' Sin torneo en OddsPapi: '+sin.join(', ')+'.':'')}catch(e){OD=null;bad0.push('Cuotas ('+e.message.slice(0,90)+')')}}
    }
    let rev=0,adjN=0,adjT=0;const bad=bad0;
    for(const slug of leagues){
      if(rev>=cap)break;
      msg.textContent='Cargando '+names[slug]+'…';
      let ev;
      try{ev=[];const vistos=new Set();for(const n of Array.from({length:cfg.dd||1},(_,k)=>k)){for(const x of ((await espn(`${slug}/scoreboard?dates=${iso(new Date(Date.now()+n*864e5)).replace(/-/g,'')}`)).events||[])){if(!vistos.has(x.id)){vistos.add(x.id);ev.push(x)}}}}
      catch(e){bad.push(names[slug]+' ('+e.message.slice(0,60)+')');continue}
      if(ev.length)STD[slug]=await standings(slug).catch(()=>null);
      for(const e of ev){
        if(rev>=cap)break;
        const c0=e.competitions[0],H=c0.competitors.find(x=>x.homeAway==='home'),W=c0.competitors.find(x=>x.homeAway==='away');
        if(!H||!W||e.status.type.state!=='pre'||!okDay(e.date))continue;
        rev++;
        const hn=H.team.shortDisplayName||H.team.displayName,wn=W.team.shortDisplayName||W.team.displayName,hf=H.team.displayName||hn,wf=W.team.displayName||wn;
        if(hunt&&!oddsQ(OD,hf,wf,e.date)){rev--;continue}
        msg.textContent=`Analizando ${hn} vs ${wn}…`;
        let A,B;
        try{const forms=await Promise.all([teamForm(slug,H.team.id),teamForm(slug,W.team.id)]);A=st(forms[0]);B=st(forms[1])}
        catch(err){bad.push(hn+' vs '+wn+' ('+err.message.slice(0,60)+')');continue}
        const SL=STD[slug];A.ss=SL&&SL.t[H.team.id];B.ss=SL&&SL.t[W.team.id];A.mu=SL?SL.mu:null;adjT+=2;adjN+=(A.adj>0)+(B.adj>0);
        const p=[];
        if(A.n>=5&&B.n>=5){
          if(A.l===0&&B.l>=4)p.push(`${hn} invicto (0 derrotas en 10) vs ${wn} irregular (${B.l} derrotas)`);
          if(B.l===0&&A.l>=4)p.push(`${wn} invicto (0 derrotas en 10) vs ${hn} irregular (${A.l} derrotas)`);
          if(A.t>=cfg.g&&B.t>=cfg.g)p.push(`Over: promedian ${A.t.toFixed(1)} y ${B.t.toFixed(1)} goles por partido`);
          if(A.b>=cfg.b&&B.b>=cfg.b)p.push(`Ambos marcan: ${A.b}% y ${B.b}% de sus últimos 10`);
          if(A.t<=cfg.u&&B.t<=cfg.u)p.push(`Under: promedian ${A.t.toFixed(1)} y ${B.t.toFixed(1)} goles por partido`);
          if(A.low>=70&&B.low>=70)p.push(`Partido cerrado: ${A.low}% y ${B.low}% de sus últimos 10 terminaron con 2 goles o menos`);
          if(A.cs>=5&&B.fts>=4)p.push(`${hn} dejó su arco en cero en ${A.cs} de 10 y ${wn} no marcó en ${B.fts} de 10`);
          if(B.cs>=5&&A.fts>=4)p.push(`${wn} dejó su arco en cero en ${B.cs} de 10 y ${hn} no marcó en ${A.fts} de 10`);
          if(A.hn>=4&&100*A.hw/A.hn>=cfg.r)p.push(`${hn} gana en casa: ${A.hw} de ${A.hn} como local en sus últimos 10`);
          if(B.an>=4&&100*B.aw/B.an>=cfg.r)p.push(`${wn} gana de visita: ${B.aw} de ${B.an} como visitante en sus últimos 10`);
          if(A.rs>=4)p.push(`${hn} en racha: ${A.rs} victorias seguidas`);
          if(B.rs>=4)p.push(`${wn} en racha: ${B.rs} victorias seguidas`);
          if(A.cf!=null&&A.cf>=cfg.co)p.push(`${hn} promedia ${A.cf.toFixed(1)} córners a favor por partido`);
          if(B.cf!=null&&B.cf>=cfg.co)p.push(`${wn} promedia ${B.cf.toFixed(1)} córners a favor por partido`);
          if(A.y!=null&&B.y!=null&&A.y+B.y>=cfg.ta)p.push(`Tarjetas: promedian ${A.y.toFixed(1)} y ${B.y.toFixed(1)} por partido (suman ${(A.y+B.y).toFixed(1)})`);
        }
        const mod=model(A,B),q=oddsQ(OD,hf,wf,e.date),qbad=(oddsQ.last||[]).slice(),mfx=OD?oddsFx(OD,hf,wf,e.date):null;
        if(A.n<5||B.n<5)nShort++;if(!(q&&Object.keys(q).length))nNoQ++;enames.push(hn+' vs '+wn);
        const qp=ODP?oddsQ(ODP,hf,wf,e.date):null,fair=qp?fairP(qp):null;
        // Mantener separadas las probabilidades del modelo y las probabilidades justas del mercado.
        // No mezclarlas con pesos arbitrarios hasta calibrar el modelo con resultados fuera de muestra.
        if(fair&&Object.keys(fair).length){mod.raw=mod.m.map(x=>[...x]);mod.f=fair}
        if(!mod.raw&&q&&Object.keys(q).length){const fc=fairP(q);if(Object.keys(fc).length){mod.m0=mod.m.map(x=>[...x]);mod.fc=fc}}
        // Ajuste prudente de BTTS con referencia de mercado cuando existe. Pinnacle pesa más que la cuota de la propia casa.
        const yesBTTS=mod.m.find(x=>x[0]==='Ambos marcan: sí'),noBTTS=mod.m.find(x=>x[0]==='Ambos marcan: no');
        const refBTTS=(mod.f&&mod.f['Ambos marcan: sí']!=null)?mod.f['Ambos marcan: sí']:(mod.fc&&mod.fc['Ambos marcan: sí']!=null?mod.fc['Ambos marcan: sí']:null);
        if(yesBTTS&&noBTTS&&refBTTS!=null){const weight=(mod.f&&mod.f['Ambos marcan: sí']!=null)?0.30:0.15;const adjusted=yesBTTS[1]*(1-weight)+refBTTS*weight;yesBTTS[1]=adjusted;noBTTS[1]=1-adjusted;}
        const bv=best({mod,q}),hasT=!!(A.n>=5&&B.n>=5&&mod.raw&&q&&mod.m.some(m=>['A','B'].includes(tierOf({q,mod},m[0]))));
        if(q&&Object.keys(q).length)mq++;
        if(hunt||p.length||hasT||(!mod.raw&&bv&&bv.e>=0.05))R.push({m:`${hn} vs ${wn}`,liga:names[slug],
          hora:dlab(e.date)+new Date(e.date).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),p,A,B,h:hn,w:wn,mod,q,casa:cfg.bm,ev:e.id,slug,ko:e.date,hid:H.team.id,wid:W.team.id,qbad,mf:mfx?{h:mfx.h,w:mfx.w,t:mfx.t}:null});
      }
    }
    if(cfg.af&&cfg.afa&&R.length){const top=R.map(r=>({r,s:(bestOf(r)||{sc:-1}).sc})).sort((a,b)=>b.s-a.s).slice(0,cfg.afn||8);for(const {r} of top){msg.textContent='API-Football: '+r.m+'…';try{await afAuto(r)}catch(e){diag+=' API-Football: '+String(e.message).slice(0,70)+'.';break}}}
    // Mantener una fuente independiente para combinadas: solo se actualiza con el escaneo normal,
    // nunca con la lista recortada del botón «Buscar el mejor pick en todas las ligas».
    if(!hunt){Rcombo=R.slice();SV('comboScan',{d:today(),t:Date.now(),R:Rcombo});}
    let huntTxt='';
    if(hunt){
      const tot=R.length;
      R=R.map(r=>({r,b:bestOf(r)})).filter(x=>x.b&&x.b.q&&x.b.q>=(cfg.qm||1.5)&&baseStake(x.r,x.b.n,x.b.q)>=cfg.sm).sort((a,b)=>b.b.sc-a.b.sc).slice(0,3).map(x=>x.r);
      huntTxt=R.length?`Búsqueda en todas las ligas: ${tot} partidos con cuotas, ${R.length} cumplen (cuota de ${cfg.qm} o más y stake de ${cfg.sm} o más).`:`Búsqueda en todas las ligas: de ${tot} partidos con cuotas, ninguno cumple cuota de ${cfg.qm} o más y stake de ${cfg.sm} o más. Es normal: casi nunca hay uno.`;
    }
    let kept=0;
    // Los picks encontrados en un escaneo normal se conservan durante el día aunque el filtro cambie.
    // Se etiquetan como anteriores porque sus cuotas deben volver a verificarse antes de apostar.
    if(!hunt){
      const prev=LS('scan',null),fresh=R.slice();
      if(prev&&prev.d===today()&&Array.isArray(prev.R)){
        const eventKey=r=>String(r.ev||r.slug+'|'+r.h+'|'+r.w+'|'+r.ko),pickKey=r=>{const b=bestOf(r);return b?String(b.n):''};
        const present=new Set(R.map(r=>eventKey(r)+'|'+pickKey(r)));
        for(const old of prev.R.filter(x=>bestOf(x)&&x.ko&&new Date(x.ko).getTime()>Date.now()).slice(0,30)){
          const id=eventKey(old)+'|'+pickKey(old);
          // Conserva cada pick distinto del mismo partido; no duplica el mismo mercado/pick.
          if(present.has(id))continue;
          R.push({...old,_fromPrevious:true});present.add(id);kept++;
        }
      }
      if(kept)diag+=` Se conservaron ${kept} picks de escaneos anteriores de hoy; verifica de nuevo las cuotas antes de apostar.`;
    }
    msg.textContent=(huntTxt||(rev?`${rev} partidos revisados, ${R.length} con patrones.`:'No hay partidos pendientes ('+((cfg.dd||1)>=2?'hoy y mañana':'hoy')+') en esas ligas.'))+(bad.length?' No cargaron: '+bad.join('; ')+'.':'')+diag+(OD&&rev&&!mq?' Ningún partido se emparejó con la casa. ESPN trae: '+enames.slice(0,4).join('; ')+'. OddsPapi trae: '+(OD.fx.slice(0,4).map(x=>x.h+' vs '+x.w).join('; ')||'nada')+'.':'')+(nShort?' '+nShort+' partidos tienen menos de 5 partidos de historial y no se analizan.':'')+(OD&&nNoQ?' '+nNoQ+' partidos sin cuotas de la casa.':'');
    if(!hunt&&rev){const nb=R.filter(r=>bestOf(r)).length;msg.textContent+=` Con pick: ${nb} de ${rev}. Filtro «${({s:'estricto',b:'equilibrado',w:'amplio'})[cfg.fm||'b']}». Fuerza del rival aplicada en ${adjN} de ${adjT} equipos.`}
    drawRes();SV('scan',{d:today(),t:Date.now(),R,msg:msg.textContent});afterScan();$('#scanbox').open=false;updScan();
  }catch(e){msg.textContent='Error: '+e.message}
  finally{$('#go').disabled=false;$('#go').classList.remove('busy');autoRun=false;hunt=false}
};

const tagc=t=>/córners/i.test(t)?'c':/tarjetas/i.test(t)?'k':/invicto|gana|racha/i.test(t)?'f':/under|cerrado|cero/i.test(t)?'u':'';
const mrow=(n,p,sub,v,t)=>`<div class="mr${v?' v':''}"><div class="mr-t"><span class="mn">${t?`<span class="tier tier${t}">${t}</span>`:''}${esc(n)}</span><b class="pc">${Math.round(p*100)}%</b></div><div class="bar"><i style="width:${Math.round(p*100)}%"></i></div><div class="mr-s">${sub}</div></div>`;
const gp=(r,n)=>(r.mod.m.find(x=>x[0]===n)||[0,0])[1];
const formH=f=>(f||'').split('').map(c=>{const k={W:'G',D:'E',L:'P'}[c];return `<i class="dot ${k}">${k}</i>`}).join('');
function x12(r){
  const h=gp(r,'Local gana'),d=gp(r,'Empate'),v=gp(r,'Visitante gana'),pc=x=>Math.round(x*100);
  return `<div class="x12t">Modelo</div><div class="x12" role="img" aria-label="Local ${pc(h)}%, empate ${pc(d)}%, visitante ${pc(v)}%"><div class="h" style="flex:${h}"><span>${pc(h)}%</span></div><div class="d" style="flex:${d}"><span>${pc(d)}%</span></div><div class="a" style="flex:${v}"><span>${pc(v)}%</span></div></div><div class="x12l"><span>${esc(r.h)}</span><span>Empate</span><span>${esc(r.w)}</span></div>`;
}
function mfair(r){
  const f=(r.mod.f&&r.mod.f['Local gana']!=null)?r.mod.f:((r.mod.fc&&r.mod.fc['Local gana']!=null)?r.mod.fc:null);
  return f?{h:f['Local gana'],d:f['Empate'],v:f['Visitante gana'],src:f===r.mod.f?'Pinnacle':'la casa sin margen'}:null;
}
function lectura(r){
  const pc=x=>Math.round(x*100),h=gp(r,'Local gana'),v=gp(r,'Visitante gana'),fav=h>=v?[r.h,h]:[r.w,v],t=r.mod.lh+r.mod.la,mf=mfair(r);
  let head;
  if(mf){
    const mv=mf.h>=mf.v?[r.h,mf.h]:[r.w,mf.v];
    head=`Según el mercado (${mf.src}), el favorito es <b>${esc(mv[0])}</b> (${pc(mv[1])}%).`;
    if(fav[0]!==mv[0]&&fav[1]>=0.4)head+=` <span class="bad">El modelo ve favorito a ${esc(fav[0])} (${pc(fav[1])}%): discrepan, desconfía de los picks de este partido.</span>`;
  }else head=fav[1]>=0.5?`Según el modelo, <b>${esc(fav[0])}</b> parte como favorito (${pc(fav[1])}%).`:'Según el modelo, el partido está <b>parejo</b>.';
  return `${head} El modelo espera unos <b>${t.toFixed(1)} goles</b> (${r.mod.lh.toFixed(1)} a ${r.mod.la.toFixed(1)}) y ambos marcan <b>${pc(gp(r,'Ambos marcan: sí'))}%</b>${r.mod.lc?`; unos <b>${r.mod.lc.toFixed(0)} córners</b>`:''}.`;
}
function x12m(r){
  const m=mfair(r);if(!m)return '';const pc=x=>Math.round(x*100);
  return `<div class="x12t">Mercado · ${m.src}</div><div class="x12 mk" role="img" aria-label="Mercado: local ${pc(m.h)}%, empate ${pc(m.d)}%, visitante ${pc(m.v)}%"><div class="h" style="flex:${m.h}"><span>${pc(m.h)}%</span></div><div class="d" style="flex:${m.d}"><span>${pc(m.d)}%</span></div><div class="a" style="flex:${m.v}"><span>${pc(m.v)}%</span></div></div>`;
}
// Tabla del 1X2: por qué "gana un equipo" casi nunca llega a ser pick (el mercado de resultado es el más eficiente)
function x12tab(r){
  const m=mfair(r),rows=[['Local gana',r.h,m&&m.h],['Empate','Empate',m&&m.d],['Visitante gana',r.w,m&&m.v]];
  const has=rows.some(x=>r.q&&r.q[x[0]]);if(!has&&!m)return '';
  return `<div class="x12tab"><div class="cmphd"><span>Resultado</span><span>modelo · mercado · cuota · valor</span></div>`+rows.map(([n,nm,mp])=>{
    const p=gp(r,n),q=r.q&&r.q[n],e=q?p*q-1:null;
    return `<div class="mr-s" style="display:flex;justify-content:space-between;gap:8px"><span>${esc(nm)}</span><span>${Math.round(p*100)}% · ${mp!=null?Math.round(mp*100)+'%':'—'} · ${q?'@'+q:'—'} · ${e!=null?`<b class="${e>=0.05&&e<=0.25?'ok':e>0.25?'bad':''}">${e>0.25?'⚠ ':''}${e>=0?'+':''}${Math.round(e*100)}%</b>`:'—'}</span></div>`}).join('')+`</div>`;
}
function cmpRows(r){
  const A=r.A,B=r.B,rows=[];
  const add=(l,a,b,f)=>{if(a==null||b==null)return;f=f||(x=>x.toFixed(1));const m=Math.max(a,b,1e-9);rows.push(`<div class="cmp"><b>${f(a)}</b><div class="cb l"><i style="width:${Math.round(100*a/m)}%"></i></div><span>${l}</span><div class="cb"><i style="width:${Math.round(100*b/m)}%"></i></div><b>${f(b)}</b></div>`)};
  add('Goles a favor',A.gf,B.gf);add('Goles en contra',A.t-A.gf,B.t-B.gf);add('Victorias de 10',A.w,B.w,x=>x);add('Ambos marcan',A.b,B.b,x=>x+'%');add('Córners a favor',A.cf,B.cf);add('Tarjetas',A.y,B.y);
  return rows.join('');
}
function conflictOf(r,n){
  const g=/^(Over|Under) [123]\.5$/.test(n)?n.split(' ')[0]:null;
  for(const t of r.p){
    if(g==='Under'&&/^Over:/.test(t))return 'Over';
    if(g==='Over'&&/^(Under:|Partido cerrado)/.test(t))return 'Under o cerrado';
    if(n==='Ambos marcan: no'&&/^Ambos marcan/.test(t))return 'Ambos marcan';
  }
  return '';
}
function whyNo(r){
  const qm=cfg.qm||1.5;
  if(r.A.n<5||r.B.n<5)return `Historial insuficiente: ${esc(r.h)} tiene ${r.A.n} y ${esc(r.w)} ${r.B.n} partidos recientes (se necesitan 5). RadarPi ya completa con la liga local y la temporada anterior; si sigue pasando, ESPN no tiene datos de ese equipo.`;
  if(!(r.q&&Object.keys(r.q).length))return 'No hay cuotas de tu casa para este partido (no se emparejó con OddsPapi o la casa no lo ofrece). Sin cuota real no se puede comprobar el valor.';
  const ok=r.mod.m.filter(([n,p])=>!isHalfMarket(n)&&Number.isFinite(p)&&p>=0.5&&p<=0.9),wq=ok.filter(([n])=>r.q[n]);
  if(!wq.length)return 'La casa tiene cuotas, pero no en los mercados donde el modelo ve 50% de probabilidad o más.';
  const hi=wq.filter(([n])=>r.q[n]>=qm);
  if(!hi.length)return `Ningún mercado llega a la cuota mínima de ${qm}: la más alta con probabilidad de 50% o más es @${Math.max(...wq.map(([n])=>r.q[n])).toFixed(2)}. Puedes bajarla en Ajustes.`;
  const vt=candScan(r).veto;
  if(vt.length){const v=vt.sort((a,b)=>(b.p-b.ref)-(a.p-a.ref))[0];return `El modelo está mucho más optimista que el mercado en ${esc(v.n)} (modelo ${Math.round(v.p*100)}% contra ${Math.round(v.ref*100)}% del mercado). Se descarta: suele ser error del modelo, no una oportunidad.`}
  const es=hi.map(([n,p])=>({n,e:p*r.q[n]-1})).sort((a,b)=>b.e-a.e);
  if(es[0].e>0.25)return `Las ventajas salen demasiado altas (+${Math.round(es[0].e*100)}% en ${esc(es[0].n)}): se descartan porque suelen ser error de datos o del modelo.`;
  if(es[0].e<0)return `La casa paga menos de lo que estima el modelo en todos los mercados (la mejor diferencia es ${Math.round(es[0].e*100)}% en ${esc(es[0].n)}).`;
  return `La mejor ventaja estimada es +${Math.round(es[0].e*100)}% en ${esc(es[0].n)}, por debajo del 5% mínimo.`;
}
const MG=[['Resultado',n=>/^(Local gana|Empate|Visitante gana|Doble oportunidad)/.test(n)],['Goles',n=>/^(Over|Under) \d|^Ambos marcan: (sí|no)$/.test(n)],['Equipos',n=>/^(Local|Visitante) (marca|deja)/.test(n)],['Córners',n=>/^Córners/.test(n)],['Tarjetas',n=>/^Tarjetas/.test(n)]];
function selOpts(r){
  const all=r.mod.m.filter(([n])=>cfg.hm||!isHalfMarket(n)),used=new Set();
  let h='<option value="">Que la IA elija</option>';
  const opt=L=>L.map(([n])=>`<option>${esc(n)}</option>`).join('');
  for(const [g,f] of MG){const L=all.filter(([n])=>!used.has(n)&&!isHalfMarket(n)&&f(n));L.forEach(([n])=>used.add(n));if(L.length)h+=`<optgroup label="${g}">${opt(L)}</optgroup>`}
  const R2=all.filter(([n])=>!used.has(n)&&!isHalfMarket(n));if(R2.length)h+=`<optgroup label="Otros">${opt(R2)}</optgroup>`;
  const H=all.filter(([n])=>isHalfMarket(n));if(H.length)h+=`<optgroup label="Por mitades · experimental">${opt(H)}</optgroup>`;
  return h;
}
function bttsAudit(r){
  const names=['Ambos marcan: sí','Ambos marcan: no'];
  const rows=names.map(n=>{
    const m=(r.mod.m||[]).find(x=>x[0]===n);if(!m)return `<div class="stake-row"><b>${esc(n)}</b><p class="mut">Este mercado no vino en los datos de este partido.</p></div>`;
    const p=m[1],q=r.q&&+r.q[n]>1?+r.q[n]:null,e=q?p*q-1:null,ref=(r.mod.f&&r.mod.f[n]!=null)?r.mod.f[n]:(r.mod.fc&&r.mod.fc[n]!=null?r.mod.fc[n]:null);
    let why='Pasa los filtros básicos';
    if(!Number.isFinite(p)||p<0.35||p>0.90)why='Probabilidad fuera del rango permitido (35–90%)';
    else if(!q)why='No hay cuota real emparejada para este mercado';
    else if(e<0.05)why='Ventaja estimada menor al 5%';
    else if(e>0.25)why='Ventaja estimada mayor al 25%: posible error de datos/modelo';
    else if(ref!=null&&p-ref>0.10)why='El modelo supera la referencia de mercado por más de 10 puntos; se descarta por seguridad';
    const pass=why==='Pasa los filtros básicos';
    return `<div class="stake-row"><div class="stake-head"><b>${esc(n)}</b><span class="${pass?'ok':'bad'}">${pass?'Pasa filtros':'No seleccionado'}</span></div><small>Probabilidad ${Math.round(p*100)}% · ${q?'cuota @'+q+' · valor '+(e>=0?'+':'')+Math.round(e*100)+'%':'sin cuota real'}${ref!=null?' · referencia '+Math.round(ref*100)+'%':''}</small><p class="mut">${esc(why)}</p></div>`;
  }).join('');
  return `<div class="card stake-summary"><h3>¿Por qué no salió Ambos marcan?</h3><p class="mut">Este panel muestra los filtros aplicados al partido actual; las cuotas y los datos pueden cambiar entre escaneos.</p>${rows}</div>`;
}
const fam=n=>/^Córners/.test(n)?'Córners':/^Tarjetas/.test(n)?'Tarjetas':/^Ambos/.test(n)?'Ambos marcan':/^Doble/.test(n)?'Doble oportunidad':/^(Over|Under|Goles)/.test(n)?'Goles':/^(Local|Visitante) (marca|deja)/.test(n)?'Goles por equipo':'Resultado';
function famBest(r){const s={};for(const c of cands(r)){const f=fam(c.n);if(!s[f])s[f]=c}return Object.values(s).sort((a,b)=>b.sc-a.sc)}
const altsHtml=(r,b)=>{const a=famBest(r).filter(x=>x.n!==b.n).slice(0,4);return a.length?`<div class="alts"><small>También con valor, en otros mercados</small>${a.map(x=>`<span><b>${esc(x.n)}</b> ${Math.round(x.p*100)}% @${x.q}</span>`).join('')}</div>`:''};
const refOf=(r,n)=>(r.mod.f&&r.mod.f[n]!=null)?r.mod.f[n]:(r.mod.fc&&r.mod.fc[n]!=null?r.mod.fc[n]:null);
function closest(r){const L=(r.mod.m||[]).filter(([n,p])=>!isHalfMarket(n)&&p>=.4&&p<=.9&&r.q&&r.q[n]).map(([n,p])=>{const pc=calP(r,n,p),q=r.q[n];return{n,pc,q,e:pc*q-1}}).sort((a,b)=>b.e-a.e).slice(0,3);
  return L.length?`<div class="alts"><small>Lo más cercano a tener valor (no pasa el filtro)</small>${L.map(x=>`<span><b>${esc(x.n)}</b> ${Math.round(x.pc*100)}% @${x.q} · valor ${x.e>=0?'+':''}${Math.round(x.e*100)}%</span>`).join('')}</div>`:''}
// Línea segura: probabilidad alta y cuota baja. No es ventaja (el valor es ~0 o algo negativo): sirve de pata de combinada o con stake mínimo.
function safeLine(r){if(r.A.n<5||r.B.n<5||!r.q)return '';
  const L=(r.mod.m||[]).filter(([n,p])=>!isHalfMarket(n)&&p>=.5&&r.q[n]).map(([n,p])=>{const pc=calP(r,n,p),q=r.q[n],rf=refOf(r,n);return{n,pc,q,e:pc*q-1,bad:rf!=null&&p-rf>.10}}).filter(x=>!x.bad&&x.q>=1.2&&x.q<=1.7&&x.pc>=.68&&x.e>=-.04).sort((a,b)=>b.pc-a.pc)[0];
  return L?`<div class="tk safe"><small class="tkl">LÍNEA SEGURA · SIN VALOR CLARO</small><div class="tk1"><b class="n">${esc(L.n)}</b></div><div class="tk2"><span><b>${Math.round(L.pc*100)}%</b> prob.</span><span>cuota <b>@${L.q}</b></span><span>valor <b>${L.e>=0?'+':''}${Math.round(L.e*100)}%</b></span><span>stake sugerido <b>1/9</b></span></div><p class="status">Riesgo bajo, pero la cuota ya refleja esa probabilidad: no es una ventaja. Úsala como pata de combinada o con stake mínimo.</p></div>`:''}
function reasons(r){if(r.A.n<5||r.B.n<5||!r.q)return '';const F=FM(),c={q:0,rng:0,pc:0,val:0,veto:0};
  for(const [n,p] of r.mod.m){if(isHalfMarket(n)||!(p>=.35&&p<=.9))continue;const q=r.q[n];if(!q||q<1.01)continue;c.q++;const pc=calP(r,n,p),e=pc*q-1,rf=refOf(r,n);
    if(q<F.qa||q>F.qb)c.rng++;else if(pc<F.pc)c.pc++;else if(rf!=null&&p-rf>.10)c.veto++;else if(e<F.ea)c.val++;else if(e>F.eb)c.veto++}
  return c.q?`<p class="status">Mercados con cuota: ${c.q}. Descartados: cuota fuera de rango ${c.rng}, probabilidad baja ${c.pc}, sin valor ${c.val}, modelo demasiado optimista frente al mercado ${c.veto}.</p>`:''}
function ticket(r){
  const b=bestOf(r);
  if(!b)return `<div class="nopick2"><b>Sin pick con ventaja clara</b><p>${diagnose(r)}</p>${reasons(r)}${r.p.length?`<p>Hay ${r.p.length} patrón(es) detectado(s) en la pestaña Datos.</p>`:''}</div>${safeLine(r)}${closest(r)}`;
  const st=baseStake(r,b.n,b.q),c=conflictOf(r,b.n),afReady=!!(r.afData||LS(afCacheKeyFor(r),null));
  return `<div class="tk ${b.t||''}"><small class="tkl">PICK DE LA APP · SEGÚN REGLAS</small><div class="tk1">${b.t?`<span class="tier tier${b.t}">${b.t}</span>`:''}<b class="n">${esc(b.n)}</b></div>
<div class="tk2"><span><b>${Math.round(b.p*100)}%</b> prob.</span>${b.q?`<span>cuota <b>@${b.q}</b></span><span>valor <b>${b.e>=0?'+':''}${Math.round(b.e*100)}%</b></span>`:`<span>cuota mínima <b>@${(1.05/b.p).toFixed(2)}</b></span>`}<span>stake base <b>${st}/9</b></span></div>
<div class="meter${st>=5?' hi':''}" role="img" aria-label="Stake ${st} de 9">${Array.from({length:9},(_,k)=>`<i class="${k<st?'f':''}"></i>`).join('')}</div>
${altsHtml(r,b)}${r.qx&&r.qx[b.n]?'<div class="tkw">Cuota tomada de API-Football (promedio de casas), no de tu casa. Confírmala antes de apostar.</div>':''}${c?`<div class="tkw">⚠ Va contra el patrón detectado (${c}). Confírmalo con la IA antes de apostar.</div>`:''}${!afReady&&cfg.af?'<div class="tkw">API-Football aún no contrastado para este partido. Pulsa «Datos API-Football» antes de considerar un pick 1X2.</div>':''}</div>`;
}
const GUIA=`<details class="card hint"><summary>¿Cómo leer las tarjetas?</summary>
<p><b>Barra azul, gris y amarilla:</b> probabilidad de que gane el local, empate o gane el visitante.</p>
<p><b>Forma:</b> los últimos 5 partidos de cada equipo. G ganó, E empató, P perdió.</p>
<p><b>Mercados:</b> la barra es la probabilidad que calcula el modelo. La <b>cuota justa</b> es 1 ÷ probabilidad: si tu casa paga más que eso, hay <b>valor</b> (verde).</p>
<p><b>Nivel A, B o C:</b> cuánto confirma Pinnacle ese valor. A es la mejor confirmación.</p>
<p><b>Stake de 1 a 9:</b> confianza calculada con probabilidad, valor, cantidad de datos y bajas. No es una garantía.</p></details>`;
let resView='picks';
function setView(v){resView=v;drawRes()}
async function ai(i){cardTab(i,'v');try{await aiRun(i)}finally{const b=$('#ai'+i);if(b&&R[i]&&!b.hidden)R[i].aiH=b.innerHTML}}
async function showInfo(i){cardTab(i,'n');try{await showInfoRun(i)}finally{const b=$('#in'+i);if(b&&R[i]&&!b.hidden)R[i].inH=b.innerHTML}}
function cardTab(i,t){
  const r=R[i];if(!r)return;r.cardT=t||null;
  const p=document.querySelector('#cp'+i);if(!p)return;
  p.hidden=!t;
  p.querySelectorAll('.tp').forEach(x=>{x.hidden=x.dataset.t!==t});
  p.querySelectorAll('.ct button[data-t]').forEach(b=>{const on=b.dataset.t===t;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false')});
}
function toggleAll(o){R.forEach((_,i)=>cardTab(i,o?'d':null))}
const afWrap=h=>'<details class="afd"><summary><b>Contraste RadarPi + API-Football</b><small>Tocar para ver o recoger</small></summary>'+h+'</details>';
function card(i){
  const r=R[i];
    let lst;
    if(r.q&&Object.keys(r.q).length){
      const od={A:0,B:1,C:2},vl=r.mod.m.filter(x=>r.q[x[0]]&&(cfg.hm||!isHalfMarket(x[0]))&&x[1]>=0.35&&x[1]<=0.9).map(x=>({n:x[0],p:x[1],q:r.q[x[0]],e:x[1]*r.q[x[0]]-1,t:tierOf(r,x[0]),f:r.mod.f&&r.mod.f[x[0]]})).sort((a,b)=>(od[a.t]??3)-(od[b.t]??3)||b.e-a.e).slice(0,4);
      lst=`<div class="sec">Cuotas de ${esc(r.casa||'la casa')}</div>${r.mf?`<p class="mr-s" style="margin:0 0 4px">Emparejado con: <b>${esc(r.mf.h)} vs ${esc(r.mf.w)}</b> · ${new Date(r.mf.t).toLocaleString('es',{weekday:'short',hour:'2-digit',minute:'2-digit'})}. Verifica que sea el mismo partido.</p>`:''}<p class="mr-s" style="margin:0 0 4px">Mercados que trae la casa: ${(()=>{const q=r.q,g=[['Resultado',/^(Local gana|Empate|Visitante gana)$/],['Goles',/^(Over|Under) \d/],['Ambos marcan',/^Ambos marcan/],['Córners',/^Córners/],['Tarjetas',/^Tarjetas/]];return g.map(([t,re])=>(Object.keys(q).some(n=>re.test(n))?'✓ ':'✗ ')+t).join(' · ')})()}.</p>${(r.qbad&&r.qbad.length)?`<p class="mr-s bad" style="margin:0 0 4px">Se descartaron cuotas incoherentes: ${esc(r.qbad.join(', '))}.</p>`:''}`+vl.map(x=>mrow(x.n,x.p,`Justa @${(1/x.p).toFixed(2)} · Casa <b>@${x.q}</b> <span class="chip2 ${x.e>0.03?'ok':'bad'}">${x.e>=0?'+':''}${Math.round(x.e*100)}%</span>${x.f!=null?' · Pinnacle '+Math.round(x.f*100)+'%':''}${x.e>0.25?' · <small>muy alto, revísalo</small>':''}`,x.e>0.03,x.t)).join('');
    }else{
      const top=r.mod.m.filter(x=>!isHalfMarket(x[0])&&x[1]>=0.4&&x[1]<=0.85).sort((a,b)=>b[1]-a[1]).slice(0,6);
      const halves=cfg.hm?r.mod.m.filter(x=>isHalfMarket(x[0])):[];
      lst=`<div class="sec">${cfg.ok?'Sin cuotas de la casa: escribe la cuota a mano':'Probabilidades del modelo'}</div>`+top.map(([n,p])=>mrow(n,p,`Cuota justa @${(1/p).toFixed(2)} · mínima con valor <b>@${(1.05/p).toFixed(2)}</b>`,false,null)).join('')+
        (halves.length?`<div class="sec">Mercados por mitades · experimentales</div>`:'')+halves.map(([n,p])=>mrow(n,p,`Estimación provisional · cuota justa teórica @${(1/p).toFixed(2)}`,false,null)).join('')+
        (halves.length?`<p class="status">No uses estas probabilidades por mitades como señal validada: el reparto 45%/55% es una aproximación general, no una calibración histórica por liga.</p>`:'');
    }
    return `<article class="card mc"><div class="mh"><span class="pill">${esc(r.liga)}</span><span class="ko">${r.hora}</span></div>${r._fromPrevious?'<p class="status">Pick conservado de un escaneo anterior de hoy. Confirma que el partido siga pendiente y actualiza la cuota antes de apostar.</p>':''}
  <div class="mt"><b>${esc(r.h)}</b><em>vs</em><b>${esc(r.w)}</b></div>
  ${ticket(r)}
  <div class="acts2"><button class="btn" onclick="ai(${i})">Analizar con IA</button><button class="btn s" onclick="showInfo(${i})">Noticias y bajas</button><button class="btn s" onclick="afMore(${i})">Datos API-Football</button><button class="btn s" onclick="regModel(${i})">Registrar en Modelo</button></div><div id="afp${i}" class="af-panel" hidden></div>
  <div class="cpanel" id="cp${i}" ${r.cardT?'':'hidden'}>
    <div class="seg m ct" role="tablist" aria-label="Análisis del partido">${[['v','Veredicto'],['n','Noticias'],['d','Datos'],['a','Mercados']].map(([k,t])=>`<button type="button" role="tab" data-t="${k}" aria-selected="${r.cardT===k}" class="${r.cardT===k?'on':''}" onclick="cardTab(${i},'${k}')"><span>${t}</span></button>`).join('')}<button type="button" class="x" aria-label="Cerrar panel" onclick="cardTab(${i},null)">✕</button></div>
    <div class="tp" data-t="v" ${r.cardT==='v'?'':'hidden'}><div class="ai" id="ai${i}" ${r.aiH?'':'hidden'}>${r.aiH||''}</div><p class="phd">Pulsa <b>Analizar con IA</b> para que valide el pick de la app, o elige otro mercado en la pestaña Mercados y analízalo.</p></div>
    <div class="tp" data-t="n" ${r.cardT==='n'?'':'hidden'}><div class="ai news" id="in${i}" ${r.inH?'':'hidden'}>${r.inH||''}</div><p class="phd">Pulsa <b>Noticias y bajas</b> para ver alineaciones, lesionados y noticias recientes del partido.</p></div>
    <div class="tp" data-t="d" ${r.cardT==='d'?'':'hidden'}>
  ${x12(r)}
  ${x12m(r)}
  ${x12tab(r)}
  <p class="lect">${lectura(r)}</p>
  ${(r.A.fm||r.B.fm)?`<div class="forms"><div><small>${esc(r.h)}</small>${formH(r.A.fm)}</div><div><small>${esc(r.w)}</small>${formH(r.B.fm)}</div></div>`:''}
  ${r.p.length?`<div class="tags">${r.p.map(x=>`<div class="tg ${tagc(x)}">${esc(x)}</div>`).join('')}</div>`:''}
  <details class="dd"><summary>Datos de los últimos 10 partidos</summary><div class="cmphd"><span>${esc(r.h)}</span><span>${esc(r.w)}</span></div>${cmpRows(r)}</details>
    </div>
    <div class="tp" data-t="a" ${r.cardT==='a'?'':'hidden'}>
  <div class="mkts">${lst}</div>
  <div class="ctl"><select id="mk${i}" onchange="pick(${i})" aria-label="Mercado">${selOpts(r)}</select><input id="od${i}" type="number" step="0.01" placeholder="Cuota" oninput="calc(${i})" aria-label="Cuota"><input id="sk${i}" type="number" placeholder="Monto" aria-label="Monto"></div>${r.mod.m.some(([n])=>isHalfMarket(n))?'<p class="status">Mercados por mitades: cálculo provisional con reparto 45%/55% de los goles esperados; no se incluyen en los picks automáticos hasta validarlos con datos históricos de cada tiempo. Para registrarlos, introduce la cuota real y verifica el marcador por mitades.</p>':''}
  <div class="cx" id="cx${i}"></div>
      <div class="acts2" style="margin-top:10px"><button class="btn" onclick="reg(${i})">Registrar apuesta $</button></div>
      <p class="phd">“Registrar en Modelo” guarda el pronóstico para medir aciertos, sin monto. “Registrar apuesta $” guarda también el dinero apostado.</p>
    </div>
  </div></article>`;
}
function drawRes(){
  if(!R.length){$('#res').innerHTML='<div class="empty"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="15"/><path d="M32 32l16-16"/></svg><b>Nada que destacar</b>No hay partidos con patrones ni valor claro. Prueba con más ligas o ajusta los umbrales.</div>';return}
  const info=R.map((r,i)=>({i,b:bestOf(r)})),withP=info.filter(x=>x.b).sort((a,b)=>b.b.sc-a.b.sc),nP=withP.length;
  const view=(resView==='picks'&&!nP)?'all':resView;
  const list=view==='picks'?withP.map(x=>x.i):info.map(x=>x.i);
  const menu=`<div class="seg m rv" role="tablist" aria-label="Qué mostrar"><button type="button" class="${view==='picks'?'on':''}" onclick="setView('picks')"><span>Picks</span><b>${nP}</b></button><button type="button" class="${view==='all'?'on':''}" onclick="setView('all')"><span>Todos los partidos</span><b>${R.length}</b></button></div>`;
  const hint=view==='picks'
    ?'<p class="status">Solo picks con cuota real y ventaja estimada de 5% a 25%. Es una estimación, no una garantía.</p>'
    :`<div class="tools"><button class="btn s" onclick="toggleAll(true)">Abrir todo</button><button class="btn s" onclick="toggleAll(false)">Cerrar todo</button></div>${nP?'':'<p class="status">Ningún partido tiene un pick con ventaja clara. Aquí están todos para que los revises.</p>'}`;
  const rest=(view==='picks'&&R.length>nP)?`<button class="btn s" style="width:100%" onclick="setView('all')">Ver los ${R.length-nP} partidos sin pick</button>`:'';
  $('#res').innerHTML=menu+hint+list.map(card).join('')+rest+GUIA;
}
function pick(i){const r=R[i],mk=$('#mk'+i).value;r.userMk=mk;const q=mk&&r.q&&r.q[mk];$('#od'+i).value=q||'';calc(i)}

// Stake: Kelly fraccionado (25%), máximo 3% del bankroll, solo si hay valor
function calc(i){
  if(!$('#mk'+i).value){$('#cx'+i).textContent='';return}
  const r=R[i],q=+$('#od'+i).value,o=$('#cx'+i),market=$('#mk'+i).value,p=(r.mod.m.find(x=>x[0]===market)||[0,0])[1];
  if(isHalfMarket(market)){o.textContent='Mercado experimental: no calculo valor esperado ni stake con esta probabilidad provisional. Si lo registras, será solo para seguimiento y validación.';$('#sk'+i).value='';return}
  if(!q||q<=1){o.textContent='';return}
  const e=p*q-1;
  {const P=LS('picks',[]),k=P.find(x=>x.ev===r.ev&&x.mk===$('#mk'+i).value);
   if(k){k.q=q;k.qr=true;if(e<0.05||e>0.25)k.nv=true;else delete k.nv;SV('picks',P)}}
  if(e<0.05||e>0.25){o.innerHTML=`<span class="bad">Ventaja insuficiente o sospechosamente alta</span>: valor estimado ${Math.round(e*100)}%. La app solo considera candidatos entre 5% y 25%; revisa cuota/modelo y no fuerces el pick.`;$('#sk'+i).value='';return}
  const k=Math.min(e/(q-1)*0.25,0.03),amt=cfg.bk?Math.round(cfg.bk*k/100)*100:0;
  $('#sk'+i).value=amt||'';
  o.innerHTML=`<span class="ok">Valor +${Math.round(e*100)}%</span>. Stake sugerido: ${(k*100).toFixed(1)}% del bankroll${amt?' ≈ '+amt.toLocaleString('es'):' (pon tu bankroll en Ajustes para ver el monto)'}.`;
}

// IA: solo explica los datos calculados
// Bajas y alineaciones desde ESPN (pueden venir incompletas; las alineaciones salen ~1 h antes).
// Cada baja se clasifica con el historial de titulares de los últimos partidos del equipo.
async function info(i){
  const r=R[i];if(r.inf)return r.inf;
  const get=async u=>{try{const x=/espn\.com/i.test(u)?await fetchESPN(u):await fetch(u);return x.ok?await x.json():null}catch{return null}};
  const B='https://site.api.espn.com/apis/site/v2/sports/soccer/'+r.slug;
  const [ih,iw,sm]=await Promise.all([get(`${B}/teams/${r.hid}/injuries`),get(`${B}/teams/${r.wid}/injuries`),
    get(`https://site.web.api.espn.com/apis/site/v2/sports/soccer/${r.slug}/summary?event=${r.ev}`)]);
  const raw=j=>{let a=(j&&(j.injuries||(j.team&&j.team.injuries)))||[];if(a[0]&&Array.isArray(a[0].injuries))a=a.flatMap(x=>x.injuries);return a};
  const cls=(sx,j)=>{
    const o={titulares_recientes:[],baja_larga:[],no_titulares:[],sin_clasificar:[]};
    for(const x of raw(j).slice(0,12)){
      const t=x.athlete||{},nm=(t.displayName||t.shortName||'?')+(x.status?' ('+x.status+')':'');
      if(!sx||sx.n<3||t.id==null){o.sin_clasificar.push(nm);continue}
      const e=sx.c[t.id];
      if(!e||e[0]<3)o.no_titulares.push(nm);
      else if(e[1]>=1)o.titulares_recientes.push(nm);
      else o.baja_larga.push(nm);
    }
    return o;
  };
  const lu=((sm&&sm.rosters)||[]).map(t=>({lado:t.homeAway,formacion:t.formation||null,
    titulares:(t.roster||[]).filter(p=>p.starter).map(p=>(p.athlete&&p.athlete.displayName)||'?')}));
  const conf=lu.length>=2&&lu.every(t=>t.titulares.length>=11);
  r.inf={bajas_local:cls(r.A.sx,ih),bajas_visitante:cls(r.B.sx,iw),alineaciones:conf?lu:null};
  return r.inf;
}
async function showInfoRun(i){
  const b=$('#in'+i);b.hidden=false;b.style.whiteSpace='normal';b.textContent='Buscando…';
  const r=R[i];r.inf=null;const f=await info(i);
  const G=o=>{const c=[];
    (o.titulares_recientes||[]).forEach(x=>c.push(`<span class="ch bad" title="Titular reciente">${esc(x)}</span>`));
    (o.baja_larga||[]).forEach(x=>c.push(`<span class="ch mut" title="Baja larga: ya está reflejada en su forma">${esc(x)} · larga</span>`));
    (o.no_titulares||[]).forEach(x=>c.push(`<span class="ch mut">${esc(x)} · no titular</span>`));
    (o.sin_clasificar||[]).forEach(x=>c.push(`<span class="ch am">${esc(x)}</span>`));
    return c.length?`<div>${c.join('')}</div>`:'<span class="mut">sin bajas reportadas (puede estar incompleto)</span>'};
  const eh=`<div class="nh"><span class="chip3">Datos de ESPN</span></div>
<div class="n2"><div><small>${esc(r.h)}</small><b>Bajas</b>${G(f.bajas_local)}</div><div><small>${esc(r.w)}</small><b>Bajas</b>${G(f.bajas_visitante)}</div></div>
<div class="n2" style="grid-template-columns:1fr"><div><b>Alineaciones</b>`+(f.alineaciones?f.alineaciones.map(t=>`<p class="mr-s"><b style="display:inline;letter-spacing:0;text-transform:none;font-size:12px;color:var(--ink)">${t.lado==='home'?esc(r.h):esc(r.w)}</b> ${esc(t.formacion||'')}: ${esc(t.titulares.join(', '))}</p>`).join(''):'<span class="mut">Aún no publicadas (suelen salir ~1 h antes).</span>')+`</div></div>`;
  if(!cfg.gk&&!cfg.br){b.innerHTML=eh+'<div class="nsep"></div><p class="mr-s">Configura Gemini o Brave Search + OpenRouter en Ajustes para consultar también noticias recientes.</p>';return}
  b.innerHTML=eh+'<div class="nsep"></div><div class="nh"><span class="chip3">Noticias y contexto</span></div><p class="mr-s">Buscando fuentes recientes…</p>';
  let gh;try{r.news=null;gh=newsHtml(await research(i),r)}catch(e){gh=`<p class="bad">Gemini: ${esc(e.message.slice(0,140))}</p>`}
  b.innerHTML=eh+'<div class="nsep"></div>'+gh;
}

// ===== Combi: escaneo independiente de los picks normales =====
const CMODES={s:{p:.64,pn:.58,e:.01,n:8,st:5},b:{p:.62,pn:.56,e:.01,n:8,st:5},w:{p:.58,pn:.54,e:0,n:6,st:4}};const CM=()=>CMODES[cfg.fm]||CMODES.b;
function comboStake(r,n,p,q,e,ref){const C=CM();
  // El stake de Combi es propio: una cuota baja puede entrar si la probabilidad es alta,
  // la ventaja es positiva, hay suficiente historial y existe contraste de mercado.
  if(!q||q<1.1||e<C.e||e>0.22||p<(r.nba?C.pn:C.p)||!ref||r.A.n<C.n||r.B.n<C.n)return 1;
  const delta=ref==null?99:Math.abs(p-ref);
  if(delta>0.10)return 1;
  let st=C.st;
  if(p>=0.78&&e>=0.025&&r.A.n>=10&&r.B.n>=10)st=6;
  if(p>=0.84&&e>=0.035&&r.A.n>=12&&r.B.n>=12)st=7;
  if(p>=0.88&&e>=0.04&&r.A.n>=16&&r.B.n>=16)st=8;
  if(p>=0.91&&e>=0.05&&r.A.n>=20&&r.B.n>=20)st=9;
  return st;
}
function comboHtml(source){
  const target=Math.max(1.01,+cfg.cq||1.5),legs=[];
  (source||[]).forEach((r,idx)=>{
    for(const [n,p0] of (r.mod.m||[])){
      if(isHalfMarket(n)||!Number.isFinite(p0)||!r.q||!r.q[n])continue;const p=calP(r,n,p0);
      const q=+r.q[n],e=p*q-1,ref=(r.mod.f&&r.mod.f[n]!=null)?r.mod.f[n]:(r.mod.fc&&r.mod.fc[n]!=null?r.mod.fc[n]:null);
      const st=comboStake(r,n,p,q,e,ref);
      if(st>=CM().st&&q>=1.1&&e>=CM().e&&e<=0.22&&p>=(r.nba?CM().pn:CM().p)){
        const sc=(p*.55)+(Math.min(e,.15)*1.8)+(st*.015)-(ref==null?0.2:Math.abs(p-ref));
        legs.push({idx,r,b:{n,q,p,e,sc,ref},st,event:String(r.ev||`${r.h}-${r.w}-${r.ko||''}`)});
      }
    }
  });
  // Solo una línea por partido: la de mayor confianza, no el pick de la lista normal.
  const byGame=new Map();
  for(const l of legs){const old=byGame.get(l.event);if(!old||l.b.sc>old.b.sc)byGame.set(l.event,l)}
  const pool=[...byGame.values()].sort((a,b)=>b.b.sc-a.b.sc).slice(0,20),combos=[];
  function walk(from,chosen,q,p){
    if(chosen.length>=2){
      const ev=p*q-1;
      if(q>=target&&ev>=0.015&&ev<=0.22)combos.push({legs:chosen.slice(),q,p,e:ev,score:ev+chosen.reduce((n,x)=>n+x.b.sc,0)*0.08});
    }
    if(chosen.length>=4)return;
    for(let i=from;i<pool.length;i++){
      const x=pool[i];if(chosen.some(y=>y.event===x.event))continue;
      walk(i+1,[...chosen,x],q*x.b.q,p*x.b.p);
    }
  }
  walk(0,[],1,1);combos.sort((a,b)=>b.score-a.score);
  combos.sort((a,b)=>b.p-a.p||b.e-a.e);
  const unique=[],seen=new Set();
  for(const c of combos){
    const k=c.legs.map(x=>x.event+':'+x.b.n).sort().join('|');if(seen.has(k))continue;seen.add(k);
    // Evita publicar a la vez una combinada larga y sus subconjuntos casi idénticos.
    const evs=new Set(c.legs.map(x=>x.event));
    if(unique.some(u=>{const ue=new Set(u.legs.map(x=>x.event));return [...evs].filter(e=>ue.has(e)).length===Math.min(evs.size,ue.size)}))continue;
    unique.push(c);if(unique.length>=6)break;
  }
  COMBI_CURRENT=unique.map(c=>({...c,stakeFinal:comboFinalStake(c)}));
  const best=COMBI_CURRENT.length?COMBI_CURRENT.reduce((a,b)=>b.p>a.p?b:a):null;
  const bestHtml=best?`<div class="combo-best"><b>★ Combinada de mayor confianza estimada</b><p>${best.legs.map(l=>esc(l.r.h)+' vs '+esc(l.r.w)).join(' · ')} · ${best.legs.length} líneas</p><div class="combo-stats"><div><small>Probabilidad conjunta aprox.</small><b>${Math.round(best.p*100)}%</b></div><div><small>Cuota combinada</small><b>@${best.q.toFixed(2)}</b></div><div><small>Valor estimado</small><b>${best.e>=0?'+':''}${Math.round(best.e*100)}%</b></div></div><p><b>Stake definitivo combinado: ${best.stakeFinal}/9.</b> El stake final es menor que el de cada línea porque combinar partidos reduce la probabilidad conjunta. Es una escala prudente, no una garantía.</p></div>`:'';
  const content=COMBI_CURRENT.length?COMBI_CURRENT.map((c,i)=>`<article class="combo-item"><div class="combo-title"><span>${best===c?'★ MAYOR CONFIANZA':'COMBINADA '+(i+1)}</span><strong class="combo-odds">@${c.q.toFixed(2)}</strong></div>${c.legs.map((l,j)=>`<div class="combo-pick"><div class="combo-pick-head"><b>${j+1}. ${esc(l.r.h)} <span>vs</span> ${esc(l.r.w)}</b><span class="combo-stake">Línea ${l.st}/9</span></div><div class="combo-meta">${esc(l.b.n)} · cuota individual @${l.b.q.toFixed(2)} · prob. modelo ${Math.round(l.b.p*100)}% · valor estimado ${l.b.e>=0?'+':''}${Math.round(l.b.e*100)}%</div></div>`).join('')}<div class="combo-stats"><div><small>Probabilidad conjunta aprox.</small><b>${Math.round(c.p*100)}%</b></div><div><small>Valor estimado combinado</small><b class="${c.e>0?'ok':'bad'}">${c.e>=0?'+':''}${Math.round(c.e*100)}%</b></div><div><small>Stake final combinado</small><b>${c.stakeFinal}/9</b></div></div><div class="combo-register"><label>Cuota final en tu casa<input id="comboRealQ${i}" type="number" min="1.01" step="0.01" value="${c.q.toFixed(2)}"></label><button class="btn s" type="button" onclick="registerCombo(${i})">＋ Registrar</button></div><p class="combo-note">La cuota inicial es teórica. Corrígela si tu casa ofrece otra.</p></article>`).join(''):`<div class="combo-empty"><div class="combo-empty-icon">✦</div><b>No hay combinadas que pasen los filtros</b><p>Combi necesita al menos dos encuentros con líneas de stake 5 o superior, probabilidad alta, cuota real y valor positivo. Líneas que pasaron el filtro: ${legs.length} en ${byGame.size} partido(s) de ${(source||[]).length} revisados. Filtro actual «${({s:'estricto',b:'equilibrado',w:'amplio'})[cfg.fm||'b']}» (Ajustes → Filtros de picks). Prueba el filtro «amplio», más ligas o «Hoy y mañana».</p></div>`;
  return `<div class="combo-wrap"><div class="combo-hero"><div class="combo-eyebrow">BÚSQUEDA INDEPENDIENTE</div><h2>Combinadas RadarPi</h2><p>Las combinadas se ordenan por probabilidad conjunta y se intenta evitar repetir casi los mismos partidos. Cada registro queda separado de los picks sencillos.</p><div class="combo-pills"><span>2–4 partidos</span><span>Stake por línea 5–9</span><span>Objetivo @${target.toFixed(2)}+</span></div></div>${bestHtml}<div class="combo-results-head"><b>${COMBI_CURRENT.length?`${COMBI_CURRENT.length} combinada${COMBI_CURRENT.length===1?'':'s'} candidata${COMBI_CURRENT.length===1?'':'s'}`:'Sin combinadas válidas'}</b><span>Máximo 6 resultados</span></div>${content}<p class="combo-disclaimer">Las probabilidades conjuntas se aproximan multiplicando probabilidades individuales; los partidos no son necesariamente independientes. El modelo aún necesita validación histórica. Una cuota alta no garantiza rentabilidad.</p></div>`;
}
function comboFinalStake(c){
  // Stake combinado separado de los stakes de cada selección; escala conservadora 1–3/9.
  const p=c.p||0,e=c.e||0,n=(c.legs||[]).length;
  if(e<0.03||p<0.22)return 1;
  if(n===2&&p>=0.52&&e>=0.05)return 3;
  if(n===2&&p>=0.40&&e>=0.035)return 2;
  if(n===3&&p>=0.34&&e>=0.05)return 2;
  return 1;
}
function registerCombo(i){
  const c=COMBI_CURRENT[i];if(!c)return;const inp=$('#comboRealQ'+i),q=+(inp&&inp.value);
  if(!q||q<=1){toast('Escribe la cuota combinada real, mayor que 1,00.');return}
  const P=LS('combipicks',[]),key=c.legs.map(l=>l.event+':'+l.b.n).sort().join('|');
  if(P.some(k=>k.key===key&&k.res==null)){toast('Esta combinada ya está registrada y sigue pendiente.');showCombiTab('modelo');return}
  const rec={id:'cb-'+Date.now()+'-'+Math.floor(Math.random()*10000),key,created:new Date().toISOString(),q:+q.toFixed(2),qModel:+c.q.toFixed(2),p:+c.p.toFixed(4),e:+(c.p*q-1).toFixed(4),stake:comboFinalStake({...c,e:c.p*q-1})||1,res:null,legs:c.legs.map(l=>({event:String(l.r.ev||l.event),slug:l.r.slug,match:l.r.h+' vs '+l.r.w,home:l.r.h,away:l.r.w,league:l.r.liga||'',ko:l.r.ko,market:l.b.n,odds:l.b.q,p:+l.b.p.toFixed(4),lineStake:l.st}))};
  P.unshift(rec);SV('combipicks',P);toast('Combinada guardada en Modelo Combi.');showCombiTab('modelo');
}
function setCombiResult(id,res){const P=LS('combipicks',[]),k=P.find(x=>x.id===id);if(!k)return;k.res=res;k.manual=!!res;SV('combipicks',P);drawCombiModel();}
function deleteCombi(id){if(!confirm('¿Borrar esta combinada del Modelo Combi?'))return;SV('combipicks',LS('combipicks',[]).filter(x=>x.id!==id));drawCombiModel();}
async function showCombiTab(t){combiTab=t;$('#comboSearchView').hidden=t!=='buscar';$('#comboModelView').hidden=t!=='modelo';document.querySelectorAll('[data-combi-tab]').forEach(b=>b.classList.toggle('on',b.dataset.combiTab===t));if(t==='modelo'){try{await settleCombi()}catch{}drawCombiModel();}}
function drawCombiModel(){
  const P=LS('combipicks',[]),done=P.filter(x=>x.res==='w'||x.res==='l'),wins=done.filter(x=>x.res==='w').length,loss=done.length-wins,pending=P.filter(x=>!x.res).length;
  const units=done.reduce((a,x)=>a+(x.res==='w'?x.stake*(x.q-1):-x.stake),0),risk=done.reduce((a,x)=>a+x.stake,0),roi=risk?units/risk*100:0;
  $('#comboCount').textContent=pending;
  const stats=`<div class="combo-model-stats"><div class="card"><small>Registradas</small><b>${P.length}</b></div><div class="card"><small>Pendientes</small><b>${pending}</b></div><div class="card"><small>Acierto</small><b>${done.length?Math.round(wins/done.length*100)+'%':'—'}</b><small>${wins} acertadas · ${loss} falladas</small></div><div class="card"><small>Balance teórico</small><b class="${units>=0?'ok':'bad'}">${done.length?(units>=0?'+':'')+units.toFixed(2):'—'}</b><small>${done.length?'ROI '+roi.toFixed(1)+'%':'Se calcula al resolver resultados'}</small></div></div><p class="status">Seguimiento separado del Modelo de Fútbol. El balance usa unidades de stake y la cuota registrada; no representa dinero real. Los resultados pueden marcarse manualmente cuando falten estadísticas.</p>`;
  const cards=P.length?P.map(k=>`<article class="combo-record"><h3>${k.legs.length} líneas · @${(+k.q).toFixed(2)} · Stake ${k.stake}/9</h3><small>Registrada ${new Date(k.created).toLocaleString('es')} · Prob. conjunta ${Math.round(k.p*100)}% · valor estimado ${k.e>=0?'+':''}${Math.round(k.e*100)}%${k.auto?' · resultado automático':''}</small>${k.legs.map((l,i)=>`<div class="combo-pick"><div class="combo-pick-head"><b>${i+1}. ${esc(l.match)}</b><span class="combo-stake">@${(+l.odds).toFixed(2)}</span></div><div class="combo-meta">${esc(l.league)} · ${esc(l.market)} · prob. ${Math.round(l.p*100)}%</div></div>`).join('')}<p><b>Resultado:</b> <span class="${k.res==='w'?'ok':k.res==='l'?'bad':''}">${k.res==='w'?'Acertó':k.res==='l'?'Falló':k.res==='v'?'Nula':'Pendiente'}</span></p><div class="combo-record-actions">${k.res?`<button class="btn s" onclick="setCombiResult('${k.id}',null)">↺ Pendiente</button>`:`<button class="btn s" onclick="setCombiResult('${k.id}','w')">✓ Acertó</button><button class="btn s" onclick="setCombiResult('${k.id}','l')">✕ Falló</button><button class="btn s" onclick="setCombiResult('${k.id}','v')">Nula</button>`}<button class="btn s" onclick="deleteCombi('${k.id}')">Borrar</button></div></article>`).join(''):'<div class="combo-empty"><div class="combo-empty-icon">☷</div><b>El Modelo Combi está vacío</b><p>Cuando encuentres una combinada que te interese, pulsa «Registrar». Aquí quedará guardada para medir resultados separada de los picks sencillos y las apuestas reales.</p></div>';
  const grpRows=(f,lab)=>{const ks=[...new Set(done.map(f))].sort();return ks.length?`<div class="card"><h2>${lab}</h2>${ks.map(k=>{const a=done.filter(x=>f(x)===k),w=a.filter(x=>x.res==='w').length;return rwRow(k,w,a.length,Math.round(100*a.reduce((t,x)=>t+x.p,0)/a.length))}).join('')}</div>`:''};
  $('#comboModelView').innerHTML=`<div class="combo-wrap"><div class="combo-hero"><div class="combo-eyebrow">SEGUIMIENTO SEPARADO</div><h2>Modelo Combi</h2><p>Solo aparecen las combinadas que registres en este menú.</p></div>${stats}${grpRows(x=>x.legs.length+' líneas','Acierto por número de líneas')}${grpRows(x=>'Stake '+x.stake+'/9','Acierto por stake combinado')}${cards}</div>`;
}
async function settleCombi(){
  const P=LS('combipicks',[]);let changed=false;
  for(const k of P){if(k.res||k.manual||!k.legs?.length||k.legs.some(l=>l.slug==='nba'))continue;if(k.legs.some(l=>!l.ko||new Date(l.ko).getTime()>Date.now()-3*36e5))continue;let outcomes=[];
    for(const l of k.legs){let f=null;try{f=await final(l.slug,l.event)}catch{}if(!f||f.pending){outcomes=[];break}const ok=evalMk(l.market,f.h,f.a,f.cor,f.crd,f.hh,f.ha);if(ok===null){outcomes=[];break}outcomes.push(ok)}
    if(outcomes.length===k.legs.length){k.res=outcomes.every(Boolean)?'w':'l';k.auto=true;changed=true;}
  }if(changed)SV('combipicks',P);return changed;
}
async function scanCombi(){
  if($('#comboScanBtn').disabled)return;
  const btn=$('#comboScanBtn'),msg=$('#comboMsg'),panel=$('#comboPanel');
  const selC=Array.isArray(cfg.cl)?cfg.cl:cfg.lg;if((!cfg.ok||!cfg.bm)&&!(selC.includes('nba')&&selC.every(x=>x==='nba'))){msg.textContent='Para buscar combinadas con valor, configura la llave de OddsPapi y tu casa de apuestas en Ajustes.';panel.innerHTML='<div class="combo-empty"><b>Falta configurar las cuotas</b><p>Combi necesita precios reales para calcular el valor. Configura OddsPapi y la casa que utilizas; no usará cuotas inventadas.</p></div>';return;}
  btn.disabled=true;btn.classList.add('busy');btn.textContent='Buscando líneas…';panel.innerHTML='<div class="combo-empty"><b>Buscando partidos y mercados propios…</b><p>Consultando encuentros, historial y cuotas. Esto no ejecuta el escáner normal.</p></div>';
  try{
    const leagues=selC.filter(x=>x!=='nba'),useNba=selC.includes('nba'),names=Object.fromEntries(Object.entries(LG).map(([n,s])=>[s,n]));
    if(!leagues.length&&!useNba)throw new Error('Selecciona al menos una liga o NBA.');
    msg.textContent='Cargando cuotas reales…';
    const OD=leagues.length?await loadOdds(undefined,leagues):null;
    // A Combi no le pedimos una segunda descarga de cuotas de Pinnacle: multiplica las solicitudes.
    // Se usa la cuota de la casa configurada, quitándole margen para el contraste interno.
    const results=[],bad=[];let seen=0;
    for(const slug of leagues){
      msg.textContent='Buscando partidos: '+(names[slug]||slug)+'…';let evs=[];
      try{const ids=new Set();for(let d=0;d<(cfg.dd||1);d++){const j=await espn(`${slug}/scoreboard?dates=${iso(new Date(Date.now()+d*864e5)).replace(/-/g,'')}`);for(const e of j.events||[])if(!ids.has(e.id)){ids.add(e.id);evs.push(e)}}}catch(e){bad.push((names[slug]||slug)+': '+e.message);continue}
      let SL=null;try{if(evs.length)SL=await standings(slug)}catch{}
      for(const e of evs){
        if(seen>=60)break;
        if(e.status.type.state!=='pre'||!okDay(e.date))continue;
        const c0=e.competitions&&e.competitions[0];if(!c0)continue;
        const H=c0.competitors.find(x=>x.homeAway==='home'),W=c0.competitors.find(x=>x.homeAway==='away');if(!H||!W)continue;
        const hn=H.team.shortDisplayName||H.team.displayName,wn=W.team.shortDisplayName||W.team.displayName,hf=H.team.displayName||hn,wf=W.team.displayName||wn;
        const q=oddsQ(OD,hf,wf,e.date);if(!q||!Object.keys(q).length)continue;seen++;
        msg.textContent=`Analizando líneas propias: ${hn} vs ${wn}…`;
        let A,B;try{const forms=await Promise.all([teamForm(slug,H.team.id),teamForm(slug,W.team.id)]);A=st(forms[0]);B=st(forms[1])}catch{continue}
        A.ss=SL&&SL.t[H.team.id];B.ss=SL&&SL.t[W.team.id];A.mu=SL?SL.mu:null;
        // Combi puede añadir datos de córners/tarjetas si la opción está activa.
        if(cfg.ex){try{const sum=await ev(slug,e.id),a=sum&&sum[H.team.id],b=sum&&sum[W.team.id];if(a&&b){if(a.c!=null){A.cf=A.cf==null?a.c:(A.cf+a.c)/2;A.ca=B.ca==null?b.c:(B.ca+b.c)/2}if(b.c!=null){B.cf=B.cf==null?b.c:(B.cf+b.c)/2;B.ca=A.ca==null?a.c:(A.ca+a.c)/2}if(a.y!=null)A.y=(A.y||0)+a.y;if(b.y!=null)B.y=(B.y||0)+b.y}}catch{}}
        const mod=model(A,B),fc=fairP(q);
        if(Object.keys(fc).length)mod.fc=fc
        const p=[];if(A.n>=5&&B.n>=5){if(A.b>=cfg.b&&B.b>=cfg.b)p.push('Ambos marcan');if(A.t>=cfg.g&&B.t>=cfg.g)p.push('Over goles');if(A.low>=70&&B.low>=70)p.push('Partido cerrado');if(A.cf!=null&&B.cf!=null)p.push('Córners');if(A.y!=null&&B.y!=null)p.push('Tarjetas')}
        results.push({m:`${hn} vs ${wn}`,liga:names[slug]||slug,h:hn,w:wn,hora:dlab(e.date)+new Date(e.date).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),p,A,B,mod,q,casa:cfg.bm,ev:e.id,slug,ko:e.date,hid:H.team.id,wid:W.team.id});
      }
    }
    if(useNba){msg.textContent='NBA…';try{results.push(...await window.nbCombiSource(t=>msg.textContent=t))}catch(e){bad.push('NBA: '+e.message)}}
    if(!results.length)throw new Error((bad.length?bad.join(' · ')+'. ':'')+'No se encontraron partidos con cuotas emparejadas en las ligas y fechas elegidas. Comprueba cobertura de OddsPapi o amplía la búsqueda.');
    panel.innerHTML=comboHtml(results);msg.textContent=`Búsqueda independiente terminada: ${results.length} partidos con cuotas analizados. No se utilizó el resultado del escáner normal.`;
  }catch(e){panel.innerHTML=`<div class="combo-empty"><b>No se pudo completar la búsqueda</b><p>${esc(e.message||'Error desconocido')}</p></div>`;msg.textContent='Combi no pudo terminar la búsqueda.'}
  finally{btn.disabled=false;btn.classList.remove('busy');btn.textContent='✦ Buscar combinadas'}
}
$('#comboScanBtn').onclick=scanCombi;
// ===== API-Football opcional: se consulta solo a petición y los resultados se cachean =====
async function afGet(path,params={}){
  if(!cfg.af)throw new Error('Añade primero tu llave API-Football en Ajustes.');
  const url='https://v3.football.api-sports.io/'+path+'?'+new URLSearchParams(params);
  const res=await fetch(url,{headers:{'x-apisports-key':cfg.af}});
  let j;try{j=await res.json()}catch{throw new Error('Respuesta no válida del proveedor.');}
  if(!res.ok||j.errors&&Object.keys(j.errors).length)throw new Error(JSON.stringify(j.errors||('HTTP '+res.status)).slice(0,220));
  return j;
}
$('#af-test').onclick=async()=>{
  const out=$('#af-status');cfg.af=$('#c-af').value.trim();
  if(!cfg.af){out.textContent='Pega la llave API-Football y pulsa Guardar ajustes.';return}
  out.textContent='Probando conexión…';
  try{const j=await afGet('status');const a=j.response&&j.response.account||{},q=j.response&&j.response.requests||{};SV('cfg',cfg);out.textContent=`Conexión correcta${a.firstname?' · '+a.firstname:''}. Solicitudes hoy: ${q.current??'?'} / ${q.limit_day??'límite no informado'}.`}
  catch(e){out.textContent='No se pudo conectar: '+e.message;}
};
async function afMore(i){
  const r=R[i],box=$('#afp'+i);box.hidden=false;box.innerHTML='<p class="status">Consultando API-Football… puede gastar hasta 3 solicitudes la primera vez. Se reutilizan los datos en caché durante 12–24 horas.</p>';
  if(!cfg.af){box.innerHTML='<p class="status">Para usar esta función, crea una cuenta gratuita en API-Football, copia tu llave en Ajustes y pulsa Guardar. La cuota gratuita publicada es de 100 solicitudes al día.</p>';return}
  const cacheKey='af_match_'+String(r.ev||r.h+'_'+r.w+'_'+iso(new Date(r.ko))).replace(/[^a-z0-9_-]/gi,'_');
  let data=LS(cacheKey,null);
  try{
    if(!data||data.noInj||Date.now()-data.t>12*36e5){
      const date=iso(new Date(r.ko));
      let fxCache=LS('af_fixtures_'+date,null),fx;
      if(fxCache&&Date.now()-fxCache.t<24*36e5)fx=fxCache.v;
      else{const j=await afGet('fixtures',{date,timezone:'America/Bogota'});fx=j.response||[];SV('af_fixtures_'+date,{t:Date.now(),v:fx});}
      const scored=(fx||[]).map(f=>{const h=f.teams&&f.teams.home&&f.teams.home.name||'',a=f.teams&&f.teams.away&&f.teams.away.name||'';return {f,score:sim(r.h,h)+sim(r.w,a),rev:sim(r.h,a)+sim(r.w,h)}}).map(x=>({...x,score:Math.max(x.score,x.rev),reversed:x.rev>x.score})).sort((a,b)=>b.score-a.score);
      const hit=scored[0];if(!hit||hit.score<1.15)throw new Error('No encontré un partido coincidente con suficiente confianza. No se usarán datos de otro encuentro.');
      const f=hit.f,fixtureId=f.fixture&&f.fixture.id;if(!fixtureId)throw new Error('La API no devolvió ID de partido.');
      const [pj,ij]=await Promise.all([afGet('predictions',{fixture:fixtureId}).catch(e=>({__err:e.message})),afGet('injuries',{fixture:fixtureId}).catch(e=>({__err:e.message}))]);
      data={t:Date.now(),fixture:{id:fixtureId,home:f.teams.home.name,away:f.teams.away.name,date:f.fixture.date,league:f.league&&f.league.name},prediction:pj.response&&pj.response[0]||null,injuries:ij.response||[],reversed:!!hit.reversed,predictionError:pj.__err||null,injuryError:ij.__err||null};SV(cacheKey,data);
    }
    const p=data.prediction&&data.prediction.predictions||{},pct=p.percent||{},inj=data.injuries||[],previousPick=bestOf(r);r.afData=data;
    const picked=bestOf(r),apiProb=picked?afMarketProb(r,picked.n):null,conflict=picked?afConflict(r,picked.n,picked.p):null,previousConflict=previousPick?afConflict(r,previousPick.n,previousPick.p):null;
    const decision=previousConflict&&previousConflict.level==='strong'?`<b>Pick original vetado por contradicción fuerte: ${esc(previousPick.n)}.</b> RadarPi estimaba ${Math.round(previousPick.p*100)}%, pero API-Football solo ${Math.round(previousConflict.api*100)}% para ese mercado. Ese pick ya no pasa los filtros cuando se tiene en cuenta el proveedor.${picked?` Alternativa que sí pasa los filtros: ${esc(picked.n)} (${Math.round(picked.p*100)}% estimado por RadarPi).`:' No hay una alternativa con valor suficiente; mejor no apostar este partido.'}`:!picked?'<b>No hay pick automático válido</b>: con el contraste API-Football no queda una selección que supere los filtros actuales.':!apiProb?'<b>Contraste parcial</b>: API-Football no aporta una probabilidad directamente comparable para el mercado seleccionado; usa sus bajas y consejo como contexto.':conflict&&conflict.level==='strong'?`<b>Contradicción fuerte: descartar el pick actual (${esc(picked.n)}).</b> RadarPi estima ${Math.round(picked.p*100)}%, pero API-Football estima solo ${Math.round(apiProb*100)}% para ese mismo mercado. No lo registres como pick recomendado; busca otra selección o no apuestes.`:conflict?`<b>Contradicción moderada con API-Football.</b> RadarPi estima ${Math.round(picked.p*100)}% y el proveedor ${Math.round(apiProb*100)}%. Reduce la confianza y no subas el stake.`:`<b>Sin contradicción fuerte.</b> Para ${esc(picked.n)}, RadarPi estima ${Math.round(picked.p*100)}% y API-Football ${Math.round(apiProb*100)}%. La coincidencia no garantiza valor ni acierto.`;
    const pctHtml=(label,v)=>`<div><small>${label}</small><b>${esc(v||'—')}</b></div>`,apiHome=data.reversed?pct.away:pct.home,apiAway=data.reversed?pct.home:pct.away;
    box.innerHTML=`<div class="nh"><b>Contraste combinado RadarPi + API-Football</b><span class="chip3">Revisión de coherencia</span></div><div class="stake-row"><p>${decision}</p><small>El filtro se aplica a las selecciones de resultado 1X2/doble oportunidad cuando hay probabilidades comparables. Para goles, córners y tarjetas, API-Football no ofrece en este endpoint una probabilidad equivalente.</small></div><p class="mr-s">Partido emparejado: <b>${esc(data.fixture.home)} vs ${esc(data.fixture.away)}</b> · ${esc(data.fixture.league||'competición sin nombre')} · ${new Date(data.fixture.date).toLocaleString('es',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}. Comprueba que sea el mismo encuentro.</p>${p.percent?`<div class="af-grid">${pctHtml('Local (partido)',apiHome)}${pctHtml('Empate',pct.draw)}${pctHtml('Visitante (partido)',apiAway)}</div>`:''}${p.advice?`<p><b>Consejo del proveedor:</b> ${esc(p.advice)}</p>`:''}${p.under_over?`<p><b>Goles estimados del proveedor:</b> ${esc(p.under_over)}</p>`:''}${p.winner&&p.winner.name?`<p><b>Ganador estimado por proveedor:</b> ${esc(p.winner.name)}${p.winner.comment?' · '+esc(p.winner.comment):''}</p>`:''}${data.predictionError?`<p class="status">Predicción no disponible: ${esc(data.predictionError)}</p>`:''}<p><b>Lesiones/sanciones devueltas:</b> ${inj.length}</p>${inj.length?`<ul>${inj.slice(0,12).map(x=>`<li>${esc(x.player&&x.player.name||'Jugador')} · ${esc(x.player&&x.player.type||x.player&&x.player.reason||'estado sin detalle')} (${esc(x.team&&x.team.name||'equipo no indicado')})</li>`).join('')}</ul>`:'<p class="status">No se devolvieron lesiones para este partido. Eso no confirma que ambos equipos estén sin bajas.</p>'}${data.injuryError?`<p class="status">Lesiones no disponibles: ${esc(data.injuryError)}</p>`:''}<p class="status">Fuente complementaria. La cobertura de predicciones y lesiones cambia por liga; contrasta siempre con cuotas reales y noticias/alineaciones.</p>`;
    const savedPanel=afWrap(box.innerHTML);box.innerHTML=savedPanel;drawRes();const refreshed=$('#afp'+i);if(refreshed){refreshed.hidden=false;refreshed.innerHTML=savedPanel;}
  }catch(e){box.innerHTML=`<p class="bad">API-Football: ${esc(e.message||'No se pudieron obtener datos.')}</p><p class="status">Si la llave es válida pero falla, puede ser falta de cobertura, límite diario o un problema de coincidencia del partido. No se inventan datos para completar el análisis.</p>`;}
}

// ===== El mejor pick de cada partido lo elige la app con criterios fijos (así siempre sale el mismo) =====
const isHalfMarket=n=>/primer tiempo|segundo tiempo|ambas mitades|1er tiempo|2do tiempo/i.test(n);
const supports=(r,n)=>r.p.some(t=>(/^Over:/.test(t)&&/^Over [123]\.5$/.test(n))||(/^Ambos marcan/.test(t)&&n==='Ambos marcan: sí')||(/^(Under:|Partido cerrado)/.test(t)&&/^Under [12]\.5$/.test(n))||(/córners/i.test(t)&&/^Córners Over/.test(n))||(/^Tarjetas/.test(t)&&/^Tarjetas Over/.test(n)));
function afCacheKeyFor(r){return 'af_match_'+String(r.ev||r.h+'_'+r.w+'_'+iso(new Date(r.ko))).replace(/[^a-z0-9_-]/gi,'_')}
function afPctNum(v){if(v==null)return null;const n=parseFloat(String(v).replace('%','').replace(',','.'));return Number.isFinite(n)?(n>1?n/100:n):null}
function afMarketProb(r,name){
  const d=r.afData||LS(afCacheKeyFor(r),null),p=d&&d.prediction&&d.prediction.predictions,pct=p&&p.percent;if(!pct)return null;
  const home=afPctNum(d.reversed?pct.away:pct.home),draw=afPctNum(pct.draw),away=afPctNum(d.reversed?pct.home:pct.away);
  if(name==='Local gana')return home;if(name==='Empate')return draw;if(name==='Visitante gana')return away;
  if(name==='Doble oportunidad 1X')return home!=null&&draw!=null?home+draw:null;
  if(name==='Doble oportunidad X2')return draw!=null&&away!=null?draw+away:null;
  if(name==='Doble oportunidad 12')return home!=null&&away!=null?home+away:null;
  return null;
}
function afConflict(r,name,p){
  const ap=afMarketProb(r,name);if(ap==null)return null;
  const gap=p-ap,oneXtwo=['Local gana','Empate','Visitante gana'].includes(name);
  // Un resultado directo con solo 15% o menos del proveedor y al menos 25% del modelo es una contradicción fuerte.
  // También se veta si el modelo excede la probabilidad del proveedor en 20 puntos; no se confunde doble oportunidad con 1X2.
  if(gap>=0.20||(oneXtwo&&ap<=0.15&&p>=0.25))return {api:ap,model:p,gap,level:'strong'};
  if(gap>=0.12)return {api:ap,model:p,gap,level:'moderate'};
  return null;
}

// ===== Calibración con el historial real: el motor corrige su propio optimismo =====
const mgrp=n=>/^Córners/.test(n)?'cor':/^Tarjetas/.test(n)?'tar':/^Ambos/.test(n)?'btts':/^Doble/.test(n)?'dc':/^(Over|Under|Goles)/.test(n)?'tot':'res';
function calibStats(){
  const now=Date.now();if(calibStats.c&&now-calibStats.t<4000)return calibStats.c;
  const D=LS('picks',[]).filter(k=>(k.res==='w'||k.res==='l')&&!k.experimental&&k.p>0);
  const f=a=>({n:a.length,w:a.filter(k=>k.res==='w').length,e:a.reduce((s,k)=>s+k.p,0)});
  const by={};for(const g of new Set(D.map(k=>mgrp(k.mk))))by[g]=f(D.filter(k=>mgrp(k.mk)===g));
  calibStats.c={all:f(D),by};calibStats.t=now;return calibStats.c;
}
// Probabilidad ajustada: recorte por historial (global y por tipo de mercado) + ancla a la cuota del mercado + contraste API-Football 1X2
const FMODES={s:{qa:1.3,qb:2.3,pc:.5,ea:.015,eb:.18},b:{qa:1.2,qb:2.6,pc:.46,ea:0,eb:.22},w:{qa:1.15,qb:3.2,pc:.4,ea:0,eb:.3}};
const FM=()=>FMODES[cfg.fm]||FMODES.b;
function calP(r,n,p){if(r&&r.nba)return p;
  const C=calibStats(),g=C.by[mgrp(n)]||{n:0,w:0,e:0},ra=(C.all.w+6)/(C.all.e+6),rg=(g.w+4)/(g.e+4),b=g.n/(g.n+8);
  const kf=Math.min(1.05,Math.max(.7,b*rg+(1-b)*ra)),ref=(r.mod.f&&r.mod.f[n]!=null)?r.mod.f[n]:(r.mod.fc&&r.mod.fc[n]!=null?r.mod.fc[n]:null);
  let x=p*(ref!=null?1-(1-kf)*.5:kf);   // con referencia de mercado, el ancla ya corrige parte del optimismo
  if(ref!=null)x=ref+.6*(x-ref);
  if(/^(Local gana|Empate|Visitante gana|Doble)/.test(n)){const ap=afMarketProb(r,n);if(ap!=null)x=0.8*x+0.2*ap}
  return Math.max(.01,Math.min(.97,x));
}
// Tendencia de goles de API-Football («-2.5» = menos de 2,5; «+2.5» = más de 2,5): 1 apoya, -1 contradice, 0 neutro
function afDir(r,n){
  const k=String(n).match(/^(Over|Under) (\d\.5)$/);if(!k)return 0;
  const d=r.afData||LS(afCacheKeyFor(r),null),u=d&&d.prediction&&d.prediction.predictions&&d.prediction.predictions.under_over,m=String(u||'').match(/^([+-])(\d\.5)$/);if(!m)return 0;
  const L=+k[2],P=+m[2];
  if(k[1]==='Over')return m[1]==='+'?(L<=P?1:0):(L>=P?-1:0);
  return m[1]==='-'?(L>=P?1:0):(L<=P?-1:0);
}
// Cuotas de API-Football: promedio entre casas, mapeadas por NOMBRE de mercado (no por id)
function afQ(resp){
  const acc={},add=(n,o)=>{o=+o;if(n&&o>1.01)(acc[n]=acc[n]||[]).push(o)};
  for(const b of (resp&&resp[0]&&resp[0].bookmakers)||[])for(const bt of b.bets||[]){
    const nm=String(bt.name||'').toLowerCase();
    for(const x of bt.values||[]){
      const v=String(x.value||'').trim(),o=x.odd,ou=v.match(/^(Over|Under) (\d+\.5)$/);
      if(nm==='match winner')add({Home:'Local gana',Draw:'Empate',Away:'Visitante gana'}[v],o);
      else if(nm==='double chance')add({'Home/Draw':'Doble oportunidad 1X','Draw/Away':'Doble oportunidad X2','Home/Away':'Doble oportunidad 12'}[v],o);
      else if(nm==='both teams score')add({Yes:'Ambos marcan: sí',No:'Ambos marcan: no'}[v],o);
      else if(nm==='goals over/under'&&ou)add(v,o);
      else if(/^corners? over/.test(nm)&&ou)add('Córners '+v,o);
      else if(/^cards? over|^total cards/.test(nm)&&ou)add('Tarjetas '+v,o);
      else if(nm==='odd/even')add({Odd:'Goles impar',Even:'Goles par'}[v],o);
      else if(nm==='asian handicap')add({'Home -1.5':'Local gana por 2+ goles','Away -1.5':'Visitante gana por 2+ goles','Home +1.5':'Hándicap local +1.5','Away +1.5':'Hándicap visitante +1.5'}[v],o);
      else if(/^win to nil - home/.test(nm)&&v==='Yes')add('Local gana sin recibir gol',o);
      else if(/^win to nil - away/.test(nm)&&v==='Yes')add('Visitante gana sin recibir gol',o);
    }
  }
  const q={};for(const [n,a] of Object.entries(acc))if(a.length>=2||/gol|Hándicap/.test(n))q[n]=+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(2);
  return qSane(q);
}
const afBud=()=>{const u=LS('afUsed',{d:'',n:0});return u.d===today()?u.n:0};
const afUse=k=>SV('afUsed',{d:today(),n:afBud()+k});
async function afAuto(r){
  const ck=afCacheKeyFor(r);let d=LS(ck,null);
  if(!(d&&d.afq!==undefined&&Date.now()-d.t<12*36e5)){
    if(afBud()>=90)throw new Error('límite propio de 90 solicitudes/día alcanzado');
    const date=iso(new Date(r.ko));let fc=LS('af_fixtures_'+date,null),fx;
    if(fc&&Date.now()-fc.t<24*36e5)fx=fc.v;else{const j=await afGet('fixtures',{date,timezone:'America/Bogota'});afUse(1);fx=j.response||[];SV('af_fixtures_'+date,{t:Date.now(),v:fx})}
    const hit=(fx||[]).map(f=>{const s=sim(r.h,f.teams.home.name)+sim(r.w,f.teams.away.name),v=sim(r.h,f.teams.away.name)+sim(r.w,f.teams.home.name);return{f,s:Math.max(s,v),rev:v>s}}).sort((a,b)=>b.s-a.s)[0];
    if(!hit||hit.s<1.15)throw new Error('sin coincidencia segura para '+r.m);
    const id=hit.f.fixture.id,[pj,oj]=await Promise.all([afGet('predictions',{fixture:id}).catch(()=>({})),afGet('odds',{fixture:id}).catch(()=>({}))]);afUse(2);
    d={t:Date.now(),noInj:true,fixture:{id,home:hit.f.teams.home.name,away:hit.f.teams.away.name,date:hit.f.fixture.date,league:hit.f.league&&hit.f.league.name},prediction:(pj.response||[])[0]||null,injuries:[],reversed:hit.rev,afq:afQ(oj.response)};SV(ck,d);
  }
  r.afData=d;const aq=d.afq||{};
  if(Object.keys(aq).length){r.afq=aq;if(!r.q){r.q=Object.assign({},aq);r.qx=Object.fromEntries(Object.keys(aq).map(k=>[k,1]));r.qsrc='API-Football (promedio de casas)'}else{for(const n in aq)if(!(n in r.q)){r.q[n]=aq[n];(r.qx=r.qx||{})[n]=1}}if(!r.mod.f&&!r.mod.fc){const fc=fairP(aq);if(Object.keys(fc).length)r.mod.fc=fc}}
  return d;
}

// ===== Visualización: fila legible (relleno = acierto real, marca = lo prometido) =====
function rwRow(t,w,n,p,extra){
  const h=n?Math.round(100*w/n):0,d=h-p,c=d>=-3?'ok':d<-8?'bad':'am';
  return `<div class="rw"><div class="rw-h"><b>${t}</b><span>${w} de ${n}</span></div><div class="rw-t" role="img" aria-label="Acertó ${h}%, prometía ${p}%"><i class="${c}" style="width:${h}%"></i><u style="left:${p}%"></u></div><div class="rw-l"><span><b>${h}%</b> acertó</span><span class="rw-d ${c}">${d>=0?'+':''}${d} pts</span><span>prometía <b>${p}%</b></span></div>${extra?`<div class="rw-x">${extra}</div>`:''}</div>`;
}
function wilson(w,n){if(!n)return[0,0];const z=1.96,p=w/n,d=1+z*z/n,c=p+z*z/(2*n),s=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return[Math.max(0,(c-s)/d),Math.min(1,(c+s)/d)]}
function engineCard(){
  const C=calibStats(),g=C.all;if(g.n<5)return '';const r=(g.w+6)/(g.e+6),N={res:'Resultado 1X2',dc:'Doble oportunidad',btts:'Ambos marcan',tot:'Goles',cor:'Córners',tar:'Tarjetas'};
  return `<div class="card"><h2>Ajuste del motor</h2><p class="status">Con ${g.n} picks resueltos, el modelo prometía ${Math.round(100*g.e/g.n)}% y acertó ${Math.round(100*g.w/g.n)}%. Por eso ahora recorta sus probabilidades ≈${Math.round((1-Math.min(1,r))*100)}% (más en los mercados que más fallan), las ancla a la cuota del mercado y filtra los picks según el modo elegido en Ajustes (Filtros de picks).</p>${Object.entries(C.by).map(([k,v])=>rwRow(N[k]||k,v.w,v.n,Math.round(100*v.e/v.n))).join('')}</div>`;
}
function stakeTab(P){
  const S=P.filter(k=>!k.experimental&&(k.res==='w'||k.res==='l')),sOf=k=>Number.isFinite(+k.stake)&&+k.stake>=1?{s:+k.stake,est:false}:(k.stakeEst?{s:+k.stakeEst,est:true}:null);
  const rows=[1,2,3,4,5,6,7,8,9].map(s=>{const a=S.filter(k=>{const x=sOf(k);return x&&x.s===s}),n=a.length,w=a.filter(k=>k.res==='w').length,wq=a.filter(k=>k.q),roi=wq.length?wq.reduce((t,k)=>t+(k.res==='w'?k.q-1:-1),0)/wq.length:null,[lo,hi]=wilson(w,n);
    return{s,n,w,h:n?w/n:0,lo,hi,roi,pa:n?Math.round(100*a.reduce((t,k)=>t+k.p,0)/n):0,est:a.some(k=>sOf(k).est)}}).filter(x=>x.n);
  const sin=S.filter(k=>!sOf(k)).length,best=rows.filter(x=>x.n>=5).sort((a,b)=>b.lo-a.lo||b.h-a.h)[0];
  const band=(a,b,t)=>{const x=rows.filter(r=>r.s>=a&&r.s<=b),n=x.reduce((s,r)=>s+r.n,0),w=x.reduce((s,r)=>s+r.w,0);return `<div><small>${t}</small><b>${n?Math.round(100*w/n)+'%':'—'}</b><small>${w} de ${n}</small></div>`};
  return `<div class="card"><h2>Acierto por Stake</h2><small>Compara cada nivel de stake por su porcentaje de acierto. Con pocos picks el porcentaje engaña, así que se muestra también el rango de confianza del 95%.</small>
  ${best?`<div class="best-st"><b>Stake ${best.s}/9 es el más fiable hasta ahora</b><br><small>${Math.round(best.h*100)}% de acierto en ${best.n} picks. Con 95% de confianza, su acierto real está entre ${Math.round(best.lo*100)}% y ${Math.round(best.hi*100)}%.</small></div>`:`<p class="status">Hacen falta al menos 5 picks resueltos en un mismo stake para decir cuál es el mejor.</p>`}
  <div class="band">${band(1,3,'Bajo 1–3')}${band(4,6,'Medio 4–6')}${band(7,9,'Alto 7–9')}</div>
  ${rows.map(x=>rwRow('Stake '+x.s+'/9'+(x.est?' (estimado)':''),x.w,x.n,x.pa,`Rango 95%: ${Math.round(x.lo*100)}–${Math.round(x.hi*100)}%${x.roi!=null?' · ROI '+(x.roi>=0?'+':'')+(x.roi*100).toFixed(0)+'%':''}`)).join('')}
  ${sin?`<p class="status">${sin} picks resueltos no tienen stake guardado (se registraron antes de esta versión). Desde ahora todo pick nuevo guarda su stake automáticamente.</p><button class="btn s" onclick="estStake()">Estimar stake de los históricos</button><p class="status">La estimación se calcula solo con la probabilidad que prometía cada pick y se marca como «estimado».</p>`:''}${P.some(k=>k.stakeEst)?'<button class="btn s" onclick="undoEstStake()">Dejar como estaba (quitar estimados)</button><p class="status">Los estimados llevan la marca «estimado». Este botón los borra todos y deja tus picks exactamente como estaban.</p>':''}</div>`;
}
function undoEstStake(){const P=LS('picks',[]);let c=0;for(const k of P)if(k.stakeEst){delete k.stakeEst;c++}SV('picks',P);drawModel();toast('Estimación quitada en '+c+' picks. Quedaron como estaban.')}
function estStake(){const P=LS('picks',[]);let c=0;for(const k of P){if(Number.isFinite(+k.stake)||k.experimental||!(k.p>0))continue;k.stakeEst=Math.max(1,Math.min(9,Math.round(1+(k.p-0.45)/0.4*8)));c++}SV('picks',P);drawModel();toast(c+' picks históricos con stake estimado')}
function candScan(r){
  const veto=[];
  if(r.A.n<5||r.B.n<5)return {out:[],veto};          // con tan poco historial el modelo no es fiable
  const out=[],conC=!!(r.q&&Object.keys(r.q).length);
  for(const [n,p] of r.mod.m){
    if(isHalfMarket(n))continue; // hasta calibrar con resultados por tiempo, no se convierten en picks automáticos
    if(!Number.isFinite(p)||p<0.35||p>0.90)continue;
    const q=(r.q&&r.q[n])||null,t=tierOf(r,n),sp=supports(r,n);
    // Sin cuota real no existe valor esperado comprobable: solo se puede mostrar como mercado a vigilar.
    if(!conC||!q||q<1.01)continue;
    const pc=calP(r,n,p),e=pc*q-1;
    const F=FM();if(q<F.qa||q>F.qb||pc<F.pc||e<F.ea||e>F.eb)continue;
    // Sanidad frente al mercado: si el modelo supera a Pinnacle (o a la casa sin margen) por más de 10 puntos, casi seguro es error del modelo.
    const ref=(r.mod.f&&r.mod.f[n]!=null)?r.mod.f[n]:(r.mod.fc&&r.mod.fc[n]!=null?r.mod.fc[n]:null);
    if(ref!=null&&p-ref>0.10){veto.push({n,p,ref});continue}
    const afc=afConflict(r,n,p);
    if(afc&&afc.level==='strong'){veto.push({n,p,ref:afc.api,source:'API-Football',reason:'Contradicción fuerte con API-Football'});continue}
    const dr=afDir(r,n),sc=pc*.6+Math.min(e,.12)*1.5+({A:.035,B:.015,C:-.025}[t]||0)+(sp?.01:0)-(afc&&afc.level==='moderate'?.04:0)+(dr>0?.015:dr<0?-.04:0);
    out.push({n,p:pc,pm:p,q,e,sc,t});
  }
  return {out:out.sort((a,b)=>b.sc-a.sc),veto};
}
const cands=r=>candScan(r).out;
const bestOf=r=>cands(r)[0]||null;
function diagnose(r){return whyNo(r)}
function regModel(i){
  const r=R[i];if(!r||!r.mod||!r.mod.m||!r.mod.m.length){toast('No hay mercados calculados para guardar.');return}
  const chosen=r.userMk||r.pk||null;
  const candidates=r.mod.m.filter(([n,p])=>!isHalfMarket(n)&&Number.isFinite(p)&&p>0&&p<1);
  let mk=chosen&&r.mod.m.some(x=>x[0]===chosen)?chosen:null;
  if(!mk){const b=bestOf(r);if(b)mk=b.n;}
  if(!mk){const withQ=candidates.filter(([n])=>r.q&&+r.q[n]>1).sort((a,b)=>(b[1]*(+r.q[b[0]])-1)-(a[1]*(+r.q[a[0]])-1));
    mk=(withQ[0]||candidates.slice().sort((a,b)=>b[1]-a[1])[0]||[])[0];}
  if(!mk){toast('No hay un mercado válido para guardar.');return}
  const chosenProb=(r.mod.m.find(x=>x[0]===mk)||[null,null])[1],afc=afConflict(r,mk,chosenProb);
  if(afc&&afc.level==='strong'){toast(`No guardado: API-Football contradice fuertemente «${mk}» (${Math.round(afc.api*100)}% frente a ${Math.round(chosenProb*100)}% del modelo).`);return}
  const typed=(r.userMk===mk&&$('#od'+i)&&+$('#od'+i).value>1)?+$('#od'+i).value:null;
  const q=typed||((r.pk===mk&&r.pq>1)?+r.pq:null)||(r.q&&+r.q[mk])||null;
  const id=addPick(r,mk,q,0,false);
  if(!id){toast('No se pudo guardar el pronóstico.');return}
  const P=LS('picks',[]),k=P.find(x=>x.id===id);
  if(k){k.source='escaneo';k.savedAt=k.savedAt||new Date().toISOString();if(q){k.q=+q;k.qr=!!($('#od'+i)&&+$('#od'+i).value>0)}k.stake=baseStake(r,mk,q);k.stakeScale=9;k.stakeMarket=mk;SV('picks',P)}
  drawModel();toast(`Pronóstico guardado: ${mk}${q?' · cuota @'+q:' · sin cuota'}. No se registró dinero apostado.`);
}
function baseStake(r,n,price){
  const m=r.mod.m.find(x=>x[0]===n);if(!m)return 1;
  if(!price||price<=1)return 1;
  const pc=calP(r,n,m[1]),e=pc*price-1;
  const F=FM();if(e<F.ea||e>F.eb||pc<F.pc||price<F.qa||price>F.qb)return 1;
  let b=techo(r,m);
  const ref=!!(r.mod.f&&r.mod.f[n]!=null)||!!(r.afq&&r.afq[n]);
  const tier=tierOf(r,n),sup=!!supports(r,n),conf=!!conflictOf(r,n);
  if(r.A.n<8||r.B.n<8)b=Math.min(b,4);
  if(!ref)b=Math.min(b,4);
  if(pc<0.58)b=Math.min(b,3);else if(pc<0.65)b=Math.min(b,5);
  if(e<0.03)b=Math.min(b,3);else if(e<0.06)b=Math.min(b,5);else if(e<0.1)b=Math.min(b,6);else b=Math.min(b,(tier==='A'&&r.A.n>=12&&r.B.n>=12&&ref&&sup&&!conf&&pc>=0.7)?9:7);
  if(conf)b-=1;
  return Math.max(1,Math.min(9,b));
}
function topHtml(){
  const t3=R.map((r,i)=>{const b=bestOf(r);return b?{r,b,s:baseStake(r,b.n,b.q)}:null}).filter(Boolean).sort((a,b)=>b.b.sc-a.b.sc).slice(0,3);
  if(!t3.length)return '';
  return `<div class="card"><h2>Mejores picks</h2><small>Solo aparecen con cuota real emparejada y ventaja estimada entre 5% y 25%. La ventaja es una estimación, no garantía; confirma contexto y alineaciones con la IA.</small>`+
    t3.map(t=>`<div class="bet"><div class="bet-h"><b>${esc(t.r.h)} vs ${esc(t.r.w)}</b><span class="st w">${t.s}/10</span></div><small>${esc(t.b.n)} · ${Math.round(t.b.p*100)}%${t.b.q?' · @'+t.b.q+' · valor '+Math.round(t.b.e*100)+'%':' · cuota mín. '+(1.05/t.b.p).toFixed(2)}${t.b.t?' · nivel '+t.b.t:''}</small></div>`).join('')+'</div>';
}

// ===== Gemini: busca en Google noticias, bajas y contexto del partido =====
async function gmodel(){
  const c=LS('gmodel',null);if(c&&Date.now()-c.t<7*864e5)return c.v;
  const j=await (await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':cfg.gk}})).json();
  if(j.error)throw new Error(j.error.message);
  const ms=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/','')).filter(x=>/flash/.test(x)&&!/image|tts|live|audio|embedding|robotics/.test(x));
  const v=[/^gemini-3\.5-flash$/,/^gemini-3-flash/,/^gemini-3\.1-flash(?!-lite)/,/^gemini-2\.5-flash$/,/^gemini-3\.1-flash-lite/].map(re=>ms.find(x=>re.test(x))).find(Boolean)||ms[0];
  if(!v)throw new Error('tu llave no tiene modelos Flash disponibles');
  SV('gmodel',{t:Date.now(),v});return v;
}
async function research(i){
  const r=R[i];if(r.news)return r.news;
  const cacheKey='CTX2_'+r.ev,cache=LS(cacheKey,null);
  if(cache&&cache.v&&Date.now()-cache.t<8*36e5){r.news=cache.v;return r.news;}
  // Si Gemini se quedó sin cuota, se pausa por 24 horas para no repetir errores en cada partido.
  const gPause=LS('gemini_pause_until',0);
  if(cfg.gk&&Date.now()>gPause){
    try{
      const mdl=await gmodel(),now=new Date().toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),f=new Date(r.ko).toLocaleString('es',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
      const prompt=`Actúa como investigador deportivo prepartido. Fecha actual: ${now}. Partido: ${r.h} vs ${r.w}, competición ${r.liga}, inicio ${f}. Busca en la web noticias recientes y fuentes verificables. Investiga situación competitiva, escenarios de clasificación/eliminación, rotaciones, descanso, lesiones/sanciones y alineaciones. Distingue CONFIRMADO, PROBABLE y NO VERIFICADO. No inventes datos ni deduzcas que un equipo debe ganar sin respaldo. Devuelve SOLO JSON válido con forma: {"resumen":"1-3 frases","situacion_competitiva":{"local":"...","visitante":"...","escenarios_clasificacion":"...","urgencia_verificada":"alta|media|baja|desconocida"},"bajas_local":["..."],"bajas_visitante":["..."],"bajas_clave_total":0,"dudas":["..."],"alineacion_probable_local":null,"alineacion_probable_visitante":null,"rotaciones_y_descanso":["..."],"contexto":["..."],"impacto_en_mercados":{"resultado":"...","goles":"...","corners":"...","tarjetas":"..."},"alertas_contrarias":["..."],"fuentes":[{"medio":"...","titulo":"...","fecha":"...","url":"..."}],"confianza":"alta|media|baja"}. No inventes enlaces ni hechos. Si no hay evidencia, dilo y usa confianza baja.`;
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':cfg.gk},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{temperature:0.1}})});
      const j=await res.json();
      if(!res.ok||j.error){const msg=(j.error&&j.error.message)||('Gemini HTTP '+res.status);if(res.status===429||/quota|rate limit|resource exhausted|limit/i.test(msg))SV('gemini_pause_until',Date.now()+24*36e5);throw new Error(msg)}
      const c=j.candidates&&j.candidates[0],txt=((c&&c.content&&c.content.parts)||[]).map(x=>x.text||'').join('');
      let o=null;try{o=JSON.parse(txt.match(/\{[\s\S]*\}/)[0])}catch{}
      const src=((c&&c.groundingMetadata&&c.groundingMetadata.groundingChunks)||[]).map(x=>x.web).filter(Boolean).slice(0,4);
      r.news=o?{...o,fuentes:src}:{resumen:txt.slice(0,400),fuentes:src,confianza:'baja'};
      SV(cacheKey,{t:Date.now(),v:r.news});return r.news;
    }catch(e){
      // El error se conserva para el mensaje final si no hay proveedor alternativo.
      r._geminiError=e&&e.message?e.message:'Gemini no disponible';
    }
  }
  if(cfg.br&&cfg.or){
    try{
      const q=`(${r.h} OR ${r.w}) fútbol noticias lesiones bajas alineaciones rotaciones ${r.liga}`;
      const u='https://api.search.brave.com/res/v1/news/search?'+new URLSearchParams({q,count:'8',country:'CO',search_lang:'es',freshness:'pw'});
      const sr=await fetch(u,{headers:{Accept:'application/json','X-Subscription-Token':cfg.br}});
      const sj=await sr.json();if(!sr.ok)throw new Error((sj&&sj.message)||('Brave Search HTTP '+sr.status));
      const articles=(sj.results||[]).slice(0,8).map(a=>({titulo:a.title||'',url:a.url||'',fecha:a.age||a.page_age||a.published||'',resumen:a.description||a.extra_snippets?.join(' ')||''})).filter(a=>a.titulo&&a.url);
      if(!articles.length)throw new Error('Brave no devolvió noticias útiles para este partido');
      const prompt=`Eres investigador deportivo. Resume SOLO la evidencia contenida en estos resultados reales de noticias para ${r.h} vs ${r.w} (${r.liga}), partido del ${new Date(r.ko).toLocaleString('es')}. No inventes datos ni afirmes que una noticia confirma algo si el titular/snippet no lo respalda. Marca hechos como CONFIRMADO, PROBABLE o NO VERIFICADO. Devuelve SOLO JSON válido con campos: resumen, situacion_competitiva {local,visitante,escenarios_clasificacion,urgencia_verificada}, bajas_local[], bajas_visitante[], bajas_clave_total, dudas[], alineacion_probable_local, alineacion_probable_visitante, rotaciones_y_descanso[], contexto[], impacto_en_mercados {resultado,goles,corners,tarjetas}, alertas_contrarias[], confianza. No inventes fuentes; los enlaces se añadirán desde la lista original. Si no hay evidencia suficiente, explica que no se pudo confirmar y usa confianza baja. Noticias encontradas: ${JSON.stringify(articles)}`;
      const rr=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cfg.or,'HTTP-Referer':'https://github.com/','X-Title':'RadarPi'},body:JSON.stringify({model:'openrouter/free',temperature:0,max_tokens:1800,messages:[{role:'system',content:'No inventes hechos, lesiones, fechas, alineaciones ni escenarios matemáticos. Devuelve JSON válido.'},{role:'user',content:prompt}]})});
      const rj=await rr.json();if(!rr.ok||!rj.choices)throw new Error((rj.error&&rj.error.message)||('OpenRouter HTTP '+rr.status));
      const txt=rj.choices[0].message.content||'';let o=null;try{o=JSON.parse(txt.match(/\{[\s\S]*\}/)[0])}catch{}
      if(!o)throw new Error('OpenRouter no devolvió JSON válido');
      o.fuentes=articles.slice(0,5).map(a=>({medio:new URL(a.url).hostname,titulo:a.titulo,fecha:a.fecha,url:a.url}));
      o.proveedor='Brave Search + OpenRouter';
      r.news=o;SV(cacheKey,{t:Date.now(),v:r.news});return r.news;
    }catch(e){r._altError=e&&e.message?e.message:'La alternativa no está disponible'}
  }
  if(r._geminiError&&r._altError)throw new Error('Gemini: '+r._geminiError.slice(0,90)+' · Alternativa: '+r._altError.slice(0,110));
  if(r._geminiError)throw new Error('Gemini: '+r._geminiError.slice(0,140)+(cfg.br&&cfg.or?'':' · Configura OpenRouter y Brave Search en Ajustes para activar el respaldo.'));
  if(!cfg.gk&&!cfg.br)throw new Error('Configura Gemini o Brave Search + OpenRouter en Ajustes.');
  throw new Error(r._altError||'No fue posible recuperar noticias.');
}
const ul=a=>a&&a.length?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
const chs=(a,c)=>(a&&a.length)?`<div>${a.map(x=>`<span class="ch ${c||''}">${esc(x)}</span>`).join('')}</div>`:'<span class="mut">sin datos</span>';
function newsHtml(n,r){
  if(!n)return '';
  const conf=String(n.confianza||'?').toLowerCase(),sc=n.situacion_competitiva;
  const sec=(t,body)=>body?`<details class="ns"><summary>${t}</summary>${body}</details>`:'';
  const imp=n.impacto_en_mercados?Object.entries(n.impacto_en_mercados).map(([k,v])=>k+': '+v):[];
  return `<div class="nh"><span class="chip3 ${conf==='alta'?'ok':conf==='baja'?'bad':''}">Confianza ${esc(n.confianza||'?')}</span>${n.proveedor?`<small>vía ${esc(n.proveedor)}</small>`:''}</div>
${n.resumen?`<p class="nsum">${esc(n.resumen)}</p>`:''}
${(n.alertas_contrarias&&n.alertas_contrarias.length)?`<div class="nwarn"><b>⚠ Alertas contra el pick</b>${ul(n.alertas_contrarias)}</div>`:''}
<div class="n2"><div><small>${esc(r.h)}</small><b>Bajas</b>${chs(n.bajas_local,'bad')}${n.alineacion_probable_local?`<p class="mr-s">XI probable: ${esc(n.alineacion_probable_local)}</p>`:''}</div>
<div><small>${esc(r.w)}</small><b>Bajas</b>${chs(n.bajas_visitante,'bad')}${n.alineacion_probable_visitante?`<p class="mr-s">XI probable: ${esc(n.alineacion_probable_visitante)}</p>`:''}</div></div>
${(n.dudas&&n.dudas.length)?`<div style="margin-top:10px"><small><b>Dudas</b></small>${chs(n.dudas,'am')}</div>`:''}
${sec('Motivación y clasificación',sc?`<p><b>${esc(r.h)}:</b> ${esc(sc.local||'Sin datos')}</p><p><b>${esc(r.w)}:</b> ${esc(sc.visitante||'Sin datos')}</p><p><b>Escenarios:</b> ${esc(sc.escenarios_clasificacion||'No verificados')}</p><p><b>Urgencia verificada:</b> ${esc(sc.urgencia_verificada||'desconocida')}</p>`:'')}
${sec('Rotaciones y descanso',ul(n.rotaciones_y_descanso))}${sec('Contexto verificado',ul(n.contexto))}${sec('Posible impacto por mercado',ul(imp))}
<p class="nsrc"><small>La IA puede equivocarse: abre las fuentes y verifica noticias y alineaciones.${(n.fuentes&&n.fuentes.length)?' Fuentes: '+n.fuentes.map(x=>`<a href="${esc(x.url||x.uri||'#')}" target="_blank" rel="noopener">${esc((x.titulo||x.title||x.medio||'enlace').slice(0,55))}</a>`).join(' · '):''}</small></p>`;
}

// techo de stake (1-10) que permiten los datos: probabilidad, tamaño de muestra y patrones que coinciden
function techo(r,m){
  let t=Math.round((m[1]-0.45)*20);
  if(r.A.n>=8&&r.B.n>=8)t++;
  if(r.A.n<6||r.B.n<6)t-=2;
  if(r.p.length>=2)t++;
  const tr=tierOf(r,m[0]);if(tr==='A')t++;else if(tr==='C')t--;else if(!tr&&r.mod.raw&&r.q&&r.q[m[0]])t--;
  return Math.max(1,Math.min(9,t));
}
const lista=(a,t)=>a&&a.length?`<h4>${t}</h4><ul>${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
async function aiRun(i){
  const r=R[i],box=$('#ai'+i);box.hidden=false;box.style.whiteSpace='normal';
  if(!cfg.gq&&!cfg.or){box.textContent='Falta una llave de IA: configura Groq o OpenRouter en Ajustes.';return}
  box.textContent='Analizando…';
  let inf=null,news=null;try{inf=await info(i)}catch{}
  try{news=await research(i)}catch{}
  const sel=$('#mk'+i).value,q=+$('#od'+i).value||null;
  const bp=sel?null:bestOf(r);
  if(!sel&&!bp){box.innerHTML=`<div class="vd"><div class="vh"><span class="chip3 bad">Sin pick de la app</span></div><p>${whyNo(r)}</p><button class="btn s" onclick="showInfo(${i})">Investigar contexto</button></div>`;return}
  const modo=sel?`El usuario eligió el mercado "${sel}": analiza SOLO ese mercado y el pick debe ser exactamente ese. Si no hay valor o respaldo suficiente, decision="no_apostar". Si hay cuota_del_usuario o cuota_casa, úsala. En lugar de stake devuelve ajuste_stake (0, -1 o -2 según los riesgos): la app calcula el stake.`:`La app ya eligió el mejor pick de este partido con criterios fijos (valor, nivel, cuota mínima y respaldo de patrones): "pick_de_la_app". Tu tarea: devolver decision "apostar" o "no_apostar" (no_apostar solo si hay una razón concreta en las bajas, las alineaciones o los datos), el pick EXACTAMENTE igual a pick_de_la_app, ajuste_stake (0, -1 o -2 según los riesgos; la app calcula el stake, ignora el campo stake) y explicar. No cambies de mercado.`;
  const pk=x=>({victorias:x.w,derrotas:x.l,goles_favor_prom:+x.gf.toFixed(2),goles_totales_prom:+x.t.toFixed(2),ambos_marcan_pct:x.b,partidos_2_goles_o_menos_pct:x.low,porterias_en_cero:x.cs,sin_marcar:x.fts,racha_victorias:x.rs,corners_favor:x.cf,corners_contra:x.ca,tarjetas_por_partido:x.y});
  const data={partido:r.m,liga:r.liga,patrones_detectados:r.p,
    [r.h+' (local)']:{ultimos10:pk(r.A),en_casa:r.A.hn+' jugados, '+r.A.hw+' ganados'},
    [r.w+' (visitante)']:{ultimos10:pk(r.B),de_visita:r.B.an+' jugados, '+r.B.aw+' ganados'},
    modelo:{goles_esperados:{local:+r.mod.lh.toFixed(2),visitante:+r.mod.la.toFixed(2)},
      mercados:r.mod.m.map(m=>({mercado:m[0],prob_pct:Math.round(m[1]*100),cuota_minima:+(1.05/m[1]).toFixed(2),techo_stake:techo(r,m),prob_modelo_pct:Math.round(((r.mod.raw||r.mod.m0||r.mod.m).find(x=>x[0]===m[0])||m)[1]*100),prob_pinnacle_pct:(r.mod.f&&r.mod.f[m[0]]!=null)?Math.round(r.mod.f[m[0]]*100):null,nivel:tierOf(r,m[0]),cuota_casa:(r.q&&r.q[m[0]])||null,valor_pct:(r.q&&r.q[m[0]])?Math.round((m[1]*r.q[m[0]]-1)*100):null}))},
    cuota_del_usuario:(sel&&q)?{mercado:sel,cuota:q}:null,
    api_football:(()=>{const d=r.afData||LS(afCacheKeyFor(r),null);if(!d)return null;const pp=d.prediction&&d.prediction.predictions||{},pc=pp.percent||{};return {partido_confirmado:`${d.fixture&&d.fixture.home||''} vs ${d.fixture&&d.fixture.away||''}`,probabilidades_1x2:{local:afPctNum(d.reversed?pc.away:pc.home),empate:afPctNum(pc.draw),visitante:afPctNum(d.reversed?pc.home:pc.away)},consejo:pp.advice||null,ganador_estimado:pp.winner&&pp.winner.name||null,bajas:(d.injuries||[]).map(x=>({jugador:x.player&&x.player.name||null,equipo:x.team&&x.team.name||null,motivo:x.player&&(x.player.type||x.player.reason)||null})),error_prediccion:d.predictionError||null};})(),
    contexto_calidad:{muestra_local:r.A.n,muestra_visitante:r.B.n,cuota_real_disponible:!!(sel?q:bestOf(r)?.q),alineacion_confirmada:!!(inf&&inf.alineaciones),modelo_validado_fuera_de_muestra:false},pick_de_la_app:bp?{mercado:bp.n,prob_pct:Math.round(bp.p*100),cuota:bp.q,valor_pct:bp.e!=null?Math.round(bp.e*100):null,nivel:bp.t}:null};
  try{
    const messages=[
      {role:'system',content:'Eres analista escéptico de apuestas deportivas. Usa las estadísticas y el contexto recibido; no inventes datos ni trates ausencia de noticia como confirmación. Las probabilidades son estimaciones no calibradas todavía, basadas en una muestra pequeña, así que no las presentes como certezas. Comprueba si el contexto competitivo (eliminación/clasificación/descenso/título), posibles rotaciones, bajas y descanso contradicen la señal estadística. Una necesidad de ganar no significa automáticamente que ganará ni que habrá muchos goles. Si contexto clave está sin verificar, la alineación no está confirmada, faltan datos del mercado, el valor estimado es menor de 5% o mayor de 25%, o hay contradicciones fuertes, recomienda no apostar. Si api_football contiene probabilidades comparables y el mercado elegido contradice fuertemente al proveedor, debes recomendar no_apostar, no ignorar el dato ni inventar una alternativa. Solo recomienda el pick_de_la_app o el mercado exacto seleccionado; no cambies de mercado. No conviertas una probabilidad alta en valor si la cuota no compensa. Las razones deben incluir datos numéricos del JSON y, cuando aplique, hechos contextuales con fuente/estado. Devuelve máximo 3 razones y 3 riesgos. ajuste_stake debe ser 0, -1 o -2. Responde SOLO JSON válido: {"decision":"apostar"|"no_apostar","pick":"nombre exacto del mercado","ajuste_stake":0|-1|-2,"cuota_minima":número,"resumen":"una frase","razones":["..."],"riesgos":["..."]}. Nunca prometas ganancias.'},
      {role:'system',content:modo+' Los datos de bajas_y_alineaciones vienen de ESPN y pueden estar incompletos: sin bajas reportadas no significa que no haya bajas. Solo las bajas en titulares_recientes son relevantes (evalúa a qué lado favorecen o perjudican); baja_larga ya está reflejada en la forma reciente y no_titulares casi no importa. Si las alineaciones no están confirmadas, dilo en los riesgos y no pongas un stake alto. noticias_y_contexto viene de una búsqueda web y puede tener errores: úsalo solo para señalar riesgos o contexto (rotaciones, motivación, bajas) y para ajuste_stake; nunca para inventar números.'},
      {role:'user',content:JSON.stringify(data)}];
    let j=null,providerError='';
    if(cfg.gq){
      try{
        const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cfg.gq},body:JSON.stringify({model:MODEL,temperature:0,max_completion_tokens:2500,messages})});
        const gj=await res.json();if(res.ok&&gj.choices)j=gj;else providerError='Groq: '+((gj.error&&gj.error.message)||('HTTP '+res.status));
      }catch(e){providerError='Groq: '+e.message}
    }
    if(!j&&cfg.or){
      try{
        const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+cfg.or,'HTTP-Referer':'https://github.com/','X-Title':'RadarPi'},body:JSON.stringify({model:'openrouter/free',temperature:0,max_tokens:2500,messages})});
        const oj=await res.json();if(res.ok&&oj.choices)j=oj;else providerError+=(providerError?' · ':'')+'OpenRouter: '+((oj.error&&oj.error.message)||('HTTP '+res.status));
      }catch(e){providerError+=(providerError?' · ':'')+'OpenRouter: '+e.message}
    }
    if(!j){box.textContent='Error de IA. '+(providerError||'Configura Groq u OpenRouter en Ajustes.');return}
    const txt=j.choices[0].message.content||'';
    let o=null;try{o=JSON.parse(txt.match(/\{[\s\S]*\}/)[0])}catch{}
    if(!o){box.style.whiteSpace='pre-wrap';box.textContent=txt||'La IA no devolvió respuesta. Intenta de nuevo.';return}
    if(sel)o.pick=sel;else if(bp)o.pick=bp.n;
    const mk=r.mod.m.find(m=>m[0]===o.pick);
    const price=mk?((r.q&&r.q[mk[0]])||(sel===mk[0]?q:null)):null;let note='';
    if(mk&&isHalfMarket(mk[0])){o.decision='no_apostar';note='Mercado por mitades experimental: no se recomienda apostar hasta validar el cálculo con datos históricos por periodo.'}
    if(mk&&!price){o.decision='no_apostar';note='Falta una cuota real de la casa para calcular valor esperado.'}
    if(mk&&price&&(mk[1]*price-1<0.05||mk[1]*price-1>0.25)){o.decision='no_apostar';note='La ventaja estimada no está en el rango prudente (5%-25%); puede ser ruido o un error del modelo.'}
    const afFinal=mk?afConflict(r,mk[0],mk[1]):null;
    if(afFinal&&afFinal.level==='strong'){o.decision='no_apostar';note=`Contradicción fuerte de API-Football: ${Math.round(afFinal.api*100)}% para este mercado frente a ${Math.round(mk[1]*100)}% del modelo. Se bloquea la recomendación.`}
    const aj=Math.max(-2,Math.min(0,Math.round(+o.ajuste_stake||0)));
    const rl=x=>x?x.titulares_recientes.length:0,nb=Math.max(inf?rl(inf.bajas_local)+rl(inf.bajas_visitante):0,Math.min(2,Math.round(+(news&&news.bajas_clave_total)||0)));
    let stk=mk?baseStake(r,mk[0],price):1;
    if(inf&&!inf.alineaciones)stk=Math.min(stk,7);
    stk=Math.max(1,Math.min(10,stk-(nb>=2?2:nb===1?1:0)+aj));
    if(o.decision!=='apostar'){box.innerHTML=`<div class="vd"><div class="vh"><span class="chip3 bad">No apostar</span></div><p>${esc(o.resumen||'')}</p>${note?`<p class="bad">${esc(note)}</p>`:''}${lista(o.razones,'Razones')}</div>`;return}
    const pct=stk*0.3,amt=cfg.bk?Math.round(cfg.bk*pct/100/100)*100:0;
    r.pk=o.pick;r.sk=amt;r.pq=price;
    const pm=mk?mk[1]:null,val=(price&&pm!=null)?Math.round((pm*price-1)*100):null;
    box.innerHTML=`<div class="vd"><div class="vh"><span class="chip3 ok">Apostar</span><b class="vp">${esc(o.pick)}</b></div>
<div class="vgrid"><div><small>Stake final</small><b>${stk}/9</b></div><div><small>Probabilidad</small><b>${pm!=null?Math.round(pm*100)+'%':'—'}</b></div><div><small>${price?'Cuota casa':'Cuota mín.'}</small><b>${price?price:esc(o.cuota_minima||(pm?(1.05/pm).toFixed(2):'—'))}</b></div><div><small>Valor</small><b>${val!=null?(val>=0?'+':'')+val+'%':'—'}</b></div></div>
<div class="meter${stk>=8?' hi':''}" role="img" aria-label="Stake ${stk} de 9">${Array.from({length:9},(_,k)=>`<i class="${k<stk?'f':''}"></i>`).join('')}</div>
<p class="mr-s">${pct.toFixed(1)}% del bankroll${amt?' ≈ <b>'+amt.toLocaleString('es')+'</b>':''}. Stake orientativo (máximo 1,8% del bankroll en esta versión; no es garantía de ventaja)${aj?' · la IA lo bajó '+(-aj):''}.</p>
<p>${esc(o.resumen||'')}</p>${lista(o.razones,'Razones')}${lista(o.riesgos,'Riesgos')}${inf&&!inf.alineaciones?'<p class="mr-s">Alineaciones sin confirmar: stake máximo 7. Vuelve a analizar cuando salgan (≈1 h antes).</p>':''}
${mk?`<div class="ctl" style="grid-template-columns:1fr auto;margin-top:6px;align-items:center"><input id="pq${i}" type="number" step="0.01" placeholder="Cuota real" value="${price||''}" aria-label="Cuota real"><button class="btn s" style="margin:6px 0 0" onclick="regModel(${i})">Registrar en Modelo</button></div>`:''}</div>`;
  }catch(e){box.textContent='Error: '+e.message}
}

// ===== Seguimiento del modelo: guarda cada pick y lo resuelve solo con el marcador final de ESPN =====
function addPick(r,mk,q,s,bet){
  if(!r.ev)return null;
  const m=r.mod.m.find(x=>x[0]===mk);if(!m)return null;
  const P=LS('picks',[]);
  let k=P.find(x=>x.ev===r.ev&&x.mk===mk);
  if(!k){k={id:Date.now()+'-'+Math.floor(Math.random()*1e4),ev:r.ev,slug:r.slug,m:r.m,liga:r.liga||'Liga no guardada',ko:r.ko,mk,p:+m[1].toFixed(3),res:null};P.push(k)}
  if(!k.liga)k.liga=r.liga||'Liga no guardada';if(q)k.q=q;if(s)k.s=s;if(bet)k.bet=true;
  const raw=(r.mod.raw||r.mod.m0||r.mod.m).find(x=>x[0]===mk);k.pm=raw?+raw[1].toFixed(3):k.p;k.pf=r.mod.f&&r.mod.f[mk]!=null?+r.mod.f[mk].toFixed(3):null;k.t=tierOf(r,mk);k.experimental=isHalfMarket(mk);try{const qq=+k.q||+(r.q&&r.q[mk])||0;if(qq>1){k.stake=baseStake(r,mk,qq);k.stakeMarket=mk}k.pc=+calP(r,mk,m[1]).toFixed(3)}catch{}
  SV('picks',P);return k.id;
}
function evalMk(n,h,a,cor,crd,hh,ha){
  const hasHT=Number.isFinite(hh)&&Number.isFinite(ha),h2=hasHT?h-hh:null,a2=hasHT?a-ha:null;
  const dd=h-a,tg=h+a;
  if(n==='Local gana por 2+ goles')return dd>=2;if(n==='Visitante gana por 2+ goles')return -dd>=2;if(n==='Hándicap local +1.5')return -dd<2;if(n==='Hándicap visitante +1.5')return dd<2;if(n==='Goles: 2 o 3')return tg>=2&&tg<=3;if(n==='Goles impar')return tg%2===1;if(n==='Goles par')return tg%2===0;if(n==='Ambos marcan y Over 2.5')return h>0&&a>0&&tg>=3;if(n==='Local gana y Over 2.5')return h>a&&tg>=3;if(n==='Visitante gana y Over 2.5')return a>h&&tg>=3;if(n==='Local gana sin recibir gol')return h>a&&a===0;if(n==='Visitante gana sin recibir gol')return a>h&&h===0;
  if(/Gol en ambas mitades/i.test(n))return hasHT?(hh+ha>0&&h2+a2>0):null;
  if(/Local marca en ambas mitades/i.test(n))return hasHT?(hh>0&&h2>0):null;
  if(/Visitante marca en ambas mitades/i.test(n))return hasHT?(ha>0&&a2>0):null;
  if(/Ambos marcan: sí \(1er tiempo\)/i.test(n))return hasHT?(hh>0&&ha>0):null;
  if(/Ambos marcan: sí \(2do tiempo\)/i.test(n))return hasHT?(h2>0&&a2>0):null;
  const first=/primer tiempo|1er tiempo/i.test(n),second=/segundo tiempo|2do tiempo/i.test(n);
  const ou=n.match(/(Over|Under) (\d+\.\d)/);
  if(ou){let t=/^Córners/.test(n)?cor:/^Tarjetas/.test(n)?crd:first?(hasHT?hh+ha:null):second?(hasHT?h2+a2:null):h+a;if(t==null)return null;return ou[1]==='Over'?t>+ou[2]:t<+ou[2]}
  if(/Local marca 1er tiempo/i.test(n))return hasHT?hh>0:null;
  if(/Visitante marca 1er tiempo/i.test(n))return hasHT?ha>0:null;
  if(/Local marca 2do tiempo/i.test(n))return hasHT?h2>0:null;
  if(/Visitante marca 2do tiempo/i.test(n))return hasHT?a2>0:null;
  const tm=n.match(/^(Local|Visitante) marca (\d)\+/);if(tm)return (tm[1]==='Local'?h:a)>=+tm[2];
  return ({'Local gana':h>a,'Empate':h===a,'Visitante gana':a>h,'Doble oportunidad 1X':h>=a,'Doble oportunidad X2':a>=h,'Doble oportunidad 12':h!==a,
    'Ambos marcan: sí':h>0&&a>0,'Ambos marcan: no':!(h>0&&a>0),'Local deja arco en cero':a===0,'Visitante deja arco en cero':h===0})[n]??null;
}
async function final(slug,ev){
  const r=await fetchESPN(`https://site.web.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${ev}`);
  if(!r.ok)return null;
  const j=await r.json(),c=j.header&&j.header.competitions&&j.header.competitions[0];
  if(!c||!(c.status&&c.status.type&&c.status.type.completed))return{pending:true};
  const H=c.competitors.find(x=>x.homeAway==='home'),A=c.competitors.find(x=>x.homeAway==='away');
  const h=+H.score,a=+A.score;if(isNaN(h)||isNaN(a))return null;
  const line0=x=>{const z=x&&Array.isArray(x.linescores)&&x.linescores[0];const v=z&&(z.value??z.displayValue);return v==null?null:+v};
  const hh=line0(H),ha=line0(A);
  let cor=null,crd=null;const ts=(j.boxscore&&j.boxscore.teams)||[];
  if(ts.length===2){
    const g=n=>ts.map(t=>{const x=(t.statistics||[]).find(q=>q.name===n);return x?+x.displayValue:NaN});
    const cs=g('wonCorners'),ys=g('yellowCards'),rs=g('redCards');
    if(cs.every(x=>!isNaN(x)))cor=cs[0]+cs[1];
    if(ys.every(x=>!isNaN(x)))crd=ys[0]+ys[1]+(rs.every(x=>!isNaN(x))?rs[0]+rs[1]:0);
  }
  return{h,a,cor,crd,hh:Number.isFinite(hh)?hh:null,ha:Number.isFinite(ha)?ha:null};
}
function regPick(i){
  const r=R[i],mk=r.pk;if(!mk)return;
  const q=+$('#pq'+i).value;
  if(!q||q<=1){toast('Escribe la cuota real de tu casa.');return}
  const p=(r.mod.m.find(x=>x[0]===mk)||[0,0])[1],e=p*q-1;
  if(e<0.05||e>0.25){if(!confirm(`El valor estimado es ${Math.round(e*100)}%, fuera del rango prudente de 5%-25%. ¿Registrar solo para seguimiento, sin que eso signifique recomendación?`))return;}
  const id=addPick(r,mk,q,r.sk||0,false),P=LS('picks',[]),k=P.find(x=>x.id===id);
  if(k){k.qr=true;if(e<0.05||e>0.25)k.nv=true;else delete k.nv;SV('picks',P)}
  toast('Agregado al seguimiento.');
}
function delPick(id){
  if(!confirm('¿Borrar este pick del seguimiento?'))return;
  SV('picks',LS('picks',[]).filter(x=>x.id!==id));drawModel();
}
function setPick(id,res){
  const P=LS('picks',[]),k=P.find(x=>x.id===id);if(!k)return;
  k.res=res;k.man=res!==null;if(res===null)delete k.sc;
  SV('picks',P);
  bets.filter(b=>b.pid===id).forEach(b=>b.r=res||'p');SV('bets',bets);
  drawModel();
}
async function settle(){
  const P=LS('picks',[]);let ch=0;
  for(const k of P){
    if(k.res||k.man||new Date(k.ko).getTime()>Date.now()-3*36e5)continue;
    let f=null;try{f=await final(k.slug,k.ev)}catch{}
    if(!f||f.pending)continue; // Un dato no disponible no significa apuesta nula; queda pendiente para revisión manual.
    const ok=evalMk(k.mk,f.h,f.a,f.cor,f.crd,f.hh,f.ha);if(ok===null)continue;
    k.res=ok?'w':'l';k.sc=f.h+'-'+f.a;ch++;
    const b=bets.find(x=>x.pid===k.id);if(b)b.r=k.res;
  }
  SV('picks',P);SV('bets',bets);return ch;
}
const grp=n=>/^Córners/.test(n)?'Córners':/^Tarjetas/.test(n)?'Tarjetas':/^(Local|Visitante) (marca|deja)/.test(n)?'Goles de un equipo':/^Ambos/.test(n)?'Ambos marcan':/^(Over|Under|Goles)/.test(n)?'Goles totales':'Resultado';
function setMdlTab(t){mdlTab=t;mdlAll=false;drawModel()}
const delta=(h,p)=>{const d=h-p;return `<span class="delta ${d>=-3?'ok':d<-8?'bad':''}">${d>=0?'+':''}${d} pts</span>`};
function ringSvg(w,l){
  const n=w+l,f=n?w/n:0,C=2*Math.PI*42;
  return `<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${w} acertados y ${l} fallados"><circle cx="50" cy="50" r="42" style="fill:none;stroke:${n?'var(--bad)':'var(--ln)'};stroke-width:12"/>${n?`<circle cx="50" cy="50" r="42" style="fill:none;stroke:var(--ok);stroke-width:12" stroke-dasharray="${(f*C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>`:''}<text x="50" y="52" text-anchor="middle" class="rt">${n?Math.round(f*100)+'%':'—'}</text><text x="50" y="66" text-anchor="middle" class="rs">de acierto</text></svg>`;
}
function calSvg(D){
  const bk=[[0,.5],[.5,.6],[.6,.7],[.7,.8],[.8,1.01]];
  const pts=bk.map(([a,b])=>{const x=D.filter(k=>k.p>=a&&k.p<b);return x.length?{n:x.length,p:x.reduce((t,k)=>t+k.p,0)/x.length,h:x.filter(k=>k.res==='w').length/x.length}:null}).filter(Boolean);
  if(!pts.length)return '';
  const X=v=>34+v*240,Y=v=>166-v*146;
  const grid=[0,.25,.5,.75,1].map(v=>`<line x1="34" x2="274" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--ln);stroke-width:1"/><text x="28" y="${Y(v)+3}" text-anchor="end" class="ax">${Math.round(v*100)}</text>`).join('');
  const dots=pts.map(q=>{const d=q.h-q.p,c=d>=-.05?'var(--ok)':d<-.1?'var(--bad)':'var(--acc)';return `<circle cx="${X(q.p).toFixed(1)}" cy="${Y(q.h).toFixed(1)}" r="${5+Math.min(7,q.n/2)}" style="fill:${c};fill-opacity:.9;stroke:var(--card);stroke-width:2"/><text x="${X(q.p).toFixed(1)}" y="${(Y(q.h)+3.5).toFixed(1)}" text-anchor="middle" class="pn">${q.n}</text>`}).join('');
  return `<svg class="chart" viewBox="0 0 300 200" role="img" aria-label="Probabilidad prometida contra acierto real">${grid}<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" style="stroke:var(--mut);stroke-width:1.5;stroke-dasharray:4 4"/>${dots}<text x="154" y="194" text-anchor="middle" class="ax">Lo que prometía el modelo (%)</text><text transform="translate(9 96) rotate(-90)" text-anchor="middle" class="ax">Lo que acertó (%)</text></svg>`;
}
function profitSvg(bs){
  if(bs.length<2)return '';
  let c=0;const pts=[0,...bs.map(k=>c+=(k.res==='w'?(k.s||1)*(k.q-1):-(k.s||1)))];
  const mn=Math.min(...pts),mx=Math.max(...pts),rg=(mx-mn)||1,X=i=>20+i*260/(pts.length-1),Y=v=>110-(v-mn)/rg*90,last=pts[pts.length-1],col=last>=0?'var(--ok)':'var(--bad)';
  const d=pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  return `<svg class="chart" viewBox="0 0 300 130" role="img" aria-label="Evolución de la ganancia"><line x1="20" x2="280" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" style="stroke:var(--ln);stroke-dasharray:3 3"/><path d="${d}" style="fill:none;stroke:${col};stroke-width:2.5;stroke-linejoin:round"/><circle cx="${X(pts.length-1)}" cy="${Y(last).toFixed(1)}" r="4.5" style="fill:${col}"/></svg>`;
}
function drawModel(){
  const P=LS('picks',[]),D=P.filter(k=>(k.res==='w'||k.res==='l')&&!k.experimental),pend=P.filter(k=>!k.res).length;
  const nW=D.filter(k=>k.res==='w').length,nL=D.length-nW,nV=P.filter(k=>k.res==='v').length;
  if(mdlTab==='v'&&!nV)mdlTab='res';
  const hit=a=>a.length?Math.round(100*a.filter(k=>k.res==='w').length/a.length):0,pr=a=>a.length?Math.round(100*a.reduce((t,k)=>t+k.p,0)/a.length):0;
  const brier=D.length?D.reduce((t,k)=>t+Math.pow(k.p-(k.res==='w'?1:0),2),0)/D.length:null;
  const row=(t,a)=>a.length?rwRow(t,a.filter(k=>k.res==='w').length,a.length,pr(a)):'';
  const betsR=D.filter(k=>k.bet&&k.q),inv=betsR.reduce((t,k)=>t+(k.s||1),0),gan=betsR.reduce((t,k)=>t+(k.res==='w'?(k.s||1)*(k.q-1):-(k.s||1)),0);
  const bk=[[0,.5,'Menos de 50%'],[.5,.6,'50-60%'],[.6,.7,'60-70%'],[.7,.8,'70-80%'],[.8,1.01,'80% o más']];
  const gs=[...new Set(D.map(k=>grp(k.mk)))];
  const B=(k,r,t)=>`<button class="btn s ${k.res===r?'on':''}" onclick="setPick('${k.id}','${r}')">${t}</button>`;
  const item=k=>`<div class="bet"><div class="bet-h"><b>${esc(k.m)}</b><span class="st ${k.res||'p'}">${{w:'Acertó',l:'Falló',v:'Nulo'}[k.res]||'Pendiente'}</span></div>
  <small>${new Date(k.ko).toLocaleDateString('es',{day:'numeric',month:'short'})} · ${esc(k.mk)}${k.experimental?' · experimental (fuera de calibración)':''} · modelo ${Math.round(k.p*100)}%${k.q?' · cuota '+k.q+(k.qr?' (tuya)':' (de la casa)'):''}${Number.isFinite(+k.stake)?' · Stake '+k.stake+'/9':''}${k.nv?' · sin ventaja con tu cuota':''}${k.sc?' · marcador '+k.sc:''}${k.man?' · manual':''}</small>
  <div>${B(k,'w','Acertó')}${B(k,'l','Falló')}${B(k,'v','Nulo')}<button class="btn s" onclick="setPick('${k.id}',null)">↺</button><button class="btn s" onclick="delPick('${k.id}')">Borrar</button></div></div>`;
  const tabs=[['res','Resumen',''],['s','Stake',''],['w','Acertó',nW],['l','Falló',nL],['p','Pendientes',pend]];if(nV)tabs.push(['v','Nulos',nV]);
  const menu=`<div class="seg m" role="tablist" aria-label="Secciones del modelo">${tabs.map(([k,t,n])=>`<button type="button" role="tab" aria-selected="${mdlTab===k}" class="${mdlTab===k?'on':''}" onclick="setMdlTab('${k}')"><span>${t}</span>${n!==''?`<b class="${k==='w'?'ok':k==='l'?'bad':''}">${n}</b>`:''}</button>`).join('')}</div>`;
  let body='';
  const stakePicks=P.filter(k=>Number.isFinite(+k.stake)&&+k.stake>=1&&+k.stake<=9&&!k.experimental);
  const stakeSummary=`<div class="card stake-summary"><h2>Resultados por Stake</h2><p class="mut">Solo cuenta picks cuyo stake quedó guardado desde esta versión. Los picks antiguos sin stake no se inventan ni se clasifican.</p>${stakePicks.length?[1,2,3,4,5,6,7,8,9].map(st=>{const a=stakePicks.filter(k=>+k.stake===st),done=a.filter(k=>k.res==='w'||k.res==='l'),w=done.filter(k=>k.res==='w').length,l=done.length-w,pend=a.filter(k=>!k.res).length,markets=[...new Set(a.map(k=>k.mk))];if(!a.length)return '';const rate=done.length?Math.round(100*w/done.length):null;return `<div class="stake-row"><div class="stake-head"><b>Stake ${st}/9</b><span>${done.length?`${w} de ${done.length} aciertos · ${rate}%`:'Sin resultados resueltos'}</span></div><div class="stake-track"><i style="width:${rate==null?0:rate}%"></i></div><small>${l} fallos · ${pend} pendientes</small><div class="stake-markets">${markets.map(m=>`<span>${esc(m)} <b>${a.filter(k=>k.mk===m&&k.res==='w').length}✓ / ${a.filter(k=>k.mk===m&&k.res==='l').length}✕</b></span>`).join('')}</div></div>`}).join(''):'<p class="mut">Todavía no hay picks nuevos con stake guardado. Al usar «Registrar en Modelo» se empezará a medir.</p>'}</div>`;
  if(mdlTab==='res'){
    const gap=hit(D)-pr(D);
    const V=D.length<10?{t:'Aún sin conclusiones',d:`Faltan ${Math.max(0,30-D.length)} picks resueltos para sacar conclusiones. Mientras tanto no cambies reglas por rachas.`}
      :gap>=-3?{t:'Acierta lo que promete',d:'Las probabilidades del modelo parecen razonables. Confírmalo con el ROI.'}
      :gap>=-8?{t:'Algo optimista',d:'Acierta un poco menos de lo que dice. Conviene ser prudente con el stake.'}
      :{t:'Demasiado optimista',d:'Acierta bastante menos de lo que promete. No te fíes de sus probabilidades altas.'};
    const rec=[...D].sort((a,b)=>new Date(a.ko)-new Date(b.ko)).slice(-12).map(k=>`<i class="dot ${k.res==='w'?'G':'P'}">${k.res==='w'?'G':'P'}</i>`).join('');
    body=`<p class="status">Importante: el porcentaje de acierto por sí solo no demuestra rentabilidad. Evalúa el ROI con cuotas reales, suficientes picks y resultados verificados; no cambies reglas mirando solo los resultados recientes.</p><p class="status"><b>Cómo leer las barras:</b> el relleno es lo que realmente acertó; la marca negra vertical es lo que el modelo prometía. Si el relleno llega a la marca o la pasa, el modelo cumple.</p>
    ${engineCard()}
    <div class="card"><div class="vhero">${ringSvg(nW,nL)}<div><h2>${V.t}</h2><p>${V.d}</p></div></div>
    <div class="counts"><span><b class="ok">${nW}</b>acertó</span><span><b class="bad">${nL}</b>falló</span><span><b>${pend}</b>pendientes</span>${nV?`<span><b>${nV}</b>nulos</span>`:''}</div>
    <div class="prog" role="progressbar" aria-valuenow="${Math.min(30,D.length)}" aria-valuemin="0" aria-valuemax="30"><i style="width:${Math.min(100,Math.round(D.length/30*100))}%"></i></div>
    <small>${Math.min(30,D.length)} de 30 picks resueltos para sacar conclusiones</small>
    ${rec?`<div class="dots"><small>Últimos resultados (de más viejo a más nuevo)</small><br>${rec}</div>`:''}</div>
    <div class="tiles">
    <div class="tile"><small>Prometía</small><b>${D.length?pr(D)+'%':'—'}</b><span>probabilidad media</span></div>
    <div class="tile"><small>Acertó</small><b>${D.length?hit(D)+'%':'—'}</b><span>${D.length?delta(hit(D),pr(D)).replace('delta','delta'):'sin datos aún'}</span></div>
    <div class="tile"><small>Brier (menor es mejor)</small><b>${brier!=null?brier.toFixed(3):'—'}</b><span>0.25 equivale a adivinar</span></div>
    ${betsR.length?`<div class="tile"><small>ROI (apuestas)</small><b class="${gan>=0?'ok':'bad'}">${(100*gan/inv).toFixed(1)}%</b><span>${gan>=0?'+':''}${gan.toFixed(1)} unidades · ${betsR.length} apuestas</span></div>`:`<div class="tile"><small>ROI (apuestas)</small><b>—</b><span>registra apuestas para verlo</span></div>`}</div>
    ${D.length?`<div class="card"><h2>¿Acierta lo que promete?</h2><small>Cada círculo es un grupo de picks (el número es cuántos). Sobre la línea punteada: acierta lo que dice. Por debajo: es optimista. Verde bien, amarillo algo optimista, rojo muy optimista.</small>${calSvg(D)}</div>`:''}
    ${betsR.length>=2?`<div class="card"><h2>Evolución de la ganancia</h2><small>Suma de ganancias y pérdidas de tus apuestas registradas, en orden de fecha.</small>${profitSvg([...betsR].sort((a,b)=>new Date(a.ko)-new Date(b.ko)))}</div>`:''}
    ${D.length?`<div class="card"><h2>Por probabilidad</h2><small>Si el modelo dice 60%, de cada 10 picks debería acertar unos 6. Barra gris: lo que prometía. Barra de color: lo que acertó.</small>${bk.map(([x,y,t])=>row(t,D.filter(k=>k.p>=x&&k.p<y))).join('')}</div>
    <div class="card"><h2>Por tipo de mercado</h2><small>Dónde le va mejor y dónde peor.</small>${gs.map(g=>row(g,D.filter(k=>grp(k.mk)===g))).join('')}</div>
    <div class="card"><h2>Por liga</h2><small>Solo cuenta pronósticos guardados con liga; los antiguos sin ese dato aparecerán como Liga no guardada. Se necesitan muestras suficientes antes de sacar conclusiones.</small>${[...new Set(D.map(k=>k.liga||'Liga no guardada'))].sort().map(g=>row(g,D.filter(k=>(k.liga||'Liga no guardada')===g))).join('')}</div>
    <div class="card"><h2>ROI por mercado (apuestas reales registradas)</h2><small>Solo picks marcados como apuesta real, con cuota y resultado. No incluye pronósticos de seguimiento sin dinero.</small>${[...new Set(betsR.map(k=>grp(k.mk)))].map(g=>{const a=betsR.filter(k=>grp(k.mk)===g),st=a.reduce((t,k)=>t+(k.s||1),0),prf=a.reduce((t,k)=>t+(k.res==='w'?(k.s||1)*(k.q-1):-(k.s||1)),0);return `<div class="cal"><div class="cal-t"><span>${esc(g)}</span><span class="${prf>=0?'ok':'bad'}">${st?(100*prf/st).toFixed(1):'0.0'}% ROI · ${a.length} picks</span></div></div>`}).join('')||'<p class="mut">Todavía no hay apuestas reales resueltas.</p>'}</div>
    <div class="card"><h2>ROI por liga (apuestas reales registradas)</h2>${[...new Set(betsR.map(k=>k.liga||'Liga no guardada'))].map(g=>{const a=betsR.filter(k=>(k.liga||'Liga no guardada')===g),st=a.reduce((t,k)=>t+(k.s||1),0),prf=a.reduce((t,k)=>t+(k.res==='w'?(k.s||1)*(k.q-1):-(k.s||1)),0);return `<div class="cal"><div class="cal-t"><span>${esc(g)}</span><span class="${prf>=0?'ok':'bad'}">${st?(100*prf/st).toFixed(1):'0.0'}% ROI · ${a.length} picks</span></div></div>`}).join('')||'<p class="mut">Todavía no hay apuestas reales resueltas.</p>'}</div>
    <div class="card"><h2>Por nivel (A, B, C)</h2>${['A','B','C'].map(t=>row('Nivel '+t,D.filter(k=>k.t===t))).join('')}<small>Si el nivel A no acierta más que el C, el contraste con Pinnacle no está aportando.</small></div>`:`<p class="status">Aún no hay picks resueltos. Usa “Registrar en Modelo” desde cualquier partido para medir pronósticos sin apostar dinero, o registra apuestas reales por separado.</p>`}`;
  }else if(mdlTab==='s'){body=stakeTab(P)}else{
    const sel=mdlTab==='p'?P.filter(k=>!k.res):mdlTab==='v'?P.filter(k=>k.res==='v'):P.filter(k=>k.res===mdlTab);
    sel.sort((a,b)=>new Date(b.ko)-new Date(a.ko));
    const shown=mdlAll?sel:sel.slice(0,30);
    const T={w:['Picks que acertó','No hay picks acertados todavía.'],l:['Picks que falló','No hay picks fallados todavía.'],p:['Pendientes','No hay picks pendientes.'],v:['Picks nulos','No hay picks nulos.']}[mdlTab];
    const gc={};sel.forEach(k=>{const g=grp(k.mk);gc[g]=(gc[g]||0)+1});
    body=`<div class="card"><h2>${T[0]} <small>(${sel.length})</small></h2>
    ${mdlTab==='p'?'<small>Se resuelven solos unas 3 horas después del partido. Los córners y tarjetas pueden quedar pendientes si ESPN no publica esas estadísticas: márcalos tú si ya sabes el resultado. ↺ devuelve a automático.</small>':'<small>Si algún resultado está mal, corrígelo con los botones de cada pick.</small>'}
    ${sel.length&&mdlTab!=='p'?`<div class="mchips">${Object.entries(gc).sort((a,b)=>b[1]-a[1]).map(([g,n])=>`<span>${g} <b>${n}</b></span>`).join('')}</div>`:''}
    ${shown.map(item).join('')||`<p class="mut">${T[1]}</p>`}
    ${sel.length>30&&!mdlAll?`<button class="btn s" style="width:100%" onclick="mdlAll=true;drawModel()">Mostrar los ${sel.length}</button>`:''}</div>`;
  }
  $('#mdl').innerHTML=menu+`<button class="btn" id="mrf">Actualizar resultados</button>`+body;
  $('#mrf').onclick=refreshModel;
}
async function refreshModel(){
  drawModel();const b=$('#mrf');if(b){b.disabled=true;b.textContent='Buscando resultados…'}
  try{await settle()}catch{}
  drawModel();
}

// registro
function reg(i){
  const r=R[i],m=($('#mk'+i).value||r.pk||'').trim(),q=+$('#od'+i).value||(r.q&&r.q[m])||0,s=+$('#sk'+i).value||r.sk||0;
  if(!q||!s||!m){toast('Escribe mercado, cuota y monto.');return}
  const pm=(r.mod.m.find(x=>x[0]===m)||[0,0])[1];
  if(isHalfMarket(m)){if(!confirm('Este mercado usa una estimación experimental no validada. Registrar solo para seguimiento, no como recomendación de apuesta. ¿Continuar?'))return;}
  else if(pm*q-1<0.05||pm*q-1>0.25){if(!confirm('El valor estimado está fuera del rango prudente de 5%-25%. ¿Registrar solo para seguimiento?'))return;}
  const pid=addPick(r,m,q,s,true);
  bets.unshift({id:Date.now(),m:R[i].m+' · '+m,q,s,r:'p',pid});SV('bets',bets);toast('Apuesta registrada.');
}
$('#add').onclick=()=>{
  const m=prompt('Partido y mercado');if(!m)return;
  const q=+prompt('Cuota'),s=+prompt('Monto');if(!q||!s)return;
  bets.unshift({id:Date.now(),m,q,s,r:'p'});SV('bets',bets);drawBets()};
function setR(id,r){
  const b=bets.find(x=>x.id===id);b.r=r;SV('bets',bets);
  if(b.pid){const P=LS('picks',[]),k=P.find(x=>x.id===b.pid);if(k){k.res=r==='p'?null:r;k.man=r!=='p';SV('picks',P)}}
  drawBets();
}
function delB(id){if(confirm('¿Borrar esta apuesta?')){bets=bets.filter(b=>b.id!==id);SV('bets',bets);drawBets()}}
let betTab='p';
function setBetTab(t){betTab=t;drawBets()}
function drawBets(){
  const done=bets.filter(b=>b.r==='w'||b.r==='l'),nP=bets.filter(b=>b.r==='p').length,nW=bets.filter(b=>b.r==='w').length,nL=bets.filter(b=>b.r==='l').length,nV=bets.filter(b=>b.r==='v').length;
  const gan=done.reduce((a,b)=>a+(b.r==='w'?b.s*(b.q-1):-b.s),0),stk=done.reduce((a,b)=>a+b.s,0);
  const ac=done.length?Math.round(100*done.filter(b=>b.r==='w').length/done.length):0;
  $('#sum').innerHTML=`<div class="hero"><small>Ganancia neta</small><div class="big ${gan>=0?'ok':'bad'}">${gan>=0?'+':''}${Math.round(gan).toLocaleString('es')}</div>
  <div class="sub"><span><b>${done.length}</b>resueltas</span><span><b>${ac}%</b>acierto</span><span><b>${stk?(100*gan/stk).toFixed(1):0}%</b>ROI</span><span><b>${nP}</b>pendientes</span></div></div>`;
  if(betTab==='p'&&!nP&&bets.length)betTab='all';
  const tabs=[['p','Pendientes',nP],['w','Ganadas',nW],['l','Perdidas',nL],['all','Todas',bets.length]];if(nV)tabs.splice(3,0,['v','Nulas',nV]);
  const menu=`<div class="seg m" role="tablist" aria-label="Filtrar apuestas">${tabs.map(([k,t,n])=>`<button type="button" role="tab" aria-selected="${betTab===k}" class="${betTab===k?'on':''}" onclick="setBetTab('${k}')"><span>${t}</span><b class="${k==='w'?'ok':k==='l'?'bad':''}">${n}</b></button>`).join('')}</div>`;
  const sel=(betTab==='all'?bets:bets.filter(b=>b.r===betTab)).slice().sort((a,b)=>b.id-a.id);
  const item=b=>`<div class="bet"><div class="bet-h"><b>${esc(b.m)}</b><span class="st ${b.r}">${{p:'Pendiente',w:'Ganó',l:'Perdió',v:'Nula'}[b.r]}</span></div>
  <small>Cuota ${b.q} · Monto ${b.s.toLocaleString('es')}${b.r==='w'?' · ganancia +'+Math.round(b.s*(b.q-1)).toLocaleString('es'):b.r==='l'?' · pérdida −'+b.s.toLocaleString('es'):''}</small>
  <div>${b.r==='p'?`<button class="btn s" onclick="setR(${b.id},'w')">Ganó</button><button class="btn s" onclick="setR(${b.id},'l')">Perdió</button><button class="btn s" onclick="setR(${b.id},'v')">Nula</button>`:`<button class="btn s" onclick="setR(${b.id},'p')">↺ Pendiente</button>`}<button class="btn s" onclick="delB(${b.id})">Borrar</button></div></div>`;
  $('#bets').innerHTML=bets.length?menu+`<div class="card">${sel.map(item).join('')||'<p class="mut">No hay apuestas en esta sección.</p>'}</div>`
    :'<div class="empty"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="8" width="36" height="48" rx="5"/><path d="M23 22h18M23 32h18M23 42h10"/></svg><b>Sin apuestas todavía</b>Las que registres desde las tarjetas aparecerán aquí.</div>';
}
// ===== Copia de seguridad de RadarPi: exporta todas las claves locales =====
const SECRETS=['gq','gk','or','br','ok','af'];
const NB_SECRETS=['keys','sgo','bdl'];   // llaves dentro de los ajustes NBA (nbcfg)
const BACKUP_KEYS=['picks','bets','cfg','seen','scan','nbapicks','combipicks','nbcfg'];
function exportRadarBackup(){
  const msg=$('#backupMsg');
  try{
    const storage={};
    for(const k of BACKUP_KEYS){
      let v=localStorage.getItem(k);if(v===null)continue;
      if(k==='cfg'){try{const c=JSON.parse(v);SECRETS.forEach(x=>{c[x]=''});v=JSON.stringify(c)}catch{continue}}   // las llaves de API nunca salen en el archivo
      if(k==='nbcfg'){try{const c=JSON.parse(v);NB_SECRETS.forEach(x=>{c[x]=''});v=JSON.stringify(c)}catch{continue}}
      storage[k]=v;
    }
    if(!Object.keys(storage).length){msg.textContent='No se encontraron datos guardados para respaldar.';return;}
    const data={app:'Radar de patrones',format:3,createdAt:new Date().toISOString(),note:'No incluye llaves de API ni cachés.',storage};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='radarpi-copia-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    try{localStorage.setItem('radarpi_backup_last_export',new Date().toISOString())}catch{}
    const cnt=k=>{try{return JSON.parse(storage[k]||'[]').length}catch{return 0}},np=cnt('picks'),nb=cnt('bets'),nn=cnt('nbapicks'),nc=cnt('combipicks');
    msg.textContent='Copia preparada: '+np+' picks de fútbol, '+nn+' de NBA, '+nc+' de combi y '+nb+' apuestas, sin tus llaves de API. Verifica que el JSON aparezca en Descargas y guárdalo fuera de Chrome.';
  }catch(e){msg.textContent='No se pudo crear la copia: '+(e&&e.message?e.message:'error desconocido');}
}
$('#backupOut').addEventListener('click',exportRadarBackup);
$('#backupInBtn').addEventListener('click',()=>$('#backupFile').click());
$('#backupFile').addEventListener('change',async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  const msg=$('#backupMsg');
  try{
    const data=JSON.parse(await file.text());
    if(data.app!=='Radar de patrones')throw new Error('El archivo no parece una copia de RadarPi.');
    // Compatibilidad con las copias previas (format 1/storage o entries) y la nueva.
    const source=(data.storage&&typeof data.storage==='object')?data.storage:
      ((data.entries&&typeof data.entries==='object')?data.entries:null);
    if(!source||Array.isArray(source))throw new Error('La copia no contiene datos reconocidos.');
    const pairs=Object.entries(source).filter(([k,v])=>typeof k==='string'&&k.length>0&&(typeof v==='string'||v===null));
    if(!pairs.length)throw new Error('La copia está vacía o tiene un formato no compatible.');
    if(!confirm('Se restaurarán los datos de la copia (picks, apuestas y ajustes). Las llaves de API que ya tienes se conservan. Los datos actuales con el mismo nombre serán reemplazados. Se recomienda exportar primero una copia del estado actual. ¿Continuar?'))return;
    for(const [k,v] of pairs){
      if(!BACKUP_KEYS.includes(k)&&!/^(picks|bets|cfg|seen|scan|nbapicks|combipicks|nbcfg)$/.test(k)&&data.format>=3)continue;
      if(v===null){localStorage.removeItem(k);continue}
      if(k==='cfg'){   // conserva las llaves de API que ya tienes en este dispositivo
        try{const nw=JSON.parse(v),cur=JSON.parse(localStorage.getItem('cfg')||'{}');SECRETS.forEach(x=>{if(!nw[x]&&cur[x])nw[x]=cur[x]});localStorage.setItem('cfg',JSON.stringify(nw));continue}catch{}
      }
      if(k==='nbcfg'){   // conserva las llaves de The Odds API de este dispositivo
        try{const nw=JSON.parse(v),cur=JSON.parse(localStorage.getItem('nbcfg')||'{}');NB_SECRETS.forEach(x=>{if(!nw[x]&&cur[x])nw[x]=cur[x]});localStorage.setItem('nbcfg',JSON.stringify(nw));continue}catch{}
      }
      localStorage.setItem(k,v);
    }
    msg.textContent='Restauración completada ('+pairs.length+' claves). RadarPi se recargará.';
    setTimeout(()=>location.reload(),900);
  }catch(err){msg.textContent='No se pudo restaurar la copia: '+(err&&err.message?err.message:'archivo inválido');}
  finally{e.target.value='';}
});
// Recordatorio al abrir la app; el archivo debe guardarse fuera del almacenamiento del navegador.
setTimeout(()=>{
  try{
    const last=localStorage.getItem('radarpi_backup_last_export');
    const age=last?Date.now()-Date.parse(last):Infinity;
    if(!Number.isFinite(age)||age>7*24*60*60*1000){
      const msg=$('#backupMsg');
      if(msg)msg.textContent='Recordatorio: no consta una copia descargada en los últimos 7 días. Pulsa “Descargar copia de seguridad” y conserva el JSON fuera de Chrome.';
    }
  }catch{}
},1500);

// ===== Alertas dentro de la app (funcionan con la app abierta) =====
function afterScan(){
  const S=LS('seen',null),k=(S&&S.d===today())?S.k:[],fresh=R.filter(r=>!k.includes(r.ev));
  SV('seen',{d:today(),k:[...new Set([...k,...R.map(r=>r.ev)])]});
  if(autoRun&&fresh.length)notify(fresh);
}
function beep(){
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const a=notify.a||(notify.a=new C()),o=a.createOscillator(),g=a.createGain();
  o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=.15;o.start();o.stop(a.currentTime+.25);
}
function notify(f){
  toast('🔔 Alertas nuevas: '+f.slice(0,3).map(r=>r.m).join(' · ')+(f.length>3?' +'+(f.length-3):''),7000);
  try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch{}
  try{beep()}catch{}
  try{document.querySelector('nav button[data-t="f"]').classList.add('dot');document.title='('+f.length+') Radar de patrones'}catch{}
}
(function loop(){
  setTimeout(()=>{
    if(cfg.aa&&!$('#go').disabled&&cfg.lg.length){autoRun=true;$('#go').click()}
    loop();
  },Math.max(15,cfg.iv||60)*6e4);
})();

$('#hunt').onclick=()=>{if($('#go').disabled)return;hunt=true;$('#go').click()};

(function(){
  const sv=LS('scan',null);
  if(sv&&sv.d===today()){R=sv.R;$('#msg').textContent=sv.msg+' (guardado '+new Date(sv.t).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})+')';drawRes()}
  if(cfg.au&&(!sv||sv.d!==today()||Date.now()-sv.t>3*36e5))$('#go').click();
})();

(function(){const root=document.getElementById('res');if(!root)return;
  const fix=()=>root.querySelectorAll('.tp .ai:not([hidden])').forEach(b=>{
    let btn=b.nextElementSibling&&b.nextElementSibling.classList.contains('clipbtn')?b.nextElementSibling:null;
    if(!btn){btn=document.createElement('button');btn.type='button';btn.className='btn s clipbtn';btn.onclick=()=>{b.classList.toggle('open');fix()};b.after(btn)}
    if(!b.classList.contains('open'))b.classList.add('clip');
    const open=b.classList.contains('open');btn.hidden=!open&&b.scrollHeight<=b.clientHeight+8;btn.textContent=open?'Recoger ▲':'Ver todo ▼'});
  new MutationObserver(()=>{clearTimeout(fix.t);fix.t=setTimeout(fix,60)}).observe(root,{childList:true,subtree:true,characterData:true});
})();

// Ligas de Combi (independientes de Fútbol) + NBA
const lgn0=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function drawCl(){const sel=Array.isArray(cfg.cl)?cfg.cl:cfg.lg,q=lgn0(($('#clq')||{}).value||'');
  $('#cl').innerHTML=[['🏀 NBA','nba'],...Object.entries(LG)].filter(([n])=>lgn0(n).includes(q)).map(([n,id])=>`<button class="chip ${sel.includes(id)?'on':''}" data-id="${id}">${n}</button>`).join('');
  document.querySelectorAll('#cl .chip').forEach(b=>b.onclick=()=>{const cur=(Array.isArray(cfg.cl)?cfg.cl:cfg.lg).slice(),id=b.dataset.id;cfg.cl=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];SV('cfg',cfg);drawCl()})}
drawCl();$('#clq').oninput=drawCl;

document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'.alts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.alts small{width:100%;color:var(--mut);font-size:12px}.alts span{background:var(--s2);border:1px solid var(--ln);border-radius:10px;padding:5px 8px;font-size:12.5px}.tk.safe{border-style:dashed;margin-top:10px}'}));

// Limpieza única de cachés de historial guardadas por versiones anteriores (podían tener «sin liga local» o 2 partidos guardados)
try{if(!LS('purge2',0)){Object.keys(localStorage).filter(k=>k==='DOM3'||k==='DOMT'||k.startsWith('Y4')||k.startsWith('Y2')).forEach(k=>localStorage.removeItem(k));SV('purge2',1)}}catch{}
