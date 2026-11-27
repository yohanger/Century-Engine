# Century — Composición mixta de Substract y Mesh Substract

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-CORR-001-MIXED-SUBTRACT-COMPOSITION`

## Código

La implementación anterior ya reunía ambos tipos mediante `isCutter()` y `refreshBrushes()`. La auditoría verificó con BSP real que una escalera conserva la cavidad interior y la abertura de puerta, y que retirar un recorte conserva el otro. No correspondía sustituir CSG ni reescribir el motor.

Se reprodujo una invalidación innecesaria al reordenar ambos nodos en Jerarquía: la lista `hits` se formaba en orden de `project.objects`, cambiando `carveSig` y reconstruyendo toda la malla aun cuando los cortadores no habían cambiado.

Se actualizó exclusivamente `src/engine/runtime/scene/brushes.js`: cuando conviven los dos tipos, los cortadores se ordenan de forma determinista por tipo (`meshSubtract`, luego `subtract`) e ID antes de construir `hits`. Para proyectos de un solo tipo se conserva su orden existente. `carveGeometries()` se mantiene como única autoridad CSG.

## Cobertura añadida

`scripts/test-mixed-subtract-composition.mjs` valida una escalera de ocho peldaños con cavidad y puerta, volumen resultante, paredes interiores, eliminación y activación independiente de cortadores, inversión de orden de Jerarquía, movimiento de Substract, modificación de la fuente de Mesh Substract y conservación de la geometría y del material originales.

## Evidencia y cierre

Consultar el registro `docs/qa/CENTURY-EDITOR-MESH-S02-G001-CORR-001-MIXED-SUBTRACT-COMPOSITION_QA.md`. La prueba focal está en 9/9 PASS; el grupo de regresiones revisado presenta los mismos nueve fallos heredados del SOURCE_BASELINE original. No se acredita compilación, QA visual en Electron, Jolt WASM ni aprobación del usuario. El Gate permanece abierto.
