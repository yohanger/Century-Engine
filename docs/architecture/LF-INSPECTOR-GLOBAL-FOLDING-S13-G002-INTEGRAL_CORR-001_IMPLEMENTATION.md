# S13-G002 CORR-001 · Montaje real de QA del plegado del Inspector

**Gate autorizado:** `LF-INSPECTOR-GLOBAL-FOLDING-S13-G002-INTEGRAL_CORR-001` · 2026-11-08.
**SOURCE_BASELINE obligatorio:** `LF_INSPECTOR_GLOBAL_FOLDING_S13_G002_INTEGRAL_SOURCE_BASELINE.zip` (2.672 archivos).
**Estado:** IMPLEMENTADO · Node PASS · Electron/build NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Hallazgo de auditoría

**OBSERVADO (log del usuario):** Node focal S13-G002 41 PASS. Electron llegó a la comprobación 11, `Existe botón original de Restablecer`, con 11 checks PASS y WebGL disponible. Al invocar `reset.click()`, `resetTransform()` llamó `updateObject()` y este exigió `store.editor.syncObject(id)`, pero `store.editor` era `null`.

**CAUSA RAÍZ en la fixture:** el montaje de `scripts/fixtures/editor/inspector-global-folding-s13-g002.html` crea y selecciona un proyecto, pero no registra el Editor ni inicializa el historial antes de probar Restablecer. El Editor normal sí proporciona esas dependencias; `src/core/state/history.js` además necesita `store.editor.snapshotTerrain()` al hacer `commit()`.

## Mecanismo de CORR-001

Solo se cambia la fixture original. Se importa `setEditor` y `resetHistory` de `src/core/store.js`; tras preparar proyecto y selección y **antes** de montar `InspectorDock`, se ejecuta `setEditor({syncObject(id), snapshotTerrain:()=>project.terrain})` y `resetHistory()`. La implementación del Editor real, el modelo de proyecto, la operación Restablecer y el historial de producción permanecen intactos.

La comprobación existente de Restablecer ahora exige simultáneamente: posición del cubo [0,0,0], llamada de sincronización para el ID del cubo y habilitación de Undo. Se conserva el conteo original de **23 comprobaciones Electron**, sin eludir errores o modificar el runner general. Se crea una regresión Node con siete pruebas (incluye ejecución del colector con 23 PASS, 22 PASS y un fallo explícito).

## Límites

No se cambian `Inspector.vue`, `InspectorDock.vue`, `objects.js`, `history.js`, `store.js`, escena, Player, Timeline, Audio, Assets ni tooltips. La corrección es del harness/fixture de Electron, no una corrección demostrada del producto. Los fallos antiguos ajenos al Gate quedan en su evidencia previa, no se reetiquetan.

## Integración y cierre

Conservar 41 PASS heredados. Ejecutar la nueva suite focal (48 PASS), regresión compatible (151 PASS), Electron real (1 PASS con 23 checks), `npm run build` (Editor y Player) y QA visual/funcional por usuario. Sin esos resultados, no declarar Electron/build PASS ni Gate cerrado. El siguiente Gate propuesto S13-G003 (limpieza de nodos) **no queda autorizado** por este documento.
