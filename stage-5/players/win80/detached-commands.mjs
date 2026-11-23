import {registerHooks} from 'node:module';
const seat=new URL('../solo-40-portfolio-c/search/seat.mjs',import.meta.url);
registerHooks({load(url,ctx,next) {
  const loaded=next(url,ctx);if(url!==seat.href)return loaded;
  const source=Buffer.from(loaded.source).toString('utf8'),needle='const original = new Map(';
  if(source.split(needle).length!==2)throw Error('Unknown public seat');
  return {...loaded,source:source.replace(needle,'ps.commandMarks.push(...structuredClone(own.rememberedCommands||[]));\n  '+needle)};
}});
