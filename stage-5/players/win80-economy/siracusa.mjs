import {createPlannerWithEconomy,seatProfile} from '../win80-economy-r1/extend.mjs';
import {makeGeometry} from '../win80-economy-r1/core/extensions/win40/formation/geometry.mjs';
import {dirVec} from '../../engine/v0.4.0/server/sim/dir.js';
export {seatProfile};
const sira='siracusaShip',precision='preciShip',code=id=>id?.match(/chess_item_(\d+_\d+)_/)?.[1];
const name=r=>r?.name?.replaceAll('精锐','')||'';
const values={拉普兰德:3,奥斯塔:6,复奏:10,忍冬:12,伺夜:34,安洁莉娜:24,斥罪:10,铃兰:11,贝洛内:32,荒芜拉普兰德:58,缄默德克萨斯:26,予愿安洁莉娜:34,魔王:18,霍尔海雅:22,空弦:18,青枳:6,承曦格雷伊:12};
const coord=(r,c)=>r+','+c;
const faces=['UP','RIGHT','DOWN','LEFT'];
const gainers={空弦:1,青枳:-1,铃兰:1};

function alignProducers(gd,s,goals,byUid){
  const ret=goals.map(g=>g.slice());
  const occupied=new Set(ret.map(g=>coord(g[1],g[2])));
  for(const g of ret){
    const p=byUid.get(g[0]),n=name(gd.chess(p[1])),sign=gainers[n];
    if(!sign)continue;
    const target=ret.filter(a=>a!==g).map(a=>{
      const ally=gd.chess(byUid.get(a[0])[1]),title=name(ally);
      const value=n==='铃兰'?(title==='忍冬'?18:title==='拉普兰德'?6:0):
        title==='伺夜'?20:title==='安洁莉娜'?12:ally?.bonds?.includes(sira)?9:ally?.bonds?.includes(precision)?4:0;
      return {a,value};
    }).sort((a,b)=>b.value-a.value);
    const choices=[];
    for(const {a,value} of target){
      if(!value)continue;
      for(const dir of faces){
        const [dy,dx]=dirVec(dir),r=a[1]-sign*dy,c=a[2]-sign*dx,key=coord(r,c);
        const same=r===g[1]&&c===g[2];
        if(!s.legal[g[0]]?.includes(key)||!same&&occupied.has(key))continue;
        choices.push({r,c,dir,score:value-Math.hypot(r-g[1],c-g[2])*.8+(g[3]===dir?1:0)});
      }
    }
    choices.sort((a,b)=>b.score-a.score);
    if(choices.length){
      const x=choices[0];occupied.delete(coord(g[1],g[2]));g[1]=x.r;g[2]=x.c;g[3]=x.dir;occupied.add(coord(x.r,x.c));
    }
  }
  return ret;
}

