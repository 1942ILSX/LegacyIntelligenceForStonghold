import '../solo-40-portfolio-c/disable-native.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {registerHooks} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stopPool} from './parallel-pool.mjs';
// Preserve the frozen seeds:{type: CLI arguments. One game process owns four
// detached rehearsal threads. Set the game pool to one for a five-engine cap.
const ref=new URL('../solo-40-portfolio-c/referee.mjs',import.meta.url);
const pooled=new URL('./parallel-pool.mjs',import.meta.url),cases=new URL('./public-case.mjs',import.meta.url);
const met=new URL('./parallel-metrics.mjs',import.meta.url);
const ix=process.argv.indexOf('--player');
if(ix<0||!process.argv[ix+1]||process.argv[ix+1]==='legacy')throw Error('Provide an independent player.');
process.env.SP_WIN80_COMBAT_BASE_URL=pathToFileURL(path.resolve(fileURLToPath(new URL('.',ref)),process.argv[ix+1])).href;
process.argv[ix+1]=fileURLToPath(new URL('./hybrid.mjs',import.meta.url));
registerHooks({load(url,ctx,next){
  if(url!==ref.href)return next(url,ctx);
  let s=fs.readFileSync(ref,'utf8').replaceAll('\r\n','\n');
  const first=s.indexOf('if(search && reply.candidates?.length) {'),last=s.indexOf('placeFormation(ps,goals,act);',first);
  if(first<0||last<first)throw Error('Frozen placement entry changed');
  s=s.slice(0,first)+`if(reply.candidates?.length) {
          const start=performance.now(),v=publicCase(m,ps,snapshot,"formation",null);
          const f=choosePublic(v,reply.candidates,obsClock+(options.combatBudgetMs??420));
          forecastMs=performance.now()-start;goals=f.plan;proposals+=f.attempted;validProposals+=f.attempted-f.errors;
          parallelStats.push([snapshot.r,reply.candidates.length,f.attempted,f.finished,f.checkpoint,f.errors]);
        }
        timings.push([snapshot.r,"formation",performance.now()-obsAt,forecastMs]);
        `+s.slice(last);
  for(const [from,to] of [
    ['const ps = m.order[0], ready =','const timings=[],parallelStats=[];\n  const ps = m.order[0], ready ='],
    ['const snapshot = view(m,ps);','const obsAt=performance.now(),obsClock=millis();\n      const snapshot = view(m,ps);'],
    ['let accepted = 0;','let accepted=0,forecastMs=0;'],
    ['const status=[];','if(!reply.formation)timings.push([snapshot.r,need,performance.now()-obsAt,0]);\n      const status=[];'],
    ['return {seed,openingPublic,','return {timings,parallelStats,seed,openingPublic,'],
  ]){if(!s.includes(from))throw Error('Frozen timing entry changed');s=s.replace(from,to);}
  s='import {millis} from '+JSON.stringify(met.href)+';\nimport {choosePublic} from '+JSON.stringify(pooled.href)+';\nimport {publicCase} from '+JSON.stringify(cases.href)+';\n'+s;
  return {format:'module',source:s,shortCircuit:true};
}});
try{await import(ref);}finally{await stopPool();}
