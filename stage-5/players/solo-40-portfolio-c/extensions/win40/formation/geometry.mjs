import {makePositioner} from '../../../planner/positions.mjs';
import {bodyKeys} from '../../../../../engine/v0.4.0/server/sim/body.js';
import {BOSS_ROW_OFFSET,COLS} from '../../../../../engine/v0.4.0/server/sim/constants.js';
import {rotateOffset} from '../../../../../engine/v0.4.0/server/sim/dir.js';

const directions=['RIGHT','UP','DOWN','LEFT'];
const num=(r,c)=>r*40+c;
const add=(map,k,v)=>map.set(k,(map.get(k)||0)+v);
const get=(map,k)=>map.get(k)||0;

function field(gd,s) {
  const stage=gd.stage(s.stage), paths=stage.groundPathsWithDevices||stage.groundPaths||{};
  const lane=new Map(),bossMasks=[];
  for(const path of Object.values(paths)){
    if(!path.length || path[0][1]!==10 || path[0][0]<8 || path[0][0]>14 || path.at(-1)[1]>3)continue;
    const gate=path[0][0]>10?'upper':'lower';
    const count=s.nextEnemies?.filter(e=>!e.fly&&e.gate===gate).reduce((a,e)=>a+e.count,0)||1;
    for(const [r,c] of path.slice(0,-1))add(lane,num(r,c),count);
  }
  if(s.r>=gd.bossRound){
    const rec=gd.boss(s.objectiveBoss||s.boss),tpl=gd.wave(rec?.templates?.[gd.modeId]?.template);
    const spec=tpl?.spawns.find(z=>z.key===rec?.enemyKey);
    const route=tpl?.routes[spec?.routeIndex], hit=gd.enemy(rec?.enemyKey)?.hitArea;
    if(route){
      const mask=(r,c)=>{
        const map=new Set();
        for(const k of bodyKeys({x:c,y:r,hitArea:hit}))map.add(num(Math.floor(k/COLS)-BOSS_ROW_OFFSET,k%COLS));
        if(!map.size)map.add(num(r-BOSS_ROW_OFFSET,c));
        bossMasks.push(map);
      };
      const pts=[route.start,...(route.checkpoints||[]),route.end];
      for(let i=0;i<pts.length-1;i++){
        const [r,c]=pts[i], [r1,c1]=pts[i+1];
        const steps=Math.max(1,Math.abs(r1-r),Math.abs(c1-c));
        for(let j=0;j<steps;j++)mask(Math.round(r+(r1-r)*j/steps),Math.round(c+(c1-c)*j/steps));
      }
    }
  }
  const max=Math.max(1,...lane.values());
  const coverage=new Map();
  function placements(p){
    if(coverage.has(p[0]))return coverage.get(p[0]);
    const rec=gd.chess(p[1])||gd.token(p[1])||{},options=[];
    const grid=rec.rangeGrid?.length?rec.rangeGrid:[[0,0],[0,1]];
    const extended=rec.skill?.rangeGrid||[];
    for(const coord of s.legal[p[0]]||[]){
      const [r,c]=coord.split(',').map(Number);
      for(const dir of directions){
        const transform=([y,x])=>{const [dy,dx]=rotateOffset(y,x,dir);return num(r+dy,c+dx);};
        const cover=grid.map(transform),sk=extended.map(transform),cell=num(r,c);
        const exposure=list=>!bossMasks.length?0:bossMasks.reduce((n,b)=>n+Number(list.some(k=>b.has(k))),0)/bossMasks.length;
        options.push({r,c,dir,cell,cover,skill:sk,lane:cover.reduce((n,k)=>n+get(lane,k)/max,0),
          boss:exposure(cover),bossSkill:exposure(sk),block:get(lane,cell)/max});
      }
    }
    coverage.set(p[0],options);return options;
  }
  return (team,v)=>{
    const occ=new Set(),def=new Map(),held=new Map(),damage=new Map(),plan=[];
    const rec=p=>gd.chess(p[1])||gd.token(p[1])||{};
    const order=p=>{
      const a=rec(p), med=a.attackKind==='heal'||a.profession==='MEDIC';
      const tank=a.position==='MELEE'&&(a.stats?.blockCnt||0)>=2;
      return (med?-4e5:tank&&!bossMasks.length?4e5:0)+(p[8]?1000:0)+140*p[7].length+
        (a.stats?.atk||100)/Math.max(.4,a.stats?.bat||1);
    };
    const sorted=team.slice().sort((a,b)=>order(b)-order(a));
    for(const p of sorted){
      const a=rec(p),med=a.attackKind==='heal'||a.profession==='MEDIC',block=(a.stats?.blockCnt||0)>0&&a.position==='MELEE';
      let best,bestScore=-Infinity;
      for(const x of placements(p)){
        if(occ.has(x.cell))continue;
        let score=x.lane*.68;
        for(const k of x.cover)score+=get(lane,k)/max/(1+get(damage,k)*.27)+get(held,k);
        if(block)score+=x.block*(2+v%3);
        if(bossMasks.length){
          score=score*.14+(7+v%4)*x.boss+(1+v%4)*x.bossSkill;
          if(!x.boss && !x.bossSkill && block)score+=x.block;
        }
        if(med)score=x.cover.reduce((z,k)=>z+get(def,k),0)+.035*score;
        const noise=Math.sin((x.cell+3)*13+(directions.indexOf(x.dir)+1)*57+(p[0]+v*41)*17)*519.37;
        score+=(noise-Math.floor(noise))*(v===0?.03:.17+.12*(v%6));
        if(score>bestScore){bestScore=score;best=x;}
      }
      if(!best)continue;
      occ.add(best.cell);add(def,best.cell,block?2:1);
      if(block&&best.block)add(held,best.cell,1.2);
      if(!med)for(const k of best.cover)add(damage,k,1);
      plan.push([p[0],best.r,best.c,best.dir]);
    }
    return plan;
  };
}

export function makeGeometry(gd){
  let previous,standard,focus;
  return (s,team,variant=0)=>{
    if(s!==previous){previous=s;standard=makePositioner(gd,s);focus=field(gd,s);}
    return variant%4===2?standard(team,variant):focus(team,variant);
  };
}
