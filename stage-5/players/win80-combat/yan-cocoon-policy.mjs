const amiya='band_amiya', jessica='band_jesica';
export function withYanCocoonJessica(make,cfg,{apply=true,onDraft=null}={}){
 let player=make(cfg),observed=false,autonomousOpening=false,handled=false;
 const explicit=[cfg.band,cfg.assignedBand].some(x=>x&&x!=='auto');
 if(explicit)return player;
 return {decide(need,s){
  const original=player.decide(need,s),move=original.moves?.[0];
  if(!observed){
   observed=true;autonomousOpening=need==='opening'&&s.r<=1&&s.picked===null&&move?.t==='g.bondGroup';
  }
  if(!autonomousOpening||handled||need!=='band'||s.band||move?.t!=='g.band')return original;
  handled=true;
  const yan=!!s.groups?.[s.picked]?.includes('yanShip'),spider=s.boss==='boss_12';
  const legal=s.bands.includes(jessica)&&cfg.gd.bandBondIds(jessica).every(b=>s.groups[s.picked].includes(b)&&!s.disabledBonds.includes(b));
  const eligible=spider&&yan&&move.bandId===amiya&&legal;
  const audit={boss:s.boss,side:s.picked,yan,legal,original:move.bandId,eligible,selected:move.bandId};
  if(!eligible||!apply){onDraft?.(audit);return original;}
  player=make({...cfg,band:jessica});
  const chosen=player.decide(need,s);
  if(chosen.moves?.[0]?.t!=='g.band'||chosen.moves[0].bandId!==jessica)throw Error('Jessica draft was not acknowledged by her released controller');
  audit.selected=jessica;onDraft?.(audit);return chosen;
 },ack(status){player.ack?.(status);}};
}
