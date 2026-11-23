import {createPlannerWithEconomy,seatProfile} from '../win80-economy-r1/extend.mjs';
import {withScopeRoute} from '../win80-economy-r1/scope-route.mjs';
import {withLegalAssignment} from '../win80/portfolio.mjs';
import {withPassiveTeams,recruitmentBonuses} from './passive-teams.mjs';
import {fixedBank} from './fixed-bank.mjs';
export {seatProfile};
export function createPlanner(cfg){
  const backend=options=>createPlannerWithEconomy(options,cfg.passiveRecruit?{planPriority:(s,r)=>(options.planPriority?.(s,r)||0)+recruitmentBonuses(options.gd,s,r)}:{});
  const player=withLegalAssignment(withPassiveTeams(withScopeRoute(backend,cfg),cfg.gd,cfg),cfg);
  return fixedBank(player,cfg.gd,seatProfile(cfg.gd,cfg).loadout);
}

