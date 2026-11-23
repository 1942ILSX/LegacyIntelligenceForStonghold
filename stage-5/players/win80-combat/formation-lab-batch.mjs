const now=()=>Number(process.hrtime.bigint()/1000000n);
const stride=5;
export function batchTerminalForecast(workers){
 if(!workers.length)throw Error('No bounded-release workers were attached');
 return (c,plans,wallDeadline,spec)=>{
  const left=Math.max(0,wallDeadline-performance.now()),deadline=now()+left;
  const score=new Int32Array(new SharedArrayBuffer(plans.length*stride*4)),ctl=new Int32Array(new SharedArrayBuffer(12));
  const count=Math.min(plans.length,workers.length);if(!count)return [];
  for(let i=0;i<count;i++){
   const ids=[];for(let j=i;j<plans.length;j+=count)ids.push(j);
   workers[i].postMessage({terminalGeometry:true,c,plans:ids.map(j=>plans[j]),ids,salt:spec.salt,
     stride:spec.forecastStride??3,deadline,results:score.buffer,control:ctl.buffer});
  }
  while(Atomics.load(ctl,0)<count){
    const completed=Atomics.load(ctl,0),ms=deadline-now();if(ms<=0)break;
    Atomics.wait(ctl,0,completed,ms);
  }
  Atomics.store(ctl,1,1);
  if(Atomics.load(ctl,2))throw Error('Detached geometry worker failed');
  return plans.map((_,i)=>{const k=i*stride;
   return Atomics.load(score,k+4)?{won:!!Atomics.load(score,k),damage:Atomics.load(score,k+1)/1e7,lp:Atomics.load(score,k+2),ticks:Atomics.load(score,k+3)}:null;
  });
 };
}
