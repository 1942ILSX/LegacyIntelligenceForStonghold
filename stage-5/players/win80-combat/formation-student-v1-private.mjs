import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// These copies share immutable rules and engine classes with the released worker. Only
// the explicitly named forecast modules get distinct module identities and source edits.
const tag='?terminal-student-v1';
const urls={
 arena:new URL('./public-arena.mjs',import.meta.url).href,
 ranker:new URL('./formation-lab-ranker.mjs',import.meta.url).href,
 legal:new URL('./legal-public-formation.mjs',import.meta.url).href,
 kernel:new URL('../solo-40-portfolio-c/search/index.mjs',import.meta.url).href,
 seat:new URL('../solo-40-portfolio-c/search/seat.mjs',import.meta.url).href
};
const tagged=new Set(Object.values(urls));
const replace=(text,from,to)=>{
 if(text.split(from).length!==2)throw Error('The released private forecast changed at '+from);
 return text.replace(from,()=>to);
};
let installed=false;
export function installIsolatedTerminalForecast(){
 if(installed)return;installed=true;
 registerHooks({
  resolve(specifier,ctx,next){
   const target=next(specifier,ctx);
   return ctx.parentURL?.endsWith(tag)&&tagged.has(target.url)?{...target,url:target.url+tag,shortCircuit:true}:target;
  },
  load(url,ctx,next){
   if(!url.endsWith(tag))return next(url,ctx);
   const plain=url.slice(0,-tag.length);
   if(!tagged.has(plain))throw Error('Unrecognized private terminal module');
   let src=readFileSync(fileURLToPath(plain),'utf8');
   if(plain===urls.seat)src=replace(src,'const original = new Map(','ps.commandMarks.push(...structuredClone(own.rememberedCommands||[]));\n  const original = new Map(');
   if(plain===urls.kernel){
    const prepare='const {ps:view,dispatcher,faults}=seat.install(plan,metaSeed);';
    src='import {checkPublicFormation} from '+JSON.stringify(urls.legal+tag)+';\n'+src;
    src=replace(src,prepare,`const realized=checkPublicFormation(gd,{s,own,pub},plan,{returnPrepared:true,metaSeed});
      if(!realized.prepared||realized.prepared.faults.length)throw Error('Could not reconstruct dispatched battle');
      const {ps:view,dispatcher,faults}=realized.prepared;`);
    src=replace(src,'let loss=0,t=0;',`const forecastStep=opts.forecastStride??1;
      if(![1,2,3].includes(forecastStep))throw Error('Invalid terminal forecast stride');
      battle.dt=forecastStep/30;let loss=0,t=0;`);
    src=replace(src,'battle.step(); t++;',`if(t%24===0&&opts.wallDeadline!==undefined&&performance.now()>=opts.wallDeadline)throw Error('Formation forecast exhausted');
      battle.step();t+=forecastStep;`);
   }
   return {format:'module',source:src,shortCircuit:true};
  }
 });
}
export const isolatedArena=urls.arena+tag,isolatedRanker=urls.ranker+tag;
