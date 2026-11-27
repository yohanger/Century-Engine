# TriangHor / S17-G003-CORR-003 — Manifiesto incremental

Gate: `LF-PERFORMANCE-S17-G003-CORR-003-TRIANGHOR-SPATIAL-AND-REAL-COMPLEXITY-DIAGNOSTICS`
SOURCE_BASELINE padre: `LF_PERFORMANCE_S17_G003_CORR002_VIEWPORT_OVERLAYS_AND_DIAGNOSTIC_UX_CLEANUP_SOURCE_BASELINE(1).zip`
SHA-256 padre: `e22c30650e245a6339bef5e56791022968ea61426988083bf755515a388ac7d8`

**Estado:** IMPLEMENTADO EN FUENTES · NODE 99/99 PASS · BUILD VITE/QA LOCAL NO VERIFICADOS · NO APROBADO · NO CERRADO.

**Regla:** aplicar únicamente sobre el SOURCE_BASELINE padre exacto. No sobrescribir trabajo local sin comparar. El SOURCE_BASELINE completo de la entrega ya incluye estos cambios.

Archivos originales: 3649. Nuevos/modificados (sin contar manifiesto): 29. Eliminados: 0.

## SHA-256 de nuevos/modificados
- NUEVO: `docs/qa/LF_PERFORMANCE_S17_G003_CORR003_TRIANGHOR_QA.md` · `b46f41f34409c2ea6c77117f1d00bdc630a561ba9b7a41dab718acce930aad3c`
- MODIFICADO: `docs/qa/LevelForge_DB_Ledger.xlsx` · `f05bc5efdf7ff4f5762baf43b08ca8e041d0df271fda4dc1c94a251c85681519`
- NUEVO: `docs/qa/evidence/LF_PERFORMANCE_S17_G003_CORR003/qa-extended-node.log` · `6c90610fcc750b808a54b23c36bcd20bdd36ddb86f673fbff337285293b8c024`
- NUEVO: `docs/qa/evidence/LF_PERFORMANCE_S17_G003_CORR003/qa-focal-node.log` · `bdc9eee92b4abc0274081f5494671a97097604e399730d5566f3b748751a359d`
- NUEVO: `docs/qa/evidence/LF_PERFORMANCE_S17_G003_CORR003/qa-worker-and-spatial-node.log` · `8f8d14b548c4343ad79e95c111cf00ec8108f18717844f36225ac5332f7f3767`
- NUEVO: `docs/qa/evidence/LF_PERFORMANCE_S17_G003_CORR003/vite-build-blocked.log` · `4f1ad94331d0e35167ea085f364282c3225262ef47ac91a71455bbbea8399be7`
- NUEVO: `scripts/fixtures/trianghor/node-worker.mjs` · `07c496c83d15e162ae874785f2b0ac29e2981d56fbbe5c3fd5d48dc7eaf8b1df`
- MODIFICADO: `scripts/test-performance-s17-g003-corr001.mjs` · `acabcbdad77e5bc64835f26c21b52ddf2c7d2997ebb2dd26f4118d94fe454641`
- MODIFICADO: `scripts/test-performance-s17-g003-integral.mjs` · `61f094b5891e4879999a8b1aa0a2942777abb4c57f5003c3c3f5eba77d6fe046`
- NUEVO: `scripts/test-trianghor-s17-g003-corr003.mjs` · `17c3e774b3206df0dcd7a1b8beda686b1fbbdf38be8c4318a47f7e03fe229751`
- MODIFICADO: `src/components/PerfPanel.vue` · `b400cd50b774bb226dc5d29fd08548604e2c22e453e9d4083880ef38d96922ac`
- MODIFICADO: `src/components/ScenePanel.vue` · `3b9ed80d16fb089a3e59e18c6be6c4063edd5a605fa28beaeba53998c36b1189`
- MODIFICADO: `src/components/ViewportDiagnosticsHud.vue` · `ccdfed36dd34771c009678682e452428bde6d13b287b528cc3304da6b1016849`
- MODIFICADO: `src/core/state/terrain.js` · `751f840dc657a670a05c5d487c80eaf42dd6862189253116ca1c7da54ab9e8f3`
- MODIFICADO: `src/engine/runtime/geometry/terrain.js` · `0d68d343c8fc7ae0e838545774ea84a8301de39f3197b7eff6cb10ba7f59ad39`
- MODIFICADO: `src/engine/runtime/render/cluster-mesh.js` · `ae389bd8bb1b93a13164adf99f2dd1415a3035d556ca233b1ff043e090e5a92b`
- MODIFICADO: `src/engine/runtime/render/diagnostic-hud-model.js` · `bf90b7ce6ffd2624f4fde3b2eafd77072882c666a543f3a6a8ddb2e57699093c`
- MODIFICADO: `src/engine/runtime/render/lodmgr.js` · `f9448ab2c104d13df2a53a96d0432898bacf5b469748d2babc45a72878d9f561`
- MODIFICADO: `src/engine/runtime/render/terrain-adaptive.js` · `6bc56494a98436dcd0045822722baab72f19d19c2d830493a83f5ce4b3c4c2a1`
- NUEVO: `src/engine/runtime/render/trianghor/README.md` · `d2006de99d53ae0fec4b4868f18746daee2fe1aef236795035ee0b9349f020e5`
- NUEVO: `src/engine/runtime/render/trianghor/bake.worker.js` · `13dbb0cbfbf26929affc5e5375f9bb78bb2ded025f7e865abe18b8641a069685`
- NUEVO: `src/engine/runtime/render/trianghor/core.js` · `1fe0e8802d80e5a995e0875a434f08f235cc3051edbfde21c4b42cabe12e61b5`
- NUEVO: `src/engine/runtime/render/trianghor/job.js` · `b329930f59b760417bb8cb0b688710998e59e497a379f5e52fb4366715b8b8ab`
- NUEVO: `src/engine/runtime/render/trianghor/spatial.js` · `f5ef372618d6b93f00479e3ff8318991c113be76039f267c5f6dda442b1f06a4`
- NUEVO: `src/engine/runtime/render/trianghor/terrain-shader-cost.js` · `0c607ca724c4ac5db1ad65b930ae1fa25fc1b5c960b2668900126ad96c498b9c`
- NUEVO: `src/engine/runtime/render/trianghor/triangulate.js` · `ef425bdd3c589bf58a6a144d7cb3d2bd4630ff1583ccf1e425e3f70130126561`
- NUEVO: `src/engine/runtime/render/trianghor/worker-client.js` · `daaa92e7f0a627f05c62475cbb9c3919e6c61287dd1e66a6af2809693cde408c`
- MODIFICADO: `src/engine/runtime/render/view-diagnostics-contract.js` · `18a1c1e2e2114cdbca1129ba9ee5ee3b1440e53a0965faa6b856f16c3ae885d0`
- MODIFICADO: `src/engine/runtime/render/view-diagnostics.js` · `9fc71f5bb467e3b62eebabb8719e78b3f78a41c16c74ab3e09fc39a4de6ca9cb`

## Evidencia y límites
- Node: 12/12 TriangHor y 99/99 batería ampliada.
- Worker real probado en worker_threads con adaptador del mismo script de Worker web.
- Fixtures: 128×128 plano 32.768→510; bulto suave 64×64 8.192→636; bulto 128×128 32.768→864.
- No hay archivo de escena real del usuario para certificar ≥90% en su terreno.
- npm run build bloqueado por vite no instalado. Shader WebGL2, Electron, Player, sombras y FPS no verificados.
- No se agregaron nuevas dependencias ni se modificó el horneador de iluminación.
