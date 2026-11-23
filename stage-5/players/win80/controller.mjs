import {readFileSync} from 'node:fs';
import {createPlanner as createSpecialist, seatProfile} from '../win40-core/controller.mjs';
export {seatProfile};

const outcome = JSON.parse(readFileSync(new URL('../win40/value/terminal.json', import.meta.url), 'utf8')).weights;
const routes = JSON.parse(readFileSync(new URL('../win40/value/routing.json', import.meta.url), 'utf8'));

export function createPlanner(cfg) {
  let player;
  let ownGroup = false;
  function specialist(state) {
    const score = routes.bias + (routes.boss[state.boss] || 0) + (routes.stage[state.stage] || 0);
    const route = cfg.fixedRoute || (score > 0 ? 'ursus' : 'arcane');
    const settings = {...cfg, ...routes[route], ...cfg.economy, band: cfg.band || 'auto'};
    function terminalPriority(s, unit) {
      const id = unit.baseId || unit.chessId;
      const contribution = (outcome['u/'+id] || 0) + (outcome[s.boss+'/'+id] || 0)
        + (unit.isGolden ? outcome['e/'+id] || 0 : 0);
      return Math.min(1, Math.max(0, (s.r - 4) / 6)) * (cfg.terminalWeight ?? 140) * contribution
        + (cfg.planPriority?.(s, unit) ?? 0);
    }
    return createSpecialist({...settings, terminalPriority});
  }
  return {
    decide(phase, state) {
      ownGroup = false;
      player ??= specialist(state);
      const answer = player.decide(phase, state);
      if (phase !== 'opening' || state.picked !== null || answer.moves?.[0]?.t !== 'g.bondGroup') return answer;
      const old = answer.moves[0];
      let idx = old.idx;
      if (cfg.groupPolicy === 'opposite') idx = 1 - old.idx;
      if (cfg.groupPolicy === 'scored') {
        const values = state.groups.map((group, i) => groupValue(cfg.groupModel, state, group, i));
        idx = values[0] === values[1] ? old.idx : Number(values[1] > values[0]);
      }
      if (idx === old.idx) return answer;
      ownGroup = true;
      return {moves: [{...old, idx}]};
    },
    ack(status) {
      if (!ownGroup) player.ack?.(status);
      else if (status.at(-1) !== 'ok') throw Error('Public group choice rejected');
    },
  };
}

function groupValue(model, state, group, index) {
  if (!model) throw Error('No trained opening model');
  const disabled = new Set(state.disabledBonds);
  const features = ['bias','boss:'+state.boss,'stage:'+state.stage];
  for (const id of group) {
    features.push('g:'+id,'bg:'+state.boss+'/'+id);
    for (const off of disabled) features.push('ab:'+off+'/'+id);
  }
  for (const id of disabled) features.push('disabled:'+id);
  for (let i = 0; i < group.length; i++) {
    for (const id of group.slice(i + 1)) features.push('gg:'+ [group[i],id].sort().join('/'));
  }
  return features.reduce((sum, k) => sum + (model[k] || 0), 0);
}
