# Navegación, selección y modelado

## Controles y geometría

`src/engine/runtime/render/viewport-nav.js` gestiona navegación; `src/core/editor/continuous-grab.js` y `src/engine/runtime/input/pointer-capture.js` encapsulan la captura. `src/core/editor/gizmo.js`, `selection.js`, `pointer.js`, `selection-box.js` y `snap.js` coordinan transformaciones, selección y entrada. La navegación editorial no debe depender de que haya un nodo seleccionado.

`src/core/mesh/session.js` y sus módulos `session-*` poseen la sesión Edit Mesh, operaciones y picking. `src/engine/runtime/mesh/polymesh.js` representa geometría; `src/core/mesh/ops.js` y módulos relacionados modifican topología, `cuts.js` maneja loop cut y `uv.js` las coordenadas por esquina. `src/core/editor/local-mesh-view.js` maneja aislamiento de edición. No duplicar los operadores de malla para modificar el Inspector.

## Duplicación y portapapeles

`src/core/editor/placement.js` posee `duplicateWorldOffset()`: proyecta la dirección de cámara en X/Z, selecciona el eje dominante (empate X) y devuelve un vector cardinal de longitud 2 m. En la vista vertical utiliza el eje derecho de cámara para conservar un rumbo determinista. `clipboardPlacePoint()` utiliza un rayo central y `_surfaceHit()` de `pointer.js`; acepta solo impactos reales finitos a ≤ 2 m y restaura el rayo original. Sin impacto válido, usa la posición de cámara más el vector cardinal. La colocación de recursos y nodos nuevos no cambia.

`src/core/state/objects.js`: `duplicateSelected()` y `linkedDuplicateSelected()` consumen un vector común para las raíces. `translatedLocalPosition()` utiliza la parte lineal de la matriz mundial inversa del padre; no descompone ni redondea rotación/escala. `cloneSubtree()` no desplaza los descendientes adicionales. Los `Node` lógicos no tienen Transform. Se mantienen remapeos de TriMesh, MeshSubtract y Signals, mallas independientes/vinculadas y un commit por operación. `pasteSelected()` traslada el centro de las raíces copiadas al destino; cuando la base lineal no cambia aplica solo una traslación, y cuando cambia conserva la conversión TRS de `setLocalFromWorld()` con sus restricciones existentes. No hay ajuste automático de la base geométrica sobre la superficie.

**Flujo:** comandos/teclas → operaciones de `objects.js` → destino de `placement.js` → conversión mundial/local → clonado/remapeo → sincronización → historial. No depende de Snap. Verificar con `camera-aligned-placement` y `camera-aligned-placement-electron`.

**Impacto:** padres rotados/escalados, selección múltiple, topología, UV, pivote, referencias, undo y persistencia. Revisar pruebas de mesh, selección y puntero antes de extender estos mecanismos.


## Captura y recuperación editorial del ratón

`ContinuousGrab` conserva la autoridad de movimiento continuo en el visor (navegación/gizmos), Edit Mesh y observador de escena. `viewport-nav.js` posee la navegación y la captura de vuelo; `pointer-capture.js` solicita Pointer Capture antes de abrir gestos nativos; `dock-gesture.js` administra la captura del arrastre de pestañas. Player utiliza `play-controls.js` y no adquiere autoridad a través de ContinuousGrab.

| Estado | Transición / responsabilidad |
| --- | --- |
| Disponible | Un gesto explícito solicita bloqueo; no hay recaptura automática. |
| Pendiente | Una reserva por documento; límite de 1000 ms. Escape, blur, cambio de vista o cancelación restauran el cursor local. |
| Activo | Pointer Lock confirmado por el documento; deltas relativos y cursor virtual. |
| Liberando | Solo el propietario solicita exitPointerLock. Reintento único a 250 ms; fallo persistente no se declara recuperado. |
| Respuesta tardía | Identidad de solicitud y documento; vigilancia de eventos durante 2000 ms adicionales, sin tomar capturas ajenas. |

`Editor.cancelEditorPointer()` coordina navegación y Edit Mesh antes de cambios de escena, Play y docking; los destinos del viewport se sincronizan con el documento actual. `ContinuousGrab` cancela y restaura el cursor local antes de notificar a la herramienta. Si el navegador deniega el bloqueo, se conserva el fallback nativo existente donde corresponde. Los logs `[Century/Pointer]` incluyen propietario, operación, estado, foco y excepción cuando está disponible; `release-not-confirmed` indica que el bloqueo real no ha desaparecido.

**Límite:** los eventos legacy no incluyen identidad de solicitud y no permiten desambiguar concesiones tardías para el mismo canvas. Una plataforma que no libera el bloqueo no se puede declarar recuperada únicamente por CSS. QA con `integral-pointer-recovery` y `integral-pointer-recovery-electron`; la prueba aislada DOM no sustituye QA Electron del viewport real.

## Autoridad de entrada modal
`src/engine/runtime/render/viewport-nav.js` delega el pointerdown editorial en la sesión modal activa antes de los controles de navegación. `src/core/editor.js` conecta el receptor de `src/core/mesh/session-input.js`; `ContinuousGrab.canReceiveModalInput()` comprueba documento y propietario. La operación existente confirma o cancela y consume el evento; las capturas ajenas siguen bloqueadas. Los stacks de diagnóstico en `continuous-grab.js` acotan URLs data y la longitud, conservando el error original. QA nativo de esta modificación pendiente.
