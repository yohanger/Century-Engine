// CORR-001 · QA geométrico y volumétrico frente al aplanamiento visual observado.
// Los umbrales verifican etapas de la cadena; no acreditan por sí solos calidad visual.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CloudField, MORPH } from '../src/engine/runtime/world/cloudfield.js'
import { PRESETS } from '../src/engine/runtime/world/weather.js'
import { CLOUD_VOLUME_DENSITY } from '../src/engine/runtime/render/sky-cloud-volume.js'
import { readFileSync } from 'node:fs'

const state = p => ({ coverage:p.coverage, density:p.density / 2.1, humidity:p.humidity,
  storm:Math.min(1,p.bolts / 7), rain:45 * p.rain, altitude:p.altitude })
const field = (preset, seed = 42, sizeMul = 2) => {
  const f = new CloudField({ seed, sizeMul })
  f.update(state(PRESETS[preset]), [0,0], 0)
  f.prepare(0,0)
  return f
}
const extents = f => {
  const list = [], values = []
  for (const c of f.cells) {
    if (!c.active || c.condensate <= 0.03) continue
    const n = f.primitives(c,list)
    let low = Infinity, high = -Infinity
    for(let i=0;i<n;i++) {
      const p=list[i]
      low=Math.min(low,p.y-p.ry); high=Math.max(high,p.y+p.ry)
    }
    values.push(high-low)
  }
  values.sort((a,b)=>a-b)
  return {count:values.length,median:values[Math.floor(values.length/2)]??0,
    max:values.at(-1)??0,min:values[0]??0}
}
const occupiedLayers = v => {
  const plane=v.N*v.N, out=[]
  for(let y=0;y<v.depth;y++){
    let n=0
    for(let i=y*plane;i<(y+1)*plane;i++) if(v.data[2*i+1]>60)n++
    if(n>5)out.push(y)
  }
  return out
}

test('M3D-01 · buen tiempo tiene cuerpos con altura, no discos de 180 m', () => {
  const f=field('partly'), a=extents(f)
  assert.ok(a.count>=12,`celdas visibles ${a.count}`)
  assert.ok(a.median>500 && a.median<1300,`mediana ${a.median.toFixed(1)} m`)
})
test('M3D-02 · nublado presenta volumen tridimensional sin forzar una tormenta', () => {
  const a=extents(field('cloudy'))
  assert.ok(a.count>=15)
  assert.ok(a.median>420 && a.median<1300,`mediana ${a.median.toFixed(1)} m`)
})
test('M3D-03 · los estratos conservan una extensión horizontal dominante', () => {
  const f=field('overcast'), a=extents(f)
  assert.ok(a.median>220 && a.median<720,`mediana ${a.median.toFixed(1)} m`)
  const c=f.cells.find(x=>x.active&&x.condensate>.3), p=[]
  f.primitives(c,p)
  assert.ok(p[0].rx/p[0].ry>4,'la nube estratificada debe seguir siendo extensa')
})
test('M3D-04 · las torres convectivas no se exageran ni retroceden a discos', () => {
  const a=extents(field('storm'))
  assert.ok(a.median>2300 && a.median<5500,`mediana ${a.median.toFixed(1)} m`)
})
test('M3D-05 · cloudSize incrementa también el desarrollo vertical en cúmulos', () => {
  const a=extents(field('partly',42,1)), b=extents(field('partly',42,2))
  assert.ok(b.median>a.median*1.20,`1x ${a.median.toFixed(0)} 2x ${b.median.toFixed(0)}`)
})
test('M3D-06 · siluetas dependen de humedad/estructura, nunca de la etiqueta MORPH', () => {
  const f=field('partly'), c=f.cells.find(x=>x.active&&x.condensate>.3), a=[]
  assert.ok(c)
  const n=f.primitives(c,a), before=a.slice(0,n).map(p=>({...p}))
  for(const m of Object.values(MORPH)){
    c.morph=m;c.prevMorph=m;c.blend=.5
    f.primitives(c,a)
    for(let i=0;i<n;i++) for(const k of ['x','y','z','rx','ry','rz','str','type'])
      assert.equal(a[i][k],before[i][k])
  }
})
test('M3D-07 · geometría reproducible por semilla y sin asignación de primitivas por paso', () => {
  const f=field('partly'), g=field('partly'), p=[], q=[]
  const a=f.cells.find(c=>c.active&&c.condensate>.2)
  const b=g.cells.find(c=>c.active&&c.key===a.key)
  assert.ok(b)
  f.primitives(a,p);g.primitives(b,q)
  assert.deepEqual(p.slice(0,6),q.slice(0,6))
  const pointers=p.slice(0,6)
  f.primitives(a,p)
  for(let i=0;i<6;i++) assert.strictEqual(p[i],pointers[i])
})
test('M3D-08 · el condensado horneado ocupa volumen en la Y real', () => {
  const f=field('partly'), m=f.bake(), v=m.volume, p=PRESETS.partly
  v.advance(0,state(p),[0,0])
  const layers=occupiedLayers(v)
  assert.ok(layers.length>=8,`capas activas ${layers.length}: ${layers.join(',')}`)
  assert.ok(layers.at(-1)-layers[0]>=7)
  assert.equal(v.depth,16)
})
test('M3D-09 · la losa y el volumen abarcan las nuevas cimas sin recortar la nube', () => {
  const f=field('partly'),m=f.bake(),v=m.volume
  const list=[],tops=[]
  for(const c of f.cells){if(!c.active||c.condensate<=.03)continue
    const n=f.primitives(c,list)
    for(let i=0;i<n;i++)tops.push(c.y+list[i].y+list[i].ry)
  }
  assert.ok(v.base<=m.slabBase && v.base+v.height>=m.slabBase+m.slabThick)
  assert.ok(Math.max(...tops)<=v.base+v.height+0.1, 'el techo no puede recortar lóbulos activos')
})
test('M3D-10 · textura RG8, 16 niveles y raymarch previo se conservan', () => {
  const f=field('partly'), v=f.map.volume
  assert.equal(v.data.length,v.N*v.N*v.depth*2)
  assert.match(CLOUD_VOLUME_DENSITY,/texture\(uCVolume, vec3\(uv, h\)\)\.rg/)
  const sky=readFileSync(new URL('../src/engine/runtime/render/skylib.js',import.meta.url),'utf8')
  assert.match(sky,/simulatedCloudDensity\(wp, organized, altitude, full\)/)
  assert.match(sky,/int cloudSteps = cloudFar > cloudNear \? uCloudSteps : 0;/)
})

