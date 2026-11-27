# LF-EDITOR-UX-S01-G002 — Escala y gizmos del editor

**Autorización literal:** `Listo. LF-EDITOR-UX-S01-G002 autoriza comenzar` (2026-10-25).
**Baseline obligatorio:** `LevelForge_EDITOR_UX_S01_G001_SOURCE_BASELINE.zip` (730 archivos; Three.js 0.186.1).
**Estado:** IMPLEMENTADO EN FUENTE; pendiente QA visual y compilación Editor/Player en Linux.

## Origen del problema y decisiones

- No fue el raycast nuevo quien imponía escala 2: `PRIMITIVES` tenía explícitamente `[2,2,2]` para cubo/esfera y `[2,3,2]` para cilindro/cono; `event.js` configuraba `[2,2,2]`. Se han establecido por defecto `[1,1,1]` al **crear nuevas instancias** de esos cinco tipos. Las dimensiones de los objetos ya guardados permanecen intactas. Rampas, escaleras, planos y zonas funcionales (`Trigger`, `Navigation`, `AtmosphericVolume`) conservan sus dimensiones deliberadas, que representan tamaño funcional, no un error de la escala global.
- `TransformControls` oficial sitúa los manipuladores de ejes en extremos positivos. En vista trasera podían quedar detrás de la geometría. Se duplican solo los meshes/pickers X/Y/Z para los modos traslación y escala, reflejando el atributo de geometría en la dirección correspondiente, preservando `name`, `tag`, materiales, objetivos y lógica oficial de arrastre/snapping. Los ejes físicos NO cambian de signo. La rotación ya usa aros; no se duplica.
- Three.js oculta un eje casi coincidente con el vector de mirada para evitar la proyección degenerada. Este comportamiento oficial se conserva; no se garantiza un arrastre matemáticamente determinado cuando se mira **exactamente a lo largo del eje**. El objetivo de la corrección es facilitar la selección **desde el lado contrario del objeto**, no permitir manipulación imposible con proyección nula.
- El cambio usa `_gizmo`, una estructura interna que **ya utilizaba** `gizmo.js` antes de este Gate. El apoyo en APIs internas queda documentado como dependencia de Three.js r186.1; toda futura actualización deberá comprobarlo.

## Ayudas propias del nodo: solo seleccionado

`selectionMethods._syncNodeGizmos` aplica visibilidad de `root.userData.editorGizmos`, `indicatorZonesGizmo` y previsualización de celdas al seleccionar/deseleccionar. Se ejecuta tanto en `setSelection` (incluye multiselección) como en `_nodeBuilt` y `_nodeSynced` (reconstrucción, cambio de inspector, Undo/Redo). Durante Play o edición de malla se esconden estas ayudas editoriales. No se modifica `SceneGraph` compartido con Player.

- **Audio:** anillos próximos/lejanos y orientación solo al seleccionar; los marcadores y el comportamiento sonoro permanecen. Audio UI no muestra anillos.
- **Luz:** flechas de direccional/foco y marco/flecha de área solo al seleccionar; la luz real, su icono y Lensflare permanecen. La orientación y vínculo sol/luna quedan para G003.
- **Cámara, Player Spawn:** frustum o flecha de orientación solo al seleccionar, marcador visible.
- **Event, Trigger, atmósfera, Navigation, Group:** indicadores de región y ejes editoriales condicionados. Se mantiene selección desde un proxy pequeño fuera del visual oculto o un marcador central. El contenido del evento (preview) no se suprime.
- **Gameplay Object:** zonas de indicadores a la selección; su representación real y datos no cambian.
- **Critters:** anillo de radio condicionado; marcador visible.
- **Canvas:** marco, esquinas y relleno condicionado; rótulo sigue visible para ubicar y seleccionar el Canvas. El Canvas de UI del juego no se toca.

## QA automatizada

- `node --test scripts/test-editor-ux-s01-g002.mjs`: **16 PASS, 0 FAIL, 0 SKIP**. Evalúa escalas y excepciones; asas y pickers espejados (identidad, dimensiones, no duplicación), multiselección, toggles específicos, reconstrucción, iconos, selección por proxy y widgets.
- Regresión acumulada de scripts/test-*.mjs **excepto test-starcat.mjs**: **887 PASS, 0 FAIL, 18 SKIP**. Los SKIP requieren Three.js y otras dependencias no instaladas en el entorno de preparación.
- `node --check` para JS modificado: **PASS**.
- `npm run build`: **NO VERIFICADO**; `vite: not found` (node_modules ausente). No inferir build ni funcionamiento WebGL/GPU.

## QA visual y funcional obligatorio en Linux

| Caso | Acción | Criterio de aceptación |
|---|---|---|
| UXG2-01 | Crear cubo, esfera, cilindro, cono y Event | `Scale = (1, 1, 1)` al crear; posición G001 conservada |
| UXG2-02 | Crear Trigger, Navigation, AtmosphericVolume, rampa/plano/escalera | Conservan dimensiones funcionales diseñadas |
| UXG2-03 | Abrir proyecto existente con primitivas 2× y eventos 2× | Tamaños existentes no se reescriben |
| UXG2-04 | Colocar un cubo y orbitar delante/detrás/derecha/izquierda con W | Asas de traslación X/Y/Z utilizables por ambos lados |
| UXG2-05 | Repetir con R y transformaciones locales/globales | Asas de escala duplicadas, eje matemático y snap estables |
| UXG2-06 | Rotación E, universal Y, ortográfica y perspectiva | Sin intercepción inesperada, sin desplazamiento axial invertido |
| UXG2-07 | Seleccionar/deseleccionar audio 3D, audio UI, luz de punto/foco/área/direccional | Solo ayudas propias al seleccionar; los iconos siguen siendo clicables |
| UXG2-08 | Seleccionar/deseleccionar cámaras, spawn, Canvas y critters | Frustum, orientación, marco y radios visibles solo en selección |
| UXG2-09 | Seleccionar/deseleccionar Event, Trigger, Navigation, AtmosphericVolume, Group y Gameplay Object | Ayudas de zonas solamente en selección y nodos seleccionables desde proxy/marcador |
| UXG2-10 | Multiselección con Shift/Ctrl/Cmd y jerarquía | Ayudas de todos los seleccionados visibles y resto ocultas |
| UXG2-11 | Cambiar parámetros de anillos/volúmenes en Inspector, Undo/Redo y cambio de escena | La visibilidad es correcta tras reconstruir o cambiar datos |
| UXG2-12 | Entrar y salir de Play repetidamente | Gizmos de autoría ausentes en Play; selección/ayudas restauradas al volver |
| UXG2-13 | `npm ci`, suite, `npm run build`, `npm run electron:dev` | Build Editor/Player PASS, consola libre de nuevos errores WebGL |
| UXG2-14 | Juego Player exportado, física Jolt y audio | Sin cambios en colisiones, luz real o reproducción |

## Fuera de alcance

- **G003:** revisión RectAreaLight (gizmo centrado y dirección de emisión), DirectionalLight y conexión física de sol/luna con la referencia `FrostEngine_v1(1).unitypackage`. Ese paquete no ha sido abierto, modificado ni incluido en los ZIP de G002.
- **G004:** cámara/orbitar/restauración del visor y control del Player Spawn.
- **G005:** Color Picker, snapping accesible y textboxes.
- Sin nuevo sistema paralelo de selección, sin cambio de editor exportado, sin actualizar Three.js ni física.

Se mantiene el protocolo de aprobación antes de iniciar G003. Entrega G002: exactamente dos ZIP, CHANGE y SOURCE_BASELINE, sin archivo SHA separado.
