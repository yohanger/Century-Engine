# G002 Change Manifest — Camera Occlusion

**SOURCE_BASELINE de entrada:** `LF_PERFORMANCE_S17_OCCLUSION_G001_CAMERA_VISIBILITY_CONTRACT_SOURCE_BASELINE.zip`.
**Autorización literal:** `Listo. LF-PERFORMANCE-S17-OCCLUSION-G002-CAMERA-OCCLUSION-IMPLEMENTATION autoriza comenzar`.
**Estado:** IMPLEMENTADO, 15/15 TEST FOCAL PASS, 97/97 REGRESIONES SELECCIONADAS PASS; BUILD Y QA LOCAL NO VERIFICADOS; PENDIENTE DE APROBACIÓN.

**Inventario:** 3412 archivos originales; 3420 actuales antes del manifest; 12 archivos nuevos o modificados; **0 archivos originales eliminados**.

## Archivos del CHANGE ZIP (sin build/node_modules/caché)

| Ruta | Acción | SHA-256 |
|---|---|---|
| `docs/architecture/LF-PERFORMANCE-S17-OCCLUSION-G002-CAMERA-OCCLUSION-IMPLEMENTATION.md` | NUEVO | `f0c312df7ee742ce37ece7ed53f58c4b2089d45572494698dfa631de21e50e08` |
| `docs/qa/LF-PERFORMANCE-S17-OCCLUSION-G002-QA.md` | NUEVO | `79f14ff01f9c32588de5ad471dcb7e9eb12896bc9e1e537ac7c8865c0f5f49d2` |
| `docs/qa/LevelForge_DB_Ledger.xlsx` | MODIFICADO | `da90ac6762a71bd9c4e38c63acfa33a8022071324afe0aa5a1325d306f280deb` |
| `docs/qa/evidence/LF-PERFORMANCE-S17-OCCLUSION-G002/build-environment-blocker.log` | NUEVO | `4f1ad94331d0e35167ea085f364282c3225262ef47ac91a71455bbbea8399be7` |
| `docs/qa/evidence/LF-PERFORMANCE-S17-OCCLUSION-G002/focal-node.log` | NUEVO | `1dad6181f1610149e96c70bd65bd6243bb7a7c206277c76ad2f09121c86e513b` |
| `docs/qa/evidence/LF-PERFORMANCE-S17-OCCLUSION-G002/historical-suite-with-blockers.log` | NUEVO | `f2385119deb6a8cde5fc2708185009ca465556fc312f80acc36b4b422f5b1d65` |
| `docs/qa/evidence/LF-PERFORMANCE-S17-OCCLUSION-G002/regression-node.log` | NUEVO | `75e8317789c622b683b2e4f09c2298e0d85c756f5b10764067373efec1548918` |
| `scripts/test-camera-occlusion-s17-g002.mjs` | NUEVO | `76cb610cbbf27cfe54ade0da944cc410b829add48dbe59f7f8d3afee41b79e46` |
| `src/components/PerfPanel.vue` | MODIFICADO | `374579f4f7ba11487ca0f424109bf3ae2360f2ebbe2f45eb0d9475b4087505b3` |
| `src/engine/runtime/render/camera-occlusion.js` | NUEVO | `25a1afb6ec6bc465c266ffd6c883a30a88f243eca5c2e43f0c0230958853c9f7` |
| `src/engine/runtime/render/look.js` | MODIFICADO | `a3bc3647d07fa1b838b78802af6c6b2340f90ea90a073c5f2db9738235709fe9` |
| `src/engine/runtime/render/viewport.js` | MODIFICADO | `a0796315baf069ad31502757958456f5502c37daa7424f9be018b14b1d883540` |

## QA / estado de implementación

- `node --test ...` focal 15/15 y regresión seleccionada 97/97: PASS (evidencia log incluida).
- Suite histórica ampliada 129/139: 10 fallos de referencias legadas o deps no instaladas; evidencia preservada.
- `npm ci` no completó por falta de DNS al registro npm en este entorno. `npm run build`: `vite: not found`.
- Electron, render GPU, QA UHD605, AppImage y comparativas A/B: NO VERIFICADOS.
- No se incluyeron el UnityPackage Perfect Culling ni fuentes licenciadas de terceros.
- Registros G002 añadidos a ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY; historia conservada.
- Todo el código preexistente no enumerado arriba permanece byte a byte igual al baseline.

**Gate no aprobado ni cerrado.**
