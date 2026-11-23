import {commandPlan} from '../../engine/v0.4.0/server/match/bandCommandEffects.js';

const marked=new Set(['skill_mark_char_inst_tag','skill_mark_pos_grow_use_cnt','skill_garr_event_extra_exec',
                      'skill_mark_shop_equip_tag','skill_layer_limit_grow_round']);
export function makeCommandHistory(gd) {
  const skills=new Map(Object.values(gd.raw.bands).flatMap(b=>b.skills||[]).map(s=>[s.effectId,s]));
  let sequence=-20000,marks=[],uses=0,usedInForecasts=0;
  return {
    describe(round,own,message) {
      const skill=skills.get(message.effectId);
      if(!skill||message.effectId!==own.command?.effectId)return [];
      const buff=skill.buffs?.find(b=>marked.has(b.key));
      if(!buff)return [];
      const target=message.target||{},visible=[...own.board,...own.hand,...own.temp].filter(Boolean);
      if(target.uid!==undefined&&!visible.some(p=>p.uid===target.uid))return [];
      if(buff.key==='skill_mark_shop_equip_tag'&&!own.shop.slots[target.slot]?.id)return [];
      const derived={gd,shop:{slots:own.shop.slots},commandMarks:[],
        m:{round,nextUid:()=>sequence--},find:uid=>({piece:visible.find(p=>p.uid===uid)})};
      const planned=commandPlan(derived,{...skill,buffs:[buff]},target,{setShopSlot(){}});
      planned?.apply?.();
      return derived.commandMarks;
    },
    commit(rows){marks.push(...rows);uses+=rows.length;},
    decorate(v,own){
      marks=marks.filter(a=>a.round===v.s.r);
      v.own.prepMapChars=structuredClone(own.prepMapChars||[]);
      v.own.rememberedCommands=structuredClone(marks);
      if(marks.length)usedInForecasts++;
      return v;
    },
    summary(){return {uses,usedInForecasts};},
  };
}
