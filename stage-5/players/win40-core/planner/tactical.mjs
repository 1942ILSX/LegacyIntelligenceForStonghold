import {createPlanner as makeEconomist} from './policy.mjs';
import {makePositioner} from './positions.mjs';
import {wrapCommands} from '../selector/commands.mjs';

export function createPlanner(config) {
  return wrapCommands(makeEconomist({normalPlans:5,bossPlans:12,pairPlus:13,
    focusStrength:.55,formationJitter:18,learnBuy:.88,learnField:4,sellDown:2,
    shopFocus:.7,commodity:1,cardPolicy:true,positioner:makePositioner,...config}),config.gd);
}
