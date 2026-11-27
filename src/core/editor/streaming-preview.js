import { BoxGeometry, EdgesGeometry, LineBasicMaterial, LineSegments } from 'three'
import { watch } from '@vue/reactivity'
import { store, activeScene, commit, selectObject, toast } from '../store.js'
import { loadScene, saveScene } from '../db.js'
import { normalizeChunk } from '../../engine/runtime/streaming/config.js'
import { mountChunkPreview } from '../../engine/runtime/streaming/scene.js'
import { getDef } from '../../engine/runtime/nodes/index.js'
import { nodeScaleTarget } from '../../engine/runtime/nodes/three-helpers.js'
import { DEG } from '../../engine/runtime/util.js'

const projectKey = () => [store.project?.id, store.project?.activeSceneId].join('/')
const editable = () => !store.locked && !store.play.on && !store.gameView.on && !store.filmMode

export class StreamingPreview {
  constructor(editor) {
    this.editor = editor
    this.instances = new Map()
    this.sources = new Map()
    this.pending = new Map()
    this.boundsMaterial = new LineBasicMaterial({ color: 0x5aadff })
    const box = new BoxGeometry()
    this.boundsGeometry = new EdgesGeometry(box)
    box.dispose()
    this.bounds = new LineSegments(this.boundsGeometry, this.boundsMaterial)
    this.bounds.userData.pickIgnore = true
    this.bounds.visible = false
    editor.vp.overlay.add(this.bounds)
    this.stop = watch(() => [
      projectKey(), activeScene()?.streaming, store.project?.scenes.map(scene => [scene.id, scene.name]),
      editable(), store.view.terrain, store.view.foliage,
    ], () => this.refresh(), { deep: true, immediate: true })
  }

  refresh() {
    const projectId = store.project?.id
    if (this.projectId !== projectId) {
      this.pending.delete(this.projectId)
      this.projectId = projectId
    }
    const key = projectKey()
    if (this.key !== key) {
      this.clear()
      this.key = key
    }
    const config = activeScene()?.streaming
    const chunks = config?.enabled ? config.chunks || [] : []
    const sceneNames = new Map(store.project?.scenes.map(scene => [scene.id, scene.name]))
    const previous = store.chunkSelection
    if (!editable() && previous) this.select(null)
    for (const [index, entry] of this.instances) {
      if (!sceneNames.has(entry.id) || chunks[index]?.sceneId !== entry.id) {
        entry.mount.dispose()
        this.instances.delete(index)
      }
    }
    if (previous && this.instances.get(previous.index)?.id !== previous.sceneId) this.select(null)
    const rows = []
    chunks.forEach((raw, index) => {
      const id = raw.sceneId
      if (id === store.project?.activeSceneId || !sceneNames.has(id)) return
      const chunk = normalizeChunk(raw)
      this.load(id)
      let entry = this.instances.get(index)
      const source = this.sources.get(id)
      if (!entry && source?.record && !source.failed && editable()) {
        try {
          const mount = mountChunkPreview(this.editor, source.record, chunk)
          entry = { id, mount, idsByNode: new Map([...mount.sourceNodes].map(([nodeId, node]) => [node, nodeId])) }
          this.instances.set(index, entry)
        } catch (error) {
          source.failed = true
          toast('No se pudo mostrar el chunk: ' + error.message, 'error')
        }
      }
      if (entry) {
        const { root } = entry.mount
        if (root.position.x !== chunk.x || root.position.y !== chunk.y || root.position.z !== chunk.z) {
          root.position.set(chunk.x, chunk.y, chunk.z)
          this.editor.vp.invalidateShadows()
        }
        // Las piezas de terreno permanecen independientes de las herramientas de la escena madre.
        for (const part of entry.mount.terrainParts) {
          part.mesh.visible = part.visible && store.view.terrain !== false
          part.foliage.visible = part.visible && store.view.foliage !== false
        }
        entry.mount.show(editable())
      }
      rows.push({
        index, sceneId: id, name: sceneNames.get(id), ready: !!entry,
        nodes: entry ? this.rows(entry, source.record.objects) : [],
      })
    })
    store.streamingPreviewRows = rows
    this.updateBounds()
    this.editor.vp.requestRender()
  }

