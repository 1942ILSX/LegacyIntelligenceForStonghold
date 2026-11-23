// Uses the released seeds:{type:'string'} CLI and dispatch clock without changing the real game.
import {registerHooks} from 'node:module';
const entry=new URL('../win80-combat/release-referee.mjs',import.meta.url);
const worker=new URL('./fast-release-worker.mjs',import.meta.url);
registerHooks({load(url,ctx,next){
  const loaded=next(url,ctx);
  if(url!==entry.href)return loaded;
  const original=Buffer.from(loaded.source).toString('utf8');
  const target="new URL('./release-worker.mjs',import.meta.url)";
  if(original.split(target).length!==2)throw Error('Dedicated forecast worker entry changed');
  // This text itself resides inside the release's quoted transformation. URL.href contains no double quotes.
  return {...loaded,source:original.replace(target,"new URL('"+worker.href+"')")};
}});
await import(entry);
