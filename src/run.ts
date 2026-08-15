import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import type { CommandResult, Run } from './types'

/**
 * Normalise a `spawnSync` return. `status` is `null` when the process was killed by a
 * signal rather than exiting, which is a failure — hence 1 rather than 0.
 */
export const toResult = (result: SpawnSyncReturns<string>): CommandResult => ({
  stdout: result.stdout ?? '',
  stderr: result.stderr ?? '',
  status: result.status ?? 1,
})

/**
 * `spawnSync` rather than `execFileSync`: a non-zero exit is information here, not a
 * failure. `oxfmt --list-different` exits 1 *because* it found files to report, and
 * `execFileSync` would throw that away as an exception. Only a genuine spawn failure —
 * a missing binary — is thrown.
 *
 * No shell: every argument is a path that may contain spaces, quotes or glob characters,
 * and passing an argv array means there are no quoting rules to get wrong.
 */
export const run: Run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  return toResult(result)
}
