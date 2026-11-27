// Comandos de la aplicación: una sola definición alimenta los menús, el menú contextual,
// los atajos mostrados y la paleta de comandos (Ctrl+K).
import {
  store, editorSettings, undo, redo, saveNow, toast, selectObject, removeSelected, addTerrain, addTerrainPiece, terrainOn, removeTerrain, selectTerrain, setPieceVisible, duplicateSelected, linkedDuplicateSelected, makeMeshIndependent, copySelected, pasteSelected, canPasteSelected, groupSelected, ungroup,
  startPlace, placeModel, addObject, getObject, importFiles, saveLfproj, saveAll, lockEditor, openLfprojDialog, addScene, updateSettings, selectionRoots,
  parentSelectionToActive, unparentSelection, collectionGroupTargets, moveToCollectionGroup, pathOf, joinSelectedMeshes, addTargetParent, switchScene,
  openEventEditor, openScriptEditor, insertNodeRefInVSCode, createScript, createShader, createShaderGraph, openShaderEditor, openDatabase, openTagLayers, openInVSCode, openGameSettings, openEngineSettings, openExportGame, createUi, openUiEditor, openUiSlots, openThemeEditor, openTimelineEditor, openUiGallery, openCaptureImport, exportSceneForFilm, importFilmDialog, openFilmmaker, openLocalization, openDocs,
} from './store.js'
import { allDefs, getDef } from '../engine/runtime/nodes/index.js'
import { newPhysicsShape } from '../engine/runtime/physics/shapes.js'
import { dockMenuItems } from './editor/view-dock-session.js'
import { shiftANodeCatalog } from './add-menu-catalog.js'
import { pickFile } from '../engine/runtime/util.js'
import { win } from '../engine/runtime/platform.js'
import { VIEW_MODES } from '../engine/runtime/render/view-diagnostics-contract.js'
import { RENDERERS, methodOf } from '../engine/runtime/render/config.js'

const hasSel = () => store.selectedIds.length > 0
const isGroupSel = () => getObject(store.selectedId)?.type === 'group'
const toggleDocks = () => { const both = store.prefs.leftOpen || store.prefs.rightOpen; store.prefs.leftOpen = store.prefs.rightOpen = !both }

function setGizmo(g) { store.tool = 'select'; store.gizmo = g }
function brush(id) { store.terrainTool = id; store.tool = 'terrain' }

/** Una escena vinculada puede colgar únicamente de un nodo autoral editable. */
export function canParentSceneInstance(node) {
  if (!node || node.type === 'terrain' || node.type === 'sceneInstance' || node.sceneInstanceOwner) return false
  let current = node
  while (current) {
    if (current.locked) return false
    current = current.parentId ? getObject(current.parentId) : null
  }
  return true
}

/** Punto de entrada único del selector, disponible aunque la Jerarquía esté cerrada. */
export function openSceneInstancePicker(parentId = null) {
  if (!store.project || store.locked || store.play.on || store.filmMode || store.gameView.on ||
      store.editor?.edit || store.modal || store.palette || store.addModal) return false
  const parent = parentId ? getObject(parentId) : null
  if (parentId && !canParentSceneInstance(parent)) {
    toast('Selecciona un nodo padre editable para instanciar una escena', 'warn')
    return false
  }
  store.sceneInstanceTarget = {
    projectId: store.project.id, sceneId: store.project.activeSceneId,
    parentId, parentName: parent?.name || '',
  }
  store.menu = null
  store.modal = 'sceneInstance'
  return true
}

/** CollisionShape3D no se puede colocar en una raíz o dentro de una malla.
 * Se añade como hijo del cuerpo seleccionado, como en el editor de Godot. */
function addShapeToBody(kind) {
  const selected = getObject(store.selectedId)
  if (!selected || !['staticbody3d', 'rigidbody3d', 'characterbody3d', 'area3d'].includes(selected.type)) {
    toast('Selecciona un cuerpo físico o Area3D para añadir CollisionShape3D', 'error')
    return null
  }
  if (kind === 'mesh' && selected.type !== 'staticbody3d') {
    toast('TriMeshShape3D necesita un StaticBody3D (no RigidBody3D ni Area3D)', 'error')
    return null
  }
  const shapes = store.project.objects.filter(o => ['primitive', 'mesh'].includes(o.type) && o.parentId === selected.id)
  return addObject({ type: 'collisionshape3d', kind,
    ...(kind === 'mesh' ? { props: { shape: { ...newPhysicsShape('mesh'), sourceId: shapes.length === 1 ? shapes[0].id : '' }, disabled: false } } : {}),
  }, { parentId: selected.id })
}

