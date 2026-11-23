const number=id=>Number(id?.split('_').at(-1));
const families=new Map([
  [37,'shield'],[38,'shield'],[107,'fear'],[108,'fear'],[109,'fear'],[110,'fear'],
  [68,'regional'],[70,'regional'],[71,'regional'],[62,'regional'],
  [99,'promotion'],[96,'copy'],[112,'transform'],[105,'layers'],[89,'layers'],[87,'layers'],
  [92,'shopTransform'],[85,'shopTransform'],[74,'refresh'],[79,'refresh'],[106,'refresh'],
  [55,'shopping'],[54,'shopping'],[75,'shopping'],[80,'coins'],[73,'equipment'],
  [78,'equipment'],[86,'battleEquipment'],[100,'chest'],[101,'revive'],[102,'temporaryPromotion'],
  [91,'reserve'],[94,'lowestHealth'],[83,'regionalSwap'],[90,'prep'],[97,'onGain']
]);

export function opened(gd,s,history){
  const troops=s.pieces.filter(t=>t[2]==='chess'),board=troops.filter(p=>p[3]==='b');
  const shop=s.shop.filter(z=>z&&!z[3]),stock=shop.filter(z=>z[1]==='chess');
  const records=troops.map(p=>({p,u:gd.chess(p[1])})).filter(q=>q.u);
  return {r:s.r,boss:s.boss,stage:s.stage,lp:s.lp,funds:s.funds,level:s.level,cap:s.cap,
    board:board.length,bench:troops.filter(p=>p[3]==='h').length,
    room:s.hand-s.pieces.filter(p=>p[3]==='h').length,
    elite:board.filter(p=>p[8]).length,
    core:Math.max(0,...s.bonds.filter(q=>q[3]).map(q=>q[2])),bonds:s.bonds.filter(q=>q[3]).length,
    best:Math.max(0,...records.map(({u})=>u.tier)),normal:Math.max(0,...records.filter(({p})=>!p[8]).map(({u})=>u.tier)),
    trained:Math.max(0,...records.filter(({p})=>p[8]&&p[7].length).map(({u})=>u.tier)),
    gear:board.reduce((n,p)=>n+p[7].length,0),emptyGear:board.filter(p=>p[7].length<2).length,
    stock:stock.length,stockValue:stock.reduce((n,z)=>n+(gd.chess(z[0])?.tier||1),0),
    items:shop.filter(z=>z[1]==='item').length,
    supply:records.filter(({u})=>u.garrisonIds?.length).length,
    history:Object.fromEntries([...history].map(([id,state])=>[id,[state.count,state.round]]))};
}

export function utility(id,o){
  const k=number(id),state=o.history[id]||[0,-20],uses=state[0],age=o.r-state[1];
  const late=o.r>=11,boss=o.r===14;
  const canCopy=late&&o.r>=13||o.r>=6&&o.lp<=8||o.trained>=3;
  const canPromote=o.r>=11||o.r>=6&&o.lp<=8||o.normal>=5;
  const v={
    37:.75,38:1.35,54:o.room&&o.stock?2.7:0,55:o.room&&o.stock?4.8:0,
    62:.05,68:o.room&&o.funds?1.25:0,70:o.room&&o.funds>=1+uses&&uses<3?1.5+.9*(uses===2):0,
    71:.1,73:o.items?.85:.3,74:o.funds>=3?1.9+.12*o.level:.25,75:o.stock*1.5>9&&o.funds>=9?1.8:0,
    78:1.1,79:o.funds>=3?1.25:.15,80:age>4?3.8:age>1?1.5:.2,
    83:o.bench>=1&&o.board>=3&&o.funds>=1?.7:.08,85:o.stock&&o.funds>=2?.75:.1,
    86:o.items&&o.emptyGear>=3&&o.funds>=1?1.7+.5*late:.15,
    87:.45+.07*o.r,89:age>=3&&o.bonds?1.8+Math.min(2.4,.4*o.bonds):.15,
    90:.5+.23*Math.min(6,o.supply),91:-.2,92:o.stock?.85:.15,94:0,
    96:uses===0&&canCopy?2.7+.42*o.best:.15,
    97:.5+.25*Math.min(6,o.supply),99:uses===0&&canPromote?3+.5*o.normal:.2,
    100:age>=3&&o.r<=10&&o.funds>=1?1.4:.05,
    101:o.board?1.8+1.4*boss:.15,102:o.board&&o.funds>=1?1.25+1.2*boss:.1,
    105:o.bench&&o.bonds?.8+.2*Math.min(5,o.bonds):.1,
    106:!uses&&o.r>=6&&o.funds>=7?1.8:0,
    107:.55,108:.8,109:1.05,110:1.3,112:o.normal?.9+.28*Math.min(5,o.normal):.1
  };
  return v[k]??.5;
}

export function vector(id,o){
  const n=number(id),f=families.get(n)||'other',early=o.r<=4,late=o.r>=10,boss=o.r===14;
  const group='g/'+f+'/',key='id/'+id+'/',prior=utility(id,o);
  const x={prior:prior/3};
  x[key+'all']=1;x[group+'all']=.8;x[key+(boss?'boss':early?'early':late?'late':'mid')]=.65;
  for(const [k,v] of Object.entries({early:+early,late:+late,boss:+boss,lp:o.lp<=8?1:0,
    funds:Math.min(2,o.funds/8),level:o.level/6,core:Math.min(2,o.core/70),
    stock:o.stock/5,room:Math.min(1,o.room/4),board:o.board/8,highest:o.best/6,
    items:Math.min(1,o.items/3),recent:(o.history[id]?.[1]||-20)>=o.r-2?1:0})){
    if(v)x[group+k]=v*.7;
  }
  return x;
}
