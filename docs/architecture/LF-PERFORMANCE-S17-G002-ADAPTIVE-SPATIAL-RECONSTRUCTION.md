# S17-G002 — Experimento: reconstrucción espacial de bordes, integrada en Three.js

**Fuente:** SOURCE_BASELINE S17-G001 (3.290 rutas, ZIP CRC PASS). **Contrato:** CA-001-VISUAL-FIDELITY-FIRST ratificado. **Estado:** IMPLEMENTADO EXPERIMENTAL / QA WEBGL PENDIENTE.

## Auditoría y propietarios (OBSERVADO)

- `render/config.js` y `core/templates/renderParams.js`: un único contrato y formulario de configuración. `resScale < 1` está disponible solo en Play y render realista.
- `render/look.js`: un pipeline dividido existente, con escena a resolución interna, y ViewModel/postprocesado a resolución de salida. Su medición `Reconstrucción` ya está expuesta en F3.
- `render/upscale.js`: un `TemporalUpscaler` histórico con ruta **espacial sin acumulación** mediante Catmull-Rom (5 lecturas); el TAA y DynRes fueron deshabilitados intencionalmente en 0.26.9 por artefactos visuales y siguen inhabilitados en normalización.
- `render/lodmgr.js` y `render/static-batch.js`: sistemas existentes opt-in o condicionados, no se modifican en este experimento.
- Three.js versión fijada `0.186.1`, `FullScreenQuad` oficial de addons, licencia MIT. No hay dependencia nueva; no se copió ningún paquete comercial de Unity.

## Intervención autorizada

Se integra una segunda modalidad **experimental** en el mismo shader espacial: `render.spatialReconstruction = 'edge-guard'`. El modo predeterminado `catmull` reproduce la ruta anterior. Para la alternativa, después de Catmull se leen los 4 texeles vecinos de la celda interna, se calcula el rango RGB y el contraste de luminancia y se limita el overshoot al rango local **solo en proporción al contraste**. Esto busca reducir halos/ringing en contrastes fuertes y no añade historial temporal.

`Game Settings → Render → Rendimiento → Reconstrucción espacial` aparece cuando hay resolución interna reducida (`resScale < 1`) y PSX está apagado. El mismo `LookPipeline`, el mismo render target y la misma métrica F3 `Reconstrucción` sirven para ambos métodos; no existe un segundo gestor ni nuevos render targets.

**Análisis de coste:** la rama habitual mantiene 5 lecturas de textura; `edge-guard` añade 4 lecturas por píxel reconstruido. No se promete aceleración del postproceso. Su uso se justifica **únicamente si** la escena a resolución reducida más reconstrucción experimental presenta una relación de calidad y coste favorable frente a Catmull-Rom y referencia nativa. Los resultados locales son una condición indispensable. La alternativa puede suavizar líneas finas; no se oculta.

## Compatibilidad y control de riesgos

- `render.spatialReconstruction` es opcional; valores ausentes/invalidos → `catmull` sin migración.
- `taa:false` y `dynRes:false` se mantienen incluso si un proyecto antiguo intenta activarlos.
- PSX, render clásico, Editor fuera de Play, resScale=1 y rutas sin compositor no ejecutan el experimento.
- Editor Play y NGM Runtime comparten `LookPipeline` y la normalización del proyecto. La paridad **NO está medida** todavía.
- Camera3D, ViewModel, Database, Jolt, paquetes de escena, Post Profiles y scripts no se modifican.
- Un fallo de compilación GLSL o penalización GPU obliga a desactivar el modo experimental y volver a `catmull` sin perder datos del proyecto.

## Distinción de evidencias

**OBSERVADO EN CÓDIGO:** integración, uniformes, defaults, alternativa de 4 muestras y persistencia del selector. **TEST NODE:** pruebas de contrato y dobles de render; no ejecutan GPU ni compilan GLSL. **INFERENCIA:** menos halos en escenas con bordes de alto contraste; no probado visualmente. **CAUSA RAÍZ de problemas de FPS:** no determinada; no se ha demostrado mejora de FPS ni memoria. Se requiere QA real en UHD 605 y el Player exportado antes de adoptar el experimento.

## Fuentes técnicas consultadas

- Three.js FullScreenQuad oficial: https://threejs.org/docs/pages/FullScreenQuad.html
- Three.js MIT: https://github.com/mrdoob/three.js/blob/dev/LICENSE
- Dependencia exacta `three: 0.186.1` en `package.json` de LevelForge.
