import {createPlanner as ordinary,seatProfile} from '../win80-economy-r1/scope-route.mjs';
import {withMatrixRoute} from './matrix-route.mjs';
import {createPlanner as growth} from './siracusa-growth.mjs';

export {seatProfile};

export function withMatrixPacedRoute(makeBase,cfg) {
  return withMatrixRoute(makeBase,cfg,options=>growth({...options,siraGrowth:'pace'}));
}

export const createPlanner=cfg=>withMatrixPacedRoute(ordinary,cfg);
