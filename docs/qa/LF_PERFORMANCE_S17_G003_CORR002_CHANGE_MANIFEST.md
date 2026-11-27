# LF-S17-G003 CORR-002 — Manifiesto incremental

Fuente: LF_PERFORMANCE_S17_G003_CORR001_REAL_VIEWMODES_TERRAIN_BAKE_AND_CLOUD_DIAGNOSTICS_SOURCE_BASELINE.zip
Autorización: LF-PERFORMANCE-S17-G003-CORR-002-VIEWPORT-OVERLAYS-AND-DIAGNOSTIC-UX-CLEANUP
Estado: IMPLEMENTADO · NODE PASS · QA ELECTRON PENDIENTE

- Modificados: 9
- Añadidos: 11 (incluido este manifiesto)
- Eliminados: 0

## Archivos modificados / añadidos (SHA-256 de entrega)

- `docs/architecture/LF_PERFORMANCE_S17_G003_CORR002_VIEWPORT_UX_CONTRACT.md` · `a73bf718b15e22ef03fb330bc73af752297c6ebc34ec5ce03f54f97851536bb2`
- `docs/qa/LF_PERFORMANCE_S17_G003_CORR002_VIEWPORT_UX_QA.md` · `a649ff211715f09145d8011d38e8146dd36cf0ae5bbf6d1333e831b40321e282`
- `docs/qa/LevelForge_DB_Ledger.xlsx` · `27686ed85d69e4960e8dbb94ffb7c927a08ff3483c818b1260328755287bb79d`
- `docs/qa/evidence/S17_G003_CORR002_BASELINE_COMPARISON_NODE.log` · `c12270d114848f9295522981a0818a491064976919effd4a58c1d4398b98d415`
- `docs/qa/evidence/S17_G003_CORR002_BUILD_BLOCKED.log` · `4f1ad94331d0e35167ea085f364282c3225262ef47ac91a71455bbbea8399be7`
- `docs/qa/evidence/S17_G003_CORR002_EXTENDED_NODE.log` · `29646e551e0326b3e04a47edb35ded1df3b01323f89cb86534c396e0fc0fb419`
- `docs/qa/evidence/S17_G003_CORR002_FOCAL_NODE.log` · `97cb7372235a89e7b1601864c5ded08d299d8f2da75094930b3c8cfa081ed2a6`
- `docs/qa/evidence/S17_G003_CORR002_NEWTESTS_NODE.log` · `00ee05d8f579cd9ee5c6ba2f06420e1864eb7b1380bdcf5ea938ebd5020d1231`
- `scripts/test-performance-s17-g003-corr001.mjs` · `03265599920aa517644391ca508ea8ded1b6e5900d5f32c2b37b361938aed222`
- `scripts/test-performance-s17-g003-corr002-viewport-ux.mjs` · `be1cf398e95b5e64261c99a6e0119f8356ca70605bf018090ead348839624cd4`
- `scripts/test-performance-s17-g003-integral.mjs` · `d7bc0524d6fa485b688f9e667d9e4c869c4b39d001a270626b008b2a2555a50b`
- `src/components/PerfPanel.vue` · `dc9c4b8ab487963792251b218f6325c91a93d9564ede1f9e6331ecd155d87306`
- `src/components/ScenePanel.vue` · `5d24dc1726a5180db835986b650d4fb31f2a8decf16020d25f7565469345ed04`
- `src/components/ViewBar.vue` · `e562d84f1576ce204311510d52f40ade3c0bb6fe978aec1d3e45ed9372af7e1d`
- `src/components/ViewportDiagnosticsHud.vue` · `69b7d27503da49a98be515fb5932495622e48a52bd321a44016bf1fc327371b8`
- `src/components/ViewportOverlay.vue` · `d654102234fe961c9062583ef42f9d4f248cc35a410c72ed41c5dd7aeeeddb7c`
- `src/engine/runtime/render/diagnostic-hud-model.js` · `90ffedc37de02071a66a1da8da8397f908352b88618269119cddb3e0de46d6d4`
- `src/engine/runtime/render/view-diagnostics-contract.js` · `2a73d7266878432ff10fa0e6139f1f90818891b3772c0ad1b8af10603dbf8cfb`
- `src/engine/runtime/render/view-diagnostics.js` · `45f91fe37b1ec5b3db70d3a450b16c93193ae93da604cb37855b00a80222e3e2`

El manifiesto se excluye de su propia lista de hashes para evitar autorreferencia.

## QA

- Nuevas pruebas 9/9 PASS.
- Batería focal 63/63 PASS.
- Ampliada 97 PASS/7 FAIL idéntica al SOURCE_BASELINE original.
- `npm run build`: bloqueado (`vite: not found`).
- Electron/Player/GPU: NO VERIFICADO.

## Regla de aplicación

El CHANGE ZIP se aplica únicamente sobre el SOURCE_BASELINE CORR-001 identificado arriba.
No sustituir archivos modificados localmente sin compararlos previamente. El SOURCE_BASELINE nuevo incluye todo el estado completo.
