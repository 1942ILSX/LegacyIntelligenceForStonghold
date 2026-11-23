import {registerHooks} from 'node:module';
import {extendRoadPool} from './road-heat-families.mjs';
const timing=new URL('./release-timing.mjs',import.meta.url);
const pool=new URL('./parallel-pool.mjs',import.meta.url),ref=new URL('./parallel-referee.mjs',import.meta.url);

// Call prior to importing release-referee or fast-release-referee. The second
// hook registers after the release's own transforms so no worker URL is replaced.
export function installRoadHeatFamilies() {
  registerHooks({load(url,ctx,next){
    const loaded=next(url,ctx);
    if(url!==timing.href)return loaded;
    const source=Buffer.from(loaded.source).toString('utf8');
    return {...loaded,source:source+'\nimport {installRoadHeatPool} from '+JSON.stringify(import.meta.url)+';\ninstallRoadHeatPool();'};
  }});
}
export function installRoadHeatPool() {
  registerHooks({load(url,ctx,next){
    const loaded=next(url,ctx);if(url!==pool.href&&url!==ref.href)return loaded;
    const s=Buffer.from(loaded.source).toString('utf8');
    if(url===pool.href)return {...loaded,source:extendRoadPool(s)};
    const field='Number(!!f.changed),v.forecastStride]);';
    if(s.split(field).length!==2)throw Error('Unknown ordinary forecast metrics');
    return {...loaded,source:s.replace(field,'Number(!!f.changed),v.forecastStride,f.roadHeat??null]);')};
  }});
}
