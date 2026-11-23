import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const tag='?ordinary-student-mux-v1';
const url=file=>new URL(file,import.meta.url).href;
const urls={
 worker:url('./road-student-v1-worker.mjs'),policy:url('./formation-lab-road-student.mjs'),
 arena:url('./public-arena.mjs'),legal:url('./legal-public-formation.mjs'),
 kernel:url('../solo-40-portfolio-c/search/index.mjs'),seat:url('../solo-40-portfolio-c/search/seat.mjs')
};
const keys=new Set(Object.values(urls));
function replace(src,from,to){
 if(src.split(from).length!==2)throw Error('Frozen ordinary module boundary changed: '+from.slice(0,70));
 return src.replace(from,()=>to);
}
let installed=false;
export async function loadRoadMuxPolicy(){
 if(!installed){
  installed=true;
  registerHooks({
   resolve(specifier,ctx,next){
    const resolved=next(specifier,ctx);
    return ctx.parentURL?.endsWith(tag)&&keys.has(resolved.url)?{...resolved,url:resolved.url+tag,shortCircuit:true}:resolved;
   },
   load(source,ctx,next){
    if(!source.endsWith(tag))return next(source,ctx);
    const plain=source.slice(0,-tag.length);
    if(!keys.has(plain))throw Error('Unknown isolated ordinary module');
    let src=readFileSync(fileURLToPath(plain),'utf8');
    if(plain===urls.worker){
     src=replace(src,"parentPort.on('message',({snapshot,deadline,data})=>{",'export function executeRoadJob({snapshot,deadline,data}){');
     src=replace(src,"});\nparentPort.postMessage({ready:true});",'}');
    }
    if(plain===urls.policy){
     const marker='const value=q=>';
     if(src.split(marker).length!==2)throw Error('Unknown frozen ordinary policy definition');
     src="import {makeCommandHistory} from '../win80/command-history.mjs';\n"+
         "import {observeRoadThreat} from './formation-lab-road-trace.mjs';\n"+
         "import {createRoadEncoder,roadGeometryBank} from './formation-lab-road-ranker.mjs';\n"+
         "import {publicArena,rules} from './public-arena.mjs';\n"+
         "import {checkPublicFormation} from './legal-public-formation.mjs';\n"+src.slice(src.indexOf(marker));
    }
    if(plain===urls.seat)src=replace(src,'const original = new Map(',"ps.commandMarks.push(...structuredClone(own.rememberedCommands||[]));\n  const original = new Map(");
    if(plain===urls.kernel){
     src="import {checkPublicFormation} from "+JSON.stringify(urls.legal+tag)+";\n"+src;
     src=replace(src,'const {ps:view,dispatcher,faults}=seat.install(plan,metaSeed);',
       "const realized=checkPublicFormation(gd,{s,own,pub},plan,{returnPrepared:true,metaSeed});\n"+
       "if(!realized.prepared||realized.prepared.faults.length)throw Error('Could not reconstruct dispatched battle');\n"+
       "const {ps:view,dispatcher,faults}=realized.prepared;");
     src=replace(src,'let loss=0,t=0;', "const forecastStep=opts.forecastStride??1;\n"+
       "if(![1,2,3].includes(forecastStep))throw Error('Invalid ordinary integration interval');\n"+
       "battle.dt=forecastStep/30;let loss=0,t=0;opts.onDetachedBattle?.(battle,pool);");
     src=replace(src,'battle.step(); t++;',
       "if(t%24===0&&opts.wallDeadline!==undefined&&performance.now()>=opts.wallDeadline)throw Error('Ordinary forecast exhausted');battle.step();t+=forecastStep;");
    }
    return {format:'module',source:src,shortCircuit:true};
   }
  });
 }
 return import(urls.worker+tag);
}