test('M3D-11 · el recorte de rangos de _stamp conserva el condensado anterior', async () => {
  const { CloudVolume } = await import('../src/engine/runtime/world/cloud-volume.js')
  const m = { N:32, half:3200, cx:0, cz:0, slabBase:700, slabThick:1400 }
  const srcs = [
    {x:-900,y:1450,z:500,rx:1050,ry:740,rz:690,str:1.25},
    {x:900,y:1900,z:-500,rx:650,ry:380,rz:860,str:.95},
    {x:0,y:1600,z:150,rx:540,ry:245,rz:530,str:.7},
  ]
  const optimized = new CloudVolume(m), reference = new CloudVolume(m)
  // Referencia acotada al runner: recorrido rectangular anterior a CORR-001.
  reference._stamp = function(p) {
    const n=this.N,dx=this.spacing,dy=this.height/this.depth
    const cx=(p.x-this.cx+this.half)/dx-.5,cz=(p.z-this.cz+this.half)/dx-.5,cy=(p.y-this.base)/dy-.5
    const rx=Math.max(.7,p.rx/dx),ry=Math.max(.7,p.ry/dy),rz=Math.max(.7,p.rz/dx)
    const i0=Math.max(0,Math.floor(cx-1.45*rx)),i1=Math.min(n-1,Math.ceil(cx+1.45*rx))
    const j0=Math.max(0,Math.floor(cz-1.45*rz)),j1=Math.min(n-1,Math.ceil(cz+1.45*rz))
    const h0=Math.max(0,Math.floor(cy-1.35*ry)),h1=Math.min(this.depth-1,Math.ceil(cy+1.35*ry))
    for(let h=h0;h<=h1;h++)for(let j=j0;j<=j1;j++){
      const yz=((h-cy)/ry)**2+((j-cz)/rz)**2,row=(h*n+j)*n
      if(yz>=2||i0>i1)continue
      const range=(h*n+j)*2
      this._sourceRanges[range]=Math.min(i0,this._sourceRanges[range])
      this._sourceRanges[range+1]=Math.max(i1,this._sourceRanges[range+1])
      for(let i=i0;i<=i1;i++){
        const r2=yz+((i-cx)/rx)**2
        const core=Math.max(0,1-r2),edge=Math.max(0,1-r2/2)
        this._core[row+i]+=core*core*(3-2*core)*p.str
        this._lift[row+i]+=edge*edge*p.str
      }
    }
  }
  optimized.rebuild(m,srcs);reference.rebuild(m,srcs)
  assert.deepEqual(optimized._core,reference._core)
  assert.deepEqual(optimized._lift,reference._lift)
  const forcing={coverage:.85,humidity:.92,storm:.25}
  for(let t=0;t<10;t++){
    optimized.advance(t?0.5:0,forcing,[12,4]);reference.advance(t?0.5:0,forcing,[12,4])
    assert.deepEqual(optimized.data,reference.data,`estado ${t}`)
  }
})
