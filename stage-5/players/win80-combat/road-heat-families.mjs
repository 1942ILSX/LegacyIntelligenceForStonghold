const signature=plan=>plan.map(g=>g.join('/')).sort().join('|');

export function family(origin,plan) {
  const original=new Map(origin.map(g=>[g[0],g]));
  if(plan.some(g=>!original.has(g[0])))return 'bench';
  const moved=plan.filter(g=>g[1]!==original.get(g[0])[1]||g[2]!==original.get(g[0])[2]);
  if(moved.length>1)return 'swap';
  if(moved.length===1)return 'move';
  return plan.some(g=>g[3]!==original.get(g[0])[3])?'rotate':null;
}

export function diverseEdits(origin,originals,generated) {
  const prior=new Set(originals.map(signature)),families=new Set(),edits=[];
  for(let i=0;i<generated.length;i++){
    const plan=generated[i],key=signature(plan),kind=family(origin,plan);
    if(!kind||families.has(kind)||prior.has(key))continue;
    edits.push({plan,kind,originalExtra:i===0});
    prior.add(key);families.add(kind);
    if(edits.length===4)break;
  }
  return edits;
}

export function settleEdits(first,edits,second) {
  let best=first,originalScore=first.score,winner='incumbent';
  let originalComplete=false,completedMask=0;
  for(const x of second.resolved||[]){
    const edit=edits[x.i];
    completedMask|=1<<x.i;
    if(edit.originalExtra){originalComplete=true;originalScore=Math.max(originalScore,x.score);}
    if(x.score>best.score){
      best={...second,plan:edit.plan,index:x.i,complete:true,score:x.score,checkpoint:null};
      winner=edit.kind;
    }
  }
  return {...best,refined:true,changed:best!==first,attempted:first.attempted+second.attempted,
    finished:first.finished+second.finished,errors:first.errors+second.errors,
    roadHeat:{kinds:edits.map(e=>e.kind),completedMask,winner,originalComplete,
      betterThanOriginal:best.score>originalScore,rawScore:first.score,retainedScore:best.score}};
}

function exactly(source,find,replacement){
  if(source.split(find).length!==2)throw Error('Unknown road refinement site '+find);
  return source.replace(find,replacement);
}

// This function runs on the released, already-transformed public combat pool.
// Old and fast detached worker URLs, timing, first-stage search and Boss logic are preserved.
export function extendRoadPool(input) {
  let s=exactly(input,'function stage(view,input,deadline,keepHeat=false) {',
    'function stage(view,input,deadline,keepHeat=false,collectResolved=false) {');
  s=exactly(s,'return {heat,unique:plans.length,',
    'const resolved=collectResolved?ended.map(r=>({i:r.i,score:r.v[stride-3]/1e5})):null;\n  return {resolved,heat,unique:plans.length,');
  const start=s.indexOf('const original=new Set(input.map('),finish=s.indexOf('errors:first.errors+extra.errors};',start);
  if(start<0||finish<0)throw Error('Missing ordinary second-stage search');
  const end=finish+'errors:first.errors+extra.errors};'.length;
  s=s.slice(0,start)+`
    const generated=fromHeat(view,first.plan,new Float64Array(first.heat),first.index,12);
    const edits=diverseEdits(first.plan,input,generated);
    if(!edits.length||millis()+6>=deadline)return first;
    const extra=stage(view,edits.map(x=>x.plan),deadline,false,true);
    return settleEdits(first,edits,extra);`+s.slice(end);
  return 'import {diverseEdits,settleEdits} from '+JSON.stringify(import.meta.url)+';\n'+s;
}
