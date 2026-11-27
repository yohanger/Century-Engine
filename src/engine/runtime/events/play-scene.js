// Reglas del nivel y entorno de la escena desde los scripts. Se mezcla en PlayMode.prototype, como play-look.js.
//
//  · game.level.canRun / canJump / speedScale / gravityScale: lectura y escritura EN VIVO. Valen para la escena actual y vuelven a los
//    valores de Escena ▸ Nivel al cambiar de escena. No tocan el proyecto guardado.
//  · game.scene: cielo, luz ambiente y niebla (Escena ▸ Cielo / Luz / Niebla). Igual: solo durante el juego; al cambiar de escena o al
//    parar, el entorno vuelve al del proyecto. game.scene.reset() lo devuelve ya.
import { normalizeLevel, levelName } from '../world/params.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const color = (v) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : null

/** Propiedades de entorno editables en juego: clave → saneado (devuelve undefined si el valor no es válido). */
export const SCENE_PROPS = {
  skyTop: (v) => color(v) ?? undefined,
  skyHorizon: (v) => color(v) ?? undefined,
  ground: (v) => color(v) ?? undefined,
  ambientColor: (v) => color(v) ?? undefined,
  ambient: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 4) : undefined),
  skyExposure: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 8) : undefined),
  fog: (v) => !!v,
  volOn: (v) => !!v,
  volDensity: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 1) : undefined),
  volIntensity: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 10) : undefined),
  volNoise: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 1) : undefined),
  volNoiseScale: (v) => (Number.isFinite(+v) ? clamp(+v, 1, 200) : undefined),
  volNoiseSpeed: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 30) : undefined),
  fogStart: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 2000) : undefined),
  fogDensity: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 0.2) : undefined),
  fogColor: (v) => color(v) ?? undefined,
  fogMode: (v) => (v === 'physical' || v === 'simple' ? v : undefined),
  fogFalloff: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 0.05) : undefined),
  fogHeight: (v) => (Number.isFinite(+v) ? clamp(+v, -500, 5000) : undefined),
  fogShafts: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 3) : undefined),
  fogScatter: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 3) : undefined),
}
const LEVEL_RULES = {
  canRun: (v) => !!v,
  canCrouch: (v) => !!v,
  canJump: (v) => !!v,
  speedScale: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 10) : undefined),
  gravityScale: (v) => (Number.isFinite(+v) ? clamp(+v, 0, 10) : undefined),
}

export const sceneMethods = {
  /** game.level: objeto vivo (cada asignación se aplica al momento). */
  _levelApi() {
    const self = this
    const api = { get name() { return levelName(self.project.environment, self.project.scenes.find((x) => x.id === self.project.activeSceneId)?.name) } }
    for (const k of Object.keys(LEVEL_RULES)) {
      Object.defineProperty(api, k, {
        enumerable: true,
        get: () => (self.level || normalizeLevel())[k],
        set: (v) => {
          const x = LEVEL_RULES[k](v)
          if (x === undefined) throw new Error(`game.level.${k}: valor no válido (${v})`)
          self.level = { ...(self.level || normalizeLevel()), [k]: x }
        },
      })
    }
    return api
  },

  /** Entorno efectivo: el del proyecto con los cambios del script encima. */
  _sceneEnv() { return { ...this.project.environment, ...(this._sceneOv || {}) } },
  _sceneApply() {
    const vp = this.ed.vp
    vp.setEnvironment(this._sceneEnv())
    vp.requestRender()
  },
  _sceneReset() {
    if (!this._sceneOv || !Object.keys(this._sceneOv).length) { this._sceneOv = {}; return }
    this._sceneOv = {}
    this._sceneApply()
  },

  /** game.scene: propiedades del entorno (lectura/escritura) + set({…}) + reset(). */
  _sceneApi() {
    const self = this
    const api = {
      get name() { return levelName(self.project.environment, self.project.scenes.find((x) => x.id === self.project.activeSceneId)?.name) },
      get props() { return Object.keys(SCENE_PROPS) },
      set(values) {
        if (!values || typeof values !== 'object') throw new Error('game.scene.set({ fog: true, fogDensity: 0.03, … })')
        const ov = (self._sceneOv ||= {})
        for (const [k, v] of Object.entries(values)) {
          if (!SCENE_PROPS[k]) throw new Error(`game.scene.set: no existe «${k}». Disponibles: ${Object.keys(SCENE_PROPS).join(', ')}`)
          const x = SCENE_PROPS[k](v)
          if (x === undefined) throw new Error(`game.scene.${k}: valor no válido (${v})`)
          ov[k] = x
        }
        self._sceneApply()
      },
      reset() { self._sceneReset() },
    }
    for (const k of Object.keys(SCENE_PROPS)) {
      Object.defineProperty(api, k, { enumerable: true, get: () => self._sceneEnv()[k], set: (v) => api.set({ [k]: v }) })
    }
    return api
  },
}
