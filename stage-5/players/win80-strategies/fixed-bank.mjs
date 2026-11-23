import fs from 'node:fs';
import {makeEncoder} from '../win80-combat/features.mjs';
import {makeCombatScorer} from '../win80-combat/student.mjs';
const net=JSON.parse(fs.readFileSync(new URL('../win80-combat/student-1.json',import.meta.url)));
const mobile=makeCombatScorer(net.normal),terminal=makeCombatScorer(net.boss);
const sig=p=>p.map(z=>z.join('/')).sort().join('|');
export function fixedBank(base,gd,loadout){
  const encode=makeEncoder(gd,loadout);
  return {decide(need,s){
    const result=base.decide(need,s),plans=result.candidates;
    if(!plans?.length||!result.formation)return result;
    const boss=s.r>=gd.bossRound,limit=boss?5:3,score=boss?terminal:mobile,feat=encode(s);
    const unique=[...new Map(plans.map(p=>[sig(p),p])).values()];
    const ranked=unique.slice(1).map(p=>({p,v:score(feat(p))})).sort((a,b)=>b.v-a.v);
    return {...result,formation:unique[0],candidates:[unique[0],...ranked.map(z=>z.p)].slice(0,limit)};
  },ack(status){base.ack?.(status);}};
}

