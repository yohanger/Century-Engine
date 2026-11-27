# LF-NODE-SIGNALS-EDITOR-S06-G003 — Contrato de autoría en Inspector

**Parent vinculante:** LF-NODE-SIGNALS-EDITOR-S06-G001 · **Baseline:** LevelForge_NODE_SIGNALS_EDITOR_S06_G002_SOURCE_BASELINE.zip  
**Autorización:** «Listo. LF-NODE-SIGNALS-EDITOR-S06-G003 autoriza comenzar» (2026-11-01).  
**Estado:** IMPLEMENTADO; pruebas Node PASS; Electron/Editor/Player y build NO VERIFICADOS; QA usuario pendiente.

## Propósito y límites

El mismo `InspectorDock.vue` incorpora la pestaña «Señales»; su único panel especializado (`SignalConnectionsPanel.vue`) lee la selección y el estado de escena, sin registrar un segundo inspector, EventBus o tabla de nodos. Los cambios usan exclusivamente `project.signalConnections`, definido y persistido en G002. Las conexiones de scripts creadas en runtime por `node.connect()` no se guardan automáticamente.

## Autoría

- Seleccionar un único nodo de escena habilita la consulta. Sin selección, selección múltiple o recurso del proyecto se ofrece un estado vacío sin mutar datos.
- Area3D muestra `body_entered`, `body_exited`, `area_entered`, `area_exited`; no requiere Script propio para emitir eventos Jolt. La sección Personalizadas muestra nombres registrados en enlaces del nodo. No se afirma descubrir todas las señales declaradas por scripts.
- Añadir, editar y desconectar son operaciones transaccionales de `src/core/state/project.js`: `addSceneSignalConnection`, `editSceneSignalConnection`, `removeSceneSignalConnection`. Conservar el ID de conexión al editar, rechazar campos inválidos, duplicados y extremos ausentes antes de escribir y marcar un único `commit()` por operación.
- El diálogo permite introducir explícitamente el nombre de señal y el método `node.expose()` (sensible a mayúsculas) y localizar nodos activos por nombre o ID. No genera código, ni ejecuta JS del usuario en Edit Mode, ni afirma que un método declarado dinámicamente existe.
- En Play, Edit Mesh, Paint Mode o Editor bloqueado, las acciones de autoría quedan deshabilitadas. El panel ofrece consulta durante Play sin alterar las conexiones activas.
- El estado «Registrada» significa **dato de escena**, no validación runtime; «Pendiente de validar en Play» corresponde a Custom Signals dinámicas. «Activa en Play» y «Error de activación» proceden únicamente de `NodeScriptRuntime.sceneConnections` / `.sceneConnectionErrors`, si son accesibles desde la sesión activa. La ausencia de evidencia no se presenta como éxito.
- Los campos con nodo receptor inexistente son visibles para diagnóstico si su emisor continúa seleccionado; no se eliminan automáticamente. El remapeo de conexiones cuando desaparece el emisor queda en G004.

## Historial e identidad

`captureEntry()` y `applyEntry()` en `state/history.js` incluyen la colección `signalConnections`. Altas, ediciones y desconexiones pueden deshacerse y rehacerse con el Undo/Redo existente; la identidad de la conexión se conserva en edición y restauraciones. No se añade otro historial. Para los cambios complejos de Prefabs, portapapeles, clonación, eliminación y exportaciones, G004 deberá asegurar las políticas de remapeo o bloqueo antes de declarar soporte integral.

## Pruebas y restricciones

- Suite nueva `scripts/test-node-signals-editor-s06-g003.mjs` (UI-01..16); regresión conjunto G002, S01-S05 y Lifecycle.
- `scripts/test-node-signals-editor-electron-s06-g003.mjs` con `scripts/fixtures/editor/node-signals-editor-s06-g003.html`: monta componente Vue real y verifica entrada, edición, restauración del historial, cambio de selección y presentación de estados, además de WebGL2 de Electron.
- No se introduce dependencias adicionales, runner alterno ni coste periódico por frame. La compilación no equivale a QA visual y no se declarará PASS sin prueba.

**No incluye:** interfaces de conexión entre escenas, descubrimiento ejecutando scripts, persistencia adicional, modificación de Jolt, remapeo de Prefabs o exportación Godot. Estas restricciones permanecen para G004 o futuros contratos específicos.
