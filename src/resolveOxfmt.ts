import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/**
 * How to invoke oxfmt, as an argv prefix.
 *
 * Resolving oxfmt's own `bin` script and running it with the current `node` beats calling
 * `oxfmt` off the PATH: on Windows the PATH entry is a `.CMD` shim, which `execFileSync`
 * cannot execute without a shell - and reaching for a shell would reintroduce the quoting
 * problems that passing an argv array exists to avoid.
 *
 * Resolution starts from the directory being formatted, not from this package, because
 * oxfmt is a peer dependency: the copy that matters is the consumer's.
 */
export const resolveOxfmt = (from: string): string[] => {
  try {
    const require = createRequire(join(from, 'oxfmt-quick.resolve'))
    const manifestPath = require.resolve('oxfmt/package.json')
    const { bin } = require('oxfmt/package.json') as { bin?: string | Record<string, string> }
    const entry = typeof bin === 'string' ? bin : bin?.oxfmt
    if (entry) return [process.execPath, join(dirname(manifestPath), entry)]
  } catch {
    // Not resolvable from the target project - fall through to the PATH lookup.
  }
  return ['oxfmt']
}
