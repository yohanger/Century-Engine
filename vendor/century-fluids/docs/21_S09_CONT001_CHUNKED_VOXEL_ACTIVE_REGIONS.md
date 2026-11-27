# S09-G001 CONT-001 — Chunks/voxels y actualización regional

**Gate literal autorizado:** `CENTURY-FLUIDS-S09-G001-CONT-001-CHUNKED-VOXEL-ACTIVE-REGIONS` (20-11-2026).
**Autoridad aplicable:** CF-CA-002, CF-CA-003, CF-CA-004 RATIFICADOS; S07 APROBADO; S09 CORR-001 APROBADO.
**Advertencia contractual:** `CF-CA-005 — CHUNKED SPATIAL AUTHORITY AND VOXEL MASS REPRESENTATION` fue PROPUESTO, pero el usuario **NO ratificó el Amendment con una declaración separada**. La autorización del Gate no equivale a ratificarlo. Solo se ejecuta el subconjunto compatible con los contratos vigentes, sin cambiar el modelo físico autoritativo ni eliminar la API histórica aprobada.
**S08:** EN PAUSA. **S09 principal:** abierto.

## Fuente auditada y alcance

`CENTURY_FLUIDS_S09_G001_CORR001_BOUNDARY_PENETRATION_STABILITY_SOURCE_BASELINE.zip` se conserva como anterior baseline. Las modificaciones son incrementales sobre ese proyecto; no se utilizan fuentes Century, ni se crean juegos/productos/usuarios ficticios.

**Observado en baseline:** `SpatialHash3D` tenía una rejilla de consultas, el solver construía un hash transitorio de parejas por subpaso, y `SpatialFrameIndex` tenía otro hash para superficie. `extractSurface` mallaba toda la AABB de partículas. `FluidWorld.step()` aplicaba gravedad, presión y colisiones globalmente. S09 CORR-001 estableció 64 pasadas de contacto con salida anticipada para suelo/esfera. La evidencia del usuario confirmó `S09_BROWSER_READY` y Jolt WASM real, y aprobó CORR-001; no acreditó el rendimiento de este CONT.

## Implementación compatible

1. `src/chunks.ts`: `ChunkVoxelIndex`, una organización espacial dispersa de celdas de soporte agrupadas en chunks (8³ celdas por defecto). Cada voxel expone **ocupación y suma derivada de masa**; **ParticleStore continúa siendo la única autoridad del estado físico**. No existe segundo solver, segundo reloj ni estado de masa editable. Se validan coordenadas y masas. Se usa el mismo algoritmo de vecindad para parejas del solver, muestreo del campo y consultas `SpatialHash3D` existentes. `SpatialHash3D` mantiene el nombre público S02 como fachada de continuidad; ya no implementa un hash alterno.
2. `src/world.ts`: `chunkMassSnapshot(voxelSizeMeters,cellsPerChunk)` obtiene datos independientes derivados del frame actual, sin publicar los buffers físicos ni cambiar la API S02.
3. `src/surface/mesh.ts`: extracción geométrica por **regiones de celdas alineadas**, conservando el campo y las normales sobre una frontera compartida (no mallas volumétricas ficticias).
4. `src/surface/chunked.ts`: `ChunkedSurfaceCache` detecta cambios por ID/posición/masa; sólo reconstruye chunks cuyo soporte geométrico cambió y reutiliza los demás. Los vecinos reciben el mismo campo de partículas en los bordes. La velocidad sola no invalida una superficie geométrica; la calidad nueva invalida la caché completa. Límites de triángulos/memoria y fallos de extracción reinician la caché derivada para impedir estados parciales.
5. `playground/`: consume la API subpath `@century/fluids/surface`, transmite únicamente los deltas de malla y reutiliza los objetos Three.js de chunks intactos. La cámara, el solver, el reloj y el Jolt host siguen independientes. Diagnósticos nuevos muestran chunks de malla, reconstruidos y reutilizados.

