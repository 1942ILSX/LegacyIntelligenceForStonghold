import {createPlanner as base,seatProfile} from './stage-deployment.mjs';
export {seatProfile};

export function bountyCondition(gd,life,board){
  const power=board.reduce((n,id)=>{
    const r=gd.raw.chess[id];return n+((r?.tier??1)+1)*(r?.isGolden?1.55:1);
  },0);
  return [1,Math.min(1.6,life/25)-.72,Math.min(1.6,power/32)-.75];
}
export function preferredBounty(model,menu,original,x){
  const utility=id=>{
    const w=model.weights[id];return w?w.reduce((v,n,i)=>v+n*x[i],0):0;
  };
  let chosen=original,best=utility(original)+model.margin;
  for(const id of menu){
    const value=utility(id);
    if(model.support[id]>=model.minimumSupport&&value>best){best=value;chosen=id;}
  }
  return chosen;
}
export function withLateBounty(player,cfg){
  let issued=false;
  return {decide(need,s){
    const reply=player.decide(need,s),m=reply.moves?.[0],model=cfg.lateBounty;
    if(issued||!model||s.r!==9||m?.t!=='g.choice')return reply;
    const cards=(s.choice?.cards||s.cards).filter(c=>c&&!c[3]&&c[4]<=s.funds);
    if(cards.length<2||cards.some(c=>c[2]!=='bounty'))return reply;
    const original=cards.find(c=>c[0]===m.idx);if(!original)return reply;
    const x=bountyCondition(cfg.gd,s.lp,s.pieces.filter(p=>p[2]==='chess'&&p[3]==='b').map(p=>p[1]));
    const selected=preferredBounty(model,cards.map(c=>c[1]),original[1],x);
    issued=true;
    return selected===original[1]?reply:{...reply,moves:[{...m,idx:cards.find(c=>c[1]===selected)[0]}]};
  },ack(status){player.ack?.(status);}};
}
export const createPlanner=cfg=>withLateBounty(base(cfg),cfg);
