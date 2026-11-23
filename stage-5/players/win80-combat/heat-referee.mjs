import '../solo-40-portfolio-c/disable-native.mjs';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
const pool=new URL('./parallel-pool.mjs',import.meta.url),layout=new URL('./heat-layout.mjs',import.meta.url);
const referee=new URL('./parallel-referee.mjs',import.meta.url);
// Preserve the frozen human-seat seeds:{type: CLI. When all of the first
// ordinary-wave fights finish early, test the full teacher's heat-driven edit.
registerHooks({load(url,ctx,next){
  if(url===referee.href){
    const s=fs.readFileSync(referee,'utf8'),anchor='f.checkpoint,f.errors]);';
    if(!s.includes(anchor))throw Error('Frozen parallel metrics changed');
    return {format:'module',source:s.replace(anchor,'f.checkpoint,f.errors,Number(!!f.refined),Number(!!f.changed)]);'),shortCircuit:true};
  }
  if(url!==pool.href)return next(url,ctx);
  let s=fs.readFileSync(pool,'utf8');
  for(const [from,to] of [
    ["new URL('./parallel-worker.mjs',import.meta.url)","new URL('./heat-worker.mjs',import.meta.url)"],
    ['export function choosePublic(view,input,deadline) {','function stage(view,input,deadline,keepHeat=false) {'],
    ['const ctl=new Int32Array','const heat=keepHeat?new SharedArrayBuffer(plans.length*heatCells*8):null;\n  const ctl=new Int32Array'],
    ['postMessage({view,plans:','postMessage({view,heat,plans:'],
    ['return {plan:plans[best.i],index:best.i,attempted:','return {heat,unique:plans.length,complete:best.complete,score:best.v[stride-3]/1e5,plan:plans[best.i],index:best.i,attempted:'],
  ]){if(!s.includes(from))throw Error('Frozen bounded worker pool changed');s=s.replace(from,to);}
  s='import {fromHeat,heatCells} from '+JSON.stringify(layout.href)+';\n'+s;
  s+=`
export function choosePublic(view,input,deadline){
  const boss=view.s.r>=14,first=stage(view,input,deadline,!boss);
  if(boss||!first.complete||first.finished<first.unique||millis()+9>=deadline)return first;
  const original=new Set(input.map(p=>p.map(g=>g.join('/')).sort().join('|')));
  const edits=fromHeat(view,first.plan,new Float64Array(first.heat),first.index,1)
    .filter(p=>!original.has(p.map(g=>g.join('/')).sort().join('|')));
  if(!edits.length||millis()+6>=deadline)return first;
  const extra=stage(view,edits,deadline);
  const winner=extra.complete&&extra.score>first.score?extra:first;
  return {...winner,refined:true,changed:winner===extra,attempted:first.attempted+extra.attempted,finished:first.finished+extra.finished,
    errors:first.errors+extra.errors};
}`;
  return {format:'module',source:s,shortCircuit:true};
}});
await import('./parallel-referee.mjs');
