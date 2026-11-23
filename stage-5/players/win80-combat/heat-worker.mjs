import '../solo-40-portfolio-c/disable-native.mjs';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
const worker=new URL('./parallel-worker.mjs',import.meta.url),score=new URL('./prefix-estimate.mjs',import.meta.url),
  layout=new URL('./heat-layout.mjs',import.meta.url);
registerHooks({load(url,ctx,next){
  if(url!==worker.href)return next(url,ctx);
  let s=fs.readFileSync(worker,'utf8');
  for(const [from,to] of [
    ['const patches=[','const patches=[[\'if(mutations && t%60===0)\',\'if((mutations || opts.recordHeat) && t%60===0)\'],'],
    ['opts.completed(index,score,battle,pool,own,loss);','opts.completed(index,score,battle,pool,own,loss,heat);'],
    ['const ctl=new Int32Array(job.control)','const estimate=makePrefixJudge(job.view),heat=job.heat?new Float64Array(job.heat):null;\n  const ctl=new Int32Array(job.control)'],
    ['checkpoints,stop,observe:','checkpoints,stop,recordHeat:!!heat,observe:'],
    ['write(i,k,partial(b,p,o,l))','write(i,k,estimate(i,k,b,p,o,l))'],
    ['completed:(i,v,b,p,o,l)=>{write(i,stride-3,v);write(i,stride-2,partial(b,p,o,l));',
     'completed:(i,v,b,p,o,l,h)=>{writeHeat(heat,job.indices[i],h);write(i,stride-3,v);write(i,stride-2,v);'],
  ]){if(!s.includes(from))throw Error('Frozen learned worker entry changed');s=s.replace(from,to);}
  return {format:'module',source:'import {makePrefixJudge} from '+JSON.stringify(score.href)+';\nimport {writeHeat} from '+
    JSON.stringify(layout.href)+';\n'+s,shortCircuit:true};
}});
await import(worker);
