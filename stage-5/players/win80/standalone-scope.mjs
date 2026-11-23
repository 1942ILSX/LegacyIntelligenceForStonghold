import {createPlanner as scope,seatProfile} from '../win80-economy-r1/scope-route.mjs';
import {withLegalAssignment} from './portfolio.mjs';
export {seatProfile};
export const createPlanner=cfg=>withLegalAssignment(scope(cfg),cfg);
