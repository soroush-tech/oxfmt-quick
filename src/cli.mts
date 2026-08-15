#!/usr/bin/env node
import mri from 'mri'
import pc from 'picocolors'
import { oxfmtQuick } from './index.js'

const args = mri(process.argv.slice(2), {
  boolean: ['staged', 'check', 'bail', 'restage', 'verbose', 'help'],
  default: { restage: true },
  alias: { h: 'help' },
})

const HELP = `
  ${pc.bold('oxfmt-quick')} — run oxfmt on your changed files

  ${pc.bold('Usage')}
    oxfmt-quick [options]

  By default, formats everything changed since the merge-base with --branch, plus
  untracked files. Use --staged in a pre-commit hook.

  ${pc.bold('Options')}
    --staged           Only files staged for commit, re-staged after ${pc.dim('(pre-commit)')}
    --since <rev>      Compare against <rev> instead of the merge-base
    --branch <name>    Branch to find the merge-base against ${pc.dim('(default: main)')}
    --check            Report unformatted files without writing, and exit non-zero
    --bail             Fail as soon as any file needs formatting
    --no-restage       Format without re-staging
    --config <path>    oxfmt config file
    --verbose          Print every file examined
    -h, --help         Show this
`

if (args.help) {
  console.log(HELP)
  process.exit(0)
}

const result = oxfmtQuick(process.cwd(), {
  ...args,
  onFoundSinceRevision: (revision) => {
    console.log(
      revision
        ? `🔍  Finding changed files since ${pc.bold(revision)}.`
        : '🔍  No revision to compare against; looking at untracked files only.'
    )
  },
  onFoundChangedFiles: (files) => {
    console.log(`🎯  Found ${pc.bold(String(files.length))} changed ${plural(files.length)}.`)
  },
  onExamineFile: (file) => console.log(`🔍  Examining ${pc.bold(file)}.`),
  onCheckFile: (file, isFormatted) => {
    if (!isFormatted) console.log(`⛔️  Check failed: ${pc.bold(file)}`)
  },
  onWriteFile: (file) => console.log(`✍️   Fixing up ${pc.bold(file)}.`),
  onPartiallyStagedFile: (file) => {
    console.log(`✗  Found ${pc.bold('partially')} staged file ${file}.`)
  },
  onStageFiles: (files) => console.log(`🏗️   Staging ${files.length} ${plural(files.length)}.`),
})

function plural(count: number) {
  return count === 1 ? 'file' : 'files'
}

if (result.success) {
  console.log('✅  Everything is awesome!')
} else {
  if (result.errors.includes('PARTIALLY_STAGED_FILE')) {
    console.log(
      `✗  Partially staged files were formatted but left unstaged, so this commit is not ` +
        `widened with edits you did not stage. ${pc.bold('Stage them before committing')}.`
    )
  }
  if (result.errors.includes('BAIL_ON_WRITE')) {
    console.log('✗  A file needed formatting and --bail was set.')
  }
  if (result.errors.includes('FORMAT_FAILED')) {
    console.log('✗  oxfmt failed to format the file(s) above.')
  }
  if (result.errors.includes('CHECK_FAILED')) {
    console.log('✗  Formatting issues found in the file(s) above. Forgot to run oxfmt?')
  }
  if (result.errors.includes('STAGE_FAILED')) {
    console.log('✗  Failed to stage some of the file(s) above. Stage them before committing.')
  }
  // Non-zero is what makes a git hook abort the commit.
  process.exit(1)
}
