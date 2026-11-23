import {registerHooks} from 'node:module';
const service=new URL('./formation-student-v1-policy.mjs',import.meta.url).href;
const self=import.meta.url;
const mux=new URL('./formation-student-v1-worker.mjs',import.meta.url).href;
const entry=new URL('../../',import.meta.url);
const dispatch=new URL('players/win80/dispatch-timing.mjs',entry).href;
const referee=new URL('players/solo-40-portfolio-c/referee.mjs',entry).href;
const pool=new URL('players/win80-combat/parallel-pool.mjs',entry).href;
const releaseWorker=new URL('players/win80/fast-release-referee.mjs',entry).href;
const families=new URL('players/win80-combat/road-heat-families.mjs',entry).href;
export function installTerminalStageReferee(){
  registerHooks({load(url,context,next){
    const result=next(url,context);if(url!==referee)return result;
    let src=Buffer.from(result.source).toString('utf8');
    const changes=[
      ['const psOptions = {','const terminalSession=createPackagedTerminalSession(staticRules,borrowedTerminalWorkers);\n  const psOptions = {'],
      ['const res = m.handle(pid,msg);',`const cmdTrace=msg.t==='g.command'?terminalSession.beforeCommand(round,ps.privateView(),msg):null;
       const res = m.handle(pid,msg);
       if(!res.error&&cmdTrace)terminalSession.accepted(cmdTrace);`],
      ['let goals = reply.formation;','if(snapshot.r===14)terminalSession.remember(reply.candidates);\n        let goals = reply.formation;'],
      ['const res=act(msg);',`if(msg.t==='g.ready'&&snapshot.r===14){
          const publicView=publicCase(m,ps,view(m,ps),'ready',null);
          const improved=terminalSession.choose(publicView,ps.privateView(),obsAt+450);
          if(improved)placeFormation(ps,improved,act);
        }
        const res=act(msg);`],
      ['return {dispatchLatency,','return {terminalGeometry:terminalSession.timings,dispatchLatency,']
    ];
    for(const [from,to] of changes){
      if(src.split(from).length!==2)throw Error('The frozen Stage3 intervention point changed: '+from);
      src=src.replace(from,()=>to);
    }
    const prefix='import {createPackagedTerminalSession} from '+JSON.stringify(service)+';\n'+
      'import {borrowedTerminalWorkers} from '+JSON.stringify(pool)+';\n';
    return {...result,source:prefix+src};
  }});
}
let booted=false;
export function installTerminalStage3(){
 if(booted)return;booted=true;
 registerHooks({load(url,context,next){
  const result=next(url,context);
  if(url===releaseWorker){
    const src=Buffer.from(result.source).toString('utf8'),key="new URL('./fast-release-worker.mjs',import.meta.url)";
    if(src.split(key).length!==2)throw Error('Released worker selection changed');
    return {...result,source:src.replace(key,'new URL('+JSON.stringify(mux)+')')};
  }
  if(url===families){
    const src=Buffer.from(result.source).toString('utf8'),key="JSON.stringify(import.meta.url)+';\\n'+s;";
    if(src.split(key).length!==2)throw Error('Released extension mechanism changed');
    return {...result,source:src.replace(key,"JSON.stringify(import.meta.url)+';\\n'+s+'\\nexport const borrowedTerminalWorkers=workers;\\n';")};
  }
  if(url!==dispatch)return result;
  return {...result,source:Buffer.from(result.source).toString('utf8')+'\nimport {installTerminalStageReferee} from '+JSON.stringify(self)+';\ninstallTerminalStageReferee();\n'};
}});
}
