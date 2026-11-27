# Evidencia QA — Gizmos y edición en todos los viewmodes

## Baseline y cambios

SOURCE_BASELINE: `CENTURY-EDITOR-UX-S01-G001-ESCAPE-PROPERTY-FOCUS-RELEASE_SOURCE_BASELINE.zip`. Cambios de código: `src/engine/runtime/render/viewport.js` y `src/engine/runtime/render/look.js`; runner y test propios en `scripts/`; documentos y ledger.

## Resultados obtenidos

| Verificación | Resultado |
| --- | --- |
| Pruebas nuevas sobre el método real `drawEditorOverlay` | 10/10 PASS |
| Runner dirigido (incluye suites previas compatibles) | 39/39 PASS |
| Regresión diagnóstica/viewport histórica combinada, cambio | 59 PASS / 8 FAIL (67 casos) |
| Misma regresión histórica combinada, baseline exacto | 49 PASS / 8 FAIL (57 casos) |
| Diferencia de fallos nominales históricos | 0 nuevos; los ocho fallos coinciden |
| Smoke cambio | 29 PASS / 1 FAIL preexistente |
| Smoke baseline | 29 PASS / 1 FAIL preexistente |
| Comprobación sintaxis JS/JSON | PASS |
| `npm run build` | EXIT 127, `vite: not found` |
| QA visual Electron / manipulación real | NO VERIFICADO |
| Player / exportación | NO VERIFICADO (no modificados) |

Los ocho fallos de regresión histórica corresponden a siete aserciones de controles de viewport/diagnóstico y un runner heredado; se reproducen con los mismos nombres en el SOURCE_BASELINE. La falla de smoke `TOOL-08` también es previa. La batería nueva comprueba estado de escena y renderizador tanto en éxito como al lanzar excepción, destino de render y prioridad de las ayudas.

## Archivos de evidencia

- `docs/qa/evidence/CENTURY-EDITOR-VIEWMODES-S01-G001-CORR-002-GIZMOS-AND-EDITING-PARITY/runner_viewmode_gizmo.log`
- `.../baseline_viewmodes.log` y `.../regression_work.log`
- `.../smoke_work.log` y `.../smoke_baseline.log`
- `.../build.log`

## QA pendiente para aprobación del usuario

En Editor, seleccionar un objeto y cambiar entre Lit, Unlit, Wireframe, Triangles, LOD, Light Complexity, Depth, Normals, Overdraw, Shader Complexity, Clusters e Indirect Lighting. Comprobar selección, Mover, Rotar, Escalar y Edit Mesh, sin alteración de colores o métricas diagnósticas. Repetir con terreno y mostrar/ocultar Gizmos. Validar que los modos no soportados conservan Lit de respaldo. Verificar cambio de vista sin necesidad de regresar a Lit y sin excepciones de renderer.

**Estado:** IMPLEMENTADO; PRUEBAS NODE DIRIGIDAS PASS; NO COMPILADO; QA ELECTRON NO VERIFICADO; NO APROBADO; NO CERRADO.
