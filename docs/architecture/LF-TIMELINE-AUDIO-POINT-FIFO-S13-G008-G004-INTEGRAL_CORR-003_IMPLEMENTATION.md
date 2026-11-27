# LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-003 — Implementación

**Fecha:** 2026-11-09. **Estado:** IMPLEMENTADO · Node 170 PASS · Chromium DOM aislado PASS · Electron/build CORR-003 NO VERIFICADOS · QA LOCAL PENDIENTE · NO APROBADO/NO CERRADO.

## Autorización y autoridad

Autorización literal del usuario: `Listo. LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-003 autoriza comenzar`.

SOURCE_BASELINE íntegro anterior: `LF_TIMELINE_AUDIO_POINT_FIFO_S13_G008_G004_INTEGRAL_CORR002_SOURCE_BASELINE.zip` (2.925 archivos). El código real y contrato FIFO anterior constituyen la base; la modificación preserva la enmienda `CA-LF-TIMELINE-AUDIO-POINT-ORDER-001` y la corrección PCM acumulada.

## Observado — registro Electron del usuario

- Node focal 157/157 PASS.
- Electron FIFO 25/25 PASS; Audio Trim 46/46 PASS; automatización S11 37/37 PASS.
- Inspector S12: 38/40 aserciones PASS, dos FAIL en «Puntos pueden abrirse independientemente» y «Cerrar un punto no cierra otro».
- En la misma ejecución Inspector, el resto de comprobaciones de nombre, persistencia, scroll a cinco, duplicación y no modificación de interpolación sí pasó.

## Causa raíz confirmada

El Inspector presenta puntos según FIFO (`createdOrder` ascendente), mientras que una fixture histórica S12 seguía seleccionando el elemento `headers()[0]` para comprobar la expansión independiente de `namedHeader()` (buscado por «Lluvia tenue»). Tras FIFO ambas referencias apuntan al mismo Punto-1. La prueba abría/cerraba un único control y le exigía simultáneamente dos estados incompatibles. El mecanismo real de producción `toggleVolumePoint(point.id)` es independiente por ID y la fixture nueva FIFO pasó 25 verificaciones en el usuario.

Este diagnóstico no prueba por sí solo toda la interacción real de Electron; por eso se requiere QA local final.

## Mecanismo aplicado

Único archivo existente de interfaz de pruebas modificado: `scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html`.

Se reutiliza el `aria-label` existente del botón de eliminación `Eliminar punto ${point.id}` para ubicar la fila correcta y su `.volume-point-toggle`, mediante una función pequeña de la propia fixture (`pointHeaderById`), sin añadir estado o componentes. La fixture conserva el ID capturado del primer punto y emplea el identificador preexistente `auto-2` del segundo punto creado. Se exige expresamente que ambos encabezados existan **y sean diferentes** antes de comparar `aria-expanded`.

El flujo funcional ahora es: abrir `auto-2` y verificar ambos abiertos; cerrar el primer punto y verificar primero cerrado, segundo abierto. No se presupone orden de renderizado ni se reduce ninguna de las 40 comprobaciones originales.

Nuevo archivo `scripts/test-inspector-audio-volume-points-s12-g007-g001-corr003.mjs`: 13 regresiones Node para selectores por ID, orden FIFO e invertido, transiciones independientes, ausencia de alias, cobertura histórica y sintaxis.

## Alcance, exclusiones y contradicciones

- No se modifica `TemporalResourceInspector.vue`, `automation.js`, `model.js`, `TimelinePanel.vue`, renderizado PCM, Preview, Player, audio DSP, proyecto, escenas, Assets, serialización ni el runner Electron compartido.
- El contrato FIFO y las 40 aserciones originales se conservan. No se ajustan tiempos, tolerancias ni datos de producción.
- No hay contradicción contractual nueva: se corrige exclusivamente una expectativa histórica obsoleta de QA.
- No se crea un gestor ni una segunda fixture paralela del Inspector. La prueba nueva complementa la existente.

## Evidencia y cierre

Node focal de 9 scripts: **170 PASS, 0 FAIL**. Batería ampliada CORR-003: **832 PASS, 19 SKIP, 12 FAIL**, los **mismos 12 fallos históricos** del SOURCE_BASELINE CORR-002 (**819 PASS, 19 SKIP, 12 FAIL**). Prueba DOM Chromium aislada: PASS con inversión de orden DOM. Electron/build del Gate: NO VERIFICADOS en este entorno por falta de Vite.

Siguiente acción: el usuario ejecuta el Electron Inspector S12 (40/40), las regresiones FIFO/Trim/Automatización, `npm run build`, QA visual y devuelve la evidencia. Cierre solo tras su aprobación.
