import {Worker} from 'node:worker_threads';
import {checkpoints,stride,empty,millis} from './parallel-metrics.mjs';
const n=Math.max(1,Math.min(4,Number(process.env.SP_WIN80_ARENA_THREADS||4)));
if(!Number.isInteger(n))throw Error('Invalid arena thread count');
const workers=Array.from({length:n},()=>new Worker(new URL('./parallel-worker.mjs',import.meta.url)));
for(const w of workers)w.on('message',msg=>{if(msg.error)process.stderr.write('Detached thread: '+msg.error+'\n');});
await Promise.all(workers.map(w=>new Promise((resolve,reject)=>{
  w.once('message',m=>m.ready?resolve():reject(Error('worker initialization')));
  w.once('error',reject);
})));
export const stopPool=()=>Promise.all(workers.map(w=>w.terminate()));
function dedup(plans){
  const seen=new Set();
  return plans.filter(p=>{const s=p.map(a=>a.join('/')).sort().join('|');if(seen.has(s))return false;seen.add(s);return true;});
}
export function choosePublic(view,input,deadline) {
  const plans=dedup(input),count=Math.min(n,plans.length);
  if(!count)throw Error('No legal candidate');
  const results=new Int32Array(new SharedArrayBuffer(plans.length*stride*4));results.fill(empty);
  const ctl=new Int32Array(new SharedArrayBuffer(3*4));
  for(let i=0;i<count;i++) {
    const indices=[];for(let j=i;j<plans.length;j+=count)indices.push(j);
    workers[i].postMessage({view,plans:indices.map(j=>plans[j]),indices,deadline,control:ctl.buffer,results:results.buffer});
  }
  for(;;){
    const done=Atomics.load(ctl,0),remaining=deadline-millis();
    if(done>=count||remaining<=0)break;
    Atomics.wait(ctl,0,done,remaining);
  }
  Atomics.store(ctl,1,1);
  const rows=plans.map((p,i)=>{const v=[];for(let k=0;k<stride;k++)v.push(Atomics.load(results,i*stride+k));
    return {i,v,complete:v[stride-1]!==empty};});
  const ended=rows.filter(r=>r.complete),won=ended.filter(r=>r.v[stride-3]>150000&&view.s.r>=14);
  let group=won.length?won:rows,slot=stride-3;
  if(!won.length&&ended.length!==rows.length){
    // Compare at the deepest common time of the first concurrent set. A
    // candidate that finished early retains its terminal value thereafter.
    const first=rows.slice(0,count).filter(r=>r.complete||r.v[0]!==empty);
    let k=checkpoints.length-1;
    while(k>=0&&!first.every(r=>r.complete||r.v[k]!==empty))k--;
    if(k<0||!first.length){group=ended.length?ended:[rows[0]];}
    else {slot=k;group=rows.filter(r=>r.complete||r.v[k]!==empty);}
  }
  const value=r=>r.v[slot]!==empty?r.v[slot]:r.complete?r.v[stride-2]:empty;
  const best=group.slice().sort((a,b)=>value(b)-value(a)||a.i-b.i)[0];
  return {plan:plans[best.i],index:best.i,attempted:rows.filter(r=>r.complete||r.v[0]!==empty).length,
    finished:ended.length,checkpoint:slot<checkpoints.length?checkpoints[slot]:null,errors:Atomics.load(ctl,2)};
}
