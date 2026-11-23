import {registerHooks} from 'node:module';
const target=new URL('../solo-40-portfolio-c/referee.mjs',import.meta.url);
const memory=new URL('./command-history.mjs',import.meta.url);
registerHooks({load(url,ctx,next){
  const loaded=next(url,ctx);if(url!==target.href)return loaded;
  let source=Buffer.from(loaded.source).toString('utf8');
  for(const [a,b] of [
    ['const act = msg => {','const memory=makeCommandHistory(m.gd);const act = msg => {'],
    ['const res = m.handle(pid,msg);',`const pendingMarks=msg.t==='g.command'?memory.describe(m.round,ps.privateView(),msg):null;
      const res = m.handle(pid,msg);if(!res.error&&pendingMarks)memory.commit(pendingMarks);`],
    ['v=publicCase(m,ps,snapshot,"formation",null)','v=memory.decorate(publicCase(m,ps,snapshot,"formation",null),ps.privateView())'],
    ['return {dispatchLatency,timings,','return {commandForecast:memory.summary(),dispatchLatency,timings,'],
  ]){
    if(source.split(a).length!==2)throw Error('Unknown public command hook '+a);source=source.replace(a,b);
  }
  return {...loaded,source:'import {makeCommandHistory} from '+JSON.stringify(memory.href)+';\n'+source};
}});
