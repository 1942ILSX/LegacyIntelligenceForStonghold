import {registerHooks} from 'node:module';
const engine=new URL('../solo-40-portfolio-c/referee.mjs',import.meta.url);
registerHooks({load(url,context,next){
  const loaded=next(url,context);
  if(url!==engine.href)return loaded;
  let source=Buffer.from(loaded.source).toString('utf8');
  for(const [find,replace] of [
    ['let requests = 0,','let firstOutput=0,started=0;const dispatchLatency=[];let requests = 0,'],
    ['const act = msg => {','const act = msg => {if(started&&!firstOutput)firstOutput=performance.now();'],
    ['const obsAt=performance.now(),obsClock=millis();','const obsAt=performance.now(),obsClock=millis();started=obsAt;firstOutput=0;'],
    ['player.ack?.(status);',`dispatchLatency.push([snapshot.r,need,Boolean(reply.formation),
       Math.round(1000*((firstOutput||performance.now())-started)),Boolean(firstOutput)]);
       started=0;player.ack?.(status);`],
    ['return {timings,parallelStats,seed,','return {dispatchLatency,timings,parallelStats,seed,'],
  ]){
    if(source.split(find).length!==2)throw Error('Unknown command timing site '+find);
    source=source.replace(find,replace);
  }
  return {...loaded,source};
}});
