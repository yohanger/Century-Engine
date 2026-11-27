# LF-NODE-SIGNALS-GODOT-CALLBACK-S06-G002-INTEGRAL — QA

**Estado:** IMPLEMENTADO / TEST NODE PASS / COMPILACIÓN NO VERIFICADA / ELECTRON NO VERIFICADO / QA LOCAL PENDIENTE / NO APROBADO.

## Verificación Node

`node --test scripts/test-node-signals-godot-callback-s06-g002-integral.mjs` — **18 PASS / 0 FAIL / 0 SKIP**. También se adaptaron dos aserciones textuales históricas de S04/S05 que prohibían generación de callbacks por el contrato anterior, ahora sustituido por el Amendment aprobado, sin alterar sus validaciones de señales ni del runtime.

`node --test <todas las suites test-node-signals-*.mjs y test-node-multiscript-*.mjs, excluyendo runners electron>` — **334 PASS / 0 FAIL / 1 SKIP** (el SKIP corresponde a `@vue/compiler-sfc` no instalado en este entorno). Las suites Node no verifican render real ni integración de Electron.

`node scripts/gen-docs.mjs --check`: PASS. `node --check`: sintaxis JS comprobada. `node --test scripts/test-node-signals-godot-callback-electron-s06-g002-integral.mjs`: FALLA en preflight por falta de Vite (sin ejecutar fixture). `npm run build`: NO VERIFICADO (`vite: not found`). No se interpretan estas limitaciones como errores funcionales demostrados del Gate ni como PASS.

## Pruebas locales exigidas

1. `npm ci` en un directorio nuevo extraído del SOURCE_BASELINE.
2. Suite Node nueva, regresiones S04/S05, compilador Vue, documentación, build Editor/Player y runner Electron.
3. Receptor con Script de Nodo: elegir señal, receptor y script de destino, revisar vista previa, generar, abrir editor y comprobar publicación + conexión.
4. Cerrar el editor de scripts; Undo revierte código/conexión, Redo restaura ambos. Editar el código antes de Undo debe bloquearlo sin perder modificaciones.
5. Receptor Multiscript: exigir selección explícita. Sin script, métodos repetidos, reservados, código inválido, cambio de script entre vista previa y confirmación: no crear nada.
6. Proyecto vinculado a carpeta o sincronización externa activa: botón deshabilitado con explicación; no sobrescribir VS Code. Mantener entrada manual y método existente.
7. Custom Signal sin firma: generación sin parámetros inventados. Para nativa, respetar la firma real.
8. Play/Stop: el método generado debe registrarse realmente y recibir la señal. Guardar/reabrir el proyecto y probar exportación Player; probar escenas previas y prefabs.

**Evidencia a devolver:** salida Node, Electron y build; captura del diálogo; prueba de Undo/Redo; ejecución de Play, y cualquier error con reproducción. **No cerrar sin QA LOCAL PASS y aprobación explícita del usuario.**

## Adenda 2026-11-02 — QA del usuario

El usuario comunicó **«Aprobado parcialmente»**. Aportó incidencias en **Edit Mesh**, específicamente `this._cancelPaintStroke is not a function`, `snapModalValue is not defined` y `setPointerCapture: InvalidStateError`, entre otras advertencias. Exigió aplazarlas hasta el saneamiento final, sin contaminar Signals ni Terreno. Esas trazas no prueban por sí mismas un fallo de Signals.

**Estado S06:** APROBADO PARCIALMENTE, **NO CERRADO**. Se conserva la autoría existente y se exige verificación integral S07 antes de cierre. No se registra QA LOCAL PASS completo para S06.
