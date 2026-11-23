import {createPlanner as base,seatProfile} from './scope-player.mjs';
export {seatProfile};
const phone='chess_item_2_06_e_',lens='chess_item_3_02_e_',doll='chess_item_2_05_e_';
const essential=new Set(['承曦格雷伊','云迹','雪猎','罗比菈塔','初雪','华法琳','夜莺']);
const supports=new Set(['泡泡','蛇屠箱','褐果','野鬃','星极','深巡','角峰','青枳','空弦','车尔尼','耶拉','渡桥','伺夜','旅骨','星源']);
const coin=new Set(['1_03','2_02','2_07','3_11']);
const code=id=>id.match(/chess_item_(\d+_\d+)_/)?.[1];
const name=(gd,p)=>gd.chess(p[1])?.name?.replaceAll('精锐','');
export function createPlanner(cfg){
  const core=base({...cfg,build:'scope'}),{gd}=cfg;
  let round=-1,blocked=new Set(),pending=null,passed=false;
  const direct=m=>{pending=JSON.stringify(m);passed=false;return {moves:[m]};};
  const good=m=>!blocked.has(JSON.stringify(m));
  return {
    decide(need,s){
      if(round!==s.r){round=s.r;blocked=new Set();}
      const pass=st=>{passed=true;return core.decide(need,st);};
      if(need!=='prep'||s.choice||s.draft||s.reward.some(x=>x&&!x[4]))return pass(s);
      const bodies=s.pieces.filter(p=>p[2]==='chess'),held=s.pieces.filter(p=>p[2]==='item');
      const tins=bodies.filter(p=>gd.baseIdOf(p[1])==='chess_char_5_22_a'),elite=tins.some(p=>p[8]);
      const wealth=held.filter(p=>p[1].startsWith(phone)),scope=held.filter(p=>p[1].startsWith(lens));
      const health=tins.some(p=>p[7].some(i=>code(i)==='1_06'));
      for(const item of [...wealth,...scope]){
        if(item[1].startsWith(phone)&&elite)continue;
        const scored=tins.map(p=>{
          const free=gd.equipSlots(p[1])-p[7].length;
          const first=p[7][0];
          const replace=first&&!first.startsWith(lens)&&s.r>=11;
          return {p,score:(free>0?20:replace?0:-100)+(p[8]?12:0)+p[7].filter(i=>i.startsWith(lens)).length*1.2};
        }).sort((a,b)=>b.score-a.score);
        if(scored[0]&&(scored[0].score>=0||item[1].startsWith(phone))){
          const m={t:'g.equip',itemUid:item[0],targetUid:scored[0].p[0]};
          if(good(m))return direct(m);
        }
      }
      const level={t:'g.levelUp'};
      if(s.r>=2&&s.level<2&&s.up<=s.funds&&good(level))return direct(level);
      const only=s.shop.map(x=>{
        if(!x||x[3])return x;
        const [id,kind,price]=x;let keep;
        if(kind==='item'){
          const k=code(id);
          keep=id.startsWith(phone)&&!elite||id.startsWith(lens)||id.startsWith(doll)&&s.r<12||
            k==='1_06'&&!health&&s.r<6||coin.has(k);
        }else{
          const n=gd.chess(id)?.name?.replaceAll('精锐','');
          const pair=bodies.filter(p=>p[1]===id).length;
          keep=essential.has(n)||(supports.has(n)&&(bodies.length<s.cap||pair>0||s.r>6))||
            bodies.length<Math.min(6,s.r+2)&&((s.r<=4&&gd.chess(id)?.position==='MELEE')||!bodies.some(p=>gd.chess(p[1])?.attackKind==='heal')&&gd.chess(id)?.attackKind==='heal');
        }
        return keep?x:[id,kind,price,true];
      });
      const cash=s.shop.map((x,i)=>({x,i})).filter(({x})=>x&&!x[3]&&x[2]<=s.funds)
        .sort(({x:a},{x:b})=>a[2]-b[2]);
      const desired=cash.find(({x})=>x[0].startsWith(phone)&&!elite&&s.level<=2)||
        cash.find(({x})=>gd.chess(x[0])?.name==='承曦格雷伊')||cash.find(({x})=>x[0].startsWith(doll)&&s.r<9);
      if(desired&&s.pieces.filter(p=>p[3]==='h').length<s.hand){
        const m={t:'g.buy',slot:desired.i};if(good(m))return direct(m);
      }
      return pass({...s,shop:only});
    },ack(status){if(pending&&status.at(-1)!=='ok')blocked.add(pending);if(passed)core.ack?.(status);pending=null;passed=false;}
  };
}
