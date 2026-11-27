# S13-G008-G007 — Evaluación temporal integral de propiedades

**Gate técnico:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TEMPORAL-EVALUATION-INTEGRAL`.
**Autorización literal:** recibida 2026-11-10. **Contrato marco G005:** RATIFICADO. **CA-TB01-001:** RATIFICADO.
**Baseline de entrada:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G007_TB01_AUTHORITY_CONTRACT_AMEND_G001_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO EN FUENTES; QA NODE PARCIAL PASS, BUILD, QA GRÁFICO, JOLT REAL y PLAYER INDEPENDIENTE NO VERIFICADOS. **NO CERRADO**.

## Diagnóstico previo

- **OBSERVADO:** `src/engine/runtime/timeline/eval.js` bloqueaba los canales tipados nuevos; `TimelineRunner` aplica muestras desde `_apply()`. `play-timeline.js` disponía de un host de nodo, sin posesión general de propiedades. `play-anim.js` podía aplicar después una clave de Clip sobre la misma luz. `play-light.js` ofrecía setters de energía, color y fundidos para scripts. `TimelinePreview` solo realizaba snapshots de pose/visibilidad.
- **INFERENCIA:** habilitar las luces sin coordinación permitiría que Clip, Script y Timeline se alternaran el valor efectivo. No se declaró causa raíz de un fallo real sin reproducirlo.
- **CONTRATO:** autoridad por canal, snapshots para nuevos valores tipados, preservación de salidas históricas, rechazo de escritores incompatibles, edición no destructiva y reserva física bake intacta.

## Cambios y mecanismos

1. **Catálogo:** se habilitan **exclusivamente** `light.energy` y `light.color` como canales tipados reproducibles. Se reutilizan `PROPS`, `validatePropertyValue`, `sampleTrack` y `easeValue` originales de Animation Clips. Energía interpola `number` en unidades del modelo; color interpola los componentes **sRGB codificados de 8 bits**, según el evaluador compartido. No se presenta como mezcla físicamente lineal.
2. **Modelo y normalización:** distingue propiedades vec3 históricas de valores number/color. Conserva referencia estricta `sceneId + nodeId + propertyId`, IDs de pistas/keys, serialización y validación existentes. Los clips de fuente para las dos propiedades nuevas permanecen **no habilitados** hasta certificar crossfade tipado; no se reinterpretan como curvas vec3.
3. **Play Mode:** extiende `_tlInit`, `_tlHost`, `timelinePlay` y `_tlEnded` para reservar solamente los dos canales nuevos en un `Map` **de instancia de PlayMode**, sin gestor global ni persistencia. Antes de comenzar una sesión se comprueba que los canales estén libres, correspondan a una luz activa en la escena y tengan aplicador; si falla uno, el lanzamiento completo se rechaza. El snapshot se captura una vez por sesión.
4. **Aplicación:** el mismo host de nodo aplica energía/color mediante `_lightHandle`, reutilizando los setters existentes; un token local en `_tlWriting` permite exclusivamente la escritura del Runner propietario. La fuente del proyecto no se reescribe.
5. **Scripting y Animation Clips:** los setters y fundidos públicos de luz rechazan con error una escritura sobre el canal reservado, mientras los canales independientes continúan. `AnimRunner` omite exclusivamente el canal conflictivo; su resto de pistas y reloj no se cancelan. No se creó un interceptor global.
6. **Restauración y ciclo de vida:** Stop, Skip y fin natural liberan y restauran snapshots runtime si la sesión, la escena y el objeto siguen vigentes. Pausa, seek y loop conservan el mismo snapshot. Desactivar un nodo, eliminarlo o cambiar escena invalida su posesión y evita escribir sobre referencias obsoletas. `_tlReset` descarta reservas sin restaurar objetos de escena en transición.
7. **Editor:** TimelinePreview aplica los mismos valores de luz a los objetos visuales de la escena y utiliza su snapshot existente para devolver energía, color e indicadores sin escribir en el `.ui`, proyecto o recurso. Los cambios autorales del Inspector siguen teniendo prioridad al restaurar.
8. **Histórico:** las cuatro pistas `position`, `rotation`, `scale` y `visible` conservan su ruta de aplicación y su salida previa; el bake Jolt conserva su posesión física especializada. No se introducen checks de versión/Gate en el runtime.

## Límites y riesgos abiertos

- **Solo API mediada de luces:** se han protegido los setters `game.node(...).light`, sus fundidos y `AnimRunner`; no se ha demostrado que todas las modificaciones directas de objetos Three.js a través de `object3D` respeten la misma reserva. Una escritura directa no mediada sigue **NO CERTIFICADA** y no puede presentarse como protección universal. Resolverla requeriría auditar el API público y, si fuera indispensable, un Amendment o corrección específica; se prohíbe instalar interceptores universales especulativos.
- Los sistemas de **Jolt dinámico** y transformaciones anteriores mantienen comportamiento aprobado: G007 no añade autoridad genérica a poses dinámicas ni llama a `makeKinematic` desde nuevas pistas. QA con Jolt WASM real sigue pendiente.
- Animation Clips embebidos en modelos, scripts con referencias directas a Three.js y shaders no se certifican con los tests Node puros de este Gate.
- El host de Timeline permite que una pista de luz activa use valores number/color únicamente si la referencia de escena coincide. No se habilitan por inferencia Canvas, Camera3D FOV, Aspect Ratio ni otros canales.
- Los tests de G006 que comprobaban la **ausencia** de reproducción antes de G007 se actualizaron para comprobar la nueva condición real, conservando sus pruebas de identidad, persistencia, validación y compatibilidad.

## Próxima acción

El usuario deberá ejecutar `node --test` sobre ambos scripts G007, la regresión G006/Geometría, `npm run build` y `npm run electron`. La ejecución WebGL y la de Player exportado requieren evidencia independiente; no se declara QA LOCAL PASS antes de ella. Si surge conflicto no mediado en rutas de scripting, el canal correspondiente quedará bloqueado para aprobación y se abrirá CORR dentro del alcance aprobado o CA cuando el contrato lo requiera.
