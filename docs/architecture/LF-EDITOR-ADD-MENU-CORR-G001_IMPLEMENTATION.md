# LF-EDITOR-ADD-MENU-CORR-G001 — Limpieza del menú Shift+A

**2026-10-29 · Gate autorizado, implementado, QA visual y compilación pendientes.**

## Decisión

El menú Shift+A en modo objeto mostraba `Geometría` (Primitivas) y `Malla` (Malla editable) con geometrías duplicadas. Los tipos `mesh` siguen siendo fundamentales para Edit Mesh, instancias vinculadas, persistencia y exportación; **no se eliminan del registro ni de la escena**.

## Implementación

- `src/core/add-menu-catalog.js`: proyección pura de `allDefs()` al menú de **modo objeto**, no un segundo registro. Omite solo las geometrías `mesh` equivalentes a primitivas presentes: `cube`↔`box`, `plane`, `cylinder`, `cone`, `sphere`. La comparación se hace por *kind* (no por texto) y mantiene automáticamente nuevas geometrías de malla que no tengan equivalente.
- `src/core/commands.js`: construye el árbol de Shift+A a partir de la proyección, utilizando las acciones originales `addAt`, `addObject`, `addShapeToBody`, `addTargetParent`, `getDef` y los modelos importados. Cambia la presentación de `Malla editable` a `Herramientas de modelado`, con Vértice, Rejilla, Círculo y Toro.
- `src/core/editor/meshedit.js`, `src/engine/runtime/nodes/mesh.js`, `src/engine/runtime/mesh/generators.js`, editor, Player y formatos de proyectos **sin cambios**.
- `src/components/AddModal.vue` y `add-menu-model.js` intactos: mantienen búsqueda, navegación y posición.

## Compatibilidad y límite

Los proyectos guardados siguen cargando nodos `mesh`. Los menús de Edit Mesh no se han reducido: añaden geometría dentro de la malla activa, a diferencia del modo objeto. Las acciones de la paleta de comandos siguen registradas; este Gate solo limpia **Shift+A**. No hay migración de proyectos ni nuevos recursos.

## QA y evidencia

`node --test scripts/test-editor-add-menu-corr-g001.mjs scripts/test-add-menu.mjs`: **72/72 PASS** (15 nuevas, 15 menú anterior, 26 Vértice y 16 integración de modelado).

Validar adicionalmente en Electron el menú normal y el de Edit Mesh, creación y posición de Vértice con gizmo/Snap, parentado, búsqueda con tildes, cierre, Undo/Redo y guardar/reabrir escenas con nodos `mesh`.

`npm run build`, WebGL y QA visual **no verificados** en este contenedor: no hay dependencias npm instaladas. **Gate no cerrado** hasta aprobación y QA local.
