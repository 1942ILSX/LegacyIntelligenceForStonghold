import {createPlanner as siracusa,seatProfile} from './siracusa.mjs';
import {makeGeometry} from '../win80-economy-r1/core/extensions/win40/formation/geometry.mjs';
import {dirVec} from '../../engine/v0.4.0/server/sim/dir.js';
export {seatProfile};
const S='siracusaShip',P='preciShip',C=name=>name?.replaceAll('精锐','')||'',key=JSON.stringify;
const role={伺夜:46,安洁莉娜:41,荒芜拉普兰德:60,贝洛内:47,复奏:13,忍冬:15,铃兰:18,霍尔海雅:30,空弦:20,青枳:9,斥罪:11,拉普兰德:7,奥斯塔:5};
const code=id=>id?.match(/chess_item_(\d+_\d+)_/)?.[1];
const cell=(r,c)=>r+','+c,dirs=['RIGHT','UP','LEFT','DOWN'];
function orient(gd,s,team){
  const byId=new Map(s.pieces.map(p=>[p[0],p])),goals=team.map(g=>g.slice()),used=new Set(goals.map(g=>cell(g[1],g[2])));
  for(const own of goals){
    const p=byId.get(own[0]),n=C(gd.chess(p[1])?.name);
    const sign=n==='青枳'?-1:['空弦','华法琳','铃兰'].includes(n)?1:0;if(!sign)continue;
    const available=[];
    for(const t of goals){
      if(t===own)continue;
      const a=gd.chess(byId.get(t[0])[1]),title=C(a?.name);
      const v=n==='铃兰'?(title==='忍冬'?25:title==='拉普兰德'?9:0):title==='伺夜'?21:title==='安洁莉娜'||title==='贝洛内'?15:a?.bonds?.includes(S)?9:0;
      if(!v)continue;
      for(const dir of dirs){
        const [dr,dc]=dirVec(dir),r=t[1]-sign*dr,c=t[2]-sign*dc,k=cell(r,c);
        if(!s.legal[own[0]]?.includes(k)||used.has(k)&&(r!==own[1]||c!==own[2]))continue;
        available.push({r,c,dir,z:v-.7*Math.hypot(r-own[1],c-own[2])+(dir===own[3]?1:0)});
      }
    }
    available.sort((a,b)=>b.z-a.z);
    if(available.length){const a=available[0];used.delete(cell(own[1],own[2]));own[1]=a.r;own[2]=a.c;own[3]=a.dir;used.add(cell(own[1],own[2]));}
  }
  return goals;
}
export function createPlanner(cfg){
  const {gd}=cfg,core=siracusa(cfg),geometry=makeGeometry(gd),farm=cfg.siraGrowth!=='pace';
  let round=-1,pending,forward,denied=new Set();
  const rec=p=>gd.chess(p[1]),name=p=>C(rec(p)?.name);
  const text=r=>C(r?.name);
  function emit(m){const k=key(m);if(denied.has(k))return null;pending=k;return {moves:[m]};}
  function roster(s,reply,units){
    if(!farm||s.r>=14||!reply.candidates?.length)return reply;
    const owned=units.filter(p=>s.legal[p[0]]?.length),start=reply.candidates[0],init=new Set(start.map(g=>g[0]));
    const parts=s.pieces.filter(p=>p[2]!=='chess'&&init.has(p[0])),wants=s.nextEnemies.some(e=>e.fly);
    const plans=[];
    for(let variant=0;variant<3;variant++){
      const chosen=[],types=new Set(),bonds=new Map();
      while(chosen.length<Math.min(s.cap,owned.length)){
        let best,top=-Infinity;
        for(const p of owned){
          if(chosen.includes(p))continue;
          const r=rec(p),n=name(p),base=gd.baseIdOf(p[1]),different=!types.has(base);
          let z=(role[n]||0)+(p[8]?22:0)+p[7].length*7+r.tier*3;
          if(r.charId==='char_1050_chen3')z+=50;
          if(!chosen.some(q=>rec(q).attackKind==='heal')&&r.attackKind==='heal')z+=variant===1?82:48;
          if(!chosen.some(q=>(rec(q).stats?.blockCnt||0)>=2)&&r.stats?.blockCnt>=2)z+=50;
          if(wants&&!chosen.some(q=>rec(q).canHitFly&&rec(q).attackKind!=='heal')&&r.canHitFly&&r.attackKind!=='heal')z+=30;
          if(r.bonds.includes(S)&&different&&(bonds.get(S)||0)<3)z+=42;
          if(variant===2&&r.bonds.includes(P)&&different&&(bonds.get(P)||0)<3)z+=19;
          if(n==='安洁莉娜'&&chosen.filter(q=>name(q)===n).length===1&&s.r<=11)z+=variant===0?27:6;
          if(n==='伺夜'&&chosen.filter(q=>name(q)===n).length===1&&s.r<=10)z+=variant===0?18:0;
          if(['青枳','空弦','华法琳','铃兰'].includes(n)&&chosen.some(q=>name(q)==='伺夜'||name(q)==='忍冬'))z+=14;
          if(!different&&n!=='伺夜'&&n!=='安洁莉娜')z-=25;
          if(z>top){top=z;best=p;}
        }
        if(!best)break;
        chosen.push(best);const id=gd.baseIdOf(best[1]);
        if(!types.has(id)){for(const b of rec(best).bonds)bonds.set(b,1+(bonds.get(b)||0));types.add(id);}
      }
      const base=geometry(s,[...chosen,...parts],variant);
      plans.push(variant===1?base:orient(gd,s,base));
    }
    return {...reply,candidates:[...reply.candidates,...plans]};
  }
  return {decide(need,s){
    if(s.r!==round){round=s.r;denied=new Set();}pending=null;forward=false;
    if(need!=='prep'){forward=true;return core.decide(need,s);}
    const units=s.pieces.filter(p=>p[2]==='chess'),copies=n=>units.filter(p=>name(p)===n);
    const layers=s.bonds.find(b=>b[0]===S)?.[2]||0;
    const cap=s.r===1?1:s.r<=3?2:s.r<=5?3:s.r<=7&&!copies('伺夜').length&&s.lp>=12?3:s.r<=8?4:s.r===9&&!copies('安洁莉娜').length&&s.lp>=10?4:6;
    const visible=s.level>=cap?{...s,up:1000000}:s;
    if(farm&&s.r<=13&&!s.choice&&!s.draft&&!s.reward.some(x=>x&&!x[4])){
      const primary=copies('伺夜').sort((a,b)=>Number(b[8])-Number(a[8]))[0]||copies('安洁莉娜')[0];
      if(primary){
        for(const item of s.pieces.filter(p=>p[2]==='item')){
          const k=code(item[1]);if(k!=='1_04'&&k!=='2_08')continue;
          if(k==='2_08'&&(s.r>9||primary[7].length>=gd.equipSlots(primary[1])||primary[7].some(i=>code(i)==='2_08')))continue;
          const m=emit({t:'g.equip',itemUid:item[0],targetUid:primary[0]});if(m)return m;
        }
      }
      const space=s.hand-s.pieces.filter(p=>p[3]==='h').length;
      if(space>0){
        const offers=s.shop.flatMap((o,i)=>{
          if(!o||o[3]||o[2]>s.funds)return [];
          const n=text(gd.chess(o[0])),dupes=copies(n),gold=dupes.some(p=>p[8]);let value=0;
          if(n==='伺夜'&&(!gold||dupes.length<2)&&s.r<=11)value=90;
          if(n==='安洁莉娜'&&(!gold||dupes.length<2)&&s.r<=12)value=85;
          if(n==='复奏'&&s.r<=9&&(!gold||dupes.length<2))value=67;
          if(n==='空弦'&&primary&&!dupes.length&&s.r<11)value=55;
          if(n==='忍冬'&&s.level>=4&&!dupes.length)value=46;
          if(n==='拉普兰德'&&layers>=80&&s.r<=13&&s.funds>=o[2]+3&&dupes.length<2)value=34;
          if(code(o[0])==='1_04'&&primary&&s.funds>=o[2]+1)value=48;
          return [{i,value}];
        }).sort((a,b)=>b.value-a.value);
        if(offers[0]?.value>0){const m=emit({t:'g.buy',slot:offers[0].i});if(m)return m;}
      }
    }
    forward=true;const reply=core.decide(need,visible);return roster(s,reply,units);
  },ack(status){if(pending&&status.at(-1)!=='ok')denied.add(pending);if(forward)core.ack?.(status);}};
}