function define() {
  const C = []
  const add = (id, label, o = {}) => C.push({ id, label, group: 'Acciones', ...o })

  // --- Archivo ---
  add('file.projects', 'Proyectos recientes…', { group: 'Archivo', icon: 'folder', run: () => (store.modal = 'projects') })
  add('file.rename', 'Renombrar proyecto…', { group: 'Archivo', run: () => (store.modal = 'rename'), disabled: () => !store.project })
  add('file.save', 'Guardar proyecto', { group: 'Archivo', icon: 'save', keys: 'Ctrl S', run: () => saveAll() })
  // Reutiliza el cierre seguro; no abre otra ventana ni mantiene dos sesiones de Editor.
  add('file.close', 'Volver al Hub', { group: 'Archivo', icon: 'folder', run: () => lockEditor(), disabled: () => store.locked || !store.project })
  add('file.saveProject', 'Descargar copia (.lfproj)', { group: 'Archivo', icon: 'save', keys: 'Ctrl Shift S', run: () => saveLfproj() })
  add('film.export', 'Nether Film Maker: exportar escena (.nfm)', { group: 'Archivo', icon: 'play', run: () => exportSceneForFilm() })
  add('film.import', 'Nether Film Maker: importar película (.nfm)…', { group: 'Archivo', icon: 'folder', run: () => importFilmDialog() })
  add('film.open', 'Abrir Nether Film Maker', { group: 'Archivo', icon: 'play', run: () => openFilmmaker() })
  add('file.openProject', 'Abrir proyecto (.lfproj)…', { group: 'Archivo', icon: 'folder', keys: 'Ctrl O', run: () => openLfprojDialog() })
  add('file.newScene', 'Nueva escena', { group: 'Archivo', icon: 'plus', run: () => addScene('Escena') })
  add('file.import', 'Importar archivos al proyecto…', { group: 'Archivo', icon: 'import', run: async () => { const f = await pickFile('.glb,.gltf,.obj,.png,.jpg,.jpeg,.webp,.gif', true); if (f.length) await importFiles(f) } })
  add('file.exportGame', 'Exportar juego (AppImage)…', { group: 'Archivo', icon: 'export', run: () => openExportGame(), disabled: () => !store.project || store.locked })
  add('game.settings', 'Ajustes del juego…', { group: 'Juego', icon: 'sliders', run: () => openGameSettings(), disabled: () => !store.project || store.locked })
  // OBSOLETO y oculto: Century ya no trabaja con Godot (su juego se exporta con «Exportar juego»). El código se conserva.
  add('file.export', 'Exportar a Godot (obsoleto)…', { group: 'Archivo', icon: 'export', hidden: true, run: () => (store.modal = 'export') })

  // --- Editar ---
  add('edit.undo', 'Deshacer', { group: 'Editar', icon: 'undo', keys: 'Ctrl Z', run: undo, disabled: () => !store.canUndo })
  add('edit.redo', 'Rehacer', { group: 'Editar', icon: 'redo', keys: 'Ctrl Shift Z', run: redo, disabled: () => !store.canRedo })
  add('edit.copy', 'Copiar nodos', { group: 'Editar', icon: 'copy', keys: 'Ctrl C', run: copySelected, disabled: () => !hasSel() || !!store.editor?.edit })
  add('edit.paste', 'Pegar delante de la cámara', { group: 'Editar', icon: 'copy', keys: 'Ctrl V', run: () => pasteSelected(store.editor?.clipboardPlacePoint()), disabled: () => !canPasteSelected() })
  add('edit.duplicate', 'Duplicar', { group: 'Editar', icon: 'copy', keys: 'Ctrl D', run: duplicateSelected, disabled: () => !hasSel() })
  add('edit.linkedDuplicate', 'Duplicar malla vinculada', { group: 'Editar', icon: 'copy', keys: 'Alt D', run: linkedDuplicateSelected, disabled: () => !hasSel() || !!store.editor?.edit })
  add('edit.makeMeshIndependent', 'Hacer malla independiente', { group: 'Editar', icon: 'mesh', run: makeMeshIndependent, disabled: () => !store.selectedIds.some((id) => getObject(id)?.props?.meshRef) || !!store.editor?.edit })
  add('edit.group', 'Agrupar selección', { group: 'Editar', icon: 'group', keys: 'Ctrl G', run: groupSelected, disabled: () => !hasSel() })
  add('edit.ungroup', 'Desagrupar', { group: 'Editar', icon: 'group', keys: 'Ctrl Shift G', run: () => ungroup(store.selectedId), disabled: () => !isGroupSel() })
  add('edit.delete', 'Eliminar', { group: 'Editar', icon: 'trash', keys: 'Supr', run: removeSelected, disabled: () => !hasSel() && !store.terrainSel })
  add('edit.rename', 'Renombrar', { group: 'Editar', keys: 'F2', run: () => { store.prefs.leftOpen = true; store.renameId = store.selectedId }, disabled: () => !store.selectedId })
  add('edit.selectAll', 'Seleccionar todo', { group: 'Editar', keys: 'Ctrl A', run: () => selectObject(null, { range: store.project.objects.map((o) => o.id) }) })
  add('edit.focus', 'Enfocar selección', { group: 'Editar', icon: 'frame', keys: 'F', run: () => store.editor.focus() })
  add('camera.toSelected', 'Mover cámara al nodo seleccionado', { group: 'Ver', icon: 'camera', run: () => store.editor.moveViewToSelected(), disabled: () => !hasSel() })
  add('camera.alignSelected', 'Alinear nodo con la vista', { group: 'Ver', icon: 'camera', run: () => store.editor.alignSelectedToView(), disabled: () => store.selectedIds.length !== 1 })
  add('camera.alignSpawn', 'Colocar Spawn desde la vista', { group: 'Ver', icon: 'spawn', run: () => store.editor.alignSpawnToView(), disabled: () => getObject(store.selectedId)?.type !== 'spawn' })
  add('camera.pilot', 'Pilotar cámara seleccionada', { group: 'Ver', icon: 'camera', run: () => store.editor.startCameraPilot(), disabled: () => getObject(store.selectedId)?.type !== 'camera', checked: () => !!store.editor?._cameraPilot })
  add('camera.stopPilot', 'Dejar de pilotar cámara', { group: 'Ver', icon: 'camera', run: () => store.editor.stopCameraPilot(), disabled: () => !store.editor?._cameraPilot })
  add('camera.orbitSelection', 'Orbitar alrededor de selección', { group: 'Ver', icon: 'frame', run: () => (store.prefs.orbitSelection = store.prefs.orbitSelection === false), checked: () => store.prefs.orbitSelection !== false })
  add('edit.parent', 'Emparentar selección al activo', { group: 'Editar', icon: 'group', keys: 'Ctrl P', run: parentSelectionToActive, disabled: () => store.selectedIds.length < 2 })
  add('edit.unparent', 'Sacar del padre (subir un nivel)', { group: 'Editar', icon: 'group', keys: 'Alt P', run: () => unparentSelection(1), disabled: () => !hasSel() })
  add('edit.toRoot', 'Mover a la raíz de la escena', { group: 'Editar', run: () => unparentSelection(Infinity), disabled: () => !hasSel() })
  add('edit.join', 'Unir mallas seleccionadas', { group: 'Editar', icon: 'merge', keys: 'Ctrl J', run: joinSelectedMeshes, disabled: () => store.selectedIds.length < 2 })
  add('add.menu', 'Añadir objeto…', { group: 'Añadir', icon: 'plus', keys: 'Shift A', run: (pos) => openAddMenu(pos) })
  add('scene.instantiate', 'Instanciar escena existente…', {
    group: 'Añadir', icon: 'scene', keys: 'Ctrl Shift A',
    disabled: () => !store.project || store.locked || store.play.on || store.filmMode ||
      store.gameView.on || !!store.editor?.edit || !!store.modal || store.palette || !!store.addModal,
    run: () => openSceneInstancePicker(),
  })

  // --- Herramientas ---
  add('tool.select', 'Seleccionar', { group: 'Herramientas', icon: 'select', keys: 'Q', run: () => setGizmo('none'), checked: () => store.tool === 'select' && store.gizmo === 'none' })
  add('tool.move', 'Mover', { group: 'Herramientas', icon: 'move', keys: 'W', run: () => setGizmo('translate'), checked: () => store.tool === 'select' && store.gizmo === 'translate' })
  add('tool.rotate', 'Rotar', { group: 'Herramientas', icon: 'rotate', keys: 'E', run: () => setGizmo('rotate'), checked: () => store.tool === 'select' && store.gizmo === 'rotate' })
  add('tool.universal', 'Universal (mover + rotar + escalar)', { group: 'Herramientas', icon: 'universal', keys: 'Y', run: () => setGizmo('universal'), checked: () => store.tool === 'select' && store.gizmo === 'universal' })
  add('tool.scale', 'Escalar', { group: 'Herramientas', icon: 'scale', keys: 'R', run: () => setGizmo('scale'), checked: () => store.tool === 'select' && store.gizmo === 'scale' })
  add('tool.road', 'Dibujar carretera', { group: 'Herramientas', icon: 'road', keys: 'U', run: () => (store.tool = store.tool === 'road' ? 'select' : 'road'), checked: () => store.tool === 'road' })
  add('tool.terrain', 'Pincel de terreno', { group: 'Herramientas', icon: 'terrain', keys: 'B', run: () => (store.tool = 'terrain'), checked: () => store.tool === 'terrain' })
  for (const [id, label] of [['raise', 'Elevar'], ['lower', 'Bajar'], ['smooth', 'Suavizar'], ['flatten', 'Aplanar'], ['noise', 'Rugosidad'], ['paint', 'Pintar capa'], ['ramp', 'Rampa / pendiente']]) {
    add(`brush.${id}`, `Pincel: ${label}`, { group: 'Terreno', icon: id, run: () => brush(id) })
  }
  add('terrain.panel', 'Seleccionar terreno en Inspector', { group: 'Terreno', icon: 'terrain', disabled: () => !terrainOn(), run: () => { selectTerrain(); store.prefs.rightOpen = true } })

  // --- Añadir (derivado del registro de tipos de nodo) ---
  for (const def of allDefs()) {
    if (def.creatable === false) continue
    if (def.kinds) {
      for (const [kind, k] of Object.entries(def.kinds)) {
        add(`add.${def.type}.${kind}`, `Añadir ${k.label.toLowerCase()}`, { group: 'Añadir', icon: k.icon, category: def.type === 'mesh' ? 'Herramientas de modelado' : def.category, run: () => def.type === 'collisionshape3d' ? addShapeToBody(kind) : def.type === 'terrain' ? (terrainOn() ? addTerrainPiece() : addTerrain()) : startPlace(def.type, kind) })
      }
    } else if (def.type === 'group') {
      add('add.group', 'Añadir grupo', { group: 'Añadir', icon: def.icon, category: def.type === 'mesh' ? 'Herramientas de modelado' : def.category, run: () => addGroupHere() })
    } else if (def.type !== 'model') {
      add(`add.${def.type}`, `Añadir ${def.label.toLowerCase()}`, { group: 'Añadir', icon: def.icon, category: def.type === 'mesh' ? 'Herramientas de modelado' : def.category, run: () => def.type === 'terrain' ? (terrainOn() ? addTerrainPiece() : addTerrain()) : startPlace(def.type, def.type) })
    }
  }


  // --- Juego ---
  add('play.start', 'Jugar / detener', { group: 'Juego', icon: 'play', keys: 'F5', run: () => store.editor.player.toggle(), checked: () => store.play.on, disabled: () => !store.project || store.locked })
  add('play.pause', 'Pausar / reanudar', { group: 'Juego', icon: 'pause', run: () => store.editor.player.pause(), checked: () => store.play.paused, disabled: () => !store.play.on })
  add('play.step', 'Avanzar un fotograma', { group: 'Juego', icon: 'step', run: () => store.editor.player.step(), disabled: () => !store.play.on })
  add('play.here', 'Jugar desde la cámara', { group: 'Juego', icon: 'play', keys: 'Shift F5', run: () => store.editor.player.start({ here: true }), disabled: () => !store.project || store.locked || store.play.on })
  add('game.event', 'Editar evento seleccionado…', { group: 'Juego', icon: 'event', keys: 'Intro', run: () => openEventEditor(store.selectedId), disabled: () => getObject(store.selectedId)?.type !== 'event' })
  add('game.taglayers', 'Groups y Layers del proyecto…', { group: 'Juego', icon: 'layers', run: () => openTagLayers() })
  add('game.loc', 'Localización (idiomas, textos y voces)…', { group: 'Juego', icon: 'globe', run: () => openLocalization(), disabled: () => !store.project })
  add('game.db', 'Base de datos (interruptores y variables)…', { group: 'Juego', icon: 'database', run: () => openDatabase() })
  add('game.timeline', 'Timeline (cinemáticas)…', { group: 'Juego', icon: 'play', run: () => openTimelineEditor() })
  add('game.capture', 'Importar captura de movimiento (.lfcap)…', { group: 'Juego', icon: 'play', run: () => openCaptureImport() })
  add('game.theme', 'Tema de interfaz (fuente, colores, ventanas)…', { group: 'Juego', icon: 'ui', run: () => openThemeEditor() })
  add('game.ui', 'Roles de interfaz (obsoleto)…', { group: 'Juego', icon: 'ui', run: () => openUiSlots() })
  add('game.uidoc', 'Nuevo recurso .ui', { group: 'Juego', icon: 'ui', run: () => { const d = createUi(); openUiEditor(d.id) } })
  add('game.shader', 'Nuevo shader…', { group: 'Juego', icon: 'shader', run: () => { const s = createShader(); openShaderEditor(s.id) } })
  add('game.shaderGraph', 'Nuevo Shader Graph…', { group: 'Juego', icon: 'shader', run: () => { const s = createShaderGraph(); openShaderEditor(s.id) } })
  add('game.code', 'Editor de código…', { group: 'Juego', icon: 'script', run: () => openScriptEditor(), disabled: () => !store.project || store.locked })
  add('game.vscode', 'Abrir proyecto en VS Code', { group: 'Juego', icon: 'script', run: () => openInVSCode(), disabled: () => !store.project || store.locked })
  add('game.script', 'Nuevo Script de Nodo…', { group: 'Juego', icon: 'script', run: () => {
    const s = createScript('Assets/Scripts', 'node.js', 'node')
    store.prefs.bottomOpen = true
    store.prefs.bottomTab = 'project'
    store.projFolder = s.folder
    store.scriptRenameId = s.id
  } })

  // --- Ver ---
  add('view.grid', 'Rejilla', { group: 'Ver', icon: 'grid', run: () => (store.view.grid = !store.view.grid), checked: () => store.view.grid })
  add('view.wire', 'Malla (wireframe)', { group: 'Ver', icon: 'wire', run: () => (store.view.wireframe = !store.view.wireframe), checked: () => store.view.wireframe })
  add('view.lights', 'Vista previa de luces', { group: 'Ver', icon: 'light', run: () => (store.view.lights = !store.view.lights), checked: () => store.view.lights })
  add('view.weather', 'Clima animado en el editor (lluvia, viento, hojas)', { group: 'Ver', icon: 'water', run: () => (store.view.weather = store.view.weather === false), checked: () => store.view.weather !== false })
  add('view.fx', 'Efectos de render (PBR)', { group: 'Ver', icon: 'light', run: () => (store.view.fx = !store.view.fx), checked: () => store.view.fx })
  add('view.perf', 'Rendimiento (panel)', { group: 'Ver', icon: 'chart', keys: 'F3', run: () => (store.view.perf = !store.view.perf), checked: () => store.view.perf })
  add('view.mode', 'Modos de diagnóstico del viewport (Unreal)', { group: 'Ver', icon: 'eye', children: VIEW_MODES.map((v) => ({ label: v.label, checked: store.view.mode === v.id, run: () => { store.view.mode = v.id; if (v.id !== 'lit') store.view.wireframe = false } })) })
  add('view.terrain', 'Mostrar terreno', { group: 'Ver', icon: 'terrain', run: () => (store.view.terrain = !store.view.terrain), checked: () => store.view.terrain })
  add('view.snap', 'Snap a cuadrícula', { group: 'Ver', icon: 'magnet', run: () => updateSettings({ moveSnapOn: !(editorSettings().moveSnapOn ?? editorSettings().snap) }), checked: () => store.project && (editorSettings().moveSnapOn ?? editorSettings().snap) })
  add('view.space', 'Gizmo: espacio mundo / local', { group: 'Ver', icon: 'globe', keys: 'X', run: () => (store.space = store.space === 'world' ? 'local' : 'world') })
  add('view.frame', 'Encuadrar todo', { group: 'Ver', icon: 'frame', run: () => store.editor.frameAll() })
  for (const [id, label, keys, icon] of [
    ['persp', 'Perspectiva', 'Num 0', 'persp'], ['top', 'Superior', 'Num 7', 'top'], ['bottom', 'Inferior', 'Ctrl Num 7', 'top'],
    ['front', 'Frontal', 'Num 1', 'front'], ['back', 'Trasera', 'Ctrl Num 1', 'front'],
    ['right', 'Lateral derecha', 'Num 3', 'right'], ['left', 'Lateral izquierda', 'Ctrl Num 3', 'right'],
  ]) add(`view.${id}`, `Vista: ${label}`, { group: 'Ver', icon, keys, run: () => store.editor.vp.setView(id) })
  add('view.ortho', 'Ortográfica / perspectiva', { group: 'Ver', icon: 'persp', keys: 'Num 5', run: () => store.editor.vp.setOrtho(!store.editor.vp.isOrtho), checked: () => store.editor.vp?.isOrtho })
  add('view.flip', 'Vista opuesta', { group: 'Ver', icon: 'frame', keys: 'Num 9', run: () => store.editor.vp.flipView() })
  // Override exclusivamente editorial; el render permanente continúa en Ajustes del juego.
  add('view.renderOptions', 'Render del viewport', { group: 'Ver', icon: 'light', hidden: true, children: [
    { label: `Usar render del proyecto (${RENDERERS.find((r) => r.id === methodOf(store.project?.render))?.name || 'Compatibility'})`, checked: !store.view.renderMethod, run: () => (store.view.renderMethod = '') },
    ...RENDERERS.map((r) => ({ label: r.name, checked: store.view.renderMethod === r.id, run: () => (store.view.renderMethod = r.id) })),
  ] })
  add('nav.mouse', 'Navegación: ratón', { group: 'Ver', icon: 'mouse', run: () => (store.prefs.navigation = 'mouse'), checked: () => store.prefs.navigation === 'mouse' })
  add('nav.trackpad', 'Navegación: trackpad', { group: 'Ver', icon: 'trackpad', run: () => (store.prefs.navigation = 'trackpad'), checked: () => store.prefs.navigation === 'trackpad' })
  add('dock.left', 'Panel de escena', { group: 'Ver', icon: 'panel-left', run: () => (store.prefs.leftOpen = !store.prefs.leftOpen), checked: () => store.prefs.leftOpen })
  add('dock.right', 'Panel de propiedades', { group: 'Ver', icon: 'panel-right', run: () => (store.prefs.rightOpen = !store.prefs.rightOpen), checked: () => store.prefs.rightOpen })
  add('dock.panels', 'Paneles del editor', { group: 'Ver', icon: 'panel-left', hidden: true, children: () => dockMenuItems(store) })
  add('dock.toggle', 'Ocultar / mostrar paneles', { group: 'Ver', keys: 'Shift Tab', run: toggleDocks })
  // Estos dos viven en el menú Ver (la barra superior ya no tiene buscador ni botón de ayuda); la paleta no se lista a sí misma.
  add('view.palette', 'Buscar acción…', { group: 'Ver', icon: 'search', keys: 'Ctrl K', hidden: true, run: () => (store.palette = true) })

  // --- Modo edición de malla (estilo Blender) ---
  const E = () => store.editor
  const inEdit = () => !store.edit.on
  const mop = (name, arg) => () => E().meshOp(name, arg)
  const M = (id, label, o = {}) => add(id, label, { group: 'Malla', disabled: inEdit, ...o })
  add('mesh.edit', 'Entrar / salir del modo edición', { group: 'Malla', icon: 'mesh', keys: 'Tab', run: () => E().toggleEdit() })
  for (const [m, l, k] of [['vertex', 'Vértices', '1'], ['edge', 'Aristas', '2'], ['face', 'Caras', '3']]) {
    M(`mesh.mode.${m}`, `Selección por ${l.toLowerCase()}`, { icon: m, keys: k, run: () => E().setEditMode(m), checked: () => store.edit.on && store.edit.mode === m })
  }
  M('mesh.xray', 'Transparencia (X-ray)', { icon: 'xray', keys: 'Alt Z', run: () => E().meshOp('xray'), checked: () => store.edit.xray })
  M('mesh.proportional', 'Edición proporcional', { icon: 'prop', keys: 'O', run: () => E().meshOp('proportional'), checked: () => store.edit.proportional })
  M('mesh.mirror', 'Simetría en X', { icon: 'mirror', run: () => E().meshOp('mirror'), checked: () => store.edit.mirrorX })
  M('mesh.normals', 'Mostrar normales', { icon: 'normal', run: () => E().meshOp('showNormals'), checked: () => store.edit.showNormals })

  M('mesh.grab', 'Mover', { icon: 'move', keys: 'G', run: mop('grab') })
  M('mesh.rotate', 'Rotar', { icon: 'rotate', keys: 'R', run: mop('rotate') })
  M('mesh.scale', 'Escalar', { icon: 'scale', keys: 'S', run: mop('scale') })
  M('mesh.extrudeSolid', 'Extruir sólido cerrado', { icon: 'extrude', run: mop('extrudeSolid') })
  M('mesh.closeContour', 'Cerrar cadena de vértices', { icon: 'vertex', run: mop('closeContour') })
  M('mesh.extrude', 'Extruir', { icon: 'extrude', keys: 'E', run: mop('extrude') })
  M('mesh.extrudeIndividual', 'Extruir caras individualmente', { icon: 'extrude', run: mop('extrudeIndividual') })
  M('mesh.vertexSlide', 'Deslizar vértices por aristas', { icon: 'move', run: mop('vertexSlide') })
  M('mesh.edgeSlide', 'Deslizar cadena de aristas', { icon: 'move', run: mop('edgeSlide') })
  M('mesh.spin', 'Extrusión por giro (Spin)', { icon: 'rotate', run: mop('spin') })
  M('mesh.shear', 'Cizalla (Shear)', { icon: 'scale', run: mop('shear') })
  M('mesh.inset', 'Inset (hundir caras)', { icon: 'inset', keys: 'I', run: mop('inset') })
  M('mesh.bevel', 'Bisel de aristas', { icon: 'bevel', keys: 'Ctrl B', run: mop('bevel') })
  M('mesh.bevelVertex', 'Bisel de vértices', { icon: 'bevel', keys: 'Ctrl Shift B', run: mop('bevelVertex') })
  M('mesh.loopcut', 'Corte en bucle (Loop Cut)', { icon: 'loopcut', keys: 'Ctrl R', run: mop('loopcut') })
  M('mesh.knife', 'Cuchillo', { icon: 'knife', keys: 'K', run: mop('knife') })
  M('mesh.bridge', 'Puente entre bucles de aristas', { icon: 'bridge', run: mop('bridge') })
  M('mesh.fill', 'Rellenar cara / crear arista', { icon: 'face', keys: 'F', run: mop('fill') })
  M('mesh.subdivide', 'Subdividir', { icon: 'subdivide', run: mop('subdivide') })
  M('mesh.merge.faces', 'Fusionar caras', { icon: 'face', disabled: () => inEdit() || store.edit.mode !== 'face' || store.edit.count?.sf < 2, run: mop('mergeFaces') })
  M('mesh.merge.center', 'Fusionar en el centro', { icon: 'merge', keys: 'M', run: mop('merge', 'center') })
  M('mesh.merge.first', 'Fusionar en el primero', { run: mop('merge', 'first') })
  M('mesh.merge.last', 'Fusionar en el último', { run: mop('merge', 'last') })
  M('mesh.merge.collapse', 'Colapsar aristas / caras', { run: mop('merge', 'collapse') })
  M('mesh.merge.dist', 'Fusionar por distancia', { run: mop('merge', 'dist') })
  M('mesh.cleanup', 'Limpiar geometría', { icon: 'trash', run: mop('cleanup') })
  M('mesh.rip', 'Abrir / rasgar (V)', { icon: 'split', keys: 'V', run: mop('rip') })
  M('mesh.triangulate', 'Triangular caras', { keys: 'Ctrl T', run: mop('triangulate') })
  M('mesh.split', 'Dividir selección (Y)', { icon: 'split', keys: 'Y', run: mop('split') })
  M('mesh.separate', 'Separar en un objeto nuevo', { icon: 'split', keys: 'P', run: mop('separate') })
  M('mesh.duplicate', 'Duplicar geometría', { icon: 'copy', keys: 'Shift D', run: mop('duplicate') })
  M('mesh.delete', 'Eliminar…', { icon: 'trash', keys: 'X', run: () => E().meshOp('deleteMenu') })
  M('mesh.delete.verts', 'Eliminar vértices', { run: mop('delete', 'verts') })
  M('mesh.delete.edges', 'Eliminar aristas', { run: mop('delete', 'edges') })
  M('mesh.delete.faces', 'Eliminar caras', { run: mop('delete', 'faces') })
  M('mesh.delete.onlyfaces', 'Eliminar solo caras', { run: mop('delete', 'onlyfaces') })
  M('mesh.dissolve', 'Disolver', { keys: 'Ctrl X', run: mop('dissolve') })
  M('mesh.flip', 'Invertir normales', { icon: 'flip', keys: 'Alt N', run: mop('flip') })
  M('mesh.recalc', 'Recalcular normales (hacia fuera)', { icon: 'normal', keys: 'Shift N', run: mop('recalc') })
  M('mesh.shrink', 'Encoger / engordar', { keys: 'Alt S', run: mop('shrink') })
  M('mesh.smooth', 'Sombreado suave', { run: mop('smooth') })
  M('mesh.flat', 'Sombreado plano', { run: mop('flat') })
  M('mesh.hide', 'Ocultar selección', { keys: 'H', run: mop('hide') })
  M('mesh.hideOthers', 'Ocultar no seleccionado', { keys: 'Shift H', run: mop('hideOthers') })
  M('mesh.reveal', 'Mostrar todo lo oculto', { keys: 'Alt H', run: mop('reveal') })
  M('mesh.selectAll', 'Seleccionar todo', { keys: 'A', run: mop('selectAll') })
  M('mesh.selectNone', 'Deseleccionar todo', { keys: 'Alt A', run: mop('selectNone') })
  M('mesh.invert', 'Invertir selección', { keys: 'Ctrl I', run: mop('invert') })
  M('mesh.linked', 'Seleccionar enlazado', { keys: 'Ctrl L', run: mop('linked') })
  M('mesh.more', 'Ampliar selección', { keys: 'Ctrl +', run: mop('more') })
  M('mesh.less', 'Reducir selección', { keys: 'Ctrl -', run: mop('less') })
  M('mesh.loopSel', 'Seleccionar bucle de aristas', { keys: 'Alt clic', run: mop('selectLoop') })
  M('mesh.ring', 'Seleccionar anillo de aristas', { keys: 'Ctrl Alt clic', run: mop('selectRing') })

  // --- Ayuda ---
  add('engine.settings', 'Ajustes del motor…', { group: 'Editar', icon: 'sliders', run: openEngineSettings, disabled: () => !store.project || store.locked })
  add('prefs.open', 'Preferencias del editor…', { group: 'Editar', icon: 'sliders', keys: 'Ctrl ,', run: () => (store.modal = 'prefs') })
  add('help.docs', 'Documentación', { group: 'Ayuda', icon: 'help', keys: 'F1', run: () => openDocs('index.md') })
  add('help.tutorial', 'Tutorial: un vertical slice', { group: 'Ayuda', icon: 'help', run: () => openDocs('tutorial/vertical-slice.md') })
  add('help.commands', 'Referencia de comandos de evento', { group: 'Ayuda', icon: 'help', run: () => openDocs('referencia/comandos.md') })
  add('help.api', 'API de scripts (game.*)', { group: 'Ayuda', icon: 'script', run: () => openDocs('referencia/api.md') })
  add('help.ui', 'Interfaces (.ui y Canvas)', { group: 'Ayuda', icon: 'ui', run: () => openDocs('referencia/ui.md') })
  add('help.texts', 'Códigos de texto', { group: 'Ayuda', icon: 'help', run: () => openDocs('referencia/textos.md') })
  add('help.shaders', 'Shaders', { group: 'Ayuda', icon: 'help', run: () => openDocs('referencia/shaders.md') })
  add('help.shortcuts', 'Atajos de teclado', { group: 'Ayuda', icon: 'help', keys: '?', run: () => (store.modal = 'shortcuts') })
  return C
}

