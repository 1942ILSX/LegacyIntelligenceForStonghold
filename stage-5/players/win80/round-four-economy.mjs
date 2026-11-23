import {createPlanner as regional} from './leithania.mjs';
import {createPlanner as ursus} from './ursus-recipe.mjs';
import {createPlanner as marginal} from './recruitment.mjs';

function stateAtFour(gd,s) {
  const army=s.pieces.filter(p=>p[2]==='chess'),held=new Set(army.map(p=>gd.baseIdOf(p[1])));
  const shelf=s.shop.filter(o=>o&&!o[3]&&o[1]==='chess').map(o=>gd.baseIdOf(o[0]));
  const off=new Set(s.disabledBonds),side=s.groups[s.picked]||[];
  const legal=id=>!s.bannedChess?.includes(id)&&!gd.bondsExclude(gd.chess(id),off);
  const counts=(ids,core)=>[...ids].filter(id=>gd.chess(id).bonds.includes(core)).length;
  const f={bias:1,life:s.lp/25-.8,funds:s.funds/10-.7,level:(s.level-2)/2,
    hand:army.filter(p=>p[3]==='h').length/5,elite:army.filter(p=>p[8]).length/3,
    ['band/'+s.band]:.7,['boss/'+s.boss]:.7,['stage/'+s.stage]:.45};
  const st=gd.band(s.band)||{},type=st.skills?.some(a=>a.type==='ACTIVE')?'active':'passive';
  f['type/'+type]=.7;f['class/'+st.bandType]=.6;
  for(const b of side)f['core/'+b]=.4;
  for(const id of held)f['owned/'+id]=.4;
  for(const id of shelf)f['offered/'+id]=.24;
  for(const b of ['lethaniaShip','ursusShip','arcaneShip','preciShip','maniShip']){
    f['inventory/'+b]=Math.min(1,counts(held,b)/3);
    f['shop/'+b]=Math.min(1,counts(shelf,b)/3);
    f['layers/'+b]=Math.min(1,(s.bonds.find(q=>q[0]===b)?.[2]||0)/70);
  }
  const candidates=['marginal'];
  if(s.band==='band_mech'||s.band==='band_siracusa'||s.boss==='boss_17')return {f,candidates:[]};
  const canL=s.band!=='band_amiya'&&side.includes('lethaniaShip')&&!off.has('lethaniaShip')&&
    ['chess_char_5_01_a','chess_char_5_11_a'].some(legal)&&['chess_char_4_01_a','chess_char_4_02_a','chess_char_4_18_a'].some(legal);
  const canU=side.includes('ursusShip')&&!off.has('ursusShip')&&legal('chess_char_5_25_a');
  const support=b=>2*counts(held,b)+counts(shelf,b);
  if(canU&&(!canL||support('ursusShip')>support('lethaniaShip')))candidates.push('ursus');
  else if(canL)candidates.push('leith');
  return {f,candidates};
}

export function roundFourChoice(info,model){
  let pick='keep',top=model?.margin??Infinity;
  for(const name of info.candidates){
    const weights=model?.weights?.[name];if(!weights)continue;
    const value=Object.entries(info.f).reduce((n,[k,v])=>n+(weights[k]||0)*v,0);
    if(value>top){top=value;pick=name;}
  }
  return pick;
}
export function withRoundFour(make,cfg){
  let active=make(cfg),done=false;
  return {decide(phase,s){
    if(done||s.r!==4||phase!=='prep')return active.decide(phase,s);
    done=true;
    const info=stateAtFour(cfg.gd,s);
    const arm=cfg.roundFourArm;
    const picked=arm==='regional'?info.candidates[1]||'keep':
      arm==='marginal'&&info.candidates.includes(arm)?arm:roundFourChoice(info,cfg.roundFourModel);
    if(picked!=='keep')active=({leith:regional,ursus,marginal})[picked]({...cfg,band:s.band});
    return {...active.decide(phase,s),fourDecision:{...info,picked}};
  },ack(status){active.ack?.(status);}};
}
