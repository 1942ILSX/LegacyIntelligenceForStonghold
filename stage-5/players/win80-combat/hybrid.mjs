import fs from 'node:fs';
import {makeEncoder} from './features.mjs';
import {makeCombatScorer} from './student.mjs';
import {withHardBossFormations} from '../win40/hard-boss/wrap.mjs';
const stock=new URL('../solo-40-portfolio-c/controller.mjs',import.meta.url);
const mod=await import(process.env.SP_WIN80_COMBAT_BASE_URL||stock.href);
const weights=JSON.parse(fs.readFileSync(new URL('./student-1.json',import.meta.url)));
export const seatProfile=mod.seatProfile;
export function withBudgetedCombat(base,gd,loadout,options={}) {
  const encoder=makeEncoder(gd,loadout),normal=makeCombatScorer(weights.normal),boss=makeCombatScorer(weights.boss);
  const joint=withHardBossFormations(base,gd,loadout,['boss_17']);
  return {
    decide(need,s){
      const reply=joint.decide(need,s);
      if(!reply.candidates?.length)return reply;
      const realBoss=s.r>=gd.bossRound,feat=encoder(s),score=realBoss?boss:normal;
      const ranked=reply.candidates.map((plan,i)=>({plan,i,value:score(feat(plan))})).sort((a,b)=>b.value-a.value||a.i-b.i);
      // The first legal plan survives a zero-timeout search. On the scarce
      // mobile waves the original coverage layout is the better fixed prior.
      const first=realBoss?ranked[0].plan:reply.candidates[0];
      const proposals=[...new Set([first,...ranked.map(x=>x.plan)])];
      return {...reply,formation:first,candidates:proposals.slice(0,realBoss?(options.bossLimit??5):(options.normalLimit??5))};
    },
    ack(status){joint.ack?.(status);},
  };
}
export function createPlanner(cfg){
  return withBudgetedCombat(mod.createPlanner(cfg),cfg.gd,seatProfile?.(cfg.gd,cfg)?.loadout||{},cfg.budgetedCombat||{});
}
