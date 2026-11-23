import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {withCommandLesson} from './player.mjs';

const files=[
  ['./player.mjs','5e3ad68330efeffd65dc10950e3f842f472befce073aeb45d057e976f7aa28ce'],
  ['./features.mjs','8c18c1840c6a21ea2586ebf535565d819a2e2a45434490108c74290cb22a6d4f'],
  ['../../../reports/win80-strategies/command-lesson-42/model.json','6ee5247cfce853ce4352cad7f9ced9e4d6ac7e203bf7e34d6f7be1c3ac8954b0']
];
const effect='aceffect_band_91';
let loaded;
function verified(){
  if(loaded)return loaded;
  let model;
  for(const [name,expected] of files){
    const bytes=readFileSync(new URL(name,import.meta.url));
    if(createHash('sha256').update(bytes).digest('hex')!==expected)
      throw Error('Misery training deployment hash mismatch for '+name);
    if(name.endsWith('model.json'))model=JSON.parse(bytes);
  }
  if(!model?.skills.includes(effect))throw Error('Misery target weights missing');
  loaded={...model,skills:[effect]};
  return loaded;
}

export function withVerifiedMisery(base,cfg){
  const player=withCommandLesson(base,cfg.gd,verified());
  return {
    decide(need,s){
      if(need==='prep'&&s.band==='band_breakaway'&&s.cmd?.id===effect&&s.cmd.usable&&s.cmd.cost<=s.funds){
        return player.decide(need,s);
      }
      return base.decide(need,s);
    },
    ack(status){base.ack?.(status);}
  };
}
