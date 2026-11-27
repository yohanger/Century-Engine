# Century Engine — Escalera: acceso a Escalones en Inspector

**Gate:** `CENTURY-EDITOR-STAIRS-S01-G001-STEP-COUNT-INSPECTOR-CORRECTION`  
**Autorización:** «Listo. CENTURY-EDITOR-STAIRS-S01-G001-STEP-COUNT-INSPECTOR-CORRECTION autoriza comenzar» (2026-11-21).  
**Fuente:** `CENTURY-EDITOR-PLAYER-S01-G001-DATABASE-SCENE-VISUAL-PARITY_SOURCE_BASELINE.zip`.  
**Estado:** IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA LOCAL NO VERIFICADO · NO APROBADO · NO CERRADO.

## Auditoría

- La primitiva `stairs` ya contenía `props.steps` (ocho por defecto) y un campo `Escalones` de 2–64 en `Inspector.vue`.
- `src/engine/runtime/geometry/primitives.js` y `src/engine/runtime/mesh/generators.js` ya utilizaban el recuento. `updateObject()` y la firma de los nodos reconstruían la geometría al editar `props.steps`.
- El control aparecía al final de secciones generales (cortes, prefab, scripts, materiales e iluminación), fuera de la zona inicial visible del Inspector en disposiciones habituales. El filtro encontraba una etiqueta coincidente, pero una sección plegada seguía ocultando su cuerpo mediante CSS.
- La captura suministrada solo muestra el viewport: no permite confirmar si el campo estaba oculto por plegado, scroll o diferencias en la instalación local. No existe un ZIP adicional de modificaciones locales; se utilizó la fuente vigente suministrada como último SOURCE_BASELINE.

## Cambio aplicado

1. Se reubicó la sección existente `Escalera` inmediatamente después de `Transformación` para las primitivas con `kind === 'stairs'`.
2. El filtro de búsqueda presenta temporalmente los cuerpos de las secciones coincidentes, aunque estuvieran plegadas. Al limpiar la búsqueda mantiene las preferencias originales de plegado. `aria-expanded` representa el estado mostrado.
3. Se conservan el único NumberField, `props.steps`, el generador, `scale` XYZ, el material, la edición y los formatos de guardado; no se introduce otro sistema.
4. Se añadió `scripts/test-stairs-inspector-access.mjs` y el grupo reproducible `editor-stairs` en `scripts/qa-suites.json`. No se añadieron comentarios históricos en código, tests ni configuración.

## Evidencia automatizada

Desde la raíz del proyecto:

| Ejecución | Resultado | Evidencia |
|---|---|---|
| Baseline: seis suites existentes de Escalera/Inspector | 121 PASS, 0 FAIL | `baseline-targeted.log` |
| `node scripts/qa-suite.mjs editor-stairs` | **128 PASS, 0 FAIL** (7 pruebas nuevas incluidas) | `editor-stairs-runner.log` |
| 8 suites de Escalera + Inspector + Terrain Folding | 143 PASS, 4 FAIL | `inspector-regression.log` |
| Terrain Folding sobre baseline original | 15 PASS, 4 FAIL (mismos 4 fallos) | `baseline-terrain-folding.log` |
| Regresión amplia del Inspector | 56 PASS, 9 FAIL | `inspector-broad.log` |
| Regresión amplia del Inspector sobre baseline original | 56 PASS, 9 FAIL idénticos | `baseline-inspector-broad.log` |
| `node scripts/qa-suite.mjs smoke` | 29 PASS, 1 FAIL (TOOL-08) | `smoke.log` |
| Smoke sobre baseline original | 29 PASS, 1 FAIL (TOOL-08) | `baseline-smoke.log` |
| `npm run build` | NO COMPILADO, exit 127: `vite: not found` | `build.log` |

La comparación con el baseline acredita que los fallos anteriores no son regresiones introducidas por este Gate; no equivale a aprobarlos. No se ejecutó Electron por falta de dependencias instaladas. El archivo entregado no incluye `node_modules`.

## QA local pendiente

1. En una copia aislada con dependencias instaladas, compilar y abrir el Editor con Electron.
2. Añadir una primitiva Escalera, seleccionarla y comprobar que el campo `Escalones` aparece inmediatamente después de la sección Transformación.
3. Cambiar entre 2, 8, 20 y 64; comprobar geometría y medidas XYZ. Guardar, cerrar y reabrir.
4. Plegar Escalera, buscar `escalones`, confirmar que el valor aparece; limpiar la búsqueda y confirmar que vuelve a estar plegada.
5. Repetir con Escalera recta/curva, laterales, selección múltiple, Edit Mesh y Play para descartar efectos colaterales.
6. Si existe una versión local con cambios no incorporados al SOURCE_BASELINE, contrastar antes de aplicar el CHANGE ZIP.

**Criterio de cierre:** compilación, QA local y aprobación explícita del usuario pendientes. Sin Git ni publicación remota.
