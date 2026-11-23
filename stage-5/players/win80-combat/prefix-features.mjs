import {checkpoints} from './parallel-metrics.mjs';
export {checkpoints};
const bounded=(x,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(x)?x:0));
const ratio=(v,t)=>bounded(v/Math.max(1,t),0,1);

// Read plain, already-materialized fields of the detached simulated battle.
// Calling a live Unit stat getter can cause a lazy max-HP recalculation.
export function tracePoint(battle,pool,own,loss,t,round,boss,prev=null) {
  const enemies=battle.enemies,allies=battle.allyUnits,positions=new Array(6).fill(0);
  let live=0,hurts=0,locked=0,near=0,enemyHealth=0,bossX=0,bossY=0,bossBlock=0;
  for(const u of enemies){
    if(!u.alive||!u.deployed||u.hidden)continue;
    const stats=u._s||u.base,hp=ratio(u.hp,stats.maxHp),x=bounded(u.x,0,12);
    live++;hurts+=1-hp;locked+=Boolean(u.blockedBy);enemyHealth+=Math.log1p(Math.max(0,u.hp));
    near+=Math.max(0,7-x)*hp;
    positions[Math.min(5,Math.floor(x/2))]+=hp;
    if(u.bossPool){bossX=x;bossY=u.y;bossBlock=Number(!!u.blockedBy);}
  }
  let active=0,able=0,damaged=0,dep=0,sp=0,atk=0,strongest=0,health=0;
  for(const u of allies){
    if(u.deployed)dep++;
    if(!u.alive||!u.deployed||u.hidden)continue;
    const stats=u._s||u.base;
    active++;able+=!stats.flags?.stun;damaged+=1-ratio(u.hp,stats.maxHp);
    sp+=Math.log1p(Math.max(0,u.skill?.sp||0));
    const power=Math.min(25000,(stats.atk||0)/Math.max(.15,stats.interval||stats.bat||1));
    atk+=power;strongest=Math.max(strongest,power);health+=Math.log1p(Math.max(0,u.hp));
  }
  const killed=battle.killedInTotal,leaks=battle.leakedCount,total=battle.total;
  const dmg=pool?1-ratio(pool.hp,pool.maxHp):0;
  const bossIdx=Number(String(boss??'').split('_').at(-1));
  const ctx=[round/14,Math.log1p(t)/8,own.lp/20,Math.log1p(total)/4,allies.length/12];
  const feats=[...ctx,dmg,loss/10,killed/16,leaks/6,ratio(killed,total),live/12,hurts/8,
    locked/8,near/32,enemyHealth/64,bossX/12,bossY/20,bossBlock,active/12,able/12,
    damaged/8,dep/12,sp/24,atk/1e4,strongest/2500,health/60,...positions.map(v=>v/5)];
  const cur=[t,dmg,killed,leaks,hurts,active,near];
  const per=prev?240/Math.max(1,t-prev[0]):240/t;
  for(let k=1;k<cur.length;k++)feats.push(bounded((cur[k]-(prev?.[k]||0))*per,-10,10));
  for(let i=1;i<=18;i++)feats.push(Number(i===bossIdx));
  return {raw:cur,x:feats.map(x=>+bounded(x,-20,20).toFixed(4))};
}
