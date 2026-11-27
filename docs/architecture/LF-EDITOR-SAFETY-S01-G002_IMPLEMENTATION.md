# LF-EDITOR-SAFETY-S01-G002 — Recuperación tras interrupción

Fecha: 2026-10-29. **AUTORIZADO** mediante «Listo. LF-EDITOR-SAFETY-S01-G002 autoriza comenzar». **IMPLEMENTADO**, sin cierre. Fuente: `LevelForge_EDITOR_SAFETY_S01_G001_SOURCE_BASELINE.zip`.

## Evidencia de arquitectura

**OBSERVADO:** G001 separó el autoguardado IndexedDB de `project.lfproj` y creó el checkpoint `confirmed`. Antes de G002 faltaban el marcador de sesión y las copias consumibles; `lockEditor()` abre la bienvenida y no accede al proyecto real. **CAUSA RAÍZ:** no existía un mecanismo persistente de recuperación de cierres abruptos.

## Mecanismo

1. Electron marca la sesión activa en `userData/editor-session.json` con reemplazo atómico; un arranque posterior detecta la sesión que quedó activa. El proceso principal solo marca sesión limpia al salir de forma controlada. Los cierres de renderer registran interrupción. No se almacena ningún proyecto en este archivo.
2. IndexedDB sube de v4 a v5 **sin destruir las tablas** e incorpora `recovery`, máximo **una copia por proyecto**. En cada autoguardado de un proyecto modificado, la escena activa y el índice se persisten antes de capturar en una sola lectura de IndexedDB el proyecto, todas sus escenas y los binarios. La captura nueva sustituye la anterior únicamente después de validar y calcular SHA-256.
3. La copia `recovery` se verifica antes de ofrecer su restauración. Se detectan daño de checksum, versión futura, datos de otro proyecto y formatos incompletos. Los errores se presentan sin eliminar ni reescribir automáticamente el estado existente.
4. En el arranque Electron se comprueban las copias **antes de cualquier apertura automática**. Durante la decisión se bloquea la edición; se muestran nombre, fecha de captura y cantidades verificadas de escenas y recursos modificados respecto de `confirmed`.
5. **Restaurar:** repone proyecto, escenas y assets en una única transacción IndexedDB; marca el checkpoint como pendiente, abre el proyecto y solo entonces consume la copia. Conserva la ruta autorizada al proyecto en disco, pero NO reescribe automáticamente `project.lfproj` ni scripts de VS Code. El usuario confirma después mediante Guardar.
6. **Descartar:** restaura el checkpoint confirmado en IndexedDB y consume la copia solo después del éxito. **Posponer** no consume nada y mantiene el editor bloqueado; permite cerrar en la bienvenida y volver a decidir en el siguiente arranque.
7. Guardar explícitamente o descartar mediante el protocolo G001 consume las copias actuales; una escritura fallida no puede declarar un checkpoint limpio. Las copias de distintos proyectos se mantienen aisladas.

## Límites y seguridad

- Una interrupción puede perder cambios posteriores al último snapshot completado. No existe forma fiable de escribir datos después de un `SIGKILL` o apagón.
- SHA-256 detecta daño accidental; no garantiza integridad frente a alteraciones maliciosas de todos los registros almacenados en el mismo perfil.
- Si IndexedDB está lleno o inaccesible, se muestra error y no se promete recuperación.
- Las copias completas consumen almacenamiento adicional. No se crea historial ilimitado.
- La restauración y el descarte no escriben archivos externos ni sobrescriben scripts de VS Code. En caso de divergencia entre el archivo externo y el checkpoint local, se requiere QA del usuario antes de guardar.
- **PENDIENTE de verificar en Electron real:** instalación, simulación de cierre abrupto, persistencia tras reinicio, interfaz de recuperación, acceso a directorios y sincronización VS Code.
- Quedan fuera carreteras, Filmmaker, VFX runtime y refactors ajenos al Gate.

## Archivos

`electron/recovery-session.cjs` (nuevo), `electron/main.cjs`, `electron/preload.cjs`, `src/core/recovery.js` (nuevo), `src/core/db.js`, `src/core/state/project.js`, `src/core/state/state.js`, `src/core/dialogs.js`, `src/components/AskWindows.vue`, `src/App.vue`, `scripts/test-editor-safety-s01-g002.mjs` y ajuste del harness histórico G001. QA y ledger forman parte de la entrega.

## Estado

IMPLEMENTADO. TEST NODE ejecutado en contenedor; build y QA Electron NO VERIFICADOS. No APROBADO ni CERRADO hasta evaluación posterior del usuario.
