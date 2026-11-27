# LF-NODE-SIGNALS-GODOT-METHOD-PICKER-S05-G001 — Contrato técnico

**Fecha:** 2026-11-02. **Autorización exacta:** `Listo. LF-NODE-SIGNALS-GODOT-METHOD-PICKER-S05-G001 autoriza comenzar`.

**SOURCE_BASELINE vinculado:** `LevelForge_NODE_SIGNALS_GODOT_RECEIVER_TREE_S04_G002_SOURCE_BASELINE.zip` (1.614 archivos). S04-G002 aprobado por el usuario («Aprobado. Sigamos»), QA LOCAL PASS declarado; sin logs adicionales de Electron/build suministrados en ese mensaje.

## Objetivo

Permitir seleccionar métodos existentes publicados con `node.expose(name, callback)` en los Scripts de Nodo asociados al receptor seleccionado en el diálogo de Signals. Seguir el flujo contextual estilo Godot sin introducir generación de callbacks, cambios de runtime, nuevos registros ni modificaciones del esquema `signalConnections`.

## Mecanismo autorizado

Extender **el lexer estático que ya implementa** `src/engine/runtime/scene/node-scripts.js` para reconocer nombres literales de llamadas directas a `node.expose()` y asociarlos a `scriptIds[]` (o `scriptId` legado). Descubrir propietario por script, duplicados en el mismo o distintos scripts, nombres reservados y scripts ausentes, sin eval ni ejecución del código en Edit Mode. Un nombre detectado no garantiza callback callable ni ejecución durante Play; las expresiones dinámicas generan diagnóstico, no falsa confirmación.

En **el componente existente** `src/components/SignalConnectionsPanel.vue`, presentar métodos detectados del receptor actual, selección de un nombre con botón accesible y campo existente rellenado; opción manual explícita para métodos dinámicos o no detectables; conservar método histórico aunque falte o haya sido renombrado. Para nueva conexión, al cambiar receptor borrar método escogido previamente. No modificar el emisor, la señal, `receiverId`, los métodos de `add/edit/remove` ni Undo/Redo. No crear callbacks o recursos de script. Sin componentes ni administradores nuevos.

## Prerrequisitos y restricciones

- S04-G002 aprobado usuario. Contratos previos de Signals y Multiscript vigentes.
- `NodeScriptRuntime.expose` sigue siendo autoridad de existencia en Play, no el detector estático.
- No alterar `getNativeSignals`, `NodeLifecycle`, `SceneGraph`, Jolt, el editor de scripts ni export.
- Si se necesitara escribir código de usuario para generar métodos, se requiere Contract Amendment y nuevo Gate; expresamente fuera de alcance.

## QA y cierre

Node (descubrimiento literal/dinámico/duplicados, propietario, cambios de receptor, modo manual, historial y persistencia); compilación Vue real, runner Electron embebido con Vue/WebGL2/Jolt, builds Editor y Player, QA visual del usuario. Distinguir Node PASS de compilación y QA local. Entregar exactamente dos ZIP: CHANGE y SOURCE_BASELINE acumulado, actualizando las seis hojas del ledger. No cerrar hasta evidencia y aprobación del usuario.
