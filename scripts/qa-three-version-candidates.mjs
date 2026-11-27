// LF-THREE-VERSION-G001 · Probar revisiones de Three.js sin tocar el proyecto activo.
// Primero r180; si pasa, r186.1 sobre LA MISMA copia de prueba.
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, statSync, openSync, closeSync } from 'node:fs'
import { resolve, join, dirname, relative, isAbsolute, sep } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import process from 'node:process'

const source = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const help = `Uso:\n  node scripts/qa-three-version-candidates.mjs --check\n  node scripts/qa-three-version-candidates.mjs --stage=r180 [--output=/ruta/segura]\n  node scripts/qa-three-version-candidates.mjs --stage=r186.1 [--output=/ruta/segura]\n\nEjecuta r180 antes de r186.1. No altera la carpeta original.\n`
const stageArg = args.find(a => a.startsWith('--stage='))?.slice(8)
const outputArg = args.find(a => a.startsWith('--output='))?.slice(9)
const checkOnly = args.includes('--check')
if (args.includes('--help') || (!checkOnly && !stageArg)) { process.stdout.write(help); process.exit(args.includes('--help') ? 0 : 2) }
if (!checkOnly && !['r180', 'r186.1'].includes(stageArg)) throw Error('Etapa inválida: usar r180 o r186.1')
const out = resolve(outputArg ?? join(homedir(), 'Downloads', 'Century-Three-Version-QA'))
const candidate = join(out, 'candidate')
const reports = join(out, 'reports')
const inside = (path, parent) => path === parent || path.startsWith(parent + sep)
if (inside(out, source) || inside(source, out)) throw Error('La ruta de salida debe estar fuera del proyecto original y de sus carpetas padre')
if (out === '/' || out === homedir()) throw Error('Ruta de salida demasiado amplia')
const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(join(source, 'package-lock.json'), 'utf8'))
const activeThree = lock.packages?.['node_modules/three']?.version
const isLegacyBaseline = activeThree === '0.170.0' && pkg.dependencies?.three?.includes('0.170.0')
const isAdoptedBaseline = activeThree === '0.186.1' && pkg.dependencies?.three === '0.186.1'
if (!isLegacyBaseline && !isAdoptedBaseline) {
  throw Error('El baseline no corresponde a una revisión aprobada de este Gate')
}
if (checkOnly) {
  process.stdout.write(`VALIDACIÓN ${isAdoptedBaseline ? 'DE ADOPCIÓN' : 'PREVIA'} PASS: ${source}\nThree.js: ${activeThree}\nDestino aislado: ${out}\nProyecto original: sin cambios\n`)
  process.exit(0)
}
if (isAdoptedBaseline) {
  throw Error('Migración ya integrada en r186.1: no reiniciar el ensayo histórico desde el baseline actualizado')
}
const stamp = new Date().toISOString()
const manifestPath = join(reports, 'estado.json')
const stage = stageArg
const target = stage === 'r180' ? '0.180.0' : '0.186.1'
mkdirSync(reports, { recursive: true })
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const node = process.execPath
function record(data) { writeFileSync(manifestPath, JSON.stringify(data, null, 2) + '\n') }
function installedVersion(project) {
  if (!existsSync(join(project, 'package-lock.json'))) return null
  return JSON.parse(readFileSync(join(project, 'package-lock.json'), 'utf8')).packages?.['node_modules/three']?.version ?? null
}
function cloneProject() {
  if (existsSync(candidate)) throw Error('Ya existe una copia candidata. No sobrescribir; usa otra --output si quieres comenzar de cero.')
  const omit = new Set(['node_modules', '.git', 'dist', 'dist-runtime', 'release', 'build', '.cache', '.vite', 'coverage'])
  cpSync(source, candidate, {
    recursive: true,
    filter: (entry) => {
      const rel = relative(source, entry)
      return !rel.split(sep).some(part => omit.has(part))
    },
  })
  if (installedVersion(candidate) !== '0.170.0') throw Error('La copia de prueba no coincide con r170')
}
async function run(label, cmd, parameters) {
  const logfile = join(reports, `${stage}-${label}.log`)
  const fd = openSync(logfile, 'w')
  process.stdout.write(`> ${label}  (${logfile})\n`)
  let code
  try {
    code = await new Promise((resolveExit, reject) => {
      const child = spawn(cmd, parameters, { cwd: candidate, stdio: ['ignore', fd, fd], env: { ...process.env, CI: 'true' } })
      child.once('error', reject)
      child.once('close', status => resolveExit(status ?? 1))
    })
  } finally { closeSync(fd) }
  process.stdout.write(`${code === 0 ? 'PASS' : 'FAIL'} ${label} (código ${code})\n`)
  return { label, command: [cmd, ...parameters].join(' '), exitCode: code, logfile }
}
if (stage === 'r180') cloneProject()
else {
  if (!existsSync(manifestPath) || !existsSync(candidate)) throw Error('Falta la fase r180. Ejecútala primero en esta misma ruta de salida.')
  const prev = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (prev.stage !== 'r180' || prev.status !== 'PASS' || installedVersion(candidate) !== '0.180.0') {
    throw Error('r180 no fue validada completamente. No avanzar a r186.1.')
  }
}
const results = []
const state = { gate: 'LF-THREE-VERSION-G001', started: stamp, stage, target, source, candidate, results, status: 'IN_PROGRESS', gpuVisual: 'NOT_VERIFIED' }
record(state)
async function step(label, cmd, parameters) {
  const result = await run(label, cmd, parameters)
  results.push(result)
  if (result.exitCode !== 0) {
    state.status = 'FAIL'
    state.failedStep = label
    state.finished = new Date().toISOString()
    record(state)
    process.stderr.write(`Detenido en ${label}. Revisa el log; el proyecto original no fue modificado.\n`)
    process.exit(1)
  }
  record(state)
}
if (stage === 'r180') await step('npm-ci-r170', npm, ['ci', '--no-audit', '--no-fund'])
await step('instalar-candidato', npm, ['install', '--save-exact', `three@${target}`, '--no-audit', '--no-fund'])
if (installedVersion(candidate) !== target) {
  state.status = 'FAIL'
  state.failedStep = 'lockfile-versión'
  record(state)
  throw Error(`El lockfile no refleja three@${target}`)
}
await step('preflight', node, ['--test', 'scripts/test-three-version-g001.mjs'])
const suites = readdirSync(join(candidate, 'scripts'))
  .filter(name => /^test-.*\.mjs$/.test(name) && !['test-starcat.mjs', 'test-three-version-candidates.mjs'].includes(name))
  .sort().map(name => `scripts/${name}`)
await step('regresion', node, ['--test', ...suites])
await step('build-editor-player', npm, ['run', 'build'])
state.status = 'PASS'
state.finished = new Date().toISOString()
state.installedThree = installedVersion(candidate)
record(state)
process.stdout.write(`Etapa ${stage} PASS en pruebas Node y compilación. GPU/visual aún NO VERIFICADO.\n`)
if (stage === 'r180') process.stdout.write('Puedes continuar con --stage=r186.1 en la misma ruta de salida.\n')
else process.stdout.write('No integrar automáticamente: revisar renderizado y comparar con la referencia r170.\n')
