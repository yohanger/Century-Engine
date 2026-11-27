# QA — LF-FILMMAKER-UX-S01-G002_CORR-001

Fecha: 2026-10-29. Estado: AUTORIZADO/IMPLEMENTADO. **No compilado en contenedor; no aprobado ni cerrado.**

## Pruebas ejecutadas

Comando:

```bash
node --test \
  scripts/test-filmmaker-ux-s01-g002-corr001.mjs \
  scripts/test-filmmaker-ux-s01-g002.mjs \
  scripts/test-filmmaker-frame-s01-g001.mjs \
  scripts/test-road-material-s01-g001.mjs \
  scripts/test-editor-safety-s01-g001.mjs \
  scripts/test-editor-safety-s01-g002.mjs \
  scripts/test-vfx-editor-s03-g001.mjs \
  scripts/test-vfx-simulation-s02-g001.mjs \
  scripts/test-project-safe.mjs \
  scripts/test-resource-history-corr-g001.mjs
```

Resultado observado: **119 tests; 119 PASS; 0 FAIL; 0 skipped**. Diez tests nuevos y 109 regresiones previas. Las pruebas automatizadas incluyen verificaciones estructurales y de funciones con dobles de DOM, no equivalen a render real con Vue ni a pruebas de rendimiento GPU.

Compilación intentada: `npm run build` → `vite: not found`. **BUILD NO VERIFICADO**.

## Pruebas visuales y funcionales obligatorias en local

1. 1440×900: ambos docks visibles; Inspector y SceneTree accesibles; monitor y timeline ocupan el resto de la ventana.
2. 1280×720: ambos docks permanecen utilizables; redimensionar verticalmente no elimina el monitor ni las pistas.
3. **1024×768 (captura de incidencia)**: Inspector a la derecha, Escena oculta por defecto. Pulsar Escena: Inspector se oculta; pulsar Inspector: Escena se oculta. Ambas pueden ocultarse y recuperarse.
4. 900×600: barra superior puede ocupar dos filas sin recortar botones y monitor/timeline siguen accesibles.
5. Menos de 820 px: la barra móvil y hojas de paneles mantienen funcionamiento; probar también modo vertical.
6. Timeline sin clip seleccionado: **no debe existir el rectángulo vacío de propiedades**; las pistas utilizan todo el ancho disponible.
7. Seleccionar un plano, audio, efecto o texto: aparece la hoja contextual de propiedades. Cerrar la hoja no cambia la selección ni los datos del clip.
8. Timeline largo: aparece «Desplazar tiempo ↔» solo con desbordamiento; moverlo desplaza las pistas y no mueve el cabezal por sí mismo. Verificar Shift+rueda, Ctrl+rueda para zoom y navegación con teclado.
9. Timeline con muchas pistas: la cabecera de cada pista queda alineada verticalmente al realizar scroll.
10. Grabar un pase, reproducir/pausar/detener, editar keyframes, guardar y reabrir `.nfm` v2; probar formato horizontal y vertical de G001.
11. Revisar el Inspector de nodos, la cámara, VFX3D y la integración con Editor/Player, sin regresiones.
12. Verificar que el monitor conserva una relación de aspecto correcta y no se deforma con los docks.

## Evidencia requerida antes del cierre

- `npm run build` y `npm run filmmaker` en entorno local.
- Capturas a 1440×900, 1280×720 y **1024×768**, antes/después de seleccionar clip.
- Respuesta clara sobre si el cuadro azul desapareció y el desplazamiento es comprensible.

No registrar Build PASS ni QA gráfico PASS sin el resultado real. Si hay conflicto de código local, detener integración antes de sobrescribirlo.
