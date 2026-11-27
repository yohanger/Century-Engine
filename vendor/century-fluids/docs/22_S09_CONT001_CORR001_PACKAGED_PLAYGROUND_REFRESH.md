# S09 CONT-001 CORR-001 — Refresco del paquete publicado del playground

**Gate autorizado:** `CENTURY-FLUIDS-S09-G001-CONT-001-CORR-001-PACKAGED-PLAYGROUND-REFRESH`.
**Fuente:** `CENTURY_FLUIDS_S09_G001_CONT001_CHUNKED_VOXEL_ACTIVE_REGIONS_SOURCE_BASELINE.zip`.
**Estado:** implementación y QA de autoría PASS; build Vite y QA visual Jolt en navegador post-CORR **NO VERIFICADOS**. S09 CONT-001 y S09 G001 permanecen abiertos. S08 permanece **EN PAUSA**. CF-CA-005 sigue **NO RATIFICADO**.

## Diagnóstico acreditado

- El QA local del usuario ejecutó 105/105 pruebas Node, 3/3 Jolt WASM real en Node, pero `npm run qa:s09:build` falló: Vite no encontró el export `ChunkedSurfaceCache` en `playground/node_modules/@century/fluids/dist/surface/index.js`.
- El usuario contrastó la copia instalada y el tarball recién empaquetado: la exportación se encuentra en el tarball, pero no en la instalación. El código público `src/surface/index.ts` ya publicaba la exportación.
- Reproducción de autoría con npm offline: dos versiones de contenido para el mismo paquete local `@century/fluids@0.1.0` y el mismo nombre de `.tgz`; `npm install --package-lock=false` conservó la instalación antigua. Refresco dirigido del paquete instaló la exportación nueva.

## Corrección mínima

- `tests/run_playground.mjs`: tras `npm pack` y `npm install` compara **bytes** de los ficheros públicos `package.json` y `dist/**` del paquete generado con su instalación.
- `tests/playground_install.mjs`: si difieren, retira únicamente la instalación generada `playground/node_modules/@century/fluids` y reinstala con los argumentos npm existentes. Rechaza enlaces simbólicos, nombres de archivo inválidos y discrepancias persistentes. No toca otros paquetes, ni archivos de trabajo fuera del paquete generado.
- `tests/playground_package_refresh.test.mjs`: cuatro pruebas de actualización mismo nombre/versión, aislamiento de otras dependencias, fallo cerrado y protección de enlaces. La cuarta incluye `npm pack` y `npm install --offline` reales contra un tarball local de prueba.

**No se modifican** el solver, el índice espacial, los voxels, la extracción, Jolt, Three.js, la estructura del paquete raíz ni los contratos físicos. No se añaden dependencias de navegador al núcleo.

## QA

- TypeScript 5.8.3 y Node tests: 109/109 PASS en autoría.
- Reproducción npm offline A/B: versión anterior conservada tras instalación ordinaria; instalación actualizada después del refresco dirigido: PASS.
- Validación de paquete ESM, TypeScript consumidor y escenarios Node: en el verificador integral S09, pendiente de registrar tras ejecución final.
- Vite/Three/Jolt WASM **en navegador post-CORR:** NO VERIFICADO en autoría; ejecutarlo localmente.

## QA local exigido

```bash
npm ci
python3 qa/verify_s09_cont001.py --project . --jolt --browser-build
npm run playground
```

Resultado requerido para build: `S09_BROWSER_BUILD_PASS`. Abrir `http://127.0.0.1:5174/` y observar `S09_BROWSER_READY`, `joltWasmReal: true` y los cuatro escenarios, sin `S09_RUNTIME_FAIL`. El mensaje de Vite sobre `node:module` es independiente del `MISSING_EXPORT` diagnosticado y debe evaluarse solo si produce fallos después de esta corrección.