  load(id) {
    if (this.sources.has(id) || !editable() || !store.project) return
    const projectId = store.project.id
    const source = {}
    this.sources.set(id, source)
    loadScene(projectId, id).then(record => {
      if (this.sources.get(id) !== source) return
      source.record = record
      this.refresh()
    }).catch(error => {
      if (this.sources.get(id) !== source) return
      source.failed = true
      toast('No se pudo leer la escena del chunk: ' + error.message, 'error')
    })
  }

  rows(entry, objects) {
    const groups = new Map()
    for (const obj of objects) {
      if (!entry.mount.sourceNodes.has(obj.id)) continue
      const children = groups.get(obj.parentId || '') || []
      children.push(obj)
      groups.set(obj.parentId || '', children)
    }
    const rows = []
    const visit = (parent, depth) => {
      for (const obj of groups.get(parent) || []) {
        rows.push({ id: obj.id, name: obj.name, type: obj.type, kind: obj.kind, depth })
        visit(obj.id, depth + 1)
      }
    }
    visit('', 0)
    return rows
  }

  select(index, nodeId = null) {
    const entry = this.instances.get(index)
    if (index != null && (!entry || !editable() || nodeId && !entry.mount.sourceNodes.has(nodeId))) return
    if (index == null && !store.chunkSelection) return
    selectObject(null)
    if (entry) {
      if (!nodeId && ['rotate', 'scale'].includes(store.gizmo)) store.gizmo = 'translate'
      store.chunkSelection = { index, sceneId: entry.id, nodeId }
      store.prefs.rightTab = 'object'
      if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
    }
    this.editor.setSelection(store.selectedId, store.selectedIds)
  }

  selection() {
    const selection = store.chunkSelection
    if (!selection || !editable()) return null
    const entry = this.instances.get(selection.index)
    if (entry?.id !== selection.sceneId) return null
    if (!selection.nodeId) return { ...selection, node: entry.mount.root }
    const source = this.sources.get(entry.id).record
    const obj = source.objects.find(obj => obj.id === selection.nodeId)
    const node = entry.mount.sourceNodes.get(selection.nodeId)
    if (!obj || !node) return null
    const byId = new Map(source.objects.map(item => [item.id, item]))
    let locked = false
    for (let current = obj; current; current = byId.get(current.parentId)) {
      if (current.locked) { locked = true; break }
    }
    return { ...selection, obj, node, locked, scalable: getDef(obj.type).scalable }
  }

  pick(raycaster) {
    if (!editable() || !this.instances.size) return null
    const roots = new Map()
    for (const [index, entry] of this.instances) if (entry.mount.root.visible) roots.set(entry.mount.root, { index, entry })
    for (const hit of raycaster.intersectObjects([...roots.keys()], true)) {
      let root = hit.object
      let mountedNode = null
      while (root.parent && !roots.has(root)) {
        if (!root.visible || root.userData.helper || root.userData.pickIgnore) break
        if (!mountedNode && root.userData.kind === 'object') mountedNode = root
        root = root.parent
      }
      const candidate = roots.get(root)
      if (!candidate || hit.object.material?.visible === false) continue
      return { index: candidate.index, nodeId: candidate.entry.idsByNode.get(mountedNode) || null, distance: hit.distance }
    }
    return null
  }

  owns(target) {
    const selected = this.selection()
    return selected && target && (target === selected.node || target === selected.node.userData.visual) ? selected : null
  }

