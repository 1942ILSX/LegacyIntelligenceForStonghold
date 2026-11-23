import {readFileSync} from 'node:fs';
import {createPlanner as specialist,seatProfile} from './extension/specialist.mjs';
export {seatProfile};
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const defaults=read('./supply.json');
const weights=read('./core/extensions/win40/value/terminal.json').weights;
const opening=read('./core/extensions/win40/value/routing.json');
const frozenDefaultRoute=defaults.routeOrder.join('/');

/**
 * Adds public unit and equipment preferences to the screened supply policy.
 * plannedEquipment receives base chess and item IDs. A matching legal carrier
 * takes priority over the ordinary supply assignment. Unit preferences add to
 * the same public score used for fielding, shopping, promotion and rewards.
 * Pass routeOrder in the second argument to override routing even if the order
 * equals the shared runner's default. A function receives the opening view.
 */
export function createPlannerWithEconomy(cfg,hooks={}){
  let current;
  function initialize(s){
    const baseLogit=opening.bias+(opening.boss[s.boss]??0)+(opening.stage[s.stage]??0);
    const route=cfg.fixedRoute==='ursus'||(!cfg.fixedRoute&&baseLogit>0)?opening.ursus:opening.arcane;
    const tuning={...cfg.economy,...hooks.economy};
    const customRoute=hooks.routeOrder??tuning.routeOrder??
       (cfg.routeOrder?.join('/')!==frozenDefaultRoute?cfg.routeOrder:undefined);
    const routeOrder=typeof customRoute==='function'?customRoute(s):customRoute;
    const resource={...defaults.economy,...cfg.resources,...hooks.resources};
    for(const k of ['supply','items','raid','lock'])if(tuning[k]!==undefined)resource[k]=tuning[k];
    const planPriority=hooks.planPriority??tuning.planPriority??cfg.planPriority;
    const plannedEquipment=hooks.plannedEquipment??tuning.plannedEquipment??cfg.plannedEquipment;
    const terminalPriority=(s,r)=>{
      const id=r.baseId??r.chessId;
      const v=(weights['u/'+id]??0)+(weights[s.boss+'/'+id]??0)+(r.isGolden?(weights['e/'+id]??0):0);
      return Math.min(1,Math.max(0,(s.r-4)/6))*(cfg.terminalWeight??140)*v;
    };
    return specialist({...defaults,...cfg,...route,...tuning,...(routeOrder?{routeOrder}:{}),
      economy:resource,band:cfg.band??'auto',planPriority,plannedEquipment,terminalPriority});
  }
  return {decide(need,s){current??=initialize(s);return current.decide(need,s);},ack(status){current?.ack?.(status);}};
}
export const createPlanner=createPlannerWithEconomy;
