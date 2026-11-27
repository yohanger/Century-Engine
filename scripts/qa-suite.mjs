// Catálogo de QA sin entradas históricas duplicadas en package.json.
// npm run test:suite -- <grupo> | npm run test:suite -- --list
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const catalog = JSON.parse(readFileSync(new URL('./qa-suites.json', import.meta.url), 'utf8')).groups
const selected = process.argv[2] || 'smoke'

if (selected === '--list') {
  console.log('Grupos de QA:')
  for (const name of Object.keys(catalog).sort()) console.log(`  ${name}`)
} else if (!Object.hasOwn(catalog, selected)) {
  console.error(`Grupo de QA desconocido: ${selected}. Ejecuta npm run test:suite -- --list.`)
  process.exitCode = 2
} else {
  const visited = new Set()
  const runGroup = (name) => {
    if (visited.has(name)) throw new Error(`Referencia de QA circular: ${name}`)
    const group = catalog[name]
    if (!group) throw new Error(`Grupo de QA no registrado: ${name}`)
    visited.add(name)
    try {
      for (const step of group.steps || [group]) {
        if (step.group) {
          const status = runGroup(step.group)
          if (status !== 0) return status
        } else {
          if (!Array.isArray(step.files) || !step.files.length || step.files.some(file =>
            !/^scripts\/test-[\w-]+\.mjs$/.test(file) || !existsSync(path.join(root, file)))) {
            throw new Error(`Suite ${name} contiene rutas de prueba inválidas`)
          }
          const result = spawnSync(process.execPath, ['--test', ...step.files], { cwd: root, stdio: 'inherit' })
          if (result.error) { console.error(result.error.message); return 1 }
          if (result.status !== 0) return result.status ?? 1
        }
      }
      return 0
    } finally { visited.delete(name) }
  }
  try { process.exitCode = runGroup(selected) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
