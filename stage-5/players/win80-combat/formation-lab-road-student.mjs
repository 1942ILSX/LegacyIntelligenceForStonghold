import {registerHooks} from 'node:module';
import './detached-observers.mjs';
import '../win80/detached-commands.mjs';
import {installForecastStep} from './release-kernel.mjs';
import {installDetachedFastpath} from '../win80/detached-fastpath.mjs';
import {installRealizedTrial} from '../win80/realized-arena.mjs';
import {makeCommandHistory} from '../win80/command-history.mjs';
import {observeRoadThreat} from './formation-lab-road-trace.mjs';
import {createRoadEncoder,roadGeometryBank} from './formation-lab-road-ranker.mjs';
installDetachedFastpath();installForecastStep();installRealizedTrial();
const privateSearch=new URL('../solo-40-portfolio-c/search/index.mjs',import.meta.url).href;
registerHooks({load(url,ctx,next){
  const r=next(url,ctx);if(url!==privateSearch)return r;
  const src=Buffer.from(r.source).toString('utf8'),mark='battle.step();';
  if(src.split(mark).length!==2)throw Error('Unknown bounded ordinary forecast kernel');
  return {...r,source:src.replace(mark,"if(t%24===0&&opts.wallDeadline!==undefined&&performance.now()>=opts.wallDeadline)throw Error('Ordinary forecast exhausted');"+mark)};
}});
const {publicArena,rules}=await import('./public-arena.mjs');
const {checkPublicFormation}=await import('./legal-public-formation.mjs');
const value=q=>-Math.min(10,q.leaks)-1.7*Number(q.lp<=0)+.018*Math.min(25,q.gain);

export function createShortRoadPolicy(model,{slots=3,budget=450}={}){
 const arena=publicArena();
 const rank=x=>x.reduce((sum,v,i)=>sum+Math.max(-5,Math.min(5,(v-model.mean[i])/model.std[i]))*model.w[i],0);
 function choose(snapshot,{deadline=performance.now()+budget}={}){
  const start=performance.now(),c=structuredClone(snapshot.c),round=c.s.r,h=makeCommandHistory(rules);
  const base=c.own.board.map(q=>[q.uid,q.row,q.col,q.dir||'RIGHT']);
  for(const q of snapshot.commands||[])if(q.round===round)h.commit(h.describe(round,c.own,q.msg));
  h.decorate(c,c.own);
  let completed=0;
  const end=(p,changed,reason,extra={})=>({p,changed,reason,completed,elapsedMs:performance.now()-start,...extra});
  const simulate=(plan,trace)=>{
   if(performance.now()>=deadline-2)return null;
   try{
    const [q]=arena.evaluate(c,[plan],{salt:8230837,observation:{forecastStride:1,wallDeadline:deadline,onDetachedBattle:trace?.observe}});
    completed++;return q;
   }catch(err){if(String(err).includes('Ordinary forecast exhausted'))return null;throw err;}
  };
  const trace=observeRoadThreat(),old=simulate(base,trace);
  if(!old)return end(base,false,'incumbent-exhausted');
  if(old.leaks<2&&!(old.leaks>=1&&c.own.lp<=7))return end(base,false,'quiet');
  if(performance.now()>=deadline-80)return end(base,false,'retained');
  const source=trace.summary(),{ctx,encode}=createRoadEncoder(rules,c,source,base,old);
  const bank=roadGeometryBank(ctx,base,c.detail?.candidates||[]),ranked=[];
  for(const q of bank.slice(1)){
   if(performance.now()>=deadline-8)return end(base,false,'geometry-exhausted');
   const features=encode(q);
   if(features.length!==model.featureCount)throw Error('Ordinary ranker feature contract changed');
   ranked.push({q,score:rank(features)});
  }
  ranked.sort((a,b)=>b.score-a.score);
  let best=base,score=value(old),evaluated=0,kind='incumbent';
  for(const {q} of ranked){
   if(performance.now()>=deadline-3||evaluated>=slots)break;
   if(!checkPublicFormation(rules,c,q.p).ok)continue;
   const res=simulate(q.p);if(!res)break;
   evaluated++;
   const u=value(res);
   if(u>score){best=q.p;score=u;kind=q.kind;}
  }
  const changed=best!==base&&score>=value(old)+.5;
  return end(changed?best:base,changed,changed?'changed':'incumbent',{bank:bank.length,kind:changed?kind:'incumbent'});
 }
 return {choose,close(){arena.close();}};
}
