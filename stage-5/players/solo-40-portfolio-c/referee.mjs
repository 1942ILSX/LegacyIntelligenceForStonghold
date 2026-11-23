import './disable-native.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {view} from './observation.mjs';
import {placeFormation} from './formation.mjs';
import {makeForecaster} from './forecast.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const {values: args} = parseArgs({options: {
  engine: {type:'string', default:path.resolve(here,'../../engine/v0.4.0')},
  player: {type:'string', default:'controller.mjs'},
  first: {type:'string', default:'96500001'}, count: {type:'string', default:'1'},
  options: {type:'string', default:'{}'}, output: {type:'string'}, trace: {type:'boolean'}, seeds:{type:'string'},
}});
const load = file => import(pathToFileURL(path.join(args.engine,file)).href);
const {getVersionData, setData} = await load('server/data.js');
const {rememberOfficialBounds} = await load('shared/plugins/officialBounds.js');
const modeId = 'mode_single_20', version = 'act3autochess@V3_1', pid = 'ai_0';
const quiet = {info(){},warn(){},debug(){},error(...a){process.stderr.write(a.join(' ')+'\n')}};
const data = getVersionData(version,{log:quiet});
if (data.config.version.id !== version || !data.config.modes[modeId]) throw Error('Wrong rules');
setData(data);
rememberOfficialBounds(data);
const {Match} = await load('server/match/Match.js');
const {VirtualScheduler} = await load('server/match/scheduler.js');
const {GameData} = await load('server/match/gamedata.js');
const {diyRecord, diySlot} = await load('shared/diy.js');

const options = {...JSON.parse(fs.readFileSync(path.join(here,'options.json'),'utf8')),...JSON.parse(args.options)};
const staticRules = new GameData(data,modeId);
const forecast = await makeForecaster(load);
const search = options.search ? await (await import('./search/index.mjs')).makeSearch(load) : null;
if(args.player==='legacy') throw Error('Only independent human-seat players are accepted');
const legacy=false;
const module = legacy ? null : await import(pathToFileURL(path.resolve(here,args.player)).href);
const factory = module?.createPlanner;
const profile = module?.seatProfile?.(staticRules,options) || {};
if (Object.keys(profile).some(k=>!['diy','loadout'].includes(k))) throw Error('Illegal profile option');
const publicRules = Object.create(staticRules);
const profiles = new Map();
for(const [slot, pick] of Object.entries(profile.diy||{})) {
  const rule=diySlot(slot,data);
  for(const elite of [false,true]) {
    const rec=diyRecord(slot,pick,{data,elite});
    if(!rec) throw Error('Invalid DIY record '+slot);
    profiles.set(elite?rule.goldenId:slot,rec);
  }
}
publicRules.chess = id => profiles.get(id) || staticRules.chess(id);
const legal = new Set(['g.infoReady','g.bondGroup','g.band','g.diyBring','g.buy','g.levelUp','g.refresh',
  'g.sell','g.move','g.freeze','g.choice','g.reward','g.commandChoice','g.command','g.equip','g.unequip',
  'g.destroy','g.art','g.ready']);
