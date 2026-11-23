import {readFileSync} from 'node:fs';
import {createPlannerWithEconomy,seatProfile} from '../win80-economy-r1/extend.mjs';
import {withScopeRoute} from '../win80-economy-r1/scope-route.mjs';
import {withLegalAssignment} from './portfolio.mjs';
export {seatProfile};

const weights=JSON.parse(readFileSync(new URL('./recruitment-1.json',import.meta.url)));
export function marginalRecruitment(gd,cfg){
  const w=k=>weights[k]||0;
  let previous,owned=new Map(),board=new Map(),roles=new Map(),cache=new Map();
  function update(s){
    previous=s;owned=new Map();board=new Map();roles=new Map();cache=new Map();
    for(const p of s.pieces){
      if(p[2]!=='chess')continue;
      const rec=gd.chess(p[1]);if(!rec)continue;
      owned.set(p[1],1+(owned.get(p[1])||0));
      if(p[3]!=='b')continue;
      board.set(p[1],1+(board.get(p[1])||0));
      roles.set(rec.profession,1+(roles.get(rec.profession)||0));
    }
  }
  return function priority(s,r){
    if(s.r<(cfg.recruitFrom??5)||!r?.charId)return 0;
    if(previous!==s)update(s);
    const id=r.chessId,who=r.charId,role=r.profession;
    if(cache.has(id))return cache.get(id);
    const promotion=.8*w('elite/'+who)+.7*w('eliteRole/'+role);
    const roleBefore=Math.max(0,(roles.get(role)||0)-(board.has(id)?1:0));
    const specialist=w(who)+.50*w('boss/'+s.boss+'/'+who)+.32*w('band/'+s.band+'/'+who);
    const roleValue=.60*w('role/'+role)+.50*w('bossRole/'+s.boss+'/'+role)+
      (roleBefore===0?.65*w('first/'+role):roleBefore===1?.40*w('two/'+role):0);
    const copies=owned.get(id)||0,needed=gd.mergeCount(id);
    const promotionChance=r.isGolden?1:copies&&copies+1>=needed?.85:copies?.27:.05;
    const phase=.32+.68*Math.min(1,(s.r-4)/7);
    const value=phase*(cfg.recruitWeight??110)*(specialist+roleValue+promotionChance*promotion);
    const bounded=Math.max(-27,Math.min(27,value));
    cache.set(id,bounded);return bounded;
  };
}
export function createPlanner(cfg){
  const direct=marginalRecruitment(cfg.gd,cfg);
  return withLegalAssignment(withScopeRoute(settings=>createPlannerWithEconomy(settings,{planPriority:direct}),cfg),cfg);
}
