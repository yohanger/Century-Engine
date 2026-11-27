# Plan QA documental — LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-CA-G001

**Estado:** DOCUMENTOS PREPARADOS; UPA-CA-001 PENDIENTE DE RATIFICACIÓN; NO TEST AUTOMATIZADO NUEVO, BUILD O QA ELECTRON EJECUTADO en este Gate.

## Matriz CA-QA-01..12

| ID | Verificación | Resultado objetivo y evidencia |
|---|---|---|
| CA-QA-01 | Reconciliar baseline y diffs | Hash de archivos CORR-004 vs `lf(10)`; candidatos documentados, sin aprobar local por inferencia |
| CA-QA-02 | Contrastar CORR-005/006 | Distinguir afirmaciones de documentos, logs incluidos y mensajes de aprobación primaria; estado PENDIENTE donde falte evidencia |
| CA-QA-03 | Preservar UA-CA-001 | No alterar UA-01..UA-12 ratificados; nueva enmienda propuesta por separado |
| CA-QA-04 | Preservar TB01/Jolt/S15 | UPA-06 sin relajar snapshots, writers, física y cámaras |
| CA-QA-05 | Inventariar propiedades reales | 233 contenedores preliminares vinculados a familiares; NO dar cobertura total; plan de enumeración dinámica |
| CA-QA-06 | Identificar propietarios | Tabla física/Camera/Canvas/Audio/materiales/VFX/otros y Gate propio |
| CA-QA-07 | Scripts/Eventos/Audio | Confirmación en fuentes + plan de prueba real de method/commands/audio y args |
| CA-QA-08 | Retirada no destructiva de clips | Contrato de ocultar creación nueva Node/Camera, preservar legacy y Player |
| CA-QA-09 | Definir cortes técnicos | Etapas verificables, independientes y autorizables; sin adelantarlas |
| CA-QA-10 | Ledger sin pérdida histórica | Las seis hojas conservan celdas/fórmulas históricas; solo se añaden filas del Gate documental |
| CA-QA-11 | Dos ZIP | CHANGE solo documentación+ledger; SOURCE_BASELINE candidato limpio, sin build; CRC y SHA256 comparativo interno |
| CA-QA-12 | Estado de ratificación | `UPA-CA-001` entregado PENDIENTE; no se modifica código y no se declara Gate técnico completado |

## QA técnico futuro (NO EJECUTADO)

**Propiedades:** un ejemplo de cada tipo de nodo/componente y recurso; lector y writer reales; interpolación/discreto con Ctrl+doble clic y llave Inspector; misma pista sin duplicados; Undo/Redo; persistencia; eval/preview/stop; escena destruida; orden de escritores y Jolt; Node, Electron, Player exportado, rendimiento N5030/4GB.

**Scripts:** NodeScriptRuntime expone método, pasa argumentos correctos, rechaza método inexistente, receptor borrado y scripts inactivos; Editor/Player y stop/loop/seek sin doble invocación accidental.

**Eventos:** pista `commands`, lista JSON, ejecución al cruzar tiempo, pausa, seek y loop según contrato; esenciales en skip/stop; coexistencia con audio. **No convertir scrub en ejecución de efectos**.

**Audio:** conservar clips, waveform, fades, automatización y mezclador; un solo propietario de ganancia; evitar un segundo escritor temporal.

**Legacy Camera/Nodo:** abrir recursos anteriores con clips, comprobar misma evaluación y salida en Player, no crear nuevos mediante UI y no borrar datos persistidos.

## Evidencia real disponible y no repetida

- En `lf(10).zip` existen logs Codex de `300/300` Node, `22/22` Electron ancho/estrecho y builds Editor/Player exitosos. **Son registros históricos aportados, inspeccionables; NO se han ejecutado nuevamente aquí ni acreditan QA usuario o aprobación contractual.**
- El Gate bloqueado anterior registró `50 PASS, 3 FAIL, 1 SKIP` de 54 casos: su resultado permanece separado y no se reetiqueta como PASS.
- Este Gate exclusivamente documental deberá verificarse por lectura de archivos, comparación ZIP, preservación del ledger y ratificación posterior del usuario.

**Estados correctos:** DOCUMENTADO; CA PROPUESTO; QA DOCUMENTAL DE ARCHIVOS por verificar antes de entrega; IMPLEMENTACIÓN UNIVERSAL NO VERIFICADA; G007 AUTORIDAD PENDIENTE; G008 previo NO CERRADO.
