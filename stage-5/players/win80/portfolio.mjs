import {pieceBonds} from '../../engine/v0.4.0/server/match/bondsMeta.js';
import {chessIsDiy,itemForbidsDiy} from '../../engine/v0.4.0/shared/itemRules.js';
import {createPlanner as createGrowth,seatProfile} from './growth-player.mjs';
import {withScopeRoute} from '../win80-economy/scope-route.mjs';
export {seatProfile};

export function createPlanner(cfg) {
  const player=cfg.scopeRoute?withScopeRoute(createGrowth,cfg):createGrowth(cfg);
  return withLegalAssignment(player,cfg);
}
export function withLegalAssignment(player,cfg) {
  const assigned=cfg.band && cfg.band!=='auto'?cfg.band:null;
  if(assigned && !cfg.gd.bandAllowed(assigned))throw Error('Unavailable assigned strategy '+assigned);
  let issued=false;
  return {
    decide(need,s) {
      issued=false;
      if (assigned && need==='opening' && s.picked===null && s.groups.length) {
        const required=cfg.gd.bandBondIds(assigned);
        if(required.length) {
          const idx=s.groups.findIndex(group=>required.every(id=>group.includes(id)
            && !s.disabledBonds.includes(id) && !cfg.gd.modeInactiveBonds.has(id)));
          if(idx<0)throw Error('No legal covenant group for assigned strategy');
          issued=true;
          return {moves:[{t:'g.bondGroup',idx,setupRevision:s.rev}]};
        }
      }
      if(assigned && need==='band') {
        if(!s.bands.includes(assigned))throw Error('Assigned strategy absent from public offers');
        // Initialize the receiving controller on the real, chosen covenant before PREP.
        const proposal=player.decide(need,s);
        if(proposal.moves?.[0]?.bandId===assigned)return proposal;
        issued=true;
        return {moves:[{t:'g.band',bandId:assigned}]};
      }
      if(s.cmd?.usable && s.cmd.id==='aceffect_band_89') {
        const active=new Set(s.bonds.filter(b=>b[3]).map(b=>b[0]));
        const eligible=new Set(s.pieces.filter(p=>p[2]==='chess' &&
          pieceBonds(cfg.gd,{id:p[1],items:p[7].map(id=>({id}))}).some(id=>active.has(id))).map(p=>p[0]));
        const targets=s.cmd.targets.filter(t=>eligible.has(t.uid));
        s={...s,cmd:{...s.cmd,usable:targets.length>0,targets}};
      }
      for(let n=0;n<=s.pieces.length;n++) {
        const answer=player.decide(need,s),msg=answer.moves?.[0];
        if(msg?.t!=='g.equip')return answer;
        const item=s.pieces.find(p=>p[0]===msg.itemUid),unit=s.pieces.find(p=>p[0]===msg.targetUid);
        if(!item||!unit||!itemForbidsDiy(cfg.gd.item(item[1]))||!chessIsDiy(cfg.gd.chess(unit[1])))return answer;
        player.ack?.(['BAD_TARGET']);
      }
      throw Error('No legal equipment plan');
    },
    ack(status) {
      if(!issued)player.ack?.(status);
      else if(status.at(-1)!=='ok')throw Error('Assigned move rejected');
    },
  };
}
