# Manifiesto de cambios — S17-G003-CORR-001

- Baseline padre: `LF_LIGHTING_BAKE_S00_G001_BACKGROUND_SCHEDULING_AND_GPU_RECOVERY_SOURCE_BASELINE.zip`
- SHA-256 baseline padre: `f7d396063562877f67da4662bf6b891b4dd0e7eee32d8d2934c24f09bf7ed06f`
- Archivos originales: 3631
- Archivos nuevos o modificados antes del manifiesto: 19
- Eliminaciones: 0
- QA Node focal: 34/34 PASS; ampliado: 70 PASS, 2 runners bloqueados por falta de `three`.
- Compilación Vite y Electron/WebGL: no verificados en este entorno (Vite no instalado).

| Estado | Archivo | SHA-256 nuevo |
|---|---|---|
| NUEVO | `docs/qa/LF-PERFORMANCE-S17-G003-CORR001-QA.md` | `7ddf3897543ede3e0d2e1922a32dc390cb8e528672f73ca9155d36f7bf196736` |
| MODIFICADO | `docs/qa/LevelForge_DB_Ledger.xlsx` | `5772e70c06bf4941c716c2a758cdf802fdac4b62a9382a12b0c14b4a57f2767f` |
| NUEVO | `docs/qa/evidence/LF-PERFORMANCE-S17-G003-CORR001/node-core.log` | `9c56256ef597015b953c2cb32e72bd4698f5a581535db6f6255b8d87c4830340` |
| NUEVO | `docs/qa/evidence/LF-PERFORMANCE-S17-G003-CORR001/node-extended.log` | `754a71d7f2e57c52a0dfc561faf7eb919dce219ba0f505df6ad7217610ebd009` |
| NUEVO | `docs/qa/evidence/LF-PERFORMANCE-S17-G003-CORR001/vite-build-blocked.log` | `4f1ad94331d0e35167ea085f364282c3225262ef47ac91a71455bbbea8399be7` |
| NUEVO | `scripts/test-performance-s17-g003-corr001.mjs` | `257fcc5493e670483dd3952f5ac39f842655fa034d9d5498fa72a46911aa455f` |
| MODIFICADO | `scripts/test-performance-s17-g003-integral.mjs` | `b5a19d2f234e839991793b957a2c6400ff85414a1b0091d79e09d2762bbb6ddb` |
| MODIFICADO | `src/components/PerfPanel.vue` | `e2f7193ff8c519db4820334c640712c1224f60a495ab5f3b8c4cbf8d6f35e5bd` |
| MODIFICADO | `src/components/ScenePanel.vue` | `2b59b2d2c016b51f6b0388c5967d77257d0b4c4711af6872898607711715e928` |
| MODIFICADO | `src/core/state/terrain.js` | `fea9895e9b5de06a25a2d105839f337c4e3be950a5321adf4a47349fecd45a82` |
| MODIFICADO | `src/engine/runtime/geometry/terrain.js` | `d0169150c247af92dd81879e156ccea7090b11add251455aca9c1c5239dd6b22` |
| MODIFICADO | `src/engine/runtime/render/cluster-mesh.js` | `fdf1a2f200cd1644a3da814c96329873a00b1f1fb93d16798ba77c45cff6953a` |
| MODIFICADO | `src/engine/runtime/render/lodmgr.js` | `72facebbd33f27407db1eac65136f025fa088bb783d910bd77f0c50b94f00609` |
| MODIFICADO | `src/engine/runtime/render/skylib.js` | `c1fbd73cb39a58c31f62fc5f8105ff69afb22b686d8c7a38d4e26bf52457cd81` |
| NUEVO | `src/engine/runtime/render/terrain-adaptive.js` | `9e6dd1f53f7dcb9af26c545e119a81baa71eea583fb2ffc45485de3331dd4370` |
| MODIFICADO | `src/engine/runtime/render/terrain-bake.js` | `69c9695380c76efcac96300cef7431b3d50ebd95185e498921727948cb36f1aa` |
| MODIFICADO | `src/engine/runtime/render/view-diagnostics-contract.js` | `0fd08e47ab03e4f7203f4d938428b9ffcba4b7131098e6c4b33cfdd07ba6dbd2` |
| MODIFICADO | `src/engine/runtime/render/view-diagnostics.js` | `18b5fdd3d4b0a6630db9d2e18207c8f0a6d696df2d31308b7601bc6aac51d0ce` |
| MODIFICADO | `src/engine/runtime/render/viewport.js` | `0926575596ad1f92cdaef26b8a7c282032d3665afa138d524913c820f5700ee2` |
