import {createPlanner as buildStage,seatProfile} from './stage-player.mjs';
import {createPlanner as regional} from './leithania.mjs';
import {createPlanner as supply} from './standalone-scope.mjs';
export {seatProfile};

function chooseRegional(cfg,s) {
  let best='band_amiya',score=cfg.regionalStrategyMargin??.035;
  for(const [band,w] of Object.entries(cfg.regionalStrategyModel??{})){
    if(!s.bands.includes(band)||cfg.gd.bandBondIds(band).length)continue;
    const value=w.bias+(w['boss/'+s.boss]??0)+(w['stage/'+s.stage]??0);
    if(value>score){score=value;best=band;}
  }
  return best;
}

export function createPlanner(cfg){
  let active,external=false;
  return {decide(need,s){
    if(!active){
      const assigned=s.band||(cfg.band&&cfg.band!=='auto'?cfg.band:null);
      external=Boolean(assigned);
      const matrix=s.boss==='boss_17'&&s.stage!=='act3autochess_m09'&&assigned==='band_siracusa';
      active=external&&cfg.stageAssignedRegional&&!matrix?regional({...cfg,band:assigned}):buildStage(cfg);
    }
    const reply=active.decide(need,s);
    if(external||need!=='band'||s.band)return reply;
    const proposed=reply.moves?.[0]?.bandId;
    const revival=cfg.gavialBranches?.[proposed];
    if(revival&&s.bands.includes('band_survive')){
      const m=revival.weights;
      const value=m?m.bias+(m['boss/'+s.boss]??0)+(m['stage/'+s.stage]??0):1;
      if(value>revival.margin){
        const create=proposed==='band_amiya'?regional:supply;
        active=create({...cfg,band:'band_survive'});
        return active.decide(need,s);
      }
    }
    if(!cfg.regionalStrategyModel||proposed!=='band_amiya')return reply;
    const chosen=chooseRegional(cfg,s);
    if(chosen==='band_amiya')return reply;
    active=regional({...cfg,band:chosen});
    return active.decide(need,s);
  },ack(status){active?.ack?.(status);}};
}
