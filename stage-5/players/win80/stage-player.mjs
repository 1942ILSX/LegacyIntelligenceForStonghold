import {createPlanner as original,seatProfile} from './standalone-scope.mjs';
import {createPlanner as regional} from './leithania.mjs';
import {createPlanner as marginal} from './recruitment.mjs';
import {createPlanner as elite} from '../win80-strategies/weakness-r1.mjs';
import {withMatrixRoute} from '../win80-economy/matrix-route.mjs';
import {withMatrixPacedRoute} from '../win80-economy/matrix-paced-route.mjs';
import {withScopeRoute} from '../win80-economy-r1/scope-route.mjs';
import {withLegalAssignment} from './portfolio.mjs';
export {seatProfile};

// Select an economy from the observed strategy, including strategies inherited at handoff.
// Only the autonomous opening is allowed to replace a strategy before its first selection.
function strategyPlayer(cfg){
  let player,bound=false;
  function bind(band){
    const opt={...cfg,band};
    if(band==='band_weakness'&&cfg.stageElite)
      return elite({...opt,passiveRecruit:['D','P'].includes(cfg.stageElite),passiveTeam:['D','T'].includes(cfg.stageElite)});
    if(cfg.stageLeithBands?.includes(band))return regional(opt);
    if(cfg.stageMarginalBands?.includes(band))return marginal(opt);
    return original(opt);
  }
  return {decide(phase,s){
    const assigned=s.band||((cfg.band&&cfg.band!=='auto')?cfg.band:null);
    if(!player&&assigned){player=bind(assigned);bound=true;}
    player??=original(cfg);
    const reply=player.decide(phase,s);
    if(bound||phase!=='band')return reply;
    const proposed=reply.moves?.[0]?.bandId;
    if(!proposed)return reply;
    const change=proposed==='band_ursus'?cfg.stageUrsus:
      proposed==='band_amiya'?cfg.stageAmiya:null;
    const chosen=change&&s.bands.includes(change)&&!cfg.gd.bandBondIds(change).length?change:proposed;
    bound=true;
    if(chosen===proposed&&!cfg.stageLeithBands?.includes(chosen)&&!cfg.stageMarginalBands?.includes(chosen)&&
       !(chosen==='band_weakness'&&cfg.stageElite))return reply;
    player=bind(chosen);
    return player.decide(phase,s);
  },ack(status){player?.ack?.(status);}};
}

export function createPlanner(cfg){
  const matrix=cfg.stageMatrix==='paced'?withMatrixPacedRoute:withMatrixRoute;
  const nonMech=cfg.stageMatrix?settings=>matrix(strategyPlayer,settings):strategyPlayer;
  return withLegalAssignment(withScopeRoute(nonMech,cfg),cfg);
}
