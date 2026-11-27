# Evidencia recibida del usuario · S13-G002 original

Fecha: 2026-11-08. La persona usuaria aplicó CHANGE S13-G002 y ejecutó Node + Electron desde el directorio de LevelForge.

- Node: **41 PASS, 0 FAIL**.
- Electron: **1 FAIL**, WebGL `gl: true`, **11 comprobaciones previas PASS**.
- Última comprobación satisfactoria: `Existe botón original de Restablecer`.
- Excepción al pulsarlo: `TypeError: Cannot read properties of null (reading 'syncObject')`, ruta `Inspector.vue` (`resetTransform` → `upd`), `src/core/state/objects.js:updateObject`.
- Prerrequisito ausente en la fixture: `store.editor`. Al hacer commit también se requiere `snapshotTerrain`.

No hay evidencia de fallo de plegado en las once comprobaciones ejecutadas. Las doce restantes no se ejecutaron en aquel intento; no se proclama PASS de Electron. La corrección implementada requiere nueva ejecución local.