  setTransform(field, value) {
    const selected = this.selection()
    if (!selected || selected.locked || !['position', 'rotation', 'scale'].includes(field)) return
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) return
    if (!selected.obj) {
      if (field !== 'position') return
      this.moveChunk(selected, value)
      return
    }
    if (field === 'scale' && !selected.scalable) return
    this.commitNode(selected, field, value)
    this.editor._updateBoxes()
  }

  moveChunk(selected, [x, y, z]) {
    const scene = activeScene(), config = scene?.streaming
    const chunk = config?.chunks[selected.index]
    if (chunk?.sceneId !== selected.sceneId || x === chunk.x && y === chunk.y && z === chunk.z) return
    scene.streaming = { ...config, chunks: config.chunks.map((item, index) => index === selected.index ? { ...item, x, y, z } : item) }
    this.editor.vp.invalidateShadows()
    commit('Mover chunk')
  }

  commitNode(selected, field, after) {
    const { obj } = selected
    const before = Array.from(obj[field] || (field === 'scale' ? [1, 1, 1] : [0, 0, 0]))
    if (after.every((value, index) => value === before[index])) return
    const delta = { sceneId: selected.sceneId, nodeId: obj.id, field, before, after }
    this.applyDelta(delta, false)
    commit('Transformar ' + obj.name + ' en escena vinculada', { streamDelta: delta })
  }

  finish(control) {
    const selected = this.owns(control.object)
    if (!selected || selected.locked) return
    const { node, obj } = selected
    if (!obj) {
      this.moveChunk(selected, node.position.toArray())
      return
    }
    const field = control.mode === 'scale' ? 'scale' : control.mode === 'rotate' ? 'rotation' : 'position'
    const after = field === 'scale' ? nodeScaleTarget(node, obj.type).scale.toArray()
      : field === 'rotation' ? [node.rotation.x / DEG, node.rotation.y / DEG, node.rotation.z / DEG]
        : node.position.toArray()
    this.commitNode(selected, field, after)
  }

  applyDelta(delta, reverse) {
    const record = this.sources.get(delta.sceneId)?.record
    const obj = record?.objects.find(item => item.id === delta.nodeId)
    if (!obj) throw new Error('El nodo de la escena vinculada ya no está disponible')
    const value = (reverse ? delta.before : delta.after).slice()
    const id = store.project.id
    if (!this.pending.has(id)) this.pending.set(id, new Map())
    const scenes = this.pending.get(id)
    if (!scenes.has(delta.sceneId)) scenes.set(delta.sceneId, new Map())
    const objects = scenes.get(delta.sceneId)
    objects.set(obj.id, { ...objects.get(obj.id), [delta.field]: value })
    obj[delta.field] = value
    for (const entry of this.instances.values()) {
      const node = entry.id === delta.sceneId && entry.mount.sourceNodes.get(obj.id)
      if (!node) continue
      node._lfNodeOwner[delta.field] = value
      // Actualiza solo la transformación. Los identificadores del montaje siguen siendo privados.
      if (delta.field === 'position') node.position.fromArray(value)
      if (delta.field === 'rotation') node.rotation.set(value[0] * DEG, value[1] * DEG, value[2] * DEG)
      if (delta.field === 'scale') nodeScaleTarget(node, obj.type).scale.fromArray(value)
    }
    store.streamingPreviewRows = store.streamingPreviewRows.slice()
    this.editor.vp.invalidateShadows()
    this.editor.vp.requestRender()
  }

  async flush(projectId) {
    const scenes = this.pending.get(projectId)
    if (!scenes) return
    for (const [sceneId, objects] of scenes) {
      const patches = new Map(objects)
      const scene = await loadScene(projectId, sceneId)
      if (!scene) throw new Error('No se encontró la escena vinculada para guardar')
      for (const [nodeId, values] of patches) {
        const obj = scene.objects.find(item => item.id === nodeId)
        if (!obj) throw new Error('No se encontró el nodo vinculado para guardar')
        Object.assign(obj, values)
      }
      await saveScene(projectId, sceneId, scene)
      for (const [nodeId, values] of patches) if (objects.get(nodeId) === values) objects.delete(nodeId)
      if (!objects.size) scenes.delete(sceneId)
    }
    if (!scenes.size) this.pending.delete(projectId)
  }

  updateBounds() {
    const selected = this.selection()
    this.bounds.visible = !!selected && !selected.nodeId
    if (!this.bounds.visible) return
    const raw = activeScene()?.streaming?.chunks[selected.index]
    if (!raw) return
    const chunk = normalizeChunk(raw)
    this.bounds.position.copy(selected.node.position)
    this.bounds.scale.set(chunk.width, Math.max(chunk.height, 0.05), chunk.depth)
  }

  clear() {
    for (const entry of this.instances.values()) entry.mount.dispose()
    this.instances.clear()
    this.sources.clear()
    store.streamingPreviewRows = []
    store.chunkSelection = null
    this.bounds.visible = false
  }

  dispose() {
    this.stop()
    this.clear()
    this.bounds.removeFromParent()
    this.bounds.geometry.dispose()
    this.bounds.material.dispose()
  }
}
