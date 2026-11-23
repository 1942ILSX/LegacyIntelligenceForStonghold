const step={RIGHT:[0,1],LEFT:[0,-1],UP:[1,0],DOWN:[-1,0]};
const loc=(r,c)=>r+','+c;
const distance=(a,b)=>Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);
const at=(plan,r,c)=>plan.find(x=>x[1]===r&&x[2]===c);
const direction=(a,b)=>Object.keys(step).find(k=>a[1]+step[k][0]===b[1]&&a[2]+step[k][1]===b[2]);
const byId=p=>new Map(p.map(g=>[g[0],g]));
function relocation(s,plan,id,row,col){
  const place=plan.find(p=>p[0]===id);if(!place)return false;
  const allowed=(u,r,c)=>s.legal[u]?.includes(loc(r,c));
  if(!allowed(id,row,col))return false;
  const occupant=at(plan,row,col);
  if(occupant&&occupant!==place){
    if(!allowed(occupant[0],place[1],place[2]))return false;
    [occupant[1],occupant[2]]=[place[1],place[2]];
  }
  place[1]=row;place[2]=col;return true;
}
function facePartner(gd,s,base,first,second){
  const plans=base.map(g=>g.slice()),bodies=byId(s.pieces);
  const sources=plans.filter(g=>first(gd.chess(bodies.get(g[0])?.[1]),g));
  const targets=plans.filter(g=>second(gd.chess(bodies.get(g[0])?.[1]),g));
  if(!sources.length||!targets.length)return plans;
  for(const from of sources){
    const moves=[];
    for(const t of targets){
      if(t[0]===from[0])continue;
      for(const [d,[dr,dc]] of Object.entries(step)){
        const r=from[1]+dr,c=from[2]+dc;
        if(!s.legal[t[0]]?.includes(loc(r,c)))continue;
        const occupied=at(plans,r,c);
        if(occupied&&occupied[0]!==t[0]&&!s.legal[occupied[0]]?.includes(loc(t[1],t[2])))continue;
        moves.push({id:t[0],r,c,d,cost:Math.abs(t[1]-r)+Math.abs(t[2]-c)+(d===from[3]?0:1.1)+(occupied&&occupied[0]!==t[0]?1:0)});
      }
    }
    moves.sort((a,b)=>a.cost-b.cost);
    if(moves[0]&&relocation(s,plans,moves[0].id,moves[0].r,moves[0].c))from[3]=moves[0].d;
  }
  return plans;
}
const cleanName=a=>a?.name?.replaceAll('精锐','');
const fishOrder={'克莱门莎':120,'乌尔比安':92,'浊心斯卡蒂':84,'水月':75,'斯卡蒂':68,'归溟幽灵鲨':66,'幽灵鲨':62,'深巡':50,'安哲拉':48,'歌蕾蒂娅':56};
function devour(gd,s,base,v){
  const pieces=byId(s.pieces),records=new Map(base.map(g=>[g[0],gd.chess(pieces.get(g[0])?.[1])]));
  const fish=base.filter(g=>records.get(g[0])?.bonds?.includes('egirShip'));
  if(fish.length<3)return base;
  const ordered=fish.slice().sort((a,b)=>{
    const score=g=>(fishOrder[cleanName(records.get(g[0]))]??40)+pieces.get(g[0])[8]*20+pieces.get(g[0])[7].length*5;
    return score(b)-score(a);
  });
  const mouth=ordered[v%5===4&&ordered.length>3?1:0],limit=Math.min(ordered.length,v%4===3?6:4);
  let beam=[{path:[mouth.slice()],used:new Set([mouth[0]]),cells:new Set([loc(mouth[1],mouth[2])]),score:0}];
  const metric=g=>g[1]+g[2]*.35;
  // Find connected legal placements. Bound the beam independently of board size.
  for(let d=1;d<limit;d++){
    const next=[];
    for(const record of beam){
      const tail=record.path.at(-1);
      for(const g of ordered){
        if(record.used.has(g[0]))continue;
        for(const [facing,[dr,dc]] of Object.entries(step)){
          const r=tail[1]+dr,c=tail[2]+dc,k=loc(r,c);
          if(record.cells.has(k)||!s.legal[g[0]]?.includes(k))continue;
          const originals=base.find(z=>z[0]===tail[0]);
          const score=record.score+6-.63*(Math.abs(g[1]-r)+Math.abs(g[2]-c))
            +(facing===originals[3]?(d===1?3.2:1.2):0)+Math.max(0,(records.get(g[0])?.stats?.atk||0)/1300)-.06*Math.abs(metric(g)-metric([0,r,c]));
          next.push({path:[...record.path.slice(0,-1),[tail[0],tail[1],tail[2],facing],[g[0],r,c,g[3]]],used:new Set([...record.used,g[0]]),cells:new Set([...record.cells,k]),score});
        }
      }
    }
    if(!next.length)break;
    next.sort((a,b)=>b.score-a.score);beam=next.slice(0,8);
  }
  for(const best of beam){
    if(best.path.length<2)continue;
    const plan=best.path.map(g=>g.slice()),used=new Set(best.cells);let legal=true;
    for(const g of base){
      if(best.used.has(g[0]))continue;
      if(!used.has(loc(g[1],g[2]))){plan.push(g.slice());used.add(loc(g[1],g[2]));continue;}
      const alt=(s.legal[g[0]]||[]).filter(k=>!used.has(k)).map(k=>k.split(',').map(Number)).sort((a,b)=>Math.abs(a[0]-g[1])+Math.abs(a[1]-g[2])-Math.abs(b[0]-g[1])-Math.abs(b[1]-g[2]))[0];
      if(!alt){legal=false;break;}
      plan.push([g[0],...alt,g[3]]);used.add(loc(...alt));
    }
    if(legal)return plan;
  }
  return base;
}
export function guidePosition(gd,s,plan,v,build){
  if(!plan.length)return plan;
  if(build==='abyss'&&v%5!==0)return devour(gd,s,plan,v);
  if(build==='iberia'&&(v%4!==0||s.r<12))return facePartner(gd,s,plan,a=>cleanName(a)==='旅骨',a=>cleanName(a)==='海沫');
  return plan;
}
