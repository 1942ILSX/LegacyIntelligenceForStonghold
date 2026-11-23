import {GameData} from '../../engine/v0.4.0/server/match/gamedata.js';
import {getVersionData} from '../../engine/v0.4.0/server/data.js';
import {PlayerState} from '../../engine/v0.4.0/server/match/PlayerState.js';
import {computeBonds} from '../../engine/v0.4.0/server/match/bondsMeta.js';
import {EffectDispatcher,getDefaultRegistry} from '../../engine/v0.4.0/server/match/effectsMeta.js';
import {createRng} from '../../engine/v0.4.0/server/sim/rng.js';
import {BOSS_ROW_OFFSET} from '../../engine/v0.4.0/server/sim/constants.js';
import {rangeRec,rangeTiles} from '../solo-40-portfolio-c/search/range.mjs';
import {makeSeat} from '../solo-40-portfolio-c/search/seat.mjs';
import {proposeEdits} from '../solo-40-portfolio-c/search/mutations.mjs';
const data=getVersionData('act3autochess@V3_1',{log:{info(){},debug(){},warn(){},error(e){throw Error(e);}}});
const gd=new GameData(data,'mode_single_20');
export const heatCells=512;
export function writeHeat(buffer,index,heat){
  if(!buffer||!heat)return;
  for(const [cell,v] of heat){
    const [r,c]=cell.split(',').map(Number),k=r*16+c;
    if(k>=0&&k<heatCells)buffer[index*heatCells+k]=v;
  }
}
export function fromHeat(view,goals,buffer,index,limit=1){
  const heat=new Map();
  for(let k=0;k<heatCells;k++){
    const v=buffer[index*heatCells+k];
    if(v>0)heat.set(Math.floor(k/16)+','+k%16,v);
  }
  const seat=makeSeat(PlayerState,computeBonds,EffectDispatcher,getDefaultRegistry(),gd,view.pub,view.own,view.s,839017,createRng);
  return proposeEdits(view.s,seat,goals,heat,limit,rangeTiles,rangeRec,BOSS_ROW_OFFSET,view.s.r>=gd.bossRound);
}
