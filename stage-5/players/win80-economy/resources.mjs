const pick=(rows,score)=>rows.reduce((best,row)=>!best||score(row)>score(best)?row:best,null);
const lead='char_1050_chen3';
const priorityCarry=new Set(['艾雅法拉','霍尔海雅','冻河','维伊','逻各斯','塔露拉','薇薇安娜']);
const prepUnits={ '折光':10,'复奏':8,'黑键':13,'纯烬艾雅法拉':15,'溯光星源':19,'Miss.Christine':13,'异客':10 };
const supportUnits={'安哲拉':9,'罗比菈塔':10,'渡桥':8,'星源':8,'淬羽赫默':12,'迷迭香':6};
const raidUnits={'赫拉格':20,'瑕光':16,'赫德雷':19,'铸铁':14,'伊桑':15,'史尔特尔':14};
const offense=new Set(['1_01','1_05','2_03','2_04','2_10','3_01','3_02','3_03','3_04','3_06','3_08','3_09','3_13','3_14','4_04','4_05','4_09','4_10','4_13','4_14','5_01','5_07','5_08','6_01','6_07','6_09']);
const itemCode=id=>id.match(/chess_item_(\d+_\d+)_/)?.[1]??'';
const title=a=>a?.name?.replace(/精锐/g,'')??'';
export function makeResourcePlan(gd,s,owned,focus,opts) {
  const counts=new Map(),bonds=new Map(),active=new Map(s.bonds.map(b=>[b[0],b]));
  for(const p of owned){
    counts.set(p[1],(counts.get(p[1])||0)+1);
    for(const id of gd.chess(p[1])?.bonds||[]){
      if(!bonds.has(id))bonds.set(id,new Set());
      bonds.get(id).add(gd.baseIdOf(p[1]));
    }
  }
  const layers=b=>active.get(b)?.[2]||0;
  const strength=opts.supply??0,raid=opts.raid??0,gear=opts.items??0;
  const scale=(lo,hi,x)=>Math.max(0,Math.min(1,(x-lo)/(hi-lo)));
  const early=(1-scale(7,14,s.r));
  function field(a){
    let value=0;
    if(strength){
      const n=title(a);
      if(focus==='lethaniaShip'||(bonds.get('lethaniaShip')?.size??0)>=3)value+=(prepUnits[n]||0)*(.3+.7*early);
      if((bonds.get('arcaneShip')?.size??0)>=2 && n==='溯光星源')value+=early*14;
      if(a.bonds?.includes('deputShip'))value+=(supportUnits[n]||5)*early*.6;
    }
    if(raid && a.bonds?.includes('raidShip')){
      const n=(bonds.get('raidShip')?.size??0);
      value+=raid*((n>0?1:.55)*(raidUnits[title(a)]||6)*(.45+early*1.1)+(layers('raidShip')>=36?6:0));
    }
    return strength*value+(strength?0:value);
  }
  function team(team){
    if(!raid&&!strength)return 0;
    const ids=new Map();
    for(const p of team)for(const b of gd.chess(p[1])?.bonds||[]){
      if(!ids.has(b))ids.set(b,new Set());
      ids.get(b).add(gd.baseIdOf(p[1]));
    }
    const n=b=>ids.get(b)?.size??0;
    return (n('raidShip')>=2?raid*(layers('raidShip')>=50?105:layers('raidShip')>=36?67:early*32):0)
      +(n('deputShip')>=2?strength*early*(n('deputShip')>=3?31:18):0);
  }
  function buy(o){
    if(o.kind==='chess'){
      const c=gd.chess(o.id);
      if(!c)return 0;
      const name=title(c);
      if(c.charId===lead)return strength*48;
      const free=({ '伊桑':9,'车尔尼':8,'卡涅利安':12,'忍冬':10,'凯瑟琳':7,'星源':6,'复奏':8 })[name]||0;
      return strength*free*(counts.has(o.id)?0.45:1);
    }
    const code=itemCode(o.id);
    const grade={
      '2_05':Math.min(85,(14-s.r)*9),'2_02':6,'2_06':12,'2_07':3,
      '3_09':19,'3_14':30,'3_04':13,'3_11':15,'3_15':5,
      '4_09':12,'4_15':13,'5_04':s.r<14?51:-20,'5_03':Math.max(...counts.values(),0)>=2?33:10,
      '5_01':27,'5_09':10,'5_08':23,'6_01':24,'6_02':s.cap<9?85:-30
    }[code]||0;
    return gear*grade;
  }
  function equipTarget(item,targets,score){
    if(!gear||!targets.length)return null;
    const code=itemCode(item[1]);
    if(!offense.has(code)&&code!=='5_04')return null;
    if(code==='5_04')targets=targets.filter(p=>!p[8]);
    if(!targets.length)return null;
    return pick(targets,p=>{
      const a=gd.chess(p[1]),name=title(a), combat=a.attackKind!=='heal'&&a.attackKind!=='none';
      const ratio=p[3]==='b'?1:.68;
      const leadBonus=a.charId===lead?70:0;
      return ratio*(score(p)*.37+leadBonus+(priorityCarry.has(name)?25:0)
          +(p[8]?10:0)+(a.tier||1)*2+(combat?16:-24)
          +(code==='3_04'&&a.skill?.spCost>25?8:0));
    });
  }
  function hold(){
    if(!opts.lock||s.r>=14||!s.canReady||s.frozen)return false;
    const n=owned.length;
    return s.shop.some(x=>{
      if(!x||x[3]||x[2]<=s.funds)return false;
      if(x[1]==='item')return x[0].includes('_2_05_')&&s.r<=7;
      const c=gd.chess(x[0]);if(!c)return false;
      return c.charId===lead || (n>=4&&(counts.get(x[0])??0)>=2) ||
        (s.r>=5&&priorityCarry.has(title(c))&&!owned.some(p=>gd.chess(p[1])?.isGolden&&gd.baseIdOf(p[1])===x[0]));
    });
  }
  return {field,team,buy,equipTarget,hold};
}
