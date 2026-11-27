# LF-NODE-SIGNALS-GODOT-CALLBACK-S06-G002-INTEGRAL — Implementación

**Fecha:** 2026-11-02. **Autorización exacta:** `Listo. LF-NODE-SIGNALS-GODOT-CALLBACK-S06-G002-INTEGRAL autoriza comenzar`.

**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_GODOT_CALLBACK_CONTRACT_S06_G001_SOURCE_BASELINE.zip`. El usuario aprobó S06-G001 y autorizó consolidar los trabajos antes planificados como G002 y G003 en **un solo Gate integral**. El Amendment S06-G001 conserva autoridad. No se anticipa la integración final de todo Signals ni se altera el contrato del runtime.

## Intervención

- `src/engine/runtime/scene/node-scripts.js`: `buildNodeCallbackCode()` genera una publicación mediante el `node.expose` real y un callback de función, sin ejecutar código del usuario. Compila sintaxis del cuerpo con `new Function` y la misma declaración estricta que usa el runner real; no lo invoca. Inserción conservadora al principio, respetando directiva inicial `use strict`, saltos de línea, cuerpo y cierre. Prohíbe nombres reservados, firmas incompatibles y sombreado evidente de `node`. Para señales nativas toma nombres de argumentos del registro; para Custom sin firma verificable no inventa parámetros.
- `src/core/state/project.js`: `createSceneSignalCallback()` valida proyecto en edición, emisor seleccionado, señal pública implementada o Custom detectada sin conflicto, receptor, asociación de recurso de ejecución Nodo, nombre de método, revisiones de contenido y conexiones completas. **Una sola operación síncrona** asigna código y enlace y llama a `commit` una sola vez. No usa `addSceneSignalConnection` más `setScriptCode` en commits separados.
- `src/core/state/history.js`: `commit` admite un **delta del único script afectado**, guardado en la entrada correspondiente. Undo/Redo verifican la preimagen/postimagen exactas antes de mover el índice y devuelven conflicto sin alterar código ni conexiones. No se copia el inventario completo de scripts en las entradas ordinarias. El árbol histórico sigue limitado a 60 entradas.
- `src/components/SignalConnectionsPanel.vue`: panel contextual existente, con acción opcional «Generar método y conectar». Requiere selección explícita del script, muestra el método propuesto y la inserción nueva, y no escribe hasta el clic. Continúa permitiendo método existente y edición manual. Después de confirmar abre `openScriptEditor()` existente; el editor recibe el texto del store.
- `src/core/editor/keys.js`: muestra en toast un conflicto de Undo/Redo de callback sin emitir excepción al controlador de teclado.

## Límites de seguridad

- **VS Code / carpeta:** `callbackGenerationBlockReason()` bloquea la generación cuando el proyecto está vinculado a una carpeta (`projLoc.kind === 'path'`) o la sincronización VS Code está activa. Las APIs disponibles no proporcionan CAS atómico de disco. Esto afecta a proyectos guardados en carpeta: para esos casos la función sigue **NO DISPONIBLE**, debiendo utilizarse conexión a método existente o edición manual. No se simula protección de disco.
- **CodeMirror:** bloquea generación/Undo/Redo cuando el script receptor está abierto en el editor existente; nunca sobrescribe un buffer abierto. Se debe cerrar el editor antes de deshacer la transacción. La confirmación compara contenido exacto antes de escribir; no hay ejecución de scripts de usuario en Edit Mode.
- **Conflictos:** nombres reservados, método ya expuesto, script no válido, declaración dinámica ambigua o cambio de código provocan rechazo antes de modificar datos.
- **Rollback:** si hay conflicto de revisión antes de Undo/Redo se preservan código, conexiones e índice. Se intenta restaurar el estado de escena anterior si un componente de render fallase excepcionalmente durante la aplicación; esta recuperación de errores de editor no sustituye una transacción atómica de disco.
- **Límite de parser:** se utiliza el compilador JavaScript real del runtime para comprobar sintaxis, con inserción conservadora. No se promete compatibilidad automática con todos los patrones JavaScript ni generación bajo edición externa concurrente.
- **Persistencia:** no se añadió campo nuevo al esquema `signalConnections`; el proyecto sigue guardando `scripts[].code` y conexiones mediante sus rutas existentes.

## Estado de evidencia

Las pruebas unitarias del Gate cubren publicación válida y fallos de preflight, Undo/Redo, protección de código, no duplicación y compatibilidad con modo manual. La fixture Electron monta el panel Vue y ejercita la conexión/edición/historial con WebGL2 y Jolt. **En el entorno de preparación no existen las dependencias Vite/Vue**: Electron y compilaciones Editor/Player NO VERIFICADOS; no afirmar PASS de esas capas. QA local y aprobación final pendientes.
