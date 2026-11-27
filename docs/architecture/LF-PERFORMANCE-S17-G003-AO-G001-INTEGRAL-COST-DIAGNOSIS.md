# LevelForge S17-G003-AO-G001 · Instrumentación de coste GTAO

**Gate:** `LF-PERFORMANCE-S17-G003-AO-G001-INTEGRAL-COST-DIAGNOSIS`.

**Autorización exacta:** `Listo. LF-PERFORMANCE-S17-G003-AO-G001-INTEGRAL-COST-DIAGNOSIS autoriza comenzar` (12 de noviembre de 2026).

**SOURCE_BASELINE único:** `LF_PERFORMANCE_S17_G003_INTEGRAL_AO_AND_DIAGNOSTICS_SOURCE_BASELINE.zip` (3.312 entradas, integridad CRC PASS). Regla contractual: no modificar imagen ni introducir un segundo renderer/profiler. Se respetan CA-001 visual-fidelity-first y CA-002 diagnósticos AppImage opt-in.

## OBSERVADO — flujo existente y límite de la evidencia

1. `src/engine/runtime/render/look.js`: `LookPipeline` añade `GTAOPass` de Three.js r186.1 en dos configuraciones de composer. `updateGtaoMaterial({samples:16})` y `updatePdMaterial({samples:16})` conservados.
2. `src/engine/runtime/render/perf.js`: `PerfMonitor` ya mide cada pase mediante `GpuTimer`, que soporta `EXT_disjoint_timer_query_webgl2` y anidación lógica pausando consultas exteriores. No soporta consultas GPU realmente anidadas.
3. Fuente upstream oficial `https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js` — `render()` ejecuta G-buffer opcional mediante `_renderOverride()`, oclusión, Poisson Denoise y composición mediante `_renderPass()`. Estos métodos son **internos del addon**, no una API pública garantizada por Three.js.
4. Capturas del usuario (S17-G003): AO 28,7 ms / GPU informada 58,7 ms / 16 FPS; grabación posterior: AO ~30,9 ms mirando terreno y ~7,2 ms mirando cielo. **No son A/B con cámara fija**. Ninguna captura demuestra por sí sola el responsable exacto.
5. El panel `PerfPanel.vue` anterior sumaba el coste de pases cronometrados; su «GPU total» no es tiempo ocupado de todo el frame ni incluye absolutamente toda la actividad de GPU.

## MECANISMO autorizado implementado

- `PerfMonitor.wrapAO(pass)` envuelve exclusivamente las funciones existentes `_renderOverride` y `_renderPass` de la instancia de `GTAOPass`. Se instala desde `LookPipeline._names` tras `wrapPass`. El render, materiales, targets, samples, shaders, output y blend no se alteran.
- Los cronómetros internos se activan **solo cuando se muestra Stats**; los wrappers no crean consultas GPU estando desactivados. Cuando Three.js cambia los métodos internos o no están disponibles, `wrapAO` no fuerza un fallback invasivo: se conserva AO total por `wrapPass` y queda pendiente desglose por fases.
- Etapas: `AO · G-buffer` (normales + profundidad, si GTAO la renderiza), `AO · oclusión`, `AO · denoise`, `AO · composición` (puede incluir dos draw calls para diffuse y blend). La sección `AO` exterior mide GPU restante exclusivo, incluyendo trabajo no etiquetado. AO total calculado = AO restante + las cuatro etapas que estén presentes.
- `GpuTimer.sinkFrame`: publica únicamente cuando finaliza el conjunto de consultas correspondientes al mismo fotograma. `PerfMonitor` añade a ese conjunto una métrica **derivada** `AO · total`; no mide un quinto render de AO. `PerfStats.gpuFrame` registra cero para fases que dejan de ejecutarse, evitando que el AO de un frame anterior contamine comparaciones AO ON/OFF. La GPU disjoint invalida las consultas pendientes y resultados parciales; el cierre de Stats cancela queries aún pendientes.
- `PerfPanel.vue`: muestra `AO · total` y subfases; distingue tiempos CPU (anidados/inclusivos) de los GPU exclusivos y denomina el agregado `GPU · pasadas`. Excluye `AO · total` de esa suma para no duplicar el coste. El panel admite desplazamiento vertical si crecen las entradas.
- La instrumentación funciona en Editor y AppImage **solo cuando NGME-STATS haya sido habilitado al exportar**, sin cambiar seguridad F12/CA-002 ni configuración autoral.

## CONTRATO DE MEDICIÓN

- Los tiempos de AO por fase provienen de *GPU elapsed time queries*, medidos de manera diferida. Puede haber overhead adicional en la propia instrumentación: no usar una ejecución con múltiples timers como única medición del rendimiento real sin el perfil apagado.
- Si la extensión GPU no está disponible, solo se muestran tiempos CPU por etapa, **no equivalentes** a GPU ni FPS. CPU `AO` es inclusive; GPU `AO` es residual exclusivo cuando hay fases.
- Cuando cambie AO ON/OFF (reconstrucción de composer), reiniciar medias desde Stats y esperar el calentamiento. Una serie de ceros proviene de fases inactivas; comprobar también `AO · total`, que puede bajar progresivamente de media hasta cero.
- Resolución física, perfil, render scale, geometría visible, cámara, energía eléctrica y calentamiento deben ser idénticos. Las fases de GTAO no tienen aún un coste GPU real certificado en Pentium N5030 / UHD 605.

## INFERENCIAS / CAUSA RAÍZ

- **Inferencia razonable:** coste por píxel de GTAO y denoising, junto con redibujado geométrico G-buffer, explican potencialmente gran parte de las diferencias entre cielo y terreno. 
- **Causa raíz exacta de los 30,9 ms:** **NO VERIFICADA** hasta recibir datos locales por etapa y A/B/C. Este Gate prepara un diagnóstico medible; no afirma optimización GPU ni que determinada etapa represente ya un porcentaje del coste.

## PRERREQUISITOS, LÍMITES Y CONTINUIDAD

Este Gate no autoriza reutilizar profundidad, reemplazar GTAO, reducir samples, modificar postprocesado ni habilitar diagnósticos por defecto. El futuro Gate de optimización de AO deberá justificarse con la matriz QA de `docs/qa/LF-PERFORMANCE-S17-G003-AO-G001_QA-LOCAL.md`. Actualizaciones de Three.js requieren volver a comprobar la firma y el comportamiento de los métodos internos antes de reutilizar este wrapper.

**Estado:** IMPLEMENTADO EN FUENTES; TEST NODE PASS; COMPILACIÓN/WEBGL2/QA LOCAL NO VERIFICADOS; NO APROBADO; NO CERRADO.
