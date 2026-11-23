import {proposalContext} from './formation-lab-search.mjs';
const modes=['balanced','late','early','hold','fire','survival','spread','cluster'];
const bosses=['boss_1','boss_2','boss_3','boss_4','boss_6','boss_7','boss_11','boss_12','boss_13','boss_17'];
const kindNames=['incumbent','single','joint','multi-1','multi-2','multi-4','reserve','alternate-incumbent-bank','cross','other'];
const hash=(s,n)=>{let h=2166136261;for(const ch of s)h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0)%n;};
const bounded=(x,max)=>Math.max(-max,Math.min(max,x));
const center=g=>g[1]*32+g[2];
export function createFormationFeatures(gd,c,staticTrace,base,existingContext){
 const ctx=existingContext||proposalContext(gd,c,staticTrace),own=c.own;
 const boss=c.s.boss,band=c.s.band,baseMap=new Map(base.map(g=>[g[0],g]));
 const global=[...bosses.map(b=>Number(b===boss)),Number(['boss_2','boss_13','boss_17'].includes(boss)),
   ...['band_mech','band_fund','band_amiya','band_jesica','band_siracusa'].map(k=>Number(k===band)),
   own.lp/32,c.s.level/6,c.s.cap/8,c.s.pieces.filter(p=>p[2]==='chess'&&p[3]!=='b').length/8];
 const bank=new Map(),role=u=>u.heal?3:u.guard?2:u.melee?1:u.rec.dmgType==='arts'?4:0;
 function descriptor(plan){
   const signature=plan.map(g=>g.join('/')).sort().join('|');if(bank.has(signature))return bank.get(signature);
   const actors=plan.flatMap(g=>{const u=ctx.units.get(g[0]),t=ctx.get(g);return u&&t?[{g,t,u}]:[];});
   const groups=Array.from({length:6},()=>Array(8).fill(0));const atlas=Array(16).fill(0);const bonds=new Map();
   const coverage=[],list=new Map();
   for(const {t,u,g} of actors){
     const support=actors.reduce((x,o)=>x+(o.u.heal&&o.t.hit.has(t.k)?o.u.dps:0),0);
     const scopes=u.scopes,items=u.p.items?.length||0;
     const d=[1,u.dps,u.dps*t.cover,u.dps*t.late,u.guard*u.tank*t.block,support*(.15+t.risk),t.risk*u.dps/Math.max(.5,u.tank),items];
     const unitRole=role(u);for(const j of [unitRole,5])d.forEach((x,k)=>groups[j][k]+=.25*x);
     const strength=u.dps*(u.heal?0:t.cover);
     coverage.push(strength);atlas[hash(u.p.id,atlas.length)]+=.2*(strength+u.tank*.04);
     for(const bond of u.rec.bonds||[])bonds.set(bond,(bonds.get(bond)||0)+1);
     list.set(g[0],{d,role:unitRole,power:u.dps,risk:t.risk,cover:t.cover,block:t.block,support,scopes,elite:Number(u.p.golden),items,id:u.p.id});
   }
   coverage.sort((a,b)=>b-a);
   const stats=[...modes.map(m=>ctx.totalScore(plan,m)/5),...groups.flat(),...coverage.slice(0,4),...Array(Math.max(0,4-coverage.length)).fill(0),
     ...atlas,Math.min(4,[...bonds.values()].filter(v=>v>=2).length)/4,Math.min(4,[...bonds.values()].filter(v=>v>=3).length)/4,
     Math.min(4,[...bonds.values()].filter(v=>v>=4).length)/4,Math.max(0,...bonds.values())/6];
   const ret={stats,list};bank.set(signature,ret);return ret;
 }
 const origin=descriptor(base),groups=origin.stats.length;
 return candidate=>{
   const p=candidate.p,after=descriptor(p),diff=after.stats.map((x,i)=>bounded(x-origin.stats[i],8));
   const changes=[],removed=Array.from(origin.list.keys()).filter(uid=>!after.list.has(uid));const ids=Array(48).fill(0);
   let changed=0,turns=0,swaps=0,steps=0;
   const boardCells=new Map(base.map(g=>[center(g),g[0]]));
   for(const g of p){
     const u=after.list.get(g[0]);if(!u)continue;let old=baseMap.get(g[0]),prior=origin.list.get(g[0]);let incoming=0;
     if(!old){
       let rem=removed.find(x=>baseMap.get(x)&&center(baseMap.get(x))===center(g))??removed[0];
       old=rem!=null?baseMap.get(rem):null;prior=rem!=null?origin.list.get(rem):null;
       if(rem!=null)removed.splice(removed.indexOf(rem),1);incoming=1;swaps++;
     }
     if(!old||!prior)continue;
     const dist=Math.hypot(old[1]-g[1],old[2]-g[2]),turn=old[3]!==g[3];
     if(!incoming&&!turn&&dist===0)continue;
     changed++;turns+=turn;steps+=dist;
     const a=u.power*u.cover-prior.power*prior.cover;
     ids[hash('in/'+u.id,48)]+=.25*(a+incoming);ids[hash('out/'+prior.id,48)]+=.25*(a-incoming);
     changes.push({rank:Math.abs(a)+incoming*.5+dist*.06,x:[incoming,dist/6,Number(turn),prior.power/3,u.power/3,
       prior.cover,u.cover,u.cover-prior.cover,u.risk-prior.risk,(u.support-prior.support)/4,u.block-prior.block,
       prior.elite,u.elite,(u.items-prior.items)/4,(u.scopes-prior.scopes)/4,...[0,1,2,3,4].map(k=>Number(k===u.role))]});
   }
   changes.sort((a,b)=>b.rank-a.rank);
   const moves=Array.from({length:3},(_,i)=>changes[i]?.x||Array(20).fill(0)).flat();
   const kind=kindNames.includes(candidate.kind)?candidate.kind:'other';
   return [...global,...kindNames.map(k=>Number(k===kind)),...modes.map(m=>Number(m===candidate.mode)),
     changed/8,turns/8,swaps/4,steps/30,bounded(candidate.raw||0,18)/5,...origin.stats,...diff,...moves,...ids];
 };
}
