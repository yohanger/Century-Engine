# LF-NODE-SCRIPT-S05-G001_CORR-001 — Contrato de recursos Script

**Fecha:** 2026-10-28  
**Autorizado:** sí  
**Entrada:** `LevelForge_DOCS_WEB_G001_SOURCE_BASELINE.zip` (973 archivos)  
**Alcance:** UX y plantillas; no modifica ejecución del motor ni Event Order Flow.

## Separación de operaciones

1. **Crear** pertenece a Assets y al comando de creación. El recurso se incorpora a `project.scripts` con ID propio mediante `createScript`. Assets muestra el recurso y activa el campo de nombre. No abre el editor de código.
2. **Asignar** pertenece al nodo del SceneGraph. El Inspector conserva el selector de Script de Nodo y la opción de quitar asociación. También se admite arrastrar un único recurso desde Assets al Inspector o una fila del Scene Tree. Se establece `scriptId` con `updateObject`, sin duplicar el recurso.
3. **Editar** ocurre solo mediante doble clic en Assets, el icono Script del árbol o el botón **Editar script** del Inspector.

Se conserva el recurso de modo `global` o `node` del Gate S05. Un recurso Global no puede asignarse al campo `scriptId` del nodo. Si se arrastra un recurso diferente, inexistente o más de uno a la vez, no se altera el nodo y se muestra un diagnóstico. El cambio de modo del Script Editor y los scripts ya existentes se mantienen.

## Plantillas iniciales

**Global:** callbacks de `game.on('start')`, `game.on('update')` y `game.on('fixedUpdate')` con cuerpos vacíos.  
**Nodo:** `function _ready()`, `function _process(delta)` y `function _physics_process(delta)` vacíos.

No ejecutar diálogos, `game.define` de ejemplo ni mensajes de consola por defecto. Las demás API y callbacks se conservan disponibles; no se eliminan del runtime.

## Integración mínima

- `src/core/state/database.js`: plantillas, reutilizando `createScript`.
- `src/components/ProjectPanel.vue`: dos entradas de creación (Nodo/Global), campo de renombrado inmediato.
- `src/core/commands.js` + `src/core/state/state.js`: comando abre Assets y emite una solicitud transitoria de renombrado; no abre el Script Editor.
- `src/components/Inspector.vue`: selector/arrastre, agregar/quitar/editar sin creación.
- `src/components/SceneTree.vue`: arrastre directo sobre nodo.
- `src/core/editor/script-drop.js`: un lector compartido del formato DnD existente, sin otro sistema de assets.
- `docs/web-src/*`, `public/docs/content.js`: documentación general sincronizada.

**Invariantes:** no cambiar `scene/node-scripts.js`, `NodeLifecycle`, scripts globales, Game Loop, física, escenas ni `events/`; no crear sistema paralelo de archivos, jerarquía o DnD. No se requiere migración de escenas antiguas.

## QA y salida

Pruebas `CORR-01..11`, regresión de suites disponibles, comparación binaria contra SOURCE_BASELINE y QA local en Electron. Entrega únicamente `CHANGE` y `SOURCE_BASELINE` con ledger de seis hojas. El Gate no se cierra hasta que el usuario apruebe la verificación local.
