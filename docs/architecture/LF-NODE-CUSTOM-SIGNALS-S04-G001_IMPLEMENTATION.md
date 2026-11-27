# LF-NODE-CUSTOM-SIGNALS-S04-G001 — Implementación

**SOURCE_BASELINE:** S03 Group Call completo.  
**Resultado:** implementación focalizada; sin segundo intérprete ni sistema de eventos.

## Archivos de producción

- `src/engine/runtime/scene/node-scripts.js`: señales declaradas y conexiones por instancia, API propietaria y limpieza bidireccional en `_release()`. Valida identidad, vigencia y método publicado en cada entrega.
- `src/engine/runtime/events/play-nodes.js`: `connect` y `disconnect` en el handle general usando el mismo `NodeScriptRuntime` del SceneGraph.
- `src/core/events/game-api.d.ts` y `vscode-extension/media/game-api.d.ts`: firmas alineadas.
- `docs/referencia/api.md`: regenerado desde el tipo canónico, sin edición manual.

## Garantías de diseño

`_enter_tree`, `_ready`, `_process`, `_physics_process`, `_exit_tree` y el dispatch optimizado permanecen invariantes. La evaluación del recurso script sigue siendo una por instancia. Los receptores exponen explícitamente sus métodos con `node.expose`; ninguna variable privada del cierre se extrae o copia. La desconexión en ambos extremos elimina referencias retenidas en el registro de señales. Los receptores eliminados durante una emisión no son invocados.

## Pruebas

19/19 nuevas Node PASS. Suite focal S01/S02/S03/S04, S05 histórico, Groups, Lifecycle y Scene Fade: 163/163 PASS. `node scripts/gen-docs.mjs --check`: PASS. Electron preflight no pasa por ausencia de Vite; compilación no ejecutada por `vite: not found`; no se afirma resultado funcional de WebGL/Player sin evidencia.
