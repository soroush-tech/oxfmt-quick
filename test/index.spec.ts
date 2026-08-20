import { describe, expect, it, vi } from 'vitest'
import { oxfmtQuick } from '../src/index'
import type { CommandResult, Run } from '../src/types'

const NUL = (...paths: string[]) => paths.map((p) => p + '\0').join('')
const ok = (stdout = ''): CommandResult => ({ stdout, stderr: '', status: 0 })
const fail = (): CommandResult => ({ stdout: '', stderr: 'boom', status: 1 })

const HERE = process.cwd()
// Pin the oxfmt invocation so tests never resolve or spawn a real binary.
const OXFMT = ['oxfmt']

/** A fake git + oxfmt, keyed on the argv it is handed. */
const fakeRun = (responses: {
  staged?: string[]
  unstaged?: string[]
  untracked?: string[]
  since?: string[]
  mergeBase?: string | false
  listDifferent?: string[]
  onStage?: (files: string[]) => void
  stageFails?: boolean
  formatFails?: boolean
}): Run =>
  vi.fn(((command: string, args: string[]) => {
    if (command !== 'git') {
      if (args.includes('--list-different')) {
        const found = responses.listDifferent ?? []
        // oxfmt exits 1 when it finds anything - that is a report, not a failure.
        return { stdout: found.join('\n'), stderr: '', status: found.length > 0 ? 1 : 0 }
      }
      return responses.formatFails ? fail() : ok()
    }

    const [subcommand] = args
    // Every run starts by asking git where the repository root is.
    if (subcommand === 'rev-parse') return ok('/repo\n')
    if (subcommand === 'merge-base') {
      return responses.mergeBase === false ? fail() : ok(`${responses.mergeBase ?? 'abc1234'}\n`)
    }
    if (subcommand === 'ls-files') return ok(NUL(...(responses.untracked ?? [])))
    if (subcommand === 'add') {
      if (responses.stageFails) return fail()
      responses.onStage?.(args.slice(2))
      return ok()
    }
    if (subcommand === 'diff') {
      if (args.includes('--cached')) return ok(NUL(...(responses.staged ?? [])))
      // A trailing token that is not a flag is the revision being diffed against.
      const hasRevision = !args.at(-1)!.startsWith('-')
      return ok(NUL(...(hasRevision ? (responses.since ?? []) : (responses.unstaged ?? []))))
    }
    return ok()
  }) as Run) as unknown as Run

