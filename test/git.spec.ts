import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { findRepoRoot, getSinceRevision, getStagedFiles, stageFiles } from '../src/scm/git'
import type { CommandResult, Run } from '../src/types'

const temp = mkdtempSync(join(tmpdir(), 'oxfmt-quick-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

const responding = (result: Partial<CommandResult>) =>
  vi.fn(() => ({ stdout: '', stderr: '', status: 0, ...result })) as unknown as Run

describe('findRepoRoot', () => {
  it('finds a .git directory from a nested path', () => {
    const root = join(temp, 'repo')
    const nested = join(root, 'a', 'b')
    mkdirSync(join(root, '.git'), { recursive: true })
    mkdirSync(nested, { recursive: true })
    expect(findRepoRoot(nested)).toBe(resolve(root))
  })

  it('accepts .git as a file, which is how worktrees and submodules store it', () => {
    const root = join(temp, 'worktree')
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, '.git'), 'gitdir: ../real/.git')
    expect(findRepoRoot(root)).toBe(resolve(root))
  })

  it('returns null at the filesystem root when nothing is found', () => {
    expect(findRepoRoot(parse(process.cwd()).root)).toBeNull()
  })
})

describe('getStagedFiles', () => {
  it('splits on NUL, so paths with spaces and newlines survive', () => {
    const run = responding({ stdout: 'with space.ts\0with\nnewline.ts\0' })
    expect(getStagedFiles(run, '/repo')).toEqual(['with space.ts', 'with\nnewline.ts'])
    expect(run).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMRTB', '-z', '--cached'],
      '/repo'
    )
  })

  it('returns nothing for empty output', () => {
    expect(getStagedFiles(responding({ stdout: '' }), '/repo')).toEqual([])
  })
})

describe('getSinceRevision', () => {
  it('returns the trimmed merge-base', () => {
    expect(getSinceRevision(responding({ stdout: 'deadbee\n' }), '/repo', 'main')).toBe('deadbee')
  })

  it('returns null when git exits non-zero', () => {
    expect(getSinceRevision(responding({ status: 1 }), '/repo', 'main')).toBeNull()
  })

  it('returns null when git prints nothing', () => {
    expect(getSinceRevision(responding({ stdout: '\n' }), '/repo', 'main')).toBeNull()
  })
})

describe('stageFiles', () => {
  it('batches at 100 paths per call, so long lists cannot exceed the command-line limit', () => {
    const calls: string[][] = []
    const run = vi.fn((_cmd: string, args: string[]) => {
      calls.push(args)
      return { stdout: '', stderr: '', status: 0 }
    }) as unknown as Run

    const files = Array.from({ length: 250 }, (_, i) => `f${i}.ts`)
    expect(stageFiles(run, '/repo', files)).toBe(true)

    expect(calls).toHaveLength(3)
    expect(calls[0].slice(0, 2)).toEqual(['add', '--'])
    expect(calls[0]).toHaveLength(102)
    expect(calls[1]).toHaveLength(102)
    expect(calls[2]).toHaveLength(52)
  })

  it('stops and reports false when a batch fails', () => {
    const run = responding({ status: 1 })
    expect(stageFiles(run, '/repo', ['a.ts'])).toBe(false)
  })

  it('does nothing for an empty list', () => {
    const run = responding({})
    expect(stageFiles(run, '/repo', [])).toBe(true)
    expect(run).not.toHaveBeenCalled()
  })
})
