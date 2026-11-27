# QA documental y criterios de integración futura — Universal Animation UA-CA-001

**Fecha:** 2026-11-10. **Estado:** plan contractual, **NO SON RESULTADOS PASS**.  
**Gate documental:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-ANIMATION-CONTRACT-AMEND-G001`.

## 1. QA de este Gate documental (única aceptación presente)

| ID | Control | Evidencia prevista |
|---|---|---|
| DOC-01 | SOURCE_BASELINE más reciente identificado y no mezclado | Lista/manifest de G008 y comparación contra G007 |
| DOC-02 | Contratos G005 y CA-TB01-001 contrastados | Auditoría + tabla de reemplazos TA/UA |
| DOC-03 | Código real consultado, sin afirmaciones de implementación universal | Matriz de funciones y rutas concretas |
| DOC-04 | UA-01..UA-12 completas y sin derogación accidental de TB01 | Documento Amendment, aún no ratificado |
| DOC-05 | Bloqueos G007/G008 explícitos | Deuda `object3D` y QA Electron pendiente |
| DOC-06 | Reestructuración autorizable pero no abierta | Dependencias y límites técnicos explícitos |
| DOC-07 | Registros históricos del Excel preservados | Comparación de seis hojas y nuevas filas |
| DOC-08 | Sin cambios en `src/`, `scripts/`, escenas ni Player | Comparación SHA-256 de cada archivo original de producción |
| DOC-09 | Dos ZIP exactos, sin builds/caches/`node_modules` | Listado y CRC; baseline acumulativo completo |
| DOC-10 | Ratificación y futuras autorizaciones separadas | GATE en ledger PENDIENTE DE RATIFICACIÓN; G008-CORR-001 no autorizado |

## 2. Plan futuro para G008-CORR-001 y G009–G014 (NO EJECUTADO)

| ID | Escenario | Criterio de aceptación | Dependencia |
|---|---|---|---|
| UAQA-01 | Node/Node3D nuevo con campo numérico | Descriptor del propietario, llave genérica y canal sin parche Inspector | UA ratificado / G008-CORR-001 |
| UAQA-02 | Nuevo tipo de nodo con propiedad compatible | Inserción desde control existente sin `if` por `node.type` en Timeline | G008-CORR-001 |
| UAQA-03 | Propiedad vectorial | Interpolación tipada sin perder ejes ni cambiar datos autorales | G007 / G008-CORR-001 |
| UAQA-04 | Rotación angular | Sin saltos de 360°, espacio local/mundial según contrato | G010 si Camera3D |
| UAQA-05 | Booleano o enum | Cut/hold determinista, sin lerp numérico | G008-CORR-001 |
| UAQA-06 | Color | Curva y espacio cromático explícitos; paridad visual | G007 / G012 |
| UAQA-07 | Material/subrecurso | Identidad de recurso estable; no contaminar materiales compartidos | G012 |
| UAQA-08 | Cambio de textura/referencia | Cambio discreto seguro y recursos válidos, sin URL/eval arbitrario | G012 |
| UAQA-09 | Propiedad de script expuesta | Reader/writer y autoridad reales; sin reflection arbitraria | G012 / contrato scripting |
| UAQA-10 | Canvas opacity | Sin tocar bytes de `.ui`, sin reinstanciar ni perder input | G009 |
| UAQA-11 | Camera3D FOV/pose | No adquiere autoridad de render por animar transform | G010 / S15 |
| UAQA-12 | Audio volumen | Una sola automatización efectiva, sin competir con Mixer | G012 / contrato audio |
| UAQA-13 | Cuerpo dinámico Jolt | Sin escritura no autorizada ni kinematic implícito | TB01 / bake |
| UAQA-14 | Escritura scripts vs Timeline | Conflicto observable, sin último escritor gana accidental | G007 corrección si precisa |
| UAQA-15 | Escritura directa `object3D` | No existe bypass sin certificar; soporte bloqueado o corregido | G007 pendiente |
| UAQA-16 | Animation Clips y Timeline | Un canal protegido, los demás del clip siguen | G007 |
| UAQA-17 | Insertar misma clave en t | Actualiza ID sin duplicar pista; Undo/Redo completo | G008-CORR-001 |
| UAQA-18 | Timeline no editable | Ninguna escritura ni falsa llave | G008-CORR-001 |
| UAQA-19 | Jerarquía → Inspector desde recurso | Primer clic incluso nodo ya seleccionado; sin regresión selección temporal | G008 SEL-01..08 |
| UAQA-20 | Save/Load/duplicación | IDs y claves previas intactos, extension sin migración retrospectiva | G006 |
| UAQA-21 | Scrub/seek/loop | Mismas muestras repetibles, sin ejecutar eventos durante seek | TB01 |
| UAQA-22 | Stop/skip/fin | Snapshot/retención según tipo legado/nuevo; sin modificar proyecto | TB01 |
| UAQA-23 | Editor/PlayMode/Player | Misma evaluación con adaptadores previstos, QA real | G014 |
| UAQA-24 | Coste en PC de bajo rendimiento | Sin recorrido completo de metadata por fotograma; benchmark antes/después | G014 |
| UAQA-25 | Destruir nodo/cambiar escena | Caché invalidada, sin writer ni snapshot obsoletos | G007 / G014 |
| UAQA-26 | Película Cinematics/FilmMaker | Sin autoría duplicada ni regresiones del Player | S05 ownership |
| UAQA-27 | Asset/ref no interpolable | Operación discreta o rechazo justificado; nunca tratar ID como número | G012 |
| UAQA-28 | Properties complejas VFX/Terrain/Water | Adaptador del dueño real; QA dedicado, no fingir universalidad | G012+ |

## 3. Evidencia por etapa

- **DOCUMENTADO:** Amendment, auditoría y matriz: verificar mediante lectura y consistencia contractual.
- **IMPLEMENTADO:** solo cuando haya cambios de código autorizados en Gate técnico posterior.
- **TEST AUTOMATIZADO PASS:** número real de pruebas ejecutadas sobre el SOURCE_BASELINE correcto.
- **COMPILADO:** resultados concretos de Vite Editor y Player; nunca inferir por tests Node.
- **QA LOCAL PASS:** usuario ejecuta Electron embebido y comprueba interacción, Player y propiedades de familias involucradas.
- **APROBADO / CERRADO:** declaraciones independientes tras evidencia, y ledger sincronizado.

**No usar DOC-01..10 ni UAQA-01..28 como sustituto de pruebas ejecutadas.** Los cierres G007 y G008 permanecen pendientes hasta aprobación propia.
