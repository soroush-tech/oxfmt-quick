import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Run } from '../types'

/**
 * Walk up looking for `.git`. It is a *file* rather than a directory inside a worktree
 * or submodule, so both count.
 */
export const findRepoRoot = (from: string): string | null => {
  let directory = resolve(from)
  for (;;) {
    if (existsSync(resolve(directory, '.git'))) return directory
    const parent = dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}

/**
 * `-z` and a NUL split, not newline: with the default `core.quotepath`, git wraps paths
 * containing non-ASCII or unusual characters in quotes and escapes them when printing
 * newline-separated. Splitting on `\n` corrupts those paths — and a filename may legally
 * contain a newline. `-z` sidesteps both.
 */
const paths = (run: Run, root: string, args: string[]): string[] => {
  const { stdout } = run('git', args, root)
  return stdout.split('\0').filter(Boolean)
}

// T = type changed, B = broken pairing. D is excluded: a deleted file has nothing to format.
const DIFF_FILTER = '--diff-filter=ACMRTB'

export const getStagedFiles = (run: Run, root: string): string[] =>
  paths(run, root, ['diff', '--name-only', DIFF_FILTER, '-z', '--cached'])

export const getUnstagedFiles = (run: Run, root: string): string[] =>
  paths(run, root, ['diff', '--name-only', DIFF_FILTER, '-z'])

/** Untracked-but-not-ignored files. `--exclude-standard` is what applies .gitignore. */
export const getUntrackedFiles = (run: Run, root: string): string[] =>
  paths(run, root, ['ls-files', '--others', '--exclude-standard', '-z'])

/** The merge-base with `branch`, so a branch that is behind does not drag in unrelated files. */
export const getSinceRevision = (run: Run, root: string, branch: string): string | null => {
  const { stdout, status } = run('git', ['merge-base', 'HEAD', branch], root)
  return status === 0 ? stdout.trim() || null : null
}

export const getFilesSince = (run: Run, root: string, revision: string): string[] =>
  paths(run, root, ['diff', '--name-only', DIFF_FILTER, '-z', revision])

/**
 * Stage in batches, and report whether every batch landed.
 *
 * A single `git add` with thousands of paths blows past the command-line length limit,
 * which is far lower on Windows (~32k) than on Unix.
 */
export const stageFiles = (run: Run, root: string, files: string[]): boolean => {
  const BATCH = 100
  for (let index = 0; index < files.length; index += BATCH) {
    const { status } = run('git', ['add', '--', ...files.slice(index, index + BATCH)], root)
    if (status !== 0) return false
  }
  return true
}
