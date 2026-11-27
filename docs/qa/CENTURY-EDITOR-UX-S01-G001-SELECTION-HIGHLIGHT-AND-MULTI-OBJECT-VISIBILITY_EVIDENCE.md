# Evidencia — resalte visible de selección simple y múltiple

**Gate:** `CENTURY-EDITOR-UX-S01-G001-SELECTION-HIGHLIGHT-AND-MULTI-OBJECT-VISIBILITY`

**Origen:** SOURCE_BASELINE aprobado `CENTURY-EDITOR-S01-G001-CORR-001-OCCLUSION-BAKE-BOUNDS-INTEGRITY_SOURCE_BASELINE.zip` (3.233 archivos). No se han aplicado migraciones ni cambios a datos persistidos.

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| 15 pruebas nuevas de indicadores, limpieza, preferencias y modos | **15/15 PASS** | `selection_unit_final.log` |
| Selección, transformaciones y UX editorial | **70/70 PASS** | `selection_core_qa.log` |
| Viewmodes y gizmos | **39/39 PASS** | `viewmode_suite.log` |
| Inspector de multiselección | **37/37 PASS** | `inspector_suite.log` |
| Oclusión | **47/47 PASS** | `occlusion_suite.log` |
| Batería ampliada con OutlinePass histórico | **67 PASS, 3 FAIL preexistentes, 1 SKIP** | `selection_suite.log` |
| Mismos tests históricos sobre baseline | **52 PASS, los mismos 3 FAIL, 1 SKIP** | `selection_suite_baseline.log` |
| Smoke del Editor | **29 PASS / 1 FAIL**, igual al baseline | `work_smoke.log`, `baseline_smoke.log` |
| Sintaxis JS y catálogo de QA | PASS | verificaciones Node |
| Compilación con Vite | **NO COMPILADO:** `vite: not found` | `build.log` |
| QA visual Electron y WebGL2 | **NO VERIFICADO** | pendiente |
| Aprobación y cierre del Gate | PENDIENTES | requiere conformidad del usuario |

Los tres fallos históricos de `test-three-s04-g002.mjs` son las verificaciones G002-06, G002-07 y G002-09, cuyas expresiones corresponden a una versión anterior del renderizador. No son regresiones de esta corrección y no se alteraron esas aserciones. El fallo del smoke es `TOOL-08` y también existe en el SOURCE_BASELINE.

Las pruebas Node evalúan la lógica con dobles de Three.js; **no constituyen prueba de funcionamiento de `LineSegments2`/`LineMaterial` en la GPU ni de rendimiento real**. Su impacto de GPU debe comprobarse en una escena de tamaño comparable a la de la captura. No se afirma aumento de FPS.

## Comprobaciones locales necesarias

1. Seleccionar uno y varios nodos desde Jerarquía y clic; comprobar indicador de cada uno en Lit, Unlit, Wireframe y Triangles.
2. Comprobar el color y grosor del activo frente a los secundarios, incluidos objetos parcialmente superpuestos, grupos y nodos sin malla.
3. Cambiar las preferencias Caja/Contorno/Ninguno, color, grosor e intensidad; comprobar actualización inmediata sin alterar materiales.
4. Mover, rotar, escalar y deseleccionar: confirmar actualización y liberación de los indicadores.
5. Entrar en Edit Mesh y Play Mode; no debe mostrarse resaltado de objeto ni en el juego exportado.
6. Revisar consola, consumo GPU y ausencia de conflictos con gizmos o clic sobre Substract.

**Estado:** IMPLEMENTADO · TEST NODE PASS · NO COMPILADO · ELECTRON/WEBGL2 NO VERIFICADOS · NO APROBADO · NO CERRADO.
