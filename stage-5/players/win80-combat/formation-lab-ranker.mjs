import {observedFormationFeatures} from './formation-lab-observed-features.mjs';
import {publicBossPath} from './formation-lab-path.mjs';
import {proposalContext} from './formation-lab-search.mjs';
import {compactFormationProposals} from './formation-lab-neighborhood.mjs';
import {createFormationFeatures} from './formation-lab-features.mjs';
import {checkPublicFormation} from './legal-public-formation.mjs';

export const formationSignature=p=>p.map(g=>g.join('/')).sort().join('|');
const sigmoid=v=>1/(1+Math.exp(-v));
export function rankFormation(model,features){
  if(features.length!==model.mean.length)throw Error('Formation ranking feature contract changed');
  let input=features.map((v,i)=>Math.min(5,Math.max(-5,(v-model.mean[i])/model.std[i])));
  for(let j=0;j<model.layers.length;j++){
    const layer=model.layers[j],output=[];
    for(let k=0;k<layer.w.length;k++){
      const row=layer.w[k];let sum=layer.b[k];for(let i=0;i<row.length;i++)sum+=row[i]*input[i];
      output.push(j===model.layers.length-1?sum:sum*sigmoid(sum));
    }
    input=output;
  }
  return {utility:input[0],riskAdjusted:input[0]+.13*(sigmoid(input[1])-sigmoid(input[2]))};
}
export function rankedFormationBank(gd,publicState,base,alternates,model,{limit=3,observation=null,baseline=null}={}){
  const trace=observation||publicBossPath(gd,publicState),began=performance.now();
  const incumbent={kind:'incumbent',mode:'old',raw:0,p:base};
  const ctx=proposalContext(gd,publicState,trace),proposals=compactFormationProposals(ctx,base);
  const generationMs=performance.now()-began;
  const encode=observation?observedFormationFeatures(gd,publicState,trace,baseline,base,ctx):createFormationFeatures(gd,publicState,trace,base,ctx);
  const sources=[...proposals,...alternates.map(p=>({kind:'alternate-incumbent-bank',mode:'old',p,raw:0}))];
  const seen=new Set([formationSignature(base)]),scored=[];
  for(const [order,item] of sources.entries()){
    const key=formationSignature(item.p);if(seen.has(key))continue;seen.add(key);
    // Identical rounding is used in the offline authoring and executable model.
    const x=encode(item).map(v=>Math.round(v*1e5)/1e5);
    const score=rankFormation(model,x).riskAdjusted;scored.push({...item,order,score});
  }
  scored.sort((a,b)=>b.score-a.score||a.order-b.order);
  const selected=[incumbent];let rejected=0;
  for(const item of scored){
    if(selected.length>=limit+1)break;
    if(checkPublicFormation(gd,publicState,item.p).ok)selected.push(item);else rejected++;
  }
  return {selected,rejected,generated:scored.length,generationMs,rankingMs:performance.now()-began-generationMs};
}
export const formationUtility=(row,lp)=>Number(row.won)+.36*row.damage+.035*Number(row.won)*row.lp/Math.max(1,lp);
export function selectForecast(candidates,results,lp,{margin=.025,protectLp=3}={}){
  if(!results.length||results.length!==candidates.length)throw Error('Incomplete matched forecasts');
  let pick=0;
  const baseline=formationUtility(results[0],lp);
  if(!results[0].won||results[0].lp<protectLp){
    let high=baseline;
    for(let i=1;i<results.length;i++){
      const score=formationUtility(results[i],lp);
      if(score>high){high=score;pick=i;}
    }
    if(high<baseline+margin)pick=0;
  }
  return pick;
}

