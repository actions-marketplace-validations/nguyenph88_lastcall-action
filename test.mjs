// node test.mjs — exits non-zero on the first failed assertion.
import assert from 'node:assert/strict';
import { report } from './check.mjs';

// Trimmed from real `npx lastcall.dev@0.1 check --json` output.
const json = JSON.stringify({
  found: [
    {
      title: 'Amazon Mechanical Turk (MTurk) is shutting down',
      url: 'https://lastcall.dev/entries/amazon-mechanical-turk-shutdown',
      sunsetDate: '2026-09-30',
      why: [{ what: 'mturk-requester', where: 'src/jobs.py:3' }],
    },
    {
      title: 'HashiCorp Consul 1.22 reaches end of life, a standard release',
      url: 'https://lastcall.dev/entries/consul-1-22-end-of-life',
      sunsetDate: null,
      why: [{ what: 'hashicorp/consul:1.22.1', where: 'Dockerfile' }],
    },
  ],
});

// Findings → warnings by default, with file/line, escaped properties, never fails.
let r = report({ code: 0, json, err: '' });
assert.equal(r.exit, 0);
assert.equal(r.lines[0], '::warning file=src/jobs.py,line=3,title=Last call%3A 2026-09-30::Amazon Mechanical Turk (MTurk) is shutting down (mturk-requester). https://lastcall.dev/entries/amazon-mechanical-turk-shutdown');
// Manifest hits have no line; commas stay literal in the message, escaped only in properties.
assert.equal(r.lines[1], '::warning file=Dockerfile,line=1,title=Last call%3A no date yet::HashiCorp Consul 1.22 reaches end of life, a standard release (hashicorp/consul:1.22.1). https://lastcall.dev/entries/consul-1-22-end-of-life');
assert.match(r.lines[2], /2 things in this repo have/);
assert.match(r.summary, /\| 2026-09-30 \| \[Amazon Mechanical Turk/);

// Something already past its date says so instead of counting down.
r = report({ code: 0, json: JSON.stringify({ found: [{ title: 'X', url: 'u', sunsetDate: '2026-09-30', status: 'passed', why: [{ what: 'x', where: 'a.js:1' }] }] }), err: '' });
assert.match(r.lines[0], /title=Ended 2026-09-30::/);

// A sub-directory input prefixes paths so annotations land on the right file.
r = report({ code: 0, json, err: '', dir: 'services/api' });
assert.match(r.lines[0], /file=services\/api\/src\/jobs\.py,line=3/);

// fail: true → errors and exit 1.
r = report({ code: 0, json, err: '', fail: true });
assert.equal(r.exit, 1);
assert.match(r.lines[0], /^::error /);

// Nothing found → exit 0 even with fail: true.
r = report({ code: 0, json: '{"found":[]}', err: '', fail: true });
assert.equal(r.exit, 0);
assert.match(r.lines[0], /nothing in this repo/);

// CLI failure (offline, calendar down) → warning, exit 0, even with fail: true.
r = report({ code: 2, json: '', err: 'lastcall: could not fetch the calendar (HTTP 503). Offline?\n', fail: true });
assert.equal(r.exit, 0);
assert.match(r.lines[0], /^::warning::Last Call: check skipped \(exit 2\)\. lastcall: could not fetch/);

// Exit 0 but garbage output → same safe path, not a crash.
r = report({ code: 0, json: 'npm WARN something', err: '', fail: true });
assert.equal(r.exit, 0);
assert.match(r.lines[0], /could not read the CLI output/);

console.log('ok');
