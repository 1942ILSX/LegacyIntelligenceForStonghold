import {createPlanner as ordinary,seatProfile} from '../win80-economy-r1/scope-route.mjs';
import {createPlanner as siracusa} from './siracusa.mjs';
export {seatProfile};

/**
 * Use the screened Siracusa economy on Matrix outside m09. An inherited seat
 * keeps its strategy and previously chosen group. Accept a composed base player.
 */
export function withMatrixRoute(makeBase,cfg,makeSiracusa=siracusa){
  let player;
  return {decide(need,s){
    if(!player){
      const selected=s.band||cfg.band;
      const permitted=!selected||selected==='auto'||selected==='band_siracusa';
      const group=s.picked==null ? s.groups?.some(g=>g.includes('siracusaShip')) :
        s.groups?.[s.picked]?.includes('siracusaShip');
      const bandOffered=s.picked==null||!s.bands?.length||s.bands.includes('band_siracusa');
      const eligible=s.boss==='boss_17'&&s.stage!=='act3autochess_m09'&&permitted&&group&&bandOffered;
      player=eligible?makeSiracusa({...cfg,siraBand:'band_siracusa'}):makeBase(cfg);
    }
    return player.decide(need,s);
  },ack(status){player?.ack?.(status);}};
}
export const createPlanner=cfg=>withMatrixRoute(ordinary,cfg);
