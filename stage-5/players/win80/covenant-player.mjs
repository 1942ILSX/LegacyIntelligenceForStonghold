import {createPlanner as original,seatProfile} from './stage-deployment.mjs';
import {covenantFeatures,proposedSwitch} from './covenant-value.mjs';
export {seatProfile};

export function withCovenantSelection(make,cfg){
  let active=make(cfg),own=false,finished=false;
  return {decide(phase,s){
    own=false;
    const reply=active.decide(phase,s),msg=reply.moves?.[0];
    if(finished||phase!=='opening'||s.picked!==null||s.groups.length!==2||msg?.t!=='g.bondGroup')return reply;
    finished=true;
    const alt=1-msg.idx,assigned=cfg.band&&cfg.band!=='auto'?cfg.band:null;
    if(assigned&&!cfg.gd.bandBondIds(assigned).every(b=>s.groups[alt].includes(b)&&!s.disabledBonds.includes(b)))return reply;
    const change=cfg.covenantExperiment==='alternate'||(cfg.covenantModel&&proposedSwitch(cfg.covenantModel,covenantFeatures(cfg.gd,s,msg.idx)));
    if(!change)return reply;
    own=true;active=make(cfg);
    return {moves:[{...msg,idx:alt}]};
  },ack(status){
    if(own){if(status.at(-1)!=='ok')throw Error('Alternative public covenant was rejected');}
    else active.ack?.(status);
  }};
}
export const createPlanner=cfg=>withCovenantSelection(original,cfg);
