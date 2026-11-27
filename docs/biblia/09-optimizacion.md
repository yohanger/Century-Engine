# Optimización y diagnósticos

`render/camera-occlusion.js`, `observer-visibility.js`, `occlusion-static.js`, `occlusion-bake.js` y `state/occlusion.js` representan visibilidad por cámara y herramientas de horneado. El observador editorial no debe sustituir las decisiones de visibilidad del juego. `render/mesh-clusters.js`, `cluster-mesh.js`, `gpu-cluster-data.js`, `static-batch.js` y `terrain-adaptive.js` contienen rutas de geometría/agrupación; `lod*` permanece en fuentes, lo cual no acredita su condición activa en cada perfil.

## TriangHor

<pre>Terrain de autoría → adaptador Century → API pública trianghor
         ↑                                     ↓
         └─ validación / commit / recuperación ← índice calculado</pre>

`vendor/trianghor` es la dependencia local; `render/trianghor/core.js` y `job.js` reexportan API pública, `worker-client.js` y `worker-service.js` gestionan el trabajo. Contrato `CE-TH-CA-001-INDEPENDENT-TRIANGHOR-CONSUMER-AUTHORITY.md`: la biblioteca posee el algoritmo; Century posee datos de autoría, render, colisiones, persistencia y publicación. No introducir otro simplificador ni modificar altura/pintura como efecto de bake.

`render/view-diagnostics-contract.js`, `view-diagnostics.js`, `diagnostic-hud-model.js`, `shader-source-metrics.js` y `ViewportDiagnosticsHud.vue` separan modos y métricas de diagnóstico. `performance-controller.js` administra el presupuesto; un objetivo de 60 FPS no es un benchmark. Verificar equivalencia de wireframe/triángulos, vistas de editor, occlusion y resultados válidos de Worker. Suites localizables por `trianghor`, `occlusion`, `viewmodes` y `performance`.

