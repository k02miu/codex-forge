#!/usr/bin/env node
// Regression tests for diff-summary.sh.
// Run: node --test plugins/codex-forge/scripts/diff-summary.test.mjs
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
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'LANGUAGE', 'LANG']) delete env[key]

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

// Locale handling must not depend on locales installed on the host.
// fakeTranslatedGitEnv() puts a git wrapper first on PATH that rewrites Git's
// diagnostics as if translated whenever LC_ALL is not C, so the classification
// is always exercised. A real installed locale with Git translations, when
// one exists, is used in addition (the test is skipped otherwise).
function fakeTranslatedGitEnv() {
  const realGit = spawnSync('sh', ['-c', 'command -v git'], { env, encoding: 'utf8' }).stdout.trim()
  assert.ok(realGit, 'git not found on PATH')
  const bin = tempDir()
  fs.writeFileSync(path.join(bin, 'git'), `#!/usr/bin/env bash
{ err="$(${JSON.stringify(realGit)} "$@" 2>&1 1>&3 3>&-)"; status=$?; } 3>&1
if [ -n "$err" ]; then
  if [ "\${LC_ALL:-}" != C ]; then
    err="$(printf '%s\\n' "$err" | sed -e 's/^fatal: not a git repository/Schwerwiegend: Kein Git-Repository/' \\
      -e 's/^fatal: detected dubious ownership/Schwerwiegend: dubiose Besitzverhaeltnisse/' -e 's/^fatal: /Schwerwiegend: /')"
  fi
  printf '%s\\n' "$err" >&2
fi
exit "$status"
`, { mode: 0o755 })
  return { ...env, PATH: `${bin}${path.delimiter}${env.PATH}` }
}

function findTranslatedLocale() {
  const outside = tempDir()
  for (const name of ['de_DE.UTF-8', 'de_DE.utf8', 'fr_FR.UTF-8', 'fr_FR.utf8', 'es_ES.UTF-8', 'es_ES.utf8']) {
    const locale = { LC_ALL: name, LANG: name, LANGUAGE: name.slice(0, 2) }
    const shell = spawnSync('bash', ['-c', ':'], { env: { ...env, ...locale }, encoding: 'utf8' })
    if (shell.status !== 0 || shell.stderr !== '') continue
    const probe = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: outside, env: { ...env, ...locale }, encoding: 'utf8' })
    if (probe.status !== 0 && probe.stderr && !probe.stderr.startsWith('fatal: ')) return locale
  }
  return null
}
const TRANSLATED_LOCALE = findTranslatedLocale()
const SKIP_NO_LOCALE = TRANSLATED_LOCALE ? false : 'no installed locale with Git translations'
// Never installed anywhere; bash warns about it on glibc systems.
const MISSING_LOCALE = { LC_ALL: 'xx_XX.UTF-8', LANG: 'xx_XX.UTF-8' }
// Drop bash's own startup warning for an unusable locale; nothing else may remain.
const withoutStartupWarning = text => text.split('\n').filter(line => !line.startsWith('bash: warning: setlocale: ')).join('\n')
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
      assert.match(result.stdout, /no common ancestor/)
      assert.match(result.stdout, /^ {2}128\b/m)
      assert.match(result.stdout, /work tree/)
      assert.match(result.stdout, /dubious ownership/)
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

test('regression: commit message search (:/<text>) is accepted as base', () => {
  const dir = makeRepo()
  const root = git(dir, 'rev-parse', 'HEAD')
  addCommit(dir, 'b.txt', 'two\n')
  for (const base of [':/initial', 'main^{/initial}']) {
    const result = run(dir, base)
    assert.equal(result.code, 0, `base ${base}: ${result.stderr}`)
    assert.equal(result.stderr, '', `base ${base}`)
    assert.ok(result.stdout.startsWith(`## base\n${base}\n\n## merge-base\n${root}\n\n`), `base ${base}`)
    assert.deepEqual(sectionHeaders(result.stdout), SECTIONS, `base ${base}`)
  }
  const missing = run(dir, ':/no such message')
  assert.deepEqual(missing, { code: 1, stdout: '', stderr: "error: base ':/no such message' not found\n" })
})

test('regression: no common ancestor exits 1 with no output (documented in --help)', () => {
  const dir = makeRepo({ remote: false })
  git(dir, 'switch', '-q', '--orphan', 'other')
  fs.writeFileSync(path.join(dir, 'c.txt'), 'other\n')
  git(dir, 'add', 'c.txt')
  git(dir, 'commit', '-q', '-m', 'unrelated')
  assert.deepEqual(run(dir, 'main'), { code: 1, stdout: '', stderr: '' })
})

