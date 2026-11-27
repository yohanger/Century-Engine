# LF-NODE-MULTISCRIPT-S01-G001 — Registro de implementación

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL PENDIENTE · NO CERRADO.

## Cambios originales

1. `src/engine/runtime/scene/node-scripts.js`: agrega resolución de IDs con fallback legado, grupos por nodo con `slots` ordenados y cierres privados por script; métodos y señales públicos por nodo con propietarios, conflictos explícitos, suscripciones/cancelaciones por slot, limpieza en desmontaje, tablas periódicas optimizadas y compatibilidad de `NodeScriptRuntime.instances` por nodo. No se introduce otro runtime ni `core/helpers` genéricos.
2. `src/engine/runtime/scene/node-lifecycle.js`: reutiliza la firma de orden de scripts para identificar cambios de identidad/configuración del nodo durante `sync`. Respeta los registros de callbacks nativos y el orden anterior de SceneGraph.
3. `scripts/test-node-multiscript-s01-g001.mjs` y `scripts/test-node-multiscript-electron-s01-g001.mjs` + fixture Electron: 21 pruebas Node nuevas y runner Electron embebido.

## Evidencia ejecutada

- `node --test` con suite específica y regresiones de Node S05, métodos S02, Custom Signals S04, Area3D S05, Groups S03, Lifecycle y Signals Editor S06-G002/G003/G004: **205 PASS, 0 FAIL, 0 SKIP**.
- `node scripts/gen-docs.mjs --check`: **PASS**; el contrato API pública no cambió.
- `node --check` de los dos módulos de producción: **PASS**.
- `node --test scripts/test-node-multiscript-electron-s01-g001.mjs`: invocado, **NO VERIFICADO** porque no está instalado `node_modules/vite`.
- `npm run build`: invocado, **NO VERIFICADO**, error `sh: 1: vite: not found`.
- QA local Editor/Player: **PENDIENTE**.

## Deuda y siguiente Gate, sin implementarla anticipadamente

`Inspector.vue`, `SceneTree.vue`, creadores de nodos y formatos de escena aún mantienen `scriptId`. Este Gate sólo habilita la lectura runtime de `scriptIds`; **no constituye una función editable y persistida**. G002 tiene pendiente el campo autoritativo, los flujos de asignación/orden/drag and drop, la migración y la navegación de recursos. G003 verifica exportación y compatibilidad del Player/Prefabs/Undo. La auditoría de Signals Godot se realizará obligatoriamente antes de iniciar ese subsistema.
