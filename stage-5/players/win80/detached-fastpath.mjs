import {registerHooks} from 'node:module';

// A private forecast worker owns these modules. The official referee never installs this hook.
export function installDetachedFastpath(){
  const sim=new URL('../../engine/v0.4.0/server/sim/',import.meta.url);
  const ai=new URL('ai.js',sim).href, buffs=new URL('battle/status.js',sim).href;
  const hooks=new URL('battle/hooks.js',sim).href;
  function replace(source,from,to){
    if(source.split(from).length!==2)throw Error('Detached kernel changed at '+from);
    return source.replace(from,to);
  }
  registerHooks({load(url,ctx,next){
    const loaded=next(url,ctx);
    if(url!==ai&&url!==buffs&&url!==hooks)return loaded;
    let source=Buffer.from(loaded.source).toString('utf8').replaceAll('\r\n','\n');
    if(url===ai){
      source=replace(source,'  if (u.atkCd > 0) return;\n','');
      source=replace(source,'if (b.rangeChanged(u)) b._refreshRange(u);',
        'if (b.rangeChanged(u)) b._refreshRange(u);\n  if (u.atkCd > 0) return;');
    }
    if(url===buffs){
      source=replace(source,'if (u.buffs.indexOf(b) < 0) continue;',
        'if ((!b.onTick && b.timeLeft === Infinity) || u.buffs.indexOf(b) < 0) continue;');
    }
    if(url===hooks){
      // Handlers can add or remove subscriptions inside a nested emit. Share removal flags, and
      // copy membership only on mutation so the active emit keeps its original iteration order.
      source=replace(source,'const list = this._hooks[name] ?? (this._hooks[name] = []);',
        'const list = this._hooks[name] = this._hooks[name]?.slice() ?? [];');
      source=replace(source,'if (i >= 0) list.splice(i, 1);\n        if (!list.length) delete this._hooks[h.name];',
        'if (i >= 0) { if (list.length === 1) delete this._hooks[h.name]; else this._hooks[h.name] = list.toSpliced(i, 1); }');
      source=replace(source,'const list = this._hooks[nameOrHandle];\n    if (!list) return;',
        'if (!this._hooks[nameOrHandle]) return;\n    const list = this._hooks[nameOrHandle] = this._hooks[nameOrHandle].slice();');
      source=replace(source,'const list = this._hooks[name];\n      for (let i = list.length - 1;',
        'const list = this._hooks[name] = this._hooks[name].slice();\n      for (let i = list.length - 1;');
      const first=source.indexOf('    const arr = (this._emitBufs'),last=source.indexOf('    this._frameCtx[d] = ctx;',first);
      if(first<0||last<first)throw Error('Detached event iteration changed');
      source=source.slice(0,first)+'    const arr = list;\n'+source.slice(last);
      source=replace(source,"      arr.length = 0; // drop the snapshot's references: a hook removed after this emit must not stay reachable",'');
    }
    return {...loaded,source,shortCircuit:true};
  }});
}
