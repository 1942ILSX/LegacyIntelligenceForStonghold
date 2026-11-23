// Equivalent public geometry enumeration using cached per-piece orders across iterations.
const modes=['balanced','late','early','hold','fire','survival','spread','cluster'];
const key=(r,c)=>r*32+c;
const sig=goals=>goals.map(g=>g.join('/')).sort().join('|');
export function compactFormationProposals(ctx,origin,{width=70}={}){
 const {units,personal,totalScore}=ctx;
 const proposals=[],seen=new Set([sig(origin)]);
 const pinned=new Set(origin.flatMap(g=>ctx.ownerByToken.has(g[0])?[g[0],ctx.ownerByToken.get(g[0])]:[]));
 const sign=x=>x.map(g=>g.join('/')).sort().join('|');
 const add=(p,kind,raw,mode)=>{const id=sig(p);if(seen.has(id))return;seen.add(id);proposals.push({p,kind,raw,mode});};
 const placements=new Map();
 function local(plan,i,mode){
  const u=units.get(plan[i][0]),byCell=new Map(plan.map((g,j)=>[key(g[1],g[2]),j]));
  if(!u||pinned.has(u.p.uid))return [];
  let ranked=placements.get(u);
  if(!ranked){ranked=new Map();placements.set(u,ranked);}
  if(!ranked.has(mode))ranked.set(mode,u.entries.map(t=>({t,offset:personal(u,t,mode)})).sort((a,b)=>b.offset-a.offset));
  const kept=[],tiles=new Map();
  for(const option of ranked.get(mode)){
    const {t,offset}=option;
    const j=byCell.get(t.k), buddy=j==null||j===i?null:units.get(plan[j][0]);
    if(j!=null&&j!==i&&(!buddy||pinned.has(buddy.p.uid)))continue;
    const copy=plan.slice();copy[i]=t.g;
    if(buddy){
      const v=buddy.look.get([plan[i][1],plan[i][2],plan[j][3]].join('/'));
      if(!v)continue;copy[j]=v.g;
    }
    const v={p:copy,offset,t};
    const n=tiles.get(v.t.k)||0;
    if(n>=2&&kept.length>1)continue;
    tiles.set(v.t.k,n+1);kept.push({...v,value:totalScore(v.p,mode)});
    if(kept.length>=15)break;
  }
  return kept.sort((a,b)=>b.value-a.value);
 }
 for(const mode of modes){
  let plan=origin,score=totalScore(plan,mode),moves=0;
  for(let pass=0;pass<Math.min(5,origin.length);pass++){
    const changes=[];
    for(let i=0;i<plan.length;i++){
      const opts=local(plan,i,mode);
      if(pass===0&&mode==='balanced')for(const z of opts.slice(0,2))add(z.p,'single',z.value-score,mode);
      if(opts.length)changes.push(opts[0]);
    }
    changes.sort((a,b)=>b.value-a.value);
    const best=changes.find(v=>v.value>score+1e-7&&sign(v.p)!==sign(plan));
    if(!best)break;
    plan=best.p;score=best.value;moves++;
    if(pass===0||pass===1||pass===3)add(plan,'multi-'+(pass+1),score-totalScore(origin,mode),mode);
  }
  if(moves)add(plan,'joint',score-totalScore(origin,mode),mode);
 }
 // A real reserve can replace a low-contribution incumbent on a different tile type.
 // Reoptimise the entrant's position and direction while the remaining team stays in place.
 const onboard=new Set(origin.map(g=>g[0])),extras=[...units.values()].filter(u=>!onboard.has(u.p.uid));
 const spare=[];
 for(const u of extras){
  const poses=u.entries.slice().sort((a,b)=>personal(u,b,'balanced')-personal(u,a,'balanced'));
  for(let i=0;i<origin.length;i++){
    const before=units.get(origin[i][0]);if(!before||pinned.has(before.p.uid))continue;
    if(before.p.id===u.p.id&&before.p.items.length===u.p.items.length)continue;
    const occupied=new Set(origin.filter((_,j)=>j!==i).map(g=>key(g[1],g[2])));
    const options=poses.filter(t=>!occupied.has(t.k)).slice(0,3);
    for(const t of options){const p=origin.slice();p[i]=t.g;spare.push({p,raw:totalScore(p,'balanced')-totalScore(origin,'balanced'),pair:i+'/'+u.p.uid});}
  }
 }
 spare.sort((a,b)=>b.raw-a.raw);const pairs=new Set();
 for(const b of spare){if(pairs.has(b.pair))continue;pairs.add(b.pair);add(b.p,'reserve',b.raw,'balanced');if(pairs.size>=16)break;}
 return proposals.slice(0,width);
}
