import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const timeline = read('src/components/TimelinePanel.vue')
const iconSource = read('src/components/Icon.vue')
const menu = read('src/components/ContextMenu.vue')
const list = read('src/components/MenuList.vue')
const part = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to))

function harness(kind) {
  const isTimeline = kind === 'timeline'
  const resource = {
    id: 'A', duration: 10,
    tracks: [{ id: 'tr1', name: 'Cámara', kind: 'camera', muted: false, keys: [{ id: 'k1', t: 1 }] }],
    events: [{ id: 'ev1', t: 2, name: 'Inicio' }],
  }
  const resourceRef = { value: resource }
  const selection = { value: null }, head = { value: 0 }, zoom = { value: 70 }
  const store = { menu: null }
  const commits = [], commands = []
  const ctx = {
    store, sel: selection, ph: head, zoom, tl: resourceRef, clip: resourceRef,
    snapT: (t) => Math.max(0, Math.min(10, Math.round(t * 10) / 10)),
    trackName: (tr) => tr.name,
    pickTrack: (tr) => { selection.value = { tr: tr.id } },
    pick: (tr, key) => { selection.value = { tr: tr.id, k: key.id } },
    addKey: (tr, at = head.value) => { tr.keys.push({ id: `k${tr.keys.length + 1}`, t: at }); selection.value = { tr: tr.id, k: tr.keys.at(-1).id }; commits.push('Nueva clave') },
    delKey: () => {
      if (selection.value?.ev) resourceRef.value.events = resourceRef.value.events.filter((ev) => ev.id !== selection.value.ev)
      else { const tr = resourceRef.value.tracks.find((t) => t.id === selection.value?.tr); if (tr) tr.keys = tr.keys.filter((k) => k.id !== selection.value.k) }
      selection.value = null; commits.push('Eliminar')
    },
    dupKey: () => { const tr = resourceRef.value.tracks.find((t) => t.id === selection.value?.tr); const old = tr?.keys.find((k) => k.id === selection.value.k); if (old) tr.keys.push({ ...old, id: `dup${tr.keys.length}` }); commits.push('Duplicar') },
    delTrack: (tr) => { resourceRef.value.tracks = resourceRef.value.tracks.filter((t) => t.id !== tr.id); commits.push('Eliminar pista') },
    addEvent: (at) => { resourceRef.value.events.push({ id: 'ev2', t: at }); commits.push('Nuevo evento') },
    openEventEditor: (id) => commands.push(id),
    commit: (name) => commits.push(name), bump: () => {},
  }
  const source = part(timeline, '// Menú contextual del editor:', 'function captureView()')
  vm.createContext(ctx)
  vm.runInContext(source, ctx)
  const event = (x = 270) => ({ clientX: x, clientY: 50, currentTarget: { getBoundingClientRect: () => ({ left: 100 }) } })
  const choose = (label) => { const action = store.menu?.items.find((i) => i.label === label); assert.ok(action, `Falta ${label}`); assert.ok(!action.disabled, `Deshabilitada: ${label}`); action.run(); return action }
  return { ctx, resource, resourceRef, selection, head, store, commits, commands, event, choose }
}

