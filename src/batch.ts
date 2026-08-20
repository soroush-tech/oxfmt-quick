/**
 * Split `files` into batches that fit on one command line.
 *
 * Windows caps the whole line handed to CreateProcess at 32767 UTF-16 units, far below
 * the megabytes POSIX allows, so the Windows figure is the budget everywhere - a few
 * extra spawns on Linux cost less than platform-dependent behaviour. `reserved` is what
 * the invocation spends before any file: executable, leading arguments and flags.
 *
 * Each path is costed at its length plus three, for the separating space and the quotes
 * the spawn layer may add around a path with spaces. A single path dearer than the whole
 * budget still gets a batch of its own: it cannot be split, and the spawn failing loudly
 * beats this module guessing.
 */
const COMMAND_LINE_LIMIT = 30_000

export const batchFiles = (files: string[], reserved: number): string[][] => {
  const budget = COMMAND_LINE_LIMIT - reserved
  const batches: string[][] = []
  let current: string[] = []
  let spent = 0

  for (const file of files) {
    const cost = file.length + 3
    if (current.length > 0 && spent + cost > budget) {
      batches.push(current)
      current = []
      spent = 0
    }
    current.push(file)
    spent += cost
  }
  if (current.length > 0) batches.push(current)
  return batches
}
