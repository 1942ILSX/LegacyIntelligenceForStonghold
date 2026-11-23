import { randomInt } from 'node:crypto';
import { pieceBonds } from '../../engine/v0.4.0/server/match/bondsMeta.js';
import { chessIsDiy, itemForbidsDiy } from '../../engine/v0.4.0/shared/itemRules.js';
import { createPlanner as naturalPlanner, seatProfile } from '../solo-40-portfolio-c/controller.mjs';
export { seatProfile };

export function createPlanner(cfg) {
  const player = naturalPlanner(cfg);
  const band = cfg.band;
  const random = band === 'random';
  if (!random && !cfg.gd.band(band)) throw Error('Unknown strategy ' + band);
  const required = random ? [] : cfg.gd.bandBondIds(band);
  let assignedMove = false;
  return {
    decide(need, state) {
      assignedMove = false;
      if (need === 'opening' && state.picked === null && state.groups.length && required.length) {
        const idx = state.groups.findIndex(group => required.every(bond =>
          group.includes(bond) && !state.disabledBonds.includes(bond) && !cfg.gd.modeInactiveBonds.has(bond)));
        if (idx < 0) throw Error('No compatible public bond group for ' + band);
        assignedMove = true;
        return {moves: [{t: 'g.bondGroup', idx, setupRevision: state.rev}]};
      }
      if (need === 'band') {
        if (random) {
          const offered = state.bands.filter(id => cfg.gd.bandBondIds(id).every(bond =>
            !state.disabledBonds.includes(bond) && !cfg.gd.modeInactiveBonds.has(bond)));
          if (!offered.length) throw Error('No available public strategy');
          assignedMove = true;
          return {moves: [{t: 'g.band', bandId: offered[randomInt(offered.length)]}]};
        }
        if (!state.bands.includes(band) || required.some(bond =>
          state.disabledBonds.includes(bond) || cfg.gd.modeInactiveBonds.has(bond))) {
          throw Error('Assigned strategy unavailable in this opening: ' + band);
        }
        assignedMove = true;
        return {moves: [{t: 'g.band', bandId: band}]};
      }
      if (need === 'prep' && state.cmd?.id === 'aceffect_band_89' && state.cmd.usable) {
        const active = new Set(state.bonds.filter(bond => bond[3]).map(bond => bond[0]));
        const eligible = new Set(state.pieces.filter(piece => piece[2] === 'chess' &&
          pieceBonds(cfg.gd, {id: piece[1], items: piece[7].map(id => ({id}))}).some(id => active.has(id))
        ).map(piece => piece[0]));
        const targets = state.cmd.targets.filter(target => eligible.has(target.uid));
        state = {...state, cmd: {...state.cmd, usable: targets.length > 0, targets}};
      }
      for (let attempt = 0; attempt <= state.pieces.length; attempt++) {
        const proposal = player.decide(need, state);
        const move = proposal.moves?.[0];
        if (move?.t !== 'g.equip') return proposal;
        const item = state.pieces.find(piece => piece[0] === move.itemUid);
        const unit = state.pieces.find(piece => piece[0] === move.targetUid);
        if (!item || !unit || !itemForbidsDiy(cfg.gd.item(item[1])) || !chessIsDiy(cfg.gd.chess(unit[1]))) {
          return proposal;
        }
        player.ack?.(['BAD_TARGET']);
      }
      throw Error('Could not resolve requested equipment against public rules');
    },
    ack(status) {
      if (!assignedMove) player.ack?.(status);
      else if (status.length !== 1 || status[0] !== 'ok') throw Error('Assigned strategy input rejected');
    },
  };
}
