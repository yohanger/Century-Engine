import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SYSTEM_ROLES, SYSTEM_UI_FOLDER, ensureSystemUi, isSystemUi, isSystemUiPath, systemCode, systemDoc, restoreSystemUiCode, ROLE_OPTIONS } from '../src/engine/runtime/ui/system.js'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const oldCanvas = { id: 'legacy123', name: 'Dialogo viejo', props: { role: 'dialog', ui: 'personal123' } }

function oldProject() {
  return { uis: [{ id: 'personal123', name: 'dialogo_custom.ui', folder: 'Assets/UI', code: '<template><div>Personalizado</div></template>' }], folders: ['Assets','Assets/UI'], objects: [structuredClone(oldCanvas)] }
}

test('SYSUI-01 · crea una interfaz editable por cada uso del sistema', () => {
  const p = oldProject(); ensureSystemUi(p)
  const docs = p.uis.filter(isSystemUi)
  assert.equal(docs.length, SYSTEM_ROLES.length)
  assert.ok(p.folders.includes(SYSTEM_UI_FOLDER))
  for (const r of SYSTEM_ROLES) {
    const d = docs.find((u) => u.id === `sys:${r.key}`)
    assert.equal(d.name, r.file + '.ui')
    assert.equal(d.folder, SYSTEM_UI_FOLDER)
    assert.equal(d.code, systemCode(r.key))
  }
})

test('SYSUI-02 · normalizar dos veces no duplica recursos ni modifica el legacy Canvas', () => {
  const p = oldProject(); ensureSystemUi(p)
  const before = structuredClone(p); ensureSystemUi(p)
  assert.deepEqual(p, before)
  assert.deepEqual(p.objects[0], oldCanvas)
  assert.equal(p.uis.find((x) => x.id === 'personal123').code.includes('Personalizado'), true)
})

test('SYSUI-03 · una interfaz personalizada del motor conserva su contenido', () => {
  const p = oldProject(); ensureSystemUi(p)
  p.uis.find((u) => u.id === 'sys:dialog').code = '<template><b>Mi diálogo</b></template>'
  ensureSystemUi(p)
  assert.match(p.uis.find((u) => u.id === 'sys:dialog').code, /Mi diálogo/)
})

test('SYSUI-04 · recupera respaldo solo cuando falta contenido y conserva nombres nativos', () => {
  const p = oldProject(); ensureSystemUi(p)
  const code = systemCode('prompt')
  p.uis.find((u) => u.id === 'sys:prompt').code = undefined
  ensureSystemUi(p)
  assert.equal(p.uis.find((u) => u.id === 'sys:prompt').code, code)
  assert.equal(systemDoc('dialog').id, 'sys:dialog')
})

test('SYSUI-05 · la carpeta y sus descendientes se reconocen como área protegida', () => {
  assert.equal(isSystemUiPath(SYSTEM_UI_FOLDER), true)
  assert.equal(isSystemUiPath(SYSTEM_UI_FOLDER + '/otra'), true)
  assert.equal(isSystemUiPath('Assets/UI'), false)
  assert.equal(isSystemUiPath('Assets/UI/Propias'), false)
})

