import {rotateOffset} from '../../engine/v0.4.0/server/sim/dir.js';
import {Grid} from '../../engine/v0.4.0/server/sim/grid.js';
import {GEO} from '../../engine/v0.4.0/shared/constants.js';
import {BOSS_ROW_OFFSET,COLS} from '../../engine/v0.4.0/server/sim/constants.js';
import {bodyKeys} from '../../engine/v0.4.0/server/sim/body.js';
import {resolveLoadout} from '../../engine/v0.4.0/shared/protocol.js';
import {attackRangeGrid,loadoutRecord,resolveRecordLoadout} from '../../engine/v0.4.0/shared/loadoutRecord.js';

const key=(r,c)=>r*40+c;
const hash=(txt,n)=>{let h=2166136261;for(const ch of String(txt))h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0)%n;};
const max=(lo,hi,x)=>Math.max(lo,Math.min(hi,x));
const classes=['melee','arts','ranged','heal','guard','elite','fly','all'];
const defaultGrid=[[0,0],[0,1]];
function interpolate(a,b){
  const steps=Math.max(1,Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));
  return Array.from({length:steps+1},(_,i)=>[Math.round(a[0]+(b[0]-a[0])*i/steps),Math.round(a[1]+(b[1]-a[1])*i/steps)]);
}
function makeRoutes(gd,s){
  const stage=gd.stage(s.stage), normal=s.r<gd.bossRound;
  const rows=s.nextEnemies||[], routes=[];
  function push(points,weight,role,hit=null) {
    if(!points?.length||!(weight>0))return;
    const masks=points.map(([r,c])=>hit?new Set(bodyKeys({x:c,y:r+BOSS_ROW_OFFSET,hitArea:hit}).map(k=>key(Math.floor(k/COLS)-BOSS_ROW_OFFSET,k%COLS))):new Set([key(r,c)]));
    routes.push({points,masks,weight,role});
  }
  for(const [gate,r] of [['lower',9],['upper',12]]){
    const mobile=rows.filter(e=>!e.boss&&(e.gate??'lower')===gate);
    const ground=mobile.filter(e=>!e.fly).reduce((v,e)=>v+e.count,0);
    const flying=mobile.filter(e=>e.fly).reduce((v,e)=>v+e.count,0);
    const paths=stage.groundPathsWithDevices||stage.groundPaths||{};
    const road=paths[r+',10->9,2']||interpolate([r,10],[9,2]);
    push(road,(ground||1)*(normal?1:.04),'ground');
    if(flying)push(interpolate([r,10],[9,2]),flying*(normal?1:.04),'fly');
  }
  if(!normal){
    const boss=gd.boss(s.objectiveBoss||s.boss),enemy=gd.enemy(boss.enemyKey);
    const template=gd.wave(boss.templates[gd.modeId].template), spec=template.spawns.find(e=>e.key===boss.enemyKey);
    const route=template.routes[spec?.routeIndex];
    if(route){
      const grid=new Grid({...stage,legend:stage.tiles},GEO.BOSS_RECT);
      for(const d of stage.devices||[]) if(d.active&&d.pos&&['crate','platform','mound'].includes(d.role))
        grid.setObstacle(...d.pos,true,d.role==='crate'?'crate':'block');
      const wp=[route.start,...(route.checkpoints||[]),route.end],p=[wp[0]];
      for(let i=1;i<wp.length;i++){
        const seg=route.motion==='FLY'?interpolate(wp[i-1],wp[i]):grid.findPath(...wp[i-1],...wp[i])||interpolate(wp[i-1],wp[i]);
        p.push(...seg.slice(1));
      }
      if(!route.checkpoints?.length && route.steps?.some(q=>q.t==='wait'&&q.s>=100))p.splice(1);
      push(p.map(([r,c])=>[r-BOSS_ROW_OFFSET,c]),30,'boss',enemy?.hitArea);
    }
  }
  const total=routes.reduce((v,q)=>v+q.weight,0)||1;for(const q of routes)q.weight/=total;
  return routes;
}

