import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeCommandHistory} from '../win80/command-history.mjs';
import {batchTerminalForecast} from './formation-lab-batch.mjs';
import {installIsolatedTerminalForecast,isolatedRanker} from './formation-student-v1-private.mjs';
installIsolatedTerminalForecast();
const {rankedFormationBank,selectForecast}=await import(isolatedRanker);
const file=readFileSync(new URL('./formation-student-v1.weights.json',import.meta.url));
const opts=JSON.parse(readFileSync(new URL('./formation-student-v1.options.json',import.meta.url),'utf8'));
if(createHash('sha256').update(file).digest('hex')!==opts.weightSHA256)throw Error('Frozen terminal weights checksum mismatch');
const weights=JSON.parse(file);
export function createPackagedTerminalSession(gd,workers){
 const history=makeCommandHistory(gd),batch=batchTerminalForecast(workers);let old=[],once=false;const timings=[];
 return {
  timings,
  remember(candidates){old=candidates||[];},
  beforeCommand(round,own,msg){return msg.t==='g.command'?history.describe(round,own,msg):null;},
  accepted(rows){if(rows)history.commit(rows);},
  choose(c,own,deadline){
   if(once)return null;once=true;
   const start=performance.now();history.decorate(c,own);
   const base=c.own.board.map(z=>[z.uid,z.row,z.col,z.dir||'RIGHT']);
   const bank=rankedFormationBank(gd,c,base,old,weights,{limit:opts.k});
   const stats={changed:false,completed:0,offered:bank.selected.length,generationMs:bank.generationMs,rankingMs:bank.rankingMs};
   if(performance.now()>=deadline-2){timings.push({...stats,reason:'time-geometry',elapsed:performance.now()-start});return null;}
   const rows=batch(c,bank.selected.map(q=>q.p),deadline,opts);
   if(!rows[0]){timings.push({...stats,completed:rows.filter(Boolean).length,reason:'time-incumbent',elapsed:performance.now()-start});return null;}
   const completed=[],tested=[];
   for(let i=0;i<rows.length;i++)if(rows[i]){completed.push(rows[i]);tested.push(bank.selected[i]);}
   const pick=selectForecast(tested,completed,c.own.lp,opts);
   timings.push({...stats,reason:pick?'changed':'incumbent',changed:pick>0,completed:completed.length,elapsed:performance.now()-start});
   return pick?tested[pick].p:null;
  }
 };
}
