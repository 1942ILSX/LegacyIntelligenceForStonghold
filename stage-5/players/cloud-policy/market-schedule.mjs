import {createPlanner as incumbent,seatProfile} from '../win80/stage-three-player.mjs';
export {seatProfile};

const curves={
  ordinary:{},
  rollTwo:{caps:[[6,2],[9,3],[11,4]]},
  rollThree:{caps:[[8,3],[11,4]]},
  slowFour:{caps:[[3,2],[7,3],[14,4]]},
  fastFour:{goals:[[2,2],[4,3],[6,4]]},
  fastFive:{goals:[[2,2],[4,3],[5,4],[8,5]]},
  fiveThenSix:{goals:[[3,2],[5,3],[7,4],[9,5],[11,6]]},
};

export function marketOpening(gd,s){
  const f={bias:1,['band/'+s.band]:1,['stage/'+s.stage]:.6,['boss/'+s.boss]:1};
  const own=s.pieces.filter(p=>p[2]==='chess');
  const group=s.groups[s.picked]||[];
  for(const id of group)f['core/'+id]=.6;
  for(const id of s.disabledBonds)f['off/'+id]=.35;
  for(const id of s.factions)f['enemy/'+id]=.55;
  for(const p of own)f['owned/'+p[1]]=.9;
  for(const slot of s.shop)if(slot&&!slot[3])f['shelf/'+slot[0]]=.7;
  const off=new Set(s.disabledBonds),bans=new Set(s.bannedChess||[]);
  const market=[...Object.values(gd.raw.chess)].filter(u=>!u.isGolden&&!u.isHidden&&!u.diyFor && u.tier<=5 &&
    !bans.has(u.chessId)&&!gd.bondsExclude(u,off));
  for(const u of market){
    if(u.tier<=3)f['available/'+u.chessId]=.24;
    for(const b of u.bonds||[])if(!off.has(b))f['tier'+u.tier+'/'+b]=(f['tier'+u.tier+'/'+b]||0)+.15;
  }
  f.health=s.lp/30-1;f.openingFunds=s.funds/5-1;
  return f;
}

export function withSchedule(base,cfg){
  let curve=null,route=null,round=0,refused=false,own=false,registration;
  return {decide(need,s){
    own=false;
    if(!curve&&need==='prep'){
      const features=marketOpening(cfg.gd,s);
      route=cfg.marketArm||'ordinary';
      if(cfg.marketPolicy && !cfg.marketArm){
        let best=cfg.marketPolicy.margin;
        for(const [arm,w] of Object.entries(cfg.marketPolicy.weights)){
          const v=Object.entries(features).reduce((n,[key,val])=>n+(w[key]||0)*val,0);
          if(v>best){best=v;route=arm;}
        }
      }
      if(!Object.hasOwn(curves,route))throw Error('Unknown market schedule');
      curve=curves[route];registration={route,features};
    }
    if(round!==s.r){round=s.r;refused=false;}
    let result;
    if(need==='prep' && curve && !s.choice && !s.draft && !s.reward.some(x=>x&&!x[4])){
      const cap=curve.caps?.find(([until])=>s.r<=until)?.[1]??s.maxLv;
      const goal=curve.goals?.filter(([from])=>from<=s.r).at(-1)?.[1]??0;
      const field=s.pieces.filter(p=>p[2]==='chess'&&p[3]==='b');
      const enough=field.length>=Math.min(4,s.r+1) || s.up===0;
      if(!refused && s.level<Math.min(s.maxLv,goal) && s.up<=s.funds && enough){
        own=true;result={moves:[{t:'g.levelUp'}]};
      }else{
        // Restrict only the incumbent's upgrade candidates. It continues to
        // receive the real level, units, shop, money, and prices.
        result=base.decide(need,cap<s.maxLv?{...s,maxLv:Math.max(s.level,cap)}:s);
      }
    }else result=base.decide(need,s);
    if(registration){result={...result,macroDecision:registration};registration=null;}
    return result;
  },ack(status){if(own){if(status[0]!=='ok')refused=true;}else base.ack?.(status);}};
}
export const createPlanner=cfg=>withSchedule(incumbent(cfg),cfg);
