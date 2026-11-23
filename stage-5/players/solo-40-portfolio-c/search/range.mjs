import {rotateOffset} from '../../../engine/v0.4.0/server/sim/dir.js';
import {attackRangeGrid,loadoutRecord,resolveRecordLoadout} from '../../../engine/v0.4.0/shared/loadoutRecord.js';

const cache = new WeakMap();
export function rangeRec(seat, piece) {
  if (!piece) return null;
  if (!cache.has(seat)) cache.set(seat,new Map());
  const records=cache.get(seat);
  if (records.has(piece)) return records.get(piece);
  const record=loadoutRecord(piece,resolveRecordLoadout(piece,seat.loadoutFor(piece)));
  const rangeGrid=attackRangeGrid(record) ?? [[0,0]];
  const result={...record,rangeGrid};
  records.set(piece,result);
  return result;
}
export function rangeTiles(record,row,col,direction) {
  return (record.rangeGrid ?? [[0,0]]).map(([dr,dc])=>{
    const [r,c]=rotateOffset(dr,dc,direction);
    return (row+r)+','+(col+c);
  });
}
