import '../solo-40-portfolio-c/disable-native.mjs';
import fs from 'node:fs';
import {registerHooks} from 'node:module';

const heat=new URL('./heat-referee.mjs',import.meta.url),timing=new URL('./release-timing.mjs',import.meta.url);
// Keep the frozen human-seat seeds:{type: CLI and actual 30-Hz game. The
// versioned entry sets independent normal/Boss forecasts from release options.
registerHooks({load(url,ctx,next){
  if(url!==heat.href)return next(url,ctx);
  const source=fs.readFileSync(heat,'utf8'),worker="new URL('./heat-worker.mjs',import.meta.url)";
  const boot="await import('./parallel-referee.mjs');";
  if(!source.includes(worker)||source.split(boot).length!==2)throw Error('Frozen heat release targets have changed');
  return {format:'module',source:source.replace(worker,"new URL('./release-worker.mjs',import.meta.url)")
    .replace(boot,'await import('+JSON.stringify(timing.href)+');\n'+boot),shortCircuit:true};
}});
await import(heat);
