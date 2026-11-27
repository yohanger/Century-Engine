# LF-CLOUD-EVOLUTION-S01-G001-CORR-001 — Matriz QA

**Gate:** `LF-CLOUD-EVOLUTION-S01-G001-CORR-001-NATURAL-3D-CLOUD-MORPHOLOGY`. Base aprobada: S01-G001. Evidencia del vídeo del usuario: masas achatadas en PlayMode. La condición de aprobado de S01-G001 **no se transfiere** a CORR-001.

## Ejecución y resultados observados

| Acción | Evidencia | Estado |
|---|---|---|
| Node integrado: 11 runners | `evidence/.../node-132-pass.tap` | **132/132 PASS**, 0 FAIL / 0 SKIP |
| Nuevo runner morfológico | 11 verificaciones M3D-01..11 dentro de TAP | **11/11 PASS** |
| Equivalencia `_stamp` | M3D-11, bit a bit para núcleos y 10 estados | **PASS en caso de referencia** |
| Sintaxis JavaScript alterado | `node --check` en archivos JS; módulo fixture extraído | **PASS** |
| Electron / WebGL2 | `evidence/.../electron-blocked-vite.tap` | **BLOQUEADO: falta Vite; NO PASS** |
| Fixture WebGL2 ampliada | `scripts/fixtures/weather/cloud-convection.html` | 17 verificaciones definidas; **NO EJECUTADAS en Electron aquí** |
| Vite build | No disponible en contenedor sin `node_modules` | **NO VERIFICADO** |
| Player exportado / paridad | No ejecutado en contenedor | **NO VERIFICADO** |
| QA visual local después de CORR-001 | Usuario aún no lo ha realizado | **NO VERIFICADO** |
| FPS p50/p95, GPU, memoria N5030 | Sin medición equivalente en hardware | **NO VERIFICADO** |

### Comandos reproducibles

```bash
node --test scripts/test-cloud-natural-3d-morphology-corr001.mjs
node --test scripts/test-cloud-evolution-s01-g001.mjs
node --test scripts/test-cloud-evolution-integral-validation-g001.mjs
node --test scripts/test-clouds.mjs
node --test scripts/test-atmosphere.mjs
node --test scripts/test-cloud-altitude-horizon-corr002.mjs
node --test scripts/test-cloud-natural-scale-corr003.mjs
node --test scripts/test-weather-unification-s04-g001.mjs
node --test scripts/test-weather-lightning-world-s11-g001.mjs
node --test scripts/test-weather-tornado-natural-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-s04-g001.mjs
node --test scripts/test-cloud-evolution-electron-s01-g001.mjs
npm run electron
```

Registro TAP de la ejecución Node combinada adjunto. No afirmar que los runners históricos de otros subsistemas fallidos con anterioridad han sido corregidos; están fuera del alcance de este Gate.

## Matriz de cobertura funcional

| ID | Invariante | Método | Estado |
|---|---|---|---|
| M3D-01..02 | Cúmulos y nublado tienen altura proporcionada | Extensión A/B de primitivas | Node PASS |
| M3D-03 | Estratos se mantienen más horizontales | Proporción y rango | Node PASS |
| M3D-04 | Tormentas no se desproporcionan | Extensión de torres | Node PASS |
| M3D-05 | `cloudSize` no aplasta el volumen | Relación 1×/2× | Node PASS |
| M3D-06 | MORPH no manda sustitución de geometrías | Mutación de etiqueta, comparar primitivas | Node PASS |
| M3D-07 | Semilla, identidad y reutilización permanecen | Igualdad y referencias | Node PASS |
| M3D-08..09 | Condensado vertical y cimas dentro del dominio | Vóxeles y límites de losa | Node PASS |
| M3D-10 | No se cambian RG8/16 ni pasos de raymarch | API / shader contratado | Node PASS |
| M3D-11 | Optimización de stamp no altera evolución | Referencia bit a bit, 10 avances | Node PASS |
| S01 / Weather / escala | Clima, continuidad, tamaños, tormentas | Batería integrada | Node PASS |
| GPU-01..17 | Fotometría, densidad y vistas de tierra/lateral | Electron WebGL2 | **PENDIENTE** |
| Play/Stop/Player | Integraciones reales y efecto sobre terreno | QA local | **PENDIENTE** |
| Perf | FPS, memoria, CPU/GPU y latencia | QA N5030/4 GB | **PENDIENTE** |

### Protocolo visual para usuario

1. Aplicar CHANGE incremental sobre el SOURCE_BASELINE S01-G001 aprobado, preservando posibles modificaciones locales posteriores, y ejecutar los tres comandos básicos.
2. En Editor, observar secuencialmente parcialmente nublado, nublado, cubierto y tormenta con el mismo `cloudSize`, cámara y exposición, comparando con la captura de S01-G001. Inspeccionar **desde suelo, lateral y aire**, no solo desde horizonte.
3. Verificar cúmulos con cuerpos tridimensionales y bases relativamente planas, bancos estratificados aún extensos pero no uniformes, torres de tormenta proporcionadas y cirros sin volúmenes esféricos forzados. Revisar repetición visual de los seis lóbulos.
4. Pasar de parcialmente nublado a tormenta y despejado durante 30–120 s; comprobar que las formaciones crecen y se disipan sin cambios discretos, y que lluvia, rayos, tornado y transmisión de luz corresponden al volumen nuevo.
5. Play/Stop, Edit estático, cámara a 20 km, cargar partida a mitad de transición y Player exportado; observar que no se pierdan datos ni se publiquen regiones vacías.
6. Repetir escena a misma resolución en Compatibility, Mobile y Forward+. Registrar FPS p50/p95, memoria RAM/VRAM y comparativa A/B de CPU/GPU. **No declarar 60 FPS sin registro**.

### Criterio de salida

- 17/17 Electron comprobadas sin errores de GLSL/WebGL2, Editor y Player visualmente aceptados, tiempo y consumidores funcionales, memoria/CPU justificadas y aprobación expresa del usuario.
- Si la calidad aún no es suficiente, se documentará la limitación sin afirmar realismo fotográfico ni añadir nuevas simulaciones no autorizadas.

**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILACIÓN NO VERIFICADA · QA LOCAL PASS NO VERIFICADA · CORR-001 PENDIENTE DE APROBACIÓN Y CIERRE.
