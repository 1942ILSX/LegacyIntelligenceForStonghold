import {seatProfile,createPlannerWithEconomy} from '../win80-economy/extend.mjs';
import {guidePlanner} from './guided.mjs';
import {withGrowth} from './growth.mjs';
export {seatProfile};
export function createPlanner(cfg) {
  const base=cfg.guidePool?guidePlanner(cfg,createPlannerWithEconomy):createPlannerWithEconomy(cfg);
  return cfg.growth===false?base:withGrowth(base,cfg.gd,cfg);
}
