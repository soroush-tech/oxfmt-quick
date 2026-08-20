import { batchFiles } from './batch'
import type { CommandResult, Run } from './types'

/** `command` is the argv prefix from `resolveOxfmt` - usually `[node, .../oxfmt/bin/oxfmt]`. */
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
 * The file list split to fit one command line per call, after costing everything the
 * invocation already spends: command, config and flags. A changed-file list can run to
 * thousands of paths, which is more than Windows lets one spawn carry.
 */
const batches = (
  command: string[],
  config: string | undefined,
  flags: string[],
  files: string[]
): string[][] => {
  const fixed = [...command, ...(config ? ['--config', config] : []), ...flags]
  const reserved = fixed.reduce((sum, arg) => sum + arg.length + 3, 0)
  return batchFiles(files, reserved)
}

/**
 * Which of `files` oxfmt would rewrite.
 *
 * `--list-different` exits **1** when it finds anything, which is a report rather than a
 * failure - so the status is deliberately ignored and stdout is read either way.
 *
 * Batching here is why the tool stays fast. `pretty-quick` reads, formats and compares
 * each file itself in Node; oxfmt answers for a whole batch in one Rust process, applying
 * its own config resolution and ignore rules as it goes - so there is no `.oxfmtrc` lookup
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
  return batches(command, config, ['--list-different'], files).flatMap((batch) =>
    invoke(run, command, root, ['--list-different', ...batch], config)
      .stdout.split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  )
}

/**
 * Format in place. Returns false if oxfmt reported a failure, stopping at the failing
 * batch - the same stop-and-report `stageFiles` does.
 */
export const format = (
  run: Run,
  command: string[],
  root: string,
  files: string[],
  config?: string
): boolean => {
  if (files.length === 0) return true
  return batches(command, config, [], files).every(
    (batch) => invoke(run, command, root, batch, config).status === 0
  )
}
