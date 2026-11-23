import '../solo-40-portfolio-c/disable-native.mjs';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
const arena=new URL('./public-arena.mjs',import.meta.url),shim=new URL('./release-kernel.mjs',import.meta.url);
registerHooks({load(url,ctx,next){
  if(url!==arena.href)return next(url,ctx);
  let source=fs.readFileSync(arena,'utf8');
  const from="import {makeSearch} from '../solo-40-portfolio-c/search/index.mjs';",arg='maxSeeds:96,salt,...observation';
  if(!source.includes(from)||!source.includes(arg))throw Error('Detached public model entry changed');
  source=source.replace(from,'import {installForecastStep} from '+JSON.stringify(shim.href)+';\ninstallForecastStep();\n'+
    "const {makeSearch}=await import('../solo-40-portfolio-c/search/index.mjs');");
  source=source.replace(arg,arg+',forecastStride:publicCase.forecastStride??1');
  return {format:'module',source,shortCircuit:true};
}});
await import('./heat-worker.mjs');
