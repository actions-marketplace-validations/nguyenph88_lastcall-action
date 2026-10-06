// Turns `lastcall check --json` output into GitHub annotations, a job summary and an
// exit code. If the check itself failed (calendar unreachable, npm down) that is a
// warning, never a failed build: our outage must not become someone else's.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Workflow-command escaping: messages escape %, CR, LF; properties also : and ,
const escMsg = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s) => escMsg(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
const cell = (s) => String(s).replace(/\|/g, '\\|');

export function report({ code, json, err, dir = '.', fail = false }) {
  let found;
  try {
    if (code === 0) ({ found } = JSON.parse(json));
  } catch {
    code = -1; // unparseable output is a broken check, not a finding
    err = `could not read the CLI output (starts: ${JSON.stringify(json.slice(0, 120))}). ${err}`;
  }
  if (code !== 0) {
    return {
      lines: [`::warning::${escMsg(`Last Call: check skipped (exit ${code}). ${err.trim()}`)}`],
      summary: `### Last Call: check skipped\n\nThe calendar could not be fetched, so nothing was checked. This does not fail the build.\n`,
      exit: 0,
    };
  }

  const level = fail ? 'error' : 'warning';
  const lines = [];
  const rows = [];
  for (const f of found) {
    const when = f.sunsetDate || 'no date yet';
    const title = f.status === 'passed' ? `Ended ${when}` : `Last call: ${when}`;
    for (const w of f.why) {
      const [file, line = '1'] = w.where.split(':'); // "file" for manifests, "file:line" for source hits
      const at = path.posix.join(dir, file);
      lines.push(`::${level} file=${escProp(at)},line=${line},title=${escProp(title)}::${escMsg(`${f.title} (${w.what}). ${f.url}`)}`);
      rows.push(`| ${when} | [${cell(f.title)}](${f.url}) | \`${cell(w.what)}\` in \`${cell(at)}\` |`);
    }
  }

  const n = found.length;
  lines.push(n
    ? `Last Call: ${n} thing${n > 1 ? 's' : ''} in this repo ${n > 1 ? 'have' : 'has'} an announced end date.`
    : 'Last Call: nothing in this repo has an announced end date.');
  const summary = n
    ? `### Last Call: ${n} end date${n > 1 ? 's' : ''} in this repo\n\n| Date | What | Where |\n|---|---|---|\n${rows.join('\n')}\n\nData: [lastcall.dev](https://lastcall.dev) (CC BY 4.0)\n`
    : `### Last Call: nothing in this repo has an announced end date\n\nOnly as good as what the calendar knows about: [lastcall.dev](https://lastcall.dev).\n`;
  return { lines, summary, exit: fail && n ? 1 : 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [code, jsonFile, errFile] = process.argv.slice(2);
  const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  const out = report({
    code: Number(code),
    json: read(jsonFile),
    err: read(errFile),
    dir: process.env.INPUT_PATH || '.',
    fail: process.env.INPUT_FAIL === 'true',
  });
  for (const l of out.lines) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.summary);
  process.exit(out.exit);
}
