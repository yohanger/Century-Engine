# S17-G001 — Acta de auditoría y establecimiento de línea base

**Fecha:** 2026-11-12. **Autorización:** `Listo. LF-PERFORMANCE-S17-G001-INTEGRAL-BASELINE-AUDIT autoriza comenzar`.

**SOURCE_BASELINE inicial:** `LF_S13_S15_S16_INTEGRAL_CLOSURE_G001_SOURCE_BASELINE.zip`, 3.280 archivos, CRC PASS. Ledger de seis hojas preservado. Alcance: observación, harness de verificación del `PerfMonitor` existente, protocolo QA y mediciones CPU aisladas; ninguna modificación de código de producción, escenas, assets ni exportación.

## Dictamen

**OBSERVADO:** LevelForge dispone de F3, PerfStats, timer GPU WebGL2 opcional, LOD, culling y batching opcional (véase `docs/architecture/LF-PERFORMANCE-S17-G001-OWNERSHIP-AND-HOTPATH-AUDIT.md`). Los contadores de Three.js registran llamadas/triángulos/texturas/geometrías; no equivalen a RAM/VRAM. El CPU total del `PlayMode.frame()` no está representado por `CPU · dibujar`. No hay actualmente datos de tiempo de frame capturados en la PC objetivo para una escena fijada.

**INFERENCIA:** podría haber oportunidades en invalidación de sombras, densidad de geometría, render scale, postprocesado, recorridos por escena o número de pasos de física. Se trata de hipótesis, **ninguna es CAUSA RAÍZ demostrada**. No se cambia el renderer ni la física por intuición.

**NO VERIFICADO:** 60 FPS o p95 ≤16,67 ms en Pentium Silver N5030/4 GB; GPU-bound/CPU-bound; consumo RSS real; ejecución/compilación Electron, Jolt WASM y NGM Runtime. No se comparan escenarios hasta que el usuario mida sobre su equipo.

## Evidencia ejecutada EN ESTE CONTENEDOR (Node v22.16.0)

| Verificación | Resultado y limitación | Evidencia |
|---|---|---|
| Test nuevo contrato `PerfStats/PerfMonitor/GpuTimer` | **9 PASS / 0 FAIL**: ventana, p95, pausa, CPU/GPU opcional, habilitación y pasadas | `01-profiler-node.log` |
| Test profiler + render/Three existente | **26 PASS / 0 FAIL / 1 SKIP**; la prueba saltada no verifica WebGL/Three real | `02-render-node.log` |
| Suite de seguridad S16 + GameManager + Templates | **286 PASS / 0 FAIL**; garantiza no regresión Node en la selección, no FPS | `03-s16-regression.log` |
| Benchmark VFX original (`600` pasos por corrida, calentamiento `120`, 5 corridas) | Mediana CPU aislada: capacidad 64 → **1,243 ms**, 256 → **4,819 ms**, 1024 → **18,112 ms** por **600 pasos**; **NO ms/frame** | `04-vfx-cpu-isolated.log` |
| `npm run build` | **NO VERIFICADO: exit 127 `vite: not found`**; no hay node_modules | `05-build-unavailable.log` |
| CPU/GPU de Editor y NGM en equipo usuario | **NO VERIFICADO** | matriz QA para el usuario |
| Video referencia `videoplayback(3).mp4` | Ubicado en Biblioteca/LevelForge; la API rechazó acceso al contenido original | Video NO AUDITADO, pendiente de carga accesible |

El bench VFX se ejecutó en hardware de la sesión, **NO en el Pentium N5030**, por lo que tampoco puede proyectarse al FPS del producto. La variable `droppedBirths` del benchmark es carga sintética, no degradación observada de una escena real.

## Requisitos medibles (criterios, NO resultados)

- **Objetivo de diseño:** 60 FPS en Compatibility para una escena controlada adecuada, sujeta a resultados y calidad aceptable. Umbral de un frame a 60 FPS = 16,67 ms; el promedio por sí solo no alcanza. Anotar p95, máximo/caídas, resolución, ventana y draw calls.
- **CPU vs GPU:** primero comparar mismas escenas con escala de resolución 100% y 75% *sin modificar otros ajustes*; si mejora FPS significativamente, investigar GPU, pero no declararlo causa raíz sin un perfil adicional. No usar la prueba como modificación permanente de calidad.
- **Comparabilidad:** mantener calidad, método de cámara, conteos de nodos, luces, sombras y física idénticos entre baseline y candidato. No comparar dos máquinas distintas.
- **Memoria:** anotar memoria residente (RSS) del proceso y continuidad tras 3 ciclos Abrir/Cerrar Play; el contador de geometrías/texturas es otro indicador, no RAM real.
- **Instrumentación:** conservar F3 activo en ambas mediciones. Como solo conserva 120 frames, recoger varias capturas del intervalo; no llamarlas percentil global de toda la prueba.

## Tareas de medición del usuario y bloqueo

La matriz `docs/qa/LF-PERFORMANCE-S17-G001_QA-LOCAL.md` define 4 escenarios y evidencia exacta. Hasta recibir esas muestras **NO ES VÁLIDO** priorizar cambios en el render ni prometer 60 FPS. S17-G001 **IMPLEMENTADO DOCUMENTAL / TEST NODE PASS / QA LOCAL PENDIENTE / NO CERRADO**. G002–G004 son solo RECOMENDADOS/PENDIENTES PLANIFICADOS.

### Contratos y continuidad

S13, S15 y S16 siguen APROBADOS FUNCIONALMENTE pero con cierres formales sujetos a la conciliación previa; S17 no altera sus estados, no arregla faltas de QA con un benchmark sintético y no realiza refactors no autorizados. El ledger incluye seis hojas sincronizadas y evidencia real, sin expectativas como PASS.
