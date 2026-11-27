# QA contractual — LF-CINEMATICS-OWNERSHIP-CONTRACT-S05-G001

**Tipo:** auditoría de contrato y compatibilidad; **sin implementar cambios del Editor ni del Player**.  
**Baseline:** `LevelForge_TIMELINE_UX_INTEGRATION_S04_G004_SOURCE_BASELINE.zip` (QA LOCAL PASS declarado).  
**Estado:** documentación elaborada, **Amendment pendiente de aprobación del usuario**. Implementación de Cinematics NO AUTORIZADA.

## Evidencia y método

1. Comprobar integridad del baseline y existencia de seis hojas del ledger.
2. Trazar el flujo `.nfm` → `importFilm` → `cinematicFromPass`/`montageTimeline` → `project.timelines` → `TimelineRunner`.
3. Trazar los clips `project.animations` → `play-anim.js`, CameraShake, Inspector, ParamForm, EventEditor y exportación.
4. Localizar las entradas públicas de creación/duplicación/edición de clips en Assets y las referencias a `anim` en el docking.
5. Identificar contradicciones con los contratos aprobados; formular un Amendment de precedencia explícita y restricciones para futuras modificaciones.
6. Revisar que no se haya modificado producto, y que G004 aprobado se registre como QA local declarado, separado de Node 73/73 histórico.
7. Comparar ZIPs por ruta y SHA-256 internamente para verificar que CHANGE contiene solo documentos, QA y ledger; SOURCE_BASELINE mantiene byte a byte todo el código.

## Criterios y resultado documental

| Criterio | Resultado / limitación |
|---|---|
| Matriz de productores y consumidores trazable a código | DOCUMENTADO en AUDIT, casos O-01–O-14 |
| Distinción `.nfm`, `project.timelines`, `project.animations`, `project.captures` | DOCUMENTADO |
| Mantener el Editor Timeline aprobado | CONTRATO PROPUESTO; SIN CAMBIO DE CÓDIGO |
| Cinematics sin autoría | CONTRATO PROPUESTO; NO IMPLEMENTADO |
| Rutas de clips de gameplay identificadas | DOCUMENTADO; acceso posterior pendiente de decisión |
| Layouts persistidos `anim` | IDENTIFICADO; conservar identificador hasta migración autorizada |
| Procedencia FilmMaker | SIN CAMPO CANÓNICO IDENTIFICADO; no inferir por nombre |
| Seguridad del preview frente a scripts/eventos | CRITERIO FUTURO, NO VERIFICADO |
| Comportamiento Electron / Player | NO VERIFICADO en este Gate contractual |
| Contract Amendment aprobado | PENDIENTE DE APROBACIÓN DEL USUARIO |
| G004 QA local declarado | REGISTRAR EN XLSX / cierre documental (sin repetir pruebas) |

**Cierre de este Gate:** se podrá aprobar la entrega **documental** tras revisar el Amendment; eso no es PASS del futuro reproductor Cinematics. La migración de la pestaña permanece BLOQUEADA hasta resolver el destino de los accesos de clips. No volver a pedir logs de G004 salvo incidencia.

## Próxima declaración técnica, posterior a la aprobación contractual

La siguiente autorización debe listar expresamente las rutas para UI/Inspector/docking/Player que el código auditado exija, los casos de importación `.nfm`, pruebas Electron embebido y los dos ZIP. No se permite un Gate que cambie únicamente la etiqueta y deje rutas rotas o un falso reproductor basado en `project.animations`.
