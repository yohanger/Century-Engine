# CENTURY-EDITOR-GIZMOS-S01-G001-CORR-001 — Integridad de pivote y escala

## Objetivo y fuente

Corrección visual autorizada por el usuario: los cuadrados XY, XZ y YZ del gizmo de traslación habían quedado separados del pivote. Fuente de trabajo: `CENTURY-EDITOR-MESH-S02-G001-ADVANCED-MESH-SUBTRACT-AND-HOLLOW-GEOMETRY_SOURCE_BASELINE.zip`; se preserva todo su contenido excepto los archivos explícitamente modificados. No se ha podido contrastar con cambios locales del repositorio del usuario.

## Causa raíz verificada

En Three.js `0.186.1`, `TransformControlsGizmo.setupGizmo` hornea los desplazamientos de las asas en la geometría y reinicia las posiciones a cero. Más tarde, `updateMatrixWorld` sitúa cada asa en `worldPosition` y calcula la escala según cámara perspectiva u ortográfica y el tamaño configurado. La corrección previa sobrescribía `handle.position` parcialmente con `0.15` y reemplazaba `handle.scale` por `1`, originando desplazamientos fuera del pivote y pérdida de escala dependiente de cámara.

Fuente oficial exacta de versión: https://github.com/mrdoob/three.js/blob/r186/examples/jsm/controls/TransformControls.js

## Implementación

- Se mantiene un único `TransformControls` para traslación; no se crean asas ni pickers adicionales.
- En `_cameraFacingHandles`, los cuadrantes XY, XZ y YZ se siguen determinando con los signos de ejes ya implementados, respetando Local/Global, histéresis y congelamiento durante arrastre.
- Tras la actualización nativa, se multiplica únicamente el signo de los componentes de `handle.scale` correspondientes al plano: `handle.scale[coord] *= side[axis]`.
- No se cambia `handle.position` ni la magnitud de la escala calculada por Three.js. Las geometrías nativas de `gizmo` y `picker` reciben el mismo reflejo.
- Ejes, rotación, escala, Terrain y lógica de transformaciones quedan fuera del cambio.

## QA registrado

| Prueba | Resultado |
| --- | --- |
| `node --test scripts/test-camera-facing-translation-plane-handles.mjs` | 7/7 PASS |
| `node --test scripts/test-transform-global-local-corr-g001.mjs` | 15/15 PASS |
| `node --test scripts/test-editor-viewport-controls-s02-g001-integral.mjs` | 22/28 PASS, 6 FAIL heredados; mismos fallos en baseline |
| `node --test scripts/test-transform-global-local-corr-g001.mjs scripts/test-editor-snap-shift-g001.mjs` | 30/32 PASS, 2 FAIL heredados; mismos fallos en baseline |
| `npm run build` | EXIT 127, `vite: not found` |
| QA visual Electron, cámara perspectiva/ortográfica real, GPU y picking real | NO VERIFICADO |

Las pruebas focales utilizan un doble que reproduce la posición mundial, escala dependiente de cámara y offsets horneados de Three.js r186. No sustituyen una prueba integrada con el addon ejecutándose en Electron. El archivo de regresión histórico fue actualizado solo en los tres casos que asumían la posición incorrecta de los planos; los seis fallos anteriores permanecen reproducibles.

## Estado y aceptación

**IMPLEMENTADO EN FUENTE, QA FOCAL PASS; compilación y QA visual NO VERIFICADOS.** No se declara aprobado ni cerrado. Para aprobar, comprobar manualmente rotación orbital, cámaras ortográfica/perspectiva, selección de planos, arrastre, Zoom, Global/Local y ausencia de distancias visuales entre flechas/cuadrados sobre un objeto desplazado del origen.
