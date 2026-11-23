import {registerHooks} from 'node:module';
const referee=new URL('./parallel-referee.mjs',import.meta.url);
const dispatch=new URL('../win80/dispatch-timing.mjs',import.meta.url),history=new URL('../win80/command-observer.mjs',import.meta.url);
const ix=process.argv.indexOf('--options'),options=ix<0?{}:JSON.parse(process.argv[ix+1]);
const normal=options.normalForecastStride??1,boss=options.bossForecastStride??3;
if(![1,2,3].includes(normal)||![1,2,3].includes(boss))throw Error('Forecast strides must be integers 1, 2 or 3');
for(const b of [options.normalBudgetMs,options.bossBudgetMs,options.combatBudgetMs]){
  if(b!==undefined&&(!Number.isFinite(b)||b<=0))throw Error('Forecast budget must be a positive number of milliseconds');
}
if(options.publicForecastCommands!==undefined&&typeof options.publicForecastCommands!=='boolean')throw Error('Expected a boolean command history option');
process.env.SP_WIN80_PUBLIC_MARKS=options.publicForecastCommands?'1':'0';
registerHooks({load(url,ctx,next){
  const loaded=next(url,ctx);if(url!==referee.href)return loaded;
  let source=Buffer.from(loaded.source).toString('utf8');
  const steps=[
    ['obsClock+(options.combatBudgetMs??420)','obsClock+((snapshot.r>=m.gd.bossRound?options.bossBudgetMs:options.normalBudgetMs)??options.combatBudgetMs??420)'],
    ['const f=choosePublic(v,reply.candidates,','v.forecastStride=snapshot.r>=m.gd.bossRound?'+boss+':'+normal+';\n          const f=choosePublic(v,reply.candidates,'],
    ['Number(!!f.refined),Number(!!f.changed)]);','Number(!!f.refined),Number(!!f.changed),v.forecastStride]);'],
    ['try{await import(ref);}finally','try{await import('+JSON.stringify(dispatch.href)+');'+
      (options.publicForecastCommands?'await import('+JSON.stringify(history.href)+');':'')+'await import(ref);}finally'],
  ];
  for(const [from,to] of steps){
    if(source.split(from).length!==2)throw Error('Unknown released forecast entry '+from);
    source=source.replace(from,to);
  }
  return {...loaded,source};
}});
