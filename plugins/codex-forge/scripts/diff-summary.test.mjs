#!/usr/bin/env node
// Regression tests for diff-summary.sh. Run: node --test plugins/codex-forge/scripts/
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'diff-summary.sh')
const sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'diff-summary-test-')))
after(() => fs.rmSync(sandbox, { recursive: true, force: true }))

// Isolate from the user's git config and from any repository above the sandbox.
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CEILING_DIRECTORIES: sandbox,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
  LC_ALL: 'C',
}
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key]

let counter = 0
const tempDir = () => {
  const dir = path.join(sandbox, `case-${++counter}`)
  fs.mkdirSync(dir)
  return dir
}

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`)
  return result.stdout.trim()
}

const run = (cwd, ...args) => {
  const result = spawnSync('bash', [script, ...args], { cwd, env, encoding: 'utf8' })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

// Repo with one commit on main, a remote-tracking origin/main pointing at it,
// and a feature branch checked out.
function makeRepo({ remote = true } = {}) {
  const dir = tempDir()
  git(dir, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n')
  git(dir, 'add', 'a.txt')
  git(dir, 'commit', '-q', '-m', 'initial')
  if (remote) git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  git(dir, 'switch', '-q', '-c', 'feature')
  return dir
}

function addCommit(dir, file, content) {
  fs.writeFileSync(path.join(dir, file), content)
  git(dir, 'add', file)
  git(dir, 'commit', '-q', '-m', `change ${file}`)
}

const sectionHeaders = stdout => stdout.split('\n').filter(line => line.startsWith('## '))
const SECTIONS = ['## base', '## merge-base', '## changed files', '## working tree', '## diffstat']

test('missing base: one-line error on stderr, empty stdout, exit 1', () => {
  const dir = makeRepo()
  const result = run(dir, 'no-such-branch')
  assert.equal(result.stderr, "error: base 'no-such-branch' not found\n")
  assert.equal(result.stdout, '')
  assert.equal(result.code, 1)
})

test('outside a git repository: one-line error on stderr, empty stdout, exit 1', () => {
  const dir = tempDir()
  for (const args of [[], ['main']]) {
    const result = run(dir, ...args)
    assert.equal(result.stderr, 'error: not a git repository\n', `args: ${JSON.stringify(args)}`)
    assert.equal(result.stdout, '', `args: ${JSON.stringify(args)}`)
    assert.equal(result.code, 1, `args: ${JSON.stringify(args)}`)
  }
})

for (const flag of ['--help', '-h']) {
  test(`${flag}: usage on stdout, empty stderr, exit 0 (also outside a repository)`, () => {
    for (const dir of [makeRepo(), tempDir()]) {
      const result = run(dir, flag)
      assert.equal(result.stderr, '')
      assert.equal(result.code, 0)
      assert.match(result.stdout, /^Usage: diff-summary\.sh \[-h\|--help\] \[base\]$/m)
      assert.match(result.stdout, /^Arguments:$/m)
      assert.match(result.stdout, /^ {2}base\b/m)
      assert.match(result.stdout, /origin\/HEAD, origin\/main, origin\/master, origin\/develop/)
      assert.match(result.stdout, /NO_CHANGES/)
      for (const header of SECTIONS) assert.ok(result.stdout.includes(header), `help lists ${header}`)
      assert.match(result.stdout, /^Exit status:$/m)
      assert.match(result.stdout, /^ {2}0\b/m)
      assert.match(result.stdout, /^ {2}1\b/m)
    }
  })
}

test('regression: NO_CHANGES when nothing differs from base', () => {
  const dir = makeRepo()
  for (const args of [[], ['main']]) {
    const result = run(dir, ...args)
    assert.deepEqual(result, { code: 0, stdout: 'NO_CHANGES\n', stderr: '' }, `args: ${JSON.stringify(args)}`)
  }
})

test('regression: auto-detected base and section order', () => {
  const dir = makeRepo()
  const mergeBase = git(dir, 'rev-parse', 'HEAD')
  addCommit(dir, 'b.txt', 'two\n')
  fs.writeFileSync(path.join(dir, 'untracked.txt'), 'x\n')
  const result = run(dir)
  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.deepEqual(sectionHeaders(result.stdout), SECTIONS)
  assert.ok(result.stdout.startsWith(`## base\norigin/main\n\n## merge-base\n${mergeBase}\n\n`))
  assert.match(result.stdout, /## changed files\nA\tb\.txt\n\n/)
  assert.match(result.stdout, /## working tree\n\?\? untracked\.txt\n\n/)
  assert.match(result.stdout, /## diffstat\n b\.txt \| 1 \+\n/)
})

test('regression: origin/HEAD takes priority in auto-detection', () => {
  const dir = makeRepo()
  git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
  addCommit(dir, 'b.txt', 'two\n')
  const result = run(dir)
  assert.equal(result.code, 0)
  assert.ok(result.stdout.startsWith('## base\norigin/HEAD\n\n'))
})

test('regression: auto-detection failure keeps its message', () => {
  const dir = makeRepo({ remote: false })
  const result = run(dir)
  assert.deepEqual(result, {
    code: 1,
    stdout: '',
    stderr: 'error: base branch not found; pass one explicitly\n',
  })
})

test('regression: explicit revisions (branch, remote, full ref, tags, SHA, HEAD~N, ^{commit}) still work', () => {
  const dir = makeRepo()
  const root = git(dir, 'rev-parse', 'HEAD')
  git(dir, 'tag', 'v1', root)
  git(dir, 'tag', '-a', '-m', 'annotated', 'v1-annotated', root)
  addCommit(dir, 'b.txt', 'two\n')
  for (const base of ['main', 'origin/main', 'refs/heads/main', 'v1', 'v1-annotated', root, root.slice(0, 7), 'HEAD~1', 'feature~1', 'main^{commit}']) {
    const result = run(dir, base)
    assert.equal(result.code, 0, `base ${base}: ${result.stderr}`)
    assert.equal(result.stderr, '', `base ${base}`)
    assert.ok(result.stdout.startsWith(`## base\n${base}\n\n## merge-base\n${root}\n\n`), `base ${base}`)
    assert.deepEqual(sectionHeaders(result.stdout), SECTIONS, `base ${base}`)
  }
})

test('base that is not a commit (tree object) is reported as not found', () => {
  const dir = makeRepo()
  const tree = git(dir, 'rev-parse', 'HEAD^{tree}')
  const result = run(dir, tree)
  assert.deepEqual(result, { code: 1, stdout: '', stderr: `error: base '${tree}' not found\n` })
})

test('base that looks like an option is reported as not found', () => {
  const dir = makeRepo()
  for (const base of ['--all', '-x']) {
    const result = run(dir, base)
    assert.deepEqual(result, { code: 1, stdout: '', stderr: `error: base '${base}' not found\n` })
  }
})
