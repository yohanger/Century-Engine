# QA obligatorio — LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-PRO-UX-CORR-004-INTEGRAL

**Estado real:** 24 tests nuevos Node PASS; 215 Node regresión principal PASS; 65 Node audio PASS; **25 checks Electron UX NO EJECUTADOS**; Editor/Player **NO COMPILADOS EN ESTE ENTORNO**; QA local usuario PENDIENTE. Gate NO APROBADO / NO CERRADO.

Desde la raíz que contiene `package.json`:

## 1. QA Node específico

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004.mjs
```

**Esperado:** 24 PASS / 0 FAIL. El algoritmo probado proviene de `ContextMenu.vue`, no de una copia paralela.

## 2. Regresión principal

```bash
node --test \
  scripts/test-timeline-property-animation-s13-g008-g006.mjs \
  scripts/test-timeline-property-animation-s13-g008-g007.mjs \
  scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs \
  scripts/test-timeline-hierarchy-dnd-s04-g001.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008-corr003.mjs \
  scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004.mjs
```

**Esperado:** 215 PASS / 0 FAIL. **Ejecutado en este contenedor: 215 PASS.**

## 3. Regresión audio y Camera Binding

```bash
node --test scripts/test-timeline-audio-trim-duration-s12-g002.mjs scripts/test-timeline-zoom-waveform-s12-g003.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs
node --test scripts/test-timeline-camera-node-binding-s11-g002.mjs
```

**Esperado:** audio 65 PASS; Camera Binding 8 PASS. Audio **65 PASS ejecutado aquí**; Camera Binding **NO VERIFICADO** en este contenedor, previa evidencia 8/8 PASS del usuario en CORR-002.

## 4. Electron integrado y compilación

```bash
node --test scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004-electron.mjs
node --test scripts/test-timeline-property-animation-s13-g008-g008-corr003-electron.mjs
node --test scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002-electron.mjs
npm run build
npm run electron
```

**Esperado, NO comprobado aquí:** 25 checks UX CORR-004, 27 CORR-003 y 24 CORR-002; compilación Editor/Player. Si un fixture previo falla por cambio visual de intención, aislar la aserción y no cambiar comportamiento para engañar QA. Las capturas visuales se realizan en **Electron embebido**, no navegador externo.

## 5. Matriz de aceptación visual (UXH, UXM, UXK, UXL)

| ID | Procedimiento real | Criterio obligatorio |
|---|---|---|
| UXH-01 | Abrir Camera3D con Posición, Rotación y Escala | Nodo evidente, propiedades debajo, sangría coherente |
| UXH-02 | Abrir Mesh y Light | Mismo lenguaje de filas, sin iconos superfluos |
| UXH-03 | Renombrar nodo/pista con nombre extenso | Truncado y tooltip, sin ampliar columna |
| UXH-04 | Reducir ancho de lista por resizer | Nombre y controles utilizables, ninguna superposición |
| UXH-05 | Expandir/contraer | Carriles temporalmente alineados, sin saltos de scroll |
| UXH-06 | Hover/foco/selección nodo y propiedad | Diferencias legibles, sin desactivar pistas |
| UXM-01 | Clic derecho en propiedad primera fila | Menú cerca del elemento, por debajo de regla; texto visible |
| UXM-02 | Clic derecho fila inferior con dock bajo | Menú no aparece por encima de regla; scroll interno si falta espacio |
| UXM-03 | Clic derecho cerca borde derecho | Reposicionamiento izquierda/derecha sin recorte |
| UXM-04 | Menú de muchas acciones | Scroll interno, nunca desbordamiento completo |
| UXM-05 | Escape, clic exterior, teclado y scroll de pista | Operan correctamente; menú se cierra/reubica con coherencia |
| UXM-06 | Menú de otros paneles (Assets/Inspector/Cinematics) | Sin regresión del componente compartido |
| UXK-01 | Dos o más keyframes | Rombos puntuales, línea sutil, tiempo exacto |
| UXK-02 | Hover, clic, teclado y selección múltiple | Foco y selección claros, sin salto geométrico |
| UXK-03 | Zoom, scroll y regla | Claves coinciden con ticks/cabezal |
| UXL-01 | Panel 1366×768 | Barra y lista legibles sin desplegables que tapen contenido |
| UXL-02 | Dock estrecho y panel redimensionado | Flujo usable, sin columnas rotas |
| UXL-03 | Scroll vertical de pistas | Fila izquierda sincronizada con carril derecho |
| UXL-04 | Audio, clips de cámara y métodos | Duración, FX, waveform, snap y menús conservados |
| UXL-05 | Guardar/reabrir escena y Timeline | Datos/IDs/tiempos intactos; Undo/Redo sin cambios |
| UXL-06 | Player/PlayMode/Cinematics | Reproducción sin regresión; Cinematics sigue consumiendo FilmMaker |

## 6. Evidencia a devolver

Salida de los tests (Node, Electron y build); capturas de **la misma pista** antes/después con menú contextual abierto, lista de varias propiedades, encabezados plegados y panel estrecho; indicación de cuál comprobación falla o confirmación expresa `QA LOCAL PASS`. El menú debe probarse con la altura de Timeline que reproduce el defecto de las capturas originales. Si no se pudo verificar Player o 1366×768, indicarlo como NO VERIFICADO.

**Separación de estados:** IMPLEMENTADO ≠ TEST NODE PASS ≠ COMPILADO ≠ QA ELECTRON PASS ≠ QA LOCAL PASS ≠ APROBADO ≠ CERRADO. No registrar expectativa como evidencia.