describe('oxfmtQuick', () => {
  it('succeeds without calling oxfmt when nothing is staged', () => {
    const run = fakeRun({ staged: [] })
    const onFoundChangedFiles = vi.fn()
    expect(
      oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, onFoundChangedFiles })
    ).toEqual({
      success: true,
      errors: [],
    })
    expect(onFoundChangedFiles).toHaveBeenCalledWith([])
  })

  it('succeeds without writing when every staged file is already formatted', () => {
    const run = fakeRun({ staged: ['a.ts'], listDifferent: [] })
    const onWriteFile = vi.fn()
    expect(oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, onWriteFile })).toEqual({
      success: true,
      errors: [],
    })
    expect(onWriteFile).not.toHaveBeenCalled()
  })

  it('reads the file list from --list-different even though it exits non-zero', () => {
    const run = fakeRun({ staged: ['a.ts'], unstaged: [], listDifferent: ['a.ts'] })
    const onWriteFile = vi.fn()
    expect(oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, onWriteFile }).success).toBe(
      true
    )
    expect(onWriteFile).toHaveBeenCalledWith('a.ts')
  })

  it('formats and re-stages a fully staged file', () => {
    const staged: string[][] = []
    const run = fakeRun({
      staged: ['a.ts', 'b.ts'],
      unstaged: [],
      listDifferent: ['a.ts'],
      onStage: (files) => staged.push(files),
    })
    const onStageFiles = vi.fn()

    expect(oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, onStageFiles })).toEqual({
      success: true,
      errors: [],
    })
    expect(onStageFiles).toHaveBeenCalledWith(['a.ts'])
    expect(staged).toEqual([['a.ts']])
  })

  it('formats a partially staged file but refuses to re-stage it', () => {
    const staged: string[][] = []
    const run = fakeRun({
      staged: ['a.ts'],
      unstaged: ['a.ts'],
      listDifferent: ['a.ts'],
      onStage: (files) => staged.push(files),
    })
    const onPartiallyStagedFile = vi.fn()

    expect(
      oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, onPartiallyStagedFile })
    ).toEqual({
      success: false,
      errors: ['PARTIALLY_STAGED_FILE'],
    })
    expect(onPartiallyStagedFile).toHaveBeenCalledWith('a.ts')
    expect(staged).toEqual([])
  })

  it('reports CHECK_FAILED without writing or staging', () => {
    const run = fakeRun({ staged: ['a.ts'], listDifferent: ['a.ts'] })
    const onCheckFile = vi.fn()
    const onWriteFile = vi.fn()

    expect(
      oxfmtQuick(HERE, {
        oxfmtCommand: OXFMT,
        staged: true,
        run,
        check: true,
        onCheckFile,
        onWriteFile,
      })
    ).toEqual({ success: false, errors: ['CHECK_FAILED'] })
    expect(onCheckFile).toHaveBeenCalledWith('a.ts', false)
    expect(onWriteFile).not.toHaveBeenCalled()
  })

  it('passes check when nothing is unformatted', () => {
    const run = fakeRun({ staged: ['a.ts'], listDifferent: [] })
    const onCheckFile = vi.fn()
    expect(
      oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, check: true, onCheckFile })
    ).toEqual({
      success: true,
      errors: [],
    })
    expect(onCheckFile).toHaveBeenCalledWith('a.ts', true)
  })

  it('reports BAIL_ON_WRITE but still formats', () => {
    const run = fakeRun({ staged: ['a.ts'], unstaged: [], listDifferent: ['a.ts'] })
    const result = oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, bail: true })
    expect(result.success).toBe(false)
    expect(result.errors).toContain('BAIL_ON_WRITE')
  })

  it('reports FORMAT_FAILED and stages nothing when oxfmt errors', () => {
    const staged: string[][] = []
    const run = fakeRun({
      staged: ['a.ts'],
      unstaged: [],
      listDifferent: ['a.ts'],
      formatFails: true,
      onStage: (files) => staged.push(files),
    })
    expect(oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run })).toEqual({
      success: false,
      errors: ['FORMAT_FAILED'],
    })
    expect(staged).toEqual([])
  })

  it('skips re-staging entirely with restage: false', () => {
    const staged: string[][] = []
    const run = fakeRun({
      staged: ['a.ts'],
      unstaged: ['a.ts'],
      listDifferent: ['a.ts'],
      onStage: (files) => staged.push(files),
    })
    expect(oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, restage: false })).toEqual({
      success: true,
      errors: [],
    })
    expect(staged).toEqual([])
  })

  it('reports STAGE_FAILED when git add exits non-zero', () => {
    const run = fakeRun({
      staged: ['a.ts'],
      unstaged: [],
      listDifferent: ['a.ts'],
      stageFails: true,
    })
    expect(oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run })).toEqual({
      success: false,
      errors: ['STAGE_FAILED'],
    })
  })

  it('uses the merge-base and untracked files when not staged', () => {
    const run = fakeRun({
      since: ['a.ts'],
      untracked: ['new.ts'],
      mergeBase: 'deadbee',
      listDifferent: [],
    })
    const onFoundSinceRevision = vi.fn()
    const onFoundChangedFiles = vi.fn()

    oxfmtQuick(HERE, {
      oxfmtCommand: OXFMT,
      run,
      staged: false,
      onFoundSinceRevision,
      onFoundChangedFiles,
    })

    expect(onFoundSinceRevision).toHaveBeenCalledWith('deadbee')
    expect(onFoundChangedFiles).toHaveBeenCalledWith(['a.ts', 'new.ts'])
  })

  it('falls back to untracked files when there is no merge-base', () => {
    const run = fakeRun({ untracked: ['new.ts'], mergeBase: false, listDifferent: [] })
    const onFoundSinceRevision = vi.fn()
    oxfmtQuick(HERE, { oxfmtCommand: OXFMT, run, staged: false, onFoundSinceRevision })
    expect(onFoundSinceRevision).toHaveBeenCalledWith(null)
  })

  it('honours an explicit --since revision', () => {
    const run = fakeRun({ since: ['a.ts'], untracked: [], listDifferent: [] })
    const onFoundSinceRevision = vi.fn()
    oxfmtQuick(HERE, { oxfmtCommand: OXFMT, run, since: 'v1.0.0', onFoundSinceRevision })
    expect(onFoundSinceRevision).toHaveBeenCalledWith('v1.0.0')
  })

  it('de-duplicates a path reported by two git queries', () => {
    const run = fakeRun({
      since: ['a.ts'],
      untracked: ['a.ts'],
      mergeBase: 'abc',
      listDifferent: [],
    })
    const onFoundChangedFiles = vi.fn()
    oxfmtQuick(HERE, { oxfmtCommand: OXFMT, run, staged: false, onFoundChangedFiles })
    expect(onFoundChangedFiles).toHaveBeenCalledWith(['a.ts'])
  })

  it('emits onExamineFile per file only when verbose', () => {
    const onExamineFile = vi.fn()
    oxfmtQuick(HERE, {
      oxfmtCommand: OXFMT,
      staged: true,
      run: fakeRun({ staged: ['a.ts'], listDifferent: [] }),
      onExamineFile,
    })
    expect(onExamineFile).not.toHaveBeenCalled()

    oxfmtQuick(HERE, {
      oxfmtCommand: OXFMT,
      staged: true,
      run: fakeRun({ staged: ['a.ts'], listDifferent: [] }),
      verbose: true,
      onExamineFile,
    })
    expect(onExamineFile).toHaveBeenCalledWith('a.ts')
  })

  it('passes --config through to oxfmt', () => {
    const run = fakeRun({ staged: ['a.ts'], listDifferent: [] })
    oxfmtQuick(HERE, { oxfmtCommand: OXFMT, staged: true, run, config: 'custom.json' })
    expect(run).toHaveBeenCalledWith(
      'oxfmt',
      expect.arrayContaining(['--config', 'custom.json']),
      expect.any(String)
    )
  })

  it('throws outside a git repository, where rev-parse exits non-zero', () => {
    const run = (() => fail()) as unknown as Run
    expect(() => oxfmtQuick('/', { oxfmtCommand: OXFMT, staged: true, run })).toThrow(
      /not inside a git repository/
    )
  })

  it('resolves the oxfmt command itself when none is supplied', () => {
    const seen: string[] = []
    const run = ((command: string, args: string[]) => {
      seen.push(command)
      if (args[0] === 'rev-parse') return ok(`${HERE}\n`)
      return ok(args.includes('--cached') ? 'a.ts\0' : '')
    }) as unknown as Run

    expect(oxfmtQuick(HERE, { staged: true, run })).toEqual({ success: true, errors: [] })
    expect(seen).toContain('git')
    expect(seen).toContain(process.execPath)
  })

  // The default is the behaviour a bare `oxfmt-quick` gets, so it is pinned explicitly:
  // flipping it back would otherwise only show up as a surprise in someone's hook.
  it('defaults to changed-since-merge-base, not the index', () => {
    const asked: string[][] = []
    const run = vi.fn(((_command: string, args: string[]) => {
      asked.push(args)
      if (args[0] === 'rev-parse') return ok('/repo\n')
      if (args[0] === 'merge-base') return ok('abc1234\n')
      return ok()
    }) as Run) as unknown as Run

    oxfmtQuick(HERE, { oxfmtCommand: OXFMT, run })

    expect(asked.some(([subcommand]) => subcommand === 'merge-base')).toBe(true)
    expect(asked.some((args) => args.includes('--cached'))).toBe(false)
  })
})
