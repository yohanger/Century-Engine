# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-QA-HOST-CORR-001 — Diagnóstico y corrección del host de prueba

**Fecha:** 2026-11-10. **Gate expresamente autorizado.**  
**SOURCE_BASELINE válido:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_NODE_TRACK_HIERARCHY_CORR002_INTEGRAL_SOURCE_BASELINE.zip`, 3.030 archivos; G008-CORR-002 sigue sin cierre.  
**Estado:** IMPLEMENTADO EN TEST ORIGINAL; NODE 157/157 PASS, TEST CAMERA S11-G002 NO VERIFICADO EN ESTE ENTORNO; QA LOCAL PENDIENTE; NO APROBADO NI CERRADO.

## 1. Evidencia recibida del usuario

Archivo `Texto pegado(20261110-180013).txt`:

- `node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs`: 32/32 PASS.
- Batería conjunta de G006/G007/G008/CORR001/CORR002 + DnD: 157/157 PASS.
- `node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002-electron.mjs`: **24 comprobaciones en Electron/WebGL**, 1 test PASS (ejecución en el equipo del usuario).
- `node --test scripts/test-timeline-camera-node-binding-s11-g002.mjs`: 7/8 PASS, un FAIL en `host de PlayMode/Player usa ID y transformación animada...`.
- Traza: `TimelineRunner.seek()` → `audioSeek()` de `_tlHost()` → `self._tlAutomationStop(run)` → **TypeError: self._tlAutomationStop is not a function** en `src/engine/runtime/events/play-timeline.js:394`.

## 2. OBSERVADO / INFERENCIA / CAUSA RAÍZ

**OBSERVADO:** `scripts/test-timeline-camera-node-binding-s11-g002.mjs` construía un objeto `self` con campos sueltos y obtenía `timelineMethods._tlHost.call(self)`. En ese `self` no existían `_tlAutomationStop` ni `_tlAutomationSync`. Las llamadas del host `audioSeek` y `audioStop` las necesitan aunque una Timeline no tenga pistas de audio.

**CONTRASTE CON PRODUCCIÓN:** `src/engine/runtime/events/play.js` incorpora `timelineMethods` en `PlayMode.prototype` mediante `Object.assign`, mientras que el test no reproducía ese contrato del prototipo. `src/engine/runtime/timeline/player.js` llama a `host.audioSeek` en `seek()` como parte del contrato normal, sin condicionarlo a existencia de audio. Los tres módulos runtime y el test S11-G002 son idénticos entre los baselines CORR-001 y CORR-002 para este defecto.

**CAUSA RAÍZ VERIFICADA EN CÓDIGO:** configuración incompleta del doble de PlayMode usado en el test S11-G002. No es evidencia de que CORR-002 haya introducido una regresión en jerarquía, ni justifica modificar el runtime para admitir hosts inválidos.

## 3. Cambio técnico preciso

**Único archivo productivo ajeno a documentos modificado:** `scripts/test-timeline-camera-node-binding-s11-g002.mjs` (test original, no runtime).

- `self` se construye con `Object.assign(Object.create(timelineMethods), { ...estado y dobles existentes... })`, imitando la herencia de métodos que tiene PlayMode real.
- Se invoca `self._tlHost()` de modo equivalente al uso real.
- Antes de obtener el host, se aserta la existencia real de `_tlAutomationStop` y `_tlAutomationSync`, sin mocks ni métodos vacíos que tapen el fallo.
- El resto de las 8 comprobaciones S11-G002 permanecen sin modificaciones y siguen exigiendo identidad/transformación de Camera3D, SceneId, manejo de ausencia y limpieza al parar.
- No cambian `src/`, Timeline, Jolt, Camera Orchestration, Audio Automation, ni el formato del Player; sin harness nuevo ni dependencias nuevas.

## 4. Evidencia nueva realmente ejecutada

- Sintaxis de `scripts/test-timeline-camera-node-binding-s11-g002.mjs`: **NODE --check PASS**.
- `node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs`: **32/32 PASS**.
- Regresión de siete suites Node seleccionadas G006/G007/G008/CORR001/CORR002/DnD: **157/157 PASS**.
- **Smoke de contrato de host (PASS limitado):** ejecuté los métodos reales de `src/engine/runtime/events/play-timeline.js` con un host de prototipo correcto y una Timeline sin pistas de audio. `audioSeek`, `audioLoop` y `audioStop` finalizaron sin excepción y avanzaron `_automationEpoch` de 1 a 3. Verificación aislada en memoria sin dependencias de Vue/Three.js; **no equivale a las 8 pruebas S11-G002**.
- Ejecución de S11-G002: **NO VERIFICADO tras la corrección**. En este contenedor faltan dependencias Vue/Three.js: `ERR_MODULE_NOT_FOUND` sobre `node_modules/vue/index.js`. El intento `npm ci --ignore-scripts ...` terminó en un error del ejecutor npm y no reparó las dependencias. No presentar como PASS.
- Electron 24/24: **evidencia local del usuario de la entrega CORR-002 ANTERIOR a esta corrección**, no una ejecución nueva en este contenedor.
- Build Editor y Player, PlayMode local y AppImage independiente: **NO VERIFICADOS en este Gate**.

## 5. Contratos preservados y alcance

G005 ratificado, UA-CA-001 ratificado, CA-TB01-001 ratificado. No cambiar semántica de automatización de audio, pistas de cámara, rutas de propiedad, persistencia, sincronización temporal ni propiedad física. No resolver ni encubrir dependencia de acceso directo `object3D` de G007. G008-CORR-002 permanece pendiente de aprobación/cierre hasta QA local y evidencias correspondientes.

## 6. Próxima acción

Aplicar CHANGE tras comparación de modificaciones locales. Ejecutar S11-G002 y confirmar **8/8 PASS**, luego 157/157, Electron (24 checks), `npm run build` Editor/Player y QA visual de la jerarquía. Si S11-G002 falla por otra causa, conservar el error completo y abrir diagnóstico sin declarar FIXED. Aprobar y cerrar solo tras evidencia y decisión del usuario.
