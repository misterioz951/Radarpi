/* RadarPi · modelo_backend.js — usa EXACTAMENTE los parámetros del backtest (model_params, calibration_params, devig_selection, model_version).
   Seguridad: los 4 archivos deben pertenecer a la misma corrida (hash SHA-256 de cada uno dentro de model_version.json). Si no coinciden, no se usa nada.
   Modo SOMBRA: calcula y registra las probabilidades validadas; las decisiones de picks/stakes siguen con el motor actual hasta que la regla de decisión del reporte lo autorice. */
(()=>{'use strict';
const FILES=['model_params.json','calibration_params.json','devig_selection.json','model_version.json'],HASHED=FILES.slice(0,3);
const DIV={'eng.1':'E0','eng.2':'E1','esp.1':'SP1','ita.1':'I1','ger.1':'D1','fra.1':'F1','ned.1':'N1','por.1':'P1','bel.1':'B1','sco.1':'SC0','tur.1':'T1','gre.1':'G1'};
const MK={'Local gana':['1X2',0],'Empate':['1X2',1],'Visitante gana':['1X2',2],'Over 2.5':['OU25',0],'Under 2.5':['OU25',1]};
let S={ok:false,err:'Aún no se cargaron los parámetros del backend.'};
const $=s=>document.querySelector(s);
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function adopt(texts,opt={}){try{
  for(const n of FILES)if(typeof texts[n]!=='string')throw new Error('falta '+n);
  const V=JSON.parse(texts['model_version.json']);
  for(const n of HASHED)if(await sha(texts[n])!==V.files[n])throw new Error(n+' no coincide con el hash de model_version.json: los archivos son de corridas distintas o fueron modificados');
  const P=JSON.parse(texts['model_params.json']),C=JSON.parse(texts['calibration_params.json']),D=JSON.parse(texts['devig_selection.json']);
  for(const o of[P,C,D])if(o.model_version!==V.model_version)throw new Error('versión de modelo distinta entre archivos');
  if(V.data_source==='SYNTHETIC'&&!opt.allowSynthetic)throw new Error('Son parámetros de prueba (datos sintéticos): no se usan.');
  S={ok:true,P,C,D,V,sha:(await sha(texts['model_params.json'])).slice(0,12)}}catch(e){S={ok:false,err:e.message}}return S}
// ---- Dixon-Coles: misma matriz que Python (maxg, corrección de marcadores bajos, normalización) ----
const pmf=(l,n)=>{const o=[Math.exp(-l)];for(let k=1;k<=n;k++)o.push(o[k-1]*l/k);return o};
function dc(L,maxg,h,a){const lh=Math.exp(L.g+h[0]-a[1]),la=Math.exp(a[0]-h[1]),ph=pmf(lh,maxg),pa=pmf(la,maxg),rho=L.rho,t=Math.max;
  const tau={'0,0':t(1-lh*la*rho,1e-6),'0,1':t(1+lh*rho,1e-6),'1,0':t(1+la*rho,1e-6),'1,1':t(1-rho,1e-6)};let s=0,w=0,d=0,l=0,o=0;
  for(let i=0;i<=maxg;i++)for(let j=0;j<=maxg;j++){const p=ph[i]*pa[j]*(tau[i+','+j]||1);s+=p;if(i>j)w+=p;else if(i===j)d+=p;else l+=p;if(i+j>=3)o+=p}
  return{p1x2:[w/s,d/s,l/s],over25:o/s}}
const sm=z=>{const m=Math.max(...z),e=z.map(x=>Math.exp(x-m)),s=e.reduce((a,b)=>a+b,0);return e.map(x=>x/s)};
function calApply(market,league,raw){const G=S.C.groups,g=G.find(x=>x.level==='liga+mercado'&&x.league===league&&x.market===market)||G.find(x=>x.level==='mercado'&&x.market===market);
  if(!g)return{p:raw.slice(),level:'global_identidad',n:0};
  if(g.type==='temperature')return{p:sm(raw.map(x=>Math.log(Math.min(Math.max(x,1e-9),1))/g.params[0])),level:g.level,n:g.n};
  const q=Math.min(Math.max(raw[0],1e-6),1-1e-6),r=1/(1+Math.exp(-(g.params[0]*Math.log(q/(1-q))+g.params[1])));return{p:[r,1-r],level:g.level,n:g.n}}
function team(L,name){if(L.teams[name])return L.teams[name];const same=window.RadarSrc&&RadarSrc.same;if(!same)return null;const h=Object.keys(L.teams).filter(t=>same(t,name));return h.length===1?L.teams[h[0]]:null}
function predict(div,home,away){if(!S.ok)return null;const L=S.P.leagues[div];if(!L)return null;const h=team(L,home),a=team(L,away);if(!h||!a)return null;
  const m=dc(L,S.P.maxg,h,a),c1=calApply('1X2',div,m.p1x2),c2=calApply('OU25',div,[m.over25,1-m.over25]);return{p1x2:m.p1x2,over25:m.over25,cal1x2:c1.p,cal_level_1x2:c1.level,calou:c2.p,cal_level_ou:c2.level,trained_through:L.trained_through}}
function forPick(r,mk){if(!S.ok||!r||!MK[mk])return null;const div=DIV[r.slug];if(!div)return null;const p=predict(div,r.h,r.w);if(!p)return null;const[m,i]=MK[mk];
  return{model_version:S.V.model_version,params_sha:S.sha,market:m,selection:mk,p_raw:m==='1X2'?p.p1x2[i]:[p.over25,1-p.over25][i],p_calibrated:m==='1X2'?p.cal1x2[i]:p.calou[i],calib_level:m==='1X2'?p.cal_level_1x2:p.cal_level_ou,div,trained_through:p.trained_through}}
// ---- carga: archivos importados (IndexedDB) o carpeta ./backend_params/ ----
async function load(){try{const kv=window.RadarSrc&&RadarSrc.kvGet,saved=kv&&await kv('bk_files');if(saved&&await adopt(saved).then(s=>s.ok))return S;
  const t={};for(const n of FILES){const r=await fetch('backend_params/'+n,{cache:'no-cache'});if(!r.ok)throw new Error('no hay carpeta backend_params/ ni archivos importados');t[n]=await r.text()}await adopt(t)}catch(e){if(!S.ok)S={ok:false,err:e.message}}return S}
function show(){const el=$('#bk-status');if(!el)return;if(!S.ok){el.textContent='Sin modelo validado: '+S.err;return}const d=S.V.decision||{};
  el.textContent='✓ '+S.V.model_version+' · datos '+S.V.data_source+' · entrenado hasta '+S.V.trained_through+' · huella '+S.sha+' · calibración: '+S.C.groups.length+' grupos · de-vig: '+S.D.selected_method+' · ensemble/Kelly habilitado: 1X2 '+(d['1X2']?'sí':'no')+', O/U '+(d.OU25?'sí':'no')+' · modo sombra'}
window.RadarBackend={status:()=>S,adopt,load,predict,forPick};
const init=async()=>{await load();show();const f=$('#bk-files');
  if(f)f.onchange=async()=>{const t={};for(const x of f.files)t[x.name]=await x.text();const s=await adopt(t);if(s.ok&&window.RadarSrc)await RadarSrc.kvSet('bk_files',t);show()};
  const b=$('#bk-reload');if(b)b.onclick=async()=>{await load();show()}};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
