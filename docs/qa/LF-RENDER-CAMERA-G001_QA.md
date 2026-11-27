# LF-RENDER-CAMERA-G001 — Proyección de cámara y aparente ensanchamiento

**Fecha:** 2026-10-25 · **Autorización:** `Listo. LF-RENDER-CAMERA-G001 autoriza comenzar`

## Incidencia y evidencia

El usuario observa que una primitiva parece ensancharse al mover la cámara FPS. Confirmó que el efecto sigue con **Ajuste de vértices PSX = 0**, FOV menor y relación de aspecto **Libre**. Una captura muestra un cubo muy cercano al borde derecho; otra, terreno húmedo y un brillo concentrado. No son mediciones comparables de la misma primitiva en posiciones fijas. No hay evidencia de que cambie su escala real.

## Resultado de auditoría del baseline S04 + AMEND-001

- `player/fps/camera.js` modifica la pose de cámara; `nodes/primitive.js` sincroniza la escala del objeto a partir de sus datos, no de la cámara.
- `events/play-controls.js` actualiza el `aspect` de la cámara FPS en `frame()`; `render/viewport.js` redimensiona y **renderiza síncronamente desde ResizeObserver**, antes de que necesariamente se ejecute `frame()`. Esto permite un cuadro renderizado con la relación de aspecto anterior si se redimensiona el visor en Play Mode. Es un defecto confirmado en ese camino, no necesariamente la causa del efecto al girar sin redimensionar.
- `render/pbr.js` tenía `max(1.0, uLfPsxStep)` en la cuantización. En cambio, `scene-graph.js` normalmente no inyecta `rtPsx` si `psxSnap=0`: por tanto, **no hay pruebas de que el ajuste PSX esté activo a cero en el recorrido normal**. Aun así se corrige el comportamiento para materiales con programa compilado retenido y uniform actualizado a cero.
- El shader PBR por defecto no altera geometría de una primitiva al girar la cámara. La proyección rectilínea hace que objetos cercanos al borde de la imagen puedan parecer ensanchados, incluso con un FOV moderado. Eso no debe corregirse escalando mallas.
- Ni TAA ni resolución dinámica se consideran una explicación: figuran obsoletos/desactivados en este baseline.

## Cambios acotados

1. `render/viewport.js`: al redimensionar se actualiza `aspect` de la cámara perspectiva activa de Play Mode **antes** del dibujo inmediato; no se tocan la cámara ortográfica ni la perspectiva del editor (la cual se actualiza en `_fitCameras`).
2. `render/pbr.js`: si `uLfPsxStep == 0`, el programa no cuantiza las posiciones clip; pasos PSX positivos mantienen sus efectos.
3. `scripts/test-render-camera-g001.mjs`: pruebas instrumentadas sin dependencias gráficas de los dos contratos anteriores y regresión estática de los consumidores FPS/primitivas.

## Pruebas automatizadas

```bash
node --test scripts/test-render-camera-g001.mjs
node --test scripts/test-render-pipe-s01.mjs scripts/test-water-s04.mjs
npm run build
```

- Ocho nuevas pruebas específicas: `8 PASS`, `0 FAIL` en el entorno de entrega.
- Regresión acumulada disponible: `778 PASS`, `0 FAIL`, `9 SKIP` (sin `test-starcat.mjs`, que requiere Three.js ausente). La suite de test incluye tests sin dependencias adicionales y tests con SKIP.
- Build Editor/Player: **NO VERIFICADO** en este entorno (`vite: not found`).
- GPU/WebGL, imagen en movimiento, FPS y Play exportado: **NO VERIFICADOS**. No se declara resuelta la percepción de ensanchamiento hasta una prueba local de movimiento en el mismo escenario.

## QA visual del usuario (criterios verificables)

1. Con FOV habitual, PSX snap 0 y Aspecto Libre, colocar cubo inmóvil en el centro. Anotar posición, escala y rotación desde Inspector.
2. Sin caminar, girar la cámara lentamente hacia ambos lados. Confirmar si la cara se ensancha exclusivamente en el borde o también cuando está centrada. Capturar vídeo y registrar el modo de render.
3. Repetir en Compatibility (sin postproceso) y en Forward+. Verificar si hay diferencia de silueta frente a cambio de iluminación/normal/reflejos.
4. En Play Mode redimensionar el visor (arrastrar el panel inferior o inspector) con un cubo visible. Verificar que no hay un cuadro estirado durante el cambio.
5. Activar PSX con snap 0 y después 1–4: el valor 0 NO debe cuantizar y los positivos SÍ.
6. Comprobar con objeto estático y cámara moviéndose: la transformación del objeto no puede cambiar. El FOV debe mantenerse tras recargar y en Player exportado.
7. Verificar lluvia y WaterWorld sin alteraciones (no se modifica ningún módulo WATER).

Si el ensanchamiento persiste únicamente con movimiento de cámara y visor fijo, hay que obtener **dos fotogramas comparables o un vídeo**, y aislar geometría proyectada vs shader/postproceso. No sería correcto afirmar que las dos correcciones implementadas lo solucionan con los datos actuales.

## Cierre de Gate

**Código y tests disponibles: IMPLEMENTADO / PASS.**
**Confirmación del defecto visual original: PENDIENTE.**
**Compilación, QA WebGL y aceptación del usuario: PENDIENTES.**
