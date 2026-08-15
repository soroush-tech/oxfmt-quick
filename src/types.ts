/** Why a run failed. Mirrors the shape `pretty-quick` reports, minus its Prettier-only cases. */
export type FailureReason =
  | 'BAIL_ON_WRITE'
  | 'CHECK_FAILED'
  | 'FORMAT_FAILED'
  | 'PARTIALLY_STAGED_FILE'
  | 'STAGE_FAILED'

export interface OxfmtQuickOptions {
  /**
   * Pre-commit mode: consider only files staged for commit, and re-stage them after
   * formatting. Default `false` — the same default `pretty-quick` has, where a bare run
   * covers everything changed since the merge-base.
   */
  staged: boolean
  /** Compare against this revision instead of the index. Implies `staged: false`. */
  since: string
  /** Branch to find the merge-base against when `staged` is false. Default `main`. */
  branch: string
  /** Report what would change without writing, and fail if anything is unformatted. */
  check: boolean
  /** Fail the run as soon as any file needs formatting. */
  bail: boolean
  /** Re-stage files after formatting them. Default `true`. */
  restage: boolean
  /** Print every file considered, not just the ones that changed. */
  verbose: boolean
  /** Path to an oxfmt config file, passed through as `--config`. */
  config: string

  onFoundSinceRevision: (revision: string | null) => void
  onFoundChangedFiles: (files: string[]) => void
  onExamineFile: (file: string) => void
  onCheckFile: (file: string, isFormatted: boolean) => void
  onWriteFile: (file: string) => void
  onPartiallyStagedFile: (file: string) => void
  onStageFiles: (files: string[]) => void
}

export interface OxfmtQuickResult {
  success: boolean
  errors: FailureReason[]
}

export interface CommandResult {
  stdout: string
  stderr: string
  /** Exit code. Non-zero is not an error here — `oxfmt --list-different` uses 1 to mean "found some". */
  status: number
}

/** Runs a command in `cwd`. Injected so tests never spawn a process. */
export type Run = (command: string, args: string[], cwd: string) => CommandResult
