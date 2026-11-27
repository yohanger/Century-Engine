# LF-NODE-SCRIPT-METHOD-CALL-S02-G001 — Implementación

**Origen:** SOURCE_BASELINE S01 recibido, ZIP íntegro; no se sobrescriben otros proyectos ni ramas locales.

## Cambio focal sobre producción

1. `src/engine/runtime/scene/node-scripts.js`: se agrega tabla `methods` a cada instancia existente (sin runtime paralelo); `node.expose` en handle propietario; `callPublic` comprueba identidad, vida, script y permisos; limpieza al salir y tras errores; se impide registrar métodos en una instancia anterior tras recreación.
2. `src/engine/runtime/events/play-nodes.js`: se añade `NodeHandle.call(nombre,...args)` y se delega al `NodeScriptRuntime` activo de la jerarquía. Antes se verifica vigencia de S01.
3. `src/engine/runtime/scene/node-lifecycle.js`: al comparar entradas de sync se incluye identidad del registro, incluso con ID, tipo, padre y script iguales. Se repite la política de salida/entrada existente.
4. `src/core/events/game-api.d.ts`: tipos `NodeHandle.call<T>` y `NodeScriptHandle.expose`; se regenera `docs/referencia/api.md` mediante el generador existente.

No se tocó el Game Interpreter, escenas, animación, render, Jolt, Asset Browser, Inspector ni configuración. Persistencia y tipos de proyectos existentes conservados.

## Compatibilidad histórica que debe distinguirse

La prueba `NS-13` en `scripts/test-node-script-s05-g001.mjs` crea una **nueva instancia de objeto JS** con ID `b` durante el borrado de `a` y espera que `b` no haga salida/reentrada. Esa expectativa es contradictoria con la regla S01/S02 que exige no adoptar implícitamente la instancia lógica de un registro reemplazado. La prueba original era 24/24 PASS en el SOURCE_BASELINE S01; ahora resulta 23/24 con NS-13 FAIL. La prueba histórica no se ha alterado y se informa como FAIL de expectativa antigua; la nueva `MC-09` valida el comportamiento aprobado. La prueba debe revisarse en un Gate de mantenimiento o mediante decisión explícita de QA, sin hacer pasar esa regresión por PASS.

## Evidencias y limitaciones

Consultar `docs/qa/LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA.md` y el ledger. Electron/Vite requiere `node_modules`, ausente en el entorno de empaquetado; su fixture/runner se prepara para prueba local, no se declara como ejecutado.
