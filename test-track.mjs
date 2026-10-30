#!/usr/bin/env node
// test-track.mjs — locks track.mjs's classify/guard behavior against a mock ledger.
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const f = join(tmpdir(), `ledger-test-${process.pid}.jsonl`);
writeFileSync(f, [
  JSON.stringify({ source: 'open', pr: 'https://github.com/paraloom-labs/paraloom-core/pull/1287', status: 'PENDING', income_usdc: 0 }),
  JSON.stringify({ source: 'missing', pr: 'https://github.com/octocat/Hello-World/pull/1347', status: 'PENDING', income_usdc: 0 }),
  JSON.stringify({ source: 'guard', pr: 'https://github.com/paraloom-labs/paraloom-core/pull/1287', status: 'PENDING', income_usdc: 999 }),
].join('\n') + '\n');

execFileSync('node', ['track.mjs', '--ledger', f], { stdio: 'inherit' });
const e = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
let pass = 0, fail = 0;
const ok = (n, c) => { c ? (pass++, console.log('  ✓', n)) : (fail++, console.log('  ✗', n)); };
ok('open PR stays PENDING_MAINTAINER_REVIEW', e[0].status === 'PENDING_MAINTAINER_REVIEW');
ok('404 PR -> TRACK_ERROR', e[1].status === 'TRACK_ERROR');
ok('unconfirmed income zeroed', e[2].income_usdc === 0);
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