test('SYSUI-06 · nuevos Canvas solamente ofrecen interfaz propia; el legado permanece en datos', () => {
  assert.deepEqual(ROLE_OPTIONS.map((v) => v[0]), [''])
  const node = source('src/engine/runtime/nodes/canvas.js')
  assert.match(node, /kinds: \{ ui: \{ label: 'Canvas \(interfaz propia\)'/)
  assert.doesNotMatch(node, /\.\.\.Object\.fromEntries\(SYSTEM_ROLES/)
  const inspector = source('src/components/Inspector.vue')
  assert.match(inspector, /\(legado\)/)
})

test('SYSUI-07 · UiManager usa la versión del proyecto antes del respaldo sys:*', () => {
  const src = source('src/engine/runtime/ui/manager.js')
  assert.match(src, /docs\.find\(\(d\) => d\.id === sys\.id\) \|\| sys/)
  assert.match(src, /this\.doc\('sys:' \+ r\.key\)/)
  assert.match(src, /const mine = canvases\.filter/)
})

test('SYSUI-08 · el proyecto guarda las interfaces como archivos normales en .lfproj', () => {
  const fs = source('src/core/project.js')
  const zip = source('src/core/lfproj.js')
  assert.match(fs, /ensureSystemUi\(meta\)/)
  assert.match(zip, /clean\.uis =/)
  assert.match(zip, /e\.kind === 'script' \|\| e\.kind === 'ui' \|\| e\.kind === 'shader'/)
  assert.match(zip, /isSystemUi\(e\.ref\)/)
})

test('SYSUI-09 · evita borrado, renombrado, movimiento y duplicación de archivos nativos', () => {
  const fs = source('src/core/state/filesystem.js')
  const ui = source('src/core/state/ui-assets.js')
  assert.match(ui, /if \(isSystemUi\(p\.uis\.find/)
  assert.match(fs, /if \(!ref \|\| !clean \|\| isSystemUi\(ref\)\)/)
  assert.match(fs, /isSystemUi\(ref\) \|\| isSystemUiPath\(folder\)/)
  assert.match(fs, /if \(!ref \|\| isSystemUi\(ref\)\) return null/)
})

test('SYSUI-10 · evita mover, borrar o renombrar el directorio reservado o sus padres', () => {
  const fs = source('src/core/state/filesystem.js')
  assert.match(fs, /path === 'Assets\/UI' \|\| isSystemUiPath\(path\)/)
  assert.match(fs, /inside\('Assets\/UI\/Sistema', path\)/)
  assert.match(fs, /items\.some\(\(it\)/)
})

test('SYSUI-11 · el UI Editor permite editar y restaurar el original sin borrar el recurso', () => {
  const src = source('src/components/UiEditor.vue')
  const m = source('src/core/state/ui-assets.js')
  assert.match(src, /data-testid="restore-system-ui"/)
  assert.match(src, /askConfirm\(/)
  assert.match(m, /export function resetSystemUi\(id\)/)
  assert.match(m, /restoreSystemUiCode\(store\.project, id\)/)
  assert.match(m, /markDirty\(\)/)
})

test('SYSUI-12 · el explorador abre los recursos sin permitir operaciones destructivas', () => {
  const panel = source('src/components/ProjectPanel.vue')
  assert.match(panel, /if \(it\.kind === 'ui'\) openUiEditor\(it\.id\)/)
  assert.match(panel, /isSystemUiPath\(r\.path\)/)
  assert.match(panel, /isSystemUi\(it\)/)
})

// Regression de LF-UI-SYSTEM-ASSETS-G001_CORR-001 sobre este baseline.
test('SYSUI-CORR-01 · una restauración conserva otras interfaces y las propias', () => {
  const p = oldProject(); ensureSystemUi(p)
  const one = p.uis.find((d) => d.id === 'sys:dialog')
  const other = p.uis.find((d) => d.id === 'sys:prompt')
  one.code = 'A'; other.code = 'B'
  assert.equal(restoreSystemUiCode(p, 'sys:dialog'), 1)
  assert.equal(one.code, systemCode('dialog'))
  assert.equal(other.code, 'B')
  assert.match(p.uis.find((d) => d.id === 'personal123').code, /Personalizado/)
  assert.equal(restoreSystemUiCode(p, 'sys:dialog'), 0)
})
test('SYSUI-CORR-02 · restauración global no modifica Canvas propios', () => {
  const p = oldProject(); ensureSystemUi(p)
  for (const doc of p.uis.filter(isSystemUi)) doc.code = 'custom'
  assert.equal(restoreSystemUiCode(p), SYSTEM_ROLES.length)
  for (const doc of p.uis.filter(isSystemUi)) assert.equal(doc.code, systemCode(doc.id.slice(4)))
  assert.match(p.uis.find((d) => d.id === 'personal123').code, /Personalizado/)
})
test('SYSUI-CORR-03 · exports sin colisión de resetSystemUi', () => {
  const loc = source('src/core/state/localization.js')
  const assets = source('src/core/state/ui-assets.js')
  const theme = source('src/components/ThemeEditor.vue')
  assert.doesNotMatch(loc, /export function resetSystemUi\(/)
  assert.match(assets, /export function resetSystemUi\(id\)/)
  assert.match(assets, /export function resetAllSystemUi\(\)/)
  assert.match(theme, /resetAllSystemUi\(\)/)
})
