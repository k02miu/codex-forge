#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(pluginRoot, '..', '..')
const errors = []

const fail = (file, message) => errors.push(`${path.relative(repoRoot, file)}: ${message}`)
const read = file => fs.readFileSync(file, 'utf8')

function json(file) {
  try {
    return JSON.parse(read(file))
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
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version ?? '')) {
    fail(manifestPath, 'version must be semver')
  }
  if (manifest.skills !== './skills/') fail(manifestPath, 'skills must point to ./skills/')
}

if (marketplace) {
  const entry = marketplace.plugins?.find(item => item.name === 'codex-forge')
  if (!entry) fail(marketplacePath, 'codex-forge entry is missing')
  if (entry?.source?.path !== './plugins/codex-forge') {
    fail(marketplacePath, 'plugin source must be ./plugins/codex-forge')
  }
  if (!entry?.policy?.installation || !entry?.policy?.authentication || !entry?.category) {
    fail(marketplacePath, 'policy and category are required')
  }
}

const skillsRoot = path.join(pluginRoot, 'skills')
const expectedSkills = ['forge-plan', 'forge-work', 'forge-finish', 'forge-ship']
for (const name of expectedSkills) {
  const skillPath = path.join(skillsRoot, name, 'SKILL.md')
  const agentPath = path.join(skillsRoot, name, 'agents', 'openai.yaml')
  if (!fs.existsSync(skillPath)) {
    fail(skillPath, 'missing')
    continue
  }
  if (!fs.existsSync(agentPath)) fail(agentPath, 'missing')
  const content = read(skillPath)
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

if (errors.length) {
  for (const error of errors) console.error(error)
  process.exit(1)
}

console.log(`OK: ${expectedSkills.length} skills, plugin manifest, marketplace, and references validated`)
