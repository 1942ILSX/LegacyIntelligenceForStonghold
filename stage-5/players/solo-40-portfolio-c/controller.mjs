import fs from 'node:fs';
import {createPlanner as specialist,seatProfile} from './specialist.mjs';
export {seatProfile};
const weights=JSON.parse(fs.readFileSync(new URL('./extensions/win40/value/terminal.json',import.meta.url),'utf8')).weights;
const opening=JSON.parse(fs.readFileSync(new URL('./extensions/win40/value/routing.json',import.meta.url),'utf8'));
export function createPlanner(cfg) {
  let current;
  function policy(s) {
    if(current) return current;
    const logit=opening.bias+(opening.boss[s.boss]??0)+(opening.stage[s.stage]??0);
    // The INFO_CHECK phase exposes both the leader and the core-bond offers.
    // The same router can start with an inherited lineup and keep its chosen band.
    const useUrsus=cfg.fixedRoute?cfg.fixedRoute==='ursus':logit>0;
    const opts=useUrsus?opening.ursus:opening.arcane;
    function terminalPriority(state,piece){
      const base=piece.baseId??piece.chessId;
      const global=weights['u/'+base]??0;
      const specific=weights[state.boss+'/'+base]??0;
      const elite=piece.isGolden?(weights['e/'+base]??0):0;
      const phase=Math.min(1,Math.max(0,(state.r-4)/6));
      return phase*(cfg.terminalWeight??140)*(global+specific+elite);
    }
    current=specialist({...cfg,...opts,band:cfg.band??'auto',terminalPriority});
    return current;
  }
  return {decide(need,s){return policy(s).decide(need,s);},ack(status){current?.ack?.(status);}};
}
