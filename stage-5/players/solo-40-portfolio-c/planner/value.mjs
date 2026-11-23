import fs from 'node:fs';
const trees=JSON.parse(fs.readFileSync(new URL('./economic-trees.json',import.meta.url)));
export function score(head,f){
  let sum=0;
  for(let node of trees[head]){
    while(Array.isArray(node))node=node[f[node[0]]<=node[1]?2:3];
    sum+=node;
  }
  return Math.max(-7,Math.min(7,sum));
}
