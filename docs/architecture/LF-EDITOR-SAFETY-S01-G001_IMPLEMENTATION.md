# LF-EDITOR-SAFETY-S01-G001 — Cierre seguro de LevelForge

Fecha: 2026-10-29. Gate autorizado exactamente por el usuario. Estado: IMPLEMENTADO; QA local NO VERIFICADO; CERRADO: NO.

## Auditoría

**OBSERVADO (fuente previa):** `electron/main.cjs` ejecutaba `lf:before-close` y cerraba sin condición tras 8 segundos; `electron/preload.cjs` emitía `lf:close-ready` tanto en éxito como en fallo. `saveNow()` guardaba la copia de trabajo IndexedDB y programaba `flushDisk()`, que reescribía `project.lfproj` automáticamente. `App.vue` usaba `beforeunload` para iniciar escrituras sin esperar a que concluyeran.

**CAUSA RAÍZ:** no había autorización semántica de cierre ni separación entre el estado de trabajo y el guardado confirmado. La opción «descartar» no podía restaurar una versión anterior fiable.

## Implementación

1. Electron espera `lf:close-result` del renderer por ventana, valida su `webContents` y solo cierra si el resultado es `close`. `cancel`, error y ausencia de respuesta mantienen la ventana; se eliminó el timeout forzado. Nether Film Maker sigue con su ciclo propio, fuera de este Gate.
2. Preload convierte toda excepción de la aplicación en `cancel` (nunca en cierre exitoso).
3. `askCloseDecision` ofrece **Guardar y salir**, **Salir sin guardar** y **Cancelar** mediante la ventana de preguntas ya existente. Escape, el cierre del diálogo o la cancelación bloquean el cierre.
4. `markDirty()` marca `unsavedChanges`, aumenta `pendingRevision` y conserva el autoguardado de trabajo en IndexedDB; este ya no escribe `project.lfproj` por un temporizador. `persistNow()` pasa a persistir solo la copia de trabajo.
5. `saveAll()` comprueba guardado en IndexedDB, escritura del archivo cuando existe ubicación, cambios concurrentes y confirmación del checkpoint en IndexedDB. Un error o cancelación devuelve `false` y bloquea el cierre.
6. La versión confirmada, almacenada en el object store IndexedDB `confirmed` (migración no destructiva de versión 3 a 4), contiene metadatos, todas las escenas y binarios. En «Salir sin guardar», se espera la cola de guardados, se invalida el autoguardado pendiente y se restaura todo en una transacción. No se manipulan proyectos ajenos.
7. Si se escribió en el disco pero falló la confirmación del checkpoint, se recompone `project.lfproj` desde el último punto confirmado antes de restaurar la copia de trabajo. Sin cambios de disco pendientes, «descartar» no toca el archivo externo.
8. `closeBusy` bloquea interacción durante confirmación o restauración. `beforeunload` en navegador usa advertencia nativa; Electron usa el protocolo IPC.
9. Los flujos de creación/ubicación/recent y las operaciones estructurales de escenas se adaptaron para no convertir el autoguardado en confirmación silenciosa.

## Exclusiones y límites

- **NO implementado:** recuperación de cierres abruptos ni copia de recuperación de un solo uso. Gate siguiente S01-G002.
- La sincronización externa existente de archivos `.js` con VS Code conserva su comportamiento; el checkpoint controla el proyecto canónico y su copia IndexedDB. Hay que verificar durante QA si los archivos espejo y los cambios externos requieren tratamiento adicional antes del cierre final de este Gate.
- El almacenamiento confirmado ocupa espacio adicional (especialmente si existen muchos assets); el fallo por cuota debe impedir el cierre y mostrar un error.
- No se han implementado barreras de guardado para cambiar de proyecto desde otras ventanas: ese flujo debe verificarse aparte para asegurar que no se confunde con cerrar Electron.
- Los primeros puntos confirmados de proyectos heredados sin checkpoint se inicializan desde su estado de trabajo existente; no se puede reconstruir un guardado manual antiguo ausente.
- Sin regeneración del Player, renderer VFX, cambios de carreteras o Filmmaker.

## Inventario y verificación

Fuente de continuidad: `LevelForge_VFX_S03_G001_SOURCE_BASELINE.zip`. Archivos afectados: Electron (main/preload), `App.vue`, `AskWindows.vue`, `StatusBar.vue`, `dialogs.js`, `db.js`, `state.js`, `history.js`, `state/project.js`, harness de pruebas y documentos QA/ledger.

Pruebas: `node --test scripts/test-editor-safety-s01-g001.mjs`; regresión: `node --test scripts/test-editor-safety-s01-g001.mjs scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs`.

Pendiente de usuario: `npm run build`, `npm run electron` y QA de decisiones (cancelar, guardar, descartar), fallos de guardado, recursos/escenas/script, AppImage/Windows cuando aplique.
