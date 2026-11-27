# LF-TIMELINE-VISUAL-PREVIEW-S08-G001-INTEGRAL — CORR-001

**Origen:** QA del usuario, captura `image(20261106-011138).png` (2026-11-05).
**Autoridad:** Gate S08 integral previamente autorizado; corrección del cabezal dentro de UX temporal. No se crea un Gate nuevo.
**Baseline:** `LF_TIMELINE_VISUAL_PREVIEW_S08_G001_INTEGRAL_SOURCE_BASELINE` acumulativo.
**Estado:** IMPLEMENTADO EN FUENTES · COMPILACIÓN VUE/EDITOR NO VERIFICADA · QA LOCAL PENDIENTE · GATE ABIERTO.

## Diagnóstico

**OBSERVADO:** La línea roja del cabezal era un `div.playhead` con `pointer-events:none` y un triángulo dibujado con borde; no podía arrastrarse desde su propia forma. Solo el clic/drag de la regla invocaba `scrubDown`.

**OBSERVADO:** `src/core/timeline/preview.js` excluye `commands`, `method` y `audio` explícitamente. La vista previa solo aplica cámara, nodos y pistas de física horneada. `TimelinePlayer` de gameplay tiene un mecanismo separado de despacho de eventos.

**CAUSA RAÍZ del arrastre directo:** ausencia de un control interactivo sobre la regla vinculado al playhead. **No se demuestra que la falta de preview de comandos sea un fallo**; es una frontera intencional de seguridad para evitar ejecutar efectos secundarios mientras se edita.

## Corrección aplicada

- `src/components/TimelinePanel.vue`: asa roja con forma de marcador en la regla, alineada con la línea roja; desplazamiento por puntero sin salto inicial, parada de reproducción cuando empieza el arrastre y límites del rango temporal.
- Reutilización de `scrubDown` y `ph` existentes, sin otro reloj, almacén temporal ni controlador paralelo. Se conserva el arrastre por la regla.
- Acceso por teclado: flechas avanzan según el ajuste de Snap (o 0.1 s en modo libre), Home/End saltan a los extremos; se exponen los valores mediante ARIA.
- `src/core/timeline/preview.js` **no se modifica**: comandos y métodos permanecen no ejecutables durante Edit Mode. Para solicitar su ejecución en preview se necesitará definir un contrato explícito de operaciones reversibles y efectos secundarios; el Gate S08 no autoriza ejecución arbitraria.
- `scripts/test-timeline-visual-preview-s08-g001-corr001.mjs`: comportamiento del drag y límites, limpieza de listeners, scrubbing previo, teclado y frontera del preview.

## QA ejecutado

- 8 suites Node seleccionadas: **83 PASS, 3 SKIP (Vue ausente), 0 FAIL**.
- El test nuevo por sí solo: **6 PASS, 1 SKIP, 0 FAIL**.
- Sin compilador Vue instalado en este entorno; compilación Vite y QA visual Electron **NO VERIFICADOS**.

## QA local obligatorio

Desde la carpeta raíz con `package.json`, después de comparar y respaldar archivos locales afectados:

```bash
node --test scripts/test-timeline-visual-preview-s08-g001-corr001.mjs scripts/test-timeline-visual-preview-s08-g001-integral.mjs
npm run build
npm run electron
```

1. Abrir Timeline con claves y comprobar que el marcador rojo se ve arriba de la línea en la regla.
2. Arrastrar el marcador desde su borde: el tiempo no debe saltar al pulsar; debe actualizar viewport para pistas de nodo/cámara sin tocar el modelo persistido.
3. Repetir con scroll horizontal, zoom bajo/alto, tiempo cero y final; comprobar límites y alineación de la regla.
4. Seleccionar el marcador con teclado; usar flechas/Home/End, verificar lectura del tiempo.
5. Hacer clic y arrastrar en regla como antes; mover claves sin interferencia.
6. Los bloques de comandos/métodos se ven, pero **no se ejecutan al hacer scrub ni en preview Edit**. Probar ejecución en Player/Play por separado según contrato.
7. Comprobar que salir del Timeline restaura el preview de nodo/cámara y que no hay regresiones del docking.

**Evidencia requerida:** log Node/build, captura del marcador en la regla, vídeo de drag y del viewport, y respuesta sobre la ejecución de comandos en Play (si se prueba). No declarar aprobado ni cerrado sin evidencia.

## Entrega

Exactamente dos ZIP: CHANGE con archivos nuevos/modificados y SOURCE_BASELINE completo. No se eliminan archivos y no se modifica FilmMaker, Cinematics, Player, runtime ni formato de proyectos. Ledger sincronizado en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY.
