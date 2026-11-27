# QA — LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-PROPERTY-KEYFRAMES-CAMERA-DROP-UX-CORR-003-INTEGRAL

**Estado:** Test Node seleccionados 191/191 PASS; audio seleccionados 38/38 PASS; Electron/compilación/QA local posteriores a este Gate PENDIENTES. No dar por PASS nuevos los 24 checks de CORR-002 ni el build anterior.

Desde la raíz que contiene `package.json`:

## 1. Node específico

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-corr003.mjs
```
**Esperado:** 34 PASS / 0 FAIL.

## 2. Regresión de propiedades y Jerarquía

```bash
node --test \
  scripts/test-timeline-property-animation-s13-g008-g006.mjs \
  scripts/test-timeline-property-animation-s13-g008-g007.mjs \
  scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs \
  scripts/test-timeline-hierarchy-dnd-s04-g001.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008-corr003.mjs
```
**Esperado:** 191 PASS / 0 FAIL.

## 3. Regresión de audio y Camera Binding

```bash
node --test \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs \
  scripts/test-timeline-audio-trim-duration-s12-g002.mjs \
  scripts/test-timeline-audio-fade-handles-s11-g007-g001-corr001.mjs
node --test scripts/test-timeline-camera-node-binding-s11-g002.mjs
```
**Esperado:** audio seleccionado 38 PASS; Camera Binding 8 PASS (anteriormente comprobado por el usuario; NO EJECUTADO AQUÍ por falta de Three.js).

Nota de QA histórico: `scripts/test-timeline-unity-replacement-s10-g004-integral.mjs` tiene una aserción literal preexistente `G004-29` referida a un mensaje de pista bloqueada que ya no figura en el SOURCE_BASELINE anterior. No hay cambios de comportamiento en esta entrega relacionados con ese texto. Se registra separadamente, sin declarar la batería integral PASS ni cambiar el test para maquillar el resultado.

## 4. Electron con componentes originales y build

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002-electron.mjs
node --test scripts/test-timeline-property-animation-s13-g008-g008-corr003-electron.mjs
npm run build
npm run electron
```

Esperado: fixture CORR-002 adaptada a selección explícita con 24 verificaciones PASS; fixture CORR-003 con 27 verificaciones PASS. Compilación Editor y Player sin errores. **No se ejecutaron aquí**; no confundir salida Vite con QA visual.

## 5. Matriz QA manual integral

| ID | Acción | Resultado obligatorio |
|---|---|---|
| KF-01 | Crear pista Posición de Camera3D y Ctrl+doble clic a 1.5 s | Un marcador puntual en tiempo correcto |
| KF-02 | Repetir Ctrl+doble clic en el mismo tiempo | No duplica clave, conserva ID |
| KF-03 | Ctrl+doble clic en Energía de Light | Valor number real, sin vec3 ficticio |
| KF-04 | Inspector de Light Color -> llave | Valor color tipado; misma autoría que carril |
| KF-05 | Doble clic sin Ctrl | No crea keyframe en propiedades |
| KF-06 | Doble clic sobre clave existente | No crea otra |
| KF-07 | Pista bloqueada o recurso no editable | Sin modificación |
| KF-08 | Seleccionar/mover/duplicar/eliminar claves | Undo/Redo e inspector temporal coherentes |
| CAM-01 | Arrastrar Camera3D al fondo del Timeline | NO crea toma; ofrece propiedades y acción de toma |
| CAM-02 | Seleccionar Animar Posición | Solo pista node del mismo Camera3D |
| CAM-03 | Seleccionar Añadir toma | Pista camera válida con autoridad S15 existente |
| CAM-04 | Soltar Camera3D-B sobre pista camera | Cambio de fuente explícito en tiempo correcto |
| CAM-05 | Animar camera sin toma | NO adquiere cámara de render |
| CAM-06 | Abrir proyecto con pistas camera previas | Misma reproducción y autoridad de fuentes |
| UX-01 | Varias claves de Posición | Rombo pequeño por clave, línea discreta, sin barra/asa de duración |
| UX-02 | Zoom, scroll y cabeza de reproducción | Marcadores y filas sincronizados |
| UX-03 | Nodo expandido/contraído y grupos manuales | Sin duplicar filas ni pistas persistidas |
| UX-04 | Pistas Audio, Commands, Method y clips reales | Conservan banda, forma de onda, FX, menús y recortes |
| UX-05 | Inspector desde Timeline/Cinematics → mismo nodo | Propiedades al primer clic |
| UX-06 | Guardar/reabrir, Undo/Redo | IDs, tiempos y tipos conservados |
| IN-01 | PlayMode/Player, Cinematics/FilmMaker | Sin cambios de evaluación ni ownership |
| IN-02 | Jolt, Camera Orchestration y G007 | Sin mutaciones no autorizadas; object3D sigue NO CERTIFICADO |
| PERF-01 | Abrir Timeline con muchos nodos/claves | Sin pérdida significativa de respuesta ni evaluación duplicada por frame |
| PERF-02 | Cambiar propiedades/zoom al trabajar en PC modesta | Sin interferencia visual, scroll y selección fluidos |

## Evidencia a devolver

Salida de las cuatro ejecuciones Node, los dos tests Electron, `npm run build`; captura/vídeo de **Camera3D arrastrada sin toma**, opción explícita `Añadir toma`, Posición con 2 rombos y Ctrl+doble clic en valores tipados. Confirmar resultado visual y reproducción en Editor y Player. Indicar cualquier falla/no ejecutado por separado.

**Estados:** IMPLEMENTADO ≠ TEST PASS ≠ COMPILADO ≠ QA LOCAL PASS ≠ APROBADO ≠ CERRADO.