/** Grupo vacío: dentro del grupo seleccionado o en la raíz. */
function addGroupHere() {
  const sel = getObject(store.selectedId)
  addObject({ type: 'group', kind: 'group' }, { parentId: sel?.type === 'group' ? sel.id : null, label: 'Añadir grupo' })
}

let cache = null
export function commands() {
  if (!cache) cache = define()
  return cache
}
export const command = (id) => commands().find((c) => c.id === id)
export const run = (id, ...args) => command(id)?.run(...args)

/** Ítems de menú a partir de ids; '-' = separador. */
export function items(ids) {
  return ids.map((id) => {
    if (id === '-') return { sep: true }
    const c = command(id)
    return { ...c, children: typeof c.children === 'function' ? c.children() : c.children, disabled: c.disabled?.(), checked: c.checked?.() }
  })
}

export const MENUS = [
  // 0 Archivo · 1 Editar · 2 Ver · 3 Juego · 4 Ayuda (el orden lo usa MenuBar)
  { label: 'Archivo', ids: ['file.projects', 'file.save', 'file.close', 'file.saveProject', 'file.openProject', '-', 'file.rename', '-', 'file.newScene', 'file.import', '-', 'file.exportGame', '-', 'film.export', 'film.import', 'film.open'] },
  { label: 'Editar', ids: ['edit.undo', 'edit.redo', '-', 'edit.copy', 'edit.paste', 'edit.duplicate', 'edit.linkedDuplicate', 'edit.makeMeshIndependent', 'edit.group', 'edit.ungroup', 'edit.parent', 'edit.unparent', 'edit.toRoot', 'edit.join', 'edit.rename', 'edit.delete', '-', 'edit.selectAll', 'edit.focus', '-', 'engine.settings', 'prefs.open'] },
  { label: 'Ver', ids: ['view.grid', 'view.wire', 'view.lights', 'view.fx', 'view.weather', 'view.perf', 'view.terrain', 'view.snap', '-', 'view.persp', 'view.top', 'view.bottom', 'view.front', 'view.back', 'view.right', 'view.left', 'view.ortho', 'view.flip', 'view.frame', '-', 'view.renderOptions', 'view.mode', '-', 'camera.orbitSelection', 'camera.toSelected', 'camera.alignSelected', 'camera.alignSpawn', 'camera.pilot', 'camera.stopPilot', '-', 'nav.mouse', 'nav.trackpad', '-', 'dock.left', 'dock.right', 'dock.toggle', 'dock.panels', '-', 'view.palette', 'help.shortcuts'] },
  { label: 'Juego', ids: ['play.start', 'play.here', '-', 'game.event', 'game.code', 'game.script', 'game.vscode', 'game.shader', 'game.uidoc', 'game.ui', 'game.db', 'game.loc', 'game.taglayers', '-', 'game.settings'] },
  { label: 'Ayuda', ids: ['help.docs', 'help.tutorial', '-', 'help.commands', 'help.api', 'help.ui', 'help.texts', 'help.shaders', '-', 'help.shortcuts'] },
]

