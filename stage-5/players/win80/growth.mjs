import {rotateOffset} from '../../engine/v0.4.0/server/sim/dir.js';
import {pieceBonds} from '../../engine/v0.4.0/server/match/bondsMeta.js';
import {attackRangeGrid} from '../../engine/v0.4.0/shared/loadoutRecord.js';

const dirs=['RIGHT','UP','LEFT','DOWN'];
const tile=(r,c)=>r+','+c;
const localOffset=(r,c,d)=>rotateOffset(r,c,d);
function effects(gd,id) {
  const rec=gd.chess(id);
  const found=[];
  for(const key of rec?.garrisonIds||[]) {
    const g=gd.garrison(key);
    if(!g)continue;
    let amount=0,behind=g.bbStr?.dir==='behind';
    if(g.effectType==='SERVER_ADD_BOND_POSITION')amount=g.bb?.count||1;
    if(g.effectType==='SERVER_ADD_BOND_POSITION_COUNT_SELL_PRICE')amount=3;
    if(!amount&&['ADD_BOND','GAIN_BUFF'].includes(g.effectType) && g.desc?.includes('身前一格')) {
      if(g.desc.includes('叠层上限'))amount=3;
      else if(g.desc.includes('额外+1')||g.desc.includes('获得特质')&&g.desc.includes('层'))amount=5;
      else if(g.desc.includes('技力'))amount=2;
    }
    if(amount)found.push({amount,behind});
  }
  return found;
}

function makeGrowthPlans(gd,s) {
  const pieces=new Map(s.pieces.map(p=>[p[0],p])), off=new Set(s.disabledBonds);
  const publicActive=new Set(s.bonds.filter(b=>b[3]).map(b=>b[0]));
  const coverage=new Map(), path=new Set();
  const stage=gd.stage(s.stage);
  for(const p of Object.values(stage.groundPathsWithDevices||stage.groundPaths||{})) {
    if(p.length && p[0][1]===10 && p[0][0]>=8 && p[0][0]<=14 && p.at(-1)[1]<=3)
      for(const [r,c] of p.slice(0,-1))path.add(tile(r,c));
  }
  function combat(p,goal,all) {
    const [uid,r,c,d]=goal, rec=gd.chess(p[1]);
    const key=[uid,r,c,d].join('/');
    let hit=coverage.get(key);
    if(!hit) {
      hit=(attackRangeGrid(rec)||[[0,0]]).map(([dr,dc])=>{
        const [u,v]=localOffset(dr,dc,d);
        return tile(r+u,c+v);
      });
      coverage.set(key,hit);
    }
    if(rec.attackKind==='heal') {
      const tiles=new Set(all.filter(a=>a[0]!==uid).map(a=>tile(a[1],a[2])));
      return hit.filter(k=>tiles.has(k)).length*.95;
    }
    return hit.filter(k=>path.has(k)).length*.4
      +(rec.position==='MELEE'&&path.has(tile(r,c))?1.5:0);
  }
  const traits=new Map(), bonds=new Map();
  for(const p of pieces.values())if(p[2]==='chess') {
    traits.set(p[0],effects(gd,p[1]));
    bonds.set(p[0],pieceBonds(gd,{id:p[1],items:p[7].map(id=>({id}))}).filter(b=>!off.has(b)));
  }
  function optimize(original,weight) {
    const team=original.map(a=>a.slice());
    const emitters=team.filter(g=>traits.get(g[0])?.length);
    if(!emitters.length)return {plan:original,gain:0};
    const counts=new Map(),unique=new Set();
    for(const [uid] of team) {
      const p=pieces.get(uid);
      if(p?.[2]!=='chess')continue;
      const id=gd.baseIdOf(p[1]);
      for(const b of bonds.get(uid)||[]) {
        const key=id+'/'+b;if(unique.has(key))continue;
        unique.add(key);counts.set(b,(counts.get(b)||0)+1);
      }
    }
    const value=new Map();
    for(const [uid] of team) {
      let power=0;
      for(const b of bonds.get(uid)||[]) {
        const rule=gd.bond(b);
        if(!publicActive.has(b) && (counts.get(b)||0)<(rule?.thresholds?.[0]??Infinity))continue;
        const weight=rule?.isCore?1.45:1;
        power+=weight;
      }
      value.set(uid,power);
    }
    function production() {
      const cells=new Map(team.map(a=>[tile(a[1],a[2]),a[0]]));
      let score=0;
      for(const [uid,r,c,d] of emitters) {
        for(const e of traits.get(uid)) {
          const [dr,dc]=localOffset(0,e.behind?-1:1,d);
          const target=cells.get(tile(r+dr,c+dc));
          if(target!==undefined)score+=e.amount*(value.get(target)||0);
        }
      }
      return score;
    }
    const initial=production();
    for(const goal of emitters) {
      const [uid,oldR,oldC,oldD]=goal,p=pieces.get(uid);
      const oldPower=combat(p,goal,team);
      const occupied=new Set(team.filter(a=>a[0]!==uid).map(a=>tile(a[1],a[2])));
      const legal=new Set(s.legal?.[uid]||[]);
      const current=production();
      let best=current, choice=[oldR,oldC,oldD];
      for(const ally of team) {
        if(ally[0]===uid)continue;
        for(const e of traits.get(uid))for(const d of dirs) {
          const [dr,dc]=localOffset(0,e.behind?-1:1,d);
          const r=ally[1]-dr,c=ally[2]-dc, dist=Math.abs(oldR-r)+Math.abs(oldC-c);
          if(dist>3 || occupied.has(tile(r,c)) || !legal.has(tile(r,c)))continue;
          goal[1]=r;goal[2]=c;goal[3]=d;
          const delta=combat(p,goal,team)-oldPower;
          const score=production()+Math.min(0,delta)*weight-dist*.9-(d!==oldD?.55:0);
          if(score>best+.05){best=score;choice=[r,c,d];}
        }
      }
      [goal[1],goal[2],goal[3]]=choice;
    }
    return {plan:team,gain:production()-initial};
  }
  return optimize;
}

export function withGrowth(base,gd,cfg) {
  return {
    decide(need,s) {
      const reply=base.decide(need,s);
      if(!reply.candidates?.length || s.r<2 || s.r>=gd.bossRound)return reply;
      const optimize=makeGrowthPlans(gd,s);
      const next=reply.candidates.map(plan=>optimize(plan,cfg.growthDefense??4));
      if(!next.some(x=>x.gain>1))return reply;
      const plans=next.map((x,i)=>x.gain>1?x.plan:reply.candidates[i]);
      if(!cfg.commitGrowth || s.lp<9)plans.push(reply.candidates[0]);
      return {...reply,formation:plans[0],candidates:plans};
    },
    ack(status){base.ack?.(status);},
  };
}
