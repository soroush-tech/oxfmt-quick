import * as git from './scm/git'
import * as oxfmt from './oxfmt'
import { resolveOxfmt } from './resolveOxfmt'
import { run as defaultRun } from './run'
import type { FailureReason, OxfmtQuickOptions, OxfmtQuickResult, Run } from './types'

export type { FailureReason, OxfmtQuickOptions, OxfmtQuickResult, Run } from './types'

/**
 * Format your changed files.
 *
 * By default that means everything changed since the merge-base with `branch`, plus
 * untracked files — the same default `pretty-quick` has, so the two behave alike.
 *
 * With `staged`, only the index is consulted and the formatted files are re-staged: that
 * is the pre-commit mode, where anything unstaged is not going into the commit and
 * formatting it would be work the commit never uses.
 *
 * In that mode a file that is staged *and* edited further is formatted but deliberately
 * **not** re-staged — `git add`ing it would sweep those unstaged edits into the commit
 * and silently widen it. The run reports `PARTIALLY_STAGED_FILE` so the hook fails and
 * you decide what to stage.
 */
export const oxfmtQuick = (
  directory: string,
  options: Partial<OxfmtQuickOptions> & { run?: Run; oxfmtCommand?: string[] } = {}
): OxfmtQuickResult => {
  const {
    staged = false,
    since,
    branch = 'main',
    check = false,
    bail = false,
    restage = true,
    verbose = false,
    config,
    run = defaultRun,
    oxfmtCommand,
    onFoundSinceRevision,
    onFoundChangedFiles,
    onExamineFile,
    onCheckFile,
    onWriteFile,
    onPartiallyStagedFile,
    onStageFiles,
  } = options

  const root = git.findRepoRoot(run, directory)
  if (!root) throw new Error('oxfmt-quick: not inside a git repository.')

  const command = oxfmtCommand ?? resolveOxfmt(root)

  const useIndex = staged && !since
  let changed: string[]

  if (useIndex) {
    changed = git.getStagedFiles(run, root)
  } else {
    const revision = since ?? git.getSinceRevision(run, root, branch)
    onFoundSinceRevision?.(revision)
    changed = revision
      ? [...git.getFilesSince(run, root, revision), ...git.getUntrackedFiles(run, root)]
      : git.getUntrackedFiles(run, root)
  }

  // A path can arrive twice — renamed and untracked lists can overlap.
  changed = [...new Set(changed)]
  onFoundChangedFiles?.(changed)
  if (verbose) changed.forEach((file) => onExamineFile?.(file))
  if (changed.length === 0) return { success: true, errors: [] }

  const errors = new Set<FailureReason>()
  const unformatted = oxfmt.listDifferent(run, command, root, changed, config)

  if (check) {
    changed.forEach((file) => onCheckFile?.(file, !unformatted.includes(file)))
    if (unformatted.length > 0) errors.add('CHECK_FAILED')
    return { success: errors.size === 0, errors: [...errors] }
  }

  if (unformatted.length === 0) return { success: true, errors: [] }
  if (bail) errors.add('BAIL_ON_WRITE')

  // Snapshot which files already differed from the index *before* writing. Formatting a
  // fully-staged file makes the worktree differ from its index entry too, so asking git
  // afterwards would report every file as drifted and nothing would ever be re-staged.
  const drifted = useIndex && restage ? new Set(git.getUnstagedFiles(run, root)) : new Set<string>()

  if (!oxfmt.format(run, command, root, unformatted, config)) {
    errors.add('FORMAT_FAILED')
    return { success: false, errors: [...errors] }
  }
  unformatted.forEach((file) => onWriteFile?.(file))

  if (useIndex && restage) {
    const toStage = unformatted.filter((file) => !drifted.has(file))
    unformatted
      .filter((file) => drifted.has(file))
      .forEach((file) => {
        onPartiallyStagedFile?.(file)
        errors.add('PARTIALLY_STAGED_FILE')
      })

    if (toStage.length > 0) {
      onStageFiles?.(toStage)
      if (!git.stageFiles(run, root, toStage)) errors.add('STAGE_FAILED')
    }
  }

  return { success: errors.size === 0, errors: [...errors] }
}

export default oxfmtQuick
