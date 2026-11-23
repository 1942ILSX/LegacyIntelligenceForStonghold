import fs from 'node:fs';
import {createPlanner as baseline,seatProfile} from '../solo-40-portfolio-c/controller.mjs';
import {withHardBossFormations} from '../win40/hard-boss/wrap.mjs';
import {makeEncoder} from './features.mjs';
export {seatProfile};
function prepare(net) {
  const layers=net.layers.map(l=>({w:l.w.map(row=>Float32Array.from(row)),b:Float32Array.from(l.b)}));
  return x=>{
    let h=x.map((v,i)=>Math.max(-6,Math.min(6,(v-net.mean[i])/net.std[i])));
    for(let i=0;i<layers.length;i++){
      const layer=layers[i], z=new Float32Array(layer.b);
      for(let j=0;j<z.length;j++){
        const w=layer.w[j];let a=z[j];
        for(let k=0;k<w.length;k++)a+=w[k]*h[k];
        z[j]=i===layers.length-1?a:Math.max(0,a);
      }
      h=z;
    }
    return h[0];
  };
}
export {prepare as makeCombatScorer};
export function withCombatStudent(base,gd,loadout,weights,options={}) {
  const encode=makeEncoder(gd,loadout),normal=prepare(weights.normal),boss=prepare(weights.boss);
  return {
    decide(need,s){
      const reply=base.decide(need,s);
      if(!reply.candidates?.length || options.bossOnly&&s.r<gd.bossRound)return reply;
      const feat=encode(s), model=s.r>=gd.bossRound?boss:normal;
      let best=reply.candidates[0],bestScore=-Infinity;
      for(const p of reply.candidates){
        const score=model(feat(p));if(score>bestScore){best=p;bestScore=score;}
      }
      // Omit alternate candidates so that the official adapter immediately
      // serializes legal human-seat placement commands for the chosen board.
      return {...reply,formation:best,candidates:undefined};
    },
    ack(status){base.ack?.(status);},
  };
}
export function createPlanner(cfg) {
  const profile=seatProfile(cfg.gd,cfg),src=cfg.studentFile?new URL(cfg.studentFile,import.meta.url):new URL('./student-1.json',import.meta.url);
  const net=JSON.parse(fs.readFileSync(src,'utf8'));
  const base=withHardBossFormations(baseline(cfg),cfg.gd,profile.loadout,['boss_17']);
  return withCombatStudent(base,cfg.gd,profile.loadout,net,cfg);
}
