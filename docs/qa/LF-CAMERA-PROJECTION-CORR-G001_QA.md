# Actualización del Gate — Control explícito de FOV horizontal (2026-10-27)

**Estado actual de esta continuación:** IMPLEMENTACIÓN DE CÁMARA COMPLETADA · 20 PRUEBAS NUEVAS PASS · REGRESIÓN 1938 PASS / 0 FAIL / 18 SKIP · BUILD/QA VISUAL NO VERIFICADOS · APROBACIÓN PENDIENTE.

La sección «Auditoría de proyección» siguiente documenta el **estado histórico anterior** a la grabación suministrada; la frase «corrección bloqueada por falta de evidencia» ya no representa el estado actual.

## Evidencia y mecanismo

El usuario suministró la grabación `Screencast from 2026-10-27 23-01-07.webm` y pidió conservar un FOV de 80°–90° propio de FPS. En el visor ancho (aproximadamente 2.15:1), `PerspectiveCamera.fov` corresponde a **FOV vertical**: 75° vertical se convierte en aproximadamente 118° horizontal. Esto incrementa la magnificación periférica rectilínea, no cambia escala de objetos.

Esta continuación **no cambia el tipo de lente**. Añade la interpretación opcional `fovAxis = 'horizontal'` para el jugador en **Base de datos → Jugador → Ojos y cámara** y un selector de FOV horizontal/vertical en la barra de vista del **Editor**. El modo horizontal convierte el ángulo visible a la `camera.fov` vertical interna de Three.js según el aspecto real. En el visor 2.15:1, 90° horizontal implica aproximadamente 49.89° vertical; la cifra de juego que introduce el usuario sigue siendo 90° horizontal, no una reducción silenciosa de un campo vertical.

**Compatibilidad estricta:** todos los registros de jugador anteriores sin `fovAxis` usan `'vertical'`. Para probar el comportamiento nuevo en un proyecto existente hay que seleccionar explícitamente **Horizontal** y un FOV como 85° o 90°. No se cambia automáticamente la configuración de proyectos guardados. La cámara de escena y las cámaras de timeline continúan utilizando su semántica vertical existente. El view model de manos adopta la proyección interna resultante del jugador; la vista previa del jugador utiliza la misma conversión. El editor usa 90° horizontal como preferencia inicial, editable y reversible desde la barra de vista; **no se escribe en el proyecto ni se exporta**.

**Límite óptico reconocido:** la lente perspectiva rectilínea amplifica los bordes de la imagen incluso con 90° horizontal. Este cambio permite usar una convención de FPS razonable y reduce la ampliación respecto de 75° vertical en visores muy anchos, **pero no elimina matemáticamente toda la distorsión**. No se añade Panini, compositor, postprocesado, PBR, escalado de mallas, ni se altera el raycasting o el sistema CSG. La desaparición del síntoma queda pendiente del usuario.

## Archivos involucrados

- `src/engine/runtime/render/camera-fov.js`: cálculo puro de FOV horizontal, set de cámara y renovación tras resize.
- `src/engine/runtime/render/viewport.js` y `src/components/ViewBar.vue` / `src/core/state/state.js`: eje y valor editorial configurable, restauración de vista.
- `src/engine/runtime/database/player.js`, `src/engine/runtime/player/fps/api.js`, `src/engine/runtime/player/none/index.js`: registro de eje, compatibilidad y configuración durante la partida.
- `src/engine/runtime/events/{play-camera,play-controls,play-timeline}.js`: FPS, cámara de escena, cambios de aspecto y cinemáticas.
- `src/engine/runtime/player/fps/hands.js`, `src/components/PlayerPreview.vue`: proyección coherente del view model y previsualización.
- `scripts/test-camera-fov-horizontal-g001.mjs`: 20 casos nuevos. Las suites históricas de cámara y agua ajustan solo sus tests de contrato al helper nuevo, conservando sus comprobaciones.

## Pruebas ejecutadas

```text
node --test scripts/test-camera-fov-horizontal-g001.mjs
20 PASS / 0 FAIL

node --test scripts/test-camera-projection-corr-g001.mjs
18 PASS / 0 FAIL

Regresión Node disponible (sin test-starcat.mjs)
1938 PASS / 0 FAIL / 18 SKIP

npm run build
NO VERIFICADO: vite: not found (exit 127)
```

Las suites Node no ejecutan la interfaz Vue ni miden la imagen real de WebGL. La prueba de cámara vertical anterior mantiene su caracterización matemática. La ausencia de Vite y Three.js impide acreditar build y QA visual en este entorno.

## QA local indispensable

