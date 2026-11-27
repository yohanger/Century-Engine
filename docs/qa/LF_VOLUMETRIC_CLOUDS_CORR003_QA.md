# LF-VOLUMETRIC-CLOUDS-S01-G001-CORR-003 — Calibración de escala natural

**Fecha:** 2026-11-17. **Gate autorizado literalmente:** `Listo. LF-VOLUMETRIC-CLOUDS-S01-G001-CORR-003-NATURAL-SCALE-CALIBRATION autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LF_VOLUMETRIC_CLOUDS_S01_G001_CORR002_ALTITUDE_DISTRIBUTION_AND_PLANETARY_HORIZON_SOURCE_BASELINE.zip` (SHA-256: `fb6fb64cfa8c98e3a55e0a5be5054d9fb58207c56693b864a6ab0bb9957890cf`). Se comparó el estado real con el contrato/QA `docs/qa/LF_VOLUMETRIC_CLOUDS_CORR002_QA.md`. Proyecto pre-1.0, aunque se conserva su versión `0.26.13`. No se modificó GitHub.

## 1. Observaciones, inferencias y decisiones

- **OBSERVADO (usuario):** `CORR-002` exageró **ambos** efectos: la diferencia vertical de nubes y la curvatura aparente del horizonte. No se aportó una captura de cámara/resolución controladas para este Gate.
- **OBSERVADO (código):** `CloudField._altitudeRelief()` aplica un relieve de hasta 0,95 capas para cúmulos y 1,15 para torres. La ruta manual del shader usa `mix(0.08, 0.42, relief)` para variar bases y hasta `0.40+0.50*weather.b` para el espesor. El radio compartido World/sky es de 42 000 m; el shader `planetBackdrop()` mezcla un límite atmosférico y una superficie detrás de las mallas de Terrain.
- **INFERENCIA matemáticamente contrastable:** un radio de 42 km produce una depresión angular del horizonte excesiva a alturas normales (a 3 000 m: 21,0395°). Su reducción de contraste por `limbHaze` tampoco compensa la geometría del fondo. No se ha demostrado cómo aparece en cada GPU real.
- **DECISIÓN DEL GATE:** recalibrar el relieve sin aplanarlo, adoptar un único radio planetario de referencia de **6 371 000 m** para cálculos CPU/GLSL y suavizar limbo/glow. No se falsifica la curvatura en Terrain. Se preservan fórmulas geométricas y un solo renderizador.

## 2. Implementación: EXTEND BEFORE DUPLICATE

| Ruta | Antes (CORR-002) | Ahora (CORR-003) |
|---|---|---|
| `world/cloudfield.js` | `spread` por morfología `[0.40,0.13,0.27,0.95,1.15,0.55,0.16]` | `[0.20,0.09,0.16,0.38,0.52,0.33,0.10]`. Misma semilla, reparto regional/individual, identidades y consultas |
| `render/skylib.js` manual | Amplitud de base estrato/cúmulo `0.08…0.42`; espesor cúmulo `0.40 + 0.50 * weather.b` | `0.05…0.20` y `0.35 + 0.25 * weather.b`; base y top limitados en el mismo `cloudDensity`, con el mismo ruido y marcha |
| `world/cloud-curvature.js` | Radio visual compartido 42 000 m | Radio compartido 6 371 000 m, sin nuevo estado ni parámetros de usuario; se mantienen 28 km de alcance de nubes |
| `render/sky-planet.js` | `limbHaze elevated = 0.61`, límite elevado `airBlend = 0.82`, `glow = 0.18` | `0.79`, `0.90` y `0.10`, respectivamente; conserva antialias por píxel y mezcla atmosférica |
| Runners | Pruebas C002 exigían explícitamente amplitudes ahora supersedidas | Se actualizaron exclusivamente las aserciones de calibración; además se añadió C003, medición A/B y microbenchmark |

No se han añadido cámaras, mallas, shaders paralelos, texturas, buffers 3D, nuevas opciones del Inspector, APIs, migraciones, módulos externos ni cambios en `package.json`. World sigue siendo autoridad meteorológica. La integración de tormentas/tornados, rayos y lluvia sigue usando `CloudField` y el mismo radio.

## 3. Comparación reproducible A/B (seed 42, región de celdas [-32,32]²)

Comando **idéntico** en ambos árboles: `node scripts/measure-cloud-natural-scale-corr003.mjs`.

