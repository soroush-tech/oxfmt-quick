import { describe, expect, it, vi } from 'vitest'
import { format, listDifferent } from '../src/oxfmt'
import type { Run } from '../src/types'

const run = (stdout = '', status = 0) =>
  vi.fn(() => ({ stdout, stderr: '', status })) as unknown as Run

describe('listDifferent', () => {
  it('does not invoke oxfmt for an empty file list', () => {
    const spy = run()
    expect(listDifferent(spy, ['oxfmt'], '/repo', [])).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('reads stdout even though a non-empty list makes oxfmt exit 1', () => {
    const spy = run('a.ts\n  b.ts  \n\n', 1)
    expect(listDifferent(spy, ['oxfmt'], '/repo', ['a.ts', 'b.ts'])).toEqual(['a.ts', 'b.ts'])
  })

  it('prefixes --config when given, and omits it when not', () => {
    const withCfg = run()
    listDifferent(withCfg, ['oxfmt'], '/repo', ['a.ts'], 'cfg.json')
    expect(withCfg).toHaveBeenCalledWith(
      'oxfmt',
      ['--config', 'cfg.json', '--list-different', 'a.ts'],
      '/repo'
    )

    const without = run()
    listDifferent(without, ['oxfmt'], '/repo', ['a.ts'])
    expect(without).toHaveBeenCalledWith('oxfmt', ['--list-different', 'a.ts'], '/repo')
  })

  it('splits a multi-token command into executable and leading args', () => {
    const spy = run()
    listDifferent(spy, ['node', '/bin/oxfmt'], '/repo', ['a.ts'])
    expect(spy).toHaveBeenCalledWith('node', ['/bin/oxfmt', '--list-different', 'a.ts'], '/repo')
  })
})

describe('format', () => {
  it('does not invoke oxfmt for an empty file list', () => {
    const spy = run()
    expect(format(spy, ['oxfmt'], '/repo', [])).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('passes the files, with --config when given', () => {
    const spy = run()
    expect(format(spy, ['oxfmt'], '/repo', ['a.ts'], 'cfg.json')).toBe(true)
    expect(spy).toHaveBeenCalledWith('oxfmt', ['--config', 'cfg.json', 'a.ts'], '/repo')
  })

  it('passes the files bare when no config is given', () => {
    const spy = run()
    format(spy, ['oxfmt'], '/repo', ['a.ts'])
    expect(spy).toHaveBeenCalledWith('oxfmt', ['a.ts'], '/repo')
  })

  it('reports failure when oxfmt exits non-zero', () => {
    expect(format(run('', 1), ['oxfmt'], '/repo', ['a.ts'])).toBe(false)
  })
})
