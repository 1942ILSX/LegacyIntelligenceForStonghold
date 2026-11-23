import {registerHooks} from 'node:module';
const terminal=new URL('./formation-student-v1-hooks.mjs',import.meta.url).href;
const service=new URL('./road-student-v1-service.mjs',import.meta.url).href;
const pool=new URL('./parallel-pool.mjs',import.meta.url).href;
let enabled=false;
export function installFourWorkerRoad(){
 if(enabled)return;enabled=true;
 registerHooks({load(url,ctx,next){
  const original=next(url,ctx);
  if(url!==terminal&&url!==service)return original;
  let src=Buffer.from(original.source).toString('utf8');
  if(url===terminal){
   const key="new URL('./formation-student-v1-worker.mjs',import.meta.url)";
   if(src.split(key).length!==2)throw Error('Frozen terminal worker contract changed');
   src=src.replace(key,"new URL('./road-boss-student-mux-worker.mjs',import.meta.url)");
  }else{
   const boundary="let failed=false,latest=null;";
   if(src.split(boundary).length!==2)throw Error('Unknown ordinary worker boundary');
   src='import {borrowedTerminalWorkers} from '+JSON.stringify(pool)+';\n'+
       'const worker=borrowedTerminalWorkers[0];\n'+
       `await new Promise((resolve,reject)=>{
         const ready=q=>{if(!Object.hasOwn(q,'roadMuxReady'))return;
           worker.off('message',ready);worker.off('error',fail);q.roadMuxReady?resolve():reject(Error(q.detail));};
         const fail=e=>{worker.off('message',ready);reject(e);};
         worker.on('message',ready);worker.once('error',fail);worker.postMessage({roadMuxWarm:true});
       });\n`+src.slice(src.indexOf(boundary));
   const key='worker.postMessage({snapshot:';
   if(src.split(key).length!==2)throw Error('Frozen public request contract changed');
   src=src.replace(key,'worker.postMessage({roadGeometry:true,snapshot:');
  }
  return {...original,source:src};
 }});
}
