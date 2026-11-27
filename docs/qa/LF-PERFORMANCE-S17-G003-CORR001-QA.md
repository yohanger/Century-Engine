# LF-PERFORMANCE-S17-G003-CORR-001 — Informe técnico y QA

**Autorización:** `Listo. LF-PERFORMANCE-S17-G003-CORR-001-REAL-VIEWMODES-TERRAIN-BAKE-AND-CLOUD-DIAGNOSTICS autoriza comenzar` (18 noviembre 2026).

**SOURCE_BASELINE padre:** `LF_LIGHTING_BAKE_S00_G001_BACKGROUND_SCHEDULING_AND_GPU_RECOVERY_SOURCE_BASELINE.zip`. La corrección también conserva las modificaciones de S17-G003 y los cambios del horneador de iluminación. No se altera el subsistema de light baking.

**Estado:** IMPLEMENTADO en fuente y TEST PASS focal. Compilación Vite y shaders integrados NO VERIFICADOS. QA visual Electron/Player NO VERIFICADO. Gate NO APROBADO y NO CERRADO.

## Síntomas y causas auditadas

1. `view-diagnostics.js` ocultaba `viewport.sky` explícitamente y sustituía materiales con colores de apariencia, sin mostrar el coste real de nubes.
2. `terrain-bake.js` exigía aceptar el mismo paso geométrico (stride) en toda la pieza; la desviación de un punto del terreno impedía reducir regiones planas alejadas de ese punto.
3. En `ClusterMeshes._updateTerrain`, cuando el índice era de detalle cercano (`stride === 1`) y todas las páginas estaban activas, se restauraba incondicionalmente el índice fuente, ignorando el índice simplificado.
4. Unlit sustituía el material Terrain con `MeshBasicMaterial` genérico y descartaba la mezcla original de capas (`splatA/B` y texturas de capa).
5. En el modo LOD no se resolvía el nivel seleccionado por los clústeres nativos de Terrain. Los tonos no reflejaban adecuadamente la selección de cámara.

**No se afirma que la causa raíz de todos los síntomas de la grabación esté demostrada:** falta el proyecto concreto con ~60.000 triángulos. La observación en video y el análisis estático fundamentan las rutas corregidas; solo Electron acreditará resultados visuales.

## Alcance implementado

- `terrain-adaptive.js`: divide por regiones, mantiene todos los vértices de borde, cose vecinos sin T-junctions y verifica las discrepancias de altura y pintura en los vértices fuente del índice FINAL. Retorna `null` si no consigue menos triángulos sin vulnerar la tolerancia.
- `terrain-bake.js`: contrato `terrainBakePlan()` compatible con consumidores existentes; ahora entrega `index` real, número de caras, errores, reducción y regiones; sigue guardando solo parámetros serializados.
- `cluster-mesh.js`: consume realmente el índice adaptativo cercano y registra triángulos fuente/horneados/efectivos elegidos por cámara. El culling por páginas continúa perteneciendo a clústeres.
- `lodmgr.js`: mantiene el consumo coherente del índice adaptativo para la ruta de fallback y al cambiar la revisión del terreno.
- `Terrain._makeMaterial()`: expone uniformes del mismo splat para el modo Unlit, sin copiar texturas ni duplicar la autoridad de materiales.
- `view-diagnostics.js`: mantiene el cielo/nubes en los modos de inspección, preserva materiales procedurales que no tienen una ruta Unlit segura, muestra un mapa térmico de lectura GLSL por malla y resuelve nivel LOD del terreno nativo.
- `skylib.js`: Shader Complexity puede colorear el cielo según las iteraciones de raymarch efectivamente ejecutadas sobre cada rayo, con proporción contra el presupuesto. No mide tiempo GPU.
- `ScenePanel.vue` / `PerfPanel.vue`: distinción entre índices fuente, horneados y efectivos, alertas por cero reducción y leyendas térmicas.

## QA ejecutado (entorno actual)

