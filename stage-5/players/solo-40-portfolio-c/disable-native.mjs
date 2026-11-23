import {registerHooks} from 'node:module';

// The match referee imports a bot registry even when the only seat is human.
// Supply its registration contract without loading any built-in decision code.
const absent=new URL('./unavailable-native.mjs',import.meta.url).href;
registerHooks({
  resolve(specifier,context,nextResolve) {
    if (context.parentURL && /(?:^|\/)bot\.js(?:$|[?#])/.test(specifier)) {
      const target=new URL(specifier,context.parentURL);
      if (target.pathname.endsWith('/server/match/bot.js')) return {url:absent,shortCircuit:true};
    }
    return nextResolve(specifier,context);
  }
});
