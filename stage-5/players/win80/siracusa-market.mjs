import {createPlanner as stage,seatProfile} from './stage-deployment.mjs';
export {seatProfile};
const lappland='chess_char_1_18_a',honeysuckle='chess_char_3_13_a',encore='chess_char_2_07_a';

export function withSiracusaMarket(make,cfg){
  let actor=make(cfg),round=-1,refreshes=0,knownRound=false,delegated=false;
  let waiting=[],ownedAction=false,blocked=new Set(),initialized=false;
  const mode=cfg.siracusaMarket;
  function issue(move){
    waiting=[move];ownedAction=true;delegated=false;
    return {moves:waiting};
  }
  return {decide(need,s){
    if(s.r!==round){
      knownRound=initialized||s.r<=1;round=s.r;refreshes=0;blocked.clear();
    }
    initialized=true;ownedAction=false;delegated=false;waiting=[];
    const shopping=mode&&s.band==='band_siracusa'&&need==='prep'&&s.r<14&&!s.choice&&!s.draft&&
      !s.reward.some(r=>r&&!r[4]);
    const room=shopping&&s.pieces.filter(p=>p[3]==='h').length<s.hand;
    if(room&&mode==='harvest'){
      const bodies=s.pieces.filter(p=>p[2]==='chess');
      const copies=id=>bodies.filter(p=>p[1]===id).length;
      const elite=id=>bodies.some(p=>cfg.gd.baseIdOf(p[1])===id&&p[8]);
      const buys=s.shop.map((o,slot)=>{
        if(!o||o[3]||o[1]!=='chess'||o[2]>s.funds||blocked.has('g.buy/'+slot))return null;
        const id=o[0];let weight=0;
        if(id===lappland&&(s.r<=6||s.funds>=o[2]+2||copies(id)===2))weight=22+(copies(id)===2?10:0);
        if(id===honeysuckle&&s.r<=11&&(!elite(id)||copies(id)===2)&&s.funds>=o[2]+1)weight=20;
        if(id===encore&&s.r<=8&&!bodies.some(p=>cfg.gd.baseIdOf(p[1])===id))weight=25;
        return weight?{slot,weight}:null;
      }).filter(Boolean).sort((a,b)=>b.weight-a.weight||a.slot-b.slot);
      if(buys.length)return issue({t:'g.buy',slot:buys[0].slot});
    }
    const reply=actor.decide(need,s);
    const finishing=reply.candidates?.length||reply.moves?.some(m=>m.t==='g.ready');
    if(room&&finishing&&!s.frozen&&!blocked.has('g.refresh/')&&
       (s.free>0||knownRound&&refreshes===0&&s.refresh<=1&&s.funds>=s.refresh)){
      // The previous planner may already have marked its last formation as
      // submitted. Rebind on the actual resulting shop and board.
      actor=make(cfg);
      return issue({t:'g.refresh'});
    }
    if(shopping&&reply.moves?.length)waiting=reply.moves;
    delegated=true;return reply;
  },ack(status){
    for(let i=0;i<waiting.length;i++){
      const m=waiting[i];
      if(status[i]==='ok'&&m.t==='g.refresh')refreshes++;
      if(ownedAction&&status[i]!=='ok')blocked.add(m.t+'/'+(m.slot??''));
    }
    if(delegated)actor.ack?.(status);
  }};
}
export const createPlanner=cfg=>withSiracusaMarket(stage,cfg);
