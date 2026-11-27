import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { InputState, defaultInputMap } from '../src/engine/runtime/input/inputmap.js'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/fps/s16-g004-locomotion-scene.json', import.meta.url), 'utf8'))
const code = readFileSync(new URL('./fixtures/fps/s16-g004-locomotion-node.js', import.meta.url), 'utf8')
const makeScript = new Function('game', 'node', `${code}\nreturn { ready: _ready, frame: _process, physics: _physics_process }`)

function setup() {
  const input = new InputState(defaultInputMap())
  const characters = new Map()
  const game = {
    level: { canRun: true, canJump: true, speedScale: 1 },
    input: { vector: (...args) => input.vector(...args), justPressed: name => input.justPressed(name), pressed: name => input.pressed(name) },
    player: null,
  }
  const create = (id, yaw = 0) => {
    const body = { id, velocity: [0, 0, 0], onFloor: true, rotation: [0, yaw, 0] }
    const settings = { walk: 3, run: 5.5, groundAccel: 16, groundDecel: 20, turnBoost: 1, slideAccel: 16, slideDecel: 20,
      airAccel: 16, airDecel: 20, jumpOnSteep: false, jumpAuto: false, jump: 5,
      gravity: 24, jumpHeight: 1.1, jumpTime: 0.3, coyote: 0, jumpBuffer: 0.15 }
    const player = { ...settings, get node() { return { id: body.id } }, get ground() { return body.onFloor ? 'stable' : 'air' }, control: true, mode: 'free' }
    const script = makeScript({ ...game, get player() { return player } }, body)
    script.ready()
    characters.set(id, body)
    return { script, body }
  }
  const frame = (tokens, dt = 1 / 60, steps = 1, charactersToTick = []) => {
    for (const [token, down] of Object.entries(tokens)) input.set(token, down ? 1 : 0)
    input.step()
    for (const c of charactersToTick) c.script.frame(dt)
    for (let i = 0; i < steps; i++) for (const c of charactersToTick) c.script.physics(dt)
  }
  return { input, game, create, frame, characters }
}

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} !== ${b}`)

test('G004-01 · fixture y scripts de nodo válidos sin controlador FPS', () => {
  assert.doesNotThrow(() => validateNodeTree(fixture.objects))
  assert.equal(fixture.objects.filter(o => o.type === 'characterbody3d').length, 2)
  for (const asset of fixture.scripts) {
    assert.equal(asset.execution, 'node')
    assert.equal(asset.code, code)
    assert.doesNotThrow(() => new Function('game', 'node', asset.code))
  }
  assert.ok(!/FpsPlayer|player\.move|setInterval|requestAnimationFrame|\.position\s*=/.test(code))
})

test('G004-02 · acciones integradas del Input Map sin teclas fijadas en el script', () => {
  const names = new Set(defaultInputMap().actions.map(a => a.name))
  for (const name of ['move_forward','move_back','move_left','move_right','run','jump']) assert.ok(names.has(name))
  assert.doesNotMatch(code, /KeyW|KeyA|KeyS|KeyD|Space|ShiftLeft/)
})

test('G004-03 · caminar hacia adelante conserva Y y usa Z negativa', () => {
  const f = setup(), c = f.create('a'); c.body.velocity[1] = -1.25
  f.frame({KeyW:true}, 1/60, 1, [c])
  assert.ok(c.body.velocity[2] < 0)
  near(c.body.velocity[1], -1.25)
  for (let i=0; i<25; i++) f.frame({}, 1/60, 1, [c])
  near(c.body.velocity[2], -3)
})

test('G004-04 · correr usa Input Map y mantiene la velocidad objetivo', () => {
  const f = setup(), c = f.create('a')
  f.frame({KeyW:true,ShiftLeft:true},1/60,1,[c])
  for (let i=0; i<35; i++) f.frame({},1/60,1,[c])
  near(c.body.velocity[2],-5.5)
})

test('G004-05 · diagonal normalizada y dirección del propietario', () => {
  const f = setup(), c = f.create('a',90)
  f.frame({KeyW:true,KeyD:true},1/60,1,[c])
  for (let i=0; i<25; i++) f.frame({},1/60,1,[c])
  near(Math.hypot(c.body.velocity[0],c.body.velocity[2]),3)
  assert.ok(c.body.velocity[0] < 0)
})

test('G004-06 · soltar movimiento desacelera y no modifica velocidad vertical', () => {
  const f = setup(), c = f.create('a')
  f.frame({KeyW:true},1/60,1,[c])
  for (let i=0; i<20; i++) f.frame({},1/60,1,[c])
  c.body.velocity[1] = 2
  f.frame({KeyW:false},1/60,1,[c])
  for (let i=0; i<15; i++) f.frame({},1/60,1,[c])
  near(c.body.velocity[2],0)
  near(c.body.velocity[1],2)
})

test('G004-07 · un salto desde suelo consume el impulso una sola vez', () => {
  const f = setup(), c = f.create('a')
  f.frame({Space:true},1/60,1,[c])
  near(c.body.velocity[1],5)
  c.body.velocity[1]=4.8; c.body.onFloor=false
  f.frame({},1/60,1,[c])
  near(c.body.velocity[1],4.8)
})

test('G004-08 · salto anticipado: no salta en aire y se ejecuta al aterrizar dentro del buffer', () => {
  const f = setup(), c = f.create('a'); c.body.onFloor=false
  f.frame({Space:true},1/60,1,[c])
  near(c.body.velocity[1],0)
  c.body.onFloor=true
  f.frame({Space:false},1/60,1,[c])
  near(c.body.velocity[1],5)
})

test('G004-09 · preserva pulso de salto si no hay paso físico en ese frame', () => {
  const f=setup(),c=f.create('a')
  f.frame({Space:true},1/60,0,[c])
  f.frame({Space:false},1/60,1,[c])
  near(c.body.velocity[1],5)
})

test('G004-10 · dos personajes con el mismo recurso no comparten estado de salto', () => {
  const f=setup(),a=f.create('a'),b=f.create('b')
  a.body.onFloor=false
  f.frame({Space:true},1/60,0,[a])
  f.frame({Space:false},1/60,1,[a,b])
  near(a.body.velocity[1],0)
  near(b.body.velocity[1],0)
  f.frame({Space:true},1/60,1,[b])
  near(b.body.velocity[1],5)
  near(a.body.velocity[1],0)
})

test('G004-11 · reasignar la acción cambia el control sin editar el script', () => {
  const f=setup(),c=f.create('a')
  const a=f.input.map.actions.find(x=>x.name==='move_forward')
  a.bindings=['KeyI']
  f.input.setMap(f.input.map)
  f.frame({KeyW:true},1/60,1,[c])
  near(c.body.velocity[2],0)
  f.frame({KeyW:false,KeyI:true},1/60,1,[c])
  assert.ok(c.body.velocity[2]<0)
})

test('G004-12 · orden existente: Input → Scripts → único paso Jolt', () => {
  const control=readFileSync(new URL('../src/engine/runtime/events/play-controls.js',import.meta.url),'utf8')
  const a=control.indexOf('this._inputFrame(dt)')
  const p=control.indexOf('this.ed.nodeLifecycle?.physicsProcess(fdt)')
  const j=control.indexOf('this.phys?.step(fdt)')
  assert.ok(a>=0&&p>a&&j>p)
  const spatial=readFileSync(new URL('../src/engine/runtime/physics/node-spatial.js',import.meta.url),'utf8')
  assert.match(spatial,/instance\.ExtendedUpdate\(dt/)
})
