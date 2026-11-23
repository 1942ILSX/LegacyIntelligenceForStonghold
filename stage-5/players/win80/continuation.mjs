import {createPlanner as portfolio,seatProfile} from './portfolio.mjs';
import {createPlannerWithEconomy} from '../win80-economy/extend.mjs';
import {guidePlanner} from './guided.mjs';
import {withGrowth} from './growth.mjs';
export {seatProfile};

export function selectContinuation(model,s) {
  const board=s.pieces.filter(p=>p[2]==='chess'&&p[3]==='b'),hand=s.pieces.filter(p=>p[2]==='chess'&&p[3]!=='b');
  const count=new Map();for(const p of [...board,...hand])count.set(p[1],(count.get(p[1])||0)+1);
  const x={bias:1,hp:s.lp/28,weak:+(s.lp<=9),money:Math.min(20,s.funds)/12,level:s.level/5,
    up:Math.min(14,s.up)/10,width:board.length/8,hand:hand.length/10,
    pairs:Math.min(5,[...count.values()].filter(n=>n===2).length)/3,
    elite:board.filter(p=>p[8]).length/3,gear:board.reduce((n,p)=>n+p[7].length,0)/7,
    quality:board.reduce((n,p)=>n+(p[9]||1),0)/25,['boss/'+s.boss]:1,['band/'+s.band]:1};
  for(const [b,,l,active] of s.bonds)if(active){x['active/'+b]=.7;x['layers/'+b]=Math.min(180,l)/100;}
  let choice='keep',highest=model.margin;
  for(const [a,w] of Object.entries(model.weights)) {
    const score=Object.entries(x).reduce((sum,[key,v])=>sum+v*(w[key]||0),0);
    if(score>=highest){highest=score;choice=a;}
  }
  return choice;
}

export function continueWith(name,cfg,s) {
  const options={...cfg,band:s.band||cfg.band};
  if(name==='replan')return withGrowth(guidePlanner(options,createPlannerWithEconomy),cfg.gd,cfg);
  if(name==='flex')return withGrowth(createPlannerWithEconomy(options),cfg.gd,cfg);
  if(name==='push') {
    return withGrowth(createPlannerWithEconomy({...options,economy:{...cfg.economy,levelSpeed:3,shopCap:6,
      promoteAfterLevel:true,pairPlus:16,learnBuy:.78}}),cfg.gd,cfg);
  }
  if(name==='board') {
    return withGrowth(createPlannerWithEconomy({...options,economy:{...cfg.economy,levelSpeed:-1,
      shopCap:s.level<=3?4:5,pairPlus:23,learnBuy:.75,shopFocus:1.2}}),cfg.gd,cfg);
  }
  throw Error('Unknown continuation '+name);
}

export function createPlanner(cfg) {
  let player=portfolio(cfg), switched=false;
  return {
    decide(phase,s) {
      if(!switched && phase==='prep' && s.r>=(cfg.branchAt??7)) {
        switched=true;
        const choice=cfg.pivotModel?selectContinuation(cfg.pivotModel,s):cfg.continuation;
        if(choice && choice!=='keep')player=continueWith(choice,cfg,s);
      }
      return player.decide(phase,s);
    },
    ack(status){player.ack?.(status);},
  };
}
