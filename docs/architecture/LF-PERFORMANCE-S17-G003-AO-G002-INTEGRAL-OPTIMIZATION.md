# LevelForge S17-G003-AO-G002 — Experimento reversible de optimización GTAO

**Gate autorizado exactamente:** `Listo. LF-PERFORMANCE-S17-G003-AO-G002-INTEGRAL-OPTIMIZATION autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LF_PERFORMANCE_S17_G003_AO_G001_INTEGRAL_COST_DIAGNOSIS_SOURCE_BASELINE.zip`.

**Autoridad:** CA-001 (fidelidad visual) y CA-002 (diagnósticos AppImage únicamente opt-in), arquitectura existente del compositor, documentación AO-G001 y mediciones aportadas por el usuario. El objetivo de este Gate es comparar una optimización experimental, no forzar su activación como valor predeterminado.

## OBSERVADO

- `GTAOPass` oficial Three.js r186.1 aplica G-buffer de normales/profundidad, oclusión, Poisson Denoise y composición. Sus buffers `normalRenderTarget`, `gtaoRenderTarget` y `pdRenderTarget` siguen `pass.setSize(width,height)`. El mismo pase compone sobre el `writeBuffer` del compositor, independiente del tamaño de los buffers internos.
- `LookPipeline` crea GTAO en perfil Alto y AO > 0. La imagen de escena y composición mantiene la resolución de salida (o la resolución interna del compositor dividido). `_updateUniforms()` configura siempre 16 muestras GTAO y 16 muestras denoising. No se modifican.
- El profiler G001 ya envuelve GTAOPass y permite consultar las fases. La grabación del usuario de 2026-11-12 mostró oclusión y denoise como etapas dominantes en una muestra (lecturas puntuales ~37,2 ms y ~16,9 ms respectivamente). Falta comparación controlada de cámara fija y repetida; no supone un benchmark validado.

Fuente oficial de comportamiento del addon: https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js (consulta técnica, no se incorpora código vendor).

## MECANISMO IMPLEMENTADO

- Se reutiliza `PerfMonitor.wrapAO()` y su único objeto `GTAOPass`; se envuelve `pass.setSize(w,h)` para conservar la resolución de entrada completa y dimensionar solo los targets internos en 100 %, 75 % o 50 %. Se mantienen el mismo shader, el G-buffer existente, el mismo denoise y `GTAOPass.OUTPUT.Default`.
- La composición de AO continúa a resolución del compositor, con el filtrado de textura existente del addon (no hay reconstrucción bilateral personalizada). **Al 75 % y 50 % podría haber halos, borrosidad o fugas en los bordes. Son hipótesis de QA, no resultados comprobados.**
- Las escalas son *lineales*: 75 % implica ~56,25 % de píxeles internos y 50 % implica ~25 %. Esto **no demuestra** reducción equivalente de tiempo GPU ni de FPS; el G-buffer, el blending y la sincronización pueden tener costes distintos.
- `PerfPanel.vue` (compartido por Editor y Player con NGME-STATS opt-in) ofrece un selector experimental visible únicamente cuando existe GTAO en el compositor. Cambiarlo reinicia las medias. Cerrar Stats llama `PerfMonitor.enable(false)` y restaura 100 %, incluso al desmontarse el panel.
- Al destruir el compositor, `LookPipeline._dispose()` desvincula su GTAOPass del monitor mediante `forgetAO()`. Tras reconstruirse, el wrapper toma la resolución original y el modo actual sin referencias al pase destruido.
- No hay preferencias guardadas, cambios de Database, formatos, exportación ni configuración de calidad predeterminada; la capacidad se limita a diagnósticos visibles. En AppImage normal Stats/selector siguen inaccesibles por CA-002.

## PRERREQUISITOS Y RESTRICCIONES

El addon usa métodos internos envueltos para G001 y aquí `setSize` del pase. Cualquier actualización de Three.js requiere reevaluar la compatibilidad. El benchmark debe partir siempre del mismo SOURCE_BASELINE, con el mismo renderer, contenido, resolución física, equipo, cámara y energía.

**No realizado:** sustitución de GTAO, lectura directa del depth buffer de escena (el paso actual contiene profundidad pero no un normal G-buffer equivalente), shader bilateral, historia temporal, reducción de samples, alteraciones de iluminación, optimización automática de AO en los proyectos. Eso requerirá validación o nuevo Gate.

## RESULTADOS Y ESTADOS

- IMPLEMENTADO en fuentes, test nuevo 12/12 PASS, regresión focal 54/54 PASS.
- `npm run build` NO VERIFICADO: `vite: not found` en este entorno sin dependencias instaladas. No se ejecutó WebGL2 real, Electron ni AppImage.
- Rendimiento y equivalencia visual en Intel UHD 605: **NO VERIFICADOS**. El modo 100 % permanece como comportamiento predeterminado hasta QA local, decisión explícita del usuario y actualización del ledger.
- **Gate NO APROBADO, NO CERRADO.**