| Métrica | CORR-002 antes | CORR-003 ahora |
|---|---:|---:|
| Extensión de bases de cúmulos, clima parcial | 668,88 m (2 897 celdas) | 267,55 m (2 897 celdas) |
| Extensión de bases de nimbostratos, lluvia | 112,65 m (4 225 celdas) | 70,41 m (4 225 celdas) |
| Extensión de bases de cumulonimbos, tormenta | 387,24 m (4 225 celdas) | 232,35 m (4 225 celdas) |
| Depresión geométrica a 2 m de altura | 0,5591° | 0,0454° |
| Depresión geométrica a 120 m | 4,3260° | 0,3517° |
| Depresión geométrica a 1 000 m | 12,3808° | 1,0151° |
| Depresión geométrica a 3 000 m | 21,0395° | 1,7580° |
| Caída de una capa de nube a 28 km, base 1 500 m | 10 209,61 m | 61,51 m |

Estas son **medidas matemáticas/modelo**, no comparaciones visuales capturadas de Electron. El radio de 6 371 km no implica convertir LevelForge en un planeta físico ni modificar superficies de juego. Desde el suelo, la curvatura real del horizonte resulta prácticamente imperceptible.

## 4. QA y evidencia ejecutada

| Comando | Resultado observado | Alcance |
|---|---|---|
| `node --test scripts/test-cloud-natural-scale-corr003.mjs scripts/test-cloud-altitude-horizon-corr002.mjs` | **16 PASS / 0 FAIL** | 8 C003 + 8 C002 reajustadas al contrato vigente; sin GPU |
| `node scripts/test-clouds.mjs` | **103 OK / 0 FALLA** | Simulación CloudField, World y morfologías |
| `node scripts/test-atmosphere.mjs` | **31 OK / 0 FALLA** | Atmósfera, tiempo y Weather |
| `node --test` (6 runners tornado/Weather/World) en baseline intacto y después | **121 PASS / 8 FAIL** en cada versión, exactamente los mismos test IDs | No aparecen regresiones nuevas en esa batería; no atribuir ni corregir fallos ajenos |
| `node --check` (JS modificado y runners) | **PASS** | Solo sintaxis JS; no compila GLSL |
| `npm run build` | **BLOQUEADO: `vite: not found`** | Vite no instalado aquí, no equivale a compilación válida |
| `npm run docs:check` | **BLOQUEADO: `ERR_MODULE_NOT_FOUND`** | Falta dependencia `marked`; no se alteró documentación generada |
| Chromium headless WebGL 2 con fixture `scripts/fixtures/weather/cloud-altitude-horizon-corr002.html` | **BLOQUEADO: timeout y fallo EGL/ANGLE** | Sin compilación/enlace GPU acreditados |
| `node scripts/bench-cloud-natural-scale-corr003.mjs` | Medianas de 120 000 evaluaciones solapadas: CORR002 57,8–71,4 ms; CORR003 61,9–68,9 ms | Solo microbenchmark CPU aislado; alta variabilidad, **sin conclusión sobre rendimiento global/FPS** |

Evidencia bruta en `docs/qa/evidence/lf-cloud-corr003/`. Las pruebas históricas C002 actualizaron únicamente umbrales reemplazados por CORR003; su evidencia documental previa se conserva, no se reescribe.

## 5. QA local pendiente para aprobación

1. En equipo objetivo: aplicar únicamente CHANGE ZIP sobre SOURCE_BASELINE de CORR002 y ejecutar `npm run electron` (sin cambiar dependencias del proyecto).
2. Mismo FOV, hora, clima, cámara y resolución: comparar cielo C002/C003 desde **2, 120, 1 000 y 3 000 m**. Comprobar que el horizonte cercano al suelo es recto y que a gran altura la curvatura del fondo es discreta, sin artefactos ni bandas oscuras.
3. En modo manual: nubes parciales, cubiertas y tormenta; confirmar diversidad natural sin bases arbitrarias ni cortes. En World/Weather: viento, transiciones, condensación, lluvia, rayos y tornado.
4. Comprobar diferencia entre cielo procedural y panorámica HDRI, día/noche, niebla y fotografía de contraste del limbo con y sin nubes.
5. Repetir en Runtime/Player exportado; medir FPS/tiempo CPU y memoria en preset Compatibility en hardware objetivo N5030/4 GB. Registrar fotos/capturas, datos y regresiones.
6. Si el nuevo radio causa discrepancia visual en nubes, rayos o niebla, corregir *dentro del mismo Gate* antes de cerrar.

**Estado de evidencia:** IMPLEMENTADO · NODE TEST PASS. **COMPILADO: NO VERIFICADO. QA WEBGL2/EDITOR/PLAYER: NO VERIFICADO. APROBADO: NO. CERRADO: NO.** El usuario decidirá la aceptación de la calibración visual.
