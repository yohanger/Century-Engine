// Prepara la web de Nether Film Maker para el móvil (Capacitor → APK): compila con Vite y deja en dist-film/ solo lo que usa
// la app, con filmmaker.html como index.html. Uso: node scripts/build-filmmaker-web.mjs [--no-build]
import { spawnSync } from 'node:child_process'
import { cpSync, rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (!process.argv.includes('--no-build')) {
  const b = spawnSync(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: root, stdio: 'inherit' })
  if (b.status !== 0) process.exit(b.status ?? 1)
}
const dist = path.join(root, 'dist'), out = path.join(root, 'dist-film')
if (!existsSync(path.join(dist, 'filmmaker.html'))) { console.error('Falta dist/filmmaker.html'); process.exit(1) }
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
for (const d of ['assets', 'mediapipe']) if (existsSync(path.join(dist, d))) cpSync(path.join(dist, d), path.join(out, d), { recursive: true })
for (const f of ['jolt', 'favicon.ico']) if (existsSync(path.join(dist, f))) cpSync(path.join(dist, f), path.join(out, f), { recursive: true })
writeFileSync(path.join(out, 'index.html'), readFileSync(path.join(dist, 'filmmaker.html'), 'utf8'))
console.log('✓ dist-film/ listo (index.html = Nether Film Maker)')
