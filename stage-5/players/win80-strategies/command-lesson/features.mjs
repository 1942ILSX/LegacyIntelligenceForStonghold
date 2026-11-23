const valid=new Set(['aceffect_band_101','aceffect_band_102','aceffect_band_37','aceffect_band_38','aceffect_band_91']);
export const supported=id=>valid.has(id);
const closeness=(a,b)=>Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);
export function targetFeatures(gd,s,plan,uid,skill){
  const rows=new Map(s.pieces.map(p=>[p[0],p])),t=rows.get(uid),z=plan.find(q=>q[0]===uid);
  if(!z||!t)return null;
  const rec=gd.chess(t[1]);if(!rec)return null;
  const stats=rec.stats||{},fam=gd.baseIdOf(t[1]),phase=s.r>=14?'boss':'road',r=phase==='boss'?1:Math.max(0,Math.min(1,(s.r-4)/9));
  const v={},add=(k,value=1)=>{if(value)v[k]=value;};
  const group=skill==='aceffect_band_37'||skill==='aceffect_band_38'?'shield':skill==='aceffect_band_101'?'revive':skill==='aceffect_band_102'?'elite':'swap';
  const h=group+'/',f=phase+'/',b=s.boss+'/';
  const numeric={
    hp:(stats.maxHp||1600)/3500,atk:(stats.atk||250)/800,def:(stats.def||100)/500,
    speed:(stats.aspd||100)/(100*Math.max(.45,stats.bat||1)),block:(stats.blockCnt||0)/3,
    gear:t[7].length/3,tier:rec.tier/6,elite:Number(t[8]),floor:(z[1]-9)/3,
    front:(z[2]-2)/8,nearBlue:Math.max(0,1-(Math.abs(z[1]-9)+Math.abs(z[2]-2))/7),
    heal:Number(rec.attackKind==='heal'||rec.profession==='MEDIC'),air:Number(!!rec.canHitFly),
    arts:Number(rec.dmgType==='arts'),melee:Number(rec.position==='MELEE'),
    center:Math.max(0,1-Math.abs(z[2]-6)/4),right:Number(z[3]==='RIGHT'),
    friends:plan.filter(q=>q[0]!==uid&&closeness(q,z)<=2).length/6,
    leaders:plan.filter(q=>q[0]!==uid&&q[2]>z[2]).length/8
  };
  const actives=new Map(s.bonds.map(q=>[q[0],q]));
  for(const k of rec.bonds||[]){
    add(h+'bond/'+k,.52);
    const a=actives.get(k);
    if(a?.[3]){add(h+'active/'+k,.55);add(h+'layers/'+k,Math.min(1,a[2]/60)*.4);}
  }
  const subtype=rec.subProfessionId??rec.profession;
  for(const [k,x] of Object.entries(numeric)){
    const w=Math.max(-3,Math.min(3,x));
    add(h+k,w);add(h+f+k,w*.8);add(h+'late/'+k,w*r*.36);
    if(phase==='boss')add(h+b+k,w*.25);
  }
  add(h+fam,.7);add(h+f+fam,.36);add(h+subtype,.75);add(h+f+subtype,.5);
  add(h+rec.profession,.72);for(const eq of t[7])add(h+'item/'+eq,.38);
  return v;
}
