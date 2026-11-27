# LevelForge — Contract Amendment CA-001 · Política pre-LTS para nodos

**ID:** `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001`  
**Gate documental:** `LF-CAMERA-ORCHESTRATION-S15-G003-CORR-002-PRELTS-CONTRACT-AMEND-G001`  
**Fecha:** 2026-11-09  
**Estado:** **RATIFICADO POR USUARIO el 2026-11-09**; la propuesta entregada en el Gate documental fue aprobada expresamente.  
**SOURCE_BASELINE documental de partida:** `LF_CAMERA_ORCHESTRATION_S15_G003_EVENT_CAMERA_CONSUMER_CORR001_SOURCE_BASELINE.zip` (2.957 archivos).

## 1. Motivo y autoridad

Durante el trabajo no verificado de `LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-002-INTEGRAL`, el usuario interrumpió explícitamente la propuesta de migrar nodos antiguos (`visible` → `active`). Nivel de decisión: **no mantener compatibilidad retrospectiva por defecto durante la fase pre-LTS de LevelForge**; no se requieren migradores ni pruebas de versiones anteriores para esa corrección. La instrucción **no** autoriza una mutación del código por sí sola.

Evidencias documentales:

- `docs/architecture/LF-NODE-ARCH-AUDIT-S00-G001_CONTRACT.md`, sección 3.7: sin respaldo de `collision`, `props.dynamic` y variantes legacy; sección 6: exclusión de compatibilidad de archivos antiguos.
- `docs/architecture/LF-NODE-ARCH-AUDIT-S00-G001_AUDIT.md`, «Compatibilidad y decisiones vinculantes»: renuncia expresa a migradores y rutas legacy, sin autorizar destrucción de recursos actuales.
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001.md`, CAM-15 y otras menciones a proyectos antiguos: obligación retrospectiva incompatible con la nueva decisión, **en la medida** en que se aplique al contrato `active` / `visible`.
- Declaración técnica de CORR-002, autorizada antes de la interrupción: exigía compatibilidad y QA de proyectos antiguos. Se debe emitir alcance técnico corregido antes de continuar.

Este documento **no cambia por sí mismo un contrato ya ratificado**: entrará en vigor solo con aprobación explícita del usuario. Hasta entonces permanece el bloqueo de la modificación técnica afectada.

## 2. Cláusulas propuestas

**CA-01 — Política pre-LTS.** LevelForge no exige compatibilidad retroactiva automática con esquemas, escenas o serializaciones de versiones **anteriores al SOURCE_BASELINE vigente**. Mantener el motor actual funcional sí es obligatorio. Cualquier excepción histórica exigida de forma explícita por un contrato vigente se identifica y se resuelve por autoridad contractual; este CA no la deroga globalmente en silencio.

**CA-02 — No migración heredada en CORR-002.** No se construirá conversión `visible`→`active`, lector legado paralelo, adaptador de versionado de nodos ni suite para archivos históricos en la separación `active` / `visible`. En particular, no inferir `active` a partir de `visible` para simular un comportamiento anterior. No mantener dos verdades de habilitación.

**CA-03 — Semántica actual única.** Para nodos del modelo vigente, `active` representa habilitación funcional y `visible` visibilidad propia de contenido renderizable, sin controlar física o ejecución. El Inspector de cabecera cambia **active**; `NodeHandle` expone estados lógicos, no el `Object3D.visible` de gizmos de edición. El contrato detallado efectivo de jerarquía y tipos se define en CORR-002 corregido.

**CA-04 — Integridad del trabajo vigente.** La renuncia a versiones antiguas **no** autoriza destruir escenas, assets, Prefabs, scripts, propiedades, referencias, transformaciones, configuraciones, trabajos locales ni funcionalidades que **existen y se utilizan en el SOURCE_BASELINE vigente**. Comparación contra baseline y protección de cambios locales son obligatorias. Un cambio del formato actual exige mecanismo explícito de escritura/lectura coherentes, sin migradores históricos.

**CA-05 — QA de la implementación actual.** El QA de CORR-002 se concentrará en nodos actuales, Inspector, `NodeHandle`, jerarquía, procesos `_process` y `_physics_process`, eventos, Jolt, Terrain, Camera3D, scripts, Prefabs, persistencia actual, Timeline, Play Mode y runtime exportado. No se exigirán fixtures de serializaciones anteriores al baseline. Reducir esa cobertura **no** permite fingir que las rutas físicas, de render o de runtime ya fueron verificadas.

**CA-06 — Alcance y precedencia.** Una vez ratificado, este CA sustituye únicamente la obligación de compatibilidad retrospectiva de CAM-15 y de la declaración CORR-002 que afecta a `active` / `visible`, sin derogar el resto de CAM-01..16, la interfaz Camera Orchestration, ni contratos de FilmMaker/Cinematics, Database, FPS vigente y exportación. Los requisitos de funcionamiento en proyectos **actuales** siguen vinculantes. Otras contradicciones entre contratos aprobados requieren Amendment específico.

## 3. Matriz de reconciliación contractual

| Fuente | Lectura vigente | Sustitución propuesta al ratificar CA-001 | Límite |
|---|---|---|---|
| Node S00-G001 CONTRACT §3.7, §6 | No mantener formatos antiguos ni árboles paralelos | CONSERVAR; criterio alineado con CA-01/02 | No deshabilitar sistemas actuales |
| Node S00-G001 AUDIT — compatibilidad | No migradores; preservar contenido de autoría actual | CONSERVAR; CA-04 aclara integridad | No borrar recursos sin inventario |
| Parent S15 CAM-15 | «No romper ... proyecto antiguo» | «No romper el proyecto y runtime del SOURCE_BASELINE vigente; sin obligación histórica por defecto» **solo al ratificar** | Mantener compatibilidad funcional actual Editor/Play/export |
| Parent S15 CAM-04 y U-02 | Recursos nuevos y tratamiento diferente a proyectos antiguos | Para semántica `active`/`visible`, eliminar la excepción de proyecto antiguo; las políticas de salida cinematográfica no cambian | No autoriza formatos de salida nuevos |
| Declaración CORR-002 original | Migrar `visible`→`active` y QA históricos | Retirar migración y QA históricos; probar modelo vigente y componentes especiales | Requiere Gate correctivo para reanudar |

## 4. Contrato de comportamiento que deberá implementar CORR-002 corregido

| `active` | `visible` | Render propio | Procesos ordinarios | Física aplicable |
|---|---|---|---|---|
| true | true | Sí, si tiene contenido renderizable | Habilitados | Habilitada |
| true | false | No, si tiene contenido renderizable | Habilitados | Habilitada |
| false | true | No | Suspendidos | Suspendida |
| false | false | No | Suspendidos | Suspendida |

- Los estados efectivos de hijos derivan de sus ancestros sin sobrescribir estados propios; las reglas concretas de propagación de visibilidad/activación se prueban en nodos actuales.
- Camera3D invisible puede seguir proporcionando imagen si está activa; una Camera3D efectivamente inactiva no es elegible. La visibilidad editorial de iconos/frustums no es `active` ni la visibilidad lógica contractual.
- No asegurar «cero uso de CPU/GPU» por estado: la exclusión de draw calls y de procesamiento ordinario requiere medición/verificación en caminos reales; la retención de recursos no es draw call.
- Los callbacks asíncronos, audio, Physics Bodies Jolt, piezas Terrain y otros tipos especiales requieren auditoría de lifecycle. Si faltan mecanismos para suspender/reactivar correctamente, documentar **BLOQUEO TÉCNICO** de esa rama antes de simular cumplimiento.

## 5. Exclusiones de este Gate documental

No se modifica `src/`, `electron/`, `vscode-extension/`, `scripts/`, `package.json` ni `vendor/`. No se integra el trabajo parcial no verificado de CORR-002. No se ejecutan pruebas funcionales ni se declara `active` / `visible` implementado. La modernización del personaje FPS y Camera Orchestration G004 siguen fuera de alcance.

## 6. Ratificación y siguiente acción

**Ratificación posterior:** el usuario aprobó CA-01..CA-06 el 2026-11-09. El Gate documental solo preparó el Amendment; la continuación técnica quedó autorizada separadamente mediante `LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-002-INTEGRAL_CONT-001`.

Tras ratificación: presentar/autorizar Gate técnico de continuación con alcance corregido; auditar el código parcial **contra SOURCE_BASELINE** antes de incorporarlo; completar integración vigente y QA local; cierre administrativo solo con evidencia y aprobación. Mantener los pendientes S15 y los no relacionados en las seis hojas sin reinterpretarlos como cerrados.
