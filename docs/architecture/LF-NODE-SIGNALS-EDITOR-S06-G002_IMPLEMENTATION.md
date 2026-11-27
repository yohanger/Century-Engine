# LF-NODE-SIGNALS-EDITOR-S06-G002 — Registro de implementación

**Estado:** IMPLEMENTADO / QA LOCAL PENDIENTE. No se declara CERRADO.

## Cambios focales

- `src/core/project.js`: validación no destructiva, campo de escena, compatibilidad de migración, serialización.
- `src/core/state/project.js`: montaje, conmutación, escena nueva, duplicación de escena y proyecto conservan la colección.
- `src/engine/runtime/scene/node-scripts.js`: reconciliación por identidad sobre conexiones S04/S05, limpieza y diagnósticos deduplicados; sin nuevo EventBus.
- `src/engine/runtime/scene/node-lifecycle.js`: invocación al final de la sincronización, después de `_ready`.
- `src/engine/runtime/events/play.js` y `play-nodes.js`: activación/desactivación al iniciar, detener y cambiar de escena.
- `src/core/levelpackage.js`, `levelpackage-import.js` y `exporter.js`: protección explícita para destinos sin conversión segura. `.lfproj` y Player ya serializan los datos completos, sin modificar su empaquetador.
- `scripts/test-node-signals-editor-s06-g002.mjs`, fixture y runner Electron: QA del nuevo contrato.

## Limitaciones verificadas

`npm run build` no inicia (`vite: not found`, faltan `node_modules`); runner Electron requiere Vite y Electron locales. No se atribuye PASS. La interfaz editable, Undo/Redo y remapeos de Prefab se reservan a G003/G004.

La aprobación local de G001 es evidencia declarada por el usuario. No modifica retrospectivamente los resultados de Electron ni de compilación. La corrección histórica NP-29 sigue fuera de alcance.
