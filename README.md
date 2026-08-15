# `oxfmt-quick`

[![npm](https://img.shields.io/npm/v/oxfmt-quick.svg)](https://www.npmjs.com/package/oxfmt-quick)
[![npm downloads](https://img.shields.io/npm/dm/oxfmt-quick.svg)](https://www.npmjs.com/package/oxfmt-quick)
[![license](https://img.shields.io/npm/l/oxfmt-quick.svg)](./LICENSE)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Code Style: oxfmt](https://img.shields.io/badge/code_style-oxfmt-blue.svg)](https://oxc.rs/docs/guide/usage/formatter)
[![Linted with oxlint](https://img.shields.io/badge/linted_with-oxlint-blue.svg)](https://oxc.rs/docs/guide/usage/linter)

> Get oxfmt Quick

Runs [oxfmt](https://oxc.rs/docs/guide/usage/formatter) on your changed files.

Formatting a whole repository on every commit is wasteful, and a `--check` gate that only
tells you off is worse. `oxfmt-quick` formats what the commit actually contains, stages the
result, and gets out of the way.

Supported source control managers:

- Git

## Install

```sh
# pnpm
pnpm add -D oxfmt oxfmt-quick
```

```sh
# npm
npm install -D oxfmt oxfmt-quick
```

`oxfmt` is a peer dependency, so you choose the version.

## Usage

```sh
# pnpm
pnpm exec oxfmt-quick

# npx
npx oxfmt-quick
```

## Pre-Commit Hook

With [`husky`](https://typicode.github.io/husky/):

```sh
pnpm add -D husky && pnpm exec husky init
```

In `.husky/pre-commit`:

```sh
pnpm exec oxfmt-quick
```

Or with [`simple-git-hooks`](https://github.com/toplenboren/simple-git-hooks), in
`package.json`:

```jsonc
"simple-git-hooks": {
  "pre-commit": "npx oxfmt-quick"
}
```

A non-zero exit aborts the commit, so an unformatted tree cannot land.

## CLI Flags

### `--staged`

Pre-commit mode, and the default. Only staged files are formatted, and they are re-staged
afterwards. Anything unstaged is not going into the commit, so formatting it would be work
the commit never uses.

Partially staged files are formatted but **not** re-staged, and `oxfmt-quick` exits with a
non-zero code. See [Partially staged files](#partially-staged-files).

### `--no-staged`

Format everything changed since the merge-base with `--branch`, plus untracked files,
instead of reading the index. Useful outside a commit hook.

### `--since <rev>`

Compare against a specific revision — a commit hash, tag or ref. Implies `--no-staged`.
For example `oxfmt-quick --since HEAD~5`.

### `--branch <name>`

When not in `--staged` mode, the branch to find the merge-base against. Defaults to `main`.

The _merge-base_ is used rather than the branch tip, so a feature branch that has fallen
behind does not drag in every file that changed on `main` in the meantime.

### `--no-restage`

Use with `--staged` to format without re-staging. You then stage the formatting yourself.

### `--check`

Report which files are not formatted without writing anything, and exit non-zero if any
are. Useful in CI to verify that the changed files on a branch were formatted.

### `--bail`

Exit non-zero if any file needed formatting, even though it was formatted. Use it to stop a
commit that was not already clean.

### `--config <path>`

Path to an oxfmt config file, passed through as `oxfmt --config`.

### `--verbose`

Print the name of every file considered, not just the ones that changed. Useful when oxfmt
errors and you cannot tell which file caused it.

## Partially staged files

If a file is staged and then edited again, only the staged content is going into the
commit. `oxfmt-quick` formats the file on disk but deliberately does **not** re-stage it —
`git add` would sweep the unstaged edits in and silently widen your commit. The file is
reported and the run exits non-zero, so you can amend your staging to include the
formatting fix.

This is the one case where doing less is safer, and it is a real bug in at least one
comparable tool ([biomejs/biome#3608](https://github.com/biomejs/biome/issues/3608)).

## Configuration and Ignore Files

`oxfmt-quick` resolves nothing itself. oxfmt already reads
[`.oxfmtrc`](https://oxc.rs/docs/guide/usage/formatter), `.gitignore`, `.prettierignore`
and `.editorconfig`, searching up the file system as it goes — so there is no second
implementation here to drift out of step with it.

For the same reason there is no extension filter: oxfmt skips files it cannot format, so
the raw `git diff` list is handed straight over.

Gitignored files can never appear, because `git diff` reports only tracked files.

## API

```ts
import { oxfmtQuick } from 'oxfmt-quick'

const { success, errors } = oxfmtQuick(process.cwd(), {
  staged: true,
  onWriteFile: (file) => console.log(`formatted ${file}`),
})
```

`errors` contains any of `BAIL_ON_WRITE`, `CHECK_FAILED`, `FORMAT_FAILED`,
`PARTIALLY_STAGED_FILE` or `STAGE_FAILED`. Every callback is optional — the CLI is a thin
reporting layer over this one function.

## Notes

Changed files are collected with `git diff -z` and split on NUL, so paths containing
spaces, non-ASCII characters or newlines survive intact. `git add` is issued in batches of
100, so a large changeset cannot exceed the command-line length limit.

oxfmt is invoked by resolving its own `bin` script and running it with the current `node`,
rather than looking `oxfmt` up on `PATH` — on Windows that entry is a `.CMD` shim which
cannot be spawned without a shell, and a shell would reintroduce the quoting problems that
passing an argv array exists to avoid.

## Changelog

Every released version has its own notes in
[`release-notes/`](https://github.com/soroush-tech/oxfmt-quick/tree/main/release-notes) —
one file per version, and the publish workflow refuses to ship a version without them.

## Licence

[MIT](./LICENSE) — Powered by [Soroush.tech](https://soroush.tech)
