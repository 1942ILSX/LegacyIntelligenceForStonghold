import {isForecastHookLimit} from './forecast-hook-limit.mjs';
import '../solo-40-portfolio-c/disable-native.mjs';
import {parentPort} from 'node:worker_threads';
import {installIsolatedTerminalForecast,isolatedArena} from './formation-student-v1-private.mjs';
const on=parentPort.on.bind(parentPort),post=parentPort.postMessage.bind(parentPort);
const now=()=>Number(process.hrtime.bigint()/1000000n);
let arena=null;
on('message',job=>{
 if(!job?.terminalGeometry)return;
 const ctl=new Int32Array(job.control),scores=new Int32Array(job.results);
 const remaining=()=>job.deadline-now();
 try{
  for(const [j,p]of job.plans.entries()){
   if(Atomics.load(ctl,1)||remaining()<=1)break;
   let q;
   try{[q]=arena.evaluate(job.c,[p],{salt:job.salt,observation:{forecastStride:job.stride,wallDeadline:performance.now()+remaining()}});}
   catch(err){
    if(String(err).includes('Formation forecast exhausted'))break;
    if(isForecastHookLimit(err))continue;
    throw err;
   }
   const k=job.ids[j]*5;Atomics.store(scores,k,Number(q.won));Atomics.store(scores,k+1,Math.round(q.damage*1e7));
   Atomics.store(scores,k+2,q.lp);Atomics.store(scores,k+3,q.ticks);Atomics.store(scores,k+4,1);
  }
 }catch(err){Atomics.add(ctl,2,1);post({error:String(err)});}
 finally{Atomics.add(ctl,0,1);Atomics.notify(ctl,0);}
});
// The released worker is fully initialized on its canonical URLs before the private
// replay is imported. Delay the ready handshake until both services can accept work.
let originalReady=false;
parentPort.on=(ev,handler)=>on(ev,ev==='message'?function(msg){if(!msg?.terminalGeometry)return handler.call(this,msg);}:handler);
parentPort.postMessage=function(msg,...args){if(msg?.ready){originalReady=true;return;}return post(msg,...args);};
await import('../win80/fast-release-worker.mjs');
if(!originalReady)throw Error('Released forecast worker failed its ready handshake');
installIsolatedTerminalForecast();
const {publicArena}=await import(isolatedArena);arena=publicArena();
parentPort.on=on;parentPort.postMessage=post;post({ready:true});
