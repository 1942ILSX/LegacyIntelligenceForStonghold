import {createPlanner as stage,seatProfile} from './stage-deployment.mjs';
export {seatProfile};

export function withRoundEleven(make,cfg){
  const base=make(cfg),{gd}=cfg,cards=gd.raw.choices.cards;
  const bounties=new Map(cards.bounty.map(v=>[v.effectId,v]));
  const tactics=new Map(cards.tactic.map(v=>[v.effectId,v]));
  let chosen=false;
  function describe(s,c){
    const [,id,kind,,cost]=c,board=s.pieces.filter(p=>p[2]==='chess'&&p[3]==='b');
    const hp=Math.min(1.6,s.lp/25)-.7,level=s.level/6-.65;
    const f={['card/'+id]:1,['health/'+id]:hp,['band/'+s.band+'/'+id]:.55,
      ['boss/'+s.boss+'/'+id]:.35,['level/'+id]:level,cost:-(cost||0)/5};
    if(kind==='bounty'){
      const b=bounties.get(id);if(!b)return f;
      const e=gd.enemy(b.enemyKey)||{},stats=e.stats||{},n=Math.max(1,b.count||1);
      const quantity=b.payout==='perfect'?1:n;
      const weight={coin:(b.coin||0)*quantity*Math.min(3,b.rounds||1)/12,perfect:Number(b.payout==='perfect'),
        units:n/5,duration:Math.min(4,b.rounds||1)/3,hpLoad:Math.min(3,(stats.maxHp||0)*n/60000),
        armor:Math.min(2,(stats.def||0)/1000),resist:(stats.res||0)/75};
      for(const [k,v] of Object.entries(weight)){f['danger/'+k]=v;f['danger-health/'+k]=v*hp;}
      f['enemy/'+b.enemyKey]=.7;
    }else if(kind==='item'){
      const v=gd.item(id)||{},text=v.desc||'';
      f.tier=(v.tier||1)/6;f.direct=Number(/攻击力|攻击速度|造成.*伤害/.test(text));
      f.defense=Number(/复活|护盾|生命上限/.test(text));f.consume=Number(text.includes('装备时销毁'));
      f.existing=board.filter(p=>p[7].includes(id)).length/3;
    }else if(kind==='tactic'){
      const t=tactics.get(id),effect=gd.raw.effects?.[t?.effectId??id];
      for(const b of effect?.buffs||t?.buffs||[])f['tactic/'+b.key]=1;
    }
    return f;
  }
  return {decide(phase,s){
    const r=base.decide(phase,s),m=r.moves?.[0];
    if(s.r!==11||chosen||m?.t!=='g.choice')return r;
    const menu=(s.choice?.cards||s.cards).filter(v=>v&&!v[3]&&v[4]<=s.funds);
    const old=menu.find(c=>c[0]===m.idx);
    if(!old||!['tactic','item','bounty'].includes(old[2]))return r;
    chosen=true;
    const seen=new Set([old[1]]),alternatives=[];
    for(const c of menu)if(c[2]===old[2]&&!seen.has(c[1])){seen.add(c[1]);alternatives.push(c);}
    const opts=[old,...alternatives].map(c=>({idx:c[0],id:c[1],f:describe(s,c)}));
    let choice=opts[0];
    if(cfg.roundElevenArm!==undefined)choice=opts[1+cfg.roundElevenArm]||choice;
    else if(cfg.roundElevenModel){
      const {weights,margin}=cfg.roundElevenModel;
      const score=x=>Object.entries(x.f).reduce((n,[k,v])=>n+(weights[k]||0)*v,0);
      let best=score(choice)+margin-(weights.intercept||0);
      for(const o of opts.slice(1)){const n=score(o);if(n>best){choice=o;best=n;}}
    }
    return {...r,moves:choice.idx===old[0]?r.moves:[{...m,idx:choice.idx}],
      roundElevenData:{original:old[1],actual:choice.id,kind:old[2],opts}};
  },ack(status){base.ack?.(status);}};
}
export const createPlanner=cfg=>withRoundEleven(stage,cfg);
