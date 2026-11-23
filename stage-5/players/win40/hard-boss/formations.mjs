import {Grid} from '../../../engine/v0.4.0/server/sim/grid.js';
import {GEO} from '../../../engine/v0.4.0/shared/constants.js';
import {BOSS_ROW_OFFSET} from '../../../engine/v0.4.0/server/sim/constants.js';
import {rotateOffset} from '../../../engine/v0.4.0/server/sim/dir.js';
import {resolveLoadout} from '../../../engine/v0.4.0/shared/protocol.js';
import {attackRangeGrid,loadoutRecord,resolveRecordLoadout} from '../../../engine/v0.4.0/shared/loadoutRecord.js';

const dirs = ['RIGHT','UP','LEFT','DOWN'];
const key = (r,c) => r*40+c;
const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const dedup = pts => [...new Map(pts.map(p=>[key(...p),p])).values()];
const rank = (xs,score) => xs.slice().sort((a,b)=>score(b)-score(a));

// Use the public boss handbook template and map terrain to trace the patrol.
// Device locations and rules are fixed properties of the selected stage.
function patrol(gd,s) {
  const def=gd.boss(s.boss), template=gd.wave(def.templates[gd.modeId].template);
  const spawn=template.spawns.find(q=>q.key===def.enemyKey), route=template.routes[spawn.routeIndex];
  const stage=gd.stage(s.stage), grid=new Grid({...stage,legend:stage.tiles},GEO.BOSS_RECT);
  for (const d of stage.devices || []) {
    if(d.active && d.pos && ['crate','platform','mound'].includes(d.role))
      grid.setObstacle(...d.pos,true,d.role==='crate'?'crate':'block');
  }
  const waypoints=[route.start,...(route.checkpoints||[])];
  const cells=[waypoints[0]];
  for(let i=1;i<waypoints.length;i++) {
    const segment=grid.findPath(...waypoints[i-1],...waypoints[i]);
    if(segment)cells.push(...segment.slice(1));
  }
  return dedup(cells.map(([r,c])=>[r-BOSS_ROW_OFFSET,c]));
}

function pieceInfo(gd,p,loadout) {
  const base=gd.chess(p[1]);
  const u=loadoutRecord(base,resolveRecordLoadout(base,resolveLoadout(loadout,base,id=>gd.chess(id))));
  const st=u.stats||{}, attack=attackRangeGrid(u);
  const heal=u.attackKind==='heal'||u.profession==='MEDIC'&&u.dmgType==='heal';
  const gear=p[7].map(id=>gd.item(id)?.baseId??id);
  const armour=gear.some(id=>/item_(1_02|3_05|4_02|5_05|5_11)_/.test(id));
  const block=Math.max(0,(st.blockCnt??0)+gear.reduce((n,id)=>n+(/item_5_11_/.test(id)?2:/item_3_12_/.test(id)?1:/item_1_07_/.test(id)?-1:0),0));
  const guard=block>0 && u.position==='MELEE' ?
    (st.maxHp||2000)*(armour?1.3:1)/Math.max(250,2000-(st.def||0))*(1+.10*Math.min(3,block)) : 0;
  const support=(st.atk||300)/Math.max(.5,st.bat||1)
    *(1+.15*gear.length+.10*Number(p[8]));
  return {p,u,heal,guard,hp:st.maxHp||2000,
    power:support*(u.dmgType==='arts'?1.2:1),support,
    grid:attack?.length?attack:[[0,0],[0,1]],skill:u.skill?.rangeGrid||[]};
}