1. Aplicar el CHANGE sobre el SOURCE_BASELINE correspondiente y ejecutar `node --test scripts/test-camera-fov-horizontal-g001.mjs` y `npm run build`.
2. En **Base de datos → Jugador → Ojos y cámara**, fijar **Referencia del FOV = Horizontal** y **FOV = 90°**. Usar exactamente la escena del vídeo. Girar al lado del mismo cubo/muro; observar si la magnificación periférica disminuye. Repetir con 85° y 80° horizontales.
3. Cambiar a **Vertical** con el valor anterior y verificar que la vista anterior se recupera; no se deben alterar los objetos ni los recursos de escena.
4. En **Escena** usar el control **FOV / Horizontal / Vertical** de la barra superior. Comparar la cámara de autoría y verificar que se puede orbitar, seleccionar, usar gizmos y Edit Mesh sin desalineación.
5. Cambiar la proporción del visor (Libre, 16:9 y 21:9), redimensionar el Editor y comprobar que el FOV **horizontal** efectivo permanece fijado al número indicado en los modos horizontales.
6. Guardar/cerrar/reabrir proyecto y ejecutar Player exportado; validar view model/manos, FPS y cámaras principales/cinemáticas existentes. Los proyectos antiguos deben mantener la vista vertical si no se selecciona el modo horizontal.
7. Reportar específicamente si el ensanchamiento sigue visible con **90° horizontal**, indicando si solo ocurre junto al borde o también en el centro. En perspectiva rectilínea puede seguir existiendo aumento periférico normal.

**NO marcar corrección óptica definitiva ni QA Electron/Player PASS hasta comprobar estos pasos localmente.** El defecto CSG sustractivo permanece diferido y sin tocar.

---

## Informe histórico previo (auditoría antes de recibir el vídeo)

# LevelForge — LF-CAMERA-PROJECTION-CORR-G001 · Auditoría de proyección

**Gate autorizado:** `Listo. LF-CAMERA-PROJECTION-CORR-G001 autoriza comenzar` — 2026-10-27.

**Resultado:** AUDITORÍA AUTOMATIZADA PASS · CAUSA DEL SÍNTOMA VISUAL SIN CONFIRMACIÓN · CORRECCIÓN DE PRODUCCIÓN BLOQUEADA · QA VISUAL / BUILD NO VERIFICADOS · APROBACIÓN PENDIENTE.

## Fuente contractual y alcance

SOURCE_BASELINE `LevelForge_MESH_WORKFLOW_INTEGRATION_QA_G001_SOURCE_BASELINE.zip`, **877 archivos**, ZIP íntegro. La aprobación del Gate QA de modelado está registrada como histórica. La incidencia de sustracción CSG permanece fuera del alcance. **No modificar shaders PBR, efectos, geometría, escalas de objetos ni comportamiento de la lente sin haber demostrado un defecto real.**

El usuario indica que los objetos parecen ensancharse al mover o girar las cámaras FPS y Editor, incluso cambiando FOV, y aclara que **no es un defecto de PBR ni efectos**. No se adjuntaron para este Gate dos fotogramas comparables del mismo objeto ni captura de la proyección ortográfica con el síntoma.

## Hallazgos OBSERVADOS en código

| ID | Evidencia | Resultado |
|---|---|---|
| C01 | `render/viewport.js`: `THREE.PerspectiveCamera(60,1,...)` en Editor y `_fitCameras(w,h)` | El aspecto de la cámara de Editor se actualiza con w/h. |
| C02 | `events/play.js`: `THREE.PerspectiveCamera(75,1,...)` en Play | El jugador usa otra cámara con la **misma familia rectilínea** de perspectiva. |
| C03 | `render/viewport.js`: `resize()` sincroniza aspecto de la cámara FPS activa antes del render inmediato | El defecto de ResizeObserver que se corrigió en LF-RENDER-CAMERA-G001 no reaparece en el código actual. |
| C04 | `events/play-controls.js`: `frame()` vuelve a sincronizar `cam.aspect` con dimensiones de canvas | Actualización por frame presente. |
| C05 | `player/fps/camera.js`: `viewPose()` ajusta posición/yaw/pitch | No escribe FOV, zoom ni aspect al girar. |
| C06 | `render/viewport-nav.js`: `_orbitBy()` cambia orientación/posición de la cámara | No escribe FOV, aspect ni zoom durante la órbita. |
| C07 | `render/viewport.js`: cámara ortográfica de frustum w/h | No tiene la misma magnificación angular rectilínea que la perspectiva. |
| C08 | `nodes/primitive.js`: transformaciones a partir del objeto | No escala la malla según el giro de cámara. |

**No observado:** un cambio erróneo de matrices al rotar en un navegador real. Ninguna prueba Node simula la GPU ni demuestra ausencia absoluta de otras rutas defectuosas. No se ha demostrado una causa raíz específica del ensanchamiento reportado.

## Causa geométrica confirmada para un fenómeno similar (no para todo el síntoma)

