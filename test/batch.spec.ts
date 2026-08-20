import { describe, expect, it } from 'vitest'
import { batchFiles } from '../src/batch'

// The budget is 30k minus `reserved`; each path costs its length plus three. Reserving
// all but a sliver keeps the arithmetic in these tests small enough to do by eye.
const reserving = (budget: number) => 30_000 - budget

describe('batchFiles', () => {
  it('returns nothing for an empty list', () => {
    expect(batchFiles([], 0)).toEqual([])
  })

  it('keeps a list that fits in a single batch, in order', () => {
    expect(batchFiles(['a.ts', 'b.ts', 'c.ts'], 0)).toEqual([['a.ts', 'b.ts', 'c.ts']])
  })

  it('starts a new batch when the next path would overrun the budget', () => {
    // Each path costs 7 + 3 = 10; a budget of 20 holds exactly two.
    const files = ['aaaa.ts', 'bbbb.ts', 'cccc.ts', 'dddd.ts', 'eeee.ts']
    expect(batchFiles(files, reserving(20))).toEqual([
      ['aaaa.ts', 'bbbb.ts'],
      ['cccc.ts', 'dddd.ts'],
      ['eeee.ts'],
    ])
  })

  it('spends the reserved length before any file', () => {
    // The same two-per-batch budget, eaten into by one more reserved character.
    const files = ['aaaa.ts', 'bbbb.ts', 'cccc.ts']
    expect(batchFiles(files, reserving(19))).toEqual([['aaaa.ts'], ['bbbb.ts'], ['cccc.ts']])
  })

  it('gives a path dearer than the whole budget a batch of its own', () => {
    const huge = 'x'.repeat(50)
    expect(batchFiles(['a.ts', huge, 'b.ts'], reserving(20))).toEqual([['a.ts'], [huge], ['b.ts']])
  })

  it('splits a realistic long list under the real limit', () => {
    // 2416 files of CI-sized paths, the shape of the report that motivated this module.
    const files = Array.from(
      { length: 2416 },
      (_, i) => `D:/Builds/agent/_work/src/deep/nested/module/file-${i}.ts`
    )
    const batches = batchFiles(files, 200)
    expect(batches.length).toBeGreaterThan(1)
    expect(batches.flat()).toEqual(files)
    for (const batch of batches) {
      const spent = batch.reduce((sum, file) => sum + file.length + 3, 0)
      expect(spent).toBeLessThanOrEqual(30_000 - 200)
    }
  })
})
