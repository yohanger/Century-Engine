# Century Engine — Corrección de excepciones del puntero y terreno

**Gate:** `CENTURY-EDITOR-CONSOLE-S01-G001-POINTER-AND-TERRAIN-RUNTIME-ERRORS`  
**Fecha:** 2026-11-21  
**Estado:** IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA ELECTRON/LOCAL NO VERIFICADO · NO APROBADO · NO CERRADO

## Autoridad y fuente

- Autorización literal: `Listo. CENTURY-EDITOR-CONSOLE-S01-G001-POINTER-AND-TERRAIN-RUNTIME-ERRORS autoriza comenzar`.
- Fuente: `CENTURY-EDITOR-GIZMOS-S01-G001-SELECTION-INDEPENDENT-VISIBILITY_SOURCE_BASELINE.zip`.
- La aprobación de Gizmos fue comunicada por el usuario después de la entrega, sin evidencia de compilación o QA Electron añadida en esta sesión.
- El usuario aportó un registro de consola con repeticiones de `InvalidStateError` en `setPointerCapture()` y seis trazas de `this._scheduleWM is not a function` en `touchTerrain()`.
- No se ejecutó Git ni se actualizaron repositorios remotos.

## Diagnóstico

**Observado — terreno:** `editor.js` y `roads.js` llamaban a `_scheduleWM()` y modificaban `_wmVer`. En toda la fuente inspeccionada no existe implementación de ese método ni consumidores de `_wmVer`. El error interrumpía `touchTerrain()` antes de ejecutar las actualizaciones posteriores de nodos y viewport.

**Observado — navegación:** `viewport.js` monta `OrbitControls` antes de registrar el manejo de navegación continua. Esta última usa `ContinuousGrab` con Pointer Lock. En la navegación editorial, `OrbitControls` seguía habilitado mientras el cursor estaba bloqueado. En el modo vuelo, otro evento de botón derecho podía volver a solicitar `setPointerCapture` antes de finalizar el gesto activo.

**Inferencia y limitación:** las pruebas sintéticas demuestran que estas secuencias pueden solicitar Pointer Capture bajo Pointer Lock, lo cual no está permitido por la especificación de Pointer Events. La traza del usuario proviene de `editor-BYYWwclx.js` minificado y no identifica por sí sola la ruta exacta en todas las ocurrencias. No se declara comprobada la eliminación de la excepción en Electron sin reproducción local.

## Implementación

- `src/core/editor.js`: retirar la invocación huérfana durante el pincel de terreno. Se conserva el pincel, la actualización de vegetación, el cursor y el cierre de trazo.
- `src/core/editor/roads.js`: retirar la invocación huérfana y el contador sin consumidores de `touchTerrain()`, preservando sombras, actualización de nodos, asas de carretera y renderizado.
- `src/engine/runtime/render/viewport-nav.js`: durante el gesto de navegación con Pointer Lock, deshabilitar temporalmente `OrbitControls` para evitar solicitudes superpuestas; restaurar el estado previo al finalizar o cancelar. Impedir que un segundo botón derecho inicie vuelo o solicite captura durante un gesto en curso o cuando existe un elemento con Pointer Lock.
- `src/core/editor/continuous-grab.js`: ante rechazo asíncrono o evento de error de Pointer Lock, ejecutar la ruta de cancelación para liberar el gesto y permitir restaurar los controles.
- `scripts/test-editor-console-input.mjs`: verificar los gestos y las rutas de terreno con dobles que reproducen el conflicto de captura, además de la actualización de carretera y del pincel mediante los métodos reales.
- `scripts/qa-suites.json`: grupo ejecutable `editor-console-input` sin duplicar mecanismos de ejecución.

No se añadieron comentarios administrativos a código, scripts, tests ni configuraciones. No se modificaron las advertencias de Electron CSP, PCFSoftShadowMap o CSS slider-vertical, que permanecen fuera de alcance.

## QA automatizado

| Comprobación | Resultado |
| --- | --- |
| `node --check` de cuatro módulos y prueba nueva | PASS |
| `npm run test:suite -- editor-console-input` | 23/23 PASS (9 nuevas + 14 de Continuous Grab) |
| `npm run test:suite -- editor-gizmos` | 55/55 PASS |
| Regresión combinada de siete archivos (navegación y terreno) | 101/105 PASS; cuatro fallos iguales en la fuente anterior |
| `npm test` | 29/30 PASS; falla `TOOL-08` también en la fuente anterior |
| `npm run build` | BLOQUEADO: `vite: not found` (`node_modules` ausentes) |
| Electron, navegación real y Terrain en UI | NO VERIFICADO |

Los cuatro fallos comunes de la regresión combinada son `OCG-12`, `TN1-06`, `TT2-05` y `TT2-15`. No se atribuyen a esta implementación. No se modificaron tests antiguos para maquillar los resultados.

### Evidencia

Registros completos en `docs/qa/evidence/CENTURY-EDITOR-CONSOLE-S01-G001-POINTER-AND-TERRAIN-RUNTIME-ERRORS/`: log original del usuario, suite dirigida, regresión de Gizmos, regresiones de navegación/terreno sobre baseline y fuente corregida, smoke comparado e intento de build.

## QA local obligatorio

1. Compilar el Editor con `npm ci` y `npm run build` en el entorno que disponga de dependencias; abrir la misma escena en Electron.
2. Editar el terreno con el pincel: levantar, bajar, aplanar y pintar; terminar cada trazo y comprobar ausencia de `_scheduleWM` y regeneración de las carreteras conformadas.
3. Navegar con botón central, Shift+central, Alt+izquierdo, Espacio+izquierdo y Shift+derecho. Mantener un gesto, cruzar los bordes del viewport y presionar un segundo botón durante el bloqueo. Confirmar ausencia de `InvalidStateError`, continuidad y restauración de la navegación.
4. Volar con botón derecho y WASD, pulsar botón derecho otra vez antes de soltar y confirmar que no aparece otra captura ni se bloquea el cursor.
5. Cancelar con Escape, pérdida de foco y cambio de escena; comprobar que la siguiente selección, los gizmos y la navegación siguen activos.
6. Repetir en Edit Mode, Object Mode y después de Play; comprobar que TransformControls, selección y Runtime no presentan regresiones.
7. Confirmar los tres avisos independientes en consola sin atribuirlos a esta corrección.

**Cierre:** requiere QA Electron/compilación y aceptación expresa del usuario. TEST PASS no equivale a QA LOCAL PASS ni a cierre.