test('regression: no work tree (bare repository, inside .git) exits 128 with git diagnostic', () => {
  const work = makeRepo()
  const bare = path.join(tempDir(), 'bare.git')
  git(work, 'clone', '-q', '--bare', work, bare)
  for (const dir of [bare, path.join(work, '.git')]) {
    const result = run(dir, 'main')
    assert.equal(result.code, 128, dir)
    assert.equal(result.stdout, '', dir)
    assert.match(result.stderr, /^fatal: .*work tree/m, dir)
    assert.doesNotMatch(result.stderr, /^error: /m, dir)
  }
})

const runIn = (cwd, testEnv, ...args) => {
  const result = spawnSync('bash', [script, ...args], { cwd, env: testEnv, encoding: 'utf8' })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('git refusing the repository (dubious ownership) passes its diagnostic through', () => {
  const dir = makeRepo()
  for (const args of [[], ['main']]) {
    const result = runIn(dir, { ...env, GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' }, ...args)
    const label = JSON.stringify(args)
    assert.equal(result.stdout, '', label)
    assert.equal(result.code, 128, label)
    assert.match(result.stderr, /^fatal: detected dubious ownership/m, label)
    assert.match(result.stderr, /safe\.directory/, label)
    assert.doesNotMatch(result.stderr, /error: not a git repository/, label)
  }
})

test('translated Git diagnostics (simulated): fixed error outside a repository, original text otherwise', () => {
  // An uninstalled locale keeps the real Git untranslated; only the wrapper translates.
  const fakeEnv = { ...fakeTranslatedGitEnv(), ...MISSING_LOCALE }
  const outside = runIn(tempDir(), fakeEnv)
  assert.deepEqual(
    { ...outside, stderr: withoutStartupWarning(outside.stderr) },
    { code: 1, stdout: '', stderr: 'error: not a git repository\n' },
  )
  const owned = runIn(makeRepo(), { ...fakeEnv, GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' }, 'main')
  assert.equal(owned.code, 128)
  assert.equal(owned.stdout, '')
  assert.match(owned.stderr, /^Schwerwiegend: dubiose Besitzverhaeltnisse/m)
  assert.doesNotMatch(owned.stderr, /error: not a git repository/)
})

test('translated Git diagnostics (installed locale): same behavior', { skip: SKIP_NO_LOCALE }, () => {
  const localeEnv = { ...env, ...TRANSLATED_LOCALE }
  assert.deepEqual(runIn(tempDir(), localeEnv), { code: 1, stdout: '', stderr: 'error: not a git repository\n' })
  const owned = runIn(makeRepo(), { ...localeEnv, GIT_TEST_ASSUME_DIFFERENT_OWNER: '1' }, 'main')
  assert.equal(owned.code, 128)
  assert.equal(owned.stdout, '')
  assert.match(owned.stderr, /safe\.directory/)
  assert.doesNotMatch(owned.stderr, /^fatal: /m, 'diagnostic stays in the user locale')
  assert.doesNotMatch(owned.stderr, /error: not a git repository/)
})

test('unusable locale: the script adds no locale warnings of its own', () => {
  const missingEnv = { ...env, ...MISSING_LOCALE }
  const outside = runIn(tempDir(), missingEnv)
  assert.deepEqual(
    { ...outside, stderr: withoutStartupWarning(outside.stderr) },
    { code: 1, stdout: '', stderr: 'error: not a git repository\n' },
  )
  const missing = runIn(makeRepo(), missingEnv, 'not-found\nsecond-line')
  assert.deepEqual(
    { ...missing, stderr: withoutStartupWarning(missing.stderr) },
    { code: 1, stdout: '', stderr: "error: base 'not-found\\nsecond-line' not found\n" },
  )
})

test('missing base with control characters is escaped onto one stderr line', () => {
  const dir = makeRepo()
  const cases = [
    ['not-found\nsecond-line', "error: base 'not-found\\nsecond-line' not found\n"],
    ['cr\rtab\tend', "error: base 'cr\\rtab\\tend' not found\n"],
    ['esc\x1b[31m', "error: base 'esc\\x1B[31m' not found\n"],
    ['back\\slash\nx', "error: base 'back\\\\slash\\nx' not found\n"],
    ['日本語-branch', "error: base '日本語-branch' not found\n"],
  ]
  for (const [base, expected] of cases) {
    const result = run(dir, base)
    assert.deepEqual(result, { code: 1, stdout: '', stderr: expected }, JSON.stringify(base))
    assert.equal(result.stderr.split('\n').length, 2, JSON.stringify(base))
  }
})
