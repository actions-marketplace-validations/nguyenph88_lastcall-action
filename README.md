# Last Call deprecation check

Finds the things your repo depends on that have an **announced shutdown or end-of-life date**: npm and PyPI packages, Node/Python runtimes, Docker image tags, and API identifiers in your source (model names, endpoints, resource types). Matches are checked against [Last Call](https://lastcall.dev), a public calendar of sunsets where every entry links to the vendor's own announcement.

```yaml
# .github/workflows/lastcall.yml
name: Last Call
on:
  pull_request:
  schedule:
    - cron: '0 6 * * 1' # weekly, because end dates get announced without your code changing
jobs:
  sunsets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nguyenph88/lastcall-action@v1
```

Each finding becomes an annotation on the file and line that triggered it, and the job summary gets a table:

| Date | What | Where |
|---|---|---|
| 2026-10-31 | [HashiCorp Consul 1.22 reaches end of life](https://lastcall.dev/entries/consul-1-22-end-of-life) | `hashicorp/consul:1.22.1` in `Dockerfile` |

## Inputs

| Input | Default | |
|---|---|---|
| `path` | `.` | Directory to check, relative to the workspace. |
| `fail` | `false` | `true` fails the job when anything is found. By default findings are warnings, so adding the action never breaks a build. |

If the calendar can't be reached, the step logs a warning and passes, even with `fail: true`. An outage on our side should never turn your build red.

## What it does and doesn't see

- **Reads:** `package.json` (dependencies + `engines.node`), `requirements*.txt`, `Dockerfile*`, `compose*.yml`, `.nvmrc`, `.python-version`, plus literal identifiers in source and config files.
- **Doesn't read:** lockfiles, transitive dependencies, or version ranges. Package matches are by name, so the calendar only fingerprints a package when every version of it is going away.
- **Only knows what the calendar knows.** Not every entry has a fingerprint; a clean result means "nothing we can detect", not "nothing is ending".
- **Nothing leaves the runner.** The check downloads the public dataset ([`/api/sunsets.json`](https://lastcall.dev/api/sunsets.json), CC BY 4.0) and scans locally.

The checker is the [`lastcall.dev`](https://www.npmjs.com/package/lastcall.dev) CLI, which you can also run yourself with `npx lastcall.dev check`. Last Call is written and run by an AI; see [lastcall.dev/log](https://lastcall.dev/log).

Wrong or missing date? [Open an issue](https://github.com/nguyenph88/lastcall-action/issues) or email hello@lastcall.dev.

## Maintaining

- `node test.mjs` checks the output formatting. There's no CI workflow because Marketplace action repos stay workflow-free.
- `action.yml` pins the CLI to `lastcall.dev@0.1`, so CLI patch releases reach users without an action release. A CLI **minor** bump may change the `--json` shape: update the pin, run the test, and release.
- Release: tag `vX.Y.Z`, publish the GitHub release (tick "Publish to Marketplace"), then move the major tag: `git tag -f v1 && git push -f origin v1`.
