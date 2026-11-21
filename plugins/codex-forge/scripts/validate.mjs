#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(pluginRoot, '..', '..')
const expectedSkills = ['forge-plan', 'forge-work', 'forge-finish', 'forge-ship']

const HELP = `Usage: node plugins/codex-forge/scripts/validate.mjs [options]

Validate the codex-forge plugin manifest, marketplace entry, and skills.

Options:
  --json      Print one JSON object to stdout and nothing to stderr:
              {"ok":true|false,"errors":[{"file":"<path>","message":"<text>"}],"checked":{"skills":<n>}}
              "file" is relative to the repository root.
  -h, --help  Show this help on stdout and exit.

Output (without --json):
  success     one "OK: ..." line on stdout
  failure     one "<file>: <message>" line per error on stderr

Exit codes:
  0  validation passed (or help shown)
  1  validation failed
  2  unknown option (validation is not run)
`

function validate() {
  const errors = []
  let checkedSkills = 0

  const fail = (file, message) => errors.push({ file: path.relative(repoRoot, file), message })
  // Report read failures (EACCES, EISDIR, ...) as validation errors on the file instead of throwing.
  function read(file) {
    try {
      return fs.readFileSync(file, 'utf8')
    } catch (error) {
      fail(file, `cannot read file: ${error.code ?? error.message}`)
      return null
    }
  }

  function json(file) {
    const text = read(file)
    if (text === null) return null
    try {
      return JSON.parse(text)
    } catch (error) {
      fail(file, `invalid JSON: ${error.message}`)
      return null
    }
  }

  const manifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json')
  const marketplacePath = path.join(repoRoot, '.agents', 'plugins', 'marketplace.json')
  const manifest = json(manifestPath)
  const marketplace = json(marketplacePath)

  if (manifest) {
    if (manifest.name !== 'codex-forge') fail(manifestPath, 'name must be codex-forge')
    let validVersion
    try {
      validVersion = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version ?? '')
    } catch (error) {
      // A JSON object such as {"toString":null,"valueOf":null} cannot be converted to a string.
      if (!(error instanceof TypeError)) throw error
      validVersion = false
    }
    if (!validVersion) fail(manifestPath, 'version must be semver')
    if (manifest.skills !== './skills/') fail(manifestPath, 'skills must point to ./skills/')
  }

  if (marketplace) {
    const plugins = marketplace.plugins
    if (plugins !== undefined && !Array.isArray(plugins)) fail(marketplacePath, 'plugins must be an array')
    if (Array.isArray(plugins)) {
      plugins.forEach((item, index) => {
        if (item === null) fail(marketplacePath, `plugins[${index}] must not be null`)
      })
    }
    const entry = Array.isArray(plugins) ? plugins.find(item => item?.name === 'codex-forge') : undefined
    if (!entry) fail(marketplacePath, 'codex-forge entry is missing')
    if (entry?.source?.path !== './plugins/codex-forge') {
      fail(marketplacePath, 'plugin source must be ./plugins/codex-forge')
    }
    if (!entry?.policy?.installation || !entry?.policy?.authentication || !entry?.category) {
      fail(marketplacePath, 'policy and category are required')
    }
  }

  const skillsRoot = path.join(pluginRoot, 'skills')
  for (const name of expectedSkills) {
    const skillPath = path.join(skillsRoot, name, 'SKILL.md')
    const agentPath = path.join(skillsRoot, name, 'agents', 'openai.yaml')
    if (!fs.existsSync(skillPath)) {
      fail(skillPath, 'missing')
      continue
    }
    if (!fs.existsSync(agentPath)) fail(agentPath, 'missing')
    const content = read(skillPath)
    if (content === null) continue
    checkedSkills++
    if (!content.startsWith('---\n')) fail(skillPath, 'frontmatter is missing')
    if (!content.includes(`\nname: ${name}\n`)) fail(skillPath, 'frontmatter name does not match folder')
    if (!/\ndescription: .+\n---\n/.test(content)) fail(skillPath, 'description is missing')
    for (const marker of ['[TODO:', 'CLAUDE_PLUGIN_ROOT', 'disable-model-invocation', 'agentType:']) {
      if (content.includes(marker)) fail(skillPath, `Claude/template marker remains: ${marker}`)
    }
    for (const match of content.matchAll(/\]\((\.\.\/\.\.\/references\/[^)]+)\)/g)) {
      const target = path.resolve(path.dirname(skillPath), match[1])
      if (!fs.existsSync(target)) fail(skillPath, `broken reference: ${match[1]}`)
    }
  }

  return { errors, checkedSkills }
}

// Keep diagnostics on one line: escape control and line-separator characters (LF, CR, NEL, U+2028/2029, ...).
const escapeControl = text =>
  text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ch => {
    const named = { '\n': '\\n', '\r': '\\r', '\t': '\\t' }[ch]
    return named ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  })

function main(args) {
  let jsonOutput = false
  let showHelp = false
  for (const arg of args) {
    if (arg === '--json') jsonOutput = true
    else if (arg === '--help' || arg === '-h') showHelp = true
    else {
      console.error(`error: unknown option '${escapeControl(arg)}'`)
      return 2
    }
  }
  if (showHelp) {
    process.stdout.write(HELP)
    return 0
  }

  const { errors, checkedSkills } = validate()

  if (jsonOutput) {
    const result = { ok: errors.length === 0, errors, checked: { skills: checkedSkills } }
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return result.ok ? 0 : 1
  }

  if (errors.length) {
    for (const error of errors) console.error(`${error.file}: ${error.message}`)
    return 1
  }

  console.log(`OK: ${expectedSkills.length} skills, plugin manifest, marketplace, and references validated`)
  return 0
}

// Set exitCode instead of calling process.exit() so piped stdout/stderr are fully flushed.
process.exitCode = main(process.argv.slice(2))
