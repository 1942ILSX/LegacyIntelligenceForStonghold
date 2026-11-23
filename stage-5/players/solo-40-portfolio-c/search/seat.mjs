// Rebuild the candidate from the same two messages available to the solo seat. The
// synthetic match has no live match prototype, shop pool, future waves or RNG.
export function makeSeat(PlayerState, computeBonds, EffectDispatcher, registry, gd, pub, own, s, seed, createRng) {
  const map = new Map(s.tiles.map(([r,c,t]) => [r+','+c,t]));
  const synthetic = {
    gd, round:pub.round, stageId:pub.stageId, phase:pub.phase, modeId:gd.modeId,
    difficulty:gd.difficulty, isSolo:true, roomCode:'rehearsal', log:{},
    seed, rngMeta:createRng(seed), players:new Map(),
    deployFieldOf:() => pub.round >= gd.bossRound ? 'bossL' : 'normal',
    deployMapFor:() => map, markPrivate() {},
    teamMedicGranted:() => (gd.band(own.bandId)?.effectRef ?? own.bandId) === 'band_amedic',
    alivePlayers() { return [...this.players.values()]; },
  };
  const ps = new PlayerState(synthetic, {
    playerId:own.playerId, seat:own.seat, name:'Forecast', isBot:false,
    loadout:own.loadout, ops:own.ops, notOwned:own.standIns,
  });
  // The displayed DIY records are already validated by the match. PlayerState can
  // compose their public skill and operator record using the identical static rules.
  if (Object.keys(own.diy || {}).length) ps.setDiy(own.diy);
  synthetic.players.set(ps.playerId,ps);
  ps.bandId = own.bandId;
  ps.funds = own.funds;
  ps.lp = own.lp;
  ps.shop = structuredClone(own.shop);
  ps.stats = {...ps.stats,...own.stats};
  ps.deployMap = () => map;
  ps._legalityStale = false;
  if (own.command) {
    const id = own.command.effectId;
    ps.command = {bandId:own.bandId,currentEffectId:id,records:{[id]:{
      round:pub.round,used:0,totalUsed:0,currentCost:own.command.currentCost,
      readyRound:pub.round + (own.command.cooldown || 0),
    }}};
  }
  const protectedTokens = new Map();
  const remember = (p) => {
    if (!p) return null;
    const copy = structuredClone(p);
    if (p.kind === 'token' && p.ownerUid != null) protectedTokens.set(p.uid,p.ownerUid);
    for (const it of p.items || []) if (it.progress) ps.counters['pack:'+it.uid] = it.progress.current;
    return copy;
  };
  ps.board = new Map(own.board.map(p=>[p.row+','+p.col, remember(p)]));
  ps.hand = own.hand.map(remember);
  ps.temp = own.temp.map(remember);
  for (const bond of own.bonds) ps.layers[bond.bondId] = bond.layers;
  // A publicly shown permanent +1 is retained when trying a bench swap. Remove
  // harmony's contribution before comparing displayed and unmodified counts.
  const base = computeBonds(ps.gd,ps);
  for (const bond of own.bonds) {
    const prior = base[bond.bondId];
    if (prior && !bond.off) {
      const bonus = bond.count - (bond.harmony || 0) - prior.count + (prior.harmony || 0);
      if (bonus) ps.bondCountBonus[bond.bondId] = bonus;
    }
  }
  const bounties = [], catalog = gd.choices.cards?.bounty || [];
  for (const e of own.effects) {
    const bounty = catalog.find(card=>card.effectId === e.iconId);
    if (bounty) { bounties.push({id:e.id,card:bounty}); continue; }
    const id = String(e.id || '').split('#')[0], record = gd.effect(id);
    if (!record || !String(e.id).includes('#')) continue;
    ps.effects.push({id:e.id, key:'choice:'+id, counter:e.counter??null, params:record.params||{},
      data:{effectId:id},iconKind:e.iconKind,battle:true});
    for (const buff of record.buffs||[]) if (buff.key==='auto_chess_change_map') {
      for (const [alias,v] of Object.entries(buff.bb||{})) if(alias.includes('#')) ps.deviceOverrides[alias]=!!Number(v);
    }
  }
  // The map prop for a chest is visible even when this function first sees the
  // seat at R14. Other command marks can be supplied from the seat's action log.
  ps.commandMarks = (own.prepMapChars || []).filter(x=>x.defId==='enemy_9038_achest')
    .map(x=>({id:-x.uid-16, row:x.y,col:x.x,enemyId:x.defId,round:pub.round,persistent:true}));
  const original = new Map([...ps.board.values(), ...ps.hand, ...ps.temp].filter(Boolean).map(p=>[p.uid,p]));
  const source = {board:ps.board,hand:ps.hand,temp:ps.temp};
  function install(goals, rngSeed) {
    const board = new Map(), chosen = new Set(), old = new Map(source.board);
    const hand=source.hand.slice(), temp=source.temp.slice();
    for(const [uid,r,c,dir] of goals) {
      const piece=original.get(uid);
      if(!piece || piece.kind==='item' || !s.legal[uid]?.includes(r+','+c) || chosen.has(uid) || board.has(r+','+c))
        throw Error('Illegal rehearsal formation');
      chosen.add(uid); board.set(r+','+c,{...piece,dir});
      for(const bench of [hand,temp]) {
        const pos=bench.findIndex(x=>x?.uid===uid);
        if(pos>=0) bench[pos]=null;
      }
    }
    // Actual g.move swaps a displaced operator into the incoming bench slot.
    // Players' original hand order matters for the rightmost-bench summons.
    for(const [key,piece] of old) {
      if(chosen.has(piece.uid)) continue;
      const swap=board.get(key);
      let idx=swap?source.hand.findIndex(x=>x?.uid===swap.uid):-1;
      if(idx<0 || hand[idx]) idx=hand.indexOf(null);
      if(idx>=0) hand[idx]=piece;
      else { const j=temp.indexOf(null); if(j>=0) temp[j]=piece; else throw Error('No bench space'); }
    }
    ps.board=board; ps.hand=hand; ps.temp=temp;
    ps.bonds=computeBonds(ps.gd,ps);
    const rng=createRng(rngSeed);
    synthetic.seed=rngSeed; synthetic.rngMeta=rng;
    const dispatcher=new EffectDispatcher(synthetic,registry);
    dispatcher.preview={rng,data:new Map(),players:synthetic.players};
    // Production's preview logger suppresses errors. Promote a handler error on
    // this detached seat so the caller can account for failed trials.
    const faults=[];
    dispatcher._report=(k,h,e)=>faults.push(k+'.'+h+': '+String(e));
    return {ps,dispatcher,faults};
  }
  return {ps,bounties,original,protectedTokens,install};
}
