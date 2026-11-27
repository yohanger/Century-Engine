# LF-NODE-SIGNALS-GODOT-METHOD-PICKER-S05-G001 — Implementación y trazabilidad

**Producción modificada:** `src/engine/runtime/scene/node-scripts.js` (`literalExposeCalls`, `discoverNodeMethods`) y `src/components/SignalConnectionsPanel.vue` (`receiverMethods`, `validReceiverMethods`, `chooseMethod`, `manualMethod`, selector en diálogo); no se alteraron los métodos públicos del runtime.

**Contraste contra SOURCE_BASELINE S04-G002:** únicamente los dos archivos de producción anteriores; actualización puntual del test histórico `scripts/test-node-signals-godot-ux-s04-g001.mjs` para sustituir su expectativa textual de estado de método por la actual. **Nuevos:** suite `scripts/test-node-signals-godot-method-picker-s05-g001.mjs`, runner `scripts/test-node-signals-godot-method-picker-electron-s05-g001.mjs`, fixture `scripts/fixtures/nodes/node-signals-godot-method-picker-s05-g001.html`, documentos contrato/implementación/QA. Ledger afectado: `docs/qa/LevelForge_DB_Ledger.xlsx`.

**Contratos preservados:** catálogo de señales por emisor, árbol receptor `subtree/scene`, conexión histórica, `node.expose` runtime, `signalConnections` cuatro campos de autoría más ID interno, Undo/Redo, scripts originales y export. Descubrimiento únicamente al consultar código de recursos, no ejecuta JavaScript de usuario.

**Limitaciones:** un método detectado no prueba que exista en Play: en JS puede depender de condiciones o de que el segundo argumento sea callable. No hay inferencia completa de AST ni generación de callback. Métodos dinámicos se introducen por la vía manual. Los métodos duplicados/reservados se muestran deshabilitados; no se borran vínculos históricos.

**Estado previo a QA local:** 25 pruebas nuevas Node PASS; regresión acumulada 392 PASS, 0 FAIL, 1 SKIP compilador Vue ausente. Docs PASS. Runner Electron y build NO VERIFICADOS aquí por falta de Vite. QA local usuario PENDIENTE. Para cierre, deben ejecutarse compilador Vue sin SKIP, runner Electron y builds Editor/Player, además de validación visual del selector y de métodos manuales.
