import { normalizeLight, kelvinToRgb } from '../render/lightlib.js'
import * as THREE from 'three'
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js'
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, iconMat, arrowToward } from './three-helpers.js'
import { DEG } from '../util.js'
import { LIGHT_STYLES } from '../render/lightfx.js'

/** Luces prediseñadas: son luces normales con un estilo de animación y valores ya ajustados. */
const PRESETS = {
  candle: { label: 'Vela', name: 'Vela', icon: 'light-candle', type: 'omni', color: '#ffb04a', energy: 0.9, range: 5, style: 'candle', speed: 1, amount: 0.5 },
  torch: { label: 'Antorcha / fuego', name: 'Antorcha', icon: 'light-torch', type: 'omni', color: '#ff8a2a', energy: 1.8, range: 11, style: 'torch', speed: 1, amount: 0.6, shadow: true },
  phosphor: { label: 'Fosforescente', name: 'Fosforescente', icon: 'light-neon', type: 'omni', color: '#78ffb4', energy: 1.0, range: 8, style: 'pulse', speed: 0.5, amount: 0.55 },
  neon: { label: 'Neón con fallos', name: 'Neón', icon: 'light-neon', type: 'omni', color: '#ff4fd8', energy: 1.4, range: 9, style: 'neon', speed: 1, amount: 0.85 },
  strobe: { label: 'Estrobo / alarma', name: 'Estrobo', icon: 'light-strobe', type: 'spot', color: '#ff3030', energy: 3, range: 14, spotAngle: 50, style: 'strobe', speed: 2, amount: 1, position: [0, 3, 0] },
  lamp: { label: 'Lámpara cálida', name: 'Lámpara', icon: 'light', type: 'omni', color: '#ffd9a0', energy: 1.3, range: 9, style: 'steady', speed: 1, amount: 0, shadow: true, position: [0, 2.5, 0] },
  moon: { label: 'Luz de luna', name: 'Luna', icon: 'sun', type: 'directional', color: '#8fb0ff', energy: 0.25, range: 0, style: 'steady', speed: 1, amount: 0, shadow: true, position: [0, 20, 0], rotation: [-40, -60, 0] },
}

export const LIGHT_TYPES = { omni: 'Punto', spot: 'Foco', directional: 'Direccional', area: 'Área rectangular' }

// Una imagen radial para todas las luces; cada instancia dispone de su propia textura GPU.
// Lensflare.dispose() destruye las texturas de sus elementos: compartir el objeto Texture
// entre luces haría que quitar una invalidase las restantes.
let flarePixels = null
function flareTexture() {
  if (!flarePixels) {
    const n = 64
    flarePixels = new Uint8Array(n * n * 4)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot((x + 0.5 - n / 2) / (n / 2), (y + 0.5 - n / 2) / (n / 2))
      const a = Math.round(255 * Math.pow(Math.max(0, 1 - r), 2.3))
      const i = (y * n + x) * 4
      flarePixels[i] = flarePixels[i + 1] = flarePixels[i + 2] = 255
      flarePixels[i + 3] = a
    }
  }
  const t = new THREE.DataTexture(flarePixels, 64, 64, THREE.RGBAFormat)
  t.needsUpdate = true
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  return t
}

function disposeFlare(root) {
  const u = root.userData
  if (!u.flare) return
  u.flare.parent?.remove(u.flare)
  u.flare.dispose()
  u.flare = null
  u.flareElements = null
}

function syncFlare(root, q, light) {
  const u = root.userData
  if (!q.flareOn) { disposeFlare(root); return }
  if (!u.flare) {
    const effect = new Lensflare()
    const texture = flareTexture()
    u.flareElements = [new LensflareElement(texture, q.flareSize, 0), new LensflareElement(texture, q.flareSize * 0.25, 0.45)]
    for (const e of u.flareElements) effect.addElement(e)
    light.add(effect) // la fuente óptica comparte visibilidad, color y ciclo de vida con la luz
    // Dirección de fuente óptica: se actualiza frente a la cámara para evitar paralaje y clip lejano.
    // Área: el destello procede del centro del emisor (no de su marco editorial).
    u.flare = effect
  }
  u.flareIntensity = q.flareIntensity
  for (const [i, e] of u.flareElements.entries()) e.size = q.flareSize * (i === 0 ? 1 : 0.25)
  u.refreshLightEffects?.()
}


