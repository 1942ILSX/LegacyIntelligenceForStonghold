import '../solo-40-portfolio-c/disable-native.mjs';
import {parentPort} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createShortRoadPolicy} from './formation-lab-road-student.mjs';

const bytes=readFileSync(new URL('./road-student-v1.weights.json',import.meta.url));
const spec=JSON.parse(readFileSync(new URL('./road-student-v1.options.json',import.meta.url),'utf8'));
if(createHash('sha256').update(bytes).digest('hex')!==spec.weightSHA256)throw Error('Unrecognized ordinary ranker');
const solver=createShortRoadPolicy(JSON.parse(bytes),spec);
const directions=['UP','RIGHT','DOWN','LEFT'];
const millis=()=>Number(process.hrtime.bigint())/1e6;
const reasons=['none','changed','quiet','incumbent','incumbent-exhausted','geometry-exhausted','retained'];
parentPort.on('message',({snapshot,deadline,data})=>{
 const out=new Int32Array(data);
 try{
  const remaining=deadline-millis();
  if(remaining>3){
   const action=solver.choose(snapshot,{deadline:performance.now()+remaining});
   out[1]=reasons.indexOf(action.reason);
   out[2]=action.completed;out[3]=Math.round(action.elapsedMs*1000);
   if(action.changed){
    if(action.p.length>(out.length-8)/4)throw Error('Board cannot fit the bounded action message');
    out[4]=action.p.length;
    action.p.forEach(([uid,r,c,dir],j)=>{
     const at=8+4*j,k=directions.indexOf(dir);
     if(k<0)throw Error('Unknown operator direction');
     out[at]=uid;out[at+1]=r;out[at+2]=c;out[at+3]=k;
    });
   }
  }
 }catch(err){
  out[5]=1;
  parentPort.postMessage({fault:String(err?.message||err).slice(0,300)});
 }finally{Atomics.store(out,0,1);Atomics.notify(out,0);}
});
parentPort.postMessage({ready:true});
