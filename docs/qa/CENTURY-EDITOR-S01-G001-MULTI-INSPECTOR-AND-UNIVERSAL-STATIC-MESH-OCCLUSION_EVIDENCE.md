# Century — QA del Inspector múltiple y oclusión geométrica

**Gate:** `CENTURY-EDITOR-S01-G001-MULTI-INSPECTOR-AND-UNIVERSAL-STATIC-MESH-OCCLUSION`  
**SOURCE_BASELINE:** archivo ZIP adjunto por el usuario (3.208 archivos, integridad CRC correcta).

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| Tests de Inspector/transacciones y parches geométricos | **20/20 PASS** | `century_multi_occlusion_final_node.log` |
| Compatibilidad de plegado del Inspector | **17/17 PASS** | `century_multi_occlusion_final_node.log` |
| Suite Node sin dependencias externas | **37/37 PASS** | `century_multi_occlusion_final_node.log` |
| Suite completa con cámara y Three.js | **37/38**; caso bloqueado por falta de `three` | `century_multi_occlusion_full_qa.log` |
| Plegado en el baseline previo | **17/17 PASS** | `century_multi_occlusion_baseline_folding.log` |
| Smoke original y modificado | **29/30 PASS ambos** (TOOL-08 preexistente) | `century_multi_occlusion_baseline_smoke.log`, `century_multi_occlusion_smoke.log` |
| Sintaxis de JS modificado | PASS | `node --check` |
| Compilación Editor/Player | **NO COMPILADO**: `vite: not found` | `century_multi_occlusion_build.log` |
| QA en Electron, WebGL2 y Player | **NO VERIFICADO** | Sin evidencia de ejecución |
| QA GPU sobre pared editada/con hueco | **NO VERIFICADO** | Debe probarse en hardware real |
| Undo/Redo integral en UI | **NO VERIFICADO** | Se acreditó un commit por operación en dobles de estado, no un Undo real |

## Pruebas sin dependencias

```bash
node scripts/qa-suite.mjs multi-inspector-static-qa
```

Las pruebas de geometría usan dobles de `Vector3`, `Matrix4` y datos de malla para comprobar la extracción de parches; **no ejecutan Three.js ni el shader GPU real**. Se comprueban mallas indexadas/no indexadas, huecos, triángulos aislados y degenerados, mutación directa de vértices y procesamiento por lotes. No se infiere mejora de FPS.

## Pruebas con dependencias instaladas

```bash
npm ci
node scripts/qa-suite.mjs multi-inspector-universal-occlusion
npm run build
npm run electron
```

Revisar en Electron la multiselección, valores mixtos y Undo/Redo. Hornear una escena con pared modificada mediante Edit Mesh y una abertura; comprobar que ningún objeto visible a través de la abertura desaparezca. Verificar actualización tras cambios de geometría y materiales, y rendimiento de CPU/GPU en el equipo de destino.

Los avisos `setPointerCapture` permanecen expresamente fuera de este Gate por decisión del usuario. El registro aportado también contiene `_scheduleWM is not a function`; no se ha demostrado relación causal con las dos funciones modificadas y no se alteró ese subsistema.

**Estado:** IMPLEMENTADO · NODE QA CONTRATOS PASS · NO COMPILADO · WEBGL2/ELECTRON/PLAYER NO VERIFICADOS · NO APROBADO · NO CERRADO.
