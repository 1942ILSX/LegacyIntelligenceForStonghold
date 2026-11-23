import {createPlanner as released,seatProfile} from '../cloud-policy/revisions/solo-lv20-stage-4/player.mjs';
import {withYanCocoonJessica} from './yan-cocoon-policy.mjs';
export {seatProfile};
export function createPlanner(cfg){globalThis.__yanCocoon=null;return withYanCocoonJessica(released,cfg,{apply:true,onDraft:a=>{globalThis.__yanCocoon=a;}});}
