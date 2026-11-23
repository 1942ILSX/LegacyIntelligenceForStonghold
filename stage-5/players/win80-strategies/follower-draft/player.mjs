import fs from 'node:fs';
import {opened,utility,vector} from './features.mjs';
import {createPlanner as stage,seatProfile} from '../../win80/stage-three-player.mjs';
export {seatProfile};

export function withFollowerDraft(base,gd,{mode='observe',model}={}){
  const history=new Map();
  let step=null,confirmed=null;
  return {
    decide(need,s){
      const reply=base.decide(need,s),original=reply.moves?.[0];
      step=null;
      if(need!=='prep'||s.band!=='band_random')return reply;
      const log={kind:'followerDraft'};
      if(confirmed){
        log.received={...confirmed,seen:s.cmd?.id||null};
        confirmed=null;
      }
      if(s.draft?.ids?.length===2&&original?.t==='g.commandChoice'&&original.choiceId===s.draft.id){
        const o=opened(gd,s,history),ids=[...s.draft.ids],old=original.idx;
        const prior=ids.map(id=>utility(id,o));
        const scores=mode==='learned'?ids.map((id,i)=>prior[i]*model.priorSlope+
          Object.entries(vector(id,o)).reduce((v,[k,n])=>v+(model.weights[k]||0)*n,0)):prior;
        const idx=mode==='observe'||scores[0]===scores[1]?old:scores[1]>scores[0]?1:0;
        const move={...original,idx};
        step={type:'offer',selected:ids[idx],r:s.r};
        return {...reply,moves:[move,...reply.moves.slice(1)],branchDecision:{
          ...log,event:'choice',o,ids,old,idx,prior,scores,choiceId:s.draft.id}};
      }
      if(original?.t==='g.command'){
        step={type:'use',selected:original.effectId,r:s.r};
        log.event='use';log.id=original.effectId;log.r=s.r;log.cost=s.cmd?.cost??null;
      }
      return log.received||log.event?{...reply,branchDecision:log}:reply;
    },
    ack(status){
      if(step&&status[0]==='ok'){
        if(step.type==='offer')confirmed={id:step.selected,r:step.r};
        else{
          const previous=history.get(step.selected);
          history.set(step.selected,{count:(previous?.count||0)+1,round:step.r});
        }
      }
      step=null;base.ack?.(status);
    }
  };
}
let weight;
export function createPlanner(cfg){
  const mode=cfg.followerMode||'observe';
  if(mode==='learned'&&!weight)
    weight=JSON.parse(fs.readFileSync(new URL('../../../reports/win80-strategies/follower-draft-50/model.json',import.meta.url)));
  return withFollowerDraft(stage(cfg),cfg.gd,{mode,model:weight});
}
