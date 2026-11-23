// Capture only the messages and legal-action projection exposed to the human seat.
const keep=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,obj[k]]));
export function publicCase(m,ps,s,kind,detail) {
  const pub=keep(m.publicView(),['round','phase','stageId','bossId','factions']);
  if(s.r===m.gd.hiddenRound&&s.r!==m.gd.bossRound)pub.hiddenBossId=s.objectiveBoss;
  const own=keep(ps.privateView(),['playerId','seat','loadout','ops','standIns','diy','bandId','funds','lp',
    'shop','stats','command','board','hand','temp','bonds','effects','nextEnemies','deployCap']);
  return structuredClone({pub,own,s,kind,detail});
}
