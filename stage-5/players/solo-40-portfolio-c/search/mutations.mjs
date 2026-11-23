// Local edits are ordered by coverage of the previous detached fight. One
// candidate from each edit family is tried before a second from the same family.
const DIRS=['RIGHT','DOWN','LEFT','UP'];
const signature = plan => plan.map(x=>x.join('/')).sort().join('|');
export {signature};

export function proposeEdits(s, seat, plan, heat, limit, rangeTiles, rangeRec, bossRowOffset, isBoss) {
  const occupied=new Map(plan.map((g,i)=>[g[1]+','+g[2],i]));
  const chosen=new Set(plan.map(g=>g[0]));
  const locked=new Set();
  for(const [uid,owner] of seat.protectedTokens) if(chosen.has(uid)) { locked.add(uid); locked.add(owner); }
  const options={bench:[],move:[],rotate:[],swap:[]};
  const scores=new Map();
  function score(uid,r,c,dir) {
    const key=[uid,r,c,dir].join('/');
    if(scores.has(key))return scores.get(key);
    const piece=seat.original.get(uid), rec=rangeRec(seat.ps,seat.ps.gd.chess(piece.id));
    if(!rec || piece.kind!=='chess')return 0;
    const stageRow=isBoss?r+bossRowOffset:r;
    const coverage=rangeTiles(rec,stageRow,c,dir);
    const stats=rec.stats||{};
    let exposure=0;
    if(rec.attackKind==='heal' || rec.profession==='MEDIC') {
      for(const g of plan) if(g[0]!==uid && coverage.includes((isBoss?g[1]+bossRowOffset:g[1])+','+g[2])) exposure+=.035;
    } else {
      for(const key of coverage) exposure+=heat.get(key)||0;
    }
    const power=Math.max(1,stats.atk||1)*(1+0.15*(piece.items?.length||0))/Math.max(.5,stats.bat||1);
    const value=power*exposure;
    scores.set(key,value);
    return value;
  }
  function add(family,edit,gain) {
    options[family].push({edit,gain});
  }
  function bestDirection(uid,r,c) {
    let best=DIRS[0];
    for(const dir of DIRS.slice(1)) if(score(uid,r,c,dir)>score(uid,r,c,best))best=dir;
    return best;
  }
  const bench=[...seat.original.values()].filter(p=>p.kind==='chess' && !chosen.has(p.uid));
  for(let i=0;i<plan.length;i++) {
    const [uid,r,c,dir]=plan[i], spot=r+','+c;
    if(locked.has(uid) || seat.original.get(uid)?.kind!=='chess')continue;
    const value=score(uid,r,c,dir);
    for(const turn of DIRS) if(turn!==dir)
      add('rotate',[[i,[uid,r,c,turn]]],score(uid,r,c,turn)-value);
    for(const coord of s.legal[uid]||[]) {
      if(coord===spot)continue;
      const [nr,nc]=coord.split(',').map(Number), j=occupied.get(coord);
      const nd=bestDirection(uid,nr,nc);
      if(j===undefined) {
        add('move',[[i,[uid,nr,nc,nd]]],score(uid,nr,nc,nd)-value);
      } else if(i<j) {
        const [buddy,br,bc,bd]=plan[j];
        if(locked.has(buddy)||seat.original.get(buddy)?.kind!=='chess'||!s.legal[buddy]?.includes(spot))continue;
        const turn=bestDirection(buddy,r,c);
        add('swap',[[i,[uid,nr,nc,nd]],[j,[buddy,r,c,turn]]],
            score(uid,nr,nc,nd)+score(buddy,r,c,turn)-value-score(buddy,br,bc,bd));
      }
    }
    for(const incoming of bench) {
      if(!s.legal[incoming.uid]?.includes(spot))continue;
      const turn=bestDirection(incoming.uid,r,c);
      add('bench',[[i,[incoming.uid,r,c,turn]]],score(incoming.uid,r,c,turn)-value);
    }
  }
  const families=Object.values(options).map(list=>list.sort((a,b)=>b.gain-a.gain));
  const output=[], seen=new Set([signature(plan)]);
  for(let level=0;output.length<limit&&families.some(x=>x.length>level);level++) {
    for(const family of families) {
      if(output.length>=limit||level>=family.length)continue;
      const out=plan.slice();
      for(const [i,slot] of family[level].edit)out[i]=slot;
      const key=signature(out);
      if(!seen.has(key)){seen.add(key);output.push(out);}
    }
  }
  return output;
}
