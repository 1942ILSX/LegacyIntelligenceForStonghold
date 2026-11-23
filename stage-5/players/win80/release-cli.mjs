import {randomInt} from 'node:crypto';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';

const root=new URL('../../',import.meta.url);
const release=JSON.parse(readFileSync(new URL('release.json',root),'utf8'));
const {values:a}=parseArgs({options:{seed:{type:'string'},count:{type:'string',default:'1'},band:{type:'string',default:'auto'},
  trace:{type:'boolean'},output:{type:'string'},threads:{type:'string'},help:{type:'boolean',short:'h'}}});
if(a.help){
  console.log('node play.mjs [--seed INTEGER] [--count N] [--band auto|random|BAND_ID] [--threads N] [--trace] [--output FILE]');
  process.exit(0);
}
const count=Number(a.count),limit=2**31;
if(!Number.isSafeInteger(count)||count<1||count>=limit)throw Error('Invalid count');
const first=a.seed===undefined?randomInt(0,limit-count+1):Number(a.seed);
if(!Number.isSafeInteger(first)||first<0||first+count>limit)throw Error('Invalid seed range');
if(a.output&&existsSync(a.output)&&statSync(a.output).size)throw Error('Output file must be empty');
if(a.threads!==undefined) {
  const n=Number(a.threads);
  if(!Number.isInteger(n)||n<1||n>release.maxThreads)throw Error('Unsupported worker count');
  process.env.SP_WIN80_ARENA_THREADS=String(n);
}
const runner=new URL(release.runner,root),player=new URL('players/frozen-player.mjs',root);
const options={...release.options,band:a.band};
const command=['--first',String(first),'--count',String(count),'--player',fileURLToPath(player),'--options',JSON.stringify(options)];
if(a.trace)command.push('--trace');
if(a.output)command.push('--output',a.output);
process.argv=[process.execPath,fileURLToPath(runner),...command];
await import(runner);
