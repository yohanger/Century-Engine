// Entorno de la vista: cielo, nubes, IBL, niebla, mundo (hora/clima) y color bajo el agua. Mixin de `Viewport` (viewport.js).
import * as THREE from 'three'
import { normalizeSky, sunDirection, stormCoverFromFrame } from './skylib.js'
import { cloudBeamTransmission } from '../world/weather.js'
import { lightingMode } from '../world/lighting.js'
import { buildShape, buildDetail } from './cloudnoise.js'
import { setFogStart } from './fogpatch.js'
import { applyAstro } from './astro-sky.js'
import { normalizeFog, fogParams, shaftStrength } from '../world/fog.js'
import { liveAtmoVolumes } from './atmovolumes.js'
import { tornadoVisualState } from '../world/tornado-visual.js'

/** En presión, el debounce también debe respetar el intervalo a pocos FPS. */
export function environmentBakeDelay({ age, interval, ready, immediate, throttled }) {
  if (immediate || !ready || age >= interval) return 0
  return throttled ? Math.max(140, interval - age) : 140
}

export const envMethods = {
  _applySky() {
    const env = this._env, k = normalizeSky(env), u = this.skyMat.uniforms
    u.top.value.set(env.skyTop); u.horizon.value.set(env.skyHorizon); u.ground.value.set(env.ground)
    const wf = this._wf
    const mode = lightingMode(this._rawEnv)
    const dir = mode === 'manual' ? (this._sun?.dir || sunDirection(k.sunElevation, k.sunAzimuth)) : wf ? wf.sunDir : k.sunLink && this._sun ? this._sun.dir : sunDirection(k.sunElevation, k.sunAzimuth)
    u.uSunDir.value.set(dir[0], dir[1], dir[2]).normalize()
    const trans = wf?.solarTransmission ?? (k.cloudsOn ? cloudBeamTransmission(k.cloudsCoverage, k.cloudsDensity, dir[1]) : 1)
    const wasBlocked = u.uSolarTransmission.value <= 0.005
    u.uSolarTransmission.value = trans
    this._manualSunTransmission = !wf || mode === 'manual' ? trans : 1
    const changedSunVisibility = wasBlocked !== (trans <= 0.005)
    if (changedSunVisibility) {
      if (this.reflectionProbe) this.reflectionProbe.last = -Infinity
      if (this.wetReflections) this.wetReflections.lastFrame = -Infinity
    }
    const elev = Math.max(0, Math.min(1, (dir[1] + 0.05) / 0.2))
    if (wf && mode !== 'manual') u.uSunColor.value.setRGB(...wf.sunColor).multiplyScalar(1.3 * (wf.sunCloudMul ?? wf.sunMul))
    else if ((mode === 'manual' || k.sunLink) && this._sun) u.uSunColor.value.set(this._sun.color).multiplyScalar(Math.max(0, this._sun.energy))
    else u.uSunColor.value.set('#ff9a55').lerp(new THREE.Color('#fff2dc'), Math.min(1, dir[1] / 0.5)).multiplyScalar(1.3)
    u.uSunColor.value.multiplyScalar(elev)
    u.uMode.value = k.skyMode === 'physical' ? 1 : k.skyMode === 'hdri' && this._pano ? 2 : 0
    u.uExposure.value = k.skyExposure; u.uRotation.value = k.skyRotation; u.uTint.value.set(k.skyTint)
    u.uTurb.value = k.skyTurbidity; u.uRayleigh.value = k.skyRayleigh; u.uMie.value = k.skyMie; u.uMieG.value = k.skyMieG
    u.uClouds.value = k.cloudsOn ? 1 : 0
    u.uCovg.value = k.cloudsCoverage; u.uCDens.value = k.cloudsDensity; u.uCBase.value = k.cloudsAltitude; u.uCThick.value = k.cloudsThickness
    const volume = wf?.clouds?.cells && wf.clouds.map?.volume
    if (volume?.version) { u.uCBase.value = volume.base; u.uCThick.value = volume.height }
    u.uCScale.value = k.cloudsScale; u.uCErode.value = k.cloudsErosion; u.uCType.value = k.cloudsType; if (k.cloudsOn) this._ensureCloudNoise(); u.uCWind.value = k.cloudsWind; u.uCWindDir.value = k.cloudsWindDir * Math.PI / 180
    u.uCLight.value = k.cloudsLight; u.uCTint.value.set(k.cloudsTint)
    // luz ambiente de las nubes: el color del cielo, más oscuro con el sol bajo
    const amb = u.uCAmb.value
    if (k.skyMode === 'hdri') amb.set(k.skyTint).multiplyScalar(0.45)
    else if (k.skyMode === 'physical') amb.setRGB(0.22, 0.34, 0.55)
    else amb.set(env.skyTop).lerp(new THREE.Color(env.skyHorizon), 0.5).multiplyScalar(0.9)
    amb.multiplyScalar((0.15 + 0.85 * elev) * (1 - u.uNight.value * 0.92))
    this._cAmbBase = (this._cAmbBase || new THREE.Color()).copy(amb)
    const sig = [k.skyMode, k.skyExposure, k.skyRotation, k.skyTint, k.skyHdri, this._pano?.uuid || '', k.skyTurbidity, k.skyRayleigh, k.skyMie, k.skyMieG, k.cloudsOn, k.cloudsCoverage, k.cloudsDensity,
      k.cloudsAltitude, k.cloudsThickness, k.cloudsScale, k.cloudsErosion, k.cloudsType, k.cloudsTint, k.cloudsLight, trans.toFixed(2), env.skyTop, env.skyHorizon, env.ground,
      dir.map((x) => x.toFixed(3)).join(), u.uNight.value.toFixed(2), this._moonSkyKey, u.uStormCover.value.toFixed(2)].join('|')
    if (sig !== this._envSig) { this._envSig = sig; this._queueEnvBake(changedSunVisibility) }
    this.requestRender()
  },

  /** Ruido 3D de las nubes (core/render/cloudnoise.js): se genera la primera vez que se activan las nubes (~0,3 s). */
  _ensureCloudNoise() {
    const u = this.skyMat.uniforms
    if (u.uShape.value) return
    const mk = (data, n) => { const t = new THREE.Data3DTexture(data, n, n, n); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.needsUpdate = true; return t }
    u.uShape.value = mk(buildShape(48), 48); u.uDetail.value = mk(buildDetail(32), 32)
  },

  // el IBL se vuelve a hornear con un pequeño retraso: arrastrar un deslizador no lanza 60 horneados por segundo
  _queueEnvBake(immediate = false) {
    clearTimeout(this._bakeT)
    // con el cielo cambiando sin parar (hora que transcurre) el aplazamiento no se cumpliría nunca: como mucho cada 1,5 s se hornea igualmente
    const interval = 1500 * (this.performanceController?.captureScale || 1)
    const delay = environmentBakeDelay({ age: performance.now() - (this._lastBake || 0), interval,
      ready: !!this._envRT, immediate,
      throttled: this.performanceController?.active && this.performanceController.captureScale > 1 })
    this._bakeT = setTimeout(() => this._bakeEnv(), delay)
  },

  _bakeEnv() {
    if (this.nativeBackend?.active) return
    const u = this.skyMat.uniforms, keep = [u.uCamY.value, u.uCloudSteps.value, u.uTornadoCloud.value.w, u.uTornadoOrganization.value.w, u.uFlash.value, u.uLightningEnergy.value]
    u.uTornadoCloud.value.w = 0; u.uTornadoOrganization.value.w = 0 // El reflejo ambiental no hornea un tornado localizado.
    u.uFlash.value = 0; u.uLightningEnergy.value = 0 // Los flashes transitorios no deben quedar congelados en el IBL.
    u.uCamY.value = this.camera.position.y; u.uCloudSteps.value = 16
    try {
      this.skyVariants?.update()
      const next = this.pmrem.fromScene(this.envScene, 0, 0.1, 100)
      this._envRT?.dispose()
      this._envRT = next
      this._lastBake = performance.now()
      if (!this.reflectionProbe?.target) this.scene.environment = next.texture
    } finally {
      ;[u.uCamY.value, u.uCloudSteps.value, u.uTornadoCloud.value.w, u.uTornadoOrganization.value.w, u.uFlash.value, u.uLightningEnergy.value] = keep
      this.skyVariants?.update()
    }
    this.requestRender()
  },

  setEnvironment(env) {
    this._rawEnv = env
    this._applyEnv()
  },

  /**
   * Estado del mundo (World.frame(): hora, sol/luna, clima, viento) o null. Se llama en cada fotograma de juego: lo ligero (viento,
   * estrellas, relámpago) va directo a los uniformes; lo pesado (colores, nubes, niebla, horneado del cielo) solo si algo cambió.
   */
  setWorld(f) {
    this._wf = f && f.active ? f : null
    const u = this.skyMat.uniforms, w = this._wf
    u.uStormCover.value = stormCoverFromFrame(w)
    const front = w?.weatherOn ? w.stormFront : null
    u.uStormFront.value.set(front?.x ?? 0, front?.z ?? 1, front?.progress ?? 0, front?.strength ?? 0)
    const flashCloud = w?.weatherOn && w?.clouds?.on ? w.cloudLightning : null
    u.uLightningEnergy.value = flashCloud?.intensity ?? 0
    u.uLightningCloud.value.set(flashCloud?.x ?? 0, flashCloud?.y ?? 0, flashCloud?.z ?? 0, flashCloud?.radius ?? 0)
    const celestial = w?.timeOn && lightingMode(this._rawEnv) !== 'manual'
    u.uNight.value = celestial ? w.night : 0
    u.uMoonColor.value.setRGB(0, 0, 0)
    if (celestial && w.moonColor) u.uMoonColor.value.setRGB(...w.moonColor).multiplyScalar(1.3 * (w.moonCloudMul ?? w.moonMul ?? 0))
    const moonAboveHorizon = !!celestial && w.moonVis > 0.001
    const moonKey = moonAboveHorizon ? [
      ...w.moonDir.map(x => x.toFixed(2)), w.moonVis.toFixed(2), (w.astro?.moonIllum ?? 1).toFixed(2),
      (w.moonCloudMul ?? 0).toFixed(3),
    ].join(',') : ''
    if (Boolean(moonKey) !== Boolean(this._moonSkyKey)) {
      if (this.reflectionProbe) this.reflectionProbe.last = -Infinity
      if (this.wetReflections) this.wetReflections.lastFrame = -Infinity
    }
    this._moonSkyKey = moonKey
    // La base rotatoria se condensa DENTRO del raymarch de nubes, no en una segunda nube/esfera.
    // La posición y la fase vienen de World y se representan solo en este shader atmosférico.
    const t = w?.weatherOn && w?.clouds?.on ? w.tornado : null
    const cfg = w?.tornadoDurations
    const base = w?.clouds?.cells && w.clouds.map ? w.clouds.map.slabBase : w?.clouds?.altitude
    const v = t && tornadoVisualState(t, base, cfg ? {
      development: cfg.tornadoDevelopmentSeconds, organization: cfg.tornadoOrganizationSeconds,
      formation: cfg.tornadoFormationSeconds, weakening: cfg.tornadoWeakeningSeconds,
      dissipation: cfg.tornadoDissipationSeconds,
    } : {})
    u.uTornadoCloud.value.set(t?.x ?? 0, t?.z ?? 0, v ? Math.max(35, v.radius * 5) : 0,
      v && v.opacity > 0.005 ? v.opacity : 0)
    // S01: la organización precede al embudo; S02 acoplará la condensación al volumen continuo.
    const org = v ? (v.phase === 'development' ? 0.15 + v.progress * 0.35
      : v.phase === 'organization' ? 0.5 + v.progress * 0.5
      : v.phase === 'formation' || v.phase === 'active' ? 1
      : v.phase === 'weakening' ? 0.85 : v.phase === 'dissipation' ? 0.55 * (1 - v.progress) : 0) : 0
    const mx = w?.clouds?.motherX ?? t?.x ?? 0, mz = w?.clouds?.motherZ ?? t?.z ?? 0
    const span = t ? Math.hypot(t.x - mx, t.z - mz) : 0
    u.uTornadoOrganization.value.set(t ? (t.x + mx) * 0.5 : 0, t ? (t.z + mz) * 0.5 : 0,
      Math.max(500, (v?.radius ?? 18) * 16, span * 0.7 + (w?.clouds?.motherRadius ?? 0) * 0.8), org)
    u.uTornadoShape.value.set(t?.y ?? 0, base ?? 900,
      v?.reach ?? 0, v?.rope ?? 1)
    if (w) {
      const cc = w.clouds
      if (w.weatherOn && cc?.cells && cc.map) this._cellClouds(cc, u)
      else {
        u.uCCells.value = 0
        if (w.weatherOn) u.uWindOff.value.set(w.windOff[0] * 1.6, w.windOff[1] * 1.6) // las nubes van algo más rápido que el viento del suelo (solo con el clima activo)
      }
      u.uStars.value = celestial ? w.stars : 0; u.uMoonVis.value = celestial ? w.moonVis : 0; u.uFlash.value = w.flash
      u.uMoonDir.value.set(w.moonDir[0], w.moonDir[1], w.moonDir[2])
      u.uStarAxis.value.set(w.starAxis[0], w.starAxis[1], w.starAxis[2]); u.uStarAng.value = w.starAngle
      applyAstro(u, celestial ? w : null)
      if (this._cAmbBase) u.uCAmb.value.copy(this._cAmbBase).addScalar(w.flash * (u.uLightningEnergy.value > 0 ? 0.16 : 0.7))
    } else { u.uCCells.value = 0; u.uStars.value = 0; u.uMoonVis.value = 0; u.uFlash.value = 0; u.uAstro.value = 0 }
    const key = w ? [w.skyTop, w.skyHorizon, w.ground, w.exposure.toFixed(3), w.ambientMul.toFixed(2), w.ambientColor, w.sunDir.map((x) => x.toFixed(3)).join(), w.sunMul.toFixed(3), w.solarTransmission?.toFixed(3),
      w.lunarTransmission?.toFixed(3), u.uNight.value.toFixed(2), moonKey,
      w.clouds ? [w.clouds.on, w.clouds.coverage.toFixed(3), w.clouds.density.toFixed(2), (w.clouds.type ?? 0.5).toFixed(2), w.clouds.altitude.toFixed(0), w.clouds.thickness.toFixed(0), w.clouds.tint, w.clouds.light.toFixed(2)].join() : '',
      w.fog ? [w.fog.on, w.fog.density.toFixed(4), w.fog.color, (w.fog.humidity ?? 0.5).toFixed(2), w.sunColor.map((x) => x.toFixed(2)).join()].join() : '-'].join('|') : ''
    if (key !== this._wkey || !this._env) { this._wkey = key; if (this._rawEnv) this._applyEnv() }
    this.requestRender()
  },

  /**
   * Nubes por celdas: sube el mapa horneado del campo (una textura RGBA8 de N×N, solo cuando cambia su `version`) y coloca la cámara en el
   * sistema atmosférico del mapa. El ruido se envuelve (mod su periodo) para no perder precisión en coordenadas grandes.
   */
  _cellClouds(cc, u) {
    const M = cc.map
    let t = this._cmapTex
    if (!t || t.image.width !== M.N || t.image.data !== M.data) { // otro campo (nueva semilla, otra escena): otro buffer → textura nueva aunque su `version` también sea 1
      t?.dispose()
      t = this._cmapTex = new THREE.DataTexture(M.data, M.N, M.N, THREE.RGBAFormat, THREE.UnsignedByteType)
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = t.minFilter = THREE.LinearFilter
      t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.premultiplyAlpha = false; t.unpackAlignment = 1
      this._cmapVer = -1
    }
    if (this._cmapVer !== M.version) { t.needsUpdate = true; this._cmapVer = M.version }
    const v = M.volume
    let volumeTex = u.uCVolume.value
    if (volumeTex?.image.data !== v?.data) {
      volumeTex?.dispose()
      volumeTex = v ? new THREE.Data3DTexture(v.data, v.N, v.N, v.depth) : null
      if (volumeTex) {
        volumeTex.format = THREE.RGFormat
        volumeTex.minFilter = volumeTex.magFilter = THREE.LinearFilter
      }
      u.uCVolume.value = volumeTex
      this._cloudVolumeVersion = -1
    }
    if (v?.version) {
      if (this._cloudVolumeVersion !== v.version) { volumeTex.needsUpdate = true; this._cloudVolumeVersion = v.version }
      u.uCVolumeBlend.value = v.blend
    } else u.uCVolumeOrigin.value.w = 0
    u.uCMap.value = t; u.uCCells.value = 1; u.uCMapHalf.value = M.half
    this._placeCellClouds(cc, u)
  },

  _placeCellClouds(cc, u) {
    const cam = this.camera.position, wo = cc.windOff, M = cc.map, v = M.volume
    const ax = cam.x - wo[0], az = cam.z - wo[1], P = 3125 * (u.uCScale.value || 1)
    if (v?.version) u.uCVolumeOrigin.value.set(ax - v.cx, az - v.cz, v.base, 1 / v.height)
    u.uCCam.value.set(ax - M.cx, az - M.cz)
    u.uCAtm.value.set(((ax % P) + P) % P, ((az % P) + P) % P)
  },

  /** El entorno que se dibuja: el del inspector, con la paleta, las nubes y la niebla del mundo encima si hay hora/clima activos. */
  _effectiveEnv(env, w) {
    if (!w) return env
    const e = { ...env, skyTop: w.skyTop, skyHorizon: w.skyHorizon, ground: w.ground, ambientColor: w.ambientColor, ambient: (env.ambient ?? 0.5) * w.ambientMul, skyExposure: (env.skyExposure ?? 1) * w.exposure }
    // En Manual, clima puede aportar nubes y niebla, no tomar autoridad sobre la iluminación celestial.
    if (lightingMode(env) === 'manual') Object.assign(e, { skyTop: env.skyTop, skyHorizon: env.skyHorizon, ground: env.ground, ambientColor: env.ambientColor, ambient: env.ambient, skyExposure: env.skyExposure })
    if (w.clouds) Object.assign(e, { cloudsOn: w.clouds.on, cloudsPreset: 'custom', cloudsCoverage: w.clouds.coverage, cloudsDensity: w.clouds.density, cloudsAltitude: w.clouds.altitude, cloudsThickness: w.clouds.thickness, cloudsErosion: w.clouds.erosion, cloudsType: w.clouds.type, cloudsTint: w.clouds.tint, cloudsLight: w.clouds.light })
    if (w.fog) Object.assign(e, { fog: w.fog.on, fogDensity: w.fog.density, fogColor: w.fog.color })
    else e.fog = false
    return e
  },

  _applyEnv() {
    const env = this._env = this._effectiveEnv(this._rawEnv, this._wf)
    this._applySky()
    if (!this._envRT) { clearTimeout(this._bakeT); this._bakeEnv() }
    this.scene.environmentIntensity = this._envIntensity()
    this.hemi.color.set(env.ambientColor || env.skyHorizon)
    this.hemi.intensity = env.ambient * Math.PI
    this._fogState = this._buildFogState(env)
    this._applyFog()
    this.requestRender()
  },

  /** Estado de la niebla física para el pase (render/atmofog.js): parámetros, color, sol (del mundo si hay hora/clima) y fuerza de los haces. */
  _buildFogState(env) {
    const F = normalizeFog(env), w = this._wf
    const mode = lightingMode(this._rawEnv)
    const weatherHaze = w?.weatherOn && w.timeOn && mode !== 'manual' && !this._rawEnv?.fog
    if (!env.fog || (F.fogMode !== 'physical' && !weatherHaze)) return { physical: false }
    const k = normalizeSky(env)
    const useMoon = w?.timeOn && mode !== 'manual' && w.moonMul > (w.sunDirectMul ?? w.sunMul)
    const dir = useMoon ? w.moonDir : mode === 'manual' ? (this._sun?.dir || sunDirection(k.sunElevation, k.sunAzimuth)) : w ? w.sunDir : k.sunLink && this._sun ? this._sun.dir : sunDirection(k.sunElevation, k.sunAzimuth)
    const elev = Math.max(0, Math.min(1, (dir[1] + 0.05) / 0.2))
    let col, inten
    if (useMoon) { col = w.moonColor; inten = w.moonMul }
    else if (w && mode !== 'manual') { col = w.sunColor; inten = Math.max(0, w.sunDirectMul ?? w.sunMul) }
    else {
      const c = (mode === 'manual' || k.sunLink) && this._sun ? new THREE.Color(this._sun.color) : new THREE.Color('#ff9a55').lerp(new THREE.Color('#fff2dc'), Math.min(1, dir[1] / 0.5))
      col = [c.r, c.g, c.b]; inten = ((mode === 'manual' || k.sunLink) && this._sun ? Math.max(0, this._sun.energy) : 1) * elev * this.skyMat.uniforms.uSolarTransmission.value
    }
    const humidity = w ? w.fog?.humidity ?? w.humidity ?? 0.5 : 0.5
    const falloff = weatherHaze && F.fogMode === 'simple' ? 0.007 : F.fogFalloff
    const params = fogParams({ density: +env.fogDensity || 0, humidity, falloff, baseHeight: F.fogHeight, start: +env.fogStart || 0, scatter: F.fogScatter })
    const sunI = inten
    return {
      physical: params.on, weatherHaze, cloudShaftMask: k.cloudsOn, params, color: new THREE.Color(env.fogColor), sunDir: dir, sunColor: col, sunIntensity: sunI, shafts: F.fogShafts,
      shaftStrength: (sunInView) => shaftStrength({ sunInView, sunIntensity: sunI, humidity, density: params.density }),
    }
  },

  /** FogExp2 de three, salvo que el pase de niebla física esté dibujando (la mide `LookPipeline.render`): entonces la escena no lleva niebla propia. */
  _applyFog() {
    const env = this._env
    if (!env) return
    // El cielo se salta FogExp2 de Three por ser ShaderMaterial: resolverlo en el
    // mismo material solo cuando no lo compone el pase físico.
    const skyFog = this.skyMat?.uniforms
    if (skyFog?.uSkyFogDensity) {
      skyFog.uSkyFogDensity.value = env.fog && !(this._fogState?.physical && this.look?._physFog) ? Math.max(0, +env.fogDensity || 0) : 0
      skyFog.uSkyFogColor.value.set(env.fogColor || env.skyHorizon)
      skyFog.uWeatherHazeFalloff.value = this._fogState?.weatherHaze ? this._fogState.params.falloff : 0
    }
    const own = env.fog && !(this._fogState?.physical && this.look?._physFog)
    if (setFogStart(own ? env.fogStart : 0)) this.recompileMaterials()
    if (own) {
      if (this.scene.fog?.isFogExp2) { this.scene.fog.color.set(env.fogColor); this.scene.fog.density = env.fogDensity } else this.scene.fog = new THREE.FogExp2(env.fogColor, env.fogDensity)
    } else this.scene.fog = null
  },

  /** Volúmenes atmosféricos vivos de la escena (nodos «Volumen atmosférico»). */
  atmoVolumes() { return liveAtmoVolumes() },


}
