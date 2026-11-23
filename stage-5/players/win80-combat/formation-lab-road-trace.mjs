/** Heat represents enemies that actually survived a private, independent forecast of the visible wave. */
export function observeRoadThreat(){
 let battle=null,second=-1,steps=0;
 const enemies=new Map(),leaks=new Set(),credits={},hurt={},present={},blocks={};
 const inc=(m,k,v)=>{if(k!=null)m[k]=(m[k]||0)+v;};
 function observe(b){
  battle=b;
  b.on('enemyLeak',({enemy})=>{if(enemy.counted)leaks.add(enemy.id);},{priority:-1000});
  b.on('hpChanged',({target,credit,delta})=>{
   if(!(delta<0))return;
   if(target.side==='enemy')inc(credits,credit?.ownerUnit?.uid??credit?.uid,-delta);
   else inc(hurt,target.ownerUnit?.uid??target.uid,-delta);
  },{priority:-1000});
  b.on('tick',()=>{
   const sec=Math.floor(b.time*1.0);if(sec===second)return;second=sec;steps++;
   for(const a of b.allyUnits)if(a.alive&&a.deployed)inc(present,a.ownerUnit?.uid??a.uid,1);
   for(const e of b.enemies){
    if(!e.alive||!e.deployed||!e.counted||e.mem?.noLeak)continue;
    let sample=enemies.get(e.id);
    if(!sample){sample={e,air:Number(e.isFlying),first:e.y,def:e.s.def||0,res:e.s.res||0,poses:[]};enemies.set(e.id,sample);}
    const x=Math.round(2*e.x)/2,y=Math.round(2*e.y)/2;
    sample.poses.push({x,y,hp:Math.min(1,e.hp/Math.max(1,e.s.maxHp)),held:Number(!!e.blockedBy)});
    if(e.blockedBy)inc(blocks,e.blockedBy.ownerUnit?.uid??e.blockedBy.uid,1);
   }
  },{priority:-1000});
 }
 function summary(){
  const atlas=new Map(),lanes=[0,0,0,0];let lost=0;
  for(const {e,air,first,def,res,poses}of enemies.values()){
   if(!poses.length)continue;
   const leaked=leaks.has(e.id)||(!e.removed&&e.alive&&!e.isBoss);
   const lane=Number(first>10.5)+2*air,end=poses.at(-1);if(leaked)lost++;
   const importance=leaked?1.2+.85*(1-end.hp):.17;
   lanes[lane]+=importance;
   for(const [i,v]of poses.entries()){
    const late=i/Math.max(1,poses.length-1),weight=importance*(.68+.64*late)/poses.length;
    const k=[v.x,v.y,lane,Number(late>.58)].join('/');let g=atlas.get(k);
    if(!g){g={x:v.x,y:v.y,lane,air,n:0,late:0,def:0,res:0,held:0,hp:0};atlas.set(k,g);}
    g.n+=weight;g.late+=weight*late;g.def+=weight*def;g.res+=weight*res;g.held+=weight*v.held;g.hp+=weight*v.hp;
   }
  }
  const poses=[...atlas.values()];for(const a of poses){a.late/=a.n;a.def/=a.n;a.res/=a.n;a.held/=a.n;a.hp/=a.n;a.keys=[Math.round(a.y)*32+Math.round(a.x)];}
  return {poses,lanes,lost,steps,credits,hurt,present,blocks,deaths:{}};
 }
 return {observe,summary};
}
