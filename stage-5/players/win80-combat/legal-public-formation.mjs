import {PlayerState} from '../../engine/v0.4.0/server/match/PlayerState.js';
import {boardOrder} from '../../engine/v0.4.0/server/match/board.js';
import {commandBondOverrides} from '../../engine/v0.4.0/server/match/bandCommands.js';
import {computeBonds,bondList,offBondCounts} from '../../engine/v0.4.0/server/match/bondsMeta.js';
import {EffectDispatcher,getDefaultRegistry} from '../../engine/v0.4.0/server/match/effectsMeta.js';
import {createRng} from '../../engine/v0.4.0/server/sim/rng.js';
import {makeSeat} from '../solo-40-portfolio-c/search/seat.mjs';
import {placeFormation} from '../solo-40-portfolio-c/formation.mjs';

const goalKey=plan=>plan.map(g=>g.join('/')).sort().join('|');
const sourceLimits=[
  'The detached seat contains the human-visible snapshot. Undisclosed effect counters, earlier strategy-use marks and pending-trigger history cannot be reconstructed from a snapshot alone.',
  'Visible existing piece and item fields are carried forward by UID. Newly split summons or issued rewards receive local synthetic UIDs; the live official match may assign other numbers.',
  'Visible board, hand, temp and bonds are recomputed; unchanged shop offers, command metadata, effects and future-wave preview in the returned own object are copied from the input rather than reconstructed after every trigger.',
];
function publicPlacementProjection(ps,c,faults){
  const original=new Map([...c.own.board,...c.own.hand,...c.own.temp].filter(Boolean).map(p=>[p.uid,p]));
  const inspect=(p,rc=null)=>{
    const prior=structuredClone(original.get(p.uid)||{});
    for(const k of ['row','col','dir'])delete prior[k];
    const fresh=ps.pieceView(p,rc),oldItems=new Map((prior.items||[]).map(i=>[i.uid,i]));
    if(fresh.items)fresh.items=fresh.items.map(i=>({...oldItems.get(i.uid),...i}));
    return {...prior,...fresh};
  };
  const board=boardOrder(ps.board).map(({r,c,piece})=>inspect(piece,[r,c]));
  const hand=ps.hand.map(p=>p?inspect(p):null);
  const temp=(ps.equipHand?ps.temp.slice(0,ps.gd.tempSize):ps.temp).map(p=>p?inspect(p):null);
  const bonds=bondList(ps.gd,ps.bondsView(),{full:true,off:offBondCounts(ps.gd,ps),effectOverrides:commandBondOverrides(ps)});
  const own={...structuredClone(c.own),board,hand,temp,bonds,lp:ps.lp,funds:ps.funds};
  if(ps.equipHand)own.stashCount=ps.tempPieces().length;
  return {own,board,hand,temp,bonds,usable:faults.length===0,limitations:[...sourceLimits]};
}
export function checkPublicFormation(gd,c,plan,{trace=false,auditProjection=false,returnProjection=false,returnPrepared=false,metaSeed=73810001}={}){
  const bodies=new Map([...c.own.board,...c.own.hand,...c.own.temp].filter(Boolean).map(p=>[p.uid,p]));
  const chosen=new Set(plan.map(p=>p[0]));
  const partial=returnProjection||returnPrepared;
  if(!Number.isSafeInteger(metaSeed))throw Error('The detached meta seed must be an independent integer');
  const capFail=chosen.size!==plan.length||plan.filter(g=>bodies.get(g[0])?.kind==='chess').length>c.own.deployCap;
  const ownerFail=plan.some(g=>{const t=bodies.get(g[0]);return !t||t.kind==='token'&&t.ownerUid!=null&&!chosen.has(t.ownerUid);});
  if(capFail&&!partial)return {ok:false,reason:'duplicate-or-capacity'};
  if(ownerFail&&!partial)return {ok:false,reason:'missing-piece-or-owner'};
  const src=c.own.board.map(p=>[p.uid,p.row,p.col,p.dir||'RIGHT']);
  const commands=[];
  try{
    // Match salt and instance IDs are synthetic and independent of the original game RNG.
    const own=structuredClone(c.own);
    for(const p of [...own.board,...own.hand,...own.temp].filter(Boolean))p.meta??={};
    const seat=makeSeat(PlayerState,computeBonds,EffectDispatcher,getDefaultRegistry(),gd,c.pub,own,c.s,metaSeed,createRng);
    const {ps,dispatcher,faults}=seat.install(src,metaSeed);
    Object.defineProperty(ps,'deployCap',{value:own.deployCap});
    const equippedIds=[...bodies.values()].flatMap(p=>(p.items||[]).map(i=>i.uid));
    const m=ps.m;let syntheticUid=Math.max(10000,...bodies.keys(),...equippedIds)+1;
    m.nextUid=()=>syntheticUid++;m.toast=()=>{};
    m.dispatch=(who,key,payload)=>dispatcher.dispatch(who,key,payload);
    const n=chosen.size!==plan.length||new Set(plan.map(g=>g[1]+','+g[2])).size!==plan.length?0:placeFormation(ps,plan,cmd=>{
      const status=ps.move(cmd.uid,cmd.to,cmd.dir);
      if(status.ok&&trace)commands.push(cmd);
      return status;
    });
    if(faults.length&&!partial)return {ok:false,reason:'unrepresented-public-effect',detail:faults[0]};
    const actual=[...ps.board].map(([key,p])=>[p.uid,...key.split(',').map(Number),p.dir||'RIGHT']);
    const ok=!capFail&&!ownerFail&&!faults.length&&n===plan.length && goalKey(actual)===goalKey(plan);
    let sameBench=null,sameEquipment=null;
    if(ok&&auditProjection){
      const direct=makeSeat(PlayerState,computeBonds,EffectDispatcher,getDefaultRegistry(),gd,c.pub,structuredClone(c.own),c.s,73810001,createRng).install(plan,73810001).ps;
      const bag=p=>p?[p.uid,p.id,p.count||1,(p.items||[]).map(i=>[i.uid,i.id])]:null;
      const slots=p=>JSON.stringify([p.hand.map(bag),p.temp.map(bag)]);
      const outfits=p=>JSON.stringify([...p.board].map(([k,x])=>[k,bag(x)]).sort((a,b)=>a[0].localeCompare(b[0])));
      sameBench=slots(ps)===slots(direct);sameEquipment=outfits(ps)===outfits(direct);
    }
    const reason=faults.length?'unrepresented-public-effect':capFail?'duplicate-or-capacity':ownerFail?'missing-piece-or-owner':ok?'exact-accepted-movements':'different-final-board';
    return {ok,reason,...(faults.length?{detail:faults[0]}:{}),
      ...(returnPrepared?{prepared:{ps,dispatcher,faults},actual,limitations:[...sourceLimits]}:{}),
      ...(returnProjection?{projection:publicPlacementProjection(ps,c,faults),actual}:{}),...(trace?{commands,actual}:{} ),...(auditProjection?{sameBench,sameEquipment}:{})};
  }catch(error){return {ok:false,reason:'unrepresented-public-state',detail:String(error)};}
}