test('Timeline conserva menú contextual global; editor heredado no existe tras S05-G003', () => {
  const text = timeline
  assert.match(text, /store\.menu = \{ x: e\.clientX, y: e\.clientY, items:/)
  assert.match(text, /@contextmenu\.prevent\.stop="trackMenu\(\$event, tr\)"/)
  assert.match(text, /@contextmenu\.prevent\.stop="laneMenu\(\$event, tr\)"/)
  assert.match(text, /@contextmenu\.prevent\.stop="keyMenu\(\$event, tr, k\)"/)
  const header = part(text, '<div v-for="tr in ', '<div class="lane"')
  assert.doesNotMatch(header, /class="ghost s"|@click="delTrack\(tr\)"|@click="addKey\(tr\)"/)
  assert.match(menu, /background: transparent/)
  assert.match(list, /menu-appear 115ms ease-out/)
})

test('Los iconos contextuales existen en Icon.vue (sin iconos inventados)', () => {
  for (const name of ['event', 'volume', 'mute', 'trash', 'sliders', 'pin', 'copy', 'list', 'plus'])
    assert.match(iconSource, new RegExp(`(?:\\b${name}:|'${name}':)\\s*'`), name)
})

test('Timeline · acciones de pista, selección, silencio y eliminación', () => {
  const h = harness('timeline'), tr = h.resource.tracks[0]
  h.ctx.trackMenu(h.event(), tr)
  assert.equal(h.selection.value.tr, tr.id)
  h.choose('Añadir clave en el cabezal')
  assert.equal(tr.keys.length, 2)
  h.ctx.trackMenu(h.event(), tr)
  h.choose('Silenciar pista')
  assert.equal(tr.muted, true)
  assert.ok(h.commits.includes('Silenciar pista'))
  h.ctx.trackMenu(h.event(), tr)
  h.choose('Activar pista')
  assert.equal(tr.muted, false)
  h.ctx.trackMenu(h.event(), tr)
  h.choose('Eliminar pista')
  assert.equal(h.resourceRef.value.tracks.length, 0)
})

test('Timeline · física horneada impide inserción manual, pero mantiene gestión de pista', () => {
  const h = harness('timeline'), tr = h.resource.tracks[0]
  tr.kind = 'bake'
  h.ctx.trackMenu(h.event(), tr)
  assert.equal(h.store.menu.items.find((it) => it.label === 'Añadir clave en el cabezal').disabled, true)
  h.ctx.laneMenu(h.event(), tr)
  assert.equal(h.store.menu.items.find((it) => it.label === 'Añadir clave aquí').disabled, true)
  assert.ok(h.store.menu.items.find((it) => it.label === 'Eliminar pista'))
})

test('Timeline · menú de clave selecciona por ID, duplica, elimina y posiciona cabezal', () => {
  const h = harness('timeline'), tr = h.resource.tracks[0], key = tr.keys[0]
  h.ctx.keyMenu(h.event(), tr, key)
  assert.equal(h.selection.value.k, 'k1')
  h.choose('Ir al cabezal')
  assert.equal(h.head.value, 1)
  h.ctx.keyMenu(h.event(), tr, key)
  h.choose('Duplicar clave')
  assert.equal(tr.keys.length, 2)
  h.ctx.keyMenu(h.event(), tr, key)
  h.choose('Eliminar clave')
  assert.equal(tr.keys.some((k) => k.id === 'k1'), false)
})

test('Timeline · menú sobre espacio vacío inserta en el tiempo apuntado, no en el cabezal', () => {
  const h = harness('timeline'), tr = h.resource.tracks[0]
  h.head.value = 0
  h.ctx.laneMenu(h.event(310), tr)
  assert.ok(h.store.menu.items.find((it) => it.label === 'Eliminar pista'))
  h.choose('Añadir clave aquí')
  assert.equal(tr.keys.at(-1).t, 3)
})

test('Menú de Timeline no modifica otro documento cuando cambia el recurso activo', () => {
  const h = harness('timeline'), tr = h.resource.tracks[0]
  h.ctx.trackMenu(h.event(), tr)
  const previous = h.store.menu.items.find((it) => it.label === 'Eliminar pista')
  h.resourceRef.value = { id: 'B', tracks: [{ id: 'tr1', keys: [] }], events: [] }
  previous.run()
  assert.equal(h.resourceRef.value.tracks.length, 1)
})

test('Sintaxis JS y contrato previo S02 conservados', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lf-s03-'))
  try {
    for (const [name, content] of [['TimelinePanel', timeline]]) {
      const js = content.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
      assert.ok(js)
      const file = join(dir, `${name}.mjs`)
      writeFileSync(file, js)
      const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
      assert.equal(check.status, 0, check.stderr)
      assert.match(content, /@dblclick="laneDbl\(\$event, tr\)"/)
      assert.match(content, /@pointerdown="keyDown\(\$event, tr, k\)"/)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
