# Evidencia local comunicada por el usuario (baseline S04-G001)

- `undo-context-and-mouse-sensitivity`: 12 PASS, 0 FAIL, duración 192.001219 ms.
- `editor-mouse-sensitivity-config`: 1 PASS, 0 FAIL, duración 150.284857 ms.
- `undo-context-and-mouse-sensitivity-electron`: 0 PASS, 1 FAIL; 20.500 s de suite.
- Fallo: `Tecla nativa 0: ... Error: Ctrl+Z conserva contexto` en `window.__lfNativeKeyAfter`. Electron terminó con exitCode 0 y Vite v6.4.4 inició. La assertion combinada no identificaba la condición individual.
- El registro no acredita el resultado del Gate correctivo. Se conserva la aprobación pendiente del Gate original.
