# oxfmt-quick

Run [oxfmt](https://oxc.rs/docs/guide/usage/formatter) on your changed files, and re-stage
them. What [`pretty-quick`](https://github.com/prettier/pretty-quick) is to Prettier.

Formatting a whole repository on every commit is wasteful, and a `--check` gate that only
tells you off is worse. `oxfmt-quick` formats what the commit actually contains, stages the
result, and stays out of the way.

```sh
pnpm add -D oxfmt-quick oxfmt
```

`oxfmt` is a peer dependency — bring your own version.

## Use it in a pre-commit hook

```sh
# .husky/pre-commit
pnpm exec oxfmt-quick
```

A non-zero exit aborts the commit, so an unformatted tree can never land.

## Usage

```
oxfmt-quick [options]

  --staged           Only files staged for commit (default)
  --no-staged        Files changed since the merge-base instead
  --since <rev>      Compare against <rev>; implies --no-staged
  --branch <name>    Branch to find the merge-base against (default: main)
  --check            Report unformatted files without writing, and exit non-zero
  --bail             Fail as soon as any file needs formatting
  --no-restage       Format without re-staging
  --config <path>    oxfmt config file
  --verbose          Print every file examined
```

## Partially staged files

If a file is staged **and** then edited further, only the staged content is going into the
commit. `oxfmt-quick` formats the file on disk but deliberately does **not** re-stage it —
`git add` would sweep the unstaged edits in and silently widen your commit. It reports the
file and exits non-zero so you decide what to stage.

That is the one case where doing less is safer, and it is a real bug in at least one
comparable tool ([biomejs/biome#3608](https://github.com/biomejs/biome/issues/3608)).

## What it does not do

- **Resolve config or ignore rules.** oxfmt already reads `.oxfmtrc`, `.gitignore` and
  `.prettierignore`, so there is nothing to reimplement here — and nothing to drift.
- **Filter by extension.** oxfmt skips what it cannot format, so a raw `git diff` list is
  handed straight over.
- **Support anything but git.** Mercurial and jj users are welcome to open an issue.

Gitignored files can never appear: `git diff` reports only tracked files.

## API

```ts
import { oxfmtQuick } from 'oxfmt-quick'

const { success, errors } = oxfmtQuick(process.cwd(), {
  staged: true,
  onWriteFile: (file) => console.log(`formatted ${file}`),
})
```

`errors` is a list of `BAIL_ON_WRITE`, `CHECK_FAILED`, `FORMAT_FAILED`,
`PARTIALLY_STAGED_FILE` or `STAGE_FAILED`. Every callback is optional; the CLI is a thin
reporting layer over this function.

## Notes

Files are collected with `git diff -z` and split on NUL, so paths containing spaces,
non-ASCII characters or newlines survive intact. `git add` is issued in batches of 100 so a
large changeset cannot exceed the command-line length limit.

`oxfmt` is invoked by resolving its own `bin` script and running it with the current
`node`, rather than looking up `oxfmt` on `PATH` — on Windows the `PATH` entry is a `.CMD`
shim that cannot be spawned without a shell.

## Licence

MIT
