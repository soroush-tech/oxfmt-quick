import type { Run } from '../types'

/**
 * The repository root, or `null` outside one.
 *
 * Asked of git rather than found by walking up looking for `.git`. Git already knows the
 * answer and knows it better: it honours `GIT_DIR` and `GIT_WORK_TREE`, resolves worktrees
 * and submodules - where `.git` is a file, not a directory - and returns a canonical path.
 * A hand-rolled walk only approximates all of that.
 *
 * It also means this module touches no filesystem API at all; every question about the
 * repository goes through git.
 */
export const findRepoRoot = (run: Run, from: string): string | null => {
  const { stdout, status } = run('git', ['rev-parse', '--show-toplevel'], from)
  return status === 0 ? stdout.trim() || null : null
}

/**
 * `-z` and a NUL split, not newline: with the default `core.quotepath`, git wraps paths
 * containing non-ASCII or unusual characters in quotes and escapes them when printing
 * newline-separated. Splitting on `\n` corrupts those paths - and a filename may legally
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
