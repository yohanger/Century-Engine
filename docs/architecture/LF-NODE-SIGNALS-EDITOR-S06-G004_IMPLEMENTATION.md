# LF-NODE-SIGNALS-EDITOR-S06-G004 — Implementación y trazabilidad

**Baseline:** S06-G003 acumulado. **Estado:** IMPLEMENTADO; QA LOCAL PASS declarado por usuario; APROBADO funcionalmente; cierre técnico condicionado a evidencia de compilación/Electron automatizado.

## Integración en archivos originales

- `src/core/project.js`: `remapSignalConnections`, validador reutilizado; solo conserva enlaces internos al mapa de identidades.
- `src/core/state/objects.js`: eliminación de enlaces en borrado; mapa compartido para toda selección al duplicar/Alt+D, snapshot de conexiones del portapapeles, pegado con IDs nuevos; rollback en errores de Alt+D.
- `src/core/state/prefabs.js`: captura de enlaces internos, materialización individual, Apply/Revert y preservación diagnosticable de referencias externas cuando cambian hijos.
- `src/core/lfproj.js`: escritura y lectura del campo `signalConnections` en archivos `.prefab`; valor por defecto para Prefabs anteriores.
- `src/core/levelpackage.js` y `src/core/levelpackage-import.js`: payload con señales y validación; remapeo real por escena/Prefab importado, con rechazo explícito de enlaces que no se pueden trasladar.
- `src/core/exporter.js`: protección anticipada de exportación multiescena Godot, sin conversión falsa.
- `scripts/test-node-signals-editor-s06-g002.mjs`: expectativa de QA histórica PERSIST-18 actualizada para el soporte de `.levelpackage` autorizado por G004 (no se retiró cobertura).
- Nuevas pruebas Node G004, runner Electron y fixture integrado de Jolt WASM, reutilizando la fixture Vue G003 existente.

`src/core/state/history.js`, `src/core/state/game.js` y `src/engine/runtime/scene/node-scripts.js` no necesitan cambio: G002/G003 ya aportan Undo/Redo, empaquetado Player y activación.

## Validación objetiva

- Node suite focal + regresión de clipboard/linked mesh: **238/238 PASS**.
- Compilación Vite: **NO VERIFICADA**, ausencia de `node_modules/vite` (`vite: not found`).
- Electron/real Jolt/Vue: runner preparado, **NO VERIFICADO**, se detiene antes de WebGL por falta de Vite.
- Generador documental: `node scripts/gen-docs.mjs --check` PASS.
- QA local Editor y Player: **PENDIENTE del usuario**.

No se declaró QA Electron PASS, compilación exitosa o Gate CERRADO.

## Consolidación tras QA del usuario — 2026-11-01

El usuario aprobó la entrega S06-G004. La secuencia S01–S06 queda finalizada funcionalmente. Se actualizan solo contrato, documentación de QA y las seis hojas del ledger; no se modifica runtime, Editor, Player, formatos ni pruebas. La aprobación acredita QA local declarado, pero no convierte automáticamente en PASS la compilación o el runner Electron no ejecutados en el entorno de implementación.

SOURCE_BASELINE de continuidad: paquete G004 acumulado con el registro documental de esta aprobación. Los correctivos futuros, si se detectan defectos concretos, requerirán un Gate autorizado propio.
