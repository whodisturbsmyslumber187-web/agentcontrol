import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const homeDir = os.homedir()
const rootCandidates = [
  process.env.AGENTFORGE_SCAN_ROOT_1 || path.join(homeDir, 'Desktop'),
  process.env.AGENTFORGE_SCAN_ROOT_2 || path.join(homeDir, 'Downloads'),
]

const outputPath = path.resolve(process.cwd(), 'src/data/local-project-inventory.json')
const maxDepth = Number(process.env.AGENTFORGE_SCAN_DEPTH || 4)
const maxProjects = Number(process.env.AGENTFORGE_SCAN_MAX || 400)

const projectMarkers = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  '.git',
]

function normalizePath(input) {
  return input.replaceAll('\\', '/')
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function statSafe(target) {
  try {
    return await fs.stat(target)
  } catch {
    return null
  }
}

function inferProjectType(files) {
  if (files.includes('package.json')) return 'node'
  if (files.includes('pyproject.toml') || files.includes('requirements.txt')) return 'python'
  if (files.includes('go.mod')) return 'go'
  if (files.includes('Cargo.toml')) return 'rust'
  if (files.includes('pom.xml')) return 'java'
  if (files.includes('.git')) return 'git'
  return 'unknown'
}

async function discoverProjects(rootPath) {
  const projects = []
  const queue = [{ dir: rootPath, depth: 0 }]
  const ignoreNames = new Set(['node_modules', '.git', '.next', '.nuxt', 'dist', 'build', '__pycache__'])

  while (queue.length > 0 && projects.length < maxProjects) {
    const current = queue.shift()
    if (!current) break

    let entries
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true })
    } catch {
      continue
    }

    const names = entries.map((entry) => entry.name)
    const matchedMarkers = projectMarkers.filter((marker) => names.includes(marker))

    const isRootDir = current.depth === 0

    if (matchedMarkers.length > 0 && !isRootDir) {
      const stats = await statSafe(current.dir)
      projects.push({
        name: path.basename(current.dir),
        path: normalizePath(current.dir),
        root: normalizePath(rootPath),
        type: inferProjectType(matchedMarkers),
        markers: matchedMarkers,
        updatedAt: stats?.mtime?.toISOString() || null,
      })
      continue
    }

    if (current.depth >= maxDepth) continue

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (ignoreNames.has(entry.name)) continue
      queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 })
    }
  }

  return projects
}

async function main() {
  const roots = []
  for (const candidate of rootCandidates) {
    if (candidate && (await exists(candidate))) roots.push(path.resolve(candidate))
  }

  const allProjects = []
  for (const root of roots) {
    const projects = await discoverProjects(root)
    allProjects.push(...projects)
  }

  const dedupedMap = new Map()
  for (const project of allProjects) {
    if (!dedupedMap.has(project.path)) {
      dedupedMap.set(project.path, project)
    }
  }

  const dedupedProjects = [...dedupedMap.values()]
    .sort((a, b) => {
      const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0
      const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0
      return bTime - aTime
    })
    .slice(0, maxProjects)

  const payload = {
    generatedAt: new Date().toISOString(),
    roots: roots.map((entry) => normalizePath(entry)),
    total: dedupedProjects.length,
    projects: dedupedProjects,
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`local-project-inventory written: ${outputPath}`)
  console.log(`roots scanned: ${payload.roots.join(', ')}`)
  console.log(`projects found: ${payload.total}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