Una `THREE.PerspectiveCamera` estándar usa perspectiva rectilínea (gnomónica). La posición horizontal proyectada de un rayo de dirección θ respecto al eje es proporcional a `tan(θ)` y su ampliación angular local respecto al centro es `1 / cos²(θ)`. **Un objeto del mismo tamaño angular se ve más ancho cerca del extremo**. Se observa incluso con FOV reducido si el objeto está a un ángulo suficientemente alejado del eje. A igualdad de ángulo, cambiar FOV no cambia la ampliación angular *relativa*; sí cambia cuánto del escenario entra en el encuadre.

Ejemplo orientativo para visor 16:9 y un objeto que se traslada del centro al borde horizontal:

| FOV vertical | Semicampo horizontal | Factor de magnificación angular aprox. en extremo / centro |
|---|---:|---:|
| 40° | 32.9° | 1.42× |
| 60° | 45.7° | 2.05× |
| 75° | 53.8° | 2.86× |

Esto **no significa que PolyMesh, los nodos, la escala o los materiales cambien**. También **no demuestra** que el efecto reportado ocurra solo en los bordes. Una proyección 4×4 rectilínea no puede eliminar por completo esta magnificación conservando simultáneamente todas sus propiedades lineales.

## Decisión técnica del Gate

**No se altera la proyección de producción:** no existe evidencia visual comparable para discriminar entre la amplificación inherente a la lente y un segundo defecto de actualización/viewport. Reemplazarla silenciosamente por ortográfica eliminaría la perspectiva del FPS; un modelo no rectilíneo (p. ej. Panini/cilíndrico) requiere otro contrato, implementación consistente para raycasting/selección y validación visual. Atribuir una solución al PBR o cambiar escalas violaría el Gate.

El contrato **no está resuelto funcionalmente**; queda **BLOQUEADO POR EVIDENCIA VISUAL**. Este Gate aporta una suite de caracterización y un protocolo exacto para desbloquear la corrección sin falsos positivos.

## Pruebas ejecutadas

```bash
node --test scripts/test-camera-projection-corr-g001.mjs
# 18 PASS / 0 FAIL

find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 | sort -z | xargs -0 node --test --test-concurrency=4
# 1918 PASS / 0 FAIL / 18 SKIP

npm run build
# NO VERIFICADO: vite: not found (exit 127)
```

Las 18 pruebas nuevas cubren cámara Editor y FPS, proporciones de aspecto, redimensionamiento antes del render, fase ortográfica, ausencia de escritura FOV/zoom al orbitar y caracterización matemática de la amplificación angular. Las pruebas Node hacen extracción selectiva de métodos reales y comprobaciones contractuales, no una prueba E2E ni una comprobación del defecto visual.

## Experimento local para distinguir las causas

1. Usar un único cubo sin animación, sin movimiento físico y a distancia constante. Anotar escala y FOV. Usar vista Perspectiva y relación de aspecto Libre.
2. **Rotación sobre el lugar:** no caminar ni desplazar la cámara. Partir con el cubo centrado y rotar lentamente hasta que aparezca cerca del borde. Guardar **dos capturas o vídeo**; registrar FOV, tamaño interno del viewport y si el ensanchamiento aparece en borde o también centrado.
3. **Movimiento lateral sin giro:** desplazar la cámara sin cambiar orientación, manteniendo el cubo visible. Observar si la anchura cambia de forma inesperada estando cerca del centro de la imagen.
4. Repetir con FOV 40° y 75° y, en Editor, cambiar a **Ortográfica**. En perspectiva es normal que la magnificación angular crezca hacia bordes; si se reproduce en ortográfica, hay un fallo adicional que debe auditarse.
5. Abrir Inspector y comprobar que posición/rotación/escala del cubo no cambian durante la grabación. Repetir Editor y Play con el mismo cubo.
6. Informar resolución de ventana y ancho/alto útiles del viewport. No es necesario cambiar PBR, iluminación, filtros ni postprocesos para esta prueba.

**Decisión posterior según evidencia:**

- Si solo ocurre con el cubo en extremos de perspectiva, es la distorsión óptica rectilínea. Presentar propuesta de lente alternativa **explícita** (con comportamiento FPS, picking e Inspector) para aprobación, no un parche.
- Si ocurre con cubo centrado, ortográfica, o cambian dimensiones/FOV de un frame a otro sin resize, investigar matriz/canvas, controles y estado render real. Aislar causa y corregir mediante `LF-CAMERA-PROJECTION-CORR-G001_CORR-001` con autorización adicional.

## Entrega

Solo añadidos: `scripts/test-camera-projection-corr-g001.mjs`, este informe. Modificado: `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas). **0 archivos de producción modificados**. No declarar resuelta la incidencia hasta obtener QA visual comparativa y autorización de la corrección que corresponda.
