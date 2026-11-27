# LF-NODE-SIGNALS-EDITOR-S06-G003 — QA

**Estado:** IMPLEMENTADO · TEST NODE 167/167 PASS · ELECTRON/COMPILACIÓN NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Pruebas automatizadas

| ID | Expectativa | Evidencia |
|---|---|---|
| UI-01/02 | Pestaña en Inspector, catálogo de 4 señales de Area3D | Node PASS |
| UI-03/04 | Estado único de escena; alta e historial | Node PASS |
| UI-05/06 | Edición de método; desconexión | Node PASS |
| UI-07/08 | Duplicados y nodos externos rechazados | Node PASS |
| UI-09/10 | No editar durante Play / Edit Mesh / Paint | Node PASS |
| UI-11 | `signalConnections` en snapshot Undo/Redo | Node PASS (estático); comportamiento Vue pendiente Electron |
| UI-12/13 | No ejecutar JS; estados derivados de runtime | Node PASS (estático); pendiente Electron |
| UI-14 | Dialog role, Escape y búsqueda | Node PASS (estático); pendiente Electron |
| UI-15/16 | Edición fallida no muta; sin gestor nuevo | Node PASS |
| UI-E01 | Vue real en Electron, WebGL2, alta/edición/desconexión, Undo/Redo, selección y estado activo | NO VERIFICADO (Vite ausente) |

**Regresión seleccionada:** 167 PASS, 0 FAIL, 0 SKIP. **Compilación:** `npm run build` → `sh: vite: not found`, por ausencia de `node_modules`; no equivale a defecto comprobado del código. **Player:** sin ejecución local.

## QA local requerido

1. Extraer SOURCE_BASELINE G003 sin superponer a G002. Instalar dependencias con `npm ci`.
2. Ejecutar `node --test scripts/test-node-signals-editor-s06-g003.mjs` (16 PASS esperados), `node --test scripts/test-node-signals-editor-electron-s06-g003.mjs`, `npm run build` y `npm run electron`.
3. En Editor, seleccionar Area3D, comprobar el catálogo nativo; conectar a un receptor con `node.expose()`, guardar/abrir, editar y desconectar. Comprobar señales personalizadas introducidas manualmente, estado pendiente y estado activo durante Play.
4. Verificar Undo/Redo de tres operaciones, cambio de nodo, selección múltiple y docks estrechos; comprobar que no hay scripts ejecutándose en Edit Mode. Ejecutar Player solo para regresión de G002, pues G003 no altera el Player.
5. Si hay fallo, aportar caso reproducible. Si el usuario confirma «Aprobado», registrar QA LOCAL PASS declarado por usuario. **No cerrar antes de evidencia.**

**Limitaciones G004:** remapeo de duplicación, Prefabs, Clipboard y export/import externos; no atribuir a G003 su finalización.

## Aprobación del usuario (continuidad S06-G004)

El usuario respondió «Aprobado. Sigamos.» después de la entrega G003. Se registra **QA LOCAL PASS declarado por el usuario · APROBADO**. No se declara por ello que Electron automatizado o compilación Vite hayan sido ejecutados por el asistente.
