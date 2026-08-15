import { describe, expect, it, vi } from 'vitest'
import { findRepoRoot, getSinceRevision, getStagedFiles, stageFiles } from '../src/scm/git'
import type { CommandResult, Run } from '../src/types'

const responding = (result: Partial<CommandResult>) =>
  vi.fn(() => ({ stdout: '', stderr: '', status: 0, ...result })) as unknown as Run

describe('findRepoRoot', () => {
  it('asks git for the root, from the given directory', () => {
    const run = responding({ stdout: '/repo\n' })
    expect(findRepoRoot(run, '/repo/a/b')).toBe('/repo')
    expect(run).toHaveBeenCalledWith('git', ['rev-parse', '--show-toplevel'], '/repo/a/b')
  })

  it('returns null outside a repository, where git exits non-zero', () => {
    expect(findRepoRoot(responding({ status: 128 }), '/tmp')).toBeNull()
  })

  it('returns null when git prints nothing', () => {
    expect(findRepoRoot(responding({ stdout: '\n' }), '/tmp')).toBeNull()
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
