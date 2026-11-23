import {createPlanner as stage,seatProfile} from './stage-deployment.mjs';
import {pieceBonds} from '../../engine/v0.4.0/server/match/bondsMeta.js';
export {seatProfile};
const core='lethaniaShip',harmony='maniShip';
function members(gd,pieces){
  const real=new Set();let assistance=false;
  for(const p of pieces){
    const bonds=pieceBonds(gd,{id:p[1],items:p[7].map(id=>({id}))});
    if(bonds.includes(core))real.add(gd.baseIdOf(p[1]));
    if(bonds.includes(harmony))assistance=true;
  }
  return {real,assistance,total:real.size+Number(real.size>0&&assistance)};
}

export function withEarlyLeithania(make,cfg){
  let player=make(cfg),own=false,bought=0,levels=0,blocked=new Set(),round=0,pending;
  const issue=move=>{own=true;pending=move;return {moves:[move]};};
  return {decide(need,s){
    const reply=player.decide(need,s),style=cfg.earlyLeithania;
    if(!style||need!=='prep'||s.r>7||s.band!=='band_amiya'||s.choice||s.draft||
      s.reward.some(t=>t&&!t[4])||s.disabledBonds.includes(core))return reply;
    if(!s.groups[s.picked]?.includes(core))return reply;
    if(round!==s.r){round=s.r;blocked=new Set();}
    const units=s.pieces.filter(p=>p[2]==='chess'),all=members(cfg.gd,units),byId=new Map(units.map(p=>[p[0],p]));
    const choices=reply.candidates;
    if(all.total>=3){
      if(!choices?.length||style!=='tempo')return reply;
      function activates(plan){return members(cfg.gd,plan.map(row=>byId.get(row[0])).filter(Boolean)).total>=3;}
      if(activates(choices[0]))return reply;
      const promoted=choices.find(activates);
      if(!promoted)return reply;
      return {...reply,formation:promoted,candidates:[promoted,...choices.filter(p=>p!==promoted)]};
    }
    const m=reply.moves?.[0],last=Boolean(choices?.length||m?.t==='g.ready');
    const economic=last||['g.buy','g.refresh','g.levelUp','g.freeze'].includes(m?.t);
    if(!economic||bought>=3||s.pieces.filter(p=>p[3]==='h').length>=s.hand)return reply;
    const offers=s.shop.flatMap((o,slot)=>{
      if(!o||o[3]||o[1]!=='chess'||o[2]>s.funds||blocked.has('buy/'+slot))return [];
      const rec=cfg.gd.chess(o[0]),id=cfg.gd.baseIdOf(o[0]),b=rec.bonds;
      const natural=b.includes(core)&&!all.real.has(id);
      const wild=style==='tempo'&&all.real.size>0&&!all.assistance&&!s.disabledBonds.includes(harmony)&&b.includes(harmony);
      return natural||wild?[{slot,score:(natural?4:1)+rec.tier+(o[0]==='chess_char_2_07_a'?1:0),price:o[2]}]:[];
    }).sort((a,b)=>b.score-a.score||a.slot-b.slot);
    if(m?.t==='g.buy'&&offers.some(o=>o.slot===m.slot))return reply;
    if(offers.length){
      const best=offers[0];
      if(m?.t==='g.buy'&&s.funds>=s.shop[m.slot][2]+best.price)return reply;
      return issue({t:'g.buy',slot:best.slot});
    }
    if(style==='tempo'&&levels<2&&!blocked.has('level')&&(m?.t==='g.refresh'||last)&&s.level<3&&
      s.r>=2*s.level&&s.funds>=s.up+1)return issue({t:'g.levelUp'});
    return reply;
  },ack(status){
    if(!own){player.ack?.(status);return;}
    if(status[0]==='ok'){
      if(pending.t==='g.buy')bought++;else levels++;
    }else blocked.add(pending.t==='g.buy'?'buy/'+pending.slot:'level');
    player=make(cfg);own=false;
  }};
}
export const createPlanner=cfg=>withEarlyLeithania(stage,cfg);
