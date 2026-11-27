# Dependencias y secuencia ejecutable — LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-CA-G001

**Estado:** planificación recomendada, **ningún Gate técnico nuevo autorizado**. UA-CA-001 ya ratificado; UPA-CA-001 se propone y debe ratificarse antes de ejecución técnica. Mantenimiento de G007, G008 y sprints especializados.

## Orden obligatorio: DOCUMENTACIÓN → CÓDIGO REAL → EXCEL → SPRINT → GATE → IMPLEMENTACIÓN → QA USUARIO → EVIDENCIA → CIERRE → EXCEL

| Corte de trabajo propuesto | Unidad técnica y mínimo verificable | Prerrequisitos | Qué NO anticipa | QA local y entrega |
|---|---|---|---|---|
| 0. Reconcilación y autoridad | Acreditar cadena de Codex por fuente primaria o formalizar que `lf(10)` es copia técnica preservada aún no aprobada; aplicar UPA solo ratificado; fijar SOURCE_BASELINE validado | Este Gate documental; UPA ratificado | No declara CORR005/006 cerrados sin autorización/QA propios | Diff archivo a archivo, ledger, conservar cambios locales |
| 1. G007 autoridad (si afecta canales) | Mediar o bloquear escritor directo `object3D`, validar Jolt/host y snapshots sin último escritor gana | TB01, diagnóstico propio | No abrir cobertura física a ciegas | Node + Electron + Player; Gate correctivo G007 propio |
| 2. Inspector y autoría común | Extender controles originales para `PropertyKey` contextual y reutilizar `upsert`, sesión de cabezal, historial; cubrir primero catálogo validado | UPA-03 ratificado; fuente de metadata; baseline válido | No escribir setters especiales no auditados | G008 primer clic, keys, Undo/Redo, Electron 1366x768 |
| 3. Limpieza UI clips | Retirar opciones de **crear** clips Node/Camera en `TimelinePanel`, conservar pistas y lectura/reproducción histórica; mantener Audio, Scripts, Eventos, tomas | UPA-08/09, ejemplos de proyecto con legacy clips | No migrar ni borrar datos legacy; no tocar FilmMaker | Save/Load/seek/Player de clips legacy, Audio/Events/Methods |
| 4. Modelo y tipos compartidos | Completar tipos de valor y semánticas discreta/referencia de propiedades verificadas, sin duplicar `PROPS` | UPA-02/04/07, inventario y ownership | No introspección arbitraria global ni mutación runtime genérica | Tests por tipo de dato, validación/rollback |
| 5. Integraciones por propietario | Gates de propiedad: Physics/Jolt; Camera3D/S15; Canvas/UI; Render/Material; Audio; Terrain/Water; VFX; Script/GamePlay. Cada uno autoriza solo su área | Contrato propietario, runtime y autoridad previos | No adelantar funcionalidades no indispensables de G009–G012 | Integración específica Editor+Player+física/audio si aplica |
| 6. QA cobertura universal | Matriz completa de campos y evidencias de evaluación, restauración, rendimiento y export | Todos los cortes previos; UPA-10 | No declarar 100% por mostrar iconos | Suite Electron con escenas reales, Player exportado, N5030/4GB, QA usuario |
| 7. Reanudar secuencia G009–G014 | Volver a funcionalidades como animar opacidad `.ui`, FOV avanzada, ratio/tomas y UX restantes | Cobertura/autoridad universal certificadas | No mezclar su implementación en Gate de props | QA de integración por Sprint |

**Política de bloqueo:** si un corte necesita una dependencia técnica prohibida en su Gate, se declara DEFECTUOSO/SUPERSEDIDO y se emite otro completo ANTES de implementar. Los nombres finales de Gates, módulos y pruebas se fijarán tras auditar cada baseline. Ninguna aprobación conceptual ni documental constituye autorización de código.

**Prueba de integración de Sprint:** al finalizar las familias, ejecutar una escena con Light + Camera3D + Canvas + física + audio + scripts + eventos, registrar Preview/Play/Player y guardar/reabrir, sin modificar datos autorales tras detener Timeline.
