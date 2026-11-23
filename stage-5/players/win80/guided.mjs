import {readFileSync} from 'node:fs';
import {createPlanner as basePlanner, seatProfile} from './controller.mjs';
export {seatProfile};

const builds = JSON.parse(readFileSync(new URL('./guide-rosters.json', import.meta.url), 'utf8'));
const terminal = JSON.parse(readFileSync(new URL('../win40/value/terminal.json', import.meta.url), 'utf8')).weights;
const ratings = JSON.parse(readFileSync(new URL('../win40/value/routing.json', import.meta.url), 'utf8'));

function healthOfPlan(gd, plan, state, off, band) {
  const existing = new Set(state.pieces.filter(p => p[2] === 'chess').map(p => gd.baseIdOf(p[1])));
  const allowed = id => {
    const rec = gd.chess(id);
    if (!rec || gd.bondsExclude(rec,off)) return false;
    if (rec.isHidden && !existing.has(id))
      return band==='band_mech' && rec.chessId==='chess_char_5_22_a';
    return true;
  };
  const cover = ids => ids.length ? ids.filter(allowed).length/ids.length : .55;
  const phaseCoverage = plan.phases.map(p => cover(Object.keys(p)));
  const liveBonds = plan.bonds.filter(b => !off.has(b));
  const core = plan.bonds.find(b => gd.bond(b)?.isCore);
  const fit = plan.carry.filter(allowed).reduce((s,id) => s + (terminal['u/'+id]||0)
      + (terminal[state.boss+'/'+id]||0), 0) / Math.max(1,plan.carry.length);
  const ownedCarries = plan.carry.filter(id => existing.has(id)).length;
  return (core && off.has(core) ? -2 : 0) + 2*cover(plan.carry)
    + 1.2 * (liveBonds.length/Math.max(1,plan.bonds.length))
    + phaseCoverage[0]*.4 + phaseCoverage[1]*.7 + phaseCoverage[2]*1.1
    + Math.max(-.6,Math.min(.6,fit*2)) + ownedCarries*.5;
}

export function selectBuild(cfg, state, group) {
  const gd = cfg.gd, off = new Set(state.disabledBonds);
  if (state.picked===null && state.groups.length===2)
    for (const bond of state.groups[1-group]) off.add(bond);
  const forced = state.band || (cfg.band && cfg.band!=='auto' ? cfg.band : null);
  const corePreference = ratings.bias+(ratings.stage[state.stage]||0)+(ratings.boss[state.boss]||0)>0
    ? 'ursusShip' : 'lethaniaShip';
  const pool = cfg.guidePool ? new Set(cfg.guidePool) : null;
  const offers = new Set((state.bands.length ? state.bands : gd.bandIds())
    .filter(id=>gd.bandBondIds(id).every(bond=>!off.has(bond) && !gd.modeInactiveBonds.has(bond))));
  if (forced && !offers.has(forced)) return null;
  let best;
  for (const plan of builds) {
    if (pool && !pool.has(plan.id)) continue;
    const compatible = plan.bands.filter(id=>offers.has(id));
    const band = forced || compatible[0] || 'band_amiya';
    if (!forced && plan.bands.length && !compatible.length) continue;
    // A hidden summon exists only for the specific strategy that grants it.
    if (plan.carry.includes('chess_char_5_22_a') && band!=='band_mech') continue;
    const core = plan.bonds.find(id=>gd.bond(id)?.isCore && !off.has(id));
    const score = healthOfPlan(gd,plan,state,off,band)
      + (forced && compatible.length ? (compatible.includes(forced) ? 1.1 : -.85) : 0)
      + (core===corePreference ? cfg.guideCorePrior ?? .45 : 0)
      + (cfg.buildBias?.[plan.id]||0) + (cfg.bandBias?.[band]||0);
    if (!best || score>best.score) best={plan,band,core,score};
  }
  return best;
}

export function guidePlanner(cfg, backend=basePlanner) {
  const opening = backend(cfg);
  let player, delegated;
  function use(planner, phase, state) {
    delegated=planner;
    return planner.decide(phase,state);
  }
  return {
    decide(phase,state) {
      if (phase==='opening') {
        const suggestion=use(opening,phase,state);
        const move=suggestion.moves?.[0];
        if ((cfg.guideGroup || (cfg.band && cfg.band!=='auto')) && state.picked===null && move?.t==='g.bondGroup') {
          const plans=state.groups.map((_,i)=>selectBuild(cfg,state,i));
          const i=1-move.idx;
          if (plans[i] && (!plans[move.idx] || (cfg.guideGroup &&
              plans[i].score-plans[move.idx].score>(cfg.guideGroupMargin??.4)))) {
            delegated=null;
            return {moves:[{...move,idx:i}]};
          }
        }
        return suggestion;
      }
      if (!player) {
        const selected=selectBuild(cfg,state,state.picked??0);
        if (!selected) player=backend(cfg);
        else {
          const {plan,core,band}=selected, gear=plan.gear;
          const held=new Set(plan.carry);
          const buildWeight=cfg.guideWeight??18;
          const phaseScores=plan.phases.map((phase,i)=>
            Object.fromEntries(Object.entries(phase).map(([unit,count])=>
              [unit,1+Math.min(.6,(count-1)*.22)])));
          function planPriority(s,r) {
            const id=r.baseId||r.chessId;
            const phase=s.r<=4?0:s.r<=9?1:2;
            const present=phaseScores[phase][id]||0;
            const future=phase<2?(phaseScores[phase+1][id]||0):0;
            return buildWeight*(present+.2*future+(held.has(id)?(phase===0?.65:1.25):0));
          }
          const options={...cfg,band:cfg.guideBand===false?(cfg.band||'auto'):band,planPriority,
            economy:{...cfg.economy, promoteAfterLevel:cfg.promoteAfterLevel??true,
              plannedEquipment:(_s,unit,item)=>gear[unit]?.includes(item),
              ...(core?{routeOrder:[core,...(cfg.routeOrder||[]).filter(b=>b!==core)]}:{})}};
          player=backend(options);
        }
      }
      return use(player,phase,state);
    },
    ack(status) {
      if (delegated) delegated.ack?.(status);
      else if (status.at(-1)!=='ok') throw Error('Public covenant choice rejected');
    },
  };
}
export const createPlanner=guidePlanner;
