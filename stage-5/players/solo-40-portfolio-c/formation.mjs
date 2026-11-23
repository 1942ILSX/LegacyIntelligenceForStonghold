export function placeFormation(ps, goals, apply) {
  const ids = new Set(goals.map(g => g[0]));
  if (ids.size !== goals.length || new Set(goals.map(g => g[1] + ',' + g[2])).size !== goals.length) throw Error('Invalid joint formation');
  const move=(uid,row,col,dir)=>apply({t:'g.move',uid,to:{area:'board',row,col},dir});
  const park=uid=>{
    const idx=ps.hand.findIndex(v=>!v);
    return idx>=0 && apply({t:'g.move',uid,to:{area:'hand',idx}}).ok;
  };
  const onboard=(g)=>{const l=ps.find(g[0]);return l?.area==='board'&&l.key===g[1]+','+g[2]&&(l.piece.dir||'RIGHT')===g[3];};
  for(const [,body] of [...ps.board]){
    if(ids.has(body.uid))continue;
    if(park(body.uid))continue;
    if(body.kind!=='chess')continue;
    const old=ps.find(body.uid);if(old?.area!=='board')continue;
    const [rr,cc]=old.key.split(',').map(Number);
    for(const g of goals){const l=ps.find(g[0]);
      if(l?.area==='hand' && l.piece.kind==='chess' && ps._legal(l.piece,rr,cc) && move(g[0],rr,cc,g[3]).ok)break;
    }
  }
  for(let turn=0;turn<3;turn++){
    let improved=false;
    for(const g of goals){
      if(onboard(g))continue;
      const [uid,r,c,di]=g, loc=ps.find(uid);
      if(!loc||!ps._legal(loc.piece,r,c))continue;
      const occ=ps.board.get(r+','+c);
      if(loc.piece.kind==='token'&&occ&&occ.uid!==uid)continue;
      if(loc.piece.kind==='chess'&&loc.area!=='board'&&occ?.kind!=='chess'&&ps.deployCount>=ps.deployCap)continue;
      if(occ && occ.uid!==uid && loc.area==='board'){
        const [sr,sc]=loc.key.split(',').map(Number);
        if(!ps._legal(occ,sr,sc)){
          if(!park(occ.uid))continue;
        }
      }
      if(move(uid,r,c,di).ok)improved=true;
    }
    if(!improved)break;
  }
  const realized=goals.filter(onboard).length;
  return realized;
}
