# QA — Composición mixta de recortes

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-CORR-001-MIXED-SUBTRACT-COMPOSITION`

## Casos focales

- `node --test scripts/test-mixed-subtract-composition.mjs`: **9/9 PASS**.
- El caso `MIX-05` fallaba antes del cambio al reordenar Substract y Mesh Substract: generaba geometría nueva y recortaba de nuevo sin alteración de forma. Tras el cambio, el caso pasa y conserva exactamente las referencias de la geometría y las paredes CSG.
- Casos adicionales: un receptor real de escalera con cavidad y puerta; recortes invertidos; retirar, desactivar y reactivar cortadores; mover la puerta; editar la malla fuente; no mutar fuentes y mantener material del receptor.

## Regresiones comparadas

Se ejecutaron once suites de pruebas relacionadas con CSG, Edit Mesh, selección, ciclo de vida, TriMesh y Timeline, incluyendo la nueva suite focal.

| Base | Pruebas | PASS | FAIL |
|---|---:|---:|---:|
| SOURCE_BASELINE sin corrección, diez suites históricas | 151 | 142 | 9 |
| Con corrección y nueve tests focales nuevos | 160 | 151 | 9 |

Los nueve fallos del conjunto ampliado son los mismos, por nombre, que los presentes en SOURCE_BASELINE: `FOV-03`, `FOV-05`, `SN-17`, `TM-08`, `S009-05`, `S009-06`, `S009-07`, `S009-08` y el caso de duplicación de `StaticBody3D`. La corrección no agregó fallos a estas suites. Los resultados completos quedan en los logs de evidencia.

## Build y QA local

- `npm run build` → **EXIT 127**, `sh: 1: vite: not found`. No se ejecutó la compilación.
- Electron, selección visual, mallas reales del proyecto, Player, Jolt y colisiones: **NO VERIFICADO**.
- Sin aprobación explícita del usuario ni Gate cerrado.
