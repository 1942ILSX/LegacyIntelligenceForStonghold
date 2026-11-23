import {createPlanner as second,seatProfile} from './revised-deployment.mjs';
import {withDiySelection} from './diy-selection.mjs';
import {withRoundFour} from './round-four-economy.mjs';
import {withRoundEleven} from './round-eleven.mjs';
import {withEarlyBounty} from '../win80-strategies/early-bounty.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export {seatProfile};

let cachedBounty;
function earlyBountyModel(signature){
  const key=[signature.certificateSha,signature.weightsSha,signature.playerSha].join('/');
  if(cachedBounty?.key===key)return cachedBounty.model;
  const checked=(path,expected)=>{
    const bytes=fs.readFileSync(path);
    if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Early bounty package signature mismatch');
    return bytes;
  };
  checked(new URL('../../reports/win80-strategies/early-bounty-33/certificate.json',import.meta.url),signature.certificateSha);
  checked(new URL('../win80-strategies/early-bounty.mjs',import.meta.url),signature.playerSha);
  const weights=checked(new URL('../../reports/win80-strategies/early-bounty-33/frozen-model.json',import.meta.url),signature.weightsSha);
  cachedBounty={key,model:JSON.parse(weights).model};
  return cachedBounty.model;
}
export function createPlanner(cfg){
  const opening=options=>options.diyPolicy?withDiySelection(second,options):second(options);
  const early=options=>options.roundFourModel?withRoundFour(opening,options):opening(options);
  const active=cfg.roundElevenModel?withRoundEleven(early,cfg):early(cfg);
  return cfg.earlyBounty?withEarlyBounty(active,cfg.gd,{model:earlyBountyModel(cfg.earlyBounty)}):active;
}
