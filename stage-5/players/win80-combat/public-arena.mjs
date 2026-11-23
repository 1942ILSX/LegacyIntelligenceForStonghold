import '../solo-40-portfolio-c/disable-native.mjs';
import {makeSearch} from '../solo-40-portfolio-c/search/index.mjs';
import {Match} from '../../engine/v0.4.0/server/match/Match.js';
import {VirtualScheduler} from '../../engine/v0.4.0/server/match/scheduler.js';
import {GameData} from '../../engine/v0.4.0/server/match/gamedata.js';
import {getVersionData,setData} from '../../engine/v0.4.0/server/data.js';
import {rememberOfficialBounds} from '../../engine/v0.4.0/shared/plugins/officialBounds.js';
const engine=new URL('../../engine/v0.4.0/',import.meta.url);
const search=await makeSearch(file=>import(new URL(file,engine)));
const quiet={info(){},warn(){},debug(){},error(...args){throw Error(args.join(' '));}};
const data=getVersionData('act3autochess@V3_1',{log:quiet});
setData(data);rememberOfficialBounds(data);
export const rules=new GameData(data,'mode_single_20');
export function publicArena(){
  // This detached host is only a battle constructor. It is never started,
  // has a constant, unrelated seed, and supplies zero official future waves.
  const host=new Match({roomCode:'OFFLINE_PUBLIC',mode:'solo',modeId:'mode_single_20',
    difficulty:data.config.modes.mode_single_20.difficulty,data,seed:839017,
    seats:[{seat:0,playerId:'public',name:'Public',isBot:false,connected:true}],
    scheduler:new VirtualScheduler(),clientCombat:false,send(){return true;},broadcast(){},onEnd(){},log:quiet});
  return {
    evaluate(publicCase,plans,{own=publicCase.own,s=publicCase.s,salt=0,observation=null}={}) {
      const m={gd:host.gd,modeId:host.modeId,isSolo:true,publicView:()=>publicCase.pub,
        newBattle:host.newBattle.bind(host),_sanitizeSpawns:host._sanitizeSpawns.bind(host)};
      const res=search(m,{privateView:()=>own},s,plans,{mutations:0,confirm:0,maxSeeds:96,salt,...observation});
      if(res.errors.length)throw Error(JSON.stringify(res.errors));
      return res.rows;
    },
    close(){host.dispose();},
  };
}
