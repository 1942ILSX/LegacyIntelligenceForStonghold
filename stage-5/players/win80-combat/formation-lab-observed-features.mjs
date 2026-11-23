import {createFormationFeatures} from './formation-lab-features.mjs';
const stat=(map,key)=>map?.[key]||0;
const bounded=(x,a=0,b=5)=>Math.min(b,Math.max(a,x));
export function observedFormationFeatures(gd,c,trace,baseline,base,ctx){
  const original=createFormationFeatures(gd,c,trace,base,ctx);
  const piece=new Map([...c.own.board,...c.own.hand,...c.own.temp].filter(Boolean).map(p=>[p.uid,p]));
  const totalDamage=Object.values(trace.credits).reduce((s,z)=>s+z,0);
  const credit=uid=>stat(trace.credits,uid)/Math.max(.03,totalDamage);
  const roots=new Map(base.map(g=>[g[0],g]));
  const top=Array.from(ctx.units.keys()).sort((a,b)=>credit(b)-credit(a)).slice(0,3);
  const baselineContext=[Number(baseline.won),baseline.damage,Math.min(1,baseline.lp/Math.max(1,c.own.lp)),bounded(baseline.ticks/16000,0,2),
    ...top.map(credit),trace.steps/480];
  function summary(plan){
    const pieces=plan.map(g=>({g,u:ctx.units.get(g[0]),t:ctx.get(g)})).filter(v=>v.u&&v.t);
    const sums=Array(12).fill(0),descs=new Map();
    for(const {g,u,t}of pieces){
      const id=g[0],damage=credit(id),time=bounded(stat(trace.present,id)/Math.max(1,trace.steps),0,1);
      const hurt=bounded(stat(trace.hurt,id)/(u.rec.stats.maxHp||1600));
      const blocked=bounded(stat(trace.blocks,id)/Math.max(1,trace.steps),0,1),deaths=bounded(stat(trace.deaths,id));
      const heal=pieces.reduce((s,x)=>s+Number(x.u.heal&&x.t.hit.has(t.k))*x.u.dps,0);
      const adj=pieces.reduce((s,x)=>s+Number(x.g[0]!==id&&Math.hypot(x.g[1]-g[1],x.g[2]-g[2])<=1.65),0);
      const d=[damage*t.cover,damage*t.late,damage*t.risk,damage*heal,damage*adj,damage*Number(t.block>0),
        hurt*t.risk,hurt*heal,(1-time)*u.dps*t.cover,deaths*t.risk,blocked*t.block,t.cover*u.dps*Number(!roots.has(id))];
      d.forEach((v,j)=>sums[j]+=v);descs.set(id,[damage,time,hurt,deaths,blocked,t.cover,t.late,t.risk,heal,adj/4]);
    }
    const lead=top.flatMap(id=>descs.get(id)||Array(10).fill(0));
    return {vec:[...sums,...lead],descs};
  }
  const before=summary(base);
  return item=>{
    const after=summary(item.p),old=before.vec,delta=after.vec.map((v,i)=>bounded(v-old[i],-6,6));
    return [...original(item),...baselineContext,...old,...delta];
  };
}
