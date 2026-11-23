// Detached forecasts for comparing neural proposals. Random draws use only the visible
// stage and round. The simulator never receives the live seed, PRNG or scheduled wave.
export async function makeForecaster(load) {
  const {buildNormalWave, buildBossWave, previewOf} = await load('server/match/waves.js');
  const {createRng, deriveSeed} = await load('server/sim/rng.js');
  const {previewPlayer} = await load('server/match/preview.js');
  const {SharedBossPool, bossPoolHp} = await load('server/match/finalAssault.js');
  const {GEO} = await load('shared/constants.js');
  const {RehearsalRun, rehearsalCap} = await load('server/sim/rehearsal.js');
  function composition(rows) {
    const counts = new Map();
    for (const e of rows) {
      if (e.source==='bounty') continue;
      const key = [e.enemyKey,e.gate,e.t,e.fly?1:0].join('|');
      counts.set(key,(counts.get(key)||0)+e.count);
    }
    return counts;
  }
  return (m, ps, candidates) => {
    const pub = m.publicView(), own = ps.privateView(), r = pub.round;
    const boss = r>=m.gd.bossRound, hidden = boss && r===m.gd.hiddenRound;
    const bossId = hidden ? pub.hiddenBossId||pub.bossId : pub.bossId;
    const seed = deriveSeed(98461, pub.stageId+'/'+r);
    const rng = createRng(seed), factions = [...pub.factions];
    const target = composition(own.nextEnemies);
    let wave, nearest = Infinity;
    for (let i=0; i<24; i++) {
      const w = boss ? buildBossWave(m.gd,rng,factions,r,{bossId,solo:true}) : buildNormalWave(m.gd,rng,factions,r);
      const seen = composition(previewOf(w.spawns));
      let dist=0;
      for (const [k,v] of target) dist+=Math.abs(v-(seen.get(k)||0));
      for (const [k,v] of seen) if (!target.has(k)) dist+=v;
      if (dist<nearest) {wave=w;nearest=dist;}
      if (!dist) break;
    }
    const cap = boss ? Math.round((m.gd.bossLevelTime(r)||120)*(m.gd.combatTimeScale||2)*30) : rehearsalCap(wave.timeLimit);
    const kind = boss ? (hidden?'hidden':'boss') : 'normal';
    const factories = candidates.map(goals=>()=>{
      const board = new Map();
      for (const [uid,row,col,dir] of goals) {
        const loc = ps.find(uid);
        if (!loc || !ps._legal(loc.piece,row,col)) throw Error('Invalid forecast placement');
        board.set(row+','+col,{...loc.piece,dir});
      }
      const detached = previewPlayer(ps,board);
      const input = detached.battleInput({side:'L',colOffset:0});
      if (boss) input.lpForBoss=own.lp;
      const hp = boss ? bossPoolHp(m.gd,bossId,1) : 0;
      const opts = {seed,kind,modeId:m.modeId,round:r,stageId:pub.stageId,
        rect:{...(boss?GEO.BOSS_RECT:GEO.NORMAL_RECT)},timeLimit:wave.timeLimit,players:[input],
        spawns:m._sanitizeSpawns(structuredClone(wave.spawns),ps.playerId),routes:structuredClone(wave.routes),
        flags:{layerGainsEnabled:!boss,...m.gd.dp,enemyScale:m.gd.enemyScale(r)},
        fieldId:'estimate',enemyOverrides:structuredClone(wave.overrides),waveId:wave.templateId,bossId,
        sharedBoss:boss?new SharedBossPool(hp):null};
      const battle = m.newBattle(opts,{preview:true});
      if (battle.constructor.name==='DeadBattle') throw Error('Preview construction failed');
      return battle;
    });
    const errors=[];
    const run=new RehearsalRun(factories,ps.playerId,cap,{onError:(e,i)=>errors.push([i,String(e)])});
    run.run();
    if (errors.length===candidates.length) throw Error('No usable forecast '+JSON.stringify(errors));
    return {index:run.score.index,trials:candidates.length,ticks:run.totalTicks,errors,publicWaveDistance:nearest};
  };
}
