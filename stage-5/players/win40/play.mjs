import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({options: {
  seed: {type: 'string'}, count: {type: 'string', default: '1'},
  band: {type: 'string'}, trace: {type: 'boolean'}, output: {type: 'string'},
  help: {type: 'boolean', short: 'h'},
}});
if (values.help) {
  console.log('node players/win40/play.mjs [--seed INTEGER] [--count N] [--band auto|random|BAND_ID] [--trace] [--output FILE]');
  process.exit(0);
}
const count = Number(values.count);
const limit = 2 ** 31;
if (!Number.isSafeInteger(count) || count < 1 || count >= limit) throw Error('Invalid count');
const first = values.seed === undefined ? randomInt(0, limit - count + 1) : Number(values.seed);
if (!Number.isSafeInteger(first) || first < 0 || first + count > limit) throw Error('Invalid seed range');

const runner = new URL('../solo-40-portfolio-c/standalone.mjs', import.meta.url);
const args = ['--first', String(first), '--count', String(count)];
if (values.trace) args.push('--trace');
if (values.output) args.push('--output', values.output);
if (values.band && values.band !== 'auto') {
  args.push('--player', fileURLToPath(new URL('./assigned.mjs', import.meta.url)),
            '--options', JSON.stringify({band: values.band}));
}
process.argv = [process.execPath, fileURLToPath(runner), ...args];
await import(runner);
