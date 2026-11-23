import {registerHooks} from 'node:module';
const dispatch=new URL('../win80/dispatch-timing.mjs',import.meta.url).href;
const referee=new URL('../solo-40-portfolio-c/referee.mjs',import.meta.url).href;
const service=new URL('./road-student-v1-service.mjs',import.meta.url).href;
const self=import.meta.url;
let installed=false;
export function installShortRoadReferee(){
 registerHooks({load(url,ctx,next){
  const original=next(url,ctx);
  if(url!==referee)return original;
  let src=Buffer.from(original.source).toString('utf8');
  const edits=[
   ['const psOptions = {','const roadStudentSession=createRoadSession();\n  const psOptions = {'],
   ['const res = m.handle(pid,msg);','const res = m.handle(pid,msg);\n      if(!res.error)roadStudentSession.record(round,msg);'],
   ['let goals = reply.formation;','if(snapshot.r>=8&&snapshot.r<=13)roadStudentSession.remember(reply.candidates);\n        let goals = reply.formation;'],
   ['const res=act(msg);',`if(msg.t==='g.ready'&&snapshot.r>=8&&snapshot.r<=13){
       const c=publicCase(m,ps,view(m,ps),'ready',null);
       c.own.prepMapChars=ps.privateView().prepMapChars;
       const answer=roadStudentSession.choose(c,obsAt+450);
       if(answer)placeFormation(ps,answer,act);
     }
     const res=act(msg);`],
   ['passed:result.roundsPassed,reached14:','roadGeometry:roadStudentSession.timings,passed:result.roundsPassed,reached14:']
  ];
  for(const [from,to]of edits){
   if(src.split(from).length!==2)throw Error('Frozen ordinary decision changed at '+from);
   src=src.replace(from,()=>to);
  }
  return {...original,source:'import {createRoadSession} from '+JSON.stringify(service)+';\n'+src};
 }});
}
export function installShortRoad(){
 if(installed)return;installed=true;
 registerHooks({load(url,ctx,next){
  const original=next(url,ctx);if(url!==dispatch)return original;
  return {...original,source:Buffer.from(original.source).toString('utf8')+'\nimport {installShortRoadReferee} from '+JSON.stringify(self)+';\ninstallShortRoadReferee();\n'};
 }});
}
