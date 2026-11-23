import {readFileSync} from 'node:fs';
const guides=JSON.parse(readFileSync(new URL('./guide-rosters.json',import.meta.url),'utf8'));
const critical=['chess_char_2_14_a','chess_char_2_11_a','chess_char_3_16_a','chess_char_4_18_a',
  'chess_char_5_25_a','chess_char_5_01_a','chess_char_5_11_a','chess_char_2_07_a'];
const strength=JSON.parse(readFileSync(new URL('../win40/value/terminal.json',import.meta.url),'utf8')).weights;

function projected(gd,s,picked){
  const off=new Set([...s.disabledBonds,...s.groups[1-picked]]);
  const allowed=new Map();
  function available(id){
    if(!allowed.has(id)){
      const a=gd.chess(id);allowed.set(id,Boolean(a&&!a.isHidden&&!a.isDiy&&!gd.bondsExclude(a,off)));
    }
    return allowed.get(id);
  }
  const v={};
  for(const id of s.groups[picked])v['core/'+id]=1;
  for(const id of critical)v['unit/'+id]=Number(available(id));
  for(const a of Object.values(gd.raw.chess)){
    if(a.isGolden||a.isHidden||a.isDiy||!available(a.chessId))continue;
    const tier=a.tier||1;
    const val=(strength['u/'+a.chessId]||0)+(strength[s.boss+'/'+a.chessId]||0);
    const key='tier/'+tier;
    v[key]=(v[key]||0)+1/18;
    if(val>0)v['valuable/'+tier]=(v['valuable/'+tier]||0)+Math.min(.35,val);
  }
  for(const g of guides){
    const core=g.bonds.find(b=>gd.bond(b)?.isCore);
    if(core&&off.has(core))continue;
    const share=list=>list.length?list.filter(available).length/list.length:.5;
    const phase=g.phases.map(index=>share(Object.keys(index)));
    const cover=.35*share(g.carry)+.18*phase[0]+.17*phase[1]+.30*phase[2];
    v['guide/'+g.id]=cover;
    for(const b of g.bands)v['offer/'+b]=Math.max(v['offer/'+b]||0,cover);
  }
  return v;
}
export function covenantFeatures(gd,s,proposed){
  const a=projected(gd,s,proposed),b=projected(gd,s,1-proposed);
  const x={bias:1,['boss/'+s.boss]:1,['map/'+s.stage]:1};
  for(const id of s.disabledBonds)x['disabled/'+id]=.5;
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
    const d=(b[k]||0)-(a[k]||0);
    if(!d)continue;
    x[k]=d;
    if(k.startsWith('core/')||k.startsWith('unit/'))x['boss-cross/'+s.boss+'/'+k]=d*.7;
  }
  return x;
}
export function proposedSwitch(model,features){
  let value=0;
  for(const [k,n] of Object.entries(features))value+=(model.weights[k]||0)*n;
  return value>=model.margin;
}
