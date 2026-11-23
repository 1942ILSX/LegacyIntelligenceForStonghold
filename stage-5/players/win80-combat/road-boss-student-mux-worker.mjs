import '../solo-40-portfolio-c/disable-native.mjs';
import {parentPort} from 'node:worker_threads';
import {loadRoadMuxPolicy} from './road-student-mux-private.mjs';
const on=parentPort.on.bind(parentPort),post=parentPort.postMessage.bind(parentPort);
let road=null;
on('message',async job=>{
 if(job?.roadMuxWarm){
  try{road??=await loadRoadMuxPolicy();post({roadMuxReady:true});}
  catch(err){post({roadMuxReady:false,detail:String(err?.stack||err)});}
 }else if(job?.roadGeometry){
  if(road)road.executeRoadJob(job);
  else{
   const out=new Int32Array(job.data);
   Atomics.store(out,5,1);Atomics.store(out,0,1);Atomics.notify(out,0);
  }
 }
});
parentPort.on=(event,handler)=>on(event,event==='message'?function(msg){
 if(!msg?.roadMuxWarm&&!msg?.roadGeometry)return handler.call(this,msg);
}:handler);
await import('./formation-student-v1-worker.mjs');
parentPort.on=on;
