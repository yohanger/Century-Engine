# S13-G005-G001 CORR-001 · QA y ejecución local

| Comprobación | Resultado disponible | Evidencia |
|---|---|---|
| Node focal | **19 PASS, 0 FAIL, 0 SKIP** | `docs/qa/evidence/LF_S13_G005_G001_CORR001_NODE_FOCAL.log` |
| Regresión compatible | **146 PASS, 1 SKIP, 0 FAIL** | `docs/qa/evidence/LF_S13_G005_G001_CORR001_NODE_REGRESSION.log` |
| Electron corregido (37 checks) | **NO VERIFICADO** (pre-renderer sin Vite en preparación) | `docs/qa/evidence/LF_S13_G005_G001_CORR001_ELECTRON_ENV.log` |
| Build Editor + Player | **NO VERIFICADO** (no hay Vite) | `docs/qa/evidence/LF_S13_G005_G001_CORR001_BUILD_ENV.log` |
| QA usuario | **PENDIENTE** | Necesaria nueva ejecución local |

**Fallo inicial del usuario:** `npm ci` se completó; Node 17 PASS; Electron 0 checks, `stage:null`; el error inicial no prueba falla de plegado. Ver `docs/qa/evidence/LF_S13_G005_G001_CORR001_USER_FAILURE.md`.

## Desde la raíz del proyecto existente (`package.json`)

Compare y respalde los tres archivos que reemplaza CHANGE: fixture HTML, prueba Node y ledger. No toque archivos locales distintos, Assets, escenas ni código de producción; SOURCE_BASELINE se conserva como referencia y no se extrae sobre el proyecto activo.

```bash
node --test scripts/test-inspector-terrain-folding-s13-g005-g001.mjs
node --test scripts/test-inspector-terrain-folding-s13-g005-g001.mjs scripts/test-inspector-global-folding-s13-g002.mjs scripts/test-inspector-global-folding-s13-g002-corr001.mjs scripts/test-terrain-inspector-context-s04a-g001.mjs scripts/test-terrain-node-s01-g001.mjs scripts/test-terrain-node-s01-corr001.mjs scripts/test-terrain-transform-s02-g001.mjs scripts/test-terrain-extents-s03-g001.mjs scripts/test-inspector-node-spacing-s13-g011-g001.mjs
node --test scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs
npm run build
npm run electron
```

Esperado: Node focal 19 PASS, regresión compatible al menos 146 PASS con 1 SKIP si falta compiler Vue; Electron 1 PASS con **37 checks**; build Editor y Player sin errores; Editor arranca. Nunca interpretar los 37 checks como PASS sin salida real del runner.

## QA visual usuario

- Abrir Terrain dentro del Inspector de nodos: siete grupos, una sola instancia, títulos y preferencias independientes.
- Plegar y expandir Piezas, Agua, Pincel, Capas, Vegetación, Generador y Tamaño; Enter y Espacio; Escape no pliega.
- Ojo de Vegetación no pliega; controles de agua, pincel, pintura, generador y tamaño permanecen disponibles.
- Cambiar a un cubo y regresar a Terrain conserva preferencias; cerrar y reabrir Editor conserva preferencias.
- No hay cambios inesperados de datos ni Undo/Redo por plegar; confirmar alertas de costa y resolución.

**Devolver:** salida completa Node, Electron, build y evaluación visual. CORR-001/G005-G001 quedan abiertos hasta QA y aprobación explícita del usuario. No se ha ejecutado `npm audit fix` ni modificado dependencias.
