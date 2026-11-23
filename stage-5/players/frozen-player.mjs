import {randomInt} from 'node:crypto';
import {createPlanner as frozen,seatProfile} from './win80-combat/yan-cocoon-player.mjs';
export {seatProfile};
export function createPlanner(cfg) {
  if(cfg.band!=='random')return frozen(cfg);
  const allowed=cfg.gd.bandIds().filter(id=>cfg.gd.bandBondIds(id).every(b=>!cfg.gd.modeInactiveBonds.has(b)));
  return frozen({...cfg,band:allowed[randomInt(allowed.length)]});
}
