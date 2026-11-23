import {readFileSync} from 'node:fs';
import {computeBonds,pieceBonds} from '../../engine/v0.4.0/server/match/bondsMeta.js';
import {makeGeometry} from '../solo-40-portfolio-c/extensions/win40/formation/geometry.mjs';
const weights=JSON.parse(readFileSync(new URL('../solo-40-portfolio-c/extensions/win40/value/terminal.json',import.meta.url))).weights;
const kinds=new Set(['band_amiya','band_pith','band_weakness']);
const ident=r=>r.baseId??r.chessId;

export function recruitmentBonuses(gd,s,r) {
  if(!kinds.has(s.band)||!r||r.isGolden)return 0;
  const units=s.pieces.filter(p=>p[2]==='chess'),id=ident(r);
  const normal=units.filter(p=>p[1]===r.chessId).length;
  const elite=units.some(p=>p[8]&&gd.baseIdOf(p[1])===id);
  if(s.band==='band_weakness')
    return !elite&&normal>0?(normal>=2?12:5)+(r.tier>=3?3:0):0;
  if(elite||normal)return 0;
  const counts=new Map(s.bonds.map(b=>[b[0],{tier:b[1],layers:b[2]}]));
  const seen=new Map();
  for(const p of units)for(const b of gd.chess(p[1])?.bonds||[]){
    if(!seen.has(b))seen.set(b,new Set());seen.get(b).add(gd.baseIdOf(p[1]));
  }
  const pith=s.band==='band_pith'&&units.some(p=>gd.chess(p[1])?.bonds.includes('maniShip'));
  const low=s.bonds.filter(b=>b[3]).length<5;
  let result=0;
  for(const b of r.bonds){
    const rule=gd.bond(b);
    if(!rule||s.disabledBonds.includes(b)||gd.modeInactiveBonds.has(b))continue;
    const n=seen.get(b)?.size||0;
    const bonus=rule.isCore&&pith?1:0;
    if(rule.thresholds.some(t=>t>n+(n?bonus:0)&&t<=n+1+bonus)){
      if(pith&&rule.isCore)result+=n>=4?20:8;
      else if(s.band==='band_amiya'&&low&&!counts.get(b)?.tier)result+=8;
    }
  }
  return Math.min(23,result);
}

function evaluator(gd,s,units) {
  const off=new Set(s.disabledBonds),layers=Object.fromEntries(s.bonds.map(b=>[b[0],b[2]]));
  const lookup=new Map(units.map(p=>{
    const r=gd.chess(p[1]),id=ident(r),stats=r.stats||{};
    const piece={id:p[1],uid:p[0],kind:'chess',items:p[7].map(id=>({id}))};
    const raw=(stats.atk||250)/Math.max(.65,stats.bat||1)*(stats.aspd||100)/100;
    const learned=(weights['u/'+id]||0)+(weights[s.boss+'/'+id]||0)+(p[8]?(weights['e/'+id]||0):0);
    const value=6+r.tier*1.7+Math.min(13,raw/75)+(p[8]?5:0)+2*p[7].length+48*learned+(r.charId==='char_1050_chen3'?18:0);
    return [p[0],{piece,r,p,value,bonds:pieceBonds(gd,piece).filter(b=>!off.has(b))}];
  }));
  const cache=new Map(),layerWeight=(b)=>Math.min(2,(layers[b]||0)/75);
  return team=>{
    const uid=team.map(p=>p[0]).sort((a,b)=>a-b).join('/');
    if(cache.has(uid))return cache.get(uid);
    const chosen=new Set(team.map(p=>p[0])),board=new Map([...chosen].map(k=>[k,lookup.get(k).piece]));
    const hand=units.filter(p=>!chosen.has(p[0])&&p[3]!=='t').map(p=>lookup.get(p[0]).piece);
    const bs=computeBonds(gd,{board,hand,layers});
    const active=Object.entries(bs).filter(([b,a])=>a.active&&!off.has(b));
    const core=active.filter(([b])=>gd.bond(b).isCore);
    const boost=active.length<3?0:Math.min(4,active.length-1)*.1;
    let base=0,passive=0,heal=0,block=0,antiAir=0;
    for(const p of team){
      const t=lookup.get(p[0]),healer=t.r.attackKind==='heal';
      heal+=Number(healer);block+=Number(t.r.position==='MELEE'&&(t.r.stats?.blockCnt||0)>=1);
      antiAir+=Number(t.r.canHitFly&&!healer);
      base+=t.value;
      if(s.band==='band_weakness'&&p[8]&&!healer)passive+=.30*t.value;
      const harmony=s.band==='band_pith'&&t.bonds.includes('maniShip');
      for(const [b,q] of core){
        const power=q.tier>1?.25:.09;
        if(t.bonds.includes(b)||harmony){
          base+=t.value*(power+.04*layerWeight(b));
          if(harmony)passive+=t.value*(power+.06*layerWeight(b));
        }
      }
    }
    if(s.band==='band_amiya')passive+=base*boost;
    if(s.band==='band_pith')passive+=core.reduce((n,[,q])=>n+(q.tier>1?9:2),0);
    const roles=(s.r>=4&&!heal?-15:0)+(!block?-17:block===1?-4:0)+(!antiAir&&s.r>3?-7:0);
    const totals={value:base+passive+roles,passive};
    cache.set(uid,totals);return totals;
  };
}

export function withPassiveTeams(base,gd,cfg) {
  const place=makeGeometry(gd);
  return {decide(phase,s){
    const result=base.decide(phase,s),orig=result.candidates;
    if(!cfg.passiveTeam||!kinds.has(s.band)||phase!=='prep'||orig?.length<3||!orig?.length)return result;
    const units=s.pieces.filter(p=>p[2]==='chess'),tokens=s.pieces.filter(p=>p[2]==='token');
    const byId=new Map(units.map(p=>[p[0],p])),team=orig[0].map(q=>byId.get(q[0])).filter(Boolean);
    if(!team.length||units.length===team.length)return result;
    const score=evaluator(gd,s,units),baseScore=score(team),found=new Map();
    const label=t=>t.map(p=>p[0]).sort((a,b)=>a-b).join('/');
    const variations=initial=>{
      const ins=new Set(initial.map(p=>p[0])),out=[];
      const bench=units.filter(p=>!ins.has(p[0])&&s.legal[p[0]]?.length);
      for(const buy of bench)for(let i=0;i<initial.length;i++){
        const alt=initial.slice();alt[i]=buy;
        const id=label(alt);if(found.has(id))continue;
        const rating=score(alt);
        const row={team:alt,...rating};found.set(id,row);out.push(row);
      }
      return out;
    };
    const first=variations(team).sort((a,b)=>b.value-a.value);
    for(const a of first.slice(0,2))variations(a.team);
    const proposals=[...found.values()].filter(a=>a.value>baseScore.value+2&&a.passive>baseScore.passive+1)
      .sort((a,b)=>b.value-a.value);
    const plans=orig.slice(),known=new Set(plans.map(p=>label(p.map(q=>byId.get(q[0])).filter(Boolean))));
    let n=0;
    for(const p of proposals){
      const signature=label(p.team);if(known.has(signature))continue;
      const candidate=place(s,[...p.team,...tokens],2+n);
      if(candidate.filter(q=>byId.has(q[0])).length!==p.team.length)continue;
      known.add(signature);plans[plans.length-1-n]=candidate;
      if(++n===Math.min(2,plans.length-1))break;
    }
    return n?{...result,candidates:plans}:result;
  },ack(status){base.ack?.(status);}};
}