## Validaciones y mediciones

- Regresión de APIs y física S01–S09, prueba de pares vs oráculo bruto (incluyendo cruces y coordenadas negativas), masa global/por voxels, malla en bordes (vértices/normales), retirada de partículas, actualización local, invalidación por configuración, no duplicación de autoridad.
- A/B CPU no gating: dos masas separadas, 250 partículas. Un cambio local regenera 2 chunks y reutiliza 14. Ejecuciones de autoría: full 42–51 ms, incremental 9–16 ms, speedup ~3.2–4.9× para esa escena y máquina. La ganancia medida es **solamente del mallado de una perturbación local** y no representa FPS, memoria GPU ni coste del solver.
- Vite y Jolt WASM **post-CONT no probados visualmente en este entorno**. El consumidor publicado se verifica vía tarball JS/TS; el arranque de Brave/Jolt previo al CONT no valida este cambio.

## Límites y contradicciones pendientes

- `simulateLiquid` conserva presión y fuerzas **globales**; cada subpaso todavía construye un índice de vecinos del frame porque la posición física cambia. El coste de presión y las copias de frame **no se actualizan sólo por chunks**. Este CONT **NO COMPLETA** todavía el reposo/despertar ni una simulación enteramente regional; sería falso afirmarlo.
- Omitir la presión de un chunk quieto sólo por velocidad pequeña puede romper la incomprensibilidad, la continuidad entre chunks y el acoplamiento Jolt. Antes de acelerar el solver por regiones se necesitan criterios físicos de desactivación y propagación y experimentos A/B contra el baseline. Además debe ratificarse cualquier modificación que contradiga los contratos vigentes (CF-CA-005 sigue pendiente).
- El volumen firmado de una malla **individual abierta** en un borde de chunk no se puede interpretar como volumen conservado; la masa física sigue gobernada por partículas. Las pruebas de volumen S07 siguen aplicando a la extracción completa.
- Se mantienen S00–S10, 11 Gates principales G001; S08 EN PAUSA, S10 condicionado; no hay migraciones ni integración Century.

## QA local obligatorio antes de aceptación

Desde la raíz, tras aplicar el CHANGE a S09 CORR-001:

```bash
npm ci
python3 qa/verify_s09_cont001.py --project .
python3 qa/verify_s09_cont001.py --project . --jolt --browser-build
npm run playground
```

Si Jolt real no está instalado para Node, usar el comando existente del README para `tests/jolt-real`; `--jolt` falla explícitamente si falta. En Brave comprobar cuatro escenas, cambios de calidad, movimiento de partículas entre chunks, malla sin cortes, deltas de chunks y resistencia de contactos, además de registrar FPS, RSS y CPU por separado. Solo se declarará QA GUI PASS tras evidencia local. No aprobar ni cerrar S09 completo por los tests de autoría.

## Comparación preliminar del núcleo con CORR-001 (mismo entorno, no gating)

En Node v22.16.0, sobre la misma máquina de autoría y las mismas entradas, una ejecución de los benchmarks históricos registró:

| Métrica | CORR-001 | CONT-001 | Interpretación |
| --- | ---: | ---: | --- |
| S02 — consultas indexadas, 12.000 partículas/150 consultas | 17,025 ms | 18,219 ms | +7 %; **no demuestra mejora** de consultas |
| S03 — solver, 216 partículas/8 frames | 103,262 ms | 71,362 ms | variación favorable en una ejecución, **no significativa** sin repeticiones |
| S04 — contornos, 216 partículas/8 frames | 87,443 ms | 88,969 ms | +2 %; diferencia pequeña, sin mejora demostrada |

Los resultados de masa, contactos y densidad final coinciden en ambos runs. No se interpreta esta muestra como mejora del solver ni garantía de escalabilidad. La mejora reproducida con A/B local corresponde a **malla incremental**; la presión global y la activación por chunks continúan abiertas.
