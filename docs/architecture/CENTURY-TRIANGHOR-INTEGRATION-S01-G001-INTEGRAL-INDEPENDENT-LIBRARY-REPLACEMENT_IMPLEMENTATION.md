# Integración integral de TriangHor independiente

**Amendment de autoridad:** `CE-TH-CA-001-INDEPENDENT-TRIANGHOR-CONSUMER-AUTHORITY` — RATIFICADO.
**Gate:** `CENTURY-TRIANGHOR-INTEGRATION-S01-G001-INTEGRAL-INDEPENDENT-LIBRARY-REPLACEMENT` — AUTORIZADO.

## Procedencia de fuentes

- Century: `CENTURY-EDITOR-VIEWMODES-S01-G001-CORR-003-WIREFRAME-TRIANGLES-TRIANGHOR-PARITY_SOURCE_BASELINE.zip` (último SOURCE_BASELINE disponible en esta conversación).
- TriangHor: `CENTURY-TRIANGHOR-S07-G001-FINAL-API-AUDIT-AND-LIBRARY-CLOSURE_SOURCE_BASELINE.zip`, versión privada `0.0.1`.
- Ambas entradas se extrajeron sin modificar. No hay cambios de usuario adicionales recibidos dentro de estos paquetes.

## Intervención

1. Se incorpora el paquete original TriangHor, versión fija, a `vendor/trianghor` y se referencia por dependencia `file:` tanto en manifest como lockfile. Sus archivos de producción `src/` se conservaron byte por byte.
2. Las antiguas exportaciones de `terrain-bake.js`, `terrain-adaptive.js`, `trianghor/core.js`, `job.js`, `spatial.js`, `triangulate.js`, `bake.worker.js` y funciones de índice del LOD ahora delegan en la API pública externa. No queda una segunda implementación activa.
3. El cliente Worker Vite apunta a la entrada pública `trianghor/worker`. El adaptador `worker-service.js` usa cliente incremental con Worker residente acotado, snapshots de los buffers, cancelación, fallbacks por concurrencia, validación estricta de resultados y liberación cuando se destruye el Terrain.
4. Century mantiene toda la publicación editorial, revisiones, ClusterMeshes, selección de páginas, LOD, sombreado, diagnósticos y persistencia existentes. El formato de escena no cambia.
5. Se incluye una suite de integración dirigida en `scripts/qa-suites.json` y cobertura específica para fallos del Worker.

## Límites

La importación Vite `?worker&inline` se ha configurado, pero no se compiló ni ejecutó en Electron porque no hay dependencias instaladas (`vite: not found`). La prueba Node del mismo Worker público no sustituye el QA real del bundler, Editor o Player. La paridad de renderizado y la mejora de FPS tampoco están acreditadas.

Este Gate es **un único Sprint/Gate integral**. No modifica el repositorio independiente TriangHor ni realiza operaciones Git.
