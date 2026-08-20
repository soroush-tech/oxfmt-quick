import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspect } from 'node:util'

interface Manifest {
  version?: string
  bugs?: { url?: string }
}

/** The manifest is metadata for a crash report; failing to read it must not add a crash. */
export const readManifest = (url: URL): Manifest => {
  try {
    return JSON.parse(readFileSync(url, 'utf8')) as Manifest
  } catch {
    return {}
  }
}

/**
 * An error report a user can attach to an issue as-is: what ran, where, on what, and the
 * whole error. `inspect` keeps an `Error`'s extra properties (`code`, `syscall`) that
 * `stack` alone drops, while the array cap stops a spawn error from dumping every one of
 * the thousands of paths it carried.
 */
export const renderReport = (error: unknown, manifest: Manifest, now = new Date()): string =>
  [
    `oxfmt-quick error report - attach this file to an issue: ${manifest.bugs?.url ?? ''}`,
    `time: ${now.toISOString()}`,
    `oxfmt-quick: ${manifest.version ?? 'unknown'}`,
    `node: ${process.version} on ${process.platform} ${process.arch}`,
    `command: oxfmt-quick ${process.argv.slice(2).join(' ')}`,
    `cwd: ${process.cwd()}`,
    '',
    inspect(error, { depth: 4, maxArrayLength: 20 }),
    '',
  ].join('\n')

/**
 * Write the report and return its path, or null when even that write fails: reporting on
 * the crash should not crash. The temp directory rather than the repository, so the log
 * can never end up staged in the very commit that failed.
 */
export const writeErrorReport = (
  error: unknown,
  manifestUrl: URL,
  directory = tmpdir()
): string | null => {
  try {
    const path = join(directory, 'oxfmt-quick-error.log')
    writeFileSync(path, renderReport(error, readManifest(manifestUrl)))
    return path
  } catch {
    return null
  }
}
