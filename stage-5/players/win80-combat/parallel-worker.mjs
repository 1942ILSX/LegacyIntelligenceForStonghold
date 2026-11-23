import '../solo-40-portfolio-c/disable-native.mjs';
import {parentPort} from 'node:worker_threads';
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import {checkpoints,stride,millis,partial} from './parallel-metrics.mjs';
const search=new URL('../solo-40-portfolio-c/search/index.mjs',import.meta.url);
registerHooks({load(url,ctx,next){
  if(url!==search.href)return next(url,ctx);
  let s=fs.readFileSync(search,'utf8').replaceAll('\r\n','\n');
  const patches=[
    ['function simulate(plan,tape,index) {','const stop=Symbol("partial");\n    function simulate(plan,tape,index) {\n      let checkpoint=0;'],
    ['battle.step(); t++;','if((t&7)===0&&opts.stop())throw stop;\n        battle.step(); t++;\n        if(t===opts.checkpoints[checkpoint]){opts.observe(index,checkpoint,battle,pool,own,loss);checkpoint++;}'],
    ['return {index,score,ticks:t,won','opts.completed(index,score,battle,pool,own,loss);\n      return {index,score,ticks:t,won'],
    ['function run(plan,tape,index) {\n      trials++;','function run(plan,tape,index) {\n      if(opts.stop())return null;\n      trials++;'],
    ['catch(err){errors.push({index,tape,error:String(err)});return null;}','catch(err){if(err!==stop)errors.push({index,tape,error:String(err)});return null;}'],
  ];
  for(const [from,to] of patches){if(!s.includes(from))throw Error('Frozen detached kernel changed');s=s.replace(from,to);}
  return {format:'module',source:s,shortCircuit:true};
}});
if(process.env.SP_WIN80_PUBLIC_MARKS==='1')await import('../win80/detached-commands.mjs');
const {publicArena}=await import('./public-arena.mjs');
const arena=publicArena();
parentPort.on('message',job=>{
  const ctl=new Int32Array(job.control),scores=new Int32Array(job.results);
  const stop=()=>!!Atomics.load(ctl,1)||millis()>=job.deadline;
  function write(i,k,v){Atomics.store(scores,job.indices[i]*stride+k,Math.round(v*100000));}
  try{
    if(!stop())arena.evaluate(job.view,job.plans,{observation:{
      checkpoints,stop,observe:(i,k,b,p,o,l)=>write(i,k,partial(b,p,o,l)),
      completed:(i,v,b,p,o,l)=>{write(i,stride-3,v);write(i,stride-2,partial(b,p,o,l));write(i,stride-1,1);},
    }});
  }catch(err){
    Atomics.add(ctl,2,1);parentPort.postMessage({error:String(err)});
  }finally{Atomics.add(ctl,0,1);Atomics.notify(ctl,0);}
});
parentPort.postMessage({ready:true});
