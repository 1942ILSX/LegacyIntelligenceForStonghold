export const checkpoints=[120,240,480,900,1500,2400,3600,5400,8000,12000];
export const stride=checkpoints.length+3;
export const empty=-2147483648;
export const millis=()=>Number(process.hrtime.bigint()/1000000n);
export function partial(battle,pool,own,loss) {
  if(pool) {
    const damage=1-pool.hp/Math.max(1,pool.maxHp);
    const survivors=battle.allyUnits.filter(u=>u.alive&&u.deployed).length;
    return damage+.004*Math.min(1,survivors/7)-.008*Math.min(1,loss/Math.max(1,own.lp));
  }
  let cleared=0,threat=0;
  for(const enemy of battle.enemies){
    if(!enemy.alive||!enemy.deployed||enemy.hidden)continue;
    const hp=Math.max(0,Math.min(1,enemy.hp/Math.max(1,enemy.s.maxHp)));
    cleared+=1-hp;
    threat+=Math.max(0,Math.min(1,(8-enemy.x)/6))*hp*(enemy.blockedBy ? .70 : 1);
  }
  return -100*battle.leakedCount+1.3*(battle.killedInTotal+cleared)-1.5*threat;
}
