# Evidencia de QA — Vinculación padre/CSG

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-CORR-002-PARENT-BOUND-SUBTRACT-AND-WORLD-SPACE-ALIGNMENT`

## Pruebas ejecutadas

- Suite focal: `node --test scripts/test-parent-bound-subtract-matrices.mjs scripts/test-mixed-subtract-composition.mjs scripts/test-mesh-subtract-hollow-geometry.mjs` → **32/32 PASS**.
- Escalera con dos cortadores hijos y receptor vecino solapado: PASS, solo se modifica la escalera padre.
- Cortador global sobre dos receptores: PASS, sin cambio funcional.
- Escalera desplazada, fuente hijo y ambos cortadores hijos: PASS, sin doble desplazamiento.
- Cambio de posición del padre con geometría relativa constante: PASS, sin regeneración geométrica innecesaria.
- Reparentado, receptor más cercano y coexistencia de ambos cortes: PASS.
- Alineación matemática de fuente, volumen visible y CSG con el padre girado a 0°, 90°, 180° y 270°: PASS en dobles geométricos.
- Sintaxis JavaScript de los archivos afectados: PASS.

## Comparación de regresión

**Comando:** 11 suites Node de CSG, jerarquía, mallas, instancias, Timeline, Snapping y colisiones.

- SOURCE_BASELINE original: **179/196 PASS**, **17 fallos**.
- Fuente modificada: **185/202 PASS**, **17 fallos**, los mismos casos nominales del baseline.
- Los fallos heredados se concentran en casos históricos de FOV, migración antigua de `csg`, atajos del menú Añadir y un conjunto de pruebas temporales S009. No se atribuyen ni se corrigen dentro de este Gate.

## Límites y estados

- `npm run build`: **BLOQUEADO** (`vite: not found`, dependencias sin instalar).
- QA visual en Electron: **NO VERIFICADO**.
- Colisión real Jolt/Player: **NO VERIFICADO**.
- QA de compilación/Player: **NO VERIFICADO**.
- Aprobación del usuario: **PENDIENTE**. Gate: **ABIERTO**.

La evidencia automatizada no acredita la apariencia visual ni la integración física del caso capturado por el usuario.

## Logs conservados

Carpeta: `docs/qa/evidence/CENTURY-EDITOR-MESH-S02-G001-CORR-002-PARENT-BOUND-SUBTRACT-AND-WORLD-SPACE-ALIGNMENT/`

- `focused.log`: 32/32 PASS.
- `regression-baseline.log`: 179/196 PASS; 17 fallos.
- `regression-current.log`: 185/202 PASS; los mismos 17 casos fallidos.
- `syntax.log`: verificación de sintaxis de los archivos JavaScript afectados.
- `build.log`: compilación bloqueada por ausencia de Vite.
