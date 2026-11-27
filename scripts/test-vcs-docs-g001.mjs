import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = name => readFileSync(path.join(root, name), 'utf8')
const sandbox = { window: {} }
vm.runInNewContext(file('public/docs/content.js'), sandbox)
const docs = sandbox.window.LEVELFORGE_DOCS
const pages = new Map(docs.pages.map(page => [page.id, page]))
const ids = ['vcs-intro', 'vcs-commits', 'vcs-historial', 'vcs-ramas', 'vcs-remotos', 'vcs-seguridad', 'vcs-problemas']
const panel = file('src/components/VersionControlPanel.vue')
const backend = file('electron/vcs.cjs')
const remote = file('electron/vcs-remote.cjs')

test('VCS-DOC-01: siete capítulos integrados en la sección y el índice', () => {
  assert.ok(docs.groups.includes('Control de versiones Git'))
  for (const id of ids) {
    assert.equal(pages.get(id)?.group, 'Control de versiones Git')
    assert.ok(pages.get(id)?.html.length > 800, `Capítulo vacío: ${id}`)
    assert.match(file(`docs/web-src/${id}.md`), /^# /)
  }
})
test('VCS-DOC-02: documentación enlazada desde inicio, primeros pasos, editor y ayuda', () => {
  for (const id of ['inicio', 'primeros-pasos', 'editor', 'problemas'])
    assert.ok(pages.get(id).html.includes('#/vcs-intro') || pages.get(id).html.includes('#/vcs-problemas'), id)
})
test('VCS-DOC-03: enlaces internos resuelven páginas y secciones', () => {
  for (const id of [...ids, 'inicio', 'primeros-pasos', 'editor', 'problemas']) {
    for (const match of pages.get(id).html.matchAll(/href="(#\/[^"\s]+)"/g)) {
      const [dest, query] = match[1].slice(2).split('?')
      const page = pages.get(decodeURIComponent(dest))
      assert.ok(page, `${id}: ruta inválida ${match[1]}`)
      if (query?.startsWith('section='))
        assert.ok(page.toc.some(t => t.id === decodeURIComponent(query.slice(8))), `${id}: sección inválida ${match[1]}`)
    }
  }
})
test('VCS-DOC-04: operaciones documentadas existen en el panel y en backend', () => {
  for (const action of ['init','commit','log','branches','createBranch','prepareChange','applyChange','recoverChange']) {
    assert.ok(panel.includes(`'${action}'`), `Vue sin acción ${action}`)
    assert.ok(backend.includes(action), `backend sin ${action}`)
  }
  for (const action of ['setRemote','fetchRemote','pushRemote','preparePull','applyPull','cloneRemote','saveCredential','forgetCredential']) {
    assert.ok(panel.includes(`'${action}'`), `Vue sin acción remota ${action}`)
    assert.ok(remote.includes(action) || backend.includes(action), `backend sin ${action}`)
  }
})
test('VCS-DOC-05: nombres de pestañas y de confirmaciones exactos', () => {
  for (const tab of ['Cambios','Historial','Ramas','Remoto']) assert.ok(panel.includes(`>${tab}`),tab)
  for (const label of ['Crear commit','Preparar cambio','Preparar archivo','Preparar Pull','Aplicar Pull','Guardar cifrado','Olvidar credencial'])
    assert.ok(panel.includes(label), label)
})
test('VCS-DOC-06: límites de seguridad públicos y evidencia de distribución interna', () => {
  const text = ids.map(id => pages.get(id).search).join('\n')
  for (const phrase of ['128 MiB','1.000 archivos','HTTPS','avance rápido','Electron'])
    assert.ok(text.includes(phrase),phrase)
  const internal = file('docs/architecture/DOCUMENTATION_PUBLIC_EDITORIAL_HISTORY.md')
  for (const phrase of ['Windows','Linux','GPL-2.0','No hay evidencia suficiente']) assert.ok(internal.includes(phrase), phrase)
  assert.doesNotMatch(pages.get('vcs-seguridad').search, /npm run|docs\/architecture|QA local/i)
})
test('VCS-DOC-07: offline, búsqueda por texto y sin CDN ni Fetch', () => {
  const index = file('public/docs/index.html'), app = file('public/docs/app.js')
  assert.doesNotMatch(index, /<script[^>]*src="https?:/)
  assert.ok(index.includes('content.js') && index.includes('app.js'))
  assert.match(app, /p\.search/)
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest/)
  for (const id of ids) assert.ok(pages.get(id).search.length > 300)
})
test('VCS-DOC-08: contenido fuente y generado coinciden en título y términos', () => {
  for (const id of ids) {
    const md = file(`docs/web-src/${id}.md`)
    const title = md.match(/^#\s+(.+)/m)?.[1]
    assert.equal(pages.get(id).title,title)
    assert.ok(!pages.get(id).html.includes('source-foot'))
    assert.ok(file('docs/web-README.md').includes('docs/web-src/vcs-*.md'))
  }
})
test('VCS-DOC-09: no se reimplementa panel ni red de Git', () => {
  assert.match(file('scripts/gen-docs-web.mjs'), /'Control de versiones Git'/)
  assert.match(file('docs/web-README.md'), /LF-VCS-DOCS-G001/)
  assert.equal(file('package.json').includes('playwright'), false)
})