const temperatureTint = new THREE.Color()

function syncLightColor(root, obj) {
  const u = root.userData, light = u.light
  light.color.set(u.rtColor ?? obj.color)
  const base = u.lightTemperature
  const kelvin = u.environmentSun ? (base || 6500) + u.environmentSun.temperatureOffset : base
  if (kelvin) light.color.multiply(temperatureTint.setRGB(...kelvinToRgb(kelvin), THREE.SRGBColorSpace))
}

function syncLightEnergy(root, obj) {
  const u = root.userData
  const raw = (u.rtEnergy ?? obj.light.energy) * Math.PI
  u.light.intensity = raw * (u.environmentSun?.multiplier ?? 1)
  if (u.fx) u.fx.base = u.light.intensity
}

// Las opciones ópticas temporales se aplican sobre los valores base del nodo.
function syncTemporalLight(root, obj) {
  const u = root.userData, l = u.light
  if (!l || !obj?.light) return
  const p = obj.light, q = normalizeLight({ ...p, ...(u.timelineLight || {}) })
  u.lightTemperature = q.temperature
  syncLightColor(root, obj)
  if (u.fx) u.fx.style = LIGHT_STYLES[q.style]?.id || 0
  if (p.type === 'directional' && l.castShadow && l.shadow?.camera) {
    const c = l.shadow.camera, e = q.shadowDistance
    if (c.right !== e || c.left !== -e || c.far !== Math.max(250, e * 4)) {
      c.left = c.bottom = -e
      c.right = c.top = e
      c.near = 0.5
      c.far = Math.max(250, e * 4)
      c.updateProjectionMatrix()
      l.shadow.needsUpdate = true
    }
  }
  l.userData.rtVol = p.type !== 'area' && q.volumetric
    ? { intensity: q.volIntensity, mode: q.mode, shadow: !!p.shadow, type: p.type,
        spotAngle: p.spotAngle, penumbra: q.penumbra, range: p.range, shadowDistance: q.shadowDistance }
    : null
  syncFlare(root, { ...q, flareIntensity: u.flareIntensity ?? q.flareIntensity }, l)
}

function animatedLightSetting({ label, key, kind = 'number', def, min, max, options, available }) {
  return {
    label, kind, def, ...(options ? { options } : {}), ...(Number.isFinite(min) ? { min } : {}), ...(Number.isFinite(max) ? { max } : {}),
    available,
    read: obj => normalizeLight(obj.light || {})[key] ?? obj.light?.[key] ?? def,
    runtimeRead: (root, obj) => root.userData.timelineLight?.[key] ?? normalizeLight(obj.light || {})[key] ?? obj.light?.[key] ?? def,
    capture: root => ({ had: Object.hasOwn(root.userData.timelineLight || {}, key), value: root.userData.timelineLight?.[key] }),
    apply: (root, value) => {
      ;(root.userData.timelineLight ??= {})[key] = value
      root.userData.refreshLightTemporal?.()
    },
    restore: (root, saved) => {
      if (saved?.had) (root.userData.timelineLight ??= {})[key] = saved.value
      else if (root.userData.timelineLight) {
        delete root.userData.timelineLight[key]
        if (!Object.keys(root.userData.timelineLight).length) delete root.userData.timelineLight
      }
      root.userData.refreshLightTemporal?.()
    },
  }
}


