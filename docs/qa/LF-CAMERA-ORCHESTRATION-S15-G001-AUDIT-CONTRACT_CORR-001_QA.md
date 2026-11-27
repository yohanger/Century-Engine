# S15 Camera Orchestration — QA contractual CORR-001

**Gate autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_CORR-001` (2026-11-09).  
**Tipo:** DOCUMENTAL. **Estado:** documentación generada, QA de producción/Electron/Player **NO EJECUTADO**; aprobación específica de CORR-001 y ratificación del Parent **PENDIENTES**.

## Control documental de esta corrección

| ID | Requisito verificable | Estado de entrega |
|---|---|---|
| DC-01 | SOURCE_BASELINE de entrada G001 intacto; comparación de ZIP y preservación de fuentes productivas | Verificar contra inventario de entrega |
| DC-02 | Parent 001 pasa de Timeline-centrista a orquestación general | DESCRITO; requiere aprobación del usuario |
| DC-03 | CAM-01..16 redactadas, con consumidor ≠ fuente ≠ autoridad ≠ output | DESCRITO; requiere ratificación |
| DC-04 | Fin sin política para **recurso nuevo** mantiene fuente válida; no FPS implícito | DESCRITO; no implementado |
| DC-05 | Variantes de salida expresas distinguibles de Camera3D viva y pose fija | DESCRITO; metadatos/APIs no autorizados |
| DC-06 | D03/D04/D06/D09/D12 separadas como RECOMENDADAS, no ratificadas | DESCRITO |
| DC-07 | Cinematics/FilmMaker ownership y S11 ID/escena/legacy conservados | DESCRITO; no cambia contratos históricos |
| DC-08 | Modernización **personaje FPS** solo posterior; Database y Prefab auditados estáticamente | DESCRITO; no implementado |
| DC-09 | Play Mode/Player exportado siguen sujetos a QA de cámaras en S15 | DESCRITO; no verificado |
| DC-10 | ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY sincronizadas sin borrar filas | Verificar en XLSX exportado |
| DC-11 | G002 y Gates siguientes pendientes de autorización | DESCRITO |
| DC-12 | Ningún cambio en scripts, runtime, templates, persistencia, builds o tests ejecutables | Verificar diff binario de ZIP |

## Escenarios de aceptación futura — todos NO VERIFICADOS

| Escenario | Resultado exigido al implementar | Prioridad contractual |
|---|---|---|
| Juego sin Timeline activa Camera3D por solicitud propia | Vista correcta, no depende de `TimelineRunner` | CRÍTICO |
| Recurso nuevo termina sin salida declarada | Camera3D efectiva viva se mantiene incluso después del fin | CRÍTICO |
| Recurso nuevo declara `activar_camera3d` | ID+escena correctos; no retorna FPS | CRÍTICO |
| Recurso nuevo declara `activar_jugador` | Vuelve solamente por decisión explícita | ALTO |
| Stop/Skip/interrupción | Aplica política específica ratificada por motivo; sin retorno no deseado | ALTO |
| Camera3D destruida / escena cambiada | Diagnóstico estable, política de fuente perdida explícita | CRÍTICO |
| Cinematics con `.nfm` importada | No cambia ownership ni usa espejos | ALTO |
| Dos consumidores activos | Arbitraje sin writer competitivo; prioridades/cesión verificables | CRÍTICO |
| `lock=true` y `false` FPS legacy | Movimiento y mirada se comportan según política; cambio de vista independiente | ALTO |
| Preview de Timeline | Cámara de escena válida, sin fallback editorial accidental | ALTO |
| Sin jugador + solicitud Camera3D | Salida visible; sin fuente válida no cámara ficticia | ALTO |
| FOV, profile, Shake, audio, DOF y agua | Todos observan resultado efectivo; sin efectos duplicados | ALTO |
| Player exportado | Misma autoridad y salida que Play Mode, en paquete real | CRÍTICO |
| Proyecto histórico | Misma conducta legacy hasta Amendment explícito | CRÍTICO |
| Futuro FPS nativo por Prefab | Parámetros Database, Jolt, scripts y gameplay conservados | DIFERIDO, FUERA DE S15-G001 |

## Estados y evidencia

- **TEST AUTOMATIZADO Node:** NO EJECUTADO (este Gate no exige runners).
- **COMPILADO Editor/Player:** NO EJECUTADO (sin cambios de producción).
- **ELECTRON embebido:** NO EJECUTADO.
- **QA LOCAL usuario / Player exportado:** NO EJECUTADO.
- **APROBACIÓN CORR-001:** PENDIENTE de revisión de entrega.
- **RATIFICACIÓN Parent:** PENDIENTE e independiente de la aprobación del Gate documental.
- **CIERRE CORR-001:** PENDIENTE de aprobación del usuario y actualización de cierre autorizada.

## Bloqueos antes de un Gate de producción

1. Ratificación CAM-01..16 y D03/D04/D06/D09/D12, o resolución explícita de qué políticas quedan diferidas para un Gate especializado.
2. Política segura para fuente retenida que desaparece, cambio de escena, pérdida de autoridad y concurrencia.
3. Diseño de interfaz para consumidores gameplay/scripts/eventos, sin inventar `game.camera` existente ni duplicar gestores.
4. Contratos/Amendments para cualquier diferencia real con S11 Camera Binding, FilmMaker y reproducción de recursos heredados.
5. Gate técnico con medios explícitos: runners existentes o nuevos si son indispensables, Electron, Player exportado y QA local. No inferir autorización desde CORR-001.

**Evidencia que debe devolver el usuario:** conformidad o correcciones puntuales del Parent 001 CORR-001; aprobación específica documental; ratificación separada del contrato padre cuando esté conforme. No se le solicitan capturas de funciones no implementadas.