| Verificación | Evidencia | Estado |
|---|---|---|
| Nuevo contrato CORR001 | `node --test scripts/test-performance-s17-g003-corr001.mjs` | 8/8 PASS |
| Regresión G003 + ViewModes G001 + CORR001 | `node --test scripts/test-performance-s17-g003-corr001.mjs scripts/test-performance-s17-g003-integral.mjs scripts/test-editor-viewmodes-s01-g001.mjs` | 34/34 PASS |
| Regresiones ampliadas de nubes/clústeres/performance | Node sobre ocho suites | 70 PASS, 2 runners BLOQUEADOS por `ERR_MODULE_NOT_FOUND: three` |
| Compilación Vite | `npm run build` | BLOQUEADO (`vite: not found`) |
| GLSL con contexto WebGL 2 real | Renderizador integrado | NO VERIFICADO |
| QA visual Electron/Play/Player | Equipo del usuario | NO VERIFICADO |
| Reducción del terreno reportado | Proyecto real no adjunto | NO VERIFICADO |

Archivos de registro: `docs/qa/evidence/LF-PERFORMANCE-S17-G003-CORR001/`.

## Métricas de prueba (solo geometría sintética)

- Cuadrícula plana de 128×128: 32.768 -> **512 triángulos**; conserva 100 % de los vértices de borde, altura y pintura originales intactos.
- Cuadrícula de 128×128 con un relieve puntual de +8: 32.768 -> **674 triángulos** con tolerancia de altura 0,08 m y pintura 0,06; resultado del índice calculado en Node.
- Rectángulos de dimensiones no potencia de dos y pintura discontinua: tests de continuidad y límite de error PASS.

Estas cantidades no son mediciones del proyecto de usuario, no miden FPS, CPU/GPU ni la triangulación final de otras rutas. En los casos en que el error de pintura/relieve lo exige, la simplificación puede ser mucho menor.

## Contratos y límites

- Se mantiene `heightmap`, `splat`, colisiones, materiales, autoría y el sistema de clústeres. No se construye un LOD paralelo.
- Unlit preserva las capas de Terrain; shaders procedurales ajenos a Terrain sin un contrato de albedo se mantienen como están (cobertura Unlit **PARCIAL**, no completamente libre de luces).
- Shader Complexity para mallas es una clasificación estática de lecturas de textura GLSL; **NO** son microsegundos GPU ni carga CPU por píxel. Para las nubes se muestra el número normalizado de iteraciones de la marcha, no todas las lecturas internas ni la duración GPU.
- Los tiempos GPU que suministre `PerfMonitor` corresponden a `Cielo atmosférico` en su conjunto, **no** a un temporizador aislado de las nubes. Si no hay extensión de consultas, solo se muestran tiempos CPU.
- `Depth`, `Lighting Only` y efectos de materiales personalizados pueden requerir otro Gate de calibración visual tras QA. No se afirma que todas las vistas ya alcancen paridad con UE5.
- No se instaló dependencia nueva ni se modificó el horneado de luz. No se crearon assets ni GPU queries falsas.

## QA pendiente en el entorno del usuario

1. Aplicar CHANGE sobre el SOURCE_BASELINE padre correcto; no sobre una línea con cambios locales sin comparar.
2. Instalar dependencias (si se requiere) y ejecutar `npm run electron`.
3. Escena -> Hornear Mapa: verificar conteo antes/después, mensajes cuando no reduce; guardar y recargar escena.
4. Modo Triangles/Clusters/LOD: acercar y alejar cámara y comparar con F3 los contadores de fuente, bake y efectivos. Verificar que la selección ocurre en geometría real y no solo en una capa visual.
5. Unlit: comprobar pintura con varias capas y texturas. Shader Complexity: observar el gradiente verde/amarillo/rojo en mallas y nubes y verificar `Cielo atmosférico` cuando GPU Timer esté disponible.
6. Verificar lluvia, nubes, tormenta, sol y Editor/Play/Player sin regresiones en materiales/iluminación.
7. Aportar proyecto con ~60k triángulos para medición A/B con cámara fija (triángulos, CPU/GPU, draw calls y FPS) y captura de consola.

**Resultado contractual:** implementación fuente y TEST PASS. QA local real, aprobación y cierre pendientes.
