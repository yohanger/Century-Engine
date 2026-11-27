# LF_WATER_RUNTIME_S00_G001_EDITOR_PLAY_RUNTIME_VISIBILITY_RECOVERY — incremental manifest

**Authorized Gate:** `LF-WATER-RUNTIME-S00-G001-EDITOR-PLAY-RUNTIME-VISIBILITY-RECOVERY`

**Baseline:** `LF_PERFORMANCE_S17_G003_CORR003_TRIANGHOR_SPATIAL_AND_REAL_COMPLEXITY_DIAGNOSTICS_SOURCE_BASELINE.zip`
**Baseline SHA-256:** `932c01734375234dac6040ca980a5ece8c036ce98113389e1030d41acd75e716`
**Original file count:** 3665
**Changed/new before manifest:** 12
**Removed:** 0

## QA and exclusions

- 14/14 new Node tests PASS; broad WATER suite 202/203 PASS with one baseline-inherited failure.
- Adjacent suites 126/132 PASS with six baseline-inherited failures.
- npm run build: NO COMPILADO (`vite: not found`; node_modules absent).
- Electron Editor, Player and actual .lfproj scenario: NO VERIFICADO.
- Shader Complexity / glGetProgramiv diagnosis is OUTSIDE this Gate.

## Files (SHA-256 on modified/new bytes)

- ADDED: `docs/qa/LF_WATER_RUNTIME_S00_G001_VISIBILITY_RECOVERY_QA.md` — `9ed5e1a12f588ebb5e938a6cd70863e41437ecee6fb2d7cd03b45e864cbc88f8`
- MODIFIED: `docs/qa/LevelForge_DB_Ledger.xlsx` — `919573e033b5fdecf1d9d3246503ea040509eaed8983656dc7eef8ee52264981`
- ADDED: `docs/qa/evidence/LF_WATER_RUNTIME_S00_G001/build-attempt.log` — `4f1ad94331d0e35167ea085f364282c3225262ef47ac91a71455bbbea8399be7`
- ADDED: `docs/qa/evidence/LF_WATER_RUNTIME_S00_G001/node-adjacent-original-baseline.log` — `6bbd9aadf67447a853235879eed413d365ca2d01577e060799e2bc242280bc96`
- ADDED: `docs/qa/evidence/LF_WATER_RUNTIME_S00_G001/node-adjacent.log` — `f6133759ba5fcf58dbf73ea398a6a56d6df46492e18cdbc86f0d90694ecf697e`
- ADDED: `docs/qa/evidence/LF_WATER_RUNTIME_S00_G001/node-new-14-pass.log` — `26ab5c0daa1679e1a899f69b27a812790d56cf63b648cfc5c5e8fe7c90cb4866`
- ADDED: `docs/qa/evidence/LF_WATER_RUNTIME_S00_G001/node-original-baseline-known-failure.log` — `567b6756ff0e6f490de76a0a7cea33440f354a494d1fa366b804fd4e7729d048`
- ADDED: `docs/qa/evidence/LF_WATER_RUNTIME_S00_G001/node-water-broad.log` — `59defea20de5a54e0474e9d46c76be82bec801397efda9ec63c3b03b8170d8cb`
- ADDED: `scripts/test-water-runtime-visibility-s00-g001.mjs` — `be2afe2a60a9577939c537262face09df4aa50cea674c57c8a04c72e8b656ac9`
- MODIFIED: `src/engine/runtime/events/play.js` — `70e486df6af4de4d0e812a66001d797ba35b73ea45136321c09b2a579947cb24`
- MODIFIED: `src/engine/runtime/geometry/water-surface.js` — `52c8d52c5e5e9a9f9b4f08820812e4fe0afb2a951be79a2176d061ae74f3702b`
- MODIFIED: `src/engine/runtime/scene/water.js` — `8631fa5558050c0ce5972eab0f81fa6e62bd7aa9672f1abb0bafecea78f20446`

## Safe application

This CHANGE is relative to the exact SOURCE_BASELINE named above. Compare any local modifications before applying; do not overwrite other work blindly. The new complete SOURCE_BASELINE contains the authorized changes and all original files.
The manifest does not hash itself to avoid a self-referential digest.
