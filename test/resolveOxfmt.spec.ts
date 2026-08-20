import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { resolveOxfmt } from '../src/resolveOxfmt'

describe('resolveOxfmt', () => {
  it('resolves oxfmt to a node invocation of its own bin script', () => {
    // This repo has oxfmt installed, so resolution from here must succeed.
    const command = resolveOxfmt(process.cwd())
    expect(command[0]).toBe(process.execPath)
    expect(command[1]).toMatch(/oxfmt[\\/]bin[\\/]oxfmt$/)
  })

  it('falls back to a bare PATH lookup where oxfmt is not installed', () => {
    // A directory with no reachable node_modules - resolution must fail, not throw.
    expect(resolveOxfmt('/')).toEqual(['oxfmt'])
  })
})

describe('resolveOxfmt with a string bin field', () => {
  // realpath, because on macOS os.tmpdir() is `/var/...` while Node's resolver returns the
  // canonical `/private/var/...` - comparing the two forms fails there and nowhere else.
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'oxfmt-quick-resolve-')))
  afterAll(() => rmSync(temp, { recursive: true, force: true }))

  it('accepts `bin` declared as a plain string rather than a map', () => {
    const pkg = join(temp, 'node_modules', 'oxfmt')
    mkdirSync(pkg, { recursive: true })
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'oxfmt', bin: 'bin/run.js' }))

    const command = resolveOxfmt(temp)
    expect(command[0]).toBe(process.execPath)
    expect(command[1]).toBe(join(pkg, 'bin', 'run.js'))
  })
})