/** Menú «Malla» de la barra superior (solo en modo edición). */
export const MESH_MENU = ['mesh.mode.vertex', 'mesh.mode.edge', 'mesh.mode.face', '-', 'mesh.extrude', 'mesh.extrudeSolid', 'mesh.extrudeIndividual', 'mesh.inset', 'mesh.bevel', 'mesh.bevelVertex', 'mesh.loopcut', 'mesh.knife', 'mesh.bridge', 'mesh.closeContour', 'mesh.fill', 'mesh.subdivide', '-', 'mesh.merge.faces', 'mesh.merge.center', 'mesh.merge.first', 'mesh.merge.last', 'mesh.merge.collapse', 'mesh.merge.dist', 'mesh.split', 'mesh.rip', 'mesh.separate', 'mesh.duplicate', '-', 'mesh.delete.verts', 'mesh.delete.edges', 'mesh.delete.faces', 'mesh.delete.onlyfaces', 'mesh.dissolve', 'mesh.cleanup', '-', 'mesh.flip', 'mesh.recalc', 'mesh.triangulate', 'mesh.smooth', 'mesh.flat', 'mesh.shrink', 'mesh.vertexSlide', 'mesh.edgeSlide', 'mesh.spin', 'mesh.shear', '-', 'mesh.hide', 'mesh.hideOthers', 'mesh.reveal', '-', 'mesh.selectAll', 'mesh.selectNone', 'mesh.invert', 'mesh.linked', 'mesh.more', 'mesh.less', '-', 'mesh.xray', 'mesh.proportional', 'mesh.mirror', 'mesh.normals']

