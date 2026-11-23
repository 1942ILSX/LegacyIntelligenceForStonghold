import fs from 'node:fs';
import {createPlanner as stage,seatProfile} from './stage-deployment.mjs';
export {seatProfile};

const values=JSON.parse(fs.readFileSync(new URL('../solo-40-portfolio-c/campaign/combat-values.json',import.meta.url)));
const strength=new Map(values.roster.map(v=>[v.charId,v]));
const carry='char_1050_chen3';

export function withDiySelection(make,cfg){
  const base=make(cfg);
  return {decide(phase,s){
    const answer=base.decide(phase,s),move=answer.moves?.[0];
    if(phase!=='diy'||move?.t!=='g.diyBring')return answer;
    const ids=s.diy||[],record=id=>cfg.gd.chess(id);
    const arm=cfg.diyArm||cfg.diyPolicy?.[s.band]||'original';
    let slots=move.slots;
    if(arm==='carry')slots=ids.filter(id=>record(id).charId===carry).slice(0,1);
    if(arm==='counter'){
      const score=id=>{
        const r=record(id),v=strength.get(r.charId);
        if(!v)return 0;
        const matched=(s.groups?.[s.picked]||[]).filter(b=>r.bonds?.includes(b)).length;
        return .7*(v.boss[s.boss]||0)+.3*v.mean+.012*matched;
      };
      slots=[5,6].flatMap(t=>ids.filter(id=>record(id).tier===t&&score(id)>.026)
        .sort((a,b)=>score(b)-score(a)||a.localeCompare(b)).slice(0,Math.min(1,cfg.gd.diyBringLimits[t])));
    }
    return {...answer,moves:[{...move,slots}],diyChoice:{arm,original:move.slots,available:ids,selected:slots}};
  },ack(status){base.ack?.(status);}};
}
export const createPlanner=cfg=>withDiySelection(stage,cfg);
