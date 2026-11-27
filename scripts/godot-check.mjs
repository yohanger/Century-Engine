// Exporta la escena de verificación a un proyecto de Godot y la deja lista para cargar con Godot 4.4.1.
// Uso: node scripts/godot-check.mjs <carpeta-del-proyecto-godot>
import fs from 'node:fs'
import path from 'node:path'
import { buildExport } from '../src/core/exporter.js'
import { buildPlayground } from './playground.mjs'

const out = path.resolve(process.argv[2] || '/tmp/gdproj')
fs.rmSync(out, { recursive: true, force: true })
const { project, terrain, models } = buildPlayground()
if (process.env.NOFX) project.environment.wfOn = false // A/B: sin interacción agua↔terreno
const { files, levelSlug, summary } = buildExport(project, terrain, models, { resPath: 'res://levels/', levelSlug: 'isla' })
for (const [p, d] of files) { const full = path.join(out, 'levels', 'isla', p); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, d) }
for (const f of ['check.gd', 'check.tscn']) fs.copyFileSync(new URL('./godot/' + f, import.meta.url), path.join(out, f))
fs.writeFileSync(path.join(out, 'project.godot'), `config_version=5

[application]
config/name="Century check"
run/main_scene="res://check.tscn"

[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
`)
console.log('Exportado:', levelSlug, JSON.stringify(summary), '→', out)
