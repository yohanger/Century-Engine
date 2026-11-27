// Pruebas de la lógica de la app (sin React ni móvil): operaciones del editor y el camino completo captura → .lfcap → LevelForge.
//   npm test   (o node scripts/test-app.mjs desde capture-app/)
import assert from 'node:assert/strict'
import * as Ops from '../src/editorOps.js'
import { simulateCapture, serialize, parse, bake, newCapture } from '../src/core/index.js'
import { simulatedFrame } from '../src/pose/simframe.js'

let n = 0
const ok = (m) => { n++; console.log('✓', m) }
const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, `${m}: ${a} ≉ ${b}`)

let cap = simulateCapture({ seconds: 6, jitter: 0.01 })
const orig = JSON.stringify(cap)
// recorte y tomas
cap = Ops.setTrimStart(cap, 0.5); cap = Ops.setTrimEnd(cap, 5.5)
assert.deepEqual(Ops.trimOf(cap), [0.5, 5.5])
cap = Ops.addCut(cap, 3); cap = Ops.addCut(cap, 3.02) // demasiado cerca: se ignora
cap = Ops.addCut(cap, 0.55) // pegado al inicio: se ignora
assert.deepEqual(cap.edits.cuts, [3])
assert.equal(Ops.takesOf(cap).length, 2)
cap = Ops.setEdit(cap, { speed: 2 })
near(Ops.takesOf(cap)[0].duration, 1.25, 1e-6, 'toma 1 a ×2')
assert.equal(JSON.parse(orig).edits.speed, 1); assert.equal(JSON.parse(orig).edits.trim, null) // la captura original no se toca
ok('recorte, división en tomas (ignora cortes pegados) y velocidad')
cap = Ops.setTrimStart(cap, 4) // el corte en 3 queda fuera del recorte
assert.deepEqual(cap.edits.cuts, [])
cap = Ops.resetTrim(cap); cap = Ops.addCut(cap, 3)
ok('mover el inicio del recorte elimina los cortes que quedan fuera')

// efectos
let r = Ops.addLayer(cap, 'text', 1); cap = r.cap
cap = Ops.updateLayer(cap, r.id, { params: { text: 'Hola' }, t1: 2.5 })
const fxA = Ops.effectsAt(cap, 2); assert.equal(fxA.caption, 'Hola')
r = Ops.addLayer(cap, 'fade', 5, 1); cap = r.cap
near(Ops.effectsAt(cap, 5.5).fade, 0.5, 1e-6, 'fundido a la mitad')
r = Ops.addLayer(cap, 'letterbox', 0, 6); cap = r.cap
assert.equal(Ops.effectsAt(cap, 3).letterbox, 12)
const sh = Ops.addLayer(cap, 'shake', 2, 1); cap = sh.cap
assert.ok(Ops.effectsAt(cap, 2.5).shake > 0)
cap = Ops.removeLayer(cap, sh.id); assert.equal(cap.layers.length, 3)
ok('capas: subtítulo, fundido, barras y temblor (añadir, editar, borrar, vista previa)')

// cámara
const k = Ops.orbitKey(3, 1.1, 90)
near(k.pos[0], 3, 1e-6, 'órbita x'); near(k.pos[2], 0, 1e-6, 'órbita z'); near(k.rot[1], 90, 1e-6, 'mira al actor (yaw = ángulo)'); near(k.rot[0], 0, 1e-6, 'pitch a la altura de mirada')
cap = Ops.setCameraKey(cap, 0, Ops.rigKey(Ops.SHOTS.general.rig))
cap = Ops.setCameraKey(cap, 0.02, Ops.rigKey(Ops.SHOTS.primer.rig)) // sustituye la de 0
const before = cap.camera.keys.length
cap = Ops.setCameraKey(cap, 4.08, Ops.rigKey(Ops.SHOTS.lateral.rig))
assert.equal(cap.camera.keys.length, before + 1)
const mid = Ops.cameraAt(cap, 2)
assert.ok(mid && mid.pos[0] > 0, 'interpolación de cámara entre claves')
cap = Ops.removeCameraKeyNear(cap, 4.1); assert.equal(cap.camera.keys.length, before)
// pase de cámara: el móvil gira 30° a la izquierda y vuelve en 2 s
const samples = Array.from({ length: 61 }, (_, i) => ({ t: 1 + i / 30, rot: [0, 30 * Math.sin((i / 60) * Math.PI), 0], zoom: 1 + i / 60 }))
const rig = Ops.SHOTS.medio.rig
cap = Ops.applyCameraPass(cap, samples, rig)
const inPass = cap.camera.keys.filter((x) => x.t >= 1 && x.t <= 3)
assert.ok(inPass.length >= 3 && inPass.length < 61, `claves simplificadas ${inPass.length}`)
near(Ops.cameraAt(cap, 2).rot[1], Ops.rigKey(rig).rot[1] + 30, 1.5, 'yaw a mitad del pase')
assert.ok(Ops.cameraAt(cap, 3).fov < Ops.rigKey(rig).fov, 'el zoom estrecha el campo de visión')
ok('cámara virtual: encuadres, claves, interpolación, borrar y pase grabado con el móvil (simplificado)')

// vista previa
const pv = Ops.previewOf(cap)
assert.equal(pv.frames.length, cap.body.frames.length); assert.ok(pv.floor < -0.5 && pv.floor > -1.3, 'suelo ' + pv.floor)
assert.ok(Ops.frameAt(pv, 1.234))
ok('vista previa: fotogramas calibrados/suavizados y altura del suelo')

// archivo .lfcap → lo que importa LevelForge
const text = serialize(cap), back = parse(text)
const { takes } = bake(back)
assert.equal(takes.length, 2)
near(takes[0].duration, 1.5, 0.05, 'toma 1 (×2)')
assert.ok(takes[0].layers.some((l) => l.kind === 'text') && takes.some((t) => t.layers.some((l) => l.kind === 'fade')))
assert.ok(takes[0].camera.length >= 2)
ok(`.lfcap de ${(text.length / 1024).toFixed(0)} KB: ${takes.length} tomas con cámara y efectos listas para LevelForge`)

// fuente simulada de la app = mismo formato que MediaPipe
const p = simulatedFrame(0.5); assert.equal(p.length, 132)
const c2 = newCapture('x'); c2.body.frames = [0, 1 / 30, 2 / 30].map((t) => ({ t, p: simulatedFrame(t) }))
assert.equal(bake(c2).takes[0].frames.length >= 2, true)
ok('fuente simulada con 33 puntos como MediaPipe')
console.log(`\n${n} comprobaciones de la app OK`)