export function makeEncoder(gd,loadout={}){
  const records=new Map();
  function record(id){
    if(records.has(id))return records.get(id);
    const src=gd.chess(id);if(!src)return null;
    const u=loadoutRecord(src,resolveRecordLoadout(src,resolveLoadout(loadout,src,k=>gd.chess(k))));
    const attack=attackRangeGrid(u);const res={...u,rangeGrid:attack?.length?attack:defaultGrid};
    records.set(id,res);return res;
  }
  return function encode(s){
    const pcs=new Map(s.pieces.map(p=>[p[0],p])), routes=makeRoutes(gd,s),cache=new Map();
    const pref=[s.r/14,s.lp/25,s.level/6,s.cap/8,Number(s.r>=14)];
    const context=Array(28).fill(0);
    context[hash(s.stage,12)]=1;context[12+hash(s.boss,16)]=1;
    const seen=s.nextEnemies||[], n=seen.reduce((t,e)=>t+e.count,0)||1;
    const flyer=seen.reduce((t,e)=>t+(e.fly?e.count:0),0)/n;
    pref.push(flyer,seen.filter(e=>e.elite).reduce((t,e)=>t+e.count,0)/n,Math.min(2,n/30));
    function tile(g){
      const sig=g.join('/');if(cache.has(sig))return cache.get(sig);
      const [uid,r,c,dir]=g,p=pcs.get(uid),rec=p&&record(p[1]);
      if(!rec||p[2]!=='chess')return null;
      const mask=grid=>new Set(grid.map(([y,x])=>{const [dy,dx]=rotateOffset(y,x,dir);return key(r+dy,c+dx);}));
      const cover=mask(rec.rangeGrid),skill=mask(rec.skill?.rangeGrid||[]),stats=rec.stats||{};
      const center=key(r,c), heal=rec.attackKind==='heal',melee=rec.position==='MELEE', arts=rec.dmgType==='arts';
      const power=max(.08,4,(stats.atk||200)/Math.max(.55,stats.bat||1)*(stats.aspd||100)/100/550)*(1+.13*p[7].length);
      const endurance=max(.05,5,(stats.maxHp||1000)/2700*(1+(stats.def||0)/1250));
      const guard=!!(melee&&stats.blockCnt>0);
      let total=0,sk=0,road=0,early=0,late=0,fly=0,boss=0,lowest=1;
      const bypass=(!rec.canHitFly&&!heal);
      for(const q of routes){
        let hit=0,extra=0,block=0,first=0,last=0;
        const len=q.points.length;
        for(let i=0;i<len;i++){
          const m=q.masks[i],a=[...m].some(k=>cover.has(k)),b=[...m].some(k=>skill.has(k));
          if(a){hit++;if(i<len/2)first++;else last++;}
          if(b)extra++;
          if(guard&&m.has(center))block++;
        }
        if(q.role==='fly'&&bypass)hit=extra=first=last=0;
        const frac=hit/len;lowest=Math.min(lowest,frac);
        total+=q.weight*frac;sk+=q.weight*extra/len;road+=q.weight*block/len;
        early+=q.weight*first/len;late+=q.weight*last/len;
        if(q.role==='fly')fly+=q.weight*frac;if(q.role==='boss')boss=frac;
      }
      const tags=[melee,arts,!melee&&!heal,heal,guard,!!p[8],!!rec.canHitFly,true];
      const val={uid,r,c,center,rec,cover,skill,tags,power,endurance,guard,heal,early,late,fly,boss,total,sk,road,lowest,hash:hash(rec.charId||p[1],40),items:p[7].length};
      cache.set(sig,val);return val;
    }
    return function(plan){
      const actors=plan.map(tile).filter(Boolean),hist=Array(40).fill(0),bonds=Array(20).fill(0);
      const group=Array.from({length:classes.length},()=>Array(10).fill(0));
      const territory=Array(16).fill(0),healers=actors.filter(x=>x.heal);
      for(const a of actors){
        const aid=healers.reduce((h,u)=>h+(u.cover.has(a.center)?u.power:0),0);
        const near=actors.reduce((v,u)=>v+Number(u!==a&&Math.hypot(a.r-u.r,a.c-u.c)<=1.6),0);
        const profile=[1,a.power,a.power*a.total,a.power*a.sk,a.power*a.early,a.power*a.late,
          a.guard?a.endurance*a.road:0,Math.min(3,aid)*a.road,a.power*a.lowest,near/4];
        for(let i=0;i<classes.length;i++)if(a.tags[i])for(let j=0;j<profile.length;j++)group[i][j]+=profile[j]/4;
        hist[a.hash]+=.3*(a.total+a.sk*.5+.15)*(a.power+.2*a.endurance);
        for(const id of a.rec.bonds||[])bonds[hash(id,20)]+=.25;
        const quadrant=max(0,3,a.r-9)*2+Number(a.c>=6);
        territory[quadrant]+=(a.guard?a.endurance:.15)*.4;
        territory[8+quadrant]+=.4*(a.heal?1.4:Math.min(2,aid));
      }
      const top=actors.filter(x=>!x.heal).map(x=>x.power*(x.total+.3*x.sk)).sort((a,b)=>b-a);
      return [...pref,...context,...group.flat(),...hist,...bonds,...territory,...[0,1,2,3].map(i=>top[i]||0)];
    };
  };
}
