# LF-PERFORMANCE-S17-G003 — Registro QA y continuidad

**Fecha:** 2026-11-18  |  **Gate autorizado:** `LF-PERFORMANCE-S17-G003-INTEGRAL-SCENE-OPTIMIZATION-AND-EDITOR-CORRECTIONS`

**AUTORIZADO / CÓDIGO FUENTE PARCIALMENTE IMPLEMENTADO / TEST NODE PARCIAL / BUILD NO VERIFICADO / QA ELECTRON NO VERIFICADO / APROBACIÓN PENDIENTE / CIERRE PENDIENTE.**

## Baseline y alcance
- Fuente de continuidad: `LF_CLOUD_STORM_S00_G001_NATIVE_APPROACH_AND_LIGHTNING_ILLUMINATION_SOURCE_BASELINE.zip` (3.618 entradas ZIP). La copia de trabajo de este Gate se generó aislada del original.
- El proyecto **concreto** donde el usuario observó ~60.000 triángulos y el fallo de visibilidad **no fue adjuntado** en este hilo. La cifra es una observación de usuario, no medición reproducida.
- Preservados todos los archivos anteriores. Cambios estrictamente delimitados a renderizado, Terrain, UI y operaciones de topología. No se toca Water Lab.

## Resultado técnico verificable
1. `terrain-bake.js` propone un nivel de índices para terreno **sin modificar las alturas, pintura, materiales o datos de colisión**; valida error máximo de altura y mezcla de ocho canales de splat sobre la geometría triangular realmente propuesta. Conserva bordes de pieza. `terrainIndex` acepta piezas rectangulares y `terrainStrides` evita strides incompatibles. El plan se consume desde `ClusterMeshes` y la ruta LOD existente. La fuente sigue editable.
2. `ScenePanel.vue` incorpora la acción `Escena ▸ Hornear Mapa · geometría`, parámetros de tolerancia y restauración de índices. Persisten **parámetros de horneado**; la selección de índices se reconstruye al cargar/editarlos. No se guardan dos heightmaps ni se hornea iluminación.
3. Corrección conservadora de `ClusterMeshes` para no forzar `mesh.visible=true` al retirar un lote y respetar el estado del nodo autor. El caso visual de ocultar/mostrar a través de todos los consumidores Editor/Play **no pudo verificarse**.
4. El editor de mallas conserva las operaciones `dissolveEdges` preexistentes, rechaza un contorno inválido/caras no coplanares y muestra un nombre explícito de la acción. Unir dos triángulos coplanares en un quad editable **no implica** un solo triángulo en GPU; el renderer triangula las caras.
5. Las nubes conservan `CloudField/CloudVolume` y World; se aumenta la dispersión horizontal determinista en código sin variar aleatoriamente cada fotograma. Se elevan únicamente los **presets de cielo manuales nuevos**; escenas ya serializadas no se reescriben. Variación de viento vertical deriva de la cizalladura existente (no hay sistema de viento paralelo).
6. El panel de rendimiento presenta el presupuesto máximo de pasos de raymarch, conteo de primitivas CPU, tamaño del campo volumétrico y transmisión solar disponible. Cuando el `CloudField` de World confirma campo vacío, el raymarch se omite. **No son tiempos GPU medidos**. El passe de cielo existente incluye el coste de nubes.
7. `World` ya implementaba transmisión solar según nubosidad y suavizado; no se duplicó su autoridad.

