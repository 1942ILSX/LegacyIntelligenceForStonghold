// Score the displayed drafts with their public version-specific effect records.
export function makeCardPicker(gd) {
  const bounty = new Map((gd.raw.choices?.cards?.bounty||[]).map(c=>[c.effectId,c]));
  return function pick(s,cards) {
    const owned=s.pieces.filter(p=>p[2]==='chess');
    const board=owned.filter(p=>p[3]==='b');
    const active=new Set(s.bonds.filter(b=>b[3]).map(b=>b[0]));
    const ownedBonds=new Map();
    for(const p of owned)for(const b of gd.chess(p[1])?.bonds||[])ownedBonds.set(b,1+(ownedBonds.get(b)||0));
    function value(c) {
      const [,id,kind]=c;
      if(kind==='bounty') {
        const card=bounty.get(id), enemy=gd.enemy(card?.enemyKey);
        if(!card||!enemy)return 0;
        const stats=enemy.stats||{}, health=(stats.maxHp||4000)*Math.max(1,card.count);
        const dps=board.reduce((v,p)=>{
          const rec=gd.chess(p[1]), st=rec?.stats;
          if(!st||rec.attackKind==='heal'||rec.attackKind==='none')return v;
          const atk=st.atk||200;
          const hit=rec.dmgType==='arts'?atk*(1-(stats.res||0)/100):Math.max(atk*.07,atk-(stats.def||0));
          return v+hit/Math.max(.55,st.bat||1)*(p[8]?1.3:1);
        },0);
        const kill=Math.min(.98,Math.max(.06,4*dps/Math.max(300,health)));
        const battles=Math.max(1,Math.min(card.rounds||1,14-s.r));
        return battles*((card.payout==='perfect'?kill**card.count:kill*card.count)*card.coin
          -(1-kill)*card.count*(1.5+15/Math.max(s.lp,1)));
      }
      if(kind==='item') {
        const it=gd.item(id), desc=it?.desc||'';
        return 1+(it?.tier||1)+(/攻击力|攻击速度|造成.*伤害|复活/.test(desc)?3:0)
          +(/获得.*资金|精锐|获得.*干员/.test(desc)?2:0);
      }
      const buffs=gd.effect(id)?.buffs||[], fight=Math.min(7,15-s.r);
      let score=1;
      for(const b of buffs) {
        const count=b.bb?.count||1, bonds=(b.bbStr?.bond_list||b.bbStr?.bond||'').split(',').filter(Boolean);
        const relevance=Math.min(1,bonds.reduce((v,id)=>v+Number(active.has(id))+.18*(ownedBonds.get(id)||0),0));
        switch(b.key) {
          case 'global_special_choice_bond_addlayer': score+=1+relevance*count*.37;break;
          case 'single_special_choice_gain_bond_chess':score+=4+relevance*4;break;
          case 'single_special_choice_gloden_equip_chess':score+=11;break;
          case 'global_special_choice_gain_equip':score+=4+count*2;break;
          case 'global_special_choice_refresh_free':score+=3+count;break;
          case 'global_special_choice_gain_coin':score+=count;break;
          case 'global_special_choice_all_activated':score+=5+1.1*fight;break;
          case 'global_special_choice_prep_finish_bench_at_least':score+=5+fight*.7;break;
          case 'global_special_choice_prep_finish_same_row_at_least':score+=4+fight*.7;break;
          case 'global_special_choice_prep_finish_bench_at_most':score+=2;break;
        }
      }
      return score;
    }
    const legal=cards.filter(c=>c&&!c[3]);
    return legal.sort((a,b)=>value(b)-value(a)||a[0]-b[0])[0]?.[0]??0;
  };
}
