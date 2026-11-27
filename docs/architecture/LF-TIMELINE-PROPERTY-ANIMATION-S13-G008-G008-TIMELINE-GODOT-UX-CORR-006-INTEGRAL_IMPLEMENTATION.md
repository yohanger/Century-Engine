# CORR-006 · Jerarquía visual del Timeline

**Fecha** · 10 de noviembre de 2026  
**Autorización** · `Listo. LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-GODOT-UX-CORR-006-INTEGRAL autoriza comenzar`.

## Base y causa

La carpeta local coincidía byte por byte con los 3.058 archivos del SOURCE_BASELINE de CORR-005. Se usa esa entrega como base de comparación.

La fila de propiedad consumía espacio con un asa de arrastre, un icono de tipo, una llave, mute y bloqueo. A 164 px, sus controles comprimían incluso nombres cortos. La decoración de bordes por fila y selección del nodo debilitaba la percepción de grupo. La corrección se concentra en la plantilla y los estilos de TimelinePanel.

## Implementación

- Una cabecera por nodo, con plegado, icono del tipo real, nombre y llave para añadir propiedades.
- Propiedades subordinadas con sangría uniforme y guía vertical. La superficie y los separadores refuerzan la pertenencia al nodo.
- Se conserva una columna de nombres. Las acciones de propiedad aparecen al pasar el puntero o enfocar con teclado. La llave y el menú comparten un extremo alineado.
- Mute y bloqueo siguen disponibles en el menú original. Sus estados se muestran mientras están activos. La pista bloqueada conserva la llave deshabilitada.
- Las pistas especializadas independientes mantienen los controles existentes. Los nodos miden 27 px y sus propiedades 21 px, igual que la referencia capturada. Las pistas especializadas conservan 36 px. La selección rectangular deriva sus índices de las mismas alturas y respeta el plegado.
- La opción contextual de clave se llama Mostrar detalles y abre el formulario existente dentro del Timeline.

El modelo temporal, el orden de reproducción, los datos autorales, los evaluadores, Audio, Player y la persistencia se conservan. Los cambios de tests sustituyen aserciones sobre iconos y controles permanentes por las interacciones nuevas.

## Referencia visual

Se estudió la agrupación de pistas por nodo en el código de Godot 4.7.2 estable, incluidos AnimationTrackEditGroup y el contenedor de pistas con separación interna cero. El flujo de autoría y el Inspector siguen el contrato ratificado de LevelForge.

Fuente primaria del editor en https://github.com/godotengine/godot/blob/4.7.2-stable/editor/animation/animation_track_editor.cpp

Se ejecutó Godot 4.7.2 estable con una escena equivalente y se extrajeron las dimensiones de sus controles AnimationTrackEditGroup y AnimationTrackEdit. La igualdad de alturas está medida. El tema, la disposición del transporte y la ubicación de los controles mantienen diferencias. El informe de QA conserva las diferencias observadas y el alcance medido.
