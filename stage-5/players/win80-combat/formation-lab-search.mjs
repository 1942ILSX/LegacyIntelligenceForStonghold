import {diyRecord,diySlot} from '../../engine/v0.4.0/shared/diy.js';
import {attackRangeGrid,loadoutRecord,resolveRecordLoadout} from '../../engine/v0.4.0/shared/loadoutRecord.js';
import {resolveLoadout} from '../../engine/v0.4.0/shared/protocol.js';
import {rotateOffset} from '../../engine/v0.4.0/server/sim/dir.js';
const dirs=['RIGHT','UP','LEFT','DOWN'];
const key=(r,c)=>r*32+c;
const sig=goals=>goals.map(g=>g.join('/')).sort().join('|');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const weightProfiles={
 balanced:[.7,.45,.85,.70,.65],late:[2.4,.25,.80,.50,.55],early:[-.70,.35,.70,.60,.60],
 hold:[.7,2.0,1.4,1.15,.65],fire:[.9,.1,.2,.2,.85],survival:[.3,.7,2.0,1.60,.6],
 spread:[.5,.55,.7,.85,1.9],cluster:[.8,.45,1.3,.9,-.30]
};
export function proposalContext(gd,c,trace){
 const own=c.own,s=c.s,units=new Map(),all=new Map([...own.board,...own.hand,...own.temp].filter(Boolean).map(p=>[p.uid,p]));
 const tileTypes=new Map(s.tiles.map(([r,col,t])=>[key(r,col),t])),profiles=new Map();
 for(const [slot,pick] of Object.entries(own.diy||{})){
  const a=diySlot(slot,gd.raw);
  for(const elite of [false,true])profiles.set(elite?a.goldenId:slot,diyRecord(slot,pick,{data:gd.raw,elite}));
 }
 const record=id=>profiles.get(id)||gd.chess(id);
 const total=Math.max(1,trace.steps||trace.poses.reduce((a,x)=>a+x.n,0));
 const medWeight=Object.values(trace.credits||{}).sort((a,b)=>a-b).at(-1)||.2;
 for(const p of all.values()){
  if(p.kind!=='chess')continue;
  const source=record(p.id);if(!source)continue;
  const u=loadoutRecord(source,resolveRecordLoadout(source,resolveLoadout(own.loadout||{},source,record)));
  const attack=attackRangeGrid(u)||[[0,0]],skill=u.skill?.rangeGrid||attack;
  const q=u.stats||{},melee=u.position==='MELEE',heal=u.attackKind==='heal',guard=melee&&(q.blockCnt||0)>0;
  const scopes=(p.items||[]).filter(v=>v.id.includes('_3_02_e_')).reduce((a,i)=>a*(i.id.endsWith('_b')?1.5:1.3),1);
  const base=clamp((q.atk||200)/Math.max(.36,q.bat||1)*(q.aspd||100)/100/480,.15,4.5);
  const observed=clamp((trace.credits?.[p.uid]||0)/Math.max(.06,medWeight),0,1.5);
  const dps=base*(1+.18*(p.items?.length||0))*(1+.06*(p.tier||0))*(1+.26*observed);
  const tank=clamp((q.maxHp||1000)/3000*(1+(q.def||0)/900),.12,4);
  const bonus=p.id.includes('chess_char_5_22_')?1.3:1;
  const entries=[],look=new Map();
  for(const cell of s.legal[p.uid]||[]){
    const [r,col]=cell.split(',').map(Number);
    for(const dir of dirs){
      const tiles=grid=>new Set(grid.map(([a,b])=>{const [dr,dc]=rotateOffset(a,b,dir);return key(r+dr,col+dc);}));
      const hit=tiles(attack),aoe=tiles(skill);let n=0,l=0,block=0,early=0,risk=0;
      for(const t of trace.poses){
        const dist=Math.hypot(t.x-col,t.y-r),scope=dist>=3-1e-7?scopes:1;
        const cover=t.keys.some(k=>hit.has(k)),cast=t.keys.some(k=>aoe.has(k));
        const val=(.74*Number(cover)+.26*Number(cast))*scope;
        n+=val*t.n;l+=val*t.n*t.late;early+=val*t.n*(1-t.late);
        block+=t.n*Number(dist<=.9);
        risk+=t.n*clamp((2.4-dist)/2.4,0,1);
      }
      const g=[p.uid,r,col,dir],v={g,k:key(r,col),hit,aoe,cover:n/total,late:l/total,early:early/total,
        block:block/total,risk:risk/total,orient:dir};
      entries.push(v);look.set(g.slice(1).join('/'),v);
    }
  }
  units.set(p.uid,{p,rec:u,heal,guard,melee,dps:dps*bonus,tank,scopes,entries,look,observed});
 }
 const ownerByToken=new Map([...all.values()].filter(p=>p.kind==='token').map(p=>[p.uid,p.ownerUid]));
 const get=g=>units.get(g[0])?.look.get(g.slice(1).join('/'));
 function personal(unit,t,mode){
  const [late,hold,,care]=weightProfiles[mode];
  const fire=(t.cover+late*t.late)/(1+Math.max(0,late)*.30);
  return unit.heal?(.035*fire-.11*t.risk*care):
    unit.dps*(fire+.025)+unit.guard*hold*unit.tank*t.block-
    care*t.risk*(unit.melee?.025:.10)*Math.min(2.6,unit.dps/unit.tank);
 }
 function totalScore(plan,mode){
  const [,hold,heal,care,spread]=weightProfiles[mode];
  const list=plan.flatMap(g=>{const u=units.get(g[0]),t=get(g);return u&&t?[{u,t}]:[];});
  let sc=0;
  for(const {u,t} of list){
    sc+=personal(u,t,mode);
    let healing=0,neighbors=0,tinBlast=0;
    for(const {u:v,t:q} of list){
      if(v===u)continue;
      if(v.heal&&q.hit.has(t.k))healing+=v.dps;
      const d=Math.hypot(q.g[1]-t.g[1],q.g[2]-t.g[2]);
      if(d<1.65)neighbors++;
      if(v.p.id.startsWith('chess_char_5_22_')&&q.hit.has(t.k))tinBlast+=.22*v.dps;
    }
    const danger=t.risk+.20*u.guard;
    sc+=heal*.22*Math.min(2.5,healing)*danger*(.25+u.dps*.55+hold*u.tank*t.block);
    if(u.heal)sc-=.11*care*t.risk;
    sc-=spread*neighbors*.017*(.3+t.risk)*Math.min(3,u.dps);
    sc-=tinBlast*(.25+u.dps*.20);
  }
  return sc;
 }
 return {units,all,get,personal,totalScore,ownerByToken,tileTypes};
}
export function searchProposals(c,trace,gd,origin,{width=70,round=0}={}){
 const ctx=proposalContext(gd,c,trace),{units,personal,totalScore}=ctx;
 const proposals=[],seen=new Set([sig(origin)]);
 const pinned=new Set(origin.flatMap(g=>ctx.ownerByToken.has(g[0])?[g[0],ctx.ownerByToken.get(g[0])]:[]));
 const sign=x=>x.map(g=>g.join('/')).sort().join('|');
 const add=(p,kind,raw,mode)=>{const id=sig(p);if(seen.has(id))return;seen.add(id);proposals.push({p,kind,raw,mode});};
 function local(plan,i,mode){
  const u=units.get(plan[i][0]),byCell=new Map(plan.map((g,j)=>[key(g[1],g[2]),j]));
  if(!u||pinned.has(u.p.uid))return [];
  let scores=[];
  for(const t of u.entries){
    const j=byCell.get(t.k), buddy=j==null||j===i?null:units.get(plan[j][0]);
    if(j!=null&&j!==i&&(!buddy||pinned.has(buddy.p.uid)))continue;
    const copy=plan.slice();copy[i]=t.g;
    if(buddy){
      const v=buddy.look.get([plan[i][1],plan[i][2],plan[j][3]].join('/'));
      if(!v)continue;copy[j]=v.g;
    }
    scores.push({p:copy,offset:personal(u,t,mode),t});
  }
  // Compress per-operator enumeration while keeping distinct destinations on the board.
  scores.sort((a,b)=>b.offset-a.offset);
  const kept=[],tiles=new Map();
  for(const v of scores){
    const n=tiles.get(v.t.k)||0;
    if(n>=2&&kept.length>1)continue;
    tiles.set(v.t.k,n+1);kept.push({...v,value:totalScore(v.p,mode)});
    if(kept.length>=15)break;
  }
  return kept.sort((a,b)=>b.value-a.value);
 }
 for(const mode of Object.keys(weightProfiles)){
  let plan=origin,score=totalScore(plan,mode),moves=0;
  for(let pass=0;pass<Math.min(5,origin.length);pass++){
    const changes=[];
    for(let i=0;i<plan.length;i++){
      const opts=local(plan,i,mode);
      if(pass===0&&mode==='balanced')for(const z of opts.slice(0,2))add(z.p,'single',z.value-score,mode);
      if(opts.length)changes.push(opts[0]);
    }
    changes.sort((a,b)=>b.value-a.value);
    const best=changes.find(v=>v.value>score+1e-7&&sign(v.p)!==sign(plan));
    if(!best)break;
    plan=best.p;score=best.value;moves++;
    if(pass===0||pass===1||pass===3)add(plan,'multi-'+(pass+1),score-totalScore(origin,mode),mode);
  }
  if(moves)add(plan,'joint',score-totalScore(origin,mode),mode);
 }
 // A real reserve can replace a low-contribution incumbent on a different tile type.
 // Reoptimise the entrant's position and direction while the remaining team stays in place.
 const onboard=new Set(origin.map(g=>g[0])),extras=[...units.values()].filter(u=>!onboard.has(u.p.uid));
 const spare=[];
 for(const u of extras){
  const poses=u.entries.slice().sort((a,b)=>personal(u,b,'balanced')-personal(u,a,'balanced'));
  for(let i=0;i<origin.length;i++){
    const before=units.get(origin[i][0]);if(!before||pinned.has(before.p.uid))continue;
    if(before.p.id===u.p.id&&before.p.items.length===u.p.items.length)continue;
    const occupied=new Set(origin.filter((_,j)=>j!==i).map(g=>key(g[1],g[2])));
    const options=poses.filter(t=>!occupied.has(t.k)).slice(0,3);
    for(const t of options){const p=origin.slice();p[i]=t.g;spare.push({p,raw:totalScore(p,'balanced')-totalScore(origin,'balanced'),pair:i+'/'+u.p.uid});}
  }
 }
 spare.sort((a,b)=>b.raw-a.raw);const pairs=new Set();
 for(const b of spare){if(pairs.has(b.pair))continue;pairs.add(b.pair);add(b.p,'reserve',b.raw,'balanced');if(pairs.size>=16)break;}
 return proposals.slice(0,width);
}
