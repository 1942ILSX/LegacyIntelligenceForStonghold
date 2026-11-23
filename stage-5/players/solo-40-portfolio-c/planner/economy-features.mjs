const index=new Map();
export function makeFeatures(gd,s) {
  const units=s.pieces.filter(x=>x[2]==='chess'), staticIds=Object.keys(gd.raw.chess);
  if(!index.size)for(const [i,id] of staticIds.entries())index.set(id,i);
  const share=new Map(),onboard=new Map(),active=new Map(s.bonds.map(x=>[x[0],x]));
  const unique=[...new Set(units.map(p=>gd.baseIdOf(p[1])))];
  const field=new Set(units.filter(p=>p[3]==='b').map(p=>gd.baseIdOf(p[1])));
  const disabled=new Set(s.disabledBonds||[]);
  for(const id of unique)for(const b of gd.chess(id)?.bonds||[]){
    if(disabled.has(b))continue;
    share.set(b,1+(share.get(b)||0));
    if(field.has(id))onboard.set(b,1+(onboard.get(b)||0));
  }
  const board=units.filter(p=>p[3]==='b');
  const handCount=s.pieces.filter(p=>p[3]==='h').length,shop=s.shop.filter(x=>x&&!x[3]);
  const maxCore=Math.max(0,...[...share].filter(([b])=>gd.bond(b)?.isCore).map(x=>x[1]));
  const healers=units.filter(p=>gd.chess(p[1])?.attackKind==='heal').length;
  const pairs=new Map();
  for(const p of units)pairs.set(p[1],(pairs.get(p[1])||0)+1);
  const nPairs=[...pairs].filter(([id,n])=>n===2&&!gd.chess(id)?.isGolden).length;
  const hold=new Set(units.map(p=>p[1]));
  const maxItem=units.reduce((n,p)=>Math.max(n,p[7].length),0);
  function features(id,kind,price,p=null,mode='shop'){
    const a=gd.chess(id)||gd.item(id)||{},stats=a.stats||{},bondIds=(a.bonds||[]).filter(b=>!disabled.has(b));
    const core=bondIds.filter(b=>gd.bond(b)?.isCore),aux=bondIds.filter(b=>!gd.bond(b)?.isCore);
    const m=(arr,f)=>Math.max(0,...arr.map(f));
    const copies=pairs.get(id)||0, sameBase=units.filter(q=>gd.baseIdOf(q[1])===gd.baseIdOf(id)).length;
    const isField=mode==='field';
    const skill=a.skill||{},garr=(a.garrisonIds||[]).map(i=>gd.garrison(i)||{});
    const future=(b,n)=>gd.bond(b)?.thresholds.includes(n)?1:0;
    const vals=[
      s.r,s.level,s.up,s.funds,s.lp,units.length,handCount,s.cap,
      isField?0:board.length,nPairs,healers,maxCore,Math.max(0,s.funds-price),s.free,shop.length,
      kind==='chess'?1:0,price,a.tier||0,+!!a.isGolden,copies,sameBase,
      +(hold.has(gd.goldenIdOf(id))),shop.filter(x=>x[0]===id).length,
      stats.atk||0,stats.def||0,stats.maxHp||0,stats.bat||0,stats.blockCnt||0,
      a.rangeGrid?.length||0,+!!a.canHitFly,+(a.dmgType==='arts'),+(a.dmgType==='phys'),+(a.attackKind==='heal'),
      +(a.position==='MELEE'),a.rarity||0,(a.talents||[]).length,skill.duration||0,skill.spCost||0,
      skill.rangeGrid?.length||0,skill.bb?.atk_scale||0,skill.bb?.times||0,skill.bb?.attack_speed||0,
      m(core,b=>share.get(b)||0),m(aux,b=>share.get(b)||0),m(core,b=>isField?0:onboard.get(b)||0),
      m(core,b=>isField?0:active.get(b)?.[1]||0),m(core,b=>active.get(b)?.[2]||0),
      m(aux,b=>active.get(b)?.[2]||0),m(core,b=>future(b,(share.get(b)||0)+(sameBase?0:1))),
      m(aux,b=>future(b,(share.get(b)||0)+(sameBase?0:1))),core.length,aux.length,
      +garr.some(g=>g.eventType==='SERVER_REFRESH_SHOP'),+garr.some(g=>g.eventType==='SERVER_PREP_FIN'),
      +garr.some(g=>String(g.effectType).includes('BOND')),+garr.some(g=>String(g.effectType).includes('GOLD')),
      +garr.some(g=>String(g.effectType).includes('EQUIP')),p?.[7]?.length||0,maxItem,
      a.itemType==='EQUIP'?1:0,index.get(id)??-1,Number(String(a.baseId||'').match(/_(\d+)_a$/)?.[1]||0),
      ...['yan','sargon','victoria','kjerag','egir','siracusa','kazimierz','ursus','iberia','lethania','preci','solo','raid','doc','arcane','deput','mira','skillful','visi','empty','sunt','stead','indom','invest','swift','mani'].map(b=>+bondIds.includes(b+'Ship')),
    ];
    return vals.map(v=>Number.isFinite(Number(v))?Number(v):0);
  }
  return features;
}
