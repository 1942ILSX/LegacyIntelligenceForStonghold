import {createPlanner as base,seatProfile} from './stage-deployment.mjs';
import {withCovenantSelection} from './covenant-player.mjs';
import {withMidgameEconomy} from './midgame-choice.mjs';
import {withSiracusaMarket} from './siracusa-market.mjs';
import {withLateBounty} from './late-bounty.mjs';
import {withEarlyLeithania} from './early-leithania.mjs';
import {withNaturalPortfolio} from '../win80-strategies/natural-portfolio.mjs';
export {seatProfile};

export function createPlanner(cfg){
  const economy=options=>options.midgameModel?withMidgameEconomy(base(options),options):base(options);
  const school=options=>options.earlyLeithania?withEarlyLeithania(economy,options):economy(options);
  const market=options=>options.siracusaMarket?withSiracusaMarket(school,options):school(options);
  const choices=options=>options.lateBounty?withLateBounty(market(options),options):market(options);
  const opening=options=>options.openingPortfolio?withNaturalPortfolio(choices,options):choices(options);
  return cfg.covenantModel?withCovenantSelection(opening,cfg):opening(cfg);
}