// ---------- Shift+A: menú «Añadir» en el cursor (como Blender) ----------
/** Entradas del menú de Shift+A, derivadas del registro de nodos. `spot` = punto del escenario donde se creará el objeto. */
function shiftAItems(spot) {
  const sel = getObject(store.selectedId)
  const parentId = addTargetParent()
  const target = parentId ? getObject(parentId) : null
  const make = (spec, label) => () => spec.type === 'terrain' ? (terrainOn() ? addTerrainPiece() : addTerrain()) : spec.type === 'collisionshape3d' ? addShapeToBody(spec.kind) : getDef(spec.type)?.base === 'Node'
    ? addObject(spec, { parentId, label })
    : store.editor.addAt(spot, spec, { parentId, label })
  const out = [{ heading: target ? `Añadir dentro de «${target.name}»` : 'Añadir en la raíz de la escena' }]
  const cats = new Map()
  const push = (cat, it) => { if (!cats.has(cat)) cats.set(cat, []); cats.get(cat).push(it) }
  // Filtra únicamente las variantes redundantes de Shift+A; no elimina nodos mesh
  // ni cambia el menú de inserción de geometría mientras Edit Mesh está activo.
  for (const item of shiftANodeCatalog(allDefs())) {
    push(item.category, { label: item.label, icon: item.icon,
      run: make({ type: item.type, kind: item.kind }, `Añadir ${item.label.toLowerCase()}`) })
  }
  const catIcon = { 'Primitivas': 'box', 'Herramientas de modelado': 'mesh', 'Ambiente': 'terrain', 'Naturaleza': 'tree', 'Visuales': 'sprite3d', 'Efectos': 'vfx', 'Iluminación': 'light', 'Gameplay': 'spawn' }
  for (const [cat, list] of cats) {
    if (list.length === 1) out.push(list[0])
    else out.push({ label: cat, icon: catIcon[cat] || list[0].icon, children: list })
  }
  const models = store.project?.models || []
  const mm = models.map((m) => ({ label: m.name, icon: 'model', run: make({ type: 'model', kind: 'model', modelId: m.id }, `Añadir ${m.name}`) }))
  mm.push({ sep: true }, { label: 'Importar archivos…', icon: 'import', run: () => run('file.import') })
  out.push({ label: 'Modelos del proyecto', icon: 'model', children: mm })
  if (sel) {
    out.push({ sep: true }, {
      label: 'Siempre dentro del seleccionado', checked: store.prefs.addAsChild, keep: true,
      run: () => { store.prefs.addAsChild = !store.prefs.addAsChild },
    })
  }
  return out
}

