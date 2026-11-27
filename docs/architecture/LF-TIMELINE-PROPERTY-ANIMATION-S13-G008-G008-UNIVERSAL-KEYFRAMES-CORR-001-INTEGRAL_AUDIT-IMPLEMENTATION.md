# LevelForge — G008-CORR-001 · Auditoría y cambio implementado

Fecha: 2026-11-10. Gate **autorizado literalmente**: `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-KEYFRAMES-CORR-001-INTEGRAL`.

SOURCE_BASELINE comparado: `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_UNIVERSAL_ANIMATION_CONTRACT_AMEND_G001_SOURCE_BASELINE(1).zip` adjunto por el usuario (3.017 archivos). **UA-CA-001 RATIFICADO**. G007 y G008 anteriores NO APROBADOS, sin certificación completa de acceso directo `object3D`.

## 1. Diagnóstico, separado por grado de evidencia

**OBSERVADO EN CÓDIGO:** `PROPS` tenía seis entradas y `Inspector.vue` implementaba cinco llaves manuales. `registerNode()` ya registraba tipos sin metadata de animación; `Timeline` y Clips leían el mismo catálogo tipado. `TimelineRunner`, TimelinePreview, PlayMode y Player utilizan hosts preexistentes. Existían dos `aria-label` con comillas inválidas en el Inspector G008 previo.

**CAUSA RAÍZ ARQUITECTÓNICA:** la vinculación del control de llave estaba escrita campo a campo y la definición de nodos no ofrecía una extensión tipada para nuevos canales; implementar otros nodos de esa forma duplicaría condiciones y sembraría deuda.

**INFERENCIA / RESERVA:** una propiedad con callbacks declarados es estructuralmente evaluable, pero su funcionamiento real en Player, sus interacciones físicas y la exposición a escritores arbitrarios `object3D` solo se consideran certificados tras QA integrado. La nueva infraestructura no resuelve la reserva G007.

## 2. Mecanismo aplicado — EXTEND BEFORE DUPLICATE

- `src/engine/runtime/anim/model.js`: mantiene `PROPS` como **único catálogo tipado que ya consumen Clips y Timeline**. Añade validación declarativa `registerNodeAnimationProperties()`, `nodeAnimationProperty()` y `nodeAnimationProperties()`. IDs de canales nuevos deben estar cualificados (p.ej., `props.pulse`, `vfx.speed`) y no colisionar con otro tipo/semántica; se rechaza la duplicación. Cada descriptor proporciona label, tipo, default, lector de dato autoral, aplicador runtime, captura y restauración. Los valores y rangos pasan por el validador existente; los datos incompletos no ofrecen llave. No hay reflexión arbitraria ni `eval`.
- `src/engine/runtime/nodes/registry.js`: extiende `registerNode()` para que la metadata venga **de la definición propietaria**, en lugar de otra jerarquía/global manager. No se introduce ningún nodo productivo nuevo en este Gate.
- `src/core/timeline/model.js`: `ensureTimelineNodePropertyTrack` verifica compatibilidad nodo/propiedad usando la misma API, conserva IDs existentes y bloquea mezclas no certificadas de pistas tipadas. `upsertTimelineNodePropertyKey`, Undo/Redo y almacenamiento no cambian de formato.
- `src/engine/runtime/timeline/eval.js`: reutiliza `sampleAnimationTrack` para nuevos canales declarados, preservando las curvas espaciales y el comportamiento heredado. Para las propiedades nuevas, no se habilitan clips mezclables que el evaluador no soporte.
- `src/components/PropertyKey.vue` (única pieza UI nueva indispensable): control de llave compartido por cinco campos originales y por el renderizado de propiedades declaradas. `src/components/Inspector.vue`: elimina cinco implementaciones repetidas de botón, corrige `aria-label` rotos y genera automáticamente una sección de propiedades animables adicionales (valor autoral y llave) a partir de metadata. Esto no sustituye ni duplica el Inspector general ni introduce Auto-Key. Los controles autorales especializados seguirán siendo responsabilidad de cada sección propietaria.
- `src/core/timeline/preview.js`: para descriptores nuevos, conserva la escritura visual temporal y captura/restaura snapshot runtime, sin reescribir datos persistentes; mantiene las rutas de Light y transformaciones. Al cambiar el valor autoral durante Preview utiliza el lector del propietario.
- `src/engine/runtime/events/play-timeline.js`: añade los canales declarados al arbitraje/reservas y restauración **ya existentes** de G007, sin alterar la política vigente de luces, física o cámaras. El host aplica `spec.apply()` solo para ID y escena vigentes, y solo si el canal está reservado por ese Timeline. No se crea servicio global.
- `src/engine/runtime/events/play-anim.js`: reutiliza `spec.capture()` y `spec.apply()` dentro del host de Animation Clips; respeta la reserva temporal vigente y no desactiva canales ajenos al conflicto.
- `src/engine/runtime/nodes/*`: ninguno de los tipos productivos cambió de semántica ni recibió descriptores especulativos. El ejemplo `props.pulse` existe **solo en pruebas** y no se serializa en proyectos de usuarios.

## 3. Qué demuestra el Gate, qué NO demuestra

Demuestra en pruebas puras: registrar tipo ficticio sin añadir if en Inspector/Timeline/evaluador, lector y aplicador del dueño, pistas con IDs estables por escena y nodo, clave/tiempo/Undo-G008 de referencia, validación de valores, snapshot y curvas de Clips. La implementación reutiliza los hosts reales y la reserva G007.

**NO DEMUESTRA:** todos los campos productivos animables ya; todos los tipos de propiedades Godot (eventos, refs, enums) implementados; Camera3D/Canvas `.ui`/VFX/materiales/audio/Script expuestos universalmente; Jolt dinámico y raw `object3D` mediados; compilación Electron/Player; QA visual local. Esos resultados siguen en Gates posteriores o pendientes. No declarar FIXED/CERRADO ni «sistema universal terminado».

## 4. Dependencias y decisiones

- G005 TA-01/02/03/10 se amplían solo conforme UA-CA-001 ratificado; no se derogan otras cláusulas.
- TB01 de G007 sigue vinculante: propietario por (escena/nodo/propiedad), snapshots, stop/skip/cambio de escena y Jolt; acceso directo `object3D` continúa **NO VERIFICADO**.
- G008 original de selección al primer clic no se refactorizó, y se mantiene su regresión.
- G009 Canvas, G010 Camera3D, G011 aspecto/letterbox, G012 tipos especializados, G013 UX, G014 QA integral siguen pendientes y no son parte de esta autorización.
- El formato persistido antiguo permanece intacto; no hay migración especulativa. Un ID de animación nuevo de dueño debe ser globalmente cualificado para impedir conflictos entre semánticas diferentes; no se permiten alias implícitos.

## 5. Evidencia

- `node --test` combinado: **113 PASS** (24 nuevos UA + 24 G008 previos + 15 G007 + 26 G006 + 24 geometría). Estos resultados proceden de pruebas Node seleccionadas y estáticas, NO de electron real.
- Sintaxis JS de producción y módulo fixture: comprobada mediante `node --check` (0 errores).
- Electron 30 checks reales de InspectorDock/llaves preparados como fixture, **NO EJECUTADOS** aquí.
- `npm run build` Editor/Player: **NO VERIFICADO** por ausencia local de `vite`/dependencias.
- Player exportado y Jolt: **NO VERIFICADOS**. Aprobación/QA usuario: **PENDIENTES**.

Ver `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-KEYFRAMES-CORR-001-INTEGRAL_QA.md`.
