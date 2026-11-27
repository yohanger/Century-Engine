# CENTURY-EDITOR-UX-S03-G001-CORR-003-NATIVE-DRAG-AND-DROP-CODE-DOCKING

## Autoridad y fuente

Gate autorizado expresamente; mantiene `CE-EDITOR-UX-CA-002-INTEGRATED-CODE-WORKSPACE-AUTHORITY` y las autoridades de Edit/Play. SOURCE_BASELINE: `CENTURY-EDITOR-UX-S03-G001-CORR-002-NATIVE-DOCKABLE-CODE-WINDOW-AND-CORNER-ALIGNED-CONTROLS_SOURCE_BASELINE.zip`. No hay metadatos Git en este ZIP y no se aplican cambios Git.

## Mecanismo implementado

- Code permanece como una vista obligatoria acoplada junto a Edit Mode y Play Mode; no se introducen botones particulares de desacoplar o reacoplar. El botón Code de la barra superior permite el mismo gesto de arrastre que su pestaña central, mediante una regla de salida compartida.
- Al arrastrar la pestaña Code fuera del área principal de Century en Electron, el evento de finalización del arrastre solicita la ventana nativa ya existente. Un drop interno válido no desacopla Code.
- El título **Code** de la ventana nativa actúa como origen de arrastre HTML hacia las zonas de docking, sin agregar un botón. La parte restante de la cabecera mantiene el arrastre nativo de la ventana con `-webkit-app-region: drag` para colocarla en otra pantalla.
- Los destinos de `DockTree` y del viewport central admiten el evento de regreso y colocan Code como pestaña o como división del área central. El editor principal solicita recuperar la misma instancia y el foco al terminar el reacoplamiento.
- Cerrar la ventana nativa también mantiene el retorno automático preexistente. Se conserva `CodeMirror`, su `EditorState`, los documentos en el store, la selección y el historial.
- El control Maximizar/Restaurar se conserva; desaparecen los botones explícitos de traslado. El espacio reservado del menú se reduce al único control central restante.

## Límites y riesgos de verificación

El arrastre entre `BrowserWindow` requiere QA real de Electron/Chromium, especialmente en Linux, con monitores de distinta escala, cambios de foco y arrastres que abandonan la ventana. Las pruebas Node confirman código de eventos, contratos de layout y estados, **no** acreditan por sí solas que el sistema operativo entregue eventos de arrastre entre ventanas. No se agrega una API nativa paralela para detectar la suelta de una ventana física.

No modifica el runtime del juego, el renderer del viewport, la física, escenas ni la API de scripts. No añade dependencias, migraciones o refactors ajenos.

## Estado

Implementación de fuente: sí. Pruebas focales: PASS. Regresión: 9 fallos heredados reproducidos en el baseline anterior. Sintaxis: PASS. Compilación: bloqueada (`vite` no instalado). QA Electron/multimonitor: NO VERIFICADO. Aprobación usuario: pendiente. Cierre: pendiente.
