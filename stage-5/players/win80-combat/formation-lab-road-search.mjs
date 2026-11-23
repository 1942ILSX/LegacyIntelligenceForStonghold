import {proposalContext} from './formation-lab-search.mjs';
import {compactFormationProposals} from './formation-lab-neighborhood.mjs';
const modes={
 balanced:[.75,.65,.5,.7],late:[2.1,.5,.8,.7],early:[-.55,1,.4,.7],hold:[.8,2,1.5,1.3],
 fire:[.8,.3,.35,.4],survival:[.8,1.3,1.6,1.75],spread:[.5,.6,.6,.7],cluster:[.65,1.1,1.3,.7]};
export function roadThreatContext(gd,c,trace){
 const seat=proposalContext(gd,c,{poses:[],steps:1,credits:trace.credits});
 const lanes=trace.lanes,total=lanes.reduce((a,b)=>a+b,0)||1,weights=lanes.map(v=>v/total);
 for(const u of seat.units.values()){
  const stat=u.rec.stats||{},atk=stat.atk||200,arts=u.rec.dmgType==='arts';
  for(const t of u.entries){
   const covering=Array(4).fill(0),late=Array(4).fill(0),blocking=Array(4).fill(0),risk=Array(4).fill(0);
   for(const q of trace.poses){
    const j=q.lane,k=q.keys[0],dist=Math.hypot(t.g[1]-q.y,t.g[2]-q.x);
    const scope=dist>=3?u.scopes:1,can=!q.air||u.rec.canHitFly;
    const armor=arts?Math.max(.10,1-q.res/100):Math.max(.05,1-q.def/Math.max(1,atk));
    const contributes=can*scope*armor*(.76*Number(t.hit.has(k))+.24*Number(t.aoe.has(k)));
    covering[j]+=q.n*contributes;late[j]+=q.n*contributes*q.late;
    blocking[j]+=q.n*Number(!q.air&&dist<=.78);risk[j]+=q.n*Math.max(0,1-dist/2.4);
   }
   t.lanes={cover:covering.map((v,i)=>v/Math.max(1e-9,lanes[i])),late:late.map((v,i)=>v/Math.max(1e-9,lanes[i])),
    block:blocking.map((v,i)=>v/Math.max(1e-9,lanes[i]))};
   t.risk=risk.reduce((a,b)=>a+b,0)/total;t.cover=covering.reduce((a,b)=>a+b,0)/total;t.late=late.reduce((a,b)=>a+b,0)/total;t.block=blocking.reduce((a,b)=>a+b,0)/total;
  }
 }
 function personal(u,t,mode){
  const [late,stall]=modes[mode];
  return u.heal?-.035*t.risk:u.dps*(t.cover+.65*late*t.late)+u.guard*u.tank*stall*t.block;
 }
 function score(p,mode){
  const [late,stall,heal,safety]=modes[mode],team=p.map(g=>({u:seat.units.get(g[0]),t:seat.get(g)})).filter(g=>g.u&&g.t);
  const dmg=Array(4).fill(0),def=Array(4).fill(0);let add=0;
  for(const {u,t}of team){
   let med=0,friendly=0,near=0;
   for(const q of team)if(q.u!==u){
    med+=Number(q.u.heal&&q.t.hit.has(t.k))*q.u.dps;
    friendly+=Number(q.u.p.id.startsWith('chess_char_5_22_')&&q.t.hit.has(t.k))*q.u.dps;
    near+=Number(Math.hypot(q.t.g[1]-t.g[1],q.t.g[2]-t.g[2])<1.65);
   }
   for(let i=0;i<4;i++){
    if(!u.heal)dmg[i]+=u.dps*(t.lanes.cover[i]+.65*late*t.lanes.late[i]);
    if(u.guard)def[i]+=u.tank*t.lanes.block[i]*(1+heal*Math.min(3,med)*.32);
   }
   add+=heal*.06*med*(u.dps*.3+t.risk+.2*u.guard)-safety*.076*t.risk*u.dps/Math.max(.4,u.tank)-.07*friendly*u.dps;
   if(mode==='spread')add-=.034*near*(.15+t.risk)*u.dps;
  }
  for(let i=0;i<4;i++)if(weights[i]>0){
   const v=dmg[i]*(1+Math.min(2,def[i])*.2)+stall*def[i];
   add+=weights[i]*(2.3*Math.log1p(Math.max(0,v))+.32*v);
  }
  return add;
 }
 return {...seat,personal,totalScore:score};
}
export function roadThreatProposals(gd,c,trace,origin,opts={}){
 const ctx=roadThreatContext(gd,c,trace);
 return compactFormationProposals(ctx,origin,{width:opts.width||65});
}
