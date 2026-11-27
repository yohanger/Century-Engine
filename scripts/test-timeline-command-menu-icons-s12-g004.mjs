import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { newTrack, newTimeline, newKey, normalizeTimeline, TRACK_KINDS } from '../src/core/timeline/model.js'
import { COMMANDS, newCommand } from '../src/engine/runtime/events/commandDefs.js'

const root = new URL('../', import.meta.url)
const source = (path) => readFileSync(new URL(path, root), 'utf8')
const panel = source('src/components/TimelinePanel.vue')
const icon = source('src/components/Icon.vue')
const catalog = source('src/engine/runtime/events/commandDefs.js')

const items = [['camera','bi-camera-video'],['node','bi-bounding-box'],['audio','bi-soundwave'],['commands','bi-list-check'],['method','bi-braces']]

test('G004-01 · el menú crea grupos y los cinco tipos editables sin bake', () => {
  assert.deepEqual(Object.keys(TRACK_KINDS).filter(k=>k!=='bake'),items.map(x=>x[0]))
  assert.match(panel, /v-for="\(kind, key\) in addableKinds"/)
  assert.match(panel, /@click="createGroup\(\)"/)
  assert.match(panel, /@click="addTrack\(key\)"/)
})
test('G004-02 · no hay accesos de Naturaleza que creen comandos implícitos', () => {
  assert.doesNotMatch(panel, /addWeatherCue|nature-caption|Programar naturaleza|@click="addWeatherCue/)
  for (const text of ['Iniciar lluvia','Cambiar intensidad de lluvia','Detener lluvia','Relámpago sin trueno automático','Trueno independiente']) assert.ok(!panel.includes(text))
})
test('G004-03 · el menú no muestra glifos del modelo ni importa newCommand', () => {
  assert.doesNotMatch(panel, /\{\{\s*(?:k|kind)\.icon\s*\}\}/)
  assert.doesNotMatch(panel, /import\s*\{\s*newCommand\s*\}/)
  assert.match(panel, /:name="trackMenuGlyphs\[key\]"/)
})
test('G004-04 · los seis iconos Bootstrap se reutilizan desde Icon.vue', () => {
  assert.match(panel, /<Icon name="bi-folder-plus"/)
  for (const [kind,name] of items) {
    assert.match(panel,new RegExp(`${kind}: '${name}'`))
    assert.ok(icon.includes(`'${name}': [`),name)
  }
  assert.match(icon,/viewBox="bootstrap \? '0 0 16 16' : '0 0 24 24'"/)
  assert.match(icon,/<path v-for="\(part, index\) in bootstrap"/)
  assert.match(icon,/<path v-else :d="d" \/>/)
})
test('G004-05 · SVG completos, path no vacío, heredan color y están ocultos al lector', () => {
  assert.match(icon,/:fill="bootstrap \? 'currentColor' : 'none'"/)
  assert.match(icon,/aria-hidden="true"/)
  for (const [kind,name] of [['folder','bi-folder-plus'],...items]) {
    const match=icon.match(new RegExp(`'${name}': \\[([\\s\\S]*?)\\n  \\]`))
    assert.ok(match,kind)
    assert.ok(match[1].includes('d: '),kind)
    assert.ok(match[1].length>80,kind)
  }
})
test('G004-06 · foco y Escape siguen ligados al menú y regresan al botón', () => {
  assert.match(panel,/trackPopup\.value\?\.querySelector\('button'\)\?\.focus\(\)/)
  assert.match(panel,/trackButton\.value\?\.focus\(\)/)
  assert.match(panel,/:aria-expanded="addMenu"/)
  assert.match(panel,/:focus-visible/)
})
test('G004-07 · las etiquetas son texto legible y se mantienen colores por pista', () => {
  assert.match(panel,/<span>\{\{ kind\.label \}\}<\/span>/)
  assert.match(panel, /\{ color: kind\.color \}/)
  assert.match(panel, /<button v-for="\(kind, key\) in addableKinds"[^\n]*type="button"/)
})
test('G004-08 · catálogo meteorológico intacto, sin pistas paralelas', () => {
  for (const code of ['weather','weatherLightning','weatherThunder']) {
    assert.ok(COMMANDS[code]?.params?.length>=1,code)
    assert.ok(newCommand(code).code===code,code)
  }
  assert.match(catalog,/\.\.\.CMD_WORLD/)
})
test('G004-09 · se conserva una pista Naturaleza histórica con sus comandos', () => {
  const key=newKey('commands',1,{name:'Lluvia',list:[newCommand('weather',{preset:'rain'})]})
  const track=newTrack('commands',{id:'naturaleza-qa',name:'Naturaleza',keys:[key]})
  const timeline=normalizeTimeline(newTimeline('QA',{duration:5,tracks:[track]}))
  assert.equal(timeline.tracks[0].id,'naturaleza-qa')
  assert.equal(timeline.tracks[0].name,'Naturaleza')
  assert.equal(timeline.tracks[0].keys[0].list[0].code,'weather')
})
test('G004-10 · pistas nuevas conservan IDs, estructura y nombres del modelo', () => {
  const timeline=newTimeline('QA G004',{duration:7})
  for(const [kind] of items) timeline.tracks.push(newTrack(kind))
  assert.equal(new Set(timeline.tracks.map(x=>x.id)).size,items.length)
  assert.deepEqual(timeline.tracks.map(x=>x.kind),items.map(x=>x[0]))
  const normalized=normalizeTimeline(timeline)
  assert.deepEqual(normalized.tracks.map(x=>x.kind),items.map(x=>x[0]))
})
test('G004-11 · licencia MIT incluida y sin bootstrap CSS ni package añadido', () => {
  const license=source('docs/licenses/BOOTSTRAP_ICONS_1.13.2_MIT.txt')
  assert.match(license,/Copyright \(c\) 2019-2024 The Bootstrap Authors/)
  assert.match(license,/MIT License/)
  assert.match(license,/v1\.13\.2/)
  assert.doesNotMatch(source('package.json'), /"bootstrap-icons"/)
})