function proposals(gd,s,base,loadout) {
  const matrix=s.boss==='boss_17';
  const info=new Map(s.pieces.filter(p=>p[2]==='chess'&&s.legal[p[0]]?.length)
    .map(p=>[p[0],pieceInfo(gd,p,loadout)]));
  const baseTeam=base.map(a=>info.get(a[0])).filter(Boolean);
  const staticTokens=base.filter(a=>!info.has(a[0]));
  if(!baseTeam.length)return [];
  const all=[...info.values()], path=patrol(gd,s), routeKey=new Set(path.map(p=>key(...p)));
  const guards=rank(all.filter(x=>x.guard),x=>x.guard);
  const healers=rank(all.filter(x=>x.heal),x=>x.support);
  const body=path[0];
  const placements=new Map();
  function options(x) {
    if(placements.has(x))return placements.get(x);
    const result=[];
    for(const loc of s.legal[x.p[0]]) {
      const rc=loc.split(',').map(Number),[r,c]=rc;
      for(const dir of dirs) {
        const mask=offsets=>new Set(offsets.map(([y,z])=>{
          const [dr,dc]=rotateOffset(y,z,dir); return key(r+dr,c+dc);
        }));
        const range=mask(x.grid),skill=mask(x.skill);
        result.push({rc,dir,cell:key(r,c),range,skill,
          patrol:path.reduce((n,t)=>n+Number(range.has(key(...t))),0)/Math.max(1,path.length)});
      }
    }
    placements.set(x,result);return result;
  }
  function canPost(g,cell){return g&&s.legal[g.p[0]].includes(cell.join(','));}
  const viable=matrix?path.filter(cell=>guards.some(g=>canPost(g,cell))):[body];
  if(!viable.length)return [];
  const sites=matrix?dedup([viable[0],viable[Math.floor(viable.length/3)],
    viable[Math.floor(viable.length*2/3)],viable.at(-1)]):[body];
  function compose(primary,variant) {
    const forced=matrix&&primary?[rank(guards.filter(g=>canPost(g,primary)),g=>g.guard)[0]]:[];
    if(variant>0&&healers.length)forced.push(healers[0]);
    if(matrix&&variant===2) {
      const second=guards.find(g=>g!==forced[0]);if(second)forced.push(second);
    }
    const team=baseTeam.slice();
    if(!staticTokens.length)for(const addition of forced.filter(Boolean)) {
      if(team.includes(addition))continue;
      const replace=rank(team.filter(x=>!forced.includes(x)),x=>-(x.power*(x.heal ? .90 : 1)));
      if(replace.length)team[team.indexOf(replace[0])]=addition;
    }
    const tank=matrix?rank(team.filter(x=>x.guard&&canPost(x,primary)),x=>x.guard)[0]:null;
    if(matrix&&!tank)return null;
    const threats=rank(team,x=>x.hp).slice(0,3);
    const other=matrix&&variant===2?rank(team.filter(x=>x!==tank&&x.guard),x=>x.guard)[0]:null;
    const handles=[tank,...rank(team.filter(x=>x!==tank&&!x.heal),x=>x.power),...rank(team.filter(x=>x!==tank&&x.heal),x=>x.support)].filter(Boolean);
    const occupied=new Set(staticTokens.map(g=>key(g[1],g[2])));
    const result=staticTokens.map(g=>g.slice()),assigned=new Map();
    for(const x of handles) {
      let best,top=-Infinity;
      for(const pos of options(x)) {
        if(occupied.has(pos.cell))continue;
        if(x===tank && pos.cell!==key(...primary))continue;
        const focus=key(...primary),range=pos.range.has(focus),skill=pos.skill.has(focus);
        const to=dist(pos.rc,primary);
        let score=range*12+skill*3+pos.patrol*3;
        if(x===tank)score+=pos.patrol*3;
        if(matrix) {
          if(x===other)score+=(routeKey.has(pos.cell)?5:0) + (to>1.6&&to<3.6?3:0);
          if(x!==tank&&x!==other&&to<=1.6)score-=variant===0?3:9;
        }
        if(!matrix&&threats.includes(x))score+=.9*Number(range)+.3*pos.patrol;
        if(x.heal) {
          score=0;
          for(const [ally,cell] of assigned) {
            if(!pos.range.has(key(...cell)))continue;
            score+=matrix?(ally===tank?11:ally===other?3:1):(threats.includes(ally)?5:1);
          }
          if(matrix && to<=1.6)score-=7;
        }
        if(score>top){top=score;best=pos;}
      }
      if(!best)return null;
      occupied.add(best.cell);assigned.set(x,best.rc);
      result.push([x.p[0],...best.rc,best.dir]);
    }
    return result;
  }
  const candidates=[];
  for(const p of sites)for(const v of [0,1,2]){
    const plan=compose(p,v);if(plan)candidates.push(plan);
  }
  return candidates;
}

export function hardBossCandidates(gd,s,baseline,loadout={}) {
  if(!['boss_17','boss_12'].includes(s.boss)||s.r!==gd.bossRound||!baseline.length)return [];
  const seen=new Set(),extra=[];
  for(const plan of [...baseline,...proposals(gd,s,baseline[0],loadout)]){
    const sig=plan.map(a=>a.join('/')).sort().join('|');
    if(!seen.has(sig)&&!baseline.includes(plan))extra.push(plan);
    seen.add(sig);
  }
  return extra;
}
