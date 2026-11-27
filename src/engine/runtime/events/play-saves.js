// Guardado en el modo Jugar: el almacenamiento (el del host, por proyecto) y lo que toca el mundo al guardar/cargar
// (escena, posición y mirada del jugador, hora, clima, objetos en las manos). El estado lógico lo gestiona events/saves.js.
import { KeyedStorageBackend } from './saves.js'
import { DEG } from '../util.js'
import { sceneGameConfig } from '../game-manager.js'

export const saveMethods = {
  /** El formato de SaveManager no cambia: solo añadimos identidad estable al mundo. */
  _savePlayerSnapshot() {
    const decision = this._scenePlayerDecision()
    if (decision.kind === 'deferred') {
      if (!this._nativePlayerId) return { mode: 'api', prefabId: null }
      const owner = [...(this._runtimePrefabInstances?.values() || [])]
        .find(inst => inst.scene === this.project.activeSceneId && inst.ids.has(this._nativePlayerId))
      const root = owner?.objects?.[0]
      if (!owner || !root?.prefabId) throw new Error('Guardar: jugador Spawn Player sin Prefab de origen')
      return { mode: 'api', prefabId: root.prefabId, prefabRev: root.prefabRev,
        ...(root.parentId ? { parentId: root.parentId } : {}),
        velocity: [...this._nativeRequire().spatial.characterState(this._nativePlayerId).velocity] }
    }
    if (decision.kind === 'native' && this._nativePlayerId) return {
      mode: 'native', nodeId: this._nativePlayerId,
      velocity: [...this._nativeRequire().spatial.characterState(this._nativePlayerId).velocity],
    }
    return { mode: 'none' }
  },

  /** Las referencias al propio Prefab se serializan por índice autoral, nunca por ID aleatorio. */
  _saveViewModelRef(id) {
    const owner = [...(this._runtimePrefabInstances?.values() || [])].find(inst => inst.ids.has(id))
    if (!owner) return id
    const playerOwner = this._nativePlayerId && owner.ids.has(this._nativePlayerId)
    if (!playerOwner) throw new Error(`Guardar: objeto transitorio ajeno al Player no persistible (${id})`)
    const index = owner.objects.findIndex(o => o.id === id)
    const source = this.project.prefabs.find(p => p.id === owner.objects[0]?.prefabId)
    const localId = source?.objects?.[index]?.id
    if (!localId) throw new Error(`Guardar: referencia de Prefab inválida (${id})`)
    return { playerPrefabNode: localId }
  },

  /** Prevalidación ANTES de SaveManager.restore(game) y de cambiar de escena. */
  _validateWorldRestore(w) {
    const state = w?.player
    if (state == null) return null // partida anterior: mantener su contrato sin migración destructiva
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Cargar: identidad del jugador inválida')
    const scene = this.project.scenes.find(s => s.id === (w.scene || this.project.activeSceneId))
    if (!scene) throw new Error(`Cargar: escena no disponible (${w.scene})`)
    const mode = state.mode
    const api = scene.playerSpawnMode === 'api'
    const config = sceneGameConfig(this.project, scene.id).config
    if (mode === 'api') {
      if (!api || scene.playerNodeId || config.player === 'none') throw new Error('Cargar: escena incompatible con Spawn Player')
      if (state.prefabId != null) {
        if (typeof state.prefabId !== 'string' || !state.prefabId) throw new Error('Cargar: referencia Prefab inválida')
        const prefab = this.project.prefabs?.find(p => p.id === state.prefabId)
        if (!prefab || (state.prefabRev != null && prefab.rev !== state.prefabRev))
          throw new Error(`Cargar: Prefab del jugador ausente o con revisión distinta (${state.prefabId})`)
      }
      if (state.parentId != null && (typeof state.parentId !== 'string' || !state.parentId))
        throw new Error('Cargar: padre del Prefab inválido')
    } else if (mode === 'native') {
      if (api || !scene.playerNodeId || scene.playerNodeId !== state.nodeId || config.player === 'none')
        throw new Error('Cargar: identidad CharacterBody3D de escena incompatible')
    } else if (mode === 'legacy') {
      // Partida anterior: conservar estado lógico y mundo, sin resucitar el controlador retirado.
    } else if (mode === 'none') {
      if (api && state.prefabId != null || scene.playerNodeId && config.player !== 'none')
        throw new Error('Cargar: estado sin jugador incompatible con el CharacterBody3D designado')
    } else throw new Error(`Cargar: modalidad de jugador desconocida (${mode})`)
    if (state.velocity != null && (!Array.isArray(state.velocity) || state.velocity.length !== 3 || !state.velocity.every(Number.isFinite)))
      throw new Error('Cargar: velocidad física del jugador inválida')
    if (w.pos != null && (!Array.isArray(w.pos) || w.pos.length !== 3 || !w.pos.every(Number.isFinite)))
      throw new Error('Cargar: posición física del jugador inválida')
    if (w.yaw != null && !Number.isFinite(w.yaw)) throw new Error('Cargar: orientación del jugador inválida')
    if (w.pitch != null && !Number.isFinite(w.pitch)) throw new Error('Cargar: inclinación de cámara inválida')
    const refs = [...(w.held || []).map(entry => entry?.id), ...(w.stashed || [])]
    for (const ref of refs) {
      if (typeof ref === 'string') continue // referencias autorales de partidas anteriores
      const nodeId = ref?.playerPrefabNode
      const source = this.project.prefabs.find(p => p.id === state.prefabId)
      if (mode !== 'api' || !state.prefabId || typeof nodeId !== 'string' ||
          !source?.objects?.some(o => o.id === nodeId))
        throw new Error('Cargar: referencia interna del Prefab de jugador inválida')
    }
    if ((!state.prefabId && mode === 'api' || mode === 'none') && refs.length)
      throw new Error('Cargar: una partida sin jugador no puede contener objetos en las manos')
    return state
  },

  /** Se ejecuta tras montar Jolt y antes de rehidratar Gameplay Objects y manos. */
  _restorePlayerSnapshot(state, w) {
    if (!state) return // saves anteriores: sin metadatos de Prefab
    const decision = this._scenePlayerDecision()
    let spawned = null
    try {
      if (state.mode === 'api') {
        if (decision.kind !== 'deferred') throw new Error('Cargar: escena Spawn Player no preparada')
        const previous = [...(this._runtimePrefabInstances?.values() || [])]
          .find(inst => inst.ids.has(this._nativePlayerId))
        if (previous) this._prefabDestroy(previous.rootId, true)
        if (state.prefabId) {
          const opts = { ...(state.parentId ? { parent: state.parentId } : {}), ...(w.pos ? { position: w.pos } : {}) }
          this._rebuildingSavedPlayer = true
          try { spawned = this._spawnPlayer(state.prefabId, opts) }
          finally { this._rebuildingSavedPlayer = false }
        }
        if (!state.prefabId && (this._nativePlayerId || this.hasPlayer)) throw new Error('Cargar: escena API conserva jugador inesperado')
      } else if (state.mode === 'native') {
        if (decision.kind !== 'native' || this._nativePlayerId !== state.nodeId || !this._nativeCharacterState())
          throw new Error('Cargar: CharacterBody3D autoral no está disponible en Jolt')
      } else if (state.mode === 'none' && decision.kind === 'deferred') {
        const previous = [...(this._runtimePrefabInstances?.values() || [])]
          .find(inst => inst.ids.has(this._nativePlayerId))
        if (previous) this._prefabDestroy(previous.rootId, true)
      }
      if (this._nativePlayerId) {
        if (w.pos) this._nativePositionSet(w.pos)
        if (Number.isFinite(w.yaw)) this.yaw = w.yaw * DEG
        if (Number.isFinite(w.pitch)) this.pitch = w.pitch * DEG
        if (state.velocity) this._nativeRequire().spatial.setVelocity(this._nativePlayerId, state.velocity)
      }
    } catch (error) {
      // Si falla el ajuste físico tras crear el Prefab, retirar esa única instancia.
      if (spawned?.is_valid?.()) this._prefabDestroy(spawned, true)
      throw error
    }
  },

  /** Resolver IDs autorales del Prefab con los IDs nuevos de la instancia física. */
  _restoreViewModelRef(ref) {
    if (typeof ref === 'string') return ref
    if (typeof ref?.playerPrefabNode !== 'string') return null
    const owner = [...(this._runtimePrefabInstances?.values() || [])]
      .find(inst => inst.ids.has(this._nativePlayerId))
    const source = this.project.prefabs.find(p => p.id === owner?.objects?.[0]?.prefabId)
    const index = source?.objects?.findIndex(obj => obj.id === ref.playerPrefabNode) ?? -1
    return index >= 0 ? owner?.objects?.[index]?.id || null : null
  },

  _saveStorage() { return (this._saveBackend ??= new KeyedStorageBackend(this.rt.storage)) },

  /** Lo que hay que recordar del mundo para volver exactamente aquí. */
  captureWorld() {
    this._rememberEventPhysics()
    this._gpCapture()
    const p = this.project, w = this.ed.world
    const scene = p.scenes.find((s) => s.id === p.activeSceneId)
    const held = this.vm ? [...this.vm.held.values()].map((h) => ({ id: this._saveViewModelRef(h.id), slot: h.slot })) : []
    const captured = {
      scene: scene?.id || '', sceneName: scene?.name || '',
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw / DEG, pitch: this.pitch / DEG,
      timeOn: w.timeOn, weatherOn: w.weatherOn, hour: w.hour, flow: w.flow, preset: w.preset, intensity: w.intensity,
      water: this._waterConnection ? this.water.snapshot() : null,
      ...(w.weatherOn && { weatherEvolution: w.captureWeatherEvolution() }),
      ...(w.field && { cloudField: { seed: w.field.seed, windOff: [...w.field.windOff], evolution: w.field.evolution, forcing: { ...w.field.f }, volume: w.field.map.volume.snapshot() } }),
      ...(this.ed.world.tornado && { tornado: { ...this.ed.world.tornado } }),
      held,
      stashed: this.vm ? [...this.vm.stash.keys()].map(id => this._saveViewModelRef(id)) : [],
      player: this._savePlayerSnapshot(),
    }
    if (!this._waterConnection && this._liquidViews?.length) captured.water = this.water.snapshot()
    const destructive=this._destructionSnapshot?.()
    if(destructive)captured.tornadoDestruction=destructive
    if(this.water?.suspensionEnabled)captured.water=this.water.snapshot()
    return captured
  },

  /** Vuelve a la escena guardada, coloca al jugador y restablece hora, clima y manos. */
  async restoreWorld(w) {
    const playerSnapshot = this._validateWorldRestore(w)
    const g = this.game, wasMuted = g?._nativeSignalsMuted
    if (g) g._nativeSignalsMuted = true
    this._restoringPhysical = true
    let restoredRootId = null
    try {
    const sameScene = !w.scene || w.scene === this.project.activeSceneId
    // En la misma escena no se ejecuta _teardownScene: limpiar también el stash
    // para que no sobrevivan objetos/colliders de la partida anterior.
    if (sameScene) this._vmTeardown({ restoreWorld: true })
    if (w.scene) await this._gotoScene({ scene: w.scene, tag: 'player', pos: w.pos, yaw: w.yaw })
    else if (w.pos && this._nativePlayerId) this._teleport({ mode: 'pos', pos: w.pos, yaw: w.yaw })
    if (sameScene && !this.vm && this._nativePlayerId && playerSnapshot?.mode !== 'api') this._vmSetup()
    this._restorePlayerSnapshot(playerSnapshot, w)
    if (playerSnapshot?.mode === 'api' && playerSnapshot.prefabId) {
      restoredRootId = [...(this._runtimePrefabInstances?.values() || [])]
        .find(owner => owner.ids.has(this._nativePlayerId))?.rootId || null
    }
    if (sameScene && !this.vm && this._nativePlayerId) this._vmSetup()
    // La carga puede ocurrir dentro de la misma escena; también en ese caso hay que restaurar sus cuerpos.
    for (const e of this.events || []) {
      const idx = e.erased ? -1 : g.activePage(e.props, e.id)
      if (idx !== e.pageIdx) this._applyPage(e, idx)
    }
    this._restoreEventPhysics()
    this._gpRestore()
    // Cargas anteriores no traen agua: usan el estado inicial de la escena.
    if (w.water != null) {
      if (!this._waterConnection && !this._liquidViews?.length && !this.water.suspensionEnabled) throw new Error('Agua: esta partida exige una escena con agua física')
      this.water.restore(w.water)
      if (this._waterConnection) this.ed.updatePhysicalWater(this.water)
      this._liquidRender?.()
    }
    if (Number.isFinite(w.pitch)) this.pitch = w.pitch * DEG
    const world = this.ed.world
    if (w.timeOn && Number.isFinite(w.hour)) { world.setHour(w.hour); world.setFlow(!!w.flow) }
    if (w.weatherOn && w.preset) world.setWeather(w.preset, Number.isFinite(w.intensity) ? w.intensity : 1, 0)
    if (w.weatherEvolution) world.restoreWeatherEvolution(w.weatherEvolution)
    if (w.cloudField && world.field) world.restoreCloudField(w.cloudField)
    if (w.tornado && world.tornado) {
      const t=w.tornado,c=world.tornado
      // S12 guardaba únicamente edad/actividad; la transición S02 es explícita.
      const snapshot = t.phase ? t : { ...c, ...t,
        phase: t.active ? 'active' : 'ended', phaseAge: t.active ? Math.min(t.age,c.duration) : 0,
        targetIntensity: Number.isFinite(t.intensity) ? t.intensity : c.targetIntensity }
      world.restoreTornado(snapshot)
      this._tornadoStarted=!!world.tornado.active || ['weakening','dissipation','ended'].includes(world.tornado.phase)
      this._tornadoEnded=world.tornado.phase==='ended'
      this._tornadoPhase=world.tornado.phase
    }
    if(w.tornadoDestruction)this._destructionRestore?.(w.tornadoDestruction)
    for (const entry of w.stashed || []) {
      const id = this._restoreViewModelRef(entry)
      if (!id || this.vm?.stash.has(id)) continue
      try { this.viewModelStash({ target: id }) } catch (error) { this.game?.report(error, `Cargar stash: ${id}`) }
    }
    for (const h of w.held || []) {
      const id = this._restoreViewModelRef(h.id)
      if (!id || this.vm?.held.has(id)) continue
      try { await this.viewModelAttach({ target: id, slot: h.slot, seconds: 0, emit: false }) }
      catch (error) { this.game?.report(error, `Cargar mano: ${id}`) }
    }
    } catch (error) {
      if (restoredRootId) this._prefabDestroy(restoredRootId, true)
      throw error
    } finally {
      this._restoringPhysical = false
      if (g) g._nativeSignalsMuted = wasMuted
    }
  },
}
