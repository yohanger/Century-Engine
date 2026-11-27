import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = p => readFileSync(path.join(root,p), 'utf8')
const context = { window: {} }
vm.runInNewContext(file('public/docs/content.js'), context)
const site = context.window.LEVELFORGE_DOCS
const pages = site.pages
const ids = new Set(pages.map(p => p.id))
const api = file('docs/referencia/api.md')
const commands = file('docs/referencia/comandos.md')

const allCommands = [...commands.matchAll(/^<a id="([^"]+)"><\/a>\s*\n### /gm)].map(x => x[1])
const allApis = [...api.matchAll(/^<a id="([^"]+)"><\/a>\s*\n## /gm)].map(x => x[1])

test('DOC-01 · portal HTML/CSS/JS autónomo y sin dependencias de red', () => {
  const html = file('public/docs/index.html')
  assert.match(html, /lang="es"/)
  for (const asset of ['styles.css', 'content.js', 'app.js']) assert.ok(html.includes(`src="${asset}"`) || html.includes(`href="${asset}"`))
  assert.doesNotMatch(html, /https?:\/\//)
  assert.ok(file('public/docs/app.js').includes('hashchange'))
})

test('DOC-02 · identificadores únicos y contenido no vacío', () => {
  assert.equal(ids.size, pages.length)
  assert.ok(pages.length >= 160)
  for (const page of pages) {
    assert.ok(page.id && page.title && page.group && page.html.length > 80, page.id)
    assert.ok(site.groups.includes(page.group), page.id)
  }
})

test('DOC-03 · interfaces de API declaradas cubiertas sin omisiones', () => {
  assert.ok(allApis.length >= 45)
  for (const id of allApis) assert.ok(ids.has('api-'+id), id)
  assert.ok(ids.has('api-nodescripthandle'))
})

test('DOC-04 · comandos declarados cubiertos sin omisiones', () => {
  assert.ok(allCommands.length >= 65)
  for (const id of allCommands) assert.ok(ids.has('cmd-'+id), id)
})

test('DOC-05 · nodo Node/Node3D y todas las clases físicas documentados', () => {
  for (const type of ['node','node3d','staticbody3d','rigidbody3d','characterbody3d','area3d','collisionshape3d','sprite2d','sprite3d']) assert.ok(ids.has('node-'+type),type)
})

test('DOC-06 · enlaces internos de páginas y de encabezados válidos', () => {
  let checked = 0
  for(const page of pages) {
    const matches = [...page.html.matchAll(/href="(#\/[^"\s]+)"/g)]
    for(const [,href] of matches) {
      const raw = href.substring(2).replaceAll('&amp;','&')
      const id = decodeURIComponent(raw.split('?')[0])
      assert.ok(ids.has(id), `${page.id} -> ${href}`)
      checked++
    }
  }
  assert.ok(checked > 35)
})

test('DOC-07 · títulos del índice de página y enlaces directos', () => {
  for (const page of pages) {
    for (const section of page.toc) assert.ok(page.html.includes(`id="${section.id}"`), `${page.id}#${section.id}`)
  }
})

test('DOC-08 · se mantiene la integración de ayuda del editor', () => {
  const win = file('src/components/DocsWindow.vue')
  assert.match(win, /iframe/)
  assert.match(win, /docs\/index\.html/)
  for(const old of ['referencia/api.md','referencia/comandos.md','tutorial/vertical-slice.md']) assert.ok(win.includes(old))
  assert.match(file('src/core/commands.js'), /help.docs/)
  assert.match(file('package.json'), /docs:build/)
})

test('DOC-09 · documentación de scripting distinguida entre Nodo y Global', () => {
  const p=pages.find(x=>x.id==='scripts-nodo')
  assert.match(p.html, /_physics_process/)
  assert.match(p.html, /_enter_tree/)
  assert.match(p.html, /Script|script/)
})

test('DOC-10 · recursos frontend con sintaxis JS válida y sin external scripts', () => {
  for(const resource of ['public/docs/app.js','public/docs/content.js']) assert.doesNotThrow(()=>new vm.Script(file(resource)))
  assert.doesNotMatch(file('public/docs/index.html'), /<script[^>]+src="https?:/)
})

test('DOC-11 · los tipos registrados están representados', () => {
  const dir=path.join(root,'src/engine/runtime/nodes')
  const found=new Set()
  for (const fname of readdirSync(dir).filter(n=>n.endsWith('.js'))) {
    const source=readFileSync(path.join(dir,fname),'utf8')
    for(const m of source.matchAll(/registerNode\(\{\s*type:\s*'([^']+)'/g)) found.add(m[1])
    for(const m of source.matchAll(/bodyDefinition\('([^']+)'/g)) found.add(m[1])
  }
  for(const type of found) assert.ok(ids.has('node-'+type),type)
})

test('DOC-12 · código y contenido del portal son de producción documental, no ECS', () => {
  assert.doesNotMatch(file('src/components/DocsWindow.vue'), /EntityWorld|ECS/)
  assert.doesNotMatch(file('public/docs/app.js'), /fetch\(|XMLHttpRequest|import\(/)
})


test('El portal publica documentación de uso, no mantenimiento del motor', () => {
  assert.ok(!ids.has('intellisense') && !ids.has('mantenimiento'))
  assert.ok(ids.has('clima') && ids.has('agua'))
  for (const page of pages) {
    if (page.group !== 'Biblia Técnica') assert.doesNotMatch(page.html, /class="source-foot"|Ubicación de la implementación|IntelliSense y VS Code|npm run docs:build|VSIX/i, page.id)
    for (const [,href] of page.html.matchAll(/href="(#\/[^"\s]+)"/g)) {
      const [dest, query] = href.slice(2).replaceAll('&amp;', '&').split('?')
      const section = new URLSearchParams(query).get('section')
      if (section) assert.ok(pages.find(p => p.id === decodeURIComponent(dest))?.html.includes(`id="${section}"`), `${page.id} → ${href}`)
    }
  }
  assert.match(pages.find(p => p.id === 'agua').search, /Obsoleto.*game.water no está disponible/s)
  assert.match(pages.find(p => p.id === 'scripts').search, /Abrir proyecto en VS Code/)
  assert.ok(file('docs/web-src/intellisense.md').length > 100)
  assert.ok(file('docs/web-src/mantenimiento.md').length > 100)
})

test('Biblia Técnica independiente: inventario de fuentes completo y navegación', () => {
  const bible = pages.filter(p => p.group === 'Biblia Técnica')
  assert.ok(bible.length >= 100)
  assert.equal(bible.filter(p => /^biblia-\d\d-/.test(p.id)).length, 16)
  const catalog = bible.filter(p => p.id.startsWith('biblia-fuentes-'))
  const paths = new Set(catalog.flatMap(p => p.toc.map(h => h.title)))
  const walk = dir => readdirSync(path.join(root,dir), {withFileTypes:true}).flatMap(e => {
    if (e.isSymbolicLink() || ['node_modules','.git','__pycache__','.cache','dist-runtime','release'].includes(e.name)) return []
    return e.isDirectory() ? walk(dir+'/'+e.name) : [dir+'/'+e.name]
  })
  for (const file of walk('src')) assert.ok(paths.has(file),file)
  for (const file of ['src/core/editor/native-tool-window.js','src/core/events/game-api.d.ts','src/engine/runtime/world/cloud-volume.js','src/engine/runtime/render/trianghor/core.js']) assert.ok(catalog.some(p=>p.html.includes(file) && p.html.includes('Símbolos:')),file)
  const index=bible.find(p=>p.id==='biblia-00-indice')
  for (const page of bible.slice(1)) assert.ok(index.html.includes(`href="#/${page.id}"`),page.id)
  assert.ok(bible.some(p=>p.id.startsWith('biblia-contratos-')))
  assert.ok(bible.some(p=>p.id.startsWith('biblia-runners-')))
  assert.ok(bible.some(p=>p.id.startsWith('biblia-css-')))
  assert.ok(bible.some(p=>p.id.startsWith('biblia-vue-')))
})
