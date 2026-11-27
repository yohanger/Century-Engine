# LF-TERRAIN-INSPECTOR-CONTEXT-S04A-G001-INTEGRAL — Contrato

- **Autorización literal recibida:** `Listo. LF-TERRAIN-INSPECTOR-CONTEXT-S04A-G001-INTEGRAL autoriza comenzar`.
- **SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_INTEGRATION_S07_G001_SOURCE_BASELINE.zip` (1.635 entradas; base acumulada).
- **Objetivo:** las propiedades existentes de cada pieza Terrain deben ser contextuales al nodo de escena seleccionado. No se implementa un segundo terreno, un segundo Inspector, ni una segunda fuente de identidad.
- **Contrato anterior relevante:** LF-TERRAIN-NODE-S01-G001_CORR-001, LF-TERRAIN-TRANSFORM-S02-G001, LF-TERRAIN-EXTENTS-S03-G001. El uso de `rightTab='terrain'` en S01 es **supersedido solo como navegación visual**, no como contrato de alturas, geometría, límites o selección de pieza física.

## Autoridad y mecanismo

- `store.project.objects`: identidad de escena y `scriptIds[]` de cada nodo `terrain`, con ID idéntico a la pieza física.
- `store.editor.terrains`: geometría, alturas, pintura, vegetación y desplazamientos reales. `store.editor.terrain` sigue siendo la pieza activa del editor.
- `store.selectedId` y `store.selectedIds`: selección única de nodo, también para Terrain; `terrainSel` se conserva por compatibilidad para herramientas y gizmo, pero se **deriva de la selección de nodo**; no proporciona otra identidad.
- `selectPiece()` mantiene `editor.setActivePiece()` y `syncPieces()` antes de abrir Inspector de nodo; `selectTerrain()` selecciona `editor.terrain.id` si existe un nodo correspondiente.
- La selección Terrain desengancha el gizmo ordinario mediante `setSelection(null,[])` y activa el gizmo físico especializado. El propio `_syncTerrainGizmo()` reconstituye la coherencia al restaurar Undo/Redo, que reescribe `selectedId` directamente.
- `TerrainPanel.vue` se reutiliza una sola vez dentro del `Inspector.vue` para `obj.type==='terrain'`; preserva funciones y fuentes actuales. `InspectorDock.vue` deja de ofrecer la pestaña paralela y normaliza preferencias antiguas.
- El nombre y la visibilidad de Terrain se editan con `renamePiece()` y `setPieceVisible()`, no mediante `updateObject()` sobre el espejo de la escena. El transform genérico no aparece porque la clase Terrain tiene `base:'Node'`. La posición X/Y/Z y extensión de bordes continúan siendo las herramientas de `TerrainPanel.vue`.
- Los ajustes de escena/hidrología siguen apuntando a `project.environment.waterSimulation` y no se copian en nodos individuales.

## Compatibilidad y límites

- Escena con 0 piezas: no hay nodo fantasma ni selección Terrain. Añadir Terrain permanece en Shift+A y acciones de creación existentes.
- Escenas con múltiples piezas: una sola selección de nodo por pieza activa, sin duplicar mallas.
- `rightTab='terrain'` en preferencias persistidas migra en tiempo de interfaz a `rightTab='object'`, sin tocar escenas ni proyectos.
- La herramienta B/pincel abre Inspector si existe un terreno real, pero no genera piezas implícitamente.
- Guardado y Undo/Redo preservan la autoridad del runtime de terreno. Play/Stop restituye selección y gizmo; formato antiguo sin `selectedId` Terrain se normaliza con el ID de pieza activa existente.
- Se excluyen cambios de física, Jolt, hidrología, geometría, pintura, materiales, export, `frameAll()`, Edit Mesh y limpieza de Consola.
- Las herramientas existentes pueden tener defectos previos no relacionados; esta integración no los declara corregidos.

## Rutas de producción intervenidas

`src/components/InspectorDock.vue`, `src/components/Inspector.vue`, `src/core/state/terrain.js`, `src/core/state/objects.js`, `src/App.vue`, `src/core/commands.js`, `src/core/editor/play-session.js`, `src/core/editor/gizmo.js`.

La intervención en `core/editor/gizmo.js` responde a una incompatibilidad causal auditada: `history.applyEntry()` restaura la selección directamente y después invoca `editor.setSelection()`, por lo que el gizmo debe reconciliar `terrainSel` y `_activeId` con el nodo restaurado; no se modifica `history.js` fuera del alcance.
