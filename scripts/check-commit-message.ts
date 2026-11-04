#!/usr/bin/env node
/**
 * Fails unless the message's first line is a Conventional Commit, which release-please
 * needs to pick version bumps. Used by `.vite-hooks/commit-msg` and the PR title check.
 *
 * Usage: check-commit-message.ts <message-file> | --message "<text>"
 */
import { readFileSync } from 'node:fs'

const types = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
]
const conventional = new RegExp(`^(${types.join('|')})(\\([\\w./-]+\\))?!?: \\S`)
// Messages git writes itself.
const generated = /^(Merge |Revert "|fixup! |squash! |amend! )/

const [flag, value] = process.argv.slice(2)
const message = flag === '--message' ? (value ?? '') : flag ? readFileSync(flag, 'utf8') : ''
const subject = message.split('\n').find((line) => line.trim() && !line.startsWith('#')) ?? ''

if (!conventional.test(subject) && !generated.test(subject)) {
  console.error(`Not a Conventional Commit: "${subject}"

Use "<type>(<optional scope>): <summary>", e.g. "fix(core): keep old permalinks".
Types: ${types.join(', ')}. Add "!" after the type (or a "BREAKING CHANGE:" footer) for breaking changes.`)
  process.exit(1)
}