## Límites y bloqueos técnicos
- La simplificación usa niveles de `stride` **uniformes por pieza**; no es una simplificación adaptativa arbitraria a la topología ni un Nanite de terreno. Un terreno muy irregular, con pintura detallada o dimensiones incompatibles puede mantener todos sus triángulos. Los bordes mantienen resolución fuente y limitan la reducción máxima. La geometría de detalle geométrico se evalúa contra los vértices originales; no se avala reducción a 50 triángulos sin evidencia.
- No hay culling de raymarch mediante un buffer de oclusión por profundidad completo: se conserva el renderer atmosférico único. Los perfiles regulan muestras y el campo vacío se omite, pero **la reducción de trabajo GPU en cielos parcialmente tapados aún no está probada**. No presentar estas mejoras como culling por objetos.
- El umbral de tolerancia 0.08 m de altura / 0.06 de pintura solo es configuración inicial, no un acuerdo de fidelidad visual para un proyecto concreto.
- El cálculo de horneado es síncrono; medir latencia con el proyecto real antes de declararlo apto para hardware modesto.
- El aumento de altura solo afecta presets nuevos manuales; no reposiciona nubes atmosféricas de proyectos previos y no sustituye autoridad de World.
- Las variaciones de viento por nivel son aproximaciones derivadas de cizalladura: deben contrastarse visualmente con nubes a diferentes altitudes.
- `node_modules` no está disponible: sin compilación Vite/Electron, WebGL ni Player, no hay evidencia de perfil gráfico o 60 FPS.

## Pruebas ejecutadas
Comandos desde raíz del paquete:

```
node --test scripts/test-performance-s17-g003-integral.mjs
node --test scripts/test-editor-viewmodes-s01-g001.mjs scripts/test-editor-native-clusters-corr001.mjs scripts/test-cloud-storm-s00-g001.mjs
node --test scripts/test-cloud-natural-3d-morphology-corr001.mjs scripts/test-cloud-altitude-horizon-corr002.mjs scripts/test-solar-cloud-reflection.mjs scripts/test-mesh-edit-s02-g001.mjs scripts/test-mesh-polyshape-g001.mjs scripts/test-terrain-node-s01-corr001.mjs scripts/test-cloud-storm-s00-g001.mjs scripts/test-editor-native-clusters-corr001.mjs scripts/test-editor-viewmodes-s01-g001.mjs scripts/test-performance-s17-g003-integral.mjs
node --test scripts/test-clusters-and-irradiance.mjs scripts/test-cloud-evolution-s01-g001.mjs scripts/test-cloud-natural-scale-corr003.mjs scripts/test-mesh-vertex-workflow-corr-g001.mjs scripts/test-terrain-extents-s03-corr001.mjs
```

- G003 propias: **12/12 PASS**, incluida prueba de simplificación, pintura, relieve, borde rectangular, disolución de caras y contratos estáticos de integración.
- ViewModes + clústeres + Cloud Storm: **39/39 PASS**.
- Batería focal ampliada: **128/131 PASS; 3 fallos** reproducibles también en el SOURCE_BASELINE original. `test-solar-cloud-reflection.mjs` no resuelve `three` por dependencias ausentes; `TNC-14` y `TNC-15` contienen aserciones antiguas que ya fallan en la línea base original.
- Suite secundaria: **56/57 PASS; 1 fallo** por importación de `three` no instalado; reproducible en línea base.
- Cumulus/stratus: se detectaron 2 regresiones nuevas por cambio prematuro de altitud; revertidas. `test-cloud-altitude-horizon-corr002.mjs` y `test-cloud-natural-3d-morphology-corr001.mjs` vuelven a dar **19/19 PASS**.
- Ejemplo **sintético plano** `128 × 128` celdas: índice base 32.768 triángulos, índice seleccionado con tolerancias predeterminadas 520 triángulos. Es **solo prueba matemática/CPU**, no un benchmark del proyecto aportado ni una cifra de draw calls o GPU.

## QA pendiente antes de aprobación/cierre
- Adjuntar y auditar el proyecto real reportado; reproducir ~60.000 triángulos, visibilidad y formas/alturas reales de nubes.
- Verificar latencia de horneado y reducción real por pieza/colisión/pintura/sombras/Editor/Runtime.
- Ejecutar `npm run electron`, compilar editor y Player, medir FPS/CPU/GPU/RAM y comparar perfiles (Compatibility/Mobile/Forward+ donde estén disponibles).
- Validar «Visible» ON/OFF guardado/recarga/Play/Stop, incluyendo instancing, clusters y occlusion.
- Medir sol cubierto por nube (A/B) y visibilidad atmosférica por geometría, sin inferir métricas de GPU.

**Estatus final:** ENTREGADO PARA QA LOCAL, NO APROBADO y NO CERRADO. Todo resultado sin evidencia permanece NO VERIFICADO.
