import {createPlannerWithEconomy,seatProfile} from '../win80-economy-r1/extend.mjs';
import {withScopeRoute} from '../win80-economy-r1/scope-route.mjs';
import {createPlanner as economy} from '../win80-economy/build-policy.mjs';
import {makeGeometry} from '../solo-40-portfolio-c/extensions/win40/formation/geometry.mjs';
import {wrapCommands} from '../solo-40-portfolio-c/selector/commands.mjs';
import {withLegalAssignment} from './portfolio.mjs';
export {seatProfile};

const core='lethaniaShip';
const unit=id=>'chess_char_'+id+'_a';
const early=new Set(['1_19','2_01','3_01','2_14'].map(unit));
const vision=new Set(['2_17','3_16'].map(unit));
const damage=new Set(['4_01','4_02','4_18'].map(unit));
const five=new Set(['5_01','5_11'].map(unit));
const repeat=unit('2_07');
const best=(list,score)=>list.reduce((a,b)=>!a||score(b)>score(a)?b:a,null);

function legalGroup(gd,s,assigned) {
  const off=new Set(s.disabledBonds), required=assigned?gd.bandBondIds(assigned):[];
  if(off.has(core)||required.some(id=>off.has(id)))return -1;
  const can=id=>!gd.bondsExclude(gd.chess(id),off)&&!s.bannedChess?.includes(id);
  if(![...five].some(can)||![...damage].some(can))return -1;
  const fits=g=>g?.includes(core)&&required.every(id=>g.includes(id));
  return s.picked!=null?(fits(s.groups[s.picked])?s.picked:-1):s.groups.findIndex(fits);
}

function regional(cfg,s,group) {
  const {gd}=cfg, assigned=s.band||(cfg.band&&cfg.band!=='auto'?cfg.band:'band_jesica');
  const extra={...cfg,band:assigned,focus:core,routeOrder:[core],economy:{...cfg.economy,supply:1,items:1,lock:true}};
  const initial=createPlannerWithEconomy(extra,{routeOrder:[core]});
  const geometry=makeGeometry(gd), base=id=>gd.baseIdOf(id);
  let prev,memo,active;
  function inventory(s){
    if(prev===s)return memo;
    const units=s.pieces.filter(p=>p[2]==='chess'),ids=new Set(units.map(p=>base(p[1]))),copies=new Map();
    for(const p of units)copies.set(p[1],(copies.get(p[1])||0)+1);
    prev=s;return memo={ids,copies,members:new Set([...ids].filter(id=>gd.chess(id).bonds.includes(core))),
      hasFive:[...five].some(id=>ids.has(id))};
  }
  const plan={
    priority(s,r){
      const id=r.baseId||r.chessId;
      if(five.has(id))return 29;
      if(damage.has(id))return s.r<7?14:23;
      if(vision.has(id))return s.r<8?18:8;
      if(id===repeat)return s.r<5?13:1;
      if(early.has(id))return s.r<8?18:8;
      return id===unit('1_09')&&s.r<=4?7:0;
    },
    shopLimit(s){
      if(s.r<3)return 1;
      if(s.r===3)return 2;
      if(s.r<6)return 3;
      const inv=inventory(s);
      if(s.r<8&&!inv.ids.has(unit('4_01'))&&s.lp<12)return 3;
      return inv.hasFive||s.r>=12?5:4;
    },
    offerValue(s,o){
      const inv=inventory(s);
      if(o.kind!=='chess')return o.kind==='item'&&o.id.includes('_2_06_')&&s.r<10?15:0;
      const id=base(o.id),r=gd.chess(o.id),copies=inv.copies.get(o.id)||0;
      let value=0;
      if(!inv.members.has(id)&&r.bonds.includes(core))value+=inv.members.size>=3?19:10;
      if(!inv.ids.has(id)&&id===repeat)value+=12;
      if(!r.isGolden&&copies===gd.mergeCount(o.id)-1&&s.level===4&&!inv.hasFive)value+=30;
      if(five.has(id)&&!inv.ids.has(id))value+=20;
      if(vision.has(id)&&!inv.ids.has(id)&&[...vision].some(i=>inv.ids.has(i))&&s.r<=8)value+=14;
      return value;
    },
    formationValue(s,team){
      const ids=new Set(team.map(p=>base(p[1]))),counts=new Map();
      for(const id of ids)for(const b of gd.chess(id).bonds)counts.set(b,1+(counts.get(b)||0));
      const n=(counts.get(core)||0)+Number((counts.get('maniShip')||0)>0);
      const visionPair=[...vision].every(id=>ids.has(id));
      return 4*Math.min(n,6)+(n>=6?70:n>=3?14:0)+(visionPair&&s.r<=9?24:0)
        +((counts.get('arcaneShip')||0)>=2?7:0)+((counts.get('preciShip')||0)>=2?7:0);
    },
    target(s,item,targets,score){
      const rec=gd.item(item[1]);
      if(rec?.desc?.includes('第一盟约')||item[1].includes('_2_06_'))
        return best(targets.filter(p=>gd.chess(p[1]).bonds[0]===core),p=>score(p)+(p[3]==='b'?8:0));
      return null;
    },
    reserve(s){
      const inv=inventory(s);
      return s.r<13&&s.shop.some(o=>o&&!o[3]&&o[1]==='chess'&&o[2]>s.funds&&
        (five.has(base(o[0]))||(!inv.hasFive&&s.level===4&&inv.copies.get(o[0])===gd.mergeCount(o[0])-1)));
    }
  };
  const prep=wrapCommands(economy({...extra,openingBuild:plan,levelSpeed:2,shopCap:5,focusStrength:1.2,
    learnBuy:.60,learnField:4,shopFocus:.8,pairPlus:14,formationJitter:18,sellDown:2,commodity:1,arcane:.5,
    normalPlans:5,bossPlans:11,cardPolicy:true,positioner:(_gd,s)=>(team,v)=>geometry(s,team,v)}),gd);
  return {decide(phase,s){
    active=null;
    if(phase==='opening'&&s.picked==null)return {moves:[{t:'g.bondGroup',idx:group,setupRevision:s.rev}]};
    active=phase==='prep'&&!s.choice?prep:initial;
    let answer=active.decide(phase,s);
    const sale=answer.moves?.[0];
    if(sale?.t==='g.sell'&&s.pieces.some(p=>p[0]===sale.uid&&base(p[1])===repeat)&&
       s.pieces.some(p=>p[2]==='chess'&&p[3]==='h'&&base(p[1])!==repeat)){
      active.ack?.(['protected']);answer=active.decide(phase,s);
    }
    return answer;
  },ack(status){active?.ack?.(status);}};
}
export function createPlanner(cfg){
  function nonscope(cfg){
    let active;
    return {decide(phase,s){
      if(!active){
        const assigned=s.band||(cfg.band&&cfg.band!=='auto'?cfg.band:null);
        const group=legalGroup(cfg.gd,s,assigned);
        active=group>=0?regional(cfg,s,group):createPlannerWithEconomy(cfg);
      }
      return active.decide(phase,s);
    },ack(status){active?.ack?.(status);}};
  }
  return withLegalAssignment(withScopeRoute(nonscope,cfg),cfg);
}
