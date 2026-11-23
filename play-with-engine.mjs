import { randomInt } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

// The same launcher can sit at the repository root or beside an extracted play.mjs.
const here = new URL('./', import.meta.url);
const pack = existsSync(new URL('stage-5/release.json', here)) ? new URL('stage-5/', here) : here;
const { values } = parseArgs({ options: {
  engine: { type: 'string' },
  seed: { type: 'string' },
  count: { type: 'string', default: '1' },
  band: { type: 'string', default: 'auto' },
  threads: { type: 'string', default: '4' },
  trace: { type: 'boolean' },
  output: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} });

if (values.help || !values.engine) {
  console.log('node play-with-engine.mjs --engine PATH [--seed N] [--count K] [--band auto|random|ID] [--threads 1..4] [--trace] [--output FILE]');
  process.exit(values.help ? 0 : 1);
}

const engine = resolve(values.engine);
const metadata = join(engine, 'package.json');
if (!existsSync(metadata) || !existsSync(join(engine, 'server', 'match', 'Match.js'))) {
  throw new Error('Pass the Stronghold-Protocol v0.4.0 root containing package.json and server/match/Match.js.');
}
const { name, version } = JSON.parse(readFileSync(metadata, 'utf8'));
if (name !== 'stronghold-protocol-alliance' || version !== '0.4.0') {
  throw new Error('Stage 5 was packaged for stronghold-protocol-alliance v0.4.0.');
}
const release = JSON.parse(readFileSync(new URL('release.json', pack), 'utf8'));
const limit = 2 ** 31;
const count = Number(values.count);
if (!Number.isSafeInteger(count) || count < 1 || count >= limit) throw new Error('Invalid game count.');
const seed = values.seed === undefined ? randomInt(limit - count + 1) : Number(values.seed);
if (!Number.isSafeInteger(seed) || seed < 0 || seed + count > limit) throw new Error('Invalid seed range.');
const threads = Number(values.threads);
if (!Number.isInteger(threads) || threads < 1 || threads > release.maxThreads) throw new Error('Invalid worker count.');

const runner = new URL(release.runner, pack);
// A source checkout eagerly imports its optional external-LLM host, which expects
// native bot exports. Use the packaged release's inactive LLM gate in this process.
const externalGate = pathToFileURL(realpathSync.native(join(engine, 'server', 'match', 'llmGate.js'))).href;
const releaseGate = new URL('engine/v0.4.0/server/match/llmGate.js', pack).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    return result.url === externalGate ? { ...result, url: releaseGate } : result;
  },
});
process.env.SP_WIN80_ARENA_THREADS = String(threads);
process.argv = [process.execPath, fileURLToPath(runner),
  '--engine', engine,
  '--player', fileURLToPath(new URL('players/frozen-player.mjs', pack)),
  '--options', JSON.stringify({ ...release.options, band: values.band }),
  '--first', String(seed), '--count', String(count),
];
if (values.trace) process.argv.push('--trace');
if (values.output) process.argv.push('--output', resolve(values.output));
await import(runner);
