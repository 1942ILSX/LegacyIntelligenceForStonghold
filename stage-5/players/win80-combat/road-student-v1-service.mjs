import {Worker} from 'node:worker_threads';

// This single, prewarmed thread owns its independent rules and private battle
// hooks. The Stage3 official match and its existing road-planning workers keep
// their module instances. The terminal action is always issued on the main seat.
const worker=new Worker(new URL('./road-student-v1-worker.mjs',import.meta.url));
await new Promise((resolve,reject)=>{
 worker.once('error',reject);
 worker.once('message',q=>q.ready?resolve():reject(Error('Ordinary forecast failed its ready handshake')));
});
worker.unref();
let failed=false,latest=null;
worker.on('error',()=>{failed=true;});
const dirs=['UP','RIGHT','DOWN','LEFT'];
const reasons=['none','changed','quiet','incumbent','incumbent-exhausted','geometry-exhausted','retained'];
const millis=()=>Number(process.hrtime.bigint())/1e6;
export function createRoadSession(){
 let bank=[];
 const commands=[],timings=[],seen=new Set();
 return {
  timings,
  remember(candidates){bank=candidates||[];},
  record(round,msg){if(msg.t==='g.command'&&round>=8&&round<=13)commands.push({round,msg:structuredClone(msg)});},
  choose(c,deadline){
   const round=c.s.r;
   if(round<8||round>13||seen.has(round))return null;
   seen.add(round);
   const at=performance.now(),budget=Math.max(0,deadline-at);
   if(failed||budget<12||(latest&&!Atomics.load(latest,0))){
    timings.push({round,reason:'retained-busy',elapsedMs:performance.now()-at});return null;
   }
   const out=new Int32Array(new SharedArrayBuffer(4*(8+4*36)));latest=out;
   c.detail={candidates:bank};
   const physicalDeadline=millis()+budget;
   worker.postMessage({snapshot:{c,commands:commands.filter(q=>q.round===round)},deadline:physicalDeadline-2,data:out.buffer});
   const left=Math.max(0,physicalDeadline-millis());
   if(!Atomics.load(out,0))Atomics.wait(out,0,0,left);
   const complete=!!Atomics.load(out,0),fault=complete&&!!out[5];
   const changed=complete&&!fault&&out[4]>0;
   timings.push({round,reason:fault?'forecast-error':!complete?'wall-deadline':reasons[out[1]]||'retained',
    changed,completed:complete?out[2]:0,elapsedMs:performance.now()-at});
   if(!changed)return null;
   return Array.from({length:out[4]},(_,j)=>{
    const k=8+4*j;return [out[k],out[k+1],out[k+2],dirs[out[k+3]]];
   });
  }
 };
}