function inputNeeded(m, ps) {
  if(m.phase==='INFO_CHECK' && !ps.infoReady) return 'opening';
  if(m.phase==='BAND_DRAFT' && m.draftTurn()===pid && !m.draft.picks[pid]) return 'band';
  if(m.phase==='CUSTOM_CHECK' && ps.diyBring==null) return 'diy';
  if(m.phase==='SP_DRAFT' && m.spTurn()===pid && m.sp?.picks[pid]==null) return 'card';
  if(m.phase==='PREP' && ps.alive && !ps.ready) return 'prep';
  return null;
}
function run(seed) {
  let result;
  const psOptions = {seat:0,playerId:pid,name:'Player',isBot:legacy,connected:true,...profile};
  const m = new Match({roomCode:'SOLO',mode:'solo',modeId,difficulty:data.config.modes[modeId].difficulty,
    seats:[psOptions],seed,data,log:quiet,scheduler:new VirtualScheduler(),clientCombat:false,
    send:()=>true,broadcast(){},onEnd(s){result=s;}});
  const ps = m.order[0], ready = [], counts = {}, rejected = {}, actionDigest = createHash('sha256');
  const history = [], trace = args.trace;
  let openingPublic=null;
  let requests = 0, repeated = 0, proposals = 0, validProposals = 0;
  const act = msg => {
    if(!msg || !legal.has(msg.t)) throw Error('Prohibited command '+String(msg?.t));
    const round = m.round;
    const pre = msg.t==='g.ready' ? {round,lp:ps.lp,level:ps.shop.level,funds:ps.funds,
      board:[...ps.board.values()].filter(p=>p.kind==='chess').map(p=>p.id),
      ...(round===staticRules.bossRound?{bonds:ps.privateView().bonds.map(b=>[b.bondId||b.id,b.tier,b.layers,!!b.active]),
        equipped:[...ps.board.values()].reduce((n,p)=>n+(p.items?.length||0),0)}:{})} : null;
    const res = m.handle(pid,msg);
    if(res.error) rejected[res.error]=(rejected[res.error]||0)+1;
    else {
      counts[msg.t]=(counts[msg.t]||0)+1;
      actionDigest.update(JSON.stringify([round,msg])+'\n');
      if(pre) ready.push(pre);
    }
    if(trace) history.push({round,msg,error:res.error||null});
    return res;
  };
  try {
    if(Object.keys(profile.loadout||{}).length!==Object.keys(ps.loadout||{}).length) throw Error('Lobby rejected the selected skills');
    if(Object.keys(profile.diy||{}).length!==Object.keys(ps.diy||{}).length) throw Error('Lobby rejected the proposed roster');
    let finalBoss=null;
    const settle=m._finishFinal.bind(m);
    m._finishFinal=(...args)=>{
      if(m.round===staticRules.bossRound && m.bossPool && finalBoss==null) {
        finalBoss={max:m.bossPool.maxHp,remaining:m.bossPool.hp,lp:m.teamLp};
      }
      return settle(...args);
    };
    const player = legacy ? null : factory({gd:publicRules,...options});
    if(player) {
      for(const key of ['scheduleBotPrep','scheduleBandBot','scheduleSpBot','kickBot','prepDeadline',
        'timeoutBand','pickBotBondGroup','autoPickPersonalChoice']) m[key]=()=>{throw Error('Automatic move '+key)};
    }
    m.start();
    for(let n=0; n<5e6 && !result; n++) {
      if(!legacy && (ps.isBot || ps.autoplay)) throw Error('Human control lost');
      const need = player && inputNeeded(m,ps);
      if(!need) { if(!m.sched.runNext()) break; continue; }
      if(++requests>3200) throw Error('Action limit on '+seed+' at round '+m.round);
      const snapshot = view(m,ps);
      if(need==='band' && !openingPublic)openingPublic={groups:snapshot.groups,selectedGroup:snapshot.picked,disabledBonds:snapshot.disabledBonds,bannedChess:snapshot.bannedChess};
      const reply=player.decide(need,snapshot);
      let accepted = 0;
      if(reply.formation) {
        if(need!=='prep') throw Error('Formation outside preparation');
        let goals = reply.formation;
        if(search && reply.candidates?.length) {
          const isBoss=snapshot.r>=staticRules.bossRound;
          const params=isBoss?options.search.boss:options.search.normal;
          if(params) {
            const f=search(m,ps,snapshot,reply.candidates,params);
            goals=f.formation;
            proposals+=f.trials;validProposals+=f.trials-f.errors.length;
          } else if(reply.candidates.length>1) {
            const f=forecast(m,ps,reply.candidates);
            goals=reply.candidates[f.index];
            proposals+=f.trials;validProposals+=f.trials-f.errors.length;
          }
        } else if(reply.candidates?.length>1) {
          const f = forecast(m,ps,reply.candidates);
          goals=reply.candidates[f.index];
          proposals+=f.trials;
          validProposals+=f.trials-f.errors.length;
        }
        placeFormation(ps,goals,act);
        accepted++;
      }
      const status=[];
      for(const msg of reply.moves||[]) {
        if(snapshot.phase!==m.phase) break;
        const res=act(msg);
        status.push(res.error||'ok');
        if(!res.error) {
          accepted++;
          if(reply.firstLegal) break;
        }
      }
      player.ack?.(status);
      repeated=accepted?0:repeated+1;
      if(repeated>12) throw Error('Repeated rejected move '+JSON.stringify({need,reply,status}).slice(0,1300));
    }
    if(!result || m.simErrors || m.errorCount) throw Error('Game failed '+JSON.stringify(m.errors));
    if(!legacy && (!counts['g.infoReady'] || !counts['g.band'] || !counts['g.ready'])) throw Error('Missed game phase');
    return {seed,openingPublic,independent:true,win:!!result.victory,passed:result.roundsPassed,reached14:legacy?m.round>=14:ready.some(x=>x.round===14),
      stage:m.stageId,boss:m.bossId,band:ps.bandId,group:m.bondChoice?.picked,hidden:!!result.hiddenReached,
      finalBoss,bossDamage:result.players?.[0]?.stats?.bossDamage??null,
      errors:0,human:!ps.isBot,autoplay:!!ps.autoplay,requests,actions:counts,rejected,proposals,validProposals,
      actionDigest:actionDigest.digest('hex'),ready:trace?ready:ready.filter(x=>x.round===14),...(trace?{history}:{})};
  } finally {m.dispose();}
}
const first = Number(args.first), count = Number(args.count);
if(!Number.isSafeInteger(first) || !Number.isSafeInteger(count) || count<1) throw Error('Invalid range');
if(args.output && fs.existsSync(args.output) && fs.statSync(args.output).size>0) throw Error('Output already has data');
const seeds=args.seeds?args.seeds.split(',').map(Number):Array.from({length:count},(_,i)=>first+i);
if(!seeds.length||new Set(seeds).size!==seeds.length||seeds.some(x=>!Number.isSafeInteger(x)))throw Error('Invalid seeds');
for(const seed of seeds) {
  const row=run(seed);
  const line=JSON.stringify(row)+'\n';
  if(args.output) fs.appendFileSync(args.output,line);
  else process.stdout.write(line);
}
