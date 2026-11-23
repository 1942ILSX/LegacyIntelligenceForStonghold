import {createPlanner as incumbent,seatProfile} from '../../../win80/stage-three-player.mjs';
import {withCampaignEconomy} from '../../../win80-economy/campaign/integration/market-policy.mjs';
import {withSchedule} from '../../market-schedule.mjs';
import {withVerifiedMisery} from '../../../win80-strategies/command-lesson/verified-misery.mjs';
import {withFollowerDraft} from '../../../win80-strategies/follower-draft/player.mjs';
import {readFileSync} from 'node:fs';
const weights=JSON.parse(readFileSync(new URL('./weights.json',import.meta.url)));
export {seatProfile};
export function createPlanner(cfg){
  const makeEconomy=options=>withCampaignEconomy(incumbent,options);
  const makeOpening=makeEconomy;
  const base=makeOpening;
  let player=base(cfg);
  player=withSchedule(player,{...cfg,marketPolicy:weights['market-schedule']});
  player=withVerifiedMisery(player,cfg);
  player=withFollowerDraft(player,cfg.gd,{mode:'manual'});
  return player;
}
