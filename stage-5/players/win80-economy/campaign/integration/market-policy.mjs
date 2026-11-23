import fs from 'node:fs';
const model=JSON.parse(fs.readFileSync(new URL('../team-model.json',import.meta.url)));
const settings=new WeakMap();
const defaults=Object.freeze({campaignRules:true,campaignBench:true,campaignPromote:true,campaignLearn:true});
export function withCampaignEconomy(make,cfg,overrides={}){
 const rules=Object.create(cfg.gd);
 const options={...defaults,...cfg,...overrides};
 const excluded=new Set(options.campaignProtectedBands||[]);
 settings.set(rules,{...options,excluded});
 return make({...cfg,gd:rules});
}
const cache=new WeakMap();
const sum=(a,v,x=1)=>{if(v)for(let j=0;j<a.length;j++)a[j]+=x*v[j];};
export function enabled(gd,s){
 const opts=settings.get(gd);
 return !!opts && !opts.excluded.has(s.band) && s.band!=='band_mech' &&
   !(s.band==='band_siracusa'&&s.boss==='boss_17') && s.r>=(opts.econFrom??3);
}
function state(gd,s){
 let z=cache.get(s);if(z)return z;
 const owned=s.pieces.filter(p=>p[2]==='chess'),field=owned.filter(p=>p[3]==='b'),ids=new Map(),bases=new Map(),sigs=new Map();
 for(const p of owned){
   ids.set(p[1],(ids.get(p[1])||0)+1);
   const id=gd.baseIdOf(p[1]);bases.set(id,(bases.get(id)||0)+1);
   for(const b of gd.chess(p[1])?.bonds||[]){if(!sigs.has(b))sigs.set(b,new Set());sigs.get(b).add(id);}
 }
 const h=Float64Array.from(model.bias);
 for(const k of ['stage/'+s.stage,'band/'+s.band,'boss/'+s.boss])sum(h,model.w[k]);
 sum(h,model.w.hp,Math.min(45,s.lp)/24);sum(h,model.w.level,s.level/5);
 const parts=new Map();
 function v(id){
   if(parts.has(id))return parts.get(id);
   const base=gd.baseIdOf(id),p=new Float64Array(h.length);
   sum(p,model.w['u/'+base]);if(gd.isGolden(id))sum(p,model.w['g/'+base]);parts.set(id,p);return p;
 }
 const from=team=>{const a=Float64Array.from(h);sum(a,model.w.size,team.length/8);for(const p of team)sum(a,v(p[1]));return a;};
 const value=a=>a.reduce((n,t,j)=>n+Math.tanh(t)*model.head[j],model.offset);
 const current=from(field),currentValue=value(current);
 z={owned,field,ids,bases,sigs,parts,from,v,value,current,currentValue,forecast:new Map(),buys:new Map()};
 cache.set(s,z);return z;
}
export function campaignCanLevel(gd,s,owned){
 const opts=settings.get(gd);
 if(!enabled(gd,s)||!opts.campaignTempo||s.up===0)return true;
 const elites=owned.filter(p=>p[8]).length,cap=opts.campaignTempo;
 if(s.level>=3&&s.level<4&&s.r<=(cap==='fast'?5:7)&&elites<(cap==='fast'?1:2))return false;
 if(s.level===4&&s.r<=(cap==='fast'?8:10)&&elites<2)return false;
 return true;
}
export function campaignBuy(gd,s,id){
 const opts=settings.get(gd);
 if(!enabled(gd,s))return 0;
 const c=state(gd,s);if(c.buys.has(id))return c.buys.get(id);
 const rec=gd.chess(id);if(!rec)return 0;
 const original=gd.baseIdOf(id),n=c.ids.get(id)||0,already=c.ids.get(gd.goldenIdOf(id))||0;
 let score=0;
 if(opts.campaignPromote||opts.campaignTempo){
   const remaining=gd.mergeCount(id)-n;
   if(!already&&remaining===1)score+=17;
   else if(!already&&remaining===2&&s.r<=10)score+=7;
   if(already&&n===0&&s.r<=12)score-=7;
 }
 if(opts.campaignBench&&s.r<=10){
   for(const b of ['visiShip','miraShip']){
     if(rec.bonds.includes(b)&&!c.bases.has(original)&&c.sigs.get(b)?.size===1)score+=b==='visiShip'?17:12;
   }
 }
 if(opts.campaignLearn){
   const incoming=!already&&gd.mergeCount(id)-n===1?gd.goldenIdOf(id)||id:id;
   const p=c.v(incoming);
   let delta=-1;
   for(const old of c.field){
     const a=Float64Array.from(c.current);sum(a,c.v(old[1]),-1);sum(a,p);
     const q=c.value(a)-c.currentValue-.12*old[7].length;
     if(q>delta)delta=q;
   }
   score+=(opts.campaignLearnBuy??14)*Math.max(-.65,Math.min(.95,delta-.15));
 }
 c.buys.set(id,score);return score;
}
export function campaignTeam(gd,s,team){
 const opts=settings.get(gd);
 if(!enabled(gd,s)||!team.length)return 0;
 const c=state(gd,s),hash=team.map(t=>t[0]).sort((a,b)=>a-b).join('/');
 if(c.forecast.has(hash))return c.forecast.get(hash);
 const ids=new Set(),bon=new Map();let elite=0;
 for(const p of team){
   if(p[8])elite++;
   const id=gd.baseIdOf(p[1]);if(ids.has(id))continue;ids.add(id);
   for(const b of gd.chess(p[1])?.bonds||[])bon.set(b,(bon.get(b)||0)+1);
 }
 const reached=(b,n)=>!gd.modeInactiveBonds.has(b)&&(bon.get(b)||0)>=n;
 let score=0;
 if(opts.campaignRules){
   if(!gd.modeInactiveBonds.has('suntShip'))score+=elite>=5?32:elite>=2?10:0;
   if(reached('emptyShip',2))score+=24;
   if(reached('docShip',3))score+=17;else if(reached('docShip',2))score+=7;
   if(reached('steadShip',3))score+=s.r<12?25:16;
   if(reached('deputShip',3))score+=12;
   if(reached('arcaneShip',3))score+=10;
 }
 if(opts.campaignLearn){
   const h=c.from(team),t=(s.r<6?.36:s.r<10?.70:1)*(opts.campaignFieldWeight??22);
   score+=t*c.value(h);
 }
 c.forecast.set(hash,score);return score;
}
