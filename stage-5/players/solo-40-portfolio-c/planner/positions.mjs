import { rotateOffset } from '../../../engine/v0.4.0/server/sim/dir.js';

const DIRS = ['RIGHT','UP','LEFT','DOWN'];
const key = (r,c) => r*40+c;

function segment(a,b) {
  const length=Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),1);
  return Array.from({length},(_,i)=>a.map((n,j)=>Math.round(n+(b[j]-n)*i/length)));
}

function routes(gd,s) {
  const stage=gd.stage(s.stage), paths=stage?.groundPathsWithDevices||stage?.groundPaths||{};
  const next=s.nextEnemies||[];
  let out=Object.entries(paths).filter(([str,pts])=>pts[0][0]>=8 && pts[0][0]<=14 && pts[0][1]===10 && pts.at(-1)[1]<=3).map(([k,pts])=>{
    const gate=pts[0][0]>10?'upper':'lower';
    const n=next.filter(e=>e.gate===gate&&!e.fly).reduce((a,e)=>a+e.count,0);
    return {pts:pts.slice(0,-1),weight:n||1,boss:false};
  });
  if(s.r>=14) {
    const boss=gd.boss(s.objectiveBoss||s.boss);
    const tpl=gd.wave(boss?.templates?.mode_single_20?.template);
    const spawn=tpl?.spawns.find(x=>x.key===boss?.enemyKey);
    const route=tpl?.routes[spawn?.routeIndex];
    if(route){
      const points=[route.start,...(route.checkpoints||[]),route.end];
      let pts=points.slice(0,-1).flatMap((x,i)=>segment(x,points[i+1]));
      if(!pts.length)pts=[route.start];
      pts=pts.map(([r,c])=>[r+7,c]);
      const stationary=route.steps?.some(step=>step.t==='wait'&&step.s>=100)||(!route.checkpoints?.length&&route.start.join()===route.end.join());
      if(stationary){
        const [r,c]=pts[0];
        pts=[[r,c],[r,c],[r+1,c],[r-1,c],[r,c-1]];
      }
      out=[...out.map(a=>({...a,weight:1})),{pts,weight:28,boss:true}];
    }
  }
  return out;
}

export function makePositioner(gd,s) {
  const path=routes(gd,s), normal=s.r<14, interest=new Map(), onRoad=new Map();
  const inc=(m,k,n)=>m.set(k,(m.get(k)||0)+n);
  for(const x of path) {
    const unique=new Set(x.pts.map(([r,c])=>key(r,c)));
    for(const point of unique) inc(onRoad,point,x.weight);
    for(let i=0;i<x.pts.length;i++){
      const [r,c]=x.pts[i];
      inc(interest,key(r,c),x.weight*(.85+.3*i/x.pts.length));
    }
  }
  const options=new Map();
  function forUnit(p){
    if(options.has(p[0]))return options.get(p[0]);
    const rec=gd.chess(p[1])||gd.token(p[1])||{};
    const heal=rec.attackKind==='heal';
    const attack=rec.rangeGrid?.length?rec.rangeGrid:[[0,0],[0,1]];
    const maxLen=rec.skill?.rangeGrid?.length||0;
    const range=attack.map(tile=>[...tile,1]);
    if(maxLen>attack.length){
      const base=new Set(attack.map(t=>t.join()));
      for(const t of rec.skill.rangeGrid)if(!base.has(t.join()))range.push([...t,.35]);
    }
    const choices=[];
    for(const cell of s.legal[p[0]]||[]){
      const [r,c]=cell.split(',').map(Number);
      for(const dir of DIRS){
        const center=key(r,c);
        const cover=range.map(([dr,dc,w])=>{const [a,b]=rotateOffset(dr,dc,dir);return [key(r+a,c+b),w]});
        const flow=cover.reduce((n,[k,w])=>n+(interest.get(k)||0)*w,0);
        choices.push({r,c,dir,center,cover,flow,block:onRoad.get(center)||0,heal});
      }
    }
    options.set(p[0],choices);return choices;
  }
  return function place(pieces, variant) {
    const held=new Map(), attacked=new Map(), occupied=new Set(), targets=new Map(), layout=[];
    const rec=p=>gd.chess(p[1])||gd.token(p[1])||{};
    const prio=p=>{
      const a=rec(p);
      if(a.attackKind==='heal')return -1e4;
      const role=(a.position==='MELEE'&&a.stats?.blockCnt>0)?8000:0;
      return role+(a.stats?.atk||100)*(.5+1/(a.stats?.bat||1))+p[7].length*160;
    };
    const sorted=pieces.slice().sort((a,b)=>prio(b)-prio(a));
    const get=(m,k)=>m.get(k)||0;
    const total=Math.max(1,...interest.values());
    for(const p of sorted){
      const a=rec(p), blocker=a.position==='MELEE'&&a.stats?.blockCnt>0;
      let best=null,hi=-Infinity;
      for(const t of forUnit(p)){
        if(occupied.has(t.center))continue;
        let v=t.flow/total;
        if(t.heal){
          v=t.cover.reduce((value,[k,w])=>value+get(targets,k)*w,0);
          v+=.1*t.flow/total;
        }else{
          v=t.cover.reduce((value,[k,w])=>value+(get(interest,k)/total+get(held,k)*(1.3+(variant%3)*.8))*w/(1+get(attacked,k)*(.03+.06*(variant%4))),0);
          if(blocker)v+=t.block/total*(2.5+(variant%5));
          if(t.cover.length<=2&&blocker&&t.block)v+=2.5;
          if(!normal && !blocker && a.attackKind==='none')v+=.3*t.flow/total;
        }
        // Variants explore high-coverage adjacent tiles and different facing angles.
        const noise=Math.sin((t.center*11+DIRS.indexOf(t.dir)*23+p[0]*7)*(1+variant))*297.1;
        v+=(noise-Math.floor(noise))*(variant===0?.004:.22+.18*(variant%6));
        if(v>hi){hi=v;best=t;}
      }
      if(!best)continue;
      occupied.add(best.center);targets.set(best.center,blocker?2.7:1);
      if(blocker&&best.block) {
        for(const x of path){
          const at=x.pts.findIndex(([r,c])=>key(r,c)===best.center);
          if(at>=0){
            inc(held,best.center,.5);
            const prev=x.pts[Math.max(0,at-1)];inc(held,key(...prev),1);
          }
        }
      }
      if(!best.heal)for(const [k,v] of best.cover)inc(attacked,k,v);
      layout.push([p[0],best.r,best.c,best.dir]);
    }
    return layout;
  };
}