/** Abre el menú Shift+A. Sin coordenadas, usa la última posición del puntero. */
export function openAddMenu(pos) {
  const ed = store.editor
  if (!ed || !store.project) return
  store.menu = null // Añadir y los menús de la barra son mutuamente excluyentes.
  if (store.edit.on) return ed.openEditAddMenu(pos)
  const spot = ed.pickPlacePoint()
  const at = pos || ed.lastClient || { x: win.innerWidth / 2, y: win.innerHeight / 2 }
  const menu = { items: shiftAItems(spot), spot, at: { x: at.x, y: at.y } }
  menu.refresh = () => { menu.items = shiftAItems(spot) }
  store.addModal = menu
}

/** Menú «Añadir», agrupado por categoría del tipo de nodo + modelos del proyecto. */
export function addMenuItems() {
  const out = []
  const cats = []
  for (const c of commands().filter((c) => c.group === 'Añadir')) {
    if (!cats.includes(c.category)) cats.push(c.category)
  }
  cats.forEach((cat, i) => {
    if (i) out.push({ sep: true })
    out.push({ heading: cat })
    for (const c of commands().filter((c) => c.group === 'Añadir' && c.category === cat)) out.push({ ...c })
  })
  const models = store.project?.models || []
  if (models.length) {
    out.push({ sep: true }, { heading: 'Modelos' })
    for (const m of models) out.push({ id: `add.model.${m.id}`, label: m.name, icon: 'model', run: () => placeModel(m.id) })
  }
  return out
}

