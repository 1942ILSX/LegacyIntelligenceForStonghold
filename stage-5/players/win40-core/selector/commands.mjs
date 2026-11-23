// Legal band commands supplement an existing planner. All action targets come
// from the learner-facing availability list. Rejected targets are suppressed.
const rank = (values,score) => values.reduce((best,x)=>!best||score(x)>score(best)?x:best,null);
const itemValue=(rec) => {
  if(!rec||rec.itemType!=='EQUIP') return 0;
  const text=rec.desc||'';
  return 1+(rec.tier||0)+(/攻击力|攻击速度|伤害|无视|术抗/.test(text)?3:0)
    +(/倒地|被击倒时|护盾|复活/.test(text)?1:0)-(/装备时销毁/.test(text)?10:0);
};

export function wrapCommands(base,gd) {
  let round=-1, handled=false, rejected=new Set(), pending=null;
  function choose(s,timing) {
    const c=s.cmd;
    if(!c?.usable || !c.targets?.length || c.cost>s.funds)return null;
    const targets=c.targets.filter(t=>!rejected.has(JSON.stringify([c.id,t])));
    if(!targets.length)return null;
    const bodies=s.pieces.filter(p=>p[2]==='chess'), byId=new Map(bodies.map(p=>[p[0],p]));
    const units=targets.filter(t=>byId.has(t.uid));
    const board=units.filter(t=>byId.get(t.uid)[3]==='b');
    const tier=p=>gd.chess(p[1])?.tier||p[9]||1, record=p=>gd.chess(p[1])||{};
    const counts=new Map();
    for(const p of bodies)counts.set(p[1],1+(counts.get(p[1])||0));
    const strength=p=>{
      const unit=record(p), stats=unit.stats||{};
      const heal=unit.attackKind==='heal';
      return (stats.atk||180)/Math.max(.55,stats.bat||1)*(heal?.5:1)
        * (1+p[7].length*.16)*(unit.dmgType==='arts'?1.15:1)*(p[8]?1.3:1);
    };
    const bestUnit=(filtered,score)=>rank(filtered,t=>score(byId.get(t.uid)));
    const phase=new Set(['aceffect_band_101','aceffect_band_102','aceffect_band_37','aceffect_band_38',
      'aceffect_band_107','aceffect_band_108','aceffect_band_109','aceffect_band_110','aceffect_band_91',
      'aceffect_band_87','aceffect_band_90','aceffect_band_89']);
    if(timing==='ready' && !phase.has(c.id)) return null;
    if(timing!=='ready' && phase.has(c.id))return null;
    let target=null;
    switch(c.id) {
      // Keep promotions, gear and pairs, and climb from the best available tier
      // to reach otherwise inaccessible T5/T6 shop units early.
      case 'aceffect_band_112': {
        const safe=units.filter(t=>{const p=byId.get(t.uid);return !p[8] && tier(p)<6;});
        target=bestUnit(safe,p=>tier(p)*15-(counts.get(p[1])>=2?8:0)
          -(p[3]==='b'?4:0)-p[7].length*5-Math.min(5,strength(p)/350));
        break;
      }
      case 'aceffect_band_99': {
        const possible=units.filter(t=>{const p=byId.get(t.uid);return !p[8] &&
          (tier(p)>=5||(s.r>=7&&tier(p)>=4)||s.r>=11||(s.r>=5&&s.lp<=8));});
        target=bestUnit(possible,p=>tier(p)*8+strength(p)/100-(counts.get(p[1])>=2?8:0));
        break;
      }
      case 'aceffect_band_96':
        target=bestUnit(units.filter(t=>{const p=byId.get(t.uid);return s.r>=13||(s.r>=6&&s.lp<=8)
          || (p[8]&&tier(p)>=3&&p[7].length>=1);}),p=>strength(p)/90+tier(p)*3+p[7].length*7+(p[8]?15:0));
        break;
      case 'aceffect_band_101': case 'aceffect_band_102':
      case 'aceffect_band_37': case 'aceffect_band_38':
        target=bestUnit(board,p=>strength(p)*(c.id==='aceffect_band_102'&&p[8]?0:1));
        break;
      case 'aceffect_band_89': case 'aceffect_band_87': case 'aceffect_band_90': case 'aceffect_band_97': {
        const active=new Set(s.bonds.filter(b=>b[3]).map(b=>b[0]));
        target=bestUnit(board.length?board:units,p=>(record(p).bonds||[]).filter(x=>active.has(x)).length*15+tier(p)+p[7].length);
        break;
      }
      case 'aceffect_band_91': {
        const bench=bodies.filter(p=>p[3]==='h').sort((a,b)=>b[4]-a[4]);
        if(bench.length)target=bestUnit(board.filter(t=>strength(byId.get(t.uid))<strength(bench[0])*.85),
          p=>-strength(p));
        break;
      }
      case 'aceffect_band_107': case 'aceffect_band_108': case 'aceffect_band_109': case 'aceffect_band_110':
      case 'aceffect_band_100': {
        const routes=Object.values(gd.raw.stages?.[s.stage]?.groundPathsWithDevices||
          gd.raw.stages?.[s.stage]?.groundPaths||{}).filter(Array.isArray);
        const traffic=t=>routes.reduce((n,r)=>n+Number(r.some(p=>Array.isArray(p)&&p[0]===t.row&&p[1]===t.col)),0);
        target=rank(targets,t=>(c.id==='aceffect_band_100'?-1:1)*traffic(t)-.002*Math.abs(t.col-4));
        break;
      }
      case 'aceffect_band_105':
        if(bodies.length>=s.cap+1) target=bestUnit(units.filter(t=>{const p=byId.get(t.uid);return p[3]==='h'&&!p[8]&&!p[7].length&&counts.get(p[1])===1;}),
          p=>tier(p)*4-strength(p)/140);
        break;
      case 'aceffect_band_86': {
        const candidates=targets.filter(t=>{const slot=s.shop[t.slot];return slot&&itemValue(gd.item(slot[0]))>3;});
        if(bodies.length>=4)target=rank(candidates,t=>itemValue(gd.item(s.shop[t.slot][0])));
        break;
      }
      case 'aceffect_band_92': case 'aceffect_band_85': {
        const possible=targets.filter(t=>{const slot=s.shop[t.slot];return slot&&slot[1]==='chess'&&!counts.has(slot[0]);});
        if(timing==='refresh')target=rank(possible,t=>gd.chess(s.shop[t.slot][0])?.tier||1);
        break;
      }
      case 'aceffect_band_78': {
        const remains=s.shop.filter(x=>x&&!x[3]&&x[1]==='item');
        if(timing==='refresh'||(s.r>=7&&remains.every(x=>itemValue(gd.item(x[0]))<3)))target=targets[0];
        break;
      }
      case 'aceffect_band_74': case 'aceffect_band_79':
        if(timing==='refresh'&&s.funds>=c.cost+2)target=targets[0];
        break;
      case 'aceffect_band_106':
        if(timing==='refresh'&&s.r>=6&&s.funds>=c.cost+4)target=targets[0];
        break;
      case 'aceffect_band_80': case 'aceffect_band_73':
      case 'aceffect_band_54': case 'aceffect_band_55':
        target=targets[0];break;
      case 'aceffect_band_68': case 'aceffect_band_62': case 'aceffect_band_70': case 'aceffect_band_71':
        if(c.cost<=3)target=targets[0];
        break;
      case 'aceffect_band_75':
        if(s.shop.filter(x=>x&&!x[3]&&x[1]==='chess').length*1.5>c.cost)target=targets[0];
        break;
      case 'aceffect_band_83':
        if(!s.disabledBonds?.includes('yanShip')&&bodies.length>=4)target=bestUnit(units.filter(t=>{
          const p=byId.get(t.uid);return p[3]==='h'&&!p[8]&&!p[7].length&&!record(p).bonds?.includes('yanShip');
        }),p=>tier(p)*4-strength(p)/250);
        break;
    }
    return target ? {t:'g.command',effectId:c.id,target} : null;
  }
  function issue(msg) {handled=true;pending=JSON.stringify([msg.effectId,msg.target]);return {moves:[msg]};}
  function decide(need,s) {
    if(s.r!==round){round=s.r;rejected=new Set();}
    if(need!=='prep'||s.choice||s.draft)return base.decide(need,s);
    const before=choose(s,'prep');
    if(before)return issue(before);
    const proposal=base.decide(need,s), first=proposal.moves?.[0];
    if(!proposal.formation && (first?.t==='g.ready'||first?.t==='g.refresh')) {
      const cmd=choose(s,first.t==='g.ready'?'ready':'refresh');
      if(cmd)return issue(cmd);
    }
    // Some planners pair a joint formation and ready in one turn. Recompute
    // battle marks against the realized board before confirming.
    if(proposal.formation&&first?.t==='g.ready'&&s.cmd?.usable)
      return {...proposal,moves:proposal.moves.slice(1)};
    return proposal;
  }
  function ack(statuses) {
    if(handled){if(statuses.at(-1)!=='ok') rejected.add(pending);handled=false;pending=null;}
    else base.ack?.(statuses);
  }
  return {decide,ack};
}
