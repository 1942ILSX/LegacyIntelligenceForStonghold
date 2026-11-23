// Public state encoder from the frozen full-game player.
function compactCard(c){return [c.idx,c.id||c.effectId||c.enemyKey||'',c.kind||'',c.soldOut||false,c.price||0];}
function piece(p,where,at){
  return [p.uid,p.id,p.kind,where,p.row??at,p.col??-1,p.dir||'',(p.items||[]).map(i=>i.id),!!p.golden,p.tier||0];
}
export function view(m,ps) {
  const u=m.publicView(),v=ps.privateView(),s=v.shop;
  const units=[...v.board.map(p=>piece(p,'b',-1)),...v.hand.flatMap((p,i)=>p?[piece(p,'h',i)]:[]),
               ...v.temp.flatMap((p,i)=>p?[piece(p,'t',i)]:[])];
  const cmd=v.command;
  return {phase:u.phase,r:u.round,stage:u.stageId,disabledBonds:u.disabledBonds,bannedChess:u.bannedChess,factions:u.factions,nextEnemies:v.nextEnemies||[],boss:u.bossId,objectiveBoss:u.round===m.gd.hiddenRound?u.hiddenBossId:u.bossId,lp:v.lp,band:v.bandId||'',funds:v.funds,
    level:s.level,up:s.upgradePrice,maxLv:s.maxLevel,refresh:s.refreshPrice,free:s.freeRefreshes,
    frozen:s.frozen,cap:v.deployCap,hand:v.hand.length,temp:v.temp.length,stash:v.stashCount||0,
    pieces:units,shop:s.slots.map(x=>x?[x.id,x.kind,x.price,!!x.sold]:null),
    reward:s.rewardOffer?.slots.map((x,i)=>x?[i,x.id,x.kind,x.price||0,!!x.sold]:null)||[],
    bonds:v.bonds.map(b=>[b.bondId||b.id||'',b.tier||0,b.layers||0,!!b.active]),
    enemies:(v.nextEnemies||[]).map(e=>[e.key||e.enemyKey||e.id||'',e.count||1]),
    tiles:[...ps.deployMap()].map(([k,t])=>[...k.split(',').map(Number),t]),
    cmd:cmd?{id:cmd.effectId,usable:cmd.usable,cost:cmd.currentCost,targets:cmd.targets||[]}:null,
    draft:v.commandDraft?{id:v.commandDraft.id,ids:v.commandDraft.cards.map(x=>x.effectId)}:null,
    choice:v.personalChoice?{id:v.personalChoice.id,cards:v.personalChoice.cards.map(compactCard)}:null,
    cards:u.sp?.cards.map(compactCard)||[],chosen:u.sp?.taken||{},groups:u.bondChoice?.groups||[],
    picked:u.bondChoice?.picked??null,rev:u.setupRevision, bands:u.phase==='BAND_DRAFT'?m.gd.bandIds():[],
    diy:Object.keys(v.diy||{}).filter(k=>!(v.diyBanned||[]).includes(k)),canReady:v.canReady,
    legal:m.phase==='PREP'?Object.fromEntries(units.filter(x=>x[2]!=='item').map(x=>{
      const body=ps.find(x[0]).piece;
      return [x[0],[...ps.deployMap().keys()].filter(k=>{const [r,c]=k.split(',').map(Number);return ps._legal(body,r,c);})];
    })):{}};
}
