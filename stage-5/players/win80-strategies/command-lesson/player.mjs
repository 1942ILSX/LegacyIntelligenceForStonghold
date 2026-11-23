import fs from 'node:fs';
import {supported,targetFeatures} from './features.mjs';
import {createPlanner as stage,seatProfile} from '../../win80/stage-three-player.mjs';
export {seatProfile};
let saved;
const value=(x,w)=>Object.entries(x).reduce((n,[k,v])=>n+(w[k]||0)*v,0);
export function withCommandLesson(base,gd,model){
  return {decide(need,s){
    const reply=base.decide(need,s),m=reply.moves?.[0];
    if(need!=='prep'||m?.t!=='g.command'||!supported(m.effectId)||!model.skills.includes(m.effectId)||m.target?.uid==null)return reply;
    const board=s.pieces.filter(p=>p[2]==='chess'&&p[3]==='b').map(p=>[p[0],p[4],p[5],p[6]]);
    const candidates=new Set(s.cmd?.targets?.map(t=>t.uid)||[]);
    const ranked=board.filter(([uid])=>candidates.has(uid)).map(([uid])=>({uid,v:value(targetFeatures(gd,s,board,uid,m.effectId),model.weights)})).sort((a,b)=>b.v-a.v||a.uid-b.uid);
    const inc=ranked.find(t=>t.uid===m.target.uid),pick=ranked[0];
    if(!inc||!pick)return reply;
    const effective=pick.v-inc.v>model.margin?pick:inc;
    return {...reply,moves:[{...m,target:{...m.target,uid:effective.uid}},...reply.moves.slice(1)],
      branchDecision:{kind:'combatCommand',effect:m.effectId,original:inc.uid,chosen:effective.uid,margin:pick.v-inc.v,r:s.r}};
  },ack(status){base.ack?.(status);}};
}
export function createPlanner(cfg){
  if(!saved)saved=JSON.parse(fs.readFileSync(new URL('../../../reports/win80-strategies/command-lesson-42/model.json',import.meta.url)));
  return withCommandLesson(stage(cfg),cfg.gd,saved);
}
