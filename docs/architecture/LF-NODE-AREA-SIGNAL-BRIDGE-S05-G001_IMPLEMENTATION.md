# LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001 — Registro de implementación

## Código real intervenido

- `src/engine/runtime/scene/node-scripts.js`: rutas nativas Area3D en `connectSignal`/`disconnectSignal`; fuente física validada en `_nativeArea`; un listener por señal vía `_nativeSignal`; despacho común `_dispatchSignal`; limpieza bilateral en `_disconnectConnection`, `_releaseNative`, `exit` y `clear`; validación de identidad en `_isCurrentConnection`. Rechazo de declaración manual de señales físicas reservadas.
- `src/engine/runtime/physics/node-spatial.js`: aclaración de contrato documental de `onArea`. Sin cambios de física ni filtros.
- `src/core/events/game-api.d.ts` y `vscode-extension/media/game-api.d.ts`: `Area3DSignalEvent` y documentación de las cuatro señales nativas.
- `docs/referencia/api.md`: referencia regenerada con el generador existente.

## Compatibilidad

Permanecen los métodos y entradas de S01–S04, las señales globales y el ciclo de vida optimizado. `Area3D` sin script permite conectarse. La fuente se verifica por instancia original (`area.obj`), el handle y el `NodeSpatialRuntime` vigente. Para finalizar una conexión se utiliza la salida del mismo NodeLifecycle que administra el SceneGraph, sin nuevo sistema de eventos.

## Evidencia y limitaciones

- 18/18 nueva batería S05 PASS.
- 236/236 regresión focal Node PASS; incluye S01–S04, Character/Area y Lifecycle.
- Barrido ampliado: 277 PASS, 1 FAIL histórico `NP-29`, 1 SKIP. `NP-29` falla asimismo sin cambios en el SOURCE_BASELINE S04 por `migrateObjectGroups is not defined`; no se modificó fuera del Gate.
- `node scripts/gen-docs.mjs --check`: PASS.
- Electron: NO VERIFICADO (falta Vite); compilación: NO VERIFICADA (`vite: not found`).
- QA Editor/Player: PENDIENTE de confirmación del usuario.

No se declara cierre por una prueba documental ni por el hecho de haber implementado el puente.
