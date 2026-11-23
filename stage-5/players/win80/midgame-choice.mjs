import {createPlanner as current,seatProfile} from './stage-deployment.mjs';
import {createPlanner as regional} from './leithania.mjs';
import {createPlanner as supply} from './standalone-scope.mjs';
import {selectContinuation} from './continuation.mjs';
export {seatProfile};

export function canChangeEconomy(s){
  return !!s.band&&s.band!=='band_mech'&&s.band!=='band_siracusa'&&s.boss!=='boss_17'&&
    s.groups[s.picked]?.includes('lethaniaShip')&&!s.disabledBonds.includes('lethaniaShip');
}
export function withMidgameEconomy(initial,cfg){
  let player=initial,considered=false;
  return {decide(need,s){
    if(!considered&&s.r===7&&need==='prep'){
      considered=true;
      if(canChangeEconomy(s)&&(cfg.midgameChoice==='switch'||cfg.midgameModel&&selectContinuation(cfg.midgameModel,s)==='switch')){
        const alternate=s.band==='band_amiya'?supply:regional;
        player=alternate({...cfg,band:s.band});
      }
    }
    return player.decide(need,s);
  },ack(status){player.ack?.(status);}};
}
export function createPlanner(cfg){return withMidgameEconomy(current(cfg),cfg);}
