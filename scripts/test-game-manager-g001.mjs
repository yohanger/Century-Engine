// LF-GAME-MANAGER-G001: contratos del recurso y cableado de Editor/Player.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeGameManager, sceneGameManager, sceneGameConfig, MANAGER_FOLDER, MANAGER_EXT } from '../src/engine/runtime/game-manager.js'

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const data = () => ({
  game: { player: 'fps', fov: 75, walk: 3 }, activeSceneId: 'sceneA',
  scenes: [{ id: 'sceneA', gameManagerId: 'gm_a' }, { id: 'sceneB' }, { id: 'sceneC', gameManagerId: 'gone' }],
  gameManagers: [{ id: 'gm_a', name: 'Cámara fija.gamemanager', player: 'none', camera: 'cam_a', profile: 'pr_a' }],
  profiles: [{ id: 'pr_a', name: 'Noche.profile' }],
})
test('GM-01: carpeta y extensión oficiales', () => { assert.equal(MANAGER_FOLDER, 'Assets/GameManagers'); assert.equal(MANAGER_EXT, '.gamemanager') })
test('GM-02: defaults sin jugador obligado', () => { const a = normalizeGameManager(); assert.equal(a.player, 'inherit'); assert.equal(a.camera, ''); assert.equal(a.profile, '') })
test('GM-03: acepta los campos persistidos de un recurso', () => { const a = normalizeGameManager(data().gameManagers[0]); assert.equal(a.player, 'none'); assert.equal(a.camera, 'cam_a'); assert.equal(a.profile, 'pr_a') })
test('GM-04: normaliza valores no válidos sin crear objetos', () => { const a = normalizeGameManager({ player: [], camera: {}, profile: 10 }); assert.equal(a.player, 'inherit'); assert.equal(a.camera, ''); assert.equal(a.profile, '') })
test('GM-05: admite identificador extensible de Player', () => { assert.equal(normalizeGameManager({ player: 'third_person' }).player, 'third_person') })
test('GM-06: evita identificadores inseguros de Player', () => { assert.equal(normalizeGameManager({ player: '<script>' }).player, 'inherit') })
test('GM-07: resolución por escena, no por primer elemento de la lista', () => { assert.equal(sceneGameManager(data(), 'sceneA').id, 'gm_a') })
test('GM-08: escena sin GameManager no lo crea', () => { assert.equal(sceneGameManager(data(), 'sceneB'), null) })
test('GM-09: referencia rota no genera un recurso fantasma', () => { assert.equal(sceneGameManager(data(), 'sceneC'), null) })
test('GM-10: escenario sin escenas no produce excepción', () => { assert.equal(sceneGameManager({}), null) })
test('GM-11: Player none prevalece solamente en escena asignada', () => { const p = data(); assert.equal(sceneGameConfig(p, 'sceneA').config.player, 'none'); assert.equal(sceneGameConfig(p, 'sceneB').config.player, 'fps') })
test('GM-12: reglas del proyecto no se pierden al aplicar Player', () => { const r = sceneGameConfig(data()); assert.equal(r.config.walk, 3); assert.equal(r.config.fov, 75) })
test('GM-13: GameManager sin override hereda Player del proyecto', () => { const p = data(); p.gameManagers[0].player = 'inherit'; assert.equal(sceneGameConfig(p).config.player, 'fps') })
test('GM-14: un perfil borrado no bloquea el juego', () => { const p = data(); p.profiles = []; assert.equal(sceneGameManager(p).profile, '') })
test('GM-15: la resolución no modifica el recurso guardado', () => { const p = data(); p.profiles = []; sceneGameManager(p); assert.equal(p.gameManagers[0].profile, 'pr_a') })
test('GM-16: los dos proyectos pueden compartir el mismo recurso sin sobrescribirse', () => { const p = data(); p.scenes[1].gameManagerId = 'gm_a'; assert.equal(sceneGameManager(p, 'sceneB').id, 'gm_a') })
test('GM-17: JSON conserva identidad, perfil y Player', () => { const p = structuredClone(data()); assert.deepEqual(sceneGameConfig(JSON.parse(JSON.stringify(p))).manager, sceneGameConfig(p).manager) })
test('GM-18: el registro de recursos se integra con allEntries y ensureFs', () => { const s = source('src/core/project.js'); assert.match(s,/for \(const c of project\.gameManagers/); assert.match(s,/meta\.gameManagers = Array\.isArray/); assert.match(s,/gameManagers: \[\]/) })
test('GM-19: las escenas conservan la referencia al recurso fuera de objects', () => { const s = source('src/core/project.js'); assert.match(s,/s\.gameManagerId/); assert.match(s,/SCENE_KEYS = \['objects', 'environment', 'terrain', 'signalConnections'\]/) })
test('GM-20: el proyecto exportado incluye los recursos estructurados', () => { const s = source('src/engine/runtime/package/format.js'); assert.ok(!/gameManagers/.test(s.match(/const EDITOR_ONLY =[^\n]+/)?.[0] || '')); assert.match(source('src/engine/runtime/package/host.js'),/\.\.\.pkg\.game/) })
test('GM-21: Player usa la misma autoridad de GameManager al empezar y cambiar escenas', () => { const s = source('src/engine/runtime/events/play.js'); assert.match(s, /this\._managerScene\(\)/); assert.match(s,/createPlayer\('none', this\)/); assert.match(s,/this\.player\.applyConfig\(this\.game\?\.db\?\.player\)/) })
test('GM-22: la cámara existente tiene prioridad explícita del recurso y fallback main', () => { const s = source('src/engine/runtime/events/play-camera.js'); assert.match(s,/this\._gm\?\.camera/); assert.match(s,/x\.props\?\.main/) })
test('GM-23: perfil usa la ruta oficial y conserva Spawn como override', () => { const s = source('src/engine/runtime/events/play-profile.js'); assert.match(s, /this\._gm\?\.profile/); assert.match(s, /spawnObj\?\.props\?\.profile \|\| this\._gm\?\.profile/) })
test('GM-24: escenas del paquete exportan la dependencia GameManager', () => { const s = source('src/core/levelpackage.js'); assert.match(s,/gameManagerId/); assert.match(s,/scan\(entry\.ref, id\)/) })
test('GM-25: importación .levelpackage acepta el recurso y remapea IDs', () => { const s = source('src/core/levelpackage-import.js'); assert.match(s,/gamemanager: 'gameManagers'/); assert.match(s,/e\.kind === 'gamemanager'/); assert.match(s,/const ref = \{ \.\.\.meta, id: action\.id/) })
test('GM-26: la interfaz ofrece creación, edición y asignación', () => { assert.match(source('src/components/ProjectPanel.vue'), /newGameManager/); assert.match(source('src/components/ScenePanel.vue'), /assignSceneGameManager/); assert.match(source('src/components/InspectorDock.vue'),/GameManagerEditor/) })
test('GM-27: borrado limpia referencias en todas las escenas', () => { const s = source('src/core/state/game-managers.js'); assert.match(s,/for \(const scene of p\.scenes\)/) })
test('GM-29: .lfproj exporta GameManager como recurso JSON y no exige binario', () => { const s = source('src/core/lfproj.js'); assert.match(s,/e\.kind === 'profile' \|\| e\.kind === 'gamemanager'/); assert.match(s,/JSON\.stringify\(e\.ref\)/) })
test('GM-30: .lfproj recupera GameManager como recurso estructurado', () => { const s = source('src/core/lfproj.js'); assert.match(s,/Object\.assign\(e\.ref, JSON\.parse\(await f\.async\('string'\)\)\)/) })
test('GM-28: ningún controlador nuevo ni compositor duplicado', () => { const s = source('src/engine/runtime/game-manager.js'); assert.ok(!s.includes('class Game')); assert.ok(!s.includes('new WebGLRenderer')) })
