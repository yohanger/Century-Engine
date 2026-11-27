# QA — LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-002

## Resultados observados
| Medio | Resultado | Evidencia |
|---|---|---|
| Node focal | **157 PASS, 0 FAIL** | `evidence/LF_S13_G008_G004_CORR002_NODE_FOCAL.log` |
| Node ampliada | **819 PASS, 19 SKIP, 12 FAIL históricos** | `evidence/LF_S13_G008_G004_CORR002_NODE_EXPANDED.log` |
| Comparación contra la regresión anterior | **Mismos 12 FAIL por nombre, ninguno nuevo** | Baseline `evidence/LF_S13_G008_G004_NODE_EXPANDED.log` |
| Ledger | **29.809 celdas históricas y 12 tablas conservadas**, sin cambios | `evidence/LF_S13_G008_G004_CORR002_LEDGER_COMPARE.log` |
| Electron FIFO | **NO VERIFICADO**: ausencia de Vite en entorno | `evidence/LF_S13_G008_G004_CORR002_ELECTRON_ENV.log` |
| Build Editor/Player | **NO VERIFICADO**: `vite: not found` | `evidence/LF_S13_G008_G004_CORR002_BUILD_ENV.log` |
| QA local visual/sonoro | **PENDIENTE** | Debe aportar el usuario |

## Ejecutar desde la raíz de LevelForge (`package.json`)
El usuario ya tiene dependencias instaladas en su instalación; no usar otro árbol de código ni sobrescribir Assets/escenas.

```bash
node --test \
  scripts/test-timeline-audio-point-lifo-s13-g008-g004.mjs \
  scripts/test-timeline-audio-point-lifo-s13-g008-g004-corr001.mjs \
  scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr001.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr002.mjs
node --test scripts/test-timeline-audio-point-lifo-s13-g008-g004-electron.mjs
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
npm run build
npm run electron
```

## Salidas esperadas / NO VERIFICADAS en Electron aquí
1. Node focal: **157 PASS, 0 FAIL**.
2. Electron test histórico de G004 (ruta contiene `lifo` para preservar referencias): **1 PASS y 25 checks**, con encabezados `Punto-1`, `Punto-2`, `Punto-3` y nuevo punto al final, incluso si el nuevo está cronológicamente entre puntos existentes.
3. Inspector S12: 40 checks. Audio Trim: 46 checks. Automatización S11-G007 con corrección PCM: 37 checks. Estas cantidades son criterios previstos; **no se ejecutaron aquí**.
4. Build Editor y Player sin errores. Abrir en Electron embebido y comprobar vista real; compilar no equivale a QA visual.
5. Crear 4 puntos fuera de orden temporal. Orden visual FIFO `Punto-1..Punto-4` de arriba abajo. Mover/renombrar/eliminar un punto sin reordenar los restantes. Guardar y reabrir; Undo/Redo conserva IDs y `createdOrder`.
6. Abrir un proyecto creado mientras regía LIFO con ordinales persistidos: la vista debe ser FIFO sin cambiar JSON del proyecto al abrirlo. En proyectos legacy sin ordinal, se conserva un orden inicial determinista por tiempo y no se inventa un historial desconocido.
7. Confirmar curva de automatización, Preview y Player sin cambios de volumen, fundidos, selección, Ctrl + doble clic, bloqueo, scroll al quinto punto y límite de 64 puntos.

## Evidencia solicitada
Enviar stdout completo de los tests y `npm run build`, más captura de la lista FIFO con 4 puntos, resultado de guardar/reabrir y evaluación de audio en Preview y Player. Si algún test falla, no declarar aprobado; aislar y corregir bajo autorización del Gate correspondiente.

## Estados independientes
IMPLEMENTADO = sí. TEST AUTOMATIZADO FOCAL PASS = sí. TESTS HISTÓRICOS COMPLETOS PASS = no (12 fallos anteriores). COMPILADO = NO VERIFICADO. QA LOCAL = PENDIENTE. APROBADO = no. CERRADO = no.
