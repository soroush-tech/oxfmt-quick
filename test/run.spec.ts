import { describe, expect, it } from 'vitest'
import { run, toResult } from '../src/run'

// Exercises the real spawn. `node` is by definition present.
describe('run', () => {
  it('returns stdout and a zero status', () => {
    const result = run(process.execPath, ['-e', 'process.stdout.write("ok")'], process.cwd())
    expect(result).toMatchObject({ stdout: 'ok', status: 0 })
  })

  it('returns a non-zero status rather than throwing — oxfmt uses exit 1 to report findings', () => {
    const result = run(
      process.execPath,
      ['-e', 'process.stdout.write("found"); process.exit(1)'],
      process.cwd()
    )
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('found')
  })

  it('captures stderr', () => {
    const result = run(process.execPath, ['-e', 'process.stderr.write("bad")'], process.cwd())
    expect(result.stderr).toBe('bad')
  })

  it('runs in the given directory', () => {
    expect(
      run(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], __dirname).stdout
    ).toBe(__dirname)
  })

  it('throws when the binary does not exist, which is a real failure', () => {
    expect(() => run('definitely-not-a-real-binary-xyz', [], process.cwd())).toThrow()
  })
})

describe('toResult', () => {
  it('passes through a normal exit', () => {
    expect(toResult({ stdout: 'a', stderr: 'b', status: 0 } as never)).toEqual({
      stdout: 'a',
      stderr: 'b',
      status: 0,
    })
  })

  it('treats a signal kill (null status, null streams) as a failure', () => {
    expect(toResult({ stdout: null, stderr: null, status: null } as never)).toEqual({
      stdout: '',
      stderr: '',
      status: 1,
    })
  })
})