// Cada canal de iluminación conserva al propietario Three.js y evita mutar los datos autorales.
// La disponibilidad sigue la condición del Inspector; un tipo de luz no recibe controles ajenos.
function animatedLightNumber({ label, key, def, min = 0, max, available, get, set }) {
  return {
    label, kind: 'number', def, min, ...(Number.isFinite(max) ? { max } : {}),
    available,
    read: obj => normalizeLight(obj.light || {})[key],
    runtimeRead: (root, obj) => get(root) ?? normalizeLight(obj.light || {})[key],
    apply: (root, value) => set(root, value),
    capture: root => get(root),
    restore: (root, snapshot, obj) => set(root, snapshot ?? normalizeLight(obj.light || {})[key]),
  }
}
const dynamicLight = type => type !== 'area' && type !== 'directional'
const lightOptions = {
  'light.temperature': animatedLightSetting({ label: 'Temperatura K', key: 'temperature', def: 0, min: 0, max: 20000 }),
  'light.flareOn': animatedLightSetting({ label: 'Lensflare', key: 'flareOn', kind: 'bool', def: false,
    available: obj => ['omni', 'spot', 'directional', 'area'].includes(obj.light?.type) }),
  'light.flareSize': animatedLightSetting({ label: 'Tamaño flare (px)', key: 'flareSize', def: 72, min: 16, max: 256,
    available: obj => normalizeLight(obj.light || {}).flareOn }),
  'light.volumetric': animatedLightSetting({ label: 'Volumétrica', key: 'volumetric', kind: 'bool', def: false,
    available: obj => obj.light?.type !== 'area' }),
  'light.volIntensity': animatedLightSetting({ label: 'Intensidad vol.', key: 'volIntensity', def: 1, min: 0, max: 20,
    available: obj => obj.light?.type !== 'area' && normalizeLight(obj.light || {}).volumetric }),
  'light.shadowDistance': animatedLightSetting({ label: 'Distancia (m)', key: 'shadowDistance', def: 60, min: 5, max: 500,
    available: obj => obj.light?.type === 'directional' && obj.light.shadow === true }),
  'light.style': animatedLightSetting({ label: 'Animación', key: 'style', kind: 'enum', def: 'steady',
    options: Object.keys(LIGHT_STYLES) }),
  'light.range': animatedLightNumber({ label: 'Rango', key: 'range', def: 12, min: 0.1,
    available: obj => dynamicLight(obj.light?.type),
    get: root => root.userData.light?.distance,
    set: (root, value) => { if (root.userData.light) root.userData.light.distance = value },
  }),
  'light.spotAngle': animatedLightNumber({ label: 'Ángulo °', key: 'spotAngle', def: 45, min: 1, max: 89,
    available: obj => obj.light?.type === 'spot',
    get: root => root.userData.light?.angle / DEG,
    set: (root, value) => { if (root.userData.light?.isSpotLight) root.userData.light.angle = value * DEG },
  }),
  'light.penumbra': animatedLightNumber({ label: 'Penumbra', key: 'penumbra', def: 1, min: 0, max: 1,
    available: obj => obj.light?.type === 'spot',
    get: root => root.userData.light?.penumbra,
    set: (root, value) => { if (root.userData.light?.isSpotLight) root.userData.light.penumbra = value },
  }),
  'light.areaWidth': animatedLightNumber({ label: 'Ancho (m)', key: 'areaWidth', def: 2, min: 0.05, max: 100,
    available: obj => obj.light?.type === 'area',
    get: root => root.userData.light?.width,
    set: (root, value) => { if (root.userData.light?.isRectAreaLight) { root.userData.light.width = value; root.userData.areaFrame?.update() } },
  }),
  'light.areaHeight': animatedLightNumber({ label: 'Alto (m)', key: 'areaHeight', def: 1, min: 0.05, max: 100,
    available: obj => obj.light?.type === 'area',
    get: root => root.userData.light?.height,
    set: (root, value) => { if (root.userData.light?.isRectAreaLight) { root.userData.light.height = value; root.userData.areaFrame?.update() } },
  }),
  'light.speed': animatedLightNumber({ label: 'Velocidad', key: 'speed', def: 1, min: 0,
    available: obj => obj.light?.style && obj.light.style !== 'steady',
    get: root => root.userData.fx?.speed,
    set: (root, value) => { if (root.userData.fx) root.userData.fx.speed = value },
  }),
  'light.amount': animatedLightNumber({ label: 'Intensidad fx', key: 'amount', def: 0.5, min: 0, max: 1,
    available: obj => obj.light?.style && obj.light.style !== 'steady',
    get: root => root.userData.fx?.amount,
    set: (root, value) => { if (root.userData.fx) root.userData.fx.amount = value },
  }),
  'light.flareIntensity': animatedLightNumber({ label: 'Intensidad flare', key: 'flareIntensity', def: 1, min: 0, max: 2,
    available: obj => obj.light?.flareOn === true,
    get: root => root.userData.flareIntensity,
    set: (root, value) => { root.userData.flareIntensity = value; root.userData.refreshLightEffects?.() },
  }),
  'light.shadowBias': animatedLightNumber({ label: 'Sesgo', key: 'shadowBias', def: 0.0004, min: 0, max: 0.05,
    available: obj => obj.light?.type !== 'area' && obj.light?.shadow === true,
    get: root => root.userData.light?.shadow ? -root.userData.light.shadow.bias : undefined,
    set: (root, value) => { if (root.userData.light?.shadow) { root.userData.light.shadow.bias = -value; root.userData.light.shadow.needsUpdate = true } },
  }),
  'light.shadowNormalBias': animatedLightNumber({ label: 'Sesgo normal', key: 'shadowNormalBias', def: 0, min: 0, max: 1,
    available: obj => obj.light?.type !== 'area' && obj.light?.shadow === true,
    get: root => root.userData.light?.shadow?.normalBias,
    set: (root, value) => { if (root.userData.light?.shadow) { root.userData.light.shadow.normalBias = value; root.userData.light.shadow.needsUpdate = true } },
  }),
}

