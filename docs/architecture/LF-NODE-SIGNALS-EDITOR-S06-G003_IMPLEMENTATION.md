# LF-NODE-SIGNALS-EDITOR-S06-G003 — Implementación y comparación

**Baseline de origen:** S06-G002, 1.520 entradas. **Responsabilidad:** interfaz Señales y transacciones editoriales. Fecha: 2026-11-01.

## Producción

- `src/components/InspectorDock.vue`: se incorpora pestaña Señales sin reemplazar Inspector/Terreno.
- `src/components/SignalConnectionsPanel.vue` (nuevo): UI nativas/custom, búsqueda, conexiones, estados y diálogo accesible; se vincula a `store.selectedId` y al estado de escena. No ejecuta scripts.
- `src/core/state/project.js`: tres operaciones exportadas de alta, cambio y baja; validación de colección mediante `validateSignalConnections()` existente, `commit` único.
- `src/core/state/history.js`: serialización y restauración de `signalConnections` en el mismo historial.

## QA reproducido en entorno de entrega

- `node --test scripts/test-node-signals-editor-s06-g003.mjs`: 16/16 PASS.
- Suite seleccionada con G002, S01, S02, S03, S04, S05, S05 histórico y Lifecycle: 167/167 PASS; 0 FAIL, 0 SKIP.
- `node --check` para archivos JS de producción modificados: PASS.
- Runner Electron G003 preparado y ejecutado: bloqueado en preflight por falta de Vite (`node_modules` no incluido); **Electron/UI WebGL NO VERIFICADO**.
- `npm run build` ejecutado: `vite: not found`; **COMPILACIÓN NO VERIFICADA**.
- QA local Editor/Player: **PENDIENTE**, hasta declaración del usuario.

## Integración pendiente G004

El editor aún no remapea en todos los flujos conexiones al copiar/pegar, duplicar o reconstruir Prefabs. Las exportaciones Godot/LevelPackage conservan las restricciones de G002. La nueva UI no cambia esos contratos ni promete compatibilidad.
