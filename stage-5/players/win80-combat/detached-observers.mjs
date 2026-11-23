import fs from 'node:fs';
import {registerHooks} from 'node:module';
const kernel=new URL('../solo-40-portfolio-c/search/index.mjs',import.meta.url);
registerHooks({load(url,ctx,next){
  if(url!==kernel.href)return next(url,ctx);
  const original=fs.readFileSync(kernel,'utf8'),anchor='let loss=0,t=0;';
  if(!original.includes(anchor))throw Error('Detached combat event interface changed');
  return {format:'module',source:original.replace(anchor,anchor+'\n      opts.onDetachedBattle?.(battle,pool);'),shortCircuit:true};
}});
