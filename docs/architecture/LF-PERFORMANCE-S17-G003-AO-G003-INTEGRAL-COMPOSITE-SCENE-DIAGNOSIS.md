# LevelForge — S17 / AO-G003 — Diagnóstico integral de composición y escena

## Autoridad

Gate autorizado literalmente: `Listo. LF-PERFORMANCE-S17-G003-AO-G003-INTEGRAL-COMPOSITE-SCENE-DIAGNOSIS autoriza comenzar`.

SOURCE_BASELINE vinculante: `LF_PERFORMANCE_S17_G003_AO_G002_INTEGRAL_OPTIMIZATION_SOURCE_BASELINE.zip`, 3.330 archivos; contratos CA-001 (fidelidad prioritaria), CA-002 (diagnóstico por exportación opt-in) y Gates AO-G001/G002 preservados. AO-G002 conserva estado de QA local parcial, no se cierra. Este Gate solo instrumenta y audita; no cambia algoritmos ni shaders.

## Hallazgos OBSERVADOS en código

1. `GTAOPass` oficial Three.js 0.186.1, modo Default, hace **dos** dibujados de pantalla completa en salida: `copyMaterial` (copia de readBuffer) y `blendMaterial` (combina AO de `pdRenderTarget`). Fuente original `examples/jsm/postprocessing/GTAOPass.js`, `render()` y `_renderPass()`.
2. `LookPipeline._names` mide el `RenderPass` como `Escena`, y el addon GTAO como `AO`. `Viewport` ya mide `Sombras` durante `shadowMap.render`. Las consultas GPU son EXCLUSIVAS por sección; no admiten anidamiento.
3. AO-G002 reduce únicamente los targets internos de GTAO a 100/75/50 %. El destino de composición se mantiene a tamaño de compositor. La captura anterior del usuario mostró mejora parcial de tiempo AO sin mejora significativa de FPS. No es un A/B reproducible; orientación de cámara y tiempo de estabilización varían.

## Instrumentación implementada

- `PerfMonitor.wrapAO`: mantiene la serie pública `AO · composición`, desglosando internamente sus dos draws en `AO · copia` y `AO · mezcla`; registra `AO · preparación de salida` únicamente cuando existe coste residual. Los detalles se guardan en `PerfStats.gpuDetails` (NO sumables al total GPU). Cuando la extensión no existe, se conserva `AO · composición` CPU; no se simulan medidas GPU.
- `PerfMonitor.wrapScene`: instrumenta solo **mientras se ejecuta** un `RenderPass` existente, separando `Escena · dibujo`, `Escena · limpieza` y el remanente exclusivo `Escena` (preparación y otros trabajos). Restaura los métodos reales del renderer en `finally` y no intercepta el renderer cuando Stats está cerrado.
- `PerfPanel`: presenta detalles de composición separadamente y sin doble contabilización; etiqueta `Escena` como `Escena · resto` cuando existe un desglose, e informa tamaños de buffer de escena, AO y composición y retraso en fotogramas de los resultados GPU.
- No se ha creado segundo profiler, compositor, shader, WebGL context ni ruta de Player. No hay flags persistentes, cambios de FPS objetivo, materiales o muestras (16+16).

## Tratamiento de datos

- **GPU · pasadas** suma exclusivamente las entradas de `stats.gpu` salvo `AO · total`, que es derivada. `stats.gpuDetails` representa valores ya contenidos en `AO · composición`.
- La serie `Escena` pasa a ser coste EXCLUSIVO de dibujo y limpieza cuando el desglosador está activo; no debe confundirse con el coste de todo el fotograma. `Sombras` se presenta por separado; algunas sombras pueden aparecer en otros renders, por tanto no se declara un total «Escena + Sombras» universal.
- `EXT_disjoint_timer_query_webgl2` devuelve resultados diferidos; se presenta `gpuLatencyFrames`. Un resultado `GPU_DISJOINT_EXT` invalida las muestras pendientes, como ya hacía AO-G001.
- Las capturas puntuales antiguas (AO composición 11,2ms y Escena ≈50ms) son evidencia de sospecha, no promedios ni CAUSA RAÍZ verificada.

## Prohibiciones y próximos pasos

No modificar la composición, reducir calidad ni alterar GTAO/RenderPass por suposiciones. Medir 100/75/50/OFF en el mismo encuadre, editor y AppImage opt-in, tres corridas comparables; verificar especialmente si `AO · copia`, `AO · mezcla`, `Escena · dibujo` o `Escena · limpieza` concentran el coste y si los timers producen falsos retrasos. Las decisiones de optimización deberán proponerse bajo otro Gate o corrección autorizada si el nuevo instrumento falla.

## Estado

IMPLEMENTADO + 11/11 nuevos PASS + 65/65 focal PASS; compilación Vite/GLSL y QA GPU/visual/AppImage del nuevo Gate NO VERIFICADOS. NO APROBADO; NO CERRADO.
