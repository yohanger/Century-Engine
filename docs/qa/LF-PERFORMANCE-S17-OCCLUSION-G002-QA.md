# QA — G002 Camera Occlusion

**Fecha:** 2026-11-15. **Estado:** IMPLEMENTADO; TEST PASS; COMPILACIÓN Y QA LOCAL NO VERIFICADOS. Aprobación y cierre PENDIENTES.

## Evidencia ejecutada en este entorno

| Comando/artefacto | Resultado | Alcance acreditado |
|---|---|---|
| `node --test scripts/test-camera-occlusion-s17-g002.mjs` | **15/15 PASS** | Culling de quad, ortho y perspectiva, cambios de cámara/oclusor, transparencia y alpha, culling por lado, máscaras temporales, sombras, excepciones, CPU fallback, RenderPass dinámico |
| `node --test` con G002 + S15 G002/G003/G005/CORR + S16 G005 + render pipeline S01 | **97/97 PASS** | Regresión estática/focal acotada de cámaras y render, no QA GPU |
| Suite ampliada histórica de 10 scripts | **129/139 PASS, 10 FAIL** | Fallos no relacionados directamente con el nuevo código: test legacy referencia `src/engine/runtime/player/fps/api.js`, `hands.js`, `camera.js` ausentes en baseline y paquetes `jszip`, `@vue/reactivity` no instalados en este entorno. Sin pruebas A/B de causa ni reparación; ningún test modificado para ocultar fallos |
| `npm ci --ignore-scripts --no-audit --no-fund` | **NO COMPLETÓ** | El contenedor no pudo resolver `registry.npmjs.org`; instalación interrumpida. `node_modules` parcial descartado de entregas |
| `npm run build` | **NO COMPILADO** | `sh: vite: not found`, consecuencia de falta de dependencias en este entorno; no indica error de sintaxis del motor |
| `node --check` de los tres JS editados | **PASS** | Sintaxis básica JS, no compilación Vue/Vite ni ejecución WebGL |
| QA Electron, AppImage, GPU real UHD605/N5030/4GB y capturas A/B | **NO VERIFICADO** | Requiere entorno físico del usuario y escena real |

## Matriz de aceptación / pendientes

- **PASS focal**: habitación simple con pared opaca planificada, ocluible detrás y objeto lateral; pruebas ortográficas y perspectivas; restaura `visible` luego de draw, ante excepción, y durante las sombras; material transparente no tapa, near/frustumCulled false bypass, GPU queries inexistentes.
- **NO VERIFICADO visualmente**: escena cerrada real con geometría editable/CSG, viewport editor navegando, Camera3D activa con cortes/blends/Timeline, perfil Forward+/Mobile/Compatibility, sombras volumétricas, SSR/AO, selección, terrenos, foliage, agua, modelos GLTF, luz con caché, cámara ortográfica real, contexto WebGL perdido, imágenes A/B.
- **NO VERIFICADO rendimiento**: tiempos CPU/GPU por carga en Intel UHD605, coste de rasterización y memoria temporal, draw calls reales, retardo/popping, balance neto A/B y 60 FPS. No existe evidencia de beneficio material en ese hardware, por lo que todavía NO es QA LOCAL PASS ni APROBADO.

## Reproducción en máquina del usuario

1. Descomprimir `SOURCE_BASELINE` **en directorio separado** o aplicar CHANGE al baseline G001 conservando copia; no reemplazar trabajo local no revisado.
2. `npm ci`, `npm run build`, `npm run electron`. Revisar consola y que no haya errores shader/renderer.
3. En **Ver → Rendimiento**, usar botón `Occlusion Culling: Activo/Inactivo` para comparar CPU, GPU, draws, triángulos, occluders y objetos realmente omitidos (repetir muestras en la misma cámara/escena). Pared opaca entre cámara y muchos props, cámara pasando por una puerta, escena exterior abierta, Edit vs Play.
4. Repetir con sombras, selección Outline, PSX, SSR, FilmMaker/Timeline, orthographic y NGM Runtime. Registrar capturas y medidas con igual perfil y resolución. Confirmar que no se alteran scripts, nodos, colisiones o audio.
5. Si hay popping o aumento neto sostenido de ms, desactivar desde Stats y registrar el escenario. Los límites iniciales no deben elevarse sin medir.

**Estado final del Gate:** entregado para QA físico, no aprobado ni cerrado. Build optimization queda fuera de alcance y posterior al culling.