export function createPlanner(cfg){
  const {gd}=cfg,geometry=makeGeometry(gd);
  let base,previous,cached,round=-1,denied=new Set(),pending,delegate;
  const at=p=>gd.chess(p[1]);
  const has=(p,id)=>at(p)?.bonds?.includes(id);
  function weight(p){return (values[name(at(p))]||0)+(p[8]?22:0)+p[7].length*8+at(p).tier*2.5;}
  function context(s){
    if(previous===s)return cached;previous=s;
    const units=s.pieces.filter(p=>p[2]==='chess');
    const distinct=id=>new Set(units.filter(p=>has(p,id)).map(p=>gd.baseIdOf(p[1]))).size;
    return cached={units,core:distinct(sira),prec:distinct(precision),levels:new Map(s.bonds.map(x=>[x[0],x[2]])),
      owned:new Map(units.map(p=>[gd.baseIdOf(p[1]),p])),ranged:units.filter(p=>at(p).position==='RANGED').length};
  }
  function priority(s,r){
    const q=context(s),id=gd.baseIdOf(r.chessId),fresh=!q.owned.has(id),n=name(r),b=r.bonds||[];
    let v=(values[n]||0)*(s.r<5?.55:s.r<9?.85:1);
    if(fresh&&b.includes(sira)&&q.core<6)v+=q.core===2||q.core===5?35:19;
    if(fresh&&b.includes(precision)&&q.prec<3&&q.core>=2)v+=q.prec===2?23:10;
    if(n==='承曦格雷伊'&&s.r>9)v-=7;
    if(n==='安洁莉娜'&&s.r<11)v+=8;
    if(n==='伺夜'&&q.core>=2&&s.r<11)v+=17;
    return v;
  }
  function get(s){
    if(!base){
      const assigned=s.band||cfg.band,band=assigned&&assigned!=='auto'?assigned:cfg.siraBand||'band_siracusa';
      base=createPlannerWithEconomy({...cfg,band},{planPriority:priority,routeOrder:[sira,'lethaniaShip','ursusShip','kjeragShip']});
    }
    return base;
  }
  function plannedTeams(s,orig){
    const q=context(s),byUid=new Map(s.pieces.map(p=>[p[0],p])),initial=orig.candidates[0];
    const ids=new Set(initial.map(g=>g[0])),men=q.units.filter(p=>s.legal[p[0]]?.length),tokens=s.pieces.filter(p=>p[2]!=='chess'&&ids.has(p[0]));
    const uniques=new Map(),ranked=men.slice().sort((a,b)=>weight(b)-weight(a));
    for(const p of ranked)if(has(p,sira)&&!uniques.has(gd.baseIdOf(p[1])))uniques.set(gd.baseIdOf(p[1]),p);
    const cap=Math.min(s.cap,men.length),possible=uniques.size>=6&&cap>=6?6:uniques.size>=3&&cap>=3?3:0;
    if(!possible)return orig;
    const plans=[];
    for(let v=0;v<3;v++){
      const team=[...uniques.values()].slice(0,possible);
      if(v===1&&team.length>=3&&uniques.size>team.length)team[team.length-1]=[...uniques.values()][team.length];
      const score=p=>{
        let value=weight(p);
        if(!team.some(x=>at(x).attackKind==='heal')&&at(p).attackKind==='heal')value+=19;
        const ownPrecision=new Set(team.filter(x=>has(x,precision)).map(x=>gd.baseIdOf(x[1])));
        if(ownPrecision.size<3&&has(p,precision)&&!ownPrecision.has(gd.baseIdOf(p[1])))value+=v===2?37:12;
        return value;
      };
      while(team.length<cap){
        const next=ranked.filter(p=>!team.includes(p)).sort((a,b)=>score(b)-score(a))[0];
        if(!next)break;team.push(next);
      }
      const layout=geometry(s,[...team,...tokens],v);
      plans.push(s.r<14&&v!==2?alignProducers(gd,s,layout,byUid):layout);
    }
    const onBoard=q.units.filter(p=>ids.has(p[0])&&has(p,sira));
    const originalDistinct=new Set(onBoard.map(p=>gd.baseIdOf(p[1]))).size;
    const cultivate=s.r<=11&&s.lp>=9&&(q.levels.get(sira)||0)<150&&originalDistinct<possible;
    return cultivate?{...orig,formation:plans[0],candidates:plans}:{...orig,candidates:[...orig.candidates,...plans]};
  }
  function direct(msg){const k=JSON.stringify(msg);if(denied.has(k))return null;pending=k;return {moves:[msg]};}
  return {decide(need,s){
    pending=null;delegate=false;if(round!==s.r){round=s.r;denied=new Set();}
    const planner=get(s),q=context(s);
    if(need==='prep'&&!s.choice&&!s.draft&&!s.reward.some(x=>x&&!x[4])){
      for(const item of s.pieces.filter(p=>p[2]==='item')){
        const k=code(item[1]);if(k!=='5_12'&&k!=='3_02')continue;
        const order=k==='5_12'?['伺夜','荒芜拉普兰德','安洁莉娜','霍尔海雅']:['荒芜拉普兰德','伺夜','霍尔海雅','承曦格雷伊'];
        const options=q.units.filter(p=>order.includes(name(at(p)))&&p[7].length<gd.equipSlots(p[1]))
          .sort((a,b)=>order.indexOf(name(at(a)))-order.indexOf(name(at(b)))||weight(b)-weight(a));
        if(options.length){const m=direct({t:'g.equip',itemUid:item[0],targetUid:options[0][0]});if(m)return m;}
      }
      const space=s.hand>s.pieces.filter(p=>p[3]==='h').length;
      const coreBuy=s.shop.map((offer,i)=>{
        if(!offer||offer[3]||offer[2]>s.funds)return {v:0};
        const r=gd.chess(offer[0]);
        let v=0;
        if(r?.bonds?.includes(sira)&&!q.owned.has(gd.baseIdOf(offer[0]))&&q.core<6)v=(q.core===5?60:27)+(values[name(r)]||0)/2;
        if(name(r)==='伺夜'&&s.r<11&&!q.owned.get(gd.baseIdOf(r.chessId))?.[8])v+=38;
        if(name(r)==='安洁莉娜'&&s.r<11)v+=14;
        if(name(r)==='荒芜拉普兰德')v+=60;
        if(code(offer[0])==='5_12'&&q.core>=5&&!q.units.some(p=>p[7].some(id=>code(id)==='5_12')))v+=58;
        return {v,i};
      }).sort((a,b)=>b.v-a.v)[0];
      if(space&&coreBuy?.v>=32){const m=direct({t:'g.buy',slot:coreBuy.i});if(m)return m;}
    }
    delegate=true;const result=planner.decide(need,s);
    return result.candidates?.length?plannedTeams(s,result):result;
  },ack(status){if(pending&&status.at(-1)!=='ok')denied.add(pending);if(delegate)base?.ack?.(status);}};
}
