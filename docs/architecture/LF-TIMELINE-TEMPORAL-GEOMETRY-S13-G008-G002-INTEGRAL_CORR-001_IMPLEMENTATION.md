# Implementación — LF-TIMELINE-TEMPORAL-GEOMETRY-S13-G008-G002-INTEGRAL_CORR-001

## Gate y autorización

`Listo. LF-TIMELINE-TEMPORAL-GEOMETRY-S13-G008-G002-INTEGRAL_CORR-001 autoriza comenzar` (2026-11-08).
Parent vinculante: `LF-TIMELINE-TEMPORAL-GEOMETRY-S13-G008-G002-INTEGRAL`. SOURCE_BASELINE: su ZIP íntegro con 2.816 archivos.

## Observado / causa raíz

El log Electron del usuario demostró 42 comprobaciones correctas de 43. La única fallida comparaba el borde izquierdo de `.timeline-marker` contra la coordenada temporal. El CSS original especifica `width:14px` y `translateX(-50%)`, por tanto la coordenada corresponde al centro visual. La aserción tenía un desplazamiento de 7px, sin evidencia de regresión real del modelo o viewport.

## Mecanismo autorizado y aplicado

Se extiende la fixture existente `scripts/fixtures/editor/timeline-temporal-geometry-s13-g008-g002.html`, sin segundo runner ni modificación de producción:

- `markerClipAlignment()` mide el centro del marcador desde `getBoundingClientRect().left + width/2`, el extremo derecho del clip Cámara del segundo 1–3 y la coordenada temporal proyectada por la regla.
- `markerAligned()` exige la igualdad dentro de la tolerancia visual existente (1,1 píxeles).
- Se comprueba esa misma relación tras pasar a zoom 140 y después de mover el desplazamiento horizontal 220 px. Se conservan las 43 comprobaciones, sin desactivar ninguna.
- El `actual` diagnóstico muestra `markerCenter`, `clipEnd`, `projected` y `scrollLeft` cuando falla.
- Nueva prueba Node focal `GEO-CORR001-01..08`: valida CSS auténtico, estructura de medición, geometría con varios zoom/scroll, tres perturbaciones negativas, rechazo de la comparación antigua, conservación de las 43 comprobaciones y sintaxis JS.

No se toca `TimelinePanel.vue`, `model.js`, Player, audio, Cinematics, escenas, recursos ni datos persistentes. No hay archivos eliminados.

## QA y evidencia

- Focal: 32 PASS / 0 FAIL (24 parent + 8 nuevas).
- Comparativa reproducible de los mismos 51 scripts Node: baseline y CORR-001 presentan exactamente 601 PASS / 18 SKIP / 10 FAIL históricos idénticos; no se incluyen estos diez entre los PASS.
- Electron: **NO VERIFICADO** en preparación; runner falla antes del montaje por falta de Vite.
- Build Editor/Player: **NO VERIFICADO** en preparación (`vite: not found`).
- QA local del usuario y aprobación: PENDIENTES.

El usuario debe ejecutar las 43 comprobaciones Electron, build y QA visual. Implementar no significa aprobar ni cerrar.
