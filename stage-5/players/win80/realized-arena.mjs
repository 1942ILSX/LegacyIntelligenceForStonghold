import {registerHooks} from 'node:module';
const kernel=new URL('../solo-40-portfolio-c/search/index.mjs',import.meta.url).href;
const helper=new URL('../win80-combat/legal-public-formation.mjs',import.meta.url).href;
export function installRealizedTrial(){
  registerHooks({load(url,ctx,next){
    const loaded=next(url,ctx);if(url!==kernel)return loaded;
    let s=Buffer.from(loaded.source).toString('utf8'),m='const {ps:view,dispatcher,faults}=seat.install(plan,metaSeed);';
    if(s.split(m).length!==2)throw Error('Unknown combat kernel');
    const repl=`const realized=checkPublicFormation(gd,{s,own,pub},plan,{returnPrepared:true,metaSeed});
        if(!realized.prepared||realized.prepared.faults.length)throw Error('Could not reconstruct dispatched battle');
        const {ps:view,dispatcher,faults}=realized.prepared;`;
    return {...loaded,source:"import {checkPublicFormation} from "+JSON.stringify(helper)+";\n"+s.replace(m,repl)};
  }});
}
