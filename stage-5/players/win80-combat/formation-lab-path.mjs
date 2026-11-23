import {Grid} from '../../engine/v0.4.0/server/sim/grid.js';
import {GEO} from '../../engine/v0.4.0/shared/constants.js';
import {BOSS_ROW_OFFSET,COLS} from '../../engine/v0.4.0/server/sim/constants.js';
import {bodyKeys} from '../../engine/v0.4.0/server/sim/body.js';

const cached=new WeakMap();
export function publicBossPath(gd,view){
 const s=view.s,raw=gd.raw;
 if(!cached.has(raw))cached.set(raw,new Map());
 const key=s.stage+'/'+s.boss,known=cached.get(raw);if(known.has(key))return known.get(key);
 const boss=gd.boss(s.boss),wave=gd.wave(boss.templates[gd.modeId].template);
 const spawn=wave.spawns.find(x=>x.key===boss.enemyKey),route=wave.routes[spawn.routeIndex],enemy=gd.enemy(boss.enemyKey);
 const pieces=new Map(),marker=(r,c,late,weight)=>{
  const x=c,y=r-BOSS_ROW_OFFSET,keys=bodyKeys({x:c,y:r,hitArea:enemy?.hitArea}).map(k=>(Math.floor(k/COLS)-BOSS_ROW_OFFSET)*32+k%COLS);
  const k=[x,y,late,keys.join(',')].join('/'),o=pieces.get(k);
  if(o)o.n+=weight;else pieces.set(k,{x,y,late,held:0,keys,n:weight});
 };
 const checkpoints=route.checkpoints||[];
 if(!checkpoints.length){
   marker(route.start[0],route.start[1],0,.58);marker(route.start[0],route.start[1],1,.42);
 }else{
  const stage=gd.stage(s.stage),grid=new Grid({...stage,legend:stage.tiles},GEO.BOSS_RECT);
  for(const d of stage.devices||[])if(d.active&&d.pos&&['crate','platform','mound'].includes(d.role))grid.setObstacle(...d.pos,true,d.role==='crate'?'crate':'block');
  function segment(a,b){if(route.motion!=='FLY')return grid.findPath(...a,...b)||[a,b];return [a,b];}
  function walk(from,to){
    const p=segment(from,to),res=[];
    for(let i=1;i<p.length;i++){
      const [r,c]=p[i-1],[nr,nc]=p[i],n=Math.max(1,Math.ceil(Math.hypot(nr-r,nc-c)*2));
      for(let j=0;j<n;j++)res.push([r+(nr-r)*j/n,c+(nc-c)*j/n]);
    }
    return res;
  }
  const first=walk(route.start,checkpoints[0]);
  const loop=checkpoints.flatMap((v,i)=>walk(v,checkpoints[(i+1)%checkpoints.length]));
  for(const [r,c] of first)marker(r,c,0,.14/Math.max(1,first.length));
  for(const [r,c] of loop){marker(r,c,0,.46/Math.max(1,loop.length));marker(r,c,1,.40/Math.max(1,loop.length));}
 }
 const poses=[...pieces.values()],result={poses,steps:poses.reduce((t,x)=>t+x.n,0),credits:{},hurt:{},deaths:{},blocks:{},present:{}};
 known.set(key,result);return result;
}
