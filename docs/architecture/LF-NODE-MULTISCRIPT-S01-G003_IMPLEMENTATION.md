# LF-NODE-MULTISCRIPT-S01-G003 — Implementación

**Baseline:** G002 íntegro; **resultado:** G003 IMPLEMENTADO · QA local pendiente · NO CERRADO.

## Cambios de producción

- `src/core/project.js`: `migrateNodeScripts` reutilizable; aplicado a escenas y Prefabs presentes en metadata del proyecto.
- `src/core/state/prefabs.js`: normalización de datos antiguos al crear, instanciar, actualizar/revertir y aplicar. La raíz se normaliza a partir del recurso, evitando conservar `scriptIds` obsoletos.
- `src/core/lfproj.js`: normaliza cuerpos de Prefab antiguos al descomprimir; evita coexistencia de campos contrapuestos.
- `src/core/state/terrain.js`: nuevo nodo Terreno con `scriptIds: []` en vez del campo legado.
- `src/core/levelpackage.js`: elimina bloqueo provisional G002; cierra dependencias de todos los scripts de nodos del paquete; valida tipo y ausencia de recursos antes del ZIP.
- `src/core/levelpackage-import.js`: elimina bloqueo provisional G002; valida cierre y carácter de Script de Nodo, soporta reuse de recursos válidos y remapea referencias de las listas ordenadas; normaliza escenas antiguas antes de incorporarlas.
- `src/core/buildList.js`: validación multiscript para **todas** las escenas incluidas en Build, antes de empaquetar.
- `src/core/exporter.js`: bloquea Scripts de Nodo JS no soportados por Godot, incluido preflight multiescena.

Los archivos `src/core/state/objects.js`, `src/core/state/history.js`, `src/core/state/game.js`, `src/engine/runtime/scene/node-scripts.js` y `src/engine/runtime/package/format.js` se reutilizan sin modificaciones.

## Pruebas y fixtures

- `scripts/test-node-multiscript-s01-g003.mjs`: 20/20 PASS.
- Regresión acumulada con S01–S06 y portapapeles: **299/299 Node PASS**, 0 FAIL, 0 SKIP.
- Las pruebas históricas G002 de `migrateScene` y `.levelpackage` fueron actualizadas para invocar el helper extraído y sustituir la expectativa de bloqueo provisional por importación validada; tests S06 G004 de Prefabs/importador fueron adaptados al mismo helper, sin eliminar cobertura.
- `scripts/test-node-multiscript-electron-s01-g003.mjs`: E01 Jolt WASM + runtime y E02 Vue/Inspector con Electron embebido; el entorno no tiene Vite y el preflight se bloquea; **Electron NO VERIFICADO**.
- `npm run build`: `sh: vite: not found`; **Editor/Player NO VERIFICADOS aquí**.
- `node scripts/gen-docs.mjs --check`: PASS.

**Riesgos documentados:** el importador de `.levelpackage` rechaza un Script de Nodo no incluido, un recurso global o un skip indebido; no hace una importación parcial ni elimina referencias de forma silenciosa. La compilación no demuestra QA visual y queda a cargo de la prueba local del usuario. La Consola se mantiene fuera de alcance.

### Limitaciones preexistentes reproducidas

Se ejecutaron adicionalmente las suites históricas de Terreno y Subtract (35 casos). **29 PASS / 6 FAIL** idénticos al SOURCE_BASELINE G002, debidos a harness VM que omite `validateSignalConnections`; la raíz del fallo es previa a G003. La modificación de fixtures históricas no vinculadas a Multiscript queda fuera del Gate. No se oculta esta evidencia bajo el total focal 299/299.
