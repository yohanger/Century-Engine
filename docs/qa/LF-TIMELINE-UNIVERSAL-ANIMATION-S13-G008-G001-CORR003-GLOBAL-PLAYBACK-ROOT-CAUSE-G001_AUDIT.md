# Auditoría · GLOBAL-PLAYBACK-ROOT-CAUSE-G001

**Gate autorizado:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001`  
**Entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_FINAL_CLOSURE_G001_SOURCE_BASELINE.zip` · 3.131 entradas ZIP · CRC íntegro.  
**Reproducción:** `proyecto_3.zip` aportado por usuario. Proyecto no incorporado al SOURCE_BASELINE.  
**Resultado:** auditoría y regresión reproducible completadas; **IMPLEMENTACIÓN DE CAMBIO CONTRACTUAL BLOQUEADA POR CA-005 NO RATIFICADO**. CORR-003 ABIERTO.

## Inventario verificado

- `proyecto_3/project.lfproj` es ZIP válido: `project.json` + escena `Assets/Scenes/Escena 1.scene.json`.
- Timeline de 10 s a 30 FPS con tres pistas: `position` de Cámara A, `camera.main=false` de Cámara A a 3.1037946 s y `camera.main=true` de Cámara B a 3.96666 s. Ambas cámaras son `main=false` en la escena guardada. No hay pistas de transform de otros tipos en el archivo de reproducción.
- `TimelineRunner._apply()` recorre todas las pistas de nodo habilitadas, sin leer selección ni Inspector.
- `TimelinePreview.apply()` también recorre pistas de nodo habilitadas; no se encontró filtro general por selección en ese bucle.
- `TimelinePreview.animatedCameraPose()` sí prioriza `selectedTrack`, luego `selectedNodeId`, o exige una única cámara candidata. No consulta `camera.main` ya evaluada. La cámara escogida puede depender del estado editorial.
- `createTimelinePlayback.refresh()` pasa `selectedTrack` y `selectedNodeId` al Preview. `TimelinePanel` también vuelve a solicitar Preview al cambiar selección, lo que permite que la selección altere la cámara mostrada.
- `createTimelinePlayback.pause()` establece `previewEnabled=false`; el watcher síncrono ejecuta `visual.stop()` y restaura poses. `yieldToEditing()` no cede mientras `playing=true`, pero sí tras pausa.
- `S15-G005-CORR-001` documentó y comprobó esa cesión intencionadamente. `PV-07/PV-08` también legitiman prioridades de selección editorial en pruebas históricas. No corresponde cambiarlas sin Contract Amendment.

## Clasificación

| ID | Estado | Conclusión |
|---|---|---|
| FOCUS-01 | OBSERVADO | Cámara del Preview elegida por selección en presencia de múltiples candidatas, sin consultar `camera.main` temporal |
| FOCUS-02 | OBSERVADO | Pausa desactiva Preview y restaura poses visuales, contrario al contrato nuevo solicitado |
| FOCUS-03 | OBSERVADO | S15-G005-CORR-001 codifica FOCUS-02 como comportamiento intencional y con pruebas PASS |
| FOCUS-04 | OBSERVADO | Evaluador `TimelineRunner._apply()` no filtra pistas por selección editorial |
| FOCUS-05 | INFERENCIA | Parte de la impresión de que otros nodos «no se reproducen» puede proceder del cambio de punto de vista; no se demuestra la causa general con un proyecto que solo anima cámaras |
| FOCUS-06 | CAUSA RAÍZ ACOTADA | El mecanismo de elección de cámara acopla Preview con selección; la política de cesión editorial de S15-G005 acopla Pausa con restauración |
| FOCUS-07 | NO VERIFICADO | Electron, Player, Jolt, CSG, dos luces y dos objetos ordinarios en una sesión real |

## Evidencias ejecutadas

- `node --test scripts/test-camera-orchestration-s15-g005-corr001.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs`: **31 PASS / 0 FAIL**. Corresponde a los contratos históricos; no acredita el criterio nuevo.
- `node --test scripts/timeline-global-playback-root-cause-g001-red.mjs`: **2 PASS / 3 FAIL**. Los FAIL son reproducibles y obligatorios hasta corregir la semántica: `CAM-01` espera B sin selección, `CAM-02` espera B aunque A esté seleccionada y `PAUSE-01` espera pose temporal retenida tras Pausa.
- `npm run build`: **NO VERIFICADO**; no existe instalación local de Vite (`vite: not found`, código de salida 127).
- Electron, Player independiente y QA local: **NO VERIFICADOS**.

Archivos de evidencia conservados bajo `docs/qa/evidence/LF-TIMELINE-GLOBAL-PLAYBACK-ROOT-CAUSE-G001/`.

## Bloqueo y siguiente acción

Propuesta: `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-005-PLAYBACK-INDEPENDENCE.md`.

**BLOQUEADO:** no modificar semántica protegida de Pausa, cesión editorial ni prioridades de selección de cámara antes de ratificar CA-005. No corregir harnesses históricos para ocultar fallos. Tras ratificación, aplicar corrección acotada en el Gate autorizado, regresar las pruebas RED a PASS y solicitar QA local. No declarar CORR-003 CERRADO.


## Actualización tras ratificación CA-005 (2026-11-11)

El apartado anterior documenta el diagnóstico **anterior** a la ratificación y conserva su evidencia RED original. CA-005 fue ratificada mediante declaración literal. La prohibición contractual que impedía corregir Preview/Pausa quedó levantada dentro del Gate existente.

Se corrigió en fuentes la dependencia de selección del Preview, la restauración al pausar y la cesión automática desde selección/herramienta. El propietario del Player ahora identifica el conflicto entre principal temporal y principal autoral, conservando los leases de cámara existentes. Las pruebas históricas contradictorias se reconciliaron con CA-005 sin reescribir los resultados RED anteriores.

**Evidencia de la implementación posterior:** `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001_CA005-QA.md`. El Gate y CORR-003 continúan abiertos hasta QA local y aprobación.
