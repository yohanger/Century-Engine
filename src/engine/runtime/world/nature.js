// Naturaleza viva: lo que reacciona al mundo (viento, clima, hora) y NO es terreno: viento en la vegetación, hojas que caen y animales.
// Un único punto de entrada para el visor: nature.update(frame, cámara, dt, …). El terreno no sabe nada de esto; el mundo (World) tampoco
// sabe de hojas ni de luciérnagas: aquí se leen sus resultados (frame y viento efectivo en World).
//
// El viento efectivo de World incluye obstáculos y circulación local; el uniforme global de vegetación
// usa una muestra en la cámara. El viento específico por árbol queda fuera de S01.
import { setWind } from '../render/windlib.js'
import { WETU } from '../render/wetlib.js'
import { LeafFX } from './leaves.js'
import { CritterSystem } from '../critters/system.js'
import { newVfxResource } from '../vfx/resource.js'
import { VfxSimulation } from '../vfx/simulation.js'
import { VfxBillboardRenderer } from '../vfx/render.js'
import { tornadoSurfaceAt, tornadoDustRate } from './tornado-surface.js'

export class NatureFX {
  /** `opts` = { terrains: () => Terrain[], objects: () => nodos de la escena, ground: (x, z) => altura | NaN, world?: World } */
  constructor(scene, opts) {
    this.opts = opts
    this.leaves = new LeafFX(scene)
    this.critters = new CritterSystem(scene, opts)
    this._t = 0
    this._wet = 0
    this._snow = 0
    this._tornadoDust = null // efecto transitorio, propiedad exclusiva de NatureFX
  }

  _ensureTornadoDust() {
    if (this._tornadoDust) return this._tornadoDust
    const resource = newVfxResource('tornado-ground-dust-runtime', 'Polvo temporal.vfx')
    resource.emission.rate = 0
    resource.emission.capacity = 96
    resource.birth.lifetime = [1.2, 2.6]
    resource.movement.space = 'world'
    resource.movement.speed = 0.7
    resource.movement.spread = 0.4
    resource.appearance.color = '#ffffff'
    resource.appearance.opacity = 0.38
    resource.appearance.size = 1.9
    const simulation = new VfxSimulation(resource, { seed: 48131 })
    const renderer = new VfxBillboardRenderer(simulation)
    this.opts.scene.add(renderer.mesh)
    this._tornadoDust = { simulation, renderer, lastSurface: null }
    return this._tornadoDust
  }

  _updateTornadoDust(dt, playing, world, f) {
    const current = this._tornadoDust
    if (!playing || !world?.tornado || !f?.weatherOn) {
      if (current) {
        current.simulation.reset()
        current.renderer.dispose()
        this._tornadoDust = null
      }
      return false
    }
    const t = world.tornado, terrains = this.opts.terrains()
    // Una sola selección por fotograma: no presupone que el terreno ni los materiales sean polvo.
    const surface = tornadoSurfaceAt(terrains, t.x, t.z, {
      waterAt: this.opts.waterAt, wet: this.opts.soilAt?.(t.x, t.z) ?? this._wet, snow: this._snow,
      rain: Math.min(1, world.precipitationAt(t.x, t.z) / 30),
    })
    const rate = surface ? tornadoDustRate(t, surface.dryness) : 0
    if (rate <= 0 && !current) return false
    const dust = current || this._ensureTornadoDust()
    const sim = dust.simulation
    sim.resource.emission.rate = rate
    sim.emissionEnabled = rate > 0
    if (surface) {
      dust.lastSurface = surface
      if (surface.color !== dust.lastColor && /^#[0-9a-f]{6}$/i.test(surface.color || '')) {
        const channels = [1, 3, 5].map((i) => parseInt(surface.color.slice(i, i + 2), 16) / 255)
        sim.visualTint = channels.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
        dust.lastColor = surface.color
      }
    }
    // La posición y el flujo proceden del mismo World que gobierna el tornado.
    sim.spawnAt = (position, offset) => {
      const a = sim._random() * Math.PI * 2
      const r = (0.35 + sim._random() * 0.5) * t.radius
      const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r
      const candidate = tornadoSurfaceAt(terrains, x, z, {
        waterAt: this.opts.waterAt, wet: this.opts.soilAt?.(x, z) ?? this._wet, snow: this._snow,
        rain: Math.min(1, world.precipitationAt(x, z) / 30),
      })
      const birth = candidate || surface
      position[offset] = birth.x; position[offset + 1] = birth.y + 0.2; position[offset + 2] = birth.z
    }
    sim.flowAt = (x, y, z) => world.windAt3D(x, y, z)
    sim.visualOpacity = Math.max(0.15, 1 - Math.min(0.8, (f?.precip?.rain ?? 0) * 0.7))
    sim.update(dt)
    dust.renderer.sync(this.opts.camera())
    return sim.count > 0
  }

  /**
   * `f` = World.frame() o null · `live` = animar (modo Jugar, o editor con «Clima animado») · `playing` = modo Jugar.
   * `world` = instancia de World (opcional, para leer el viento local con obstáculos).
   * Devuelve true si algo se está animando (el visor debe seguir dibujando).
   */
  update(f, cam, dt, px, live, playing, world, windLocal = null) {
    dt = Math.min(dt, 0.1)
    if (live) this._t += dt
    const w = f?.wind

    // Una muestra de viento por frame en la cámara; no introduce consultas por hoja ni por árbol.
    const local = windLocal ?? (w && world?.windAt3D && cam
      ? world.windAt3D(cam.position.x, cam.position.y, cam.position.z) : w)
    const lx = local?.x ?? (playing ? 1.2 : 0)
    const lz = local?.z ?? 0

    // sin clima activo, jugando hay una brisa suave; en el editor sin vista viva, todo quieto
    setWind({ time: this._t, x: lx, z: lz, gust: f?.gusts ?? 0.4, on: live && (!!w || playing) })

    // humedad del suelo: sube con la lluvia (~12 s hasta empapar) y se seca despacio (~60 s); la nieve se acumula/derrite aparte
    if (live) {
      const rain = f?.precip?.rain ?? 0, snow = f?.precip?.snow ?? 0
      this._wet = Math.max(0, Math.min(1, this._wet + (rain > 0.02 ? rain * 0.085 : -0.016) * dt))
      this._snow = Math.max(0, Math.min(1, this._snow + (snow > 0.02 ? snow * 0.03 : -0.01) * dt))
    }
    WETU.uWet.value = this._wet; WETU.uRain.value = f?.precip?.rain ?? 0; WETU.uSnowCover.value = this._snow; WETU.uWetTime.value = this._t
    let busy = false
    if (this.leaves.update(f, cam, live ? dt : 0, this.opts.terrains(), live && (!!w || !!playing), local)) busy = true
    if (this.critters.update(f, cam, dt, px, live)) busy = true
    if (this._updateTornadoDust(live ? dt : 0, playing, world, f)) busy = true
    return busy || this._wet > 0.001 && live || (live && (!!w && f.weatherOn))
  }

  dispose() {
    this._tornadoDust?.renderer.dispose()
    this._tornadoDust = null
    this.leaves.dispose(); this.critters.dispose()
  }
}
