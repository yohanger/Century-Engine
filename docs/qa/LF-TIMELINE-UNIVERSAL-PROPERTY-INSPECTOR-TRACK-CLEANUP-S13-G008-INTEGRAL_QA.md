# QA documental y bloqueos — LF-TIMELINE-UNIVERSAL-PROPERTY-INSPECTOR-TRACK-CLEANUP-S13-G008-INTEGRAL

**Estado:** auditoría estática y corrida Node limitada; **no hay implementación técnica ni QA visual nuevo**.

| Control | Evidencia | Estado |
|---|---|---|
| QA-BASE-01 | Comparación `lf(10).zip` vs SOURCE_BASELINE CORR-004 (41 nuevos, 27 cambios, 0 eliminados) | AUDITADO |
| QA-BASE-02 | Documentos CORR-005/006 encontrados; ratificaciones y SOURCE_BASELINE propio no cotejados de manera independiente | PENDIENTE DE RECONCILIACIÓN |
| QA-UPI-01 | Seis PROPS básicos, sin descriptores productivos por nodo | OBSERVADO |
| QA-UPI-02 | Inventario de 233 contenedores UI (sin certificar propiedades únicas) | PARCIAL · VER MATRIZ |
| QA-UPI-03 | Posición de llaves en Inspector | NO IMPLEMENTADO en `lf(10).zip` |
| QA-UPI-04 | Aplicadores y restauración universal de valores y subrecursos | NO CERTIFICADO / BLOQUEADO |
| QA-CLIP-01 | Creación de clips Cámara/Nodo aún visible en Timeline | OBSERVADO · NO RETIRADO |
| QA-CLIP-02 | Reproducción histórica de clips en evaluador | PRESENTE EN FUENTES · QA PLAYER PENDIENTE |
| QA-SCRIPT-01 | Pistas method con validación de nodos/args | PRESENTE EN FUENTES |
| QA-EVENT-01 | Pistas commands, eventos y audio | PRESENTE EN FUENTES |
| QA-NODE-01 | Corrida test combinado 54 casos | 50 PASS, 3 FAIL, 1 SKIP; NO GENERAL PASS |
| QA-EDITOR-01 | Build Editor/Player | NO EJECUTADO |
| QA-ELECTRON-01 | Interacción y capturas Electron embebido | NO EJECUTADO |
| QA-USER-01 | Aprobación y cierre | NO APROBADO / NO CERRADO |

### Criterios para desbloquear

- Ratificar una resolución contractual que elimina la contradicción de alcance y establece la prioridad de la autoría del Inspector.
- Auditoría verificable por familia: tipo, campo, lector, aplicador, interpolación/discreto, autoridad, persistencia, snapshots, QA Editor y Player.
- Resolver TB01/Jolt/Camera/Canvas por propietario, no por set arbitrario.
- Probar la retirada de creación de clips sin borrar y sin alterar la reproducción heredada.
- Ejecutar test de Scripts/Eventos en host real, incluyendo seek, loop, stop, args, errores y PlayMode/Player.
- Registrar QA visual local antes de declarar aprobado.

**No usar este documento como si la implementación hubiese sido realizada.**
