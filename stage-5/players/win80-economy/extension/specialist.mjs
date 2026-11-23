import fs from 'node:fs';
import {createPlanner as makeEconomist} from './policy.mjs';
import {makePositioner} from '../../solo-40-portfolio-c/planner/positions.mjs';
import {wrapCommands} from '../../solo-40-portfolio-c/selector/commands.mjs';
const tactical=config=>wrapCommands(makeEconomist({normalPlans:5,bossPlans:12,pairPlus:13,
  focusStrength:.55,formationJitter:18,learnBuy:.88,learnField:4,sellDown:2,
  shopFocus:.7,commodity:1,cardPolicy:true,positioner:makePositioner,...config}),config.gd);
import {makeGeometry} from '../../solo-40-portfolio-c/extensions/win40/formation/geometry.mjs';
import {makeCardPicker} from '../../solo-40-portfolio-c/selector/cards.mjs';

const combat=JSON.parse(fs.readFileSync(new URL('../../solo-40-portfolio-c/campaign/combat-values.json',import.meta.url)));
const skills=JSON.parse(fs.readFileSync(new URL('../../solo-40-portfolio-c/extensions/win40/loadout/skills.json',import.meta.url)));
const lead='char_1050_chen3';
const ratings=new Map(combat.roster.map(rec=>[rec.charId,rec.mean]));
const factions=['ursusShip','yanShip','lethaniaShip','kjeragShip'];
const ursusUnits={'冻河':24,'维伊':19,'霍尔海雅':20,'塔露拉':38,'怒潮凛冬':17,'赫拉格':10,'青枳':6};
const arcaneUnits={'艾雅法拉':25,'霍尔海雅':24,'维伊':10,'圣聆初雪':17,'薇薇安娜':12,'逻各斯':35,'塔露拉':34};
export function seatProfile(gd, cfg={}) {
  const picks=combat.roster.slice(0,12).map((r,i)=>['chess_char_'+(i<6?5:6)+'_diy'+(i%6+1)+'_a',{charId:r.charId,skillIndex:r.skillIndex}]);
  return {diy:Object.fromEntries(picks),loadout:cfg.useSkills?skills:{}};
}
function pathFor(gd,s,group,cfg) {
  const off=new Set(s.disabledBonds??[]);
  if(s.picked===null && s.groups.length===2) for(const b of s.groups[1-group])off.add(b);
  const choice=cfg.routeOrder??factions;
  return choice.find(b=>!off.has(b))??'auto';
}
function bestGroup(gd,s,cfg) {
  const choice=cfg.routeOrder??factions;
  const value=i=>{
    const off=new Set([...(s.disabledBonds??[]),...(s.groups[1-i]??[])]);
    return choice.reduce((n,b,j)=>n+(off.has(b)?0:1/(3**j)),0);
  };
  return value(1)>value(0)?1:0;
}
export function createPlanner(cfg) {
  const {gd}=cfg, geometry=makeGeometry(gd), cards=makeCardPicker(gd);
  let controller, focus, pending, delegated=false, round=-1, banned=new Set();
  const tag=msg=>JSON.stringify(msg);
  const direct=msg=>{pending=tag(msg);delegated=false;return {moves:[msg]};};
  function ack(status) {
    if(pending&&status.at(-1)!=='ok')banned.add(pending);
    if(delegated)controller.ack?.(status);
    pending=null;delegated=false;
  }
  function decide(need,s) {
    if(s.r!==round){round=s.r;banned=new Set();}
    if(need==='opening'){
      if(s.picked===null&&s.groups.length)return direct({t:'g.bondGroup',idx:bestGroup(gd,s,cfg),setupRevision:s.rev});
      return direct({t:'g.infoReady',setupRevision:s.rev});
    }
    if(!controller){
      focus=pathFor(gd,s,s.picked??0,cfg);
      const openingBuild={priority(state,r){
        if(!r)return 0;
        const extra=cfg.planPriority?.(state,r)??0;
        if(r.diyFor){
          if(r.charId===lead)return 85+extra;
          return Math.min(11,180*(ratings.get(r.charId)||0))+extra;
        }
        const name=r.name?.replace(/精锐/g,'')??'';
        const boost=focus==='ursusShip'?ursusUnits[name]:arcaneUnits[name];
        const phase=state.r<6?.40:state.r<10?.75:1;
        const outcome=cfg.terminalPriority?.(state,r)??0;
        return (boost||0)*phase + (r.bonds?.includes(focus)?8:0)+outcome+extra;
      }};
      controller=tactical({...cfg,focus,shopCap:cfg.shopCap??5,levelSpeed:cfg.levelSpeed??1,
        normalPlans:cfg.normalPlans??4,bossPlans:cfg.bossPlans??10,
        shopFocus:cfg.shopFocus??1,focusStrength:cfg.focusStrength??1.0,
        arcane:cfg.arcane??1.3,gear:cfg.gear??.65,openingBuild,
        positioner:(rules,state)=>(team,variant)=>geometry(state,team,variant)});
    }
    if(need==='band'){
      const requested=cfg.band&&cfg.band!=='auto'?cfg.band:null;
      const routeBand=focus==='yanShip'?'band_yan':focus==='ursusShip'?'band_ursus':'band_amiya';
      const band=[requested,cfg.preferredBand,routeBand,'band_weakness','band_amiya'].find(k=>s.bands.includes(k))??s.bands[0];
      return direct({t:'g.band',bandId:band});
    }
    if(need==='diy'){
      const slots=[5,6].flatMap(t=>s.diy.filter(id=>gd.chess(id)?.tier===t).sort((a,b)=>(ratings.get(gd.chess(b).charId)||0)-(ratings.get(gd.chess(a).charId)||0)).slice(0,gd.diyBringLimits[t]));
      return direct({t:'g.diyBring',slots});
    }
    if(need==='card'||s.choice){
      const c=s.choice;return direct({t:'g.choice',idx:cards(s,c?c.cards:s.cards),...(c?{choiceId:c.id}:{})});
    }
    if(need==='prep'&&!s.draft&&s.cmd?.usable&&s.cmd.targets?.length){
      const troops=s.pieces.filter(p=>p[2]==='chess');
      const held=troops.some(p=>gd.chess(p[1])?.charId===lead);
      const counts=new Set(troops.filter(p=>gd.chess(p[1])?.bonds?.includes(focus)).map(p=>gd.baseIdOf(p[1]))).size;
      const cmd={t:'g.command',effectId:s.cmd.id,target:s.cmd.targets[0]};
      if(!banned.has(tag(cmd)) && s.pieces.filter(p=>p[3]==='h').length<s.hand &&
         ((s.band==='band_ursus' && s.cmd.cost<=s.funds && (s.cmd.cost<=1||s.r>=3&&counts<6&&s.cmd.cost<=3))||
          (s.band==='band_yan'&&!held&&s.level>=4&&s.funds>=s.cmd.cost+4)))
        return direct(cmd);
    }
    delegated=true;
    return controller.decide(need,s);
  }
  return {decide,ack};
}
