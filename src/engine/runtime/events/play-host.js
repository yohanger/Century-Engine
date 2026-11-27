// Host del intérprete: API que ven los scripts y el jugador
import { parseMessage } from './textcodes.js'
import { NEVER } from './play-shared.js'
import { levelName } from '../world/params.js'
import { fadeState } from './scene-transitions.js'

export const hostMethods = {
  // =================== host del intérprete ===================
  _host() {
    const self = this
    const alive = (fn) => (...a) => (self.on ? fn(...a) : NEVER)
    return {
      languageChanged: (code) => {
        this.state.lang = code
        if (self.runtime) { try { self.rt.storage.set('language', code) } catch { /* sin almacenamiento */ } }
      },
      say: alive((m) => new Promise((resolve) => {
        const msg = parseMessage(String(m.text ?? ''))
        const d = { speaker: m.speaker || '', text: msg.plain, msg, runs: msg.runs, pos: m.pos || 'bottom', shown: 0, done: false, age: 0, hold: 0, waitInput: false, stay: msg.stay, auto: !!self.main && self._playerMode() === 'free', anim: m.anim || null, resolve }
        this.state.dialog = d
        self._dialogVoice(this.state.dialog, m) // el proxy reactivo: es lo que se compara con this.state.dialog
      })),
      choose: alive((o) => new Promise((resolve) => {
        const options = (o.options || []).map(String)
        if (!options.length) return resolve(-1)
        this.state.choices = { options, prompt: o.prompt || '', cancel: o.cancel ?? -1, index: 0, anim: o.anim || null, resolve }
      })),
      wait: alive((s) => (s > 0 ? new Promise((r) => self.timers.push({ t: s, r })) : new Promise((r) => self.frameWait.push(r)))),
      frame: alive(() => new Promise((r) => self.frameWait.push(r))),
      fade: alive(({ dir, seconds, color }) => {
        this.state.fade = fadeState(dir, seconds, color || '#000000')
        return seconds > 0 ? new Promise((r) => self.timers.push({ t: seconds, r })) : Promise.resolve()
      }),
      caption: alive(({ text, seconds, pos, anim }) => {
        const id = (self._capSeq = (self._capSeq || 0) + 1)
        this.state.caption = { id, text: String(text ?? ''), pos: pos || 'bottom', anim: anim || null }
        return new Promise((r) => self.timers.push({ t: Math.max(0.05, seconds || 3), r: () => { if (this.state.caption?.id === id) this.state.caption = null; r() } }))
      }),
      letterbox: (v) => { this.state.letterbox = v },
      levelName: (text, opts) => self.showLevelName(text, opts),
      ui: self.ui.api,
      get audio() { return self.audio?.script },
      teleport: alive((t) => self._teleport(t)),
      gotoScene: alive((o) => self._gotoScene(o)),
      setControl: (m) => { const mode = m === true || m == null ? 'free' : m === false ? 'locked' : String(m); self.control = mode === 'free'; self.lookControl = mode !== 'frozen'; if (self.main) self.main.mode = mode },
      nodeVisible: (id, v) => self._nodeVisible(id, v),
      nodePersist: (id, v) => self._persistSet(id, v),
      nodeMove: alive((id, o) => self._nodeMove(id, o)),
      prefabInstantiate: alive((id, options) => self._prefabInstantiate(id, options)),
      spawnPlayer: alive((id, options) => self._spawnPlayer(id, options)),
      prefabDestroy: alive((ref) => self._prefabDestroy(ref)),
      sceneInstantiate: alive((id, options) => self._sceneInstantiate(id, options)),
      sceneDestroy: alive((ref) => self._sceneDestroy(ref)),
      moveRoute: alive((o) => self.routeRun(o)),
      stopRoute: (t, n, ev) => self.routeStop(t, n, ev),
      get nav() { return self.nav },
      timelinePlay: alive((n, o) => self.timelinePlay(n, o)),
      timelineStop: (n) => self.timelineStop(n),
      timelineSkip: (n) => self.timelineSkip(n),
      timelineControl: (n, w, v) => self.timelineControl(n, w, v),
      timelineInfo: (n) => self.timelineInfo(n),
      timelineList: () => (this.project.timelines || []).map((t) => t.name),
      textCtx: (eventId) => self._textCtx(eventId),
      get world() { return self.ed.world },
      _sceneEnv: () => self._sceneEnv(), // entorno efectivo (proyecto + game.scene.set): game.weather.visibility lo usa para el modelo de niebla
      signalEvents: (n, d) => self._signalEvents(n, d),
      saveStorage: () => self._saveStorage(),
      captureWorld: () => self.captureWorld(),
      restoreWorld: alive((w) => self.restoreWorld(w)),
      validateWorldRestore: alive((w) => self._validateWorldRestore(w)),
      get weatherSound() { return self.weatherSound },
      get level() { return self._levelApi() },
      get scene() { return self._sceneApi() },
      get water() { return (self._waterApiObj ??= self._waterApi()) },
      get physics() { return (self._physicsApiObj ??= self._physicsApi()) },
      partyChanged: () => self._syncParty(),
      eraseEvent: (id) => self._erase(id),
      eventHandle: (id) => self._eventHandle(id),
      findNode: (name) => self._nodeHandle(name),
      findEvent: (name) => { const o = self._find(name, 'event'); return o ? self._eventHandle(o.id) : undefined },
      currentEventId: () => self.main?.ctx?.eventId,
      get player() { return self._playerApi() },
      // El registro sale de la página activa del evento, no de una copia del modelo.
      databaseItemOfEvent: (ref) => {
        const obj = self._find(ref, 'event')
        const e = obj && self.events.find((v) => v.id === obj.id)
        const page = e?.props.pages[e.pageIdx]
        return e ? { id: e.id, itemId: page?.graphic?.kind === 'item' ? +page.graphic.itemId || 0 : 0 } : null
      },
      // Usa el mismo gráfico de evento que los objetos 3D: no crea otro modelo de arma.
      databaseWeaponOfEvent: (ref) => {
        const obj = self._find(ref, 'event')
        const e = obj && self.events.find((v) => v.id === obj.id)
        const page = e?.props.pages[e.pageIdx]
        return e ? { id: e.id, weaponId: page?.graphic?.kind === 'weapon' ? +page.graphic.weaponId || 0 : 0 } : null
      },
      viewModelAttach: alive((o) => self.viewModelAttach(o)),
      viewModelHeld: (p, eventId) => self.viewModelHeld(p, eventId),
      viewModelRelease: alive((o) => self.viewModelRelease(o)),
      viewModelThrow: alive((o) => self.viewModelThrow(o)),
      viewModelClear: alive((slot) => self.viewModelClear(slot)),
      viewModelStash: alive((o) => self.viewModelStash(o)),
      viewModelUnstash: alive((o) => self.viewModelUnstash(o)),
      get viewModel() { return self._vmApi() },
      get profile() { return self._profileApi() },
      get graphics() { return self._graphicsApi() },
      lights: (tag) => self._lightsApi(tag),
      get animation() { return self._animApi() },
      get cameraShake() { return self._shakeApi() },
      get camera() { return self._cameraApi() },
      cameraEvent: (request) => self._cameraEventControl(request),
      animationPlay: (t, c, o, e) => self.animationPlay(t, c, o, e),
      animationStop: (t, c, o, e) => self.animationStop(t, c, o, e),
      animationPlaying: (t, c, e) => self.animationPlaying(t, c, e),
      get inputApi() { return self._inputApi() },
      get input() { return self.input },
      inputOp: (op, ref, arg) => self._inputOp(op, ref, arg),
      inputWait: alive((ref) => new Promise((res) => self._inWait.push({ ref, r: res }))),
      raycast: (origin, dir, maxDist, opts) => self._raycast(origin, dir, maxDist, opts),
      sensor: (opts) => self._senseCreate(opts),
      findByTag: (tag) => self._findByTag(tag),
      getNodesInGroup: (name) => self._findByGroup(name),
      callGroup: (name, method, ...args) => self._callGroup(name, method, ...args),
      findByLayer: (name) => self._findByLayer(name),
      surfaceAt: (x, y, z) => self.surfaceAt(x, y, z),
      log: (msg, kind, context) => { if (self.on) self.rt.log?.(msg, kind, context) },
      error: (msg) => { if (!self.on) return; this.state.errors++; self.rt.log?.(msg, 'error', 'Script'); this.rt.toast(msg, 'error', 6000); console.error(msg) },
    }
  },

  // game.raycast / game.player.look: ver play-look.js


}
