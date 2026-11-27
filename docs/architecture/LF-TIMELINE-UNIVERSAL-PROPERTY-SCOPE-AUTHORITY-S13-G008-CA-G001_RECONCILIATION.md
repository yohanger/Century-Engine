# Reconciliación de código y autoridad — LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-CA-G001

**Fecha:** 2026-11-10. **Estado:** AUDITORÍA DOCUMENTAL; CORR-005/CORR-006 NO RECONCILIADOS CONTRACTUALMENTE; `LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-UPA-CA-001` PENDIENTE DE RATIFICACIÓN. No hay cambios productivos en este Gate.

## 1. Jerarquía aplicada

1. Autorización exacta de ESTE Gate documental recibida en la conversación.
2. G005 TA-01..TA-12 y UA-CA-001 RATIFICADOS en conversación; CA-TB01-001 RATIFICADO y vinculante. No alterar por interpretación.
3. El código real de `lf(10).zip` acredita lo implementado en fuentes; los logs de su propio ZIP son evidencia de pruebas reportadas, no evidencian por sí mismos autorización o QA del usuario.
4. El libro mayor registra lo conocido; no autoriza por sí solo una nueva implementación.
5. La aprobación expresa del usuario en esta conversación es **del diseño visual de Codex**. No implica aprobación automática de sus decisiones de autoría, de la totalidad de CORR-005/006 ni de la reproducción universal.

## 2. Comparación byte a byte de baselines

| Fuente | Condición | Archivos regulares | Resultado |
|---|---|---:|---|
| `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_TIMELINE_PRO_UX_CORR004_INTEGRAL_SOURCE_BASELINE.zip` | Fuente precedente con procedencia de esta conversación | 3045 | Base de referencia previa |
| `lf(10).zip` | Entrega de Codex aportada por el usuario | 3086 | 41 NUEVOS, 27 MODIFICADOS, 0 ELIMINADOS contra CORR-004 |
| `LF_TIMELINE_UNIVERSAL_PROPERTY_INSPECTOR_TRACK_CLEANUP_S13_G008_INTEGRAL_SOURCE_BASELINE.zip` | Baseline **CANDIDATO** del Gate bloqueado anterior | 3066 | `lf(10)` sin 24 archivos compilados `dist-player/*`, más 4 documentos de auditoría + ledger actualizado |

De los 41 archivos nuevos de `lf(10)`, **24 son compilados en `dist-player/*`**. Los otros 17 incluyen 5 documentos CORR-005/006, 8 evidencias/capturas/logs y 4 archivos de pruebas/fixture. El listado exacto se conserva en la comparación de ZIPs.

Los 27 modificados comprenden 9 componentes/módulos de producción (`Inspector.vue`, `InspectorDock.vue`, `TimelinePanel.vue`, `ContextMenu.vue`, `PropertyKey.vue`, `TemporalResourceInspector.vue`, `state/timelines.js`, `timeline/model.js`, `playback-session.js`), además de scripts/fixtures, VSIX/manifiesto y ledger. Ningún archivo de producción presente en `lf(10)` fue descartado en el baseline candidato. El `VSIX` y su manifiesto se conservan tal como los entregó el usuario; no se infiere autorización nueva para modificarlos.

**Límite:** no se dispone de la cadena de autorizaciones originales de Codex ni de los SOURCE_BASELINE firmemente autorizados CORR-005/CORR-006 como artefactos independientes. El cotejo de hashes permite preservar, no validar su autoridad histórica. **NO declarar `lf(10)` como baseline aprobado ni reemplazar a ciegas la carpeta activa del usuario.**

## 3. Revisión de fuentes Codex y evidencia

