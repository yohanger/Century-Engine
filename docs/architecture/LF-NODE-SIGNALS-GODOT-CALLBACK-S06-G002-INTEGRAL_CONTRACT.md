# LF-NODE-SIGNALS-GODOT-CALLBACK-S06-G002-INTEGRAL — Contrato de ejecución

Se autoriza por el usuario como **Gate integral** que sustituye la separación prevista G002-TX + G003-UI. Vinculante: `LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001_AMENDMENT.md` ratificado por el usuario.

**Objetivo:** conectar una señal de un emisor concreto a un método nuevo del Script de Nodo receptor, conservando la operación manual anterior, a partir de un único clic de confirmación.

**Mecanismo:** comprobación de emisor/señal/nodo/script/texto/método, publicación JavaScript con API `node.expose` existente, conexión validada sin cambiar esquema, único commit de escena con delta reversible del script, vista previa y apertura del editor original. No se autoriza otro historial, nuevo editor, script de creación implícita, bus, gestor, refactor masivo ni nuevas funciones de runtime.

**Prerrequisitos:** proyecto sin bloqueo, Editor en Edit Mode, receptor y recurso Node Script asociados, contenido inalterado desde selección, nombres y firmas compatibles, sin archivo de VS Code concurrente y sin CodeMirror abierto sobre el mismo recurso. Los casos de carpeta sincronizada y cambios externos se **bloquean** de forma segura por la ausencia de CAS atómico de disco.

**Alcance de producción:** `src/core/state/{history,project}.js`, `src/core/editor/keys.js`, `src/engine/runtime/scene/node-scripts.js`, `src/components/SignalConnectionsPanel.vue`. Pruebas y fixtures existentes/nuevas, documentación y ledger en seis hojas. `NodeScriptRuntime` conserva despacho y métodos, Editor y Player conservan exportación.

**Evidencia:** 18 tests Node nuevos y regresiones; fixture real Electron diseñada para Vue/WebGL2/Jolt, build Editor/Player y QA visual local requeridos. No confundir test Node con QA de integración. **Estado:** implementación disponible condicionalmente, Electron/compilación NO VERIFICADOS en el entorno de preparación.
