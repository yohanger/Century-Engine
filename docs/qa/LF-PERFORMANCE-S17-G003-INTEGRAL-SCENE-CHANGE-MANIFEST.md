# LF_PERFORMANCE_S17_G003_INTEGRAL_SCENE_OPTIMIZATION_AND_EDITOR_CORRECTIONS — Manifiesto incremental

**Gate autorizado:** `LF-PERFORMANCE-S17-G003-INTEGRAL-SCENE-OPTIMIZATION-AND-EDITOR-CORRECTIONS`

**Baseline de origen:** `LF_CLOUD_STORM_S00_G001_NATIVE_APPROACH_AND_LIGHTNING_ILLUMINATION_SOURCE_BASELINE.zip`
**SHA256 baseline origen:** `43f2f0e9176ac52b8ec3d158f3ee1807897ef73f2fe1ab2a9eebef2810d19255`

**Estado:** implementación fuente parcial; 12/12 tests propios PASS, batería amplia 128/131 (3 fallos reproducidos en baseline). BUILD/ELECTRON/PLAYER/GPU NO VERIFICADOS. No aprobado/no cerrado.

**Archivos nuevos:** 4. **Modificados:** 15. **Eliminados:** 0.

**APLICACIÓN:** el CHANGE ZIP contiene los archivos relativos a la raíz exacta del SOURCE_BASELINE de origen. Se recomienda hacer copia de seguridad y no sobrescribir modificaciones locales de otro trabajo. El SOURCE_BASELINE suministrado ya incluye todo y es el punto de continuidad.

**Métrica:** fixture plano 128×128: 32.768 → 520 triángulos; fixture plano 176×176: 61.952 → 982 triángulos. No equivalen al proyecto real del usuario. Se conservan datos fuente.

## Nuevos
- `docs/architecture/LF-PERFORMANCE-S17-G003-INTEGRATION.md` — SHA256 `da966264cb8d4f4dc44b04396814b7a4ba64305b2b1df1e01396e1ac808b322d`
- `docs/qa/LF-PERFORMANCE-S17-G003-QA.md` — SHA256 `6e4f92d6b2d15235f777ec7d600425e03eaf6657f56eba13353b0a708cf7b37b`
- `scripts/test-performance-s17-g003-integral.mjs` — SHA256 `5f5a295d4322c988de0552212b9e78baa6a6cf031154e7939171e58554c9850d`
- `src/engine/runtime/render/terrain-bake.js` — SHA256 `b71f76809196b460e19eb9108c0a46530a58cb5eb9da6c1abefe4f9c86e8cae4`

## Modificados
- `docs/qa/LevelForge_DB_Ledger.xlsx` — SHA256 `f8e1cd502d39a9b1b70dc9d50337a9af0bee5b6e002bc3cf2617133853d3d05c`
- `src/components/MeshPanel.vue` — SHA256 `a94edb54b3ff158b23f868cf4a7d7547e128e16e64c964281e416d7bddad2107`
- `src/components/PerfPanel.vue` — SHA256 `224038f7cb74dd2fc1b9b674d0681ebda3b8bd98a064c2772c13a09044829591`
- `src/components/ScenePanel.vue` — SHA256 `ad8ef7e4589e2905755c63050cada2d04afc4d493b0fce1c8eeecb6de7e1d160`
- `src/core/mesh/ops-edit.js` — SHA256 `b512bb67c579b421580e530cc5b8fd9aa9c4ff94c3bd3b81fe535c933b2f122e`
- `src/core/state/terrain.js` — SHA256 `156ff4ac5510049bfbee9676084d07dcc9f1442c33420a94c7abe8c4dfa2e8d8`
- `src/engine/runtime/geometry/terrain-io.js` — SHA256 `98bf888dc84385c1f81891427940c2fcaf6ced67617c5fdd2da1ad20fc50f843`
- `src/engine/runtime/geometry/terrain.js` — SHA256 `ee44d632388df141e26c09ee707a3bf8c7d84e6aeef9dcbb50fa11dd5fd7a953`
- `src/engine/runtime/render/cluster-mesh.js` — SHA256 `169bcd42c826aac52510d7c5fcaf0d9113912e6d8082fcec9bdbce5dd59c85c4`
- `src/engine/runtime/render/lod.js` — SHA256 `f8731857fed6752c22ae876892c17a172c5df7557d49fd70333ccf4138e3b4c9`
- `src/engine/runtime/render/lodmgr.js` — SHA256 `4734c735f457c1f790ffad078db50f731846fb4221367bc9cb43f09666ac7ca1`
- `src/engine/runtime/render/skylib.js` — SHA256 `679d59f3eb2b24e98f114f92db85b5205257c74076e52e0260f9a04d01efdc3b`
- `src/engine/runtime/render/viewport.js` — SHA256 `a7bdb819d770853b0be71b851be8241f9c92a25c55426a22b8ab75357c0ab01a`
- `src/engine/runtime/world/cloud-volume.js` — SHA256 `06770a5aeda54b9d3b2811d49188924e0f1e696e6017e9f544b5ee449da9ab90`
- `src/engine/runtime/world/cloudfield.js` — SHA256 `ff868ccc1b2f7ef4ecfd16955c8003337ef85c30c1ab04add718405d2a369bb2`

## Pruebas y bloqueos
- `node --test scripts/test-performance-s17-g003-integral.mjs`: 12/12 PASS.
- Node focal amplia: 128 PASS / 3 FAIL; tres fallos reproducidos en baseline (import `three` ausente y 2 aserciones antiguas).
- Node adicional: 56 PASS / 1 FAIL; el fallo también se reproduce en baseline porque `three` no está instalado.
- `npm run build`: exit 127 (`vite: not found`); no existe evidencia Electron/Player/WebGL2.
- El proyecto con ~60.000 triángulos no fue adjuntado; no existen mediciones de reducción ni FPS en su escena.
- Culling por oclusión de geometría del raymarch volumétrico no está probado ni implementado integralmente: solo presupuesto por perfil y omisión segura del campo vacío.

## Próximo QA
1. Revisar escena de usuario y comprobar visibilidad, altura, nubes y topología.
2. Compilar Editor + Runtime con dependencias disponibles; ejecutar en Electron.
3. Medir antes/después con cámara y perfil fijos; reportar triángulos, draw calls, CPU/GPU, RAM, p50/p95 y errores visuales.
4. Solicitar aprobación explícita únicamente después de QA local.
