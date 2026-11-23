import {createPlannerWithEconomy,seatProfile} from './extend.mjs';
import {createPlanner as makeScope} from './scope-supply.mjs';
export {seatProfile};
export function canBuildScopedTin(gd,s){
  const off=new Set(s.disabledBonds||[]);
  const boss=gd.boss(s.objectiveBoss||s.boss),area=gd.enemy(boss?.enemyKey)?.hitArea;
  return Number(area?.w)>=3&&['chess_char_2_14_a','chess_char_2_11_a'].every(id=>{
    const r=gd.chess(id);
    return r&&!gd.bondsExclude(r,off)&&!s.bannedChess?.includes(id);
  });
}
export function withScopeRoute(makeBase,cfg){
  let player;
  return {decide(need,s){
    if(!player){
      const chosen=s.band||cfg.band;
      const fit=canBuildScopedTin(cfg.gd,s)&&(!chosen||chosen==='auto'||chosen==='band_mech');
      player=fit?makeScope({...cfg,band:'band_mech'}):makeBase(cfg);
    }
    return player.decide(need,s);
  },ack(status){player?.ack?.(status);}};
}
export function createPlanner(cfg){return withScopeRoute(createPlannerWithEconomy,cfg);}