- CORR-005, `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-AUTHORING-CORR-005-INTEGRAL_IMPLEMENTATION.md`, declara autorización literal y «Ratifico el cambio» para pasar llaves a Timeline. Esta ratificación **solo consta como afirmación en ese documento**, no se ha corroborado mediante el mensaje original del usuario en este hilo. No borrar ni falsear esa historia; requerir fuente primaria si se pretende establecer su prelación contractual.
- CORR-006, `...TIMELINE-GODOT-UX-CORR-006-INTEGRAL_IMPLEMENTATION.md`, declara un Gate autorizado y comparación visual con Godot. Se aportan test y QA, no una autorización primaria demostrada aquí.
- Los logs **incluidos en el ZIP** registran CORR-005 Node 300/300 PASS, Electron 22 comprobaciones para ancho y estrecho y compilaciones Editor/Player PASS; `electron-regresion.log` registra otros casos. **Verificado: los archivos de registro existen y contienen esas salidas. No verificado en este Gate: volver a ejecutar dichos tests, QA de usuario, export real o autoridad contractual.**
- El usuario ha confirmado que le gusta el Timeline visual actual y pide reponer llaves en Inspector. Esa dirección **debe preservarse**, sin deshacer los cambios visuales por falta de ratificación de CORR-005.

## 4. Observaciones en código actual

| Sistema | OBSERVADO | NO VERIFICADO / consecuencia |
|---|---|---|
| `src/engine/runtime/nodes/registry.js` | Registra `def.animation` con `registerNodeAnimationProperties` | No hay descriptores productivos por tipo en los módulos de nodo examinados; verificar cobertura dinámica |
| `src/engine/runtime/anim/model.js` | `PROPS` declara seis entradas (`position/rotation/scale/visible/light.energy/light.color`), cuatro `kind` válidos (`vec3/number/bool/color`) | Falta semántica general de refs, enums, strings, subrecursos y dominios específicos |
| `src/components/Inspector.vue` | No contiene la llave contextual de la autoría actual de Codex; sigue mostrando propiedades editables de numerosos dominios | Restituir llave común según UPA **solo tras ratificación y Gate técnico** |
| `src/components/TimelinePanel.vue` | Pistas `node/camera`, `method`, `commands`, `audio`, operaciones de clip todavía reconocidas | Eliminar solo **creación UI** de clips Nodo/Cámara; mantener lectura/Player sin inventar migraciones |
| `src/engine/runtime/timeline/player.js` | Mantiene ramas `method`, `audio` y comandos (eventos) | Paridad real Editor/PlayMode/Player y args aún necesitan QA dirigido |
| `src/engine/runtime/events/play-timeline.js` | Host llama `game.run` y `NodeScriptRuntime` para método de nodo | QA real, seek/loop/stop, receptores eliminados y argumentos pendientes |
| Propiedades Jolt/Canvas/Camera/Audio/materiales | Existen campos editables específicos y propietarios runtime independientes | No permitidos setters arbitrarios sobre objeto autoral o `object3D` |

**OBSERVADO:** el Gate integral de limpieza anterior está bloqueado por alcance contradictorio; su documentación y ledger se conservaron. **INFERENCIA:** finalizar de una vez todas las propiedades con un `set` genérico violaría autoridad, tipo y restauración. **CAUSA RAÍZ ARQUITECTÓNICA:** ausencia de canal tipado+aplicador certificado para la mayor parte de los campos de los propietarios, no ausencia de un botón visual.

## 5. Resolución propuesta

Ratificar `LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-UPA-CA-001` para: (a) establecer de forma inequívoca la ubicación contractual de las llaves en Inspector, incluso si existió la ratificación no aportada de CORR-005; (b) permitir reordenar la certificación de familias especializadas **sin apropiarse de su runtime**; (c) exigir una secuencia de Gates técnicos pequeños, con autoridad y QA propios; (d) preservar diseño visual Codex y activos; (e) simplificar únicamente autoría futura de clips Nodo/Cámara. No sustituye la validación de la procedencia técnica necesaria antes de usar la copia Codex como `SOURCE_BASELINE` autorizado.
