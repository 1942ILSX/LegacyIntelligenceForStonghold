// Only discard a private proposal when every reported failure came from the
// battle simulator's recursive-hook bound. All other errors remain visible.
export function isForecastHookLimit(error){
  try{
    const attempts=JSON.parse(error.message);
    return Array.isArray(attempts)&&attempts.length>0&&attempts.every(attempt=>{
      const prefix='Error: Detached combat errors: ';
      if(typeof attempt.error!=='string'||!attempt.error.startsWith(prefix))return false;
      const failures=JSON.parse(attempt.error.slice(prefix.length));
      return Array.isArray(failures)&&failures.length>0&&failures.every(
        row=>Array.isArray(row)&&row[0]?.startsWith('hookDepth:')&&
          row[2]?.startsWith('hook nesting deeper than 32;')&&row[3]?.includes('/server/sim/battle/hooks.js:'));
    });
  }catch{return false;}
}
