import {hardBossCandidates} from './formations.mjs';

// For application to another independently piloted base after validation.
// Loadout is the declared human seat profile's public operator loadout.
export function withHardBossFormations(base,gd,loadout={},bosses=['boss_17','boss_12']) {
  const enabled=new Set(bosses);
  return {
    decide(need,s){
      const reply=base.decide(need,s);
      if(!reply.candidates?.length||!enabled.has(s.boss)||s.r!==gd.bossRound)return reply;
      const extra=hardBossCandidates(gd,s,reply.candidates,loadout);
      return extra.length?{...reply,candidates:[...reply.candidates,...extra]}:reply;
    },
    ack(status){base.ack?.(status);},
  };
}
