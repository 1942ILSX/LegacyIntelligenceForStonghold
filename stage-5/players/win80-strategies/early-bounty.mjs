const rotate=(r,c,d)=>d==='LEFT'?[-r,-c]:d==='UP'?[-c,r]:d==='DOWN'?[c,-r]:[r,c];
const bound=(x,lo=0,hi=3)=>Math.max(lo,Math.min(hi,x));
function localPaths(gd,stage,fly){
  const st=gd.raw.stages[stage],ground=Object.values(st?.groundPaths??{})
    .filter(z=>z.length&&z[0][1]===10&&z.at(-1)[1]===2);
  if(!fly)return ground;
  return ground.map(z=>{
    const [r,c]=z[0],[r2,c2]=z.at(-1),n=Math.max(Math.abs(r-r2),Math.abs(c-c2));
    return Array.from({length:n+1},(_,i)=>[Math.round(r+(r2-r)*i/n),Math.round(c+(c2-c)*i/n)]);
  });
}
function summarize(gd,s,card){
  const foe=gd.enemy(card.enemyKey),stats=foe?.stats??{},fly=Boolean(foe?.isFlyEnemy||stats.motion==='FLY');
  const team=s.pieces.filter(p=>p[2]==='chess'&&p[3]==='b');
  const paths=localPaths(gd,s.stage,fly),count=card.count||1,health=stats.maxHp||1;
  let dps=0,coverDamage=0,air=0,block=0,equips=0,heal=0,phys=0,arts=0,elite=0;
  for(const p of team){
    const v=gd.chess(p[1]);if(!v)continue;
    const st=v.stats??{};equips+=p[7].length;elite+=Number(p[8]);
    if(v.attackKind==='heal'){heal++;continue;}
    if(v.attackKind==='none')continue;
    if(v.canHitFly)air++;
    block+=v.position==='MELEE'?(st.blockCnt??1):0;
    if(fly&&!v.canHitFly)continue;
    const atk=st.atk||0,damage=v.dmgType==='arts'?atk*(1-Math.min(95,stats.res||0)/100):Math.max(.05*atk,atk-(stats.def||0));
    const rate=damage/Math.max(.45,st.bat||1);
    dps+=rate;if(v.dmgType==='arts')arts+=rate;else phys+=rate;
    const grid=new Set((v.rangeGrid??[[0,0]]).map(([r,c])=>{const [dr,dc]=rotate(r,c,p[6]);return (p[4]+dr)+','+(p[5]+dc);}));
    const exposure=paths.length?paths.reduce((acc,route)=>acc+route.filter(x=>grid.has(x.join(','))).length,0)/paths.length:0;
    coverDamage+=rate*exposure/Math.max(.2,stats.moveSpeed||1);
  }
  const nominal=count*(card.coin||0),load=health*count,threat=(stats.atk||0)*count/Math.max(1,stats.bat||1);
  const base={['id/'+card.effectId]:1,nominal:nominal/6};
  const encounter={flight:Number(fly),n:count/5,hp:bound(Math.log1p(load)/8),armor:bound((stats.def||0)/600),
    resistance:bound((stats.res||0)/75),pace:bound((stats.moveSpeed||1)/1.5),attack:bound(threat/950),
    teamDamage:bound(dps*4/load),routeDamage:bound(coverDamage/load),sky:fly?air/4:0,
    noSky:Number(fly&&!air),block:!fly?bound(block/Math.max(1,count)):0,
    arts:bound(arts*4/load),physical:bound(phys*4/load),durability:bound((team.length+heal+elite)/Math.max(1,threat/140)),
    gearMargin:bound(equips*300/Math.max(1,load)),incoming:bound(threat/(400+200*heal+100*block))};
  const features={...base};
  for(const [k,v] of Object.entries(encounter)){
    features[k]=v;features['earn/'+k]=v*nominal/6;
  }
  return {id:card.effectId,enemy:card.enemyKey,nominal,base,features};
}
export function withEarlyBounty(base,gd,settings){
  const bounty=new Map(gd.choices.cards.bounty.map(c=>[c.effectId,c]));let done=false,own=false;
  return {decide(phase,s){
    own=false;const reply=base.decide(phase,s),msg=reply.moves?.[0];
    if(done||s.r!==3||msg?.t!=='g.choice'||reply.moves.length!==1)return reply;
    const shown=(s.choice?.cards??s.cards).filter(c=>c&&!c[3]&&c[4]<=s.funds);
    if(shown.length!==3||shown.some(c=>c[2]!=='bounty'||!bounty.has(c[1])))return reply;
    const cards=shown.map(c=>({idx:c[0],...summarize(gd,s,bounty.get(c[1]))})),original=cards.findIndex(c=>c.idx===msg.idx);
    if(original<0)throw Error('Missing original R3 choice');
    done=true;let index=original;
    if(Number.isInteger(settings.arm))index=settings.arm;
    if(settings.model){
      const {weights,field,margin}=settings.model,score=c=>Object.entries(c[field]).reduce((v,[k,x])=>v+(weights[k]??0)*x,0);
      let top=score(cards[index])+margin;
      for(const [i,c] of cards.entries()){const v=score(c);if(v>top){top=v;index=i;}}
    }
    own=index!==original;
    return {...reply,moves:[{...msg,idx:cards[index].idx}],bounty33:{cards,original,index,lp:s.lp,round:s.r,band:s.band,stage:s.stage,boss:s.boss}};
  },ack(status){if(!own)base.ack?.(status);else if(status.at(-1)!=='ok')throw Error('Refused shown R3 bounty: '+status);}};
}
