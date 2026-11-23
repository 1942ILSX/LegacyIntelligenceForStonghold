import {registerHooks} from 'node:module';
const kernel=new URL('../solo-40-portfolio-c/search/index.mjs',import.meta.url);

// The forecast counts elapsed time in original 30-Hz units and changes only
// the private detached Battle instance. Its caller controls the numerical step.
export function installForecastStep(){
  registerHooks({load(url,ctx,next){
    const loaded=next(url,ctx);
    if(url!==kernel.href)return loaded;
    let source=Buffer.from(loaded.source).toString('utf8');
    const start='let loss=0,t=0;',step='battle.step(); t++;';
    if(!source.includes(start)||!source.includes(step))throw Error('Detached forecast time boundary changed');
    source=source.replace(start,'const forecastStep=opts.forecastStride??1;\n'+
      "if(![1,2,3].includes(forecastStep))throw Error('Invalid detached forecast step');\n"+
      'battle.dt=forecastStep/30;\n'+start);
    source=source.replace(step,'battle.step(); t+=forecastStep;');
    source=source.replace('if(t===opts.checkpoints[checkpoint])','if(t>=opts.checkpoints[checkpoint])');
    return {...loaded,source,shortCircuit:true};
  }});
}