export default registerNode({
  type: 'light',
  label: 'Luz',
  icon: 'light',
  category: 'Iluminación',
  scalable: false,
  animation: lightOptions,
  kinds: {
    omni: { label: 'Luz de punto', icon: 'light' }, spot: { label: 'Foco', icon: 'spot' }, directional: { label: 'Sol (direccional)', icon: 'sun' }, area: { label: 'Luz rectangular', icon: 'light-area' },
    ...Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, { label: p.label, icon: p.icon }])),
  },
  create(kind = 'omni') {
    const pr = PRESETS[kind]
    if (pr) {
      return {
        name: pr.name, collision: false, color: pr.color, position: pr.position || [0, 1.2, 0], ...(pr.rotation ? { rotation: pr.rotation } : {}),
        light: { type: pr.type, energy: pr.energy, range: pr.range, spotAngle: pr.spotAngle || 45, shadow: !!pr.shadow, style: pr.style, speed: pr.speed, amount: pr.amount, phase: Math.random() * 100 },
      }
    }
    const o = {
      name: kind === 'directional' ? 'Sol' : kind === 'spot' ? 'Foco' : kind === 'area' ? 'Luz rectangular' : 'Luz',
      collision: false, color: '#fff1d6', position: [0, 4, 0],
      light: { type: kind, decay: 2, energy: 1.5, range: 12, spotAngle: 45, areaWidth: 2, areaHeight: 1, flareOn: false, flareSize: 72, flareIntensity: 1, shadow: false, style: 'steady', speed: 1, amount: 0.5, phase: 0 },
    }
    if (kind === 'directional') { o.rotation = [-50, 30, 0]; o.light.energy = 1; o.light.shadow = true }
    return o
  },

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const icon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), iconMat(obj.color))
    root.userData.iconMat = icon.material
    root.userData.editorOnlyVisual = visual
    root.userData.disposeLightEffects = () => { disposeFlare(root); root.userData.areaFrame?.dispose?.() }
    root.userData.updateFlareCamera = (camera) => {
      const u = root.userData
      if (!u.flare || !u.light?.isDirectionalLight || !camera) return
      const v = u.flareCameraPos || (u.flareCameraPos = new THREE.Vector3())
      const dir = u.flareCameraDir || (u.flareCameraDir = new THREE.Vector3())
      // Siempre dentro del far plane; se calcula en espacio mundial y vuelve a coordenadas locales.
      u.light.getWorldDirection(dir)
      v.copy(camera.position).addScaledVector(dir, Math.min(1000, camera.far * 0.6))
      u.flare.position.copy(u.light.worldToLocal(v))
    }
    root.userData.refreshLightEffects = () => {
      const u = root.userData, l = u.light
      if (!u.flare || !l) return
      u.flare.visible = l.intensity > 0.001 && u.flareIntensity > 0
      const brightness = u.flareIntensity * Math.min(1, l.intensity / (1.5 * Math.PI))
      for (const e of u.flareElements) e.color.copy(l.color).multiplyScalar(brightness)
    }
    visual.add(icon)
    root.userData.editorGizmos = []
    const lt = obj.light.type
    let light
    if (lt === 'directional') {
      light = new THREE.DirectionalLight(obj.color, 1)
      light.target.position.set(0, 0, -1)
      root.add(light.target)
      const aim = arrowToward(1.6, '#ffd36a')
      visual.add(aim); root.userData.editorGizmos.push(aim)
    } else if (lt === 'spot') {
      light = new THREE.SpotLight(obj.color, 1)
      light.target.position.set(0, 0, -1)
      root.add(light.target)
      const aim = arrowToward(1.4, '#ffd36a')
      visual.add(aim); root.userData.editorGizmos.push(aim)
    } else if (lt === 'area') {
      light = new THREE.RectAreaLight(obj.color, 1, 2, 1)
      // Three.js emite por +Z; Century orienta las luces dirigidas hacia -Z.
      light.rotation.y = Math.PI
      // El helper oficial comparte pivote y orientación con el emisor, sin segunda rotación independiente.
      const frame = new RectAreaLightHelper(light, '#ffd36a')
      frame.userData.helper = true
      frame.visible = false // fuera de la jerarquía visual editorial: oculto por defecto, incluso en Player
      light.add(frame)
      root.userData.areaFrame = frame
      const aim = arrowToward(0.9, '#ffd36a')
      visual.add(aim); root.userData.editorGizmos.push(frame, aim)
    } else {
      light = new THREE.PointLight(obj.color, 1)
    }
    light.position.set(0, 0, 0) // three pone (0,1,0) por defecto en Directional/Spot
    root.userData.light = light
    root.userData.lightAuthored = obj
    root.userData.refreshLightAppearance = () => {
      const authored = root.userData.lightAuthored
      syncLightColor(root, authored)
      syncLightEnergy(root, authored)
      root.userData.refreshLightEffects()
    }
    root.userData.refreshLightColor = () => {
      const authored = root.userData.lightAuthored
      if (authored) syncTemporalLight(root, authored)
    }
    root.userData.refreshLightTemporal = root.userData.refreshLightColor
    root.add(light)
    return root
  },

  update(root, obj) {
    applyBase(root, obj, false)
    const u = root.userData, l = u.light, p = obj.light
    u.lightAuthored = obj
    const q = normalizeLight({ ...p, ...(u.timelineLight || {}) })
    u.iconMat.color.set(obj.color)
    // Unidades de energía: radiancia = albedo · energía · cosθ  ⇒ en three intensidad = π · energía
    u.fx = { style: LIGHT_STYLES[p.style]?.id || 0, speed: p.speed ?? 1, amount: p.amount ?? 0.5, phase: p.phase || 0 }
    syncLightEnergy(root, obj)
    l.castShadow = p.type !== 'area' && !!p.shadow
    if (l.castShadow) {
      const sh = l.shadow, res = q.shadowRes * (p.type === 'directional' ? 2 : 1)
      if (sh.mapSize.x !== res) { sh.mapSize.set(res, res); sh.map?.dispose(); sh.map = null }
      sh.bias = -q.shadowBias; sh.normalBias = q.shadowNormalBias
      if (p.type === 'directional') {
        const c = sh.camera, e = q.shadowDistance; c.left = c.bottom = -e; c.right = c.top = e; c.near = 0.5; c.far = Math.max(250, e * 4); c.updateProjectionMatrix()
      } else { sh.camera.near = 0.1; sh.camera.far = Math.max(1, p.range) }
      // luces mixtas/estáticas: el mapa de sombras se guarda en caché (se refresca al editar; ver Viewport.invalidateShadows)
      sh.autoUpdate = q.mode === 'dynamic'
      sh.needsUpdate = true
    }
    if (p.type === 'area') {
      l.width = q.areaWidth; l.height = q.areaHeight
      u.areaFrame?.update() // la geometría del helper oficial refleja ancho y alto; no escalar dos veces
    } else if (p.type !== 'directional') {
      l.distance = p.range
      l.decay = q.decay
      if (p.type === 'spot') { l.angle = Math.min(89, p.spotAngle) * DEG; l.penumbra = q.penumbra }
    }
    u.flareIntensity = q.flareIntensity
    syncTemporalLight(root, obj)
  },

})
