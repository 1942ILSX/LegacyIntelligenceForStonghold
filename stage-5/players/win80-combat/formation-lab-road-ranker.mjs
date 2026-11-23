import {createFormationFeatures} from './formation-lab-features.mjs';
import {roadThreatContext} from './formation-lab-road-search.mjs';
import {compactFormationProposals} from './formation-lab-neighborhood.mjs';

const kinds={single:16,reserve:12,joint:6,'multi-1':2,'multi-2':5,'multi-4':5};
export const signRoadPlan=plan=>plan.map(g=>g.join('/')).sort().join('|');
export function roadGeometryBank(ctx,origin,legacyCandidates){
  const result=[{p:origin,kind:'incumbent'}],seen=new Set([signRoadPlan(origin)]),counts={};
  const generated=compactFormationProposals(ctx,origin,{width:65}).filter(q=>{
    const n=counts[q.kind]||0;counts[q.kind]=n+1;return n<(kinds[q.kind]||0);
  });
  for(const q of [...generated,...legacyCandidates.map(p=>({p,kind:'incumbent-bank'}))]){
    const signature=signRoadPlan(q.p);
    if(!seen.has(signature)){seen.add(signature);result.push(q);}
  }
  return result;
}
export function createRoadEncoder(gd,c,source,base,incumbent){
  const ctx=roadThreatContext(gd,c,source);
  const embed=createFormationFeatures(gd,c,source,base,ctx);
  const weights=source.lanes,scale=weights.reduce((a,b)=>a+b,0)||1;
  const lane=(goals)=>{
    const damage=Array(4).fill(0),late=Array(4).fill(0),block=Array(4).fill(0);
    for(const g of goals){
      const u=ctx.units.get(g[0]),t=ctx.get(g);
      if(!u||!t)continue;
      for(let i=0;i<4;i++){
        if(!u.heal){
          damage[i]+=u.dps*t.lanes.cover[i];
          late[i]+=u.dps*t.lanes.late[i];
        }
        if(u.guard)block[i]+=u.tank*t.lanes.block[i];
      }
    }
    return [...damage,...late,...block].map(x=>Math.log1p(x));
  };
  const before=lane(base),header=[(c.s.r-8)/5,c.own.lp/30,Math.min(25,incumbent.leaks)/10,
    incumbent.lp/30,source.lost/20,...weights.map(v=>v/scale)];
  function encode(q){
    const after=lane(q.p),x=embed(q);
    return [...x,...header,...before,...after.map((v,i)=>v-before[i])].map(v=>Math.round(v*1e5)/1e5);
  }
  return {ctx,encode};
}
