import {bodyKeys} from '../../engine/v0.4.0/server/sim/body.js';
import {BOSS_ROW_OFFSET,COLS} from '../../engine/v0.4.0/server/sim/constants.js';
import {dirVec} from '../../engine/v0.4.0/server/sim/dir.js';

const dirs=['RIGHT','UP','LEFT','DOWN'];
const key=(r,c)=>r*40+c;
const parseCell=t=>t.split(',').map(Number);
function lanePoints(gd,s){
  const stage=gd.stage(s.stage), out=[];
  if(s.r>=gd.bossRound){
    const boss=gd.boss(s.objectiveBoss||s.boss),tpl=gd.wave(boss?.templates?.[gd.modeId]?.template);
    const sp=tpl?.spawns?.find(k=>k.key===boss?.enemyKey),route=tpl?.routes?.[sp?.routeIndex];
    if(!route)return out;
    const legs=[route.start,...(route.checkpoints||[]),route.end],body=gd.enemy(boss.enemyKey)?.hitArea;
    for(let i=0;i<legs.length-1;i++){
      const [r,c]=legs[i],[er,ec]=legs[i+1],steps=Math.max(1,Math.abs(r-er),Math.abs(c-ec));
      for(let j=0;j<steps;j++){
        const y=r+(er-r)*j/steps,x=c+(ec-c)*j/steps;
        const mask=new Set(bodyKeys({x,y,hitArea:body}).map(k=>key(Math.floor(k/COLS)-BOSS_ROW_OFFSET,k%COLS)));
        if(!mask.size)mask.add(key(Math.round(y)-BOSS_ROW_OFFSET,Math.round(x)));
        out.push({r:y-BOSS_ROW_OFFSET,c:x,weight:1,mask});
      }
    }
    return out;
  }
  const traffic=new Map();
  for(const pts of Object.values(stage.groundPathsWithDevices||stage.groundPaths||{})){
    if(!pts.length||pts[0][0]<8||pts[0][0]>14||pts[0][1]!==10||pts.at(-1)[1]>3)continue;
    const gate=pts[0][0]>10?'upper':'lower',weight=s.nextEnemies.filter(e=>e.gate===gate&&!e.fly).reduce((n,e)=>n+e.count,0)||.2;
    for(const [r,c] of pts){const k=key(r,c);traffic.set(k,(traffic.get(k)||0)+weight);}
  }
  return [...traffic].map(([k,weight])=>({r:Math.floor(k/40),c:k%40,weight,mask:new Set([k])}));
}
export function makeScopePosition(gd){
  let previous,field;
  return (s,base,v)=>{
    const tin=s.pieces.find(p=>p[2]==='chess'&&gd.baseIdOf(p[1])==='chess_char_5_22_a'&&base.some(g=>g[0]===p[0]));
    if(!tin)return base;
    if(previous!==s){field=lanePoints(gd,s);previous=s;}
    const scopes=tin[7].reduce((z,id)=>id.startsWith('chess_item_3_02')?z*(id.endsWith('_b')?1.5:1.3):z,1);
    const max=tin[8]?3:2,opts=[],orig=base.find(g=>g[0]===tin[0]);
    for(const cell of s.legal[tin[0]]||[]){
      const [r,c]=parseCell(cell);
      for(const dir of dirs){
        const [dr,dc]=dirVec(dir),ray=new Set();
        for(let j=0;j<=max;j++)ray.add(key(r+dr*j,c+dc*j));
        let value=0;
        for(const enemy of field){
          if(![...enemy.mask].some(k=>ray.has(k)))continue;
          const distance=Math.hypot(r-enemy.r,c-enemy.c);
          value+=enemy.weight*(distance>=2.999?scopes:1)*(s.r>=14?1:1+Math.min(1.5,distance*.4));
        }
        if(value===0)continue;
        const danger=base.filter(g=>g[0]!==tin[0]&&ray.has(key(g[1],g[2]))).length;
        value*=1/(1+.13*danger);
        opts.push({r,c,dir,ray,value});
      }
    }
    if(!opts.length)return base;
    opts.sort((a,b)=>b.value-a.value);
    const start=Math.min(opts.length-1,v%3);
    for(const candidate of opts.slice(start,start+10)){
      const goals=[[tin[0],candidate.r,candidate.c,candidate.dir]];
      const used=new Set([key(candidate.r,candidate.c)]);
      for(const g of base){
        if(g[0]===tin[0])continue;
        const k=key(g[1],g[2]);
        if(!used.has(k)&&!candidate.ray.has(k)){goals.push(g.slice());used.add(k);continue;}
        const alts=(s.legal[g[0]]||[]).map(parseCell).filter(([r,c])=>!used.has(key(r,c)));
        alts.sort((a,b)=>{
          const cost=([r,c])=>Math.abs(r-g[1])+Math.abs(c-g[2])+(candidate.ray.has(key(r,c))?20:0)+
            (base.some(q=>q[0]!==g[0]&&q[1]===r&&q[2]===c)?5:0);
          return cost(a)-cost(b);
        });
        if(!alts.length)break;
        const [r,c]=alts[0];used.add(key(r,c));goals.push([g[0],r,c,g[3]]);
      }
      if(goals.length===base.length)return goals;
    }
    return base;
  };
}
