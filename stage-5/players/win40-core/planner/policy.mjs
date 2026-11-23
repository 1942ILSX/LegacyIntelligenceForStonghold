import {campaignTeam,campaignBuy,campaignCanLevel,enabled} from "../../win80-economy/campaign/integration/market-policy.mjs";
import fs from 'node:fs';
import { makePositioner } from './positions.mjs';
import { makeFeatures } from './economy-features.mjs';
import { score as teacherScore } from './value.mjs';

const unitValues=JSON.parse(fs.readFileSync(new URL('./unit-values.json',import.meta.url),'utf8'));
const byScore=(values,fn)=>values.reduce((b,x)=>!b||fn(x)>fn(b)?x:b,null);
const asAction=(t,props={})=>({t:'g.'+t,...props});
const key=msg=>JSON.stringify(msg);
const average=(arr,f)=>arr.reduce((sum,e)=>sum+f(e),0)/Math.max(1,arr.length);

export function createPlanner({gd,band='band_sarkazb',focus='kjeragShip',chooseBand,chooseGroup,
    normalPlans=4,bossPlans=18,levelSpeed=0,earlySpend=0,prior=1,focusStrength=1,focusLock=true,shopCap=5,
    pairPlus=0,formationJitter=0,equipValue=1,learnBuy=0,learnField=0,sellDown=0,shopFocus=0,
    commodity=0,cardPolicy=false,positioner=makePositioner,arcane=0,gear=0,carryHunt=0,openingBuild=null,
    plannedEquipment=null,promoteAfterLevel=false}={}) {
  let round=-1,last,roundSteps=0,forcedFocus=null,formed=false,previousSet='',denied=new Set(),usedItems=new Set();
  function emit(msg){last=msg;return {moves:[msg]};}
  function ack(status){if(!last)return; if(status.at(-1)!=='ok')denied.add(key(last)); else denied.clear();last=null;}
  const can=msg=>!denied.has(key(msg));

  function decide(need,s) {
    if(s.r!==round){
      round=s.r;roundSteps=0;formed=false;previousSet='';denied=new Set();usedItems=new Set();
    }
    const preferredGroup=()=>s.groups.findIndex(g=>g.includes(focus));
    if(need==='opening'){
      if(s.picked===null&&s.groups.length){
        const idx=chooseGroup?chooseGroup(s):Math.max(0,preferredGroup());
        return emit(asAction('bondGroup',{idx,setupRevision:s.rev}));
      }
      return emit(asAction('infoReady',{setupRevision:s.rev}));
    }
    if(need==='band')return emit(asAction('band',{bandId:chooseBand?chooseBand(s):s.bands.includes(band)?band:s.bands[0]}));
    if(need==='diy')return emit(asAction('diyBring',{slots:[]}));
    function chooseCard(cards){
      const available=cards.filter(c=>c&&!c[3]);
      if(!cardPolicy)return available[0]?.[0]??0;
      const card=byScore(available,c=>{
        const e=gd.effect(c[1]),i=gd.item(c[1]),a=e?.params||{};
        if(c[2]==='bounty'){
          const stats=gd.enemy(a.enemy_id)?.stats||{};
          const danger=(stats.maxHp||10000)/12000+(stats.def||0)/1500+(stats.atk||0)/1200;
          return ((a.coin||1)+1)/(1+danger)*(s.lp<9?.5:1)-Math.log1p(danger)*.55;
        }
        if(i)return 1+i.tier*.6+(i.itemType==='EQUIP'?1:0);
        if(a.bond===forcedFocus)return 10;
        if(String(a.bond_list).includes(forcedFocus))return 7;
        if(a.pool||String(e?.desc||'').includes('精锐'))return 4;
        return 1;
      });
      return card?.[0]??0;
    }
    if(need==='card')return emit(asAction('choice',{idx:chooseCard(s.cards)}));
    if(s.choice)return emit(asAction('choice',{choiceId:s.choice.id,idx:chooseCard(s.choice.cards)}));
    if(s.draft)return emit(asAction('commandChoice',{choiceId:s.draft.id,idx:0}));
    roundSteps++;
    if(roundSteps>160)throw Error('Preparation exhausted at '+s.r+' '+JSON.stringify({denied:[...denied],pc:s.pieces,can:s.canReady}).slice(0,500));
    const owned=s.pieces.filter(p=>p[2]==='chess'), items=s.pieces.filter(p=>p[2]==='item'),tokens=s.pieces.filter(p=>p[2]==='token');
    const set=new Set(owned.map(p=>gd.baseIdOf(p[1]))),realGroup=s.groups?.[s.picked]||[],off=new Set(s.disabledBonds||[]);
    const base=id=>gd.baseIdOf(id);
    const layers=new Map(s.bonds.map(([id,,l])=>[id,l]));
    const chess=id=>gd.chess(id);
    function activeBonds(id){return (chess(id)?.bonds||[]).filter(b=>enabled(gd,s)?!gd.modeInactiveBonds.has(b):!off.has(b))}
    function coreCount(b){let n=0;for(const id of set) if(activeBonds(id).includes(b))n++;return n}
    if(!forcedFocus||!focusLock){
      if(focus!=='auto' && (!realGroup.length||realGroup.includes(focus))&&!off.has(focus))forcedFocus=focus;
      else forcedFocus=byScore(realGroup.length?realGroup:['kjeragShip','iberiaShip','siracusaShip','victoriaShip'],b=>coreCount(b)*2+(layers.get(b)||0)*.025+(b===forcedFocus?.toString()?1:0)+(b==='kjeragShip'?1.0:0));
    }
    const stage=s.r<6?0:s.r<11?1:s.r<14?2:3;
    const encode=learnBuy||learnField?makeFeatures(gd,s):null;
    const fieldValues=new Map();
    function power(id) {
      const a=chess(id);if(!a)return 0;
      const v=a.stats||{},heal=a.attackKind==='heal';
      const atk=(v.atk||200)/Math.max(.6,v.bat||1)*(v.aspd||100)/100;
      const raw=heal?2.7:Math.min(11,atk/130)+(a.dmgType==='arts'?1.6:0)+(a.canHitFly?1.1:0);
      const p=(unitValues[stage][id]||0)*72+(s.r<11?(unitValues[2][id]||0)*22:0);
      const carry=arcane&&['chess_char_4_02_a','chess_char_4_18_a'].includes(base(id));
      const added=openingBuild?.priority?.(s,a)||0;
      return 5.0+3.0*a.tier+raw+(a.isGolden?7:0)+prior*p+(carry?arcane*(a.isGolden?13:6):0)+added;
    }
    function pscore(p){
      if(!fieldValues.has(p[0])){
        const v=learnField?teacherScore('field',encode(p[1],p[2],0,p,'field')):0;
        fieldValues.set(p[0],power(p[1])+3*p[7].length+learnField*v);
      }
      return fieldValues.get(p[0]);
    }
    function countId(id){return owned.filter(p=>p[1]===id).length;}
    function focusVal(id){return activeBonds(id).includes(forcedFocus)?focusStrength:0;}
    function teamScore(team,variant=0) {
      const ids=new Set(), counts={}, roles={heal:0,block:0,fly:0}, pith=team.some(p=>activeBonds(p[1]).includes('maniShip'));
      let score=0,gold=0,active=0;
      for(const p of team){
        const id=p[1],a=chess(id);if(!a)continue;
        const phase=Math.sin(17.7*p[0]+13.7*variant)*318.13;
        score+=pscore(p)*(1+((variant%5)-2)*.045)+(variant?formationJitter*(phase-Math.floor(phase)-.5):0);
        gold+=+p[8]; roles.heal+=+(a.attackKind==='heal'); roles.block+=+(a.position==='MELEE'&&(a.stats?.blockCnt||0)>=1);roles.fly+=+a.canHitFly;
        const b=base(id);
        if(ids.has(b)){score-=6;continue}
        ids.add(b);
        for(const b of activeBonds(id))counts[b]=(counts[b]||0)+1;
      }
      if(roles.block===0)score-=18;else if(roles.block===1)score-=6;
      if(!roles.heal&&s.r>=4)score-=s.r>=14?10:19;
      if(!roles.fly&&s.r>3)score-=8;
      if(roles.heal>2)score-=14*(roles.heal-2);
      if(gold>=2)score+=7+gold*2;
      for(const [bond,n] of Object.entries(counts)){
        const b=gd.bond(bond);if(!b)continue;
        const adjusted=n+(b.isCore&&pith?1:0), layersNow=layers.get(bond)||0;
        const nt=(b.thresholds||[]).filter(x=>adjusted>=x).length;
        if(nt)active++;
        if(b.isCore){
          score+=nt?8+Math.min(14,layersNow*.12):0;
          if(nt>=2)score+=(bond===forcedFocus?52:33)+(bond==='kjeragShip'?17:0);
          if(bond===forcedFocus)score+=focusStrength*(4.8*n+(n>=4?3:0));
        }else if(bond==='soloShip')score+=n===1?7:0;
        else score+=nt*(2.0+Math.min(5,layersNow*.06));
        if(arcane && bond==='arcaneShip')score+=arcane*[0,2,11,30][Math.min(3,n)];
      }
      if(s.band==='band_amiya')score+=Math.max(0,Math.min(5,active)-2)*4;
      return campaignTeam(gd,s,team)+score;
    }
    function lineup(variant=0){
      const available=owned.filter(p=>s.legal[p[0]]?.length);
      const team=[];
      while(team.length<s.cap && team.length<available.length){
        const remain=available.filter(p=>!team.includes(p));
        team.push(byScore(remain,p=>teamScore([...team,p],variant)));
      }
      for(let pass=0;pass<2;pass++){
        let gain=.001,swap;
        for(let j=0;j<team.length;j++){
          const old=team[j],val=teamScore(team,variant);
          for(const alt of available){
            if(team.includes(alt))continue;
            team[j]=alt;
            const diff=teamScore(team,variant)-val;
            team[j]=old;
            if(diff>gain){gain=diff;swap=[j,alt]}
          }
        }
        if(!swap)break;
        team[swap[0]]=swap[1];
      }
      return team;
    }
    function acquire(id){
      const a=chess(id);if(!a)return -10;
      const copies=countId(id), goldId=gd.goldenIdOf(id);
      const member=focusVal(id), fresh=!set.has(base(id));
      const pieces=owned.length;
      let score=(power(id)-13)*.62+member*(fresh?32:8);
      if(copies>=2&&!a.isGolden)score+=73;
      if(copies===1&&!a.isGolden)score+=13+pairPlus+(member?6:0);
      if(!copies&&goldId&&owned.some(p=>p[1]===goldId))score-=20;
      if(pieces<s.cap)score+=17;
      if(pieces>=s.cap+4&&(!member||!fresh)&&!copies)score-=9;
      if(fresh&&a.attackKind==='heal'&&s.r>=3&&!owned.some(p=>chess(p[1])?.attackKind==='heal'))score+=15;
      if(fresh&&a.position==='MELEE'&&!owned.some(p=>chess(p[1])?.position==='MELEE'))score+=8;
      if(fresh&&activeBonds(id).includes('soloShip')&&s.r<6)score+=5;
      return score+campaignBuy(gd,s,id);
    }
    const itemCode=id=>/chess_item_(\d+_\d+)_/.exec(id)?.[1]||'';
    function gearValue(id){
      const code=itemCode(id);
      if(code==='2_05')return Math.max(-20,Math.min(45,(12-s.r)*5));
      if(code==='5_04')return s.r>=14?-30:owned.some(p=>!p[8]&&p[9]>=4)?49:12;
      if(code==='5_03')return owned.some(p=>countId(p[1])>=2)?43:12;
      if(code==='5_02')return -18;
      if(code==='3_14'||code==='5_01')return 33;
      if(['4_08','5_07','5_08','3_06','3_01','3_04','3_03'].includes(code))return 24;
      if(['2_02','2_06','4_15','3_12'].includes(code))return 17;
      if(code==='4_10')return forcedFocus==='kjeragShip'?31:16;
      if(code==='1_05')return owned.some(p=>chess(p[1]).attackKind==='heal')?17:4;
      if(code==='2_07')return s.r<14?15:-12;
      if(code==='3_11'||code==='1_03')return 12;
      return 1;
    }
    function equipTarget(a,p,targets,isPager){
      const code=itemCode(p[1]),count=q=>countId(q[1]),member=q=>focusVal(q[1]),rec=q=>chess(q[1]);
      if(plannedEquipment && a.itemType==='EQUIP'){
        const intended=targets.filter(q=>plannedEquipment(s,base(q[1]),gd.baseIdOf(p[1])));
        if(intended.length)return byScore(intended,q=>pscore(q)+(q[3]==='b'?6:0)+(q[8]?8:0));
      }
      if(code==='5_02'){
        const disposable=targets.filter(q=>q[3]!=='b'&&!q[8]&&!q[7].length&&count(q)===1&&!member(q));
        return byScore(disposable,q=>q[9]*3-pscore(q)*.2);
      }
      if(gear&&code==='3_15'&&s.r<11 && s.canReady)return null;
      if(code==='5_04')return byScore(targets.filter(q=>!q[8]),q=>pscore(q)+q[9]*4);
      if(code==='5_03')return byScore(targets,q=>(count(q)>=2&&!q[8]?100:0)+pscore(q));
      if(gear && ['2_09','4_07'].includes(code)){
        const medics=targets.filter(q=>rec(q).attackKind==='heal');
        if(medics.length)return byScore(medics,pscore);
      }
      if(gear && ['4_02','3_05','3_12','5_05','5_11'].includes(code)){
        const tanks=targets.filter(q=>rec(q).position==='MELEE');
        if(tanks.length)return byScore(tanks,q=>pscore(q)+(rec(q).stats?.blockCnt||0)*3);
      }
      if(gear && ['3_14','3_03','3_06','5_01','5_07','5_08','1_05'].includes(code)){
        const dealers=targets.filter(q=>rec(q).attackKind!=='heal');
        if(dealers.length)return byScore(dealers,q=>pscore(q)+(q[3]==='b'?5:0)+(q[8]?5:0)+(rec(q).position==='RANGED'?3:0));
      }
      return byScore(targets,q=>pscore(q)+member(q)*(isPager?100:6)+(q[3]==='b'?4:0)-q[7].length*4);
    }
    for(const p of items){
      const id=p[1],a=gd.item(id);
      if(usedItems.has(p[0])||!a)continue;
      const isPager=a.params?.key==='use_equip_reward_special_goods_char_chess'||String(a.effectId).includes('pager')||JSON.stringify(a).includes('use_equip_reward_special_goods_char_chess');
      const targets=owned.filter(q=>q[7].length<gd.equipSlots(q[1]) && (!a.requiresBondId||activeBonds(q[1]).includes(a.requiresBondId)));
      const target=equipTarget(a,p,targets,isPager);
      const msg=target&&asAction('equip',{itemUid:p[0],targetUid:target[0]});
      if(msg&&can(msg)&&a.itemType==='EQUIP'){usedItems.add(p[0]);return emit(msg)}
      if(a.itemType==='MAGIC' && owned.some(q=>q[3]==='b') && commodity){
        const anchor=byScore(owned.filter(q=>q[3]==='b'),pscore);
        const msg=asAction('art',{itemUid:p[0],row:anchor[4],col:anchor[5],dir:anchor[6]||'RIGHT'});
        if(can(msg)){usedItems.add(p[0]);return emit(msg)}
      }
    }
    const usedHand=s.pieces.filter(p=>p[3]==='h').length;
    const handRoom=usedHand<s.hand;
    const reward=s.reward.filter(x=>x&&!x[4]&&can(asAction('reward',{idx:x[0]}))&&(x[2]==='item'||handRoom));
    if(reward.length){
      const r=byScore(reward,x=>x[2]==='chess'?acquire(x[1]):((gd.item(x[1])?.tier||1)+1)*3);
      return emit(asAction('reward',{idx:r[0]}));
    }
    const board=owned.filter(p=>p[3]==='b');
    const signature=owned.map(p=>p[0]+'-'+p[1]).join(',');
    const place=()=>positioner(gd,s);
    if(board.length<s.cap && owned.some(p=>p[3]!=='b') && previousSet!==signature){
      previousSet=signature;
      const deploy=place();return {formation:deploy([...lineup(),...tokens],0),moves:[]};
    }
    const desired=Math.min(shopCap,Math.max(1,Math.floor((s.r+levelSpeed+1)/2)));
    const upgrade=asAction('levelUp'),canLevel=campaignCanLevel(gd,s,owned)&&s.level<shopCap&&s.level<s.maxLv&&s.up<=s.funds&&can(upgrade);
    const slots=s.shop.flatMap((x,i)=>x&&!x[3]&&x[2]<=s.funds&&can(asAction('buy',{slot:i}))?[{id:x[0],kind:x[1],price:x[2],i}]:[]);
    function baseBuyVal(o){
      if(o.kind!=='chess'){
        if(!gd.item(o.id)||o.kind!=='item')return -100;
        const a=gd.item(o.id);
        return items.length<2&&owned.length>=4&&a.itemType==='EQUIP'?equipValue*(4+(a.tier||1)*1.6):-55;
      }
      const visible=s.shop.filter(x=>x&&x[0]===o.id&&!x[3]).length;
      const combine=visible>1 && countId(o.id)+visible>=3 && visible*o.price<=s.funds ? 55 : 0;
      return acquire(o.id)+combine-o.price*(s.r<7?1.8:.8);
    }
    function buyVal(o) {
      const h=baseBuyVal(o);
      let v=h;
      if(learnBuy){
        const logit=teacherScore('shop',encode(o.id,o.kind,o.price));
        v=h*(1-learnBuy)+(18+9*logit)*learnBuy;
      }
      if(gear && o.kind==='item')v+=gear*gearValue(o.id);
      if(shopFocus && o.kind==='chess' && focusVal(o.id) && !set.has(base(o.id))){
        const members=coreCount(forcedFocus);
        if(members<6)v+=shopFocus*(members>=4?24:members>=2?11:4);
      }
      if(arcane && o.kind==='chess' && activeBonds(o.id).includes('arcaneShip')){
        const n=coreCount('arcaneShip');
        const upgrade=['chess_char_4_02_a','chess_char_4_18_a'].includes(o.id) && countId(o.id)>0;
        if(!set.has(base(o.id)) && n<3)v+=arcane*(n===2?27:n===1?13:5);
        if(upgrade)v+=arcane*(countId(o.id)>=2?33:12);
      }
      if(carryHunt&&o.kind==='chess'){
        const prio=['chess_char_4_02_a','chess_char_4_18_a','chess_char_4_01_a','chess_char_5_11_a'];
        const k=prio.indexOf(o.id);
        if(k>=0 && !holdElite(o.id))v+=carryHunt*[39,31,20,16][k];
      }
      if(o.kind==='chess' && commodity){
        const gs=(chess(o.id).garrisonIds||[]).map(k=>gd.garrison(k)?.effectType||'');
        if(gs.some(k=>/SERVER_GAIN_EQUIP|SERVER_GAIN_SPECIAL_REFRESH|SERVER_.*FREE_REFRESH/.test(k)))v+=commodity*7;
      }
      if(o.kind==='chess'&&openingBuild){
        const baseScore=openingBuild.priority(s,chess(o.id));
        const copies=countId(o.id);
        v+=baseScore*(holdElite(o.id)?.07:copies===2?1.3:copies===1?.75:1.0);
      }
      return v;
    }
    function holdElite(id){return owned.some(p=>p[1]===gd.goldenIdOf(id));}
    const top=byScore(slots,o=>buyVal(o)), value=top?buyVal(top):-100;
    const needLevel=s.level<desired;
    const urgent=top?.kind==='chess'&&(countId(top.id)>=2||owned.length<3||(focusVal(top.id)&&!set.has(base(top.id))&&owned.length>=s.cap));
    if(promoteAfterLevel && canLevel && top?.kind==='chess' && countId(top.id)+1>=gd.mergeCount(top.id) &&
       s.up+top.price<=s.funds && owned.length>=Math.min(3,s.cap))return emit(upgrade);
    if(canLevel && (s.up===0||(needLevel&&!urgent)) && !earlySpend)return emit(upgrade);
    const threshold=owned.length<s.cap?0:owned.length<s.cap+3?10:16;
    const empty=owned.filter(p=>p[3]!=='b');
    const expel=()=>{
      const sel=byScore(empty.filter(p=>can(asAction('sell',{uid:p[0]}))),p=>-(pscore(p)+focusVal(p[1])*35+(countId(p[1])===2?13:0)));
      return sel&&asAction('sell',{uid:sel[0]});
    };
    if(top && value>=threshold && (top.kind==='item'||handRoom))return emit(asAction('buy',{slot:top.i}));
    if(sellDown>0 && empty.length>=3 && roundSteps<42 && !formed){
      const keep=new Set(lineup().map(q=>q[0]));
      const surplus=empty.filter(p=>!keep.has(p[0]) && countId(p[1])<2 && (!focusVal(p[1])||owned.some(q=>q[0]!==p[0] && base(q[1])===base(p[1]))) && can(asAction('sell',{uid:p[0]})));
      const weak=byScore(surplus,p=>-pscore(p));
      const wanted=s.shop.filter(x=>x&&!x[3]&&x[1]==='chess'&&x[2]>s.funds && x[2]<=s.funds+surplus.length && (countId(x[0])>=2||(focusVal(x[0])&&!set.has(base(x[0])))));
      if(weak && (wanted.length||empty.length>5 || (sellDown>1 && s.r>=11 && empty.length>(s.r>=14?2:4)) || (needLevel && s.up>s.funds && s.up<=s.funds+surplus.length)))
        return emit(asAction('sell',{uid:weak[0]}));
    }
    if(!handRoom&&empty.length&&(value>threshold+8||!s.canReady||s.reward.length)){
      const weak=expel();if(weak)return emit(weak);
    }
    if(canLevel && (needLevel||s.up<=Math.max(0,s.funds-4)) )return emit(upgrade);
    const refresh=asAction('refresh');
    if((s.free>0||(s.refresh>0&&s.funds>=s.refresh+2))&&can(refresh)&&handRoom&&roundSteps<70)return emit(refresh);
    if(!formed){
      formed=true;
      const deploy=place(),n=s.r>=14?bossPlans:normalPlans;
      const teams=new Map(),cs=[],seen=new Set();
      for(let i=0;i<Math.max(1,n);i++){
        const j=i%5;if(!teams.has(j))teams.set(j,lineup(j));
        const plan=deploy([...teams.get(j),...tokens],i),tag=JSON.stringify(plan);
        if(!seen.has(tag)){cs.push(plan);seen.add(tag)}
      }
      return {moves:[],formation:cs[0],candidates:cs};
    }
    if(!s.canReady){
      const weak=expel();if(weak)return emit(weak);
      for(const p of items){
        const drop=asAction('destroy',{uid:p[0]});if(can(drop))return emit(drop);
      }
    }
    return emit(asAction('ready',{ready:true}));
  }
  return {decide,ack};
}
