import {createPlanner as base,seatProfile} from './standalone-scope.mjs';
import {createPlanner as build} from '../win80-economy/build-policy.mjs';
import {makeGeometry} from '../solo-40-portfolio-c/extensions/win40/formation/geometry.mjs';
import {wrapCommands} from '../solo-40-portfolio-c/selector/commands.mjs';
import {withLegalAssignment} from './portfolio.mjs';
export {seatProfile};

const core='ursusShip', makeId=s=>'chess_char_'+s+'_a';
const groups=[['1_01','1_16','2_21','1_09','2_09','1_17'],['3_03','3_26','3_16','3_27','2_17'],
  ['4_18','4_04','4_03'],['5_25','5_02','6_16','6_12']].map(ids=>new Set(ids.map(makeId)));
const river=makeId('5_25'),vii=makeId('4_04'),healer=makeId('3_03');

function economy(cfg){
  const gd=cfg.gd,geom=makeGeometry(gd);
  let previous,memo;
  function inventory(s){
    if(previous===s)return memo;
    const copies=new Map(),owned=new Set();
    for(const p of s.pieces)if(p[2]==='chess'){
      owned.add(gd.baseIdOf(p[1]));copies.set(p[1],(copies.get(p[1])??0)+1);
    }
    previous=s;return memo={copies,owned};
  }
  function counts(ids){
    const count={};
    for(const id of ids)for(const b of gd.chess(id).bonds)count[b]=(count[b]??0)+1;
    return count;
  }
  const list={
    priority(s,r){
      const k=r.baseId||r.chessId;
      if(groups[3].has(k))return k===river?41:33;
      if(groups[2].has(k))return k===vii?33:25;
      if(groups[1].has(k))return s.r<8?22:k===healer?16:9;
      if(groups[0].has(k))return s.r<6?19:7;
      return 0;
    },
    shopLimit(s){
      const inv=inventory(s);
      if(s.r<3)return 1;
      if(s.r===3)return 2;
      if(s.r<7)return 3;
      if(s.r<11&&!inv.owned.has(river))return 4;
      const pairs=[...inv.copies.entries()].some(([id,n])=>!gd.chess(id).isGolden&&n>=2);
      return s.r>=13&&!pairs&&inv.owned.has(river)?6:5;
    },
    offerValue(s,o){
      if(o.kind!=='chess')return o.id.includes('_3_12_')&&s.r>5?15:0;
      const inv=inventory(s),id=gd.baseIdOf(o.id),r=gd.chess(o.id);
      let delta=!inv.owned.has(id)&&r.bonds.includes(core)?10:0;
      if(id===river&&!inv.owned.has(river))delta+=30;
      if(s.level===4&&!inv.owned.has(river)&&!r.isGolden&&inv.copies.get(o.id)===gd.mergeCount(o.id)-1)delta+=31;
      if((id===vii||id===healer)&&!inv.owned.has(id))delta+=12;
      return delta;
    },
    formationValue(s,team){
      const bonds=counts(new Set(team.map(p=>gd.baseIdOf(p[1]))));
      const n=(bonds[core]??0)+Number(Boolean(bonds.maniShip));
      return 4*Math.min(6,n)+(n>=6?76:n>=3?17:0)+((bonds.arcaneShip??0)>=2?12:0)+((bonds.swiftShip??0)>=2?14:0);
    },
    target(s,item,targets,score){
      const id=item[1];
      if(!id.includes('_4_01_')&&!id.includes('_2_06_')&&!id.includes('_3_12_'))return null;
      const legal=targets.filter(p=>gd.chess(p[1]).bonds[0]===core);
      return legal.sort((a,b)=>score(b)-score(a))[0]??null;
    },
    reserve(s){
      const inv=inventory(s);
      return s.r<13&&s.shop.some(o=>o&&!o[3]&&o[1]==='chess'&&o[2]>s.funds&&
        (gd.baseIdOf(o[0])===river||s.level===4&&!inv.owned.has(river)&&inv.copies.get(o[0])===gd.mergeCount(o[0])-1));
    }
  };
  return wrapCommands(build({...cfg,focus:core,openingBuild:list,levelSpeed:2,shopCap:6,focusStrength:1.15,
    learnBuy:.60,learnField:4,shopFocus:.85,pairPlus:17,formationJitter:18,sellDown:2,commodity:1,
    arcane:.9,gear:.65,normalPlans:5,bossPlans:11,cardPolicy:true,positioner:(_gd,s)=>(team,v)=>geom(s,team,v)}),gd);
}
export function createPlanner(cfg){
  const chosen=cfg.band&&cfg.band!=='auto'?cfg.band:null;
  let primary=base(cfg),prep,last,eligible=false,bound=false;
  return withLegalAssignment({decide(phase,s){
    if(!bound&&(phase==='band'||s.band)){
      const group=s.groups[s.picked]??[];
      eligible=group.includes(core)&&!s.disabledBonds.includes(core)&&!cfg.gd.bondsExclude(cfg.gd.chess(river),new Set(s.disabledBonds));
      if(s.band){bound=true;if(eligible)prep=economy({...cfg,band:s.band});}
    }
    last=prep&&phase==='prep'&&!s.choice?prep:primary;
    const reply=last.decide(phase,s);
    if(phase==='band'){
      const proposed=reply.moves?.[0]?.bandId;
      const band=chosen??(proposed==='band_ursus'?'band_jesica':proposed);
      bound=true;
      if(band&&s.bands.includes(band)&&(chosen||proposed==='band_ursus')){
        if(eligible)prep=economy({...cfg,band});
        if(band!==proposed){primary=base({...cfg,band});last=primary;return primary.decide(phase,s);}
      }
    }
    return reply;
  },ack(status){last?.ack?.(status);}},cfg);
}
