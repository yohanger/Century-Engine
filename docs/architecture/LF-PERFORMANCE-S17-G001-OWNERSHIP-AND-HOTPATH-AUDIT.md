# LF-PERFORMANCE-S17-G001 — Propietarios y puntos de coste (auditoría, no optimización)

**Fuente de verdad:** SOURCE_BASELINE `LF_S13_S15_S16_INTEGRAL_CLOSURE_G001_SOURCE_BASELINE.zip` (3.280 rutas, CRC OK). Fecha: 2026-11-12. Gate autorizado: `LF-PERFORMANCE-S17-G001-INTEGRAL-BASELINE-AUDIT`. **No se modifica runtime**.

## Hallazgos OBSERVADOS y propietarios

| ID | Propietario original | Evidencia de código | Lo que demuestra | Lo que NO demuestra |
|---|---|---|---|---|
| PERF-01 | `render/perf.js` (`PerfStats`, `GpuTimer`, `PerfMonitor`) | Ventana 120 muestras, media/p50/p95, `EXT_disjoint_timer_query_webgl2`, contadores | Instrumentación por pasada, opcional; prueba Node de contrato | GPU medida sin extensión; carga real de Jolt/JS |
| PERF-02 | `components/PerfPanel.vue` / `core/commands.js` | F3, encuesta de snapshot cada 400 ms, activar/desactivar `perf` | Panel existente; se reutiliza | Gráfica/histórico de toda la sesión: ventana actual ≈120 renderizados |
| PERF-03 | `render/viewport.js` | `requestAnimationFrame`, `step`, `_render`, `perf.frameStart/end` alrededor de `look.render` | El p95 se deriva de intervalos de dibujos y «CPU · dibujar» de `look.render` | CPU TOTAL del ciclo: `_sceneFrame`, PlayMode, física, scripts y parte de `_render` fuera del intervalo |
| PERF-04 | `events/play-controls.js` | `frame(dt)`, `physicsStep(this.g)`, acumulador, `_simStep` | Física de paso fijo existente | Que física sea o no cuello de botella en una escena |
| PERF-05 | `render/lodmgr.js` y `render/lod.js` | `LodManager.update`, terreno, mallas y follaje, umbrales por cámara | LOD y descarte implementados; limitación de reconstrucción de geometría | Que sea beneficioso en todas las escenas |
| PERF-06 | `render/static-batch.js` y `render/config.js` | `StaticBatcher`, `batchStatic: false`, `props.batchStatic === true`, material/malla compatibles | Batching opt-in para decoración compatible | Eficacia neta, memoria o draw calls medidos en hardware real |
| PERF-07 | `render/look.js`, `render/viewport.js`, `render/config.js` | Escala interna, `setPixelRatio` limitado a 1,75, perfiles alto/medio/bajo | Controles de resolución/render existentes | GPU-bound vs CPU-bound sin perfil real |
| PERF-08 | `render/viewport.js::_casterSig()` | `scene.traverse` al invalidar sombras durante Play, comprobación espaciada ~250 ms | Posible trabajo proporcional a mallas que proyectan sombra | Un problema real de rendimiento sin perfil y escena concreta |
| PERF-09 | `vfx/simulation.js` y benchmark S00 | Simulación CPU separada y acotada; harness `bench-vfx-renderer-consolidation-s00-g001.mjs` | Se puede caracterizar costo aislado | FPS/render GPU; no mezcla cargas reales del juego |
| PERF-10 | `engine/runtime/package/game.js` y `electron/player/main.cjs` | Player independiente comparte `SceneGraph`/`PlayMode`; DevTools desactivado en export | Ruta exportada existe | Paridad de rendimiento o frames medidos aquí |
| PERF-11 | `electron/main.cjs` | Electron local abre DevTools mediante F12 / Ctrl+Shift+I en entorno permitido | Se puede obtener Performance/CPU profile local sin navegador externo | Que se haya ejecutado el profiler en la PC del usuario |

## Distinciones de diagnóstico

- **OBSERVADO:** llamadas a `_casterSig()`, conversiones de LOD, passes de GPU y simulación física existen. 
- **INFERENCIA:** son candidatos a medir en escenas pobladas, no defectos confirmados. **CAUSA RAÍZ de cualquier caída de FPS: NO DETERMINADA**.
- La pantalla F3 no mide el tiempo CPU total y su p95 es de la ventana actual de los últimos 120 fotogramas renderizados; no debe tratarse como p95 de toda una sesión sin captura adicional.
- Los contadores `renderer.info.memory` representan recursos contabilizados por Three.js, **no** memoria total del proceso, VRAM real ni presupuesto de 4 GB.
- Medir con F3 abierto introduce una carga de instrumentación que se debe mantener idéntica en baseline y candidato. El benchmark CPU aislado de VFX no sustituye ninguna medición WebGL/Jolt.
- La compilación actual `npm run build` falla por `vite: not found` en este contenedor sin dependencias; no informa de la ejecución del usuario.

## Autoridad y límites de S17-G001

Contractos S13/S15/S16, JavaScript/Vue/Three.js/Jolt y export existentes permanecen intactos. No autoriza migrar Three.js, reemplazar RenderGraph, alterar calidad visual o introducir un segundo profiler. Solo se añade un test de contrato del profiler y documentación/ledger. El video `LevelForge/videoplayback(3).mp4` consta en Biblioteca, pero su materialización devolvió **sin acceso autorizado a bytes**; no se ha visto su contenido ni se ha extraído técnica alguna. Referencia de Decima: aspiración expresada anteriormente, **no benchmark, tecnología compartida ni garantía**.

## Reglas para próximos Gates

1. **G002 CPU/runtime** únicamente si el perfil del usuario atribuye coste relevante y reproducible a scripts/escena/física; extender propietarios actuales, mantener cadencia/semántica. Sin CPU profile: PENDIENTE, no implementar.
2. **G003 GPU/memoria** únicamente si evidencia muestra render limitado por GPU/draw calls/memoria; probar aislamiento de resolución/efectos, luego comparar LOD/batching existentes. Sin datos WebGL: PENDIENTE.
3. **G004 integración/QA** comparar baseline/candidato en las mismas escenas, cámara, tamaño de ventana, calidad, parámetros Jolt y condiciones térmicas; Editor y Player exportado. No mezclar correcciones de gameplay con rendimiento.
4. La aprobación de G001 no autoriza estos Gates; se hará la declaración exacta tras evidencia. No duplicar scripts de benchmark ya existentes.
