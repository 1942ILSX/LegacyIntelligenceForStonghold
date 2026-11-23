import fs from 'node:fs';
import {makeCombatScorer} from './student.mjs';
import {tracePoint,checkpoints} from './prefix-features.mjs';
const weights=JSON.parse(fs.readFileSync(new URL('./prefix-1.json',import.meta.url)));
const normal=makeCombatScorer(weights.normal),boss=makeCombatScorer(weights.boss);
export function makePrefixJudge(view){
  const previous=new Map(),round=view.s.r;
  return function score(index,cp,b,p,o,l) {
    const point=tracePoint(b,p,o,l,checkpoints[cp],round,view.s.boss,previous.get(index));
    previous.set(index,point.raw);
    if(p)return Math.max(0,Math.min(2,boss(point.x)));
    return 100*Math.max(-24,Math.min(.4,normal(point.x)));
  };
}
