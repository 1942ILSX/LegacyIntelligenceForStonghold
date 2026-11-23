import {makeScopePosition} from './scope-position.mjs';
import {guidePosition} from './guide-placement.mjs';
import {createPlanner as makeEconomy} from './build-policy.mjs';
import {seatProfile} from './core/specialist.mjs';
import {makeGeometry} from './core/extensions/win40/formation/geometry.mjs';
import {wrapCommands} from './core/selector/commands.mjs';
import {makeCardPicker} from './core/selector/cards.mjs';

export {seatProfile};
const buildTable={
  scope:{focus:'skillfulShip',band:'band_mech',
    shares:{'“暴躁铁皮”':125,'承曦格雷伊':54,'云迹':45,'罗比菈塔':20,'初雪':24,'褐果':10,'雪猎':13,'泡泡':12,'蛇屠箱':14,'夜莺':26,'华法琳':27,'星极':9}},
  iberia:{focus:'iberiaShip',band:'band_prepfin',
    shares:{'蓝毒':52,'旅骨':56,'海沫':32,'深靛':20,'瑰盐':30,'温蒂':31,'流明':28,'棘刺':24,'引星棘刺':23,'罗比菈塔':11,'车尔尼':15,'夜莺':10}},
  abyss:{focus:'egirShip',band:'band_egir',
    shares:{'幽灵鲨':17,'安哲拉':19,'深巡':24,'斯卡蒂':38,'歌蕾蒂娅':64,'乌尔比安':56,'水月':33,'归溟幽灵鲨':31,'克莱门莎':80,'浊心斯卡蒂':48,'云迹':12,'华法琳':17}},
};
const unitName=(gd,id)=>gd.chess(id)?.name?.replaceAll('精锐','')??'';
const codeFor=id=>id.match(/chess_item_(\d+_\d+)_/)?.[1]??'';
const choose=(xs,f)=>xs.reduce((leader,x)=>!leader||f(x)>f(leader)?x:leader,null);
export function createPlanner(cfg){
  const {gd}=cfg;
  const name=cfg.build??'iberia', build=buildTable[name], geom=makeGeometry(gd), cards=makeCardPicker(gd);
  const scopePosition=makeScopePosition(gd);
  let delegate,blocked=new Set(),round=-1,pending,forward=false;
  const msg=m=>{pending=JSON.stringify(m);forward=false;return {moves:[m]};};
  const units=s=>s.pieces.filter(p=>p[2]==='chess');
  const title=p=>unitName(gd,p[1]);
  function params(s){
    const army=units(s);
    const count=b=>new Set(army.filter(p=>gd.chess(p[1])?.bonds?.includes(b)).map(p=>gd.baseIdOf(p[1]))).size;
    const elite=t=>army.some(p=>p[8]&&title(p)===t);
    return {army,count,elite};
  }
  const traits={
    priority(s,rec){
      if(!rec)return 0;
      const id=rec.name?.replaceAll('精锐',''),original=build.shares[id]??0;
      if(rec.charId==='char_1050_chen3')return 64;
      if(name==='scope'&&id==='承曦格雷伊'&&s.r>10)return 12;
      if(name==='iberia'&&id==='海沫'&&s.r>=14)return 10;
      return original*(rec.isGolden?1.16:1);
    },
    shopLimit(s){
      if(name==='scope')return cfg.lowCap??2;
      if(name==='abyss')return s.r<5?3:5;
      const {elite,count}=params(s);
      if(s.r<5)return 2;
      if(s.r<10&&!elite('旅骨')&&!elite('海沫')&&count('iberiaShip')<5)return 3;
      return s.r<12?4:5;
    },
    formationValue(s,team){
      const map=new Map();
      for(const p of team)for(const b of gd.chess(p[1])?.bonds||[]){
        if(!map.has(b))map.set(b,new Set());
        map.get(b).add(gd.baseIdOf(p[1]));
      }
      const n=b=>map.get(b)?.size||0;
      if(name==='scope')return (n('skillfulShip')>=2?26:0)+(n('steadShip')>=3?47:0)+(n('emptyShip')>=2?32:0)+(n('docShip')>=2?25:0);
      const core=n(build.focus)+(n('maniShip')?1:0);
      if(name==='iberia')return (core>=6?125:0)+(n('steadShip')>=2?12:0)+(n('docShip')>=2?18:0);
      return (core>=6?78:0)+(n('skillfulShip')>=2?32:0);
    },
    offerValue(s,o){
      const n=unitName(gd,o.id);
      if(o.kind==='chess'&&name==='scope'&&n==='承曦格雷伊')return 74;
      if(o.kind==='chess'&&name==='iberia'&&['旅骨','蓝毒','海沫'].includes(n))return 18;
      if(o.kind!=='item')return 0;
      const code=codeFor(o.id);
      if(code==='2_05')return Math.max(0,(13-s.r)*5);
      if(name==='scope'){
        const {elite}=params(s);
        if(code==='2_06'&&!elite('“暴躁铁皮”'))return 150;
        if(code==='3_02')return 100;
        if(code==='1_06'&&s.r<6&&!s.pieces.some(p=>p[7]?.some(id=>codeFor(id)==='1_06')))return 65;
      }
      if(name==='iberia'&&['3_14','3_09','4_09','5_01'].includes(code))return 32;
      return 0;
    },
    target(s,item,targets,score){
      const code=codeFor(item[1]);
      if(name==='scope'){
        const tin=targets.find(p=>title(p)==='“暴躁铁皮”');
        if(tin&&['3_02','2_06','1_06'].includes(code))return tin;
        const trail=targets.find(p=>title(p)==='云迹');
        if(trail&&code==='2_08')return trail;
        const rest=targets.filter(p=>title(p)!=='“暴躁铁皮”');
        if(tin&&rest.length&&!gd.item(item[1])?.kind?.startsWith('consume_on_equip'))return choose(rest,score);
      }
      if(name==='iberia'){
        const prefer=['4_09','2_04','4_11'].includes(code)?'旅骨':['3_09','3_14','2_10','3_06'].includes(code)?'蓝毒':null;
        const t=targets.filter(p=>title(p)===prefer);
        if(t.length)return choose(t,score);
      }
      return null;
    },
    reserve(s){
      if(s.r>=14||s.frozen||!s.canReady)return false;
      return s.shop.some(x=>x&&!x[3]&&x[2]>s.funds&&(
        name==='scope'&&(unitName(gd,x[0])==='承曦格雷伊'||codeFor(x[0])==='2_06')||
        name==='iberia'&&['旅骨','海沫','蓝毒'].includes(unitName(gd,x[0]))||
        name==='abyss'&&['歌蕾蒂娅','克莱门莎'].includes(unitName(gd,x[0]))));
    }
  };
  function decide(need,s){
    if(s.r!==round){round=s.r;blocked=new Set();}
    if(need==='opening'){
      if(s.picked!==null||!s.groups.length)return msg({t:'g.infoReady',setupRevision:s.rev});
      function groupValue(group){
        const off=new Set([...s.disabledBonds,...s.groups[1-group]]);
        const core=build.focus;
        let rank=s.groups[group].includes(core)?10000:0;
        for(const a of Object.values(gd.raw.chess)){
          if(a.isGolden||!build.shares[a.name])continue;
          if(!gd.bondsExclude(a,off))rank+=build.shares[a.name]*(a.tier<=3?1:.5);
        }
        return rank;
      }
      return msg({t:'g.bondGroup',idx:groupValue(1)>groupValue(0)?1:0,setupRevision:s.rev});
    }
    if(need==='band'){
      const preferred=cfg.band&&cfg.band!=='auto'?cfg.band:build.band;
      return msg({t:'g.band',bandId:[preferred,build.band,'band_amiya'].find(b=>s.bands.includes(b))??s.bands[0]});
    }
    if(need==='diy')return msg({t:'g.diyBring',slots:[5,6].flatMap(t=>s.diy.filter(id=>gd.chess(id)?.tier===t).slice(0,gd.diyBringLimits[t]))});
    if(need==='card'||s.choice){const c=s.choice;return msg({t:'g.choice',idx:cards(s,c?c.cards:s.cards),...(c?{choiceId:c.id}:{})});}
    if(!delegate)delegate=wrapCommands(makeEconomy({...cfg,gd,band:build.band,focus:build.focus,levelSpeed:name==='abyss'?2:1,
      learnBuy:.40,learnField:3,focusStrength:name==='scope'?.15:1.25,arcane:.30,
      shopCap:5,openingBuild:traits,shopFocus:name==='scope'?.1:1.2,pairPlus:17,
      formationJitter:18,sellDown:2,gear:.5,commodity:1,cardPolicy:true,normalPlans:5,bossPlans:10,
      positioner:(_gd,state)=>(team,v)=>name==='scope'?scopePosition(state,geom(state,team,v),v):guidePosition(gd,state,geom(state,team,v),v,name),
    }),gd);
    const command=s.cmd;
    if(s.phase==='PREP'&&!s.draft&&command?.usable&&command.cost<=s.funds&&command.targets.length){
      let t;
      if(name==='abyss'&&s.band==='band_egir'&&s.pieces.filter(p=>p[3]==='h').length<s.hand)t=command.targets[0];
      if(name==='iberia'&&s.band==='band_prepfin'){
        const bodies=new Map(units(s).filter(p=>p[3]==='b').map(p=>[p[0],p]));
        t=command.targets.find(t=>title(bodies.get(t.uid)??[])==='旅骨');
      }
      if(t){const m={t:'g.command',effectId:command.id,target:t};if(!blocked.has(JSON.stringify(m)))return msg(m);}
    }
    forward=true;return delegate.decide(need,s);
  }
  return {decide,ack(status){if(pending&&status.at(-1)!=='ok')blocked.add(pending);if(forward)delegate?.ack(status);pending=null;forward=false;}};
}
