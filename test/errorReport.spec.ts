import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readManifest, renderReport, writeErrorReport } from '../src/errorReport'

const temp = mkdtempSync(join(tmpdir(), 'oxfmt-quick-report-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

const manifestUrl = new URL('../package.json', import.meta.url)

describe('readManifest', () => {
  it('reads this repository manifest', () => {
    const manifest = readManifest(manifestUrl)
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(manifest.bugs?.url).toContain('github.com')
  })

  it('returns an empty manifest rather than throwing when the file is unreadable', () => {
    expect(readManifest(new URL('file:///nowhere/package.json'))).toEqual({})
  })
})

describe('renderReport', () => {
  it('records what ran, where, and on what', () => {
    const now = new Date('2026-08-20T00:00:00Z')
    const report = renderReport(new Error('boom'), { version: '9.9.9' }, now)
    expect(report).toContain('time: 2026-08-20T00:00:00.000Z')
    expect(report).toContain('oxfmt-quick: 9.9.9')
    expect(report).toContain(`node: ${process.version} on ${process.platform} ${process.arch}`)
    expect(report).toContain(`cwd: ${process.cwd()}`)
    expect(report).toContain('command: oxfmt-quick ')
    expect(report).toContain('Error: boom')
  })

  it('keeps the error properties a bare stack drops', () => {
    const error = Object.assign(new Error('spawnSync node ENAMETOOLONG'), {
      code: 'ENAMETOOLONG',
      syscall: 'spawnSync node',
    })
    const report = renderReport(error, {})
    expect(report).toContain("code: 'ENAMETOOLONG'")
    expect(report).toContain("syscall: 'spawnSync node'")
  })

  it('caps arrays, so a spawn error does not dump thousands of paths', () => {
    const error = Object.assign(new Error('too long'), {
      spawnargs: Array.from({ length: 2416 }, (_, i) => `file-${i}.ts`),
    })
    const report = renderReport(error, {})
    expect(report).toContain('file-19.ts')
    expect(report).not.toContain('file-20.ts')
    expect(report).toContain('2396 more items')
  })

  it('renders a non-Error throw and an empty manifest without pretending', () => {
    const report = renderReport('just a string', {})
    expect(report).toContain("'just a string'")
    expect(report).toContain('oxfmt-quick: unknown')
    expect(report).toContain('attach this file to an issue: \n')
  })
})

describe('writeErrorReport', () => {
  it('writes the report and returns its path', () => {
    const path = writeErrorReport(new Error('boom'), manifestUrl, temp)
    expect(path).toBe(join(temp, 'oxfmt-quick-error.log'))
    const written = readFileSync(path as string, 'utf8')
    expect(written).toContain('Error: boom')
    expect(written).toContain('attach this file to an issue: https://github.com')
  })

  it('defaults to the temp directory, away from anything a commit could stage', () => {
    const path = writeErrorReport(new Error('boom'), manifestUrl)
    expect(path).toBe(join(tmpdir(), 'oxfmt-quick-error.log'))
  })

  it('returns null rather than crashing the crash handler when the write fails', () => {
    // A file where the directory should be makes the write fail on every platform.
    const blocked = join(temp, 'not-a-directory')
    writeFileSync(blocked, '')
    expect(writeErrorReport(new Error('boom'), manifestUrl, blocked)).toBeNull()
  })
})
