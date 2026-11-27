import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Vec3} from '../dist/index.js'
import {createWaterWorld, WaterDisturbances} from '../dist/fluids/water/index.js'
const v = (...p) => Vec3.of(...p)

const makePool = () => {
  const w = createWaterWorld({voxels:{cellSizeMeters:.28}})
  w.fillBox({min:v(-2,0,-1),max:v(2,.28,1)},2)
  return w
}

test('Walking ripples follow distance traveled and stop on dry ground or at rest', () => {
  const world = makePool(), model = new WaterDisturbances()
  const sample = (x,y,speed) => model.observe(world,[{id:'person',kind:'character',position:v(x,y,0),
    velocity:v(speed,0,0),radiusMeters:.3}],.05)
  const mass = world.totalMassKg
  assert.deepEqual(sample(-1,.03,0),[])
  assert.deepEqual(sample(-.85,.03,3),[])
  assert.deepEqual(sample(-.7,.03,3),[])
  const event = sample(-.55,.03,3)[0]
  assert.equal(event.kind,'step')
  assert.equal(event.point.x,-.55)
  assert.ok(event.point.y>.03)
  assert.ok(event.lifeSeconds*event.waveSpeedMS>1)
  for(let i=0;i<12;i++) assert.deepEqual(sample(-.55,.03,0),[])
  assert.deepEqual(sample(4,.03,3),[])
  assert.deepEqual(sample(-.6,1,0),[])
  assert.equal(world.totalMassKg,mass)
  world.shutdown()
})

test('A falling body emits a surface impact with spray once per entry', () => {
  const world = makePool(), model = new WaterDisturbances()
  const sample = (y,vy) => model.observe(world,[{id:'object',kind:'body',position:v(0,y,0),
    velocity:v(0,vy,0),radiusMeters:.25}],.08)
  assert.deepEqual(sample(.75,-6),[])
  const [event] = sample(.19,-7)
  assert.equal(event.kind,'impact')
  assert.ok(event.point.y>.19 && event.splash>.65)
  assert.deepEqual(sample(.06,-1.4),[])
  assert.deepEqual(sample(.9,3),[])
  assert.equal(sample(.18,-8)[0].kind,'impact')
  world.shutdown()
})

test('Shallow water can leave a terrain cut even when both fixed face samples are blocked', () => {
  for (const barrier of [false,true]) {
    const h = .28
    const w = createWaterWorld({physical:{maxSubstepSeconds:1/60},voxels:{cellSizeMeters:h,minFilmFill:.006,sleepAtRest:true}})
    w.addBoundary({kind:'heightfield',origin:v(0,0,0),columns:21,rows:2,cellSizeXMeters:h/2,cellSizeZMeters:h,
      heightsMeters:Array.from({length:42},(_,i)=>Math.max(.08,.635-.28*(i%21)*h/2))})
    for (const [point,normal] of [[[0,0,0],[0,0,1]],[[0,0,h],[0,0,-1]],[[h,0,0],[1,0,0]],[[2.5,0,0],[-1,0,0]]]) {
      w.addBoundary({kind:'plane',point:v(...point),normal:v(...normal)})
    }
    if (barrier) w.addBoundary({kind:'box',center:v(2*h,.4,h/2),halfExtents:v(.04,.5,h)})
    const volume = w.fillBox({min:v(h,.48,0),max:v(2*h,.56,h)},.0011)
    assert.equal(w.faceOpening(1,1,0,0),0)
    for (let step=0;step<240&&w.needsStep;step++) w.step(1/60)
    const downhill = [...w.cells()].filter(c=>c.x>1).reduce((sum,c)=>sum+c.volumeM3,0)
    assert.ok(barrier ? downhill<1e-12 : downhill>.85*volume, JSON.stringify({barrier,downhill,volume}))
    assert.ok(Math.abs(w.totalVolumeM3-volume)<1e-12)
    w.shutdown()
  }
})
