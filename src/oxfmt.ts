import type { CommandResult, Run } from './types'

/** `command` is the argv prefix from `resolveOxfmt` — usually `[node, .../oxfmt/bin/oxfmt]`. */
const invoke = (
  run: Run,
  command: string[],
  root: string,
  args: string[],
  config?: string
): CommandResult => {
  const [executable, ...leading] = command
  const configArgs = config ? ['--config', config] : []
  return run(executable, [...leading, ...configArgs, ...args], root)
}

/**
 * Which of `files` oxfmt would rewrite.
 *
 * `--list-different` exits **1** when it finds anything, which is a report rather than a
 * failure — so the status is deliberately ignored and stdout is read either way.
 *
 * Batching here is why the tool stays fast. `pretty-quick` reads, formats and compares
 * each file itself in Node; oxfmt answers for the whole set in one Rust process, applying
 * its own config resolution and ignore rules as it goes — so there is no `.oxfmtrc` lookup
 * or `.gitignore` matching to reimplement.
 *
 * Files oxfmt does not handle (images, lockfiles) it skips itself, so callers can pass a
 * raw `git diff` list without filtering by extension.
 */
export const listDifferent = (
  run: Run,
  command: string[],
  root: string,
  files: string[],
  config?: string
): string[] => {
  if (files.length === 0) return []
  return invoke(run, command, root, ['--list-different', ...files], config)
    .stdout.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Format in place. Returns false if oxfmt reported a failure. */
export const format = (
  run: Run,
  command: string[],
  root: string,
  files: string[],
  config?: string
): boolean => {
  if (files.length === 0) return true
  return invoke(run, command, root, files, config).status === 0
}