function moveToGroupMenu() {
  const ids = selectionRoots()
  const projectId = store.project?.id, sceneId = store.project?.activeSceneId
  const allowed = () => !!store.project && !!store.editor && !store.locked && !store.play.on && !store.filmMode && !store.gameView.on && !store.edit.on &&
    store.project.id === projectId && store.project.activeSceneId === sceneId
  const targets = allowed() ? collectionGroupTargets(ids) : []
  const names = new Map()
  for (const target of targets) names.set(target.name, (names.get(target.name) || 0) + 1)
  return {
    label: 'Mover a grupo', icon: 'group', disabled: !targets.length, searchPlaceholder: 'Buscar grupo…',
    children: targets.map(target => {
      const path = pathOf(target.id)
      return { label: names.get(target.name) > 1 ? path : target.name, searchText: path, title: path,
        icon: getDef(target.type)?.icon, run: () => { if (allowed()) moveToCollectionGroup(ids, target.id) } }
    }),
  }
}

/** Menú contextual de un nodo del árbol. */
export function nodeMenu(id) {
  const o = getObject(id)
  const multi = store.selectedIds.length > 1
  const isGroup = o?.type === 'group'
  return [
    { label: 'Enfocar', icon: 'frame', keys: 'F', run: () => store.editor.focus(id) },
    ...(o?.type === 'sceneInstance' ? [{
      label: 'Abrir escena fuente', icon: 'scene', run: () => switchScene(o.props.sceneId),
      disabled: store.play.on || store.filmMode || !store.project.scenes.some(s => s.id === o.props.sceneId),
    }] : []),
    ...(o?.type === 'event' ? [{ label: 'Editar evento…', icon: 'event', keys: 'Intro', run: () => openEventEditor(id) }] : []),
    { label: 'Insertar referencia en VS Code', icon: 'script', run: () => void insertNodeRefInVSCode(id), disabled: multi },
    { label: 'Renombrar', keys: 'F2', run: () => (store.renameId = id), disabled: multi },
    { sep: true },
    { label: 'Añadir hijo…', icon: 'plus', keys: 'Shift A', run: () => { selectObject(id); store.prefs.addAsChild = true; openAddMenu(); store.prefs.addAsChild = false } },
    { label: multi ? 'Agrupar selección' : 'Envolver en grupo', icon: 'group', keys: 'Ctrl G', run: groupSelected },
    { label: 'Emparentar al activo', keys: 'Ctrl P', run: parentSelectionToActive, disabled: !multi },
    moveToGroupMenu(),
    { label: 'Sacar del padre', keys: 'Alt P', run: () => unparentSelection(1), disabled: !o?.parentId },
    { label: 'Desagrupar', keys: 'Ctrl Shift G', run: () => ungroup(id), disabled: !isGroup },
    { sep: true },
    { label: 'Copiar', icon: 'copy', keys: 'Ctrl C', run: copySelected },
    { label: 'Pegar delante de la cámara', icon: 'copy', keys: 'Ctrl V', run: () => pasteSelected(store.editor?.clipboardPlacePoint()), disabled: !canPasteSelected() },
    { label: 'Duplicar', icon: 'copy', keys: 'Ctrl D', run: duplicateSelected },
    { label: 'Duplicar malla vinculada', icon: 'copy', keys: 'Alt D', run: linkedDuplicateSelected },
    { label: 'Hacer malla independiente', icon: 'mesh', run: makeMeshIndependent, disabled: !o?.props?.meshRef },
    { label: 'Crear prefab', icon: 'prefab', run: () => createPrefab(selectionRoots(), 'Assets/Prefabs') },
    ...(o?.prefabId && prefabOf(o.prefabId) ? [
      { label: 'Aplicar cambios al prefab', icon: 'prefab', run: () => applyToPrefab(id) },
      { label: 'Revertir al prefab', run: () => revertInstance(id) },
      { label: 'Desvincular del prefab', run: () => unpackInstance(id) },
    ] : []),
    { label: o?.visible ? 'Ocultar' : 'Mostrar', icon: o?.visible ? 'eye-off' : 'eye', run: () => store.selectedIds.forEach((s) => store.editor && toggleProp(s, 'visible')) },
    { label: o?.locked ? 'Desbloquear' : 'Bloquear', icon: o?.locked ? 'unlock' : 'lock', run: () => store.selectedIds.forEach((s) => toggleProp(s, 'locked')) },
    { sep: true },
    { label: selectionRoots().length > 1 ? `Eliminar ${selectionRoots().length} nodos` : 'Eliminar', icon: 'trash', keys: 'Supr', run: removeSelected, danger: true },
  ]
}

import { updateObject, createPrefab, prefabOf, applyToPrefab, revertInstance, unpackInstance } from './store.js'
function toggleProp(id, key) {
  const o = getObject(id)
  if (o) updateObject(id, { [key]: !o[key] }, { label: key === 'visible' ? 'Visibilidad' : 'Bloqueo' })
}

export function terrainMenu() {
  const piece = store.pieces.find((p) => p.id === store.activePieceId)
  return [
    { label: 'Enfocar', icon: 'frame', keys: 'F', run: () => store.editor.frameAll() },
    { label: 'Renombrar', keys: 'F2', run: () => { if (piece) store.renameId = piece.id } },
    { label: piece?.enabled === false || piece?.visible === false ? 'Mostrar' : 'Ocultar', icon: piece?.enabled === false || piece?.visible === false ? 'eye' : 'eye-off', run: () => { if (piece) setPieceVisible(piece.id, !((piece.enabled !== false) && (piece.visible !== false))) } },
    { sep: true },
    { label: 'Añadir pieza de terreno', icon: 'terrain', run: () => addTerrainPiece() },
    { label: 'Eliminar terreno', icon: 'trash', keys: 'Supr', run: removeTerrain, danger: true },
  ]
}

export { getDef }
