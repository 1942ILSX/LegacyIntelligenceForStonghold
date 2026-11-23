import {rangeTiles,rangeRec} from './range.mjs';
import {makeSeat} from './seat.mjs';
import {proposeEdits,signature} from './mutations.mjs';

const tile=(r,c)=>r+','+c;
function counts(rows) {
  const out=new Map();
  for(const e of rows) if(e.source!=='bounty') {
    const key=[e.enemyKey,e.gate,e.t,e.fly].join('/');
    out.set(key,(out.get(key)||0)+e.count);
  }
  return out;
}
function distance(a,b) {
  let total=0;
  for(const [key,n] of a) total+=Math.abs(n-(b.get(key)||0));
  for(const [key,n] of b) if(!a.has(key))total+=n;
  return total;
}
const order=(a,b)=>b.score-a.score || a.index-b.index;

// Rules and battle constructors are read-only engine services. Only the official
// m.public and own m.private projections cross into the estimator. There is no
// native bot call, no access to the actual battle/loot random streams and no
// mutable engine player in the detached model.
export async function makeSearch(load) {
  const [
    {GameData},{PlayerState},{computeBonds},{EffectDispatcher,getDefaultRegistry},
    {buildNormalWave,buildBossWave,bountySpawns,withBounties,previewOf},
    {createRng,deriveSeed},{SharedBossPool,bossPoolHp},{GEO},
    {bodyKeys},{BOSS_ROW_OFFSET,COLS},
  ]=await Promise.all([
    'server/match/gamedata.js','server/match/PlayerState.js','server/match/bondsMeta.js','server/match/effectsMeta.js',
    'server/match/waves.js','server/sim/rng.js','server/match/finalAssault.js','shared/constants.js',
    'server/sim/body.js','server/sim/constants.js',
  ].map(load));
  const rules=new WeakMap();
  return function search(m,ps,s,candidates,opts={}) {
    const pub=m.publicView(), own=ps.privateView(), r=pub.round;
    if(!candidates?.length) throw Error('Search needs a legal initial formation');
    if(!m.isSolo||pub.phase!=='PREP') throw Error('Solo preparation required');
    let gd=rules.get(m.gd.raw);
    if(!gd) { gd=new GameData(m.gd.raw,m.modeId); rules.set(m.gd.raw,gd); }
    const isBoss=r>=gd.bossRound, hidden=r===gd.hiddenRound && r!==gd.bossRound;
    const bossId=hidden?pub.hiddenBossId:pub.bossId;
    const tag=[pub.stageId,r,bossId||'',opts.salt??0].join('/');
    const seed=deriveSeed(0x61c88647,'forecast/'+tag);
    const seat=makeSeat(PlayerState,computeBonds,EffectDispatcher,getDefaultRegistry(),gd,pub,own,s,seed,createRng);
    const waveRng=createRng(deriveSeed(seed,'wave'));
    const publicFactions=[...pub.factions], target=counts(own.nextEnemies);
    const limit=Math.max(1,Math.min(256,opts.maxSeeds??96));
    let nearest=Infinity,wave;
    for(let draw=0;draw<limit;draw++){
      const w=isBoss?buildBossWave(gd,waveRng,publicFactions,r,{bossId,solo:true}):buildNormalWave(gd,waveRng,publicFactions,r);
      const delta=distance(target,counts(previewOf(w.spawns)));
      if(delta<nearest){nearest=delta;wave=w;}
      if(!nearest)break;
    }
    const baseSpawns=isBoss?[...wave.spawns,...bountySpawns(gd,r,wave,seat.bounties,own.playerId,{solo:true,side:'L'})]:
      withBounties(gd,r,wave,seat.bounties,own.playerId);
    const mutations=Math.max(0,Math.min(128,opts.mutations??4));
    const cap=isBoss?Math.ceil((gd.bossLevelTime(r)||gd.bossOvertimeAfterReal)+(own.lp+1)/Math.max(.01,gd.bossOvertimeDrainReal)):0;
    const capTicks=isBoss?Math.ceil(Math.min(3700,cap*gd.combatTimeScale+2)*30):Math.ceil(((wave.timeLimit||60)+5)*30);
    const rows=[],errors=[],plans=[],seen=new Map();
    let trials=0,ticks=0;
    function simulate(plan,tape,index) {
      const battleSeed=deriveSeed(seed,'battle/'+tape),metaSeed=deriveSeed(seed,'meta/'+tape);
      const {ps:view,dispatcher,faults}=seat.install(plan,metaSeed);
      const input=view.battleInput({side:'L',colOffset:0});
      if(isBoss)input.lpForBoss=own.lp;
      const kind=isBoss?(hidden?'hidden':'boss'):'normal';
      const ev={input,round:r,kind,spawns:structuredClone(baseSpawns),waveSpawns:structuredClone(wave.spawns),
        routes:structuredClone(wave.routes),side:null,preview:true};
      dispatcher.dispatch(view,'onBattleStart',ev);
      if(faults.length)throw Error('Start effects: '+faults.join(', '));
      const pool=isBoss?new SharedBossPool(bossPoolHp(gd,bossId,1)):null;
      const battle=m.newBattle({seed:battleSeed,kind,modeId:gd.modeId,round:r,stageId:pub.stageId,
        rect:{...(isBoss?GEO.BOSS_RECT:GEO.NORMAL_RECT)},timeLimit:wave.timeLimit,players:[ev.input],
        spawns:m._sanitizeSpawns(ev.spawns,isBoss?null:own.playerId),routes:ev.routes,sharedBoss:pool,
        flags:{layerGainsEnabled:!isBoss,...gd.dp,...(isBoss?{enemyScale:gd.enemyScale(r)}:{})},
        fieldId:'public-rehearsal',enemyOverrides:structuredClone(wave.overrides),waveId:wave.templateId,...(isBoss?{bossId}:{})},
        {preview:true});
      if(battle.constructor.name==='DeadBattle')throw Error('Detached battle construction failed');
      let loss=0,t=0;
      if(isBoss){
        const onLoss=amount=>{if(Number.isFinite(amount)&&amount>0)loss+=amount;};
        battle.on('enemyLeak',({enemy})=>{if(enemy)onLoss(Number.isFinite(enemy.lpr)&&enemy.lpr>=0?enemy.lpr:1);},{priority:-1000});
        battle.on('lpLoss',({amount})=>onLoss(amount),{priority:-1000});
      }
      const heat=new Map();
      const after=gd.bossLevelTime(r)||gd.bossOvertimeAfterReal;
      let overtime=0,lp=own.lp;
      for(;!battle.finished&&t<capTicks;){
        battle.step(); t++;
        if(mutations && t%60===0) for(const unit of battle.units) {
          if(unit.side!=='enemy'||!unit.deployed||!unit.alive||unit.hidden) continue;
          const keys=bodyKeys(unit), weight=isBoss?(unit.bossPool?1:.002):1;
          for(const key of keys) {
            const pos=tile(Math.floor(key/COLS),key%COLS);
            heat.set(pos,(heat.get(pos)||0)+weight/Math.max(1,keys.length));
          }
        }
        if(isBoss) {
          overtime=gd.bossOvertimeDue(t/30,after);
          lp=Math.max(0,own.lp-loss-overtime);
          if(pool.hp===0||lp===0)break;
        }
      }
      if(!battle.finished)battle.forceEnd('forced');
      const result=battle.result(),stats=result.perPlayer[own.playerId];
      if(result.synthetic||result.errors||!stats)throw Error('Detached combat errors: '+JSON.stringify(battle.errors.map(x=>[x.label,x.who,x.message,x.stack?.split("\n")[1]])));
      const leaks=stats.leaked.filter(l=>l.counted!==false).length;
      const gain=Object.values(stats.layerGains||{}).reduce((a,b)=>a+b,0);
      const damage=pool?1-pool.hp/pool.maxHp:0;
      const won=!!pool && pool.hp<=0;
      const hp=isBoss?lp:Math.max(0,own.lp-Math.min(gd.lpCapPerRound,leaks));
      const score=isBoss ? (won ? 2+hp/Math.max(1,own.lp)+.03*(1-t/capTicks) : damage) :
        (-100*leaks + .15*Math.min(gain,100) + .012*Math.min(200,stats.killed));
      const total=[...heat.values()].reduce((a,b)=>a+b,0);
      if(total)for(const [key,v] of heat)heat.set(key,v/total);
      return {index,score,ticks:t,won,lp:hp,loss,overtime,damage,leaks,gain,heat,tape};
    }
    function run(plan,tape,index) {
      trials++;
      try {const row=simulate(plan,tape,index);ticks+=row.ticks;return row;}
      catch(err){errors.push({index,tape,error:String(err)});return null;}
    }
    function first(plan) {
      const key=signature(plan);
      if(seen.has(key))return;
      const i=plans.length;
      plans.push(plan);seen.set(key,i);
      const row=run(plan,0,i);
      if(row)rows.push(row);
    }
    candidates.forEach(first);
    if(!rows.length)return {formation:plans[0],index:0,trials,ticks,errors,publicWaveDistance:nearest,best:null,rows:[],bounties:seat.bounties.length};
    const origin=rows.slice().sort(order)[0];
    if(mutations)for(const next of proposeEdits(s,seat,plans[origin.index],origin.heat,mutations,rangeTiles,rangeRec,BOSS_ROW_OFFSET,isBoss)) first(next);
    const shortlist=rows.slice().sort(order);
    const repeat=Math.max(0,Math.min(16,opts.confirm??0));
    let winner=shortlist[0];
    if(repeat>0) {
      const confirmed=[];
      for(const row of shortlist.slice(0,repeat)) {
        const repeatRow=run(plans[row.index],1,row.index);
        if(repeatRow)confirmed.push({...row,score:(row.score+repeatRow.score)/2,secondScore:repeatRow.score});
      }
      if(confirmed.length)winner=confirmed.sort(order)[0];
    }
    const visible=row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='heat'));
    return {formation:plans[winner.index],index:winner.index,trials,ticks,errors,publicWaveDistance:nearest,
      best:visible(winner),rows:rows.map(visible),bounties:seat.bounties.length};
  };
}
