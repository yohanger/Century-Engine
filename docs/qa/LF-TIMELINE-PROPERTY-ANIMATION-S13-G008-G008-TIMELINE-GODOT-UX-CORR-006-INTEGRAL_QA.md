# CORR-006 · QA visual y de interacción

## Repetición

Desde la raíz del proyecto.

```bash
npm ci
node --test scripts/test-timeline-property-animation-s13-g008-g008-corr006-electron.mjs
npm run build
npm run electron
```

El runner usa Electron del proyecto. Admite LF_QA_WINDOW_WIDTH, LF_QA_WINDOW_HEIGHT y LF_QA_CAPTURE_DIR. La captura informa del tamaño efectivo del lienzo.

## Criterios

1. Cámara presenta Posición y Escala subordinadas. Light_1 presenta su propia Posición. Cada cabecera identifica un nodo y conserva el plegado.
2. Posición se lee completa con columna de 164 px. Los nombres largos tienen elipsis y tooltip.
3. El puntero nativo y el foco de teclado muestran las acciones. La aparición conserva la alineación entre las filas y los carriles.
4. El menú original permite silenciar y bloquear. El estado queda visible y la llave de la pista bloqueada permanece deshabilitada.
5. Nodos de 27 px y propiedades de 21 px coinciden con la referencia real. La selección rectangular reconoce sus filas y selecciona cuatro claves de dos propiedades. Contraer y expandir conserva las pistas y sus claves. Los rombos siguen centrados en el instante temporal.
6. Verificar la lista en dock ancho y estrecho, con nombres largos, menú abierto y selección. Validar aparte proyectos reales con Audio y Cinematics.

## Método

Browser plugin no disponible en esta sesión. Se utiliza el harness Electron exigido por LevelForge. La fixture monta los componentes Vue y el menú compartido. El runner envía movimiento de ratón nativo mediante el protocolo de Chromium. Se registran identidad de página, montaje, errores de carga, geometría DOM, estados de interacción y captura.

El antes se captura con el componente de CORR-005 obtenido del ZIP, servido mediante un plugin temporal de Vite fuera del proyecto. El después usa el componente actual y el mismo contenido de escena. Las capturas y el registro visual se incluyen como evidencia. Las escenas de QA y los textos de ejemplo describen casos de prueba.
