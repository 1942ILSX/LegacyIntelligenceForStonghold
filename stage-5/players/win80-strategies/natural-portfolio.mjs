import fs from 'node:fs';
const saved=JSON.parse(fs.readFileSync(new URL('../../reports/win80-strategies/opening-portfolio-32/model.json',import.meta.url)));

export function naturalPortfolioChoice(c,model=saved) {
  const original=c.original;
  if(!['band_amiya','band_jesica'].includes(original))return original;
  let choice=original,best=model.margin;
  for(const [band,r] of Object.entries(model.model[original]??{}).sort(([a],[b])=>a<b?-1:a>b?1:0)){
    if(!c.allowed.includes(band))continue;
    let value=r.bias;
    if(model.mode==='conditional'){
      const effects=r.effects;
      const core=c.core.reduce((sum,b)=>sum+(effects['core/'+b]??0),0)/Math.max(1,c.core.length);
      value+=.65*(effects['boss/'+c.boss]??0)+.35*(effects['stage/'+c.stage]??0)+.4*core;
    }
    if(value>best){choice=band;best=value;}
  }
  return choice;
}

export function withNaturalPortfolio(create,cfg,model=saved){
  let active=create(cfg),chosen=false;
  const assigned=(cfg.band && cfg.band!=='auto')||(cfg.assignedBand && cfg.assignedBand!=='auto');
  return {decide(need,s) {
    const answer=active.decide(need,s);
    if(chosen||assigned||s.band||need!=='band'||answer.moves?.length!==1||answer.moves[0].t!=='g.band')return answer;
    chosen=true;
    const original=answer.moves[0].bandId;
    const disabled=new Set(s.disabledBonds??[]), core=(s.groups?.[s.picked]??[]).filter(b=>!disabled.has(b));
    const allowed=(s.bands??[]).filter(id=>cfg.gd.bandBondIds(id).every(b=>core.includes(b)));
    const context={original,stage:s.stage,boss:s.boss,core,allowed};
    const next=naturalPortfolioChoice(context,model);
    if(next===original)return {...answer,portfolioChoice:{original,chosen:original}};
    active=create({...cfg,band:next});
    const proposed=active.decide(need,s);
    if(proposed.moves?.length!==1||proposed.moves[0].t!=='g.band'||proposed.moves[0].bandId!==next)
      throw Error('Receiving player did not accept its natural public choice');
    return {...proposed,portfolioChoice:{original,chosen:next}};
  },ack(status){active.ack?.(status);}};
}
