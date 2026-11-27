# QA — Shift temporal en Edit Mode

**Gate:** `LF-EDITOR-EDITMODE-SHIFT-SNAP-CORR-G001`.
**SOURCE_BASELINE:** `LevelForge_EDITOR_EDITMODE_SHIFT_SNAP_CORR_G001_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO, NODE PASS; Electron/build y QA local pendientes.

## Ejecutar en Linux

Desde la raíz del SOURCE_BASELINE extraído (con `package.json`):

```bash
node --test scripts/test-editor-editmode-shift-snap-corr-g001.mjs
node --test scripts/test-editor-editmode-shift-snap-electron-corr-g001.mjs
node --test scripts/test-editor-snap-shift-g001.mjs
node --test scripts/test-editor-continuous-grab-corr-g001.mjs
npm run build
npm run electron
```

Si no hay `node_modules`, ejecutar `npm ci` antes. No usar navegadores externos para QA; el runner reutiliza Electron.

**Esperado:** 12 PASS en EMS Node, una prueba EMS Electron con al menos 11 comprobaciones internas, regresiones históricas PASS y build Editor/Player sin errores.

## QA visual manual

1. Abrir proyecto con malla editable; activar Snap de movimiento, rotación y escala con pasos visibles en Toolbar. En Edit Mode seleccionar vértices, aristas o caras. Con los gizmos mover, rotar y escalar, sostener Shift en mitad del arrastre: el movimiento pasa a libre **sin salto**; al soltar Shift vuelve Snap sin salto.
2. Repetir lo anterior con G/R/S modal; cruzar los bordes con Continuous Grab. Comprobar el valor acumulado y que el cursor no interrumpe el gesto.
3. Desactivar Snap en Toolbar y repetir: Shift no debe activarlo. Activar Ctrl durante G/R/S con Snap desactivado y comprobar el uso temporal; al añadir Shift se libera la cuantización.
4. Verificar `Shift+X/Y/Z` (restricción a plano), `Ctrl+Shift+B` (bisel de vértices), selección con Shift y Ctrl, entrada numérica, Escape, confirmación, Undo/Redo, pérdida de foco.
5. Salir de Edit Mode y verificar que Object Mode conserva su Snap aprobado y que el Player no captura Shift como edición.

**Devolver:** salida del runner Electron y build, vídeo de un gesto G/S o gizmo con Shift presionado y liberado y evidencia de ausencia de salto. Indicar si usa X11 o Wayland.

**No verificado:** fixture gráfica real en este entorno; QA visual local y Windows por separado.
