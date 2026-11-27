# LevelForge — LF-EDITOR-VIEWMODES-S01-G001-CORR-001-NATIVE-CLUSTERS-TERRAIN-AND-REAL-DIAGNOSTICS

**Estado:** IMPLEMENTADO EN FUENTES (PARCIAL) · TEST NODE PASS · VITE/ELECTRON/GPU/PLAYER NO VERIFICADOS · NO APROBADO · NO CERRADO.

**Autoridad:** autorización literal del usuario del 18-11-2026. Contratos S17 y G001; sin retirada del LOD heredado. SOURCE_BASELINE de partida: `LF_EDITOR_VIEWMODES_S01_G001_INTEGRAL_RENDER_DIAGNOSTICS_SOURCE_BASELINE.zip` (3.601 archivos). Las decisiones y documentos de la fuente anterior se conservan.

## Áreas y propietarios

1. `LodManager` sigue coordinando la selección del backend y el LOD heredado donde actúa. `ClusterMeshes` es el registro nativo: se construye en Edit Mode (inclusive Lit) y Play independientemente de `renderCfg.clusterGeometry`. No crea un segundo SceneGraph ni cambia el formato de escena.
2. `ClusterMeshes.nativeClusterCandidate()` admite mallas con al menos **un triángulo válido**. Excluye explícitamente instancing, skinning, morph targets y ayudas cuya topología no se puede particionar sin romper otros contratos. Registro nativo **no implica lote GPU**: `clusterCandidate()` sigue siendo una selección interna de la ruta batch cuando material, presupuesto y backend lo permiten.
3. Para mallas pequeñas/directas se preserva el `Mesh` y material original. Se generan, con límite de memoria, páginas de índices espaciales para observación. La selección por página solo modifica índices de dibujo si es segura; si hay sombras, transparencias, varios materiales, morph, o un LOD heredado propietario, no se finge descarte por clúster. La ruta directa y sus límites se publican.
4. Terrain se registra a través de `ClusterMeshes` con su `BufferGeometry` original y su shader especializado intacto. La elección de `stride` procede de la fórmula existente de Terrain; se particionan los índices del nivel seleccionado en páginas con identidad verificable. Cambios de altura/pintura invalidan páginas usando `version` y versiones de atributos. Se restauran índices y `frustumCulled` al desmontar.
5. Play con WebGPU puede conservar la selección CPU de índices de Terrain. La ruta de cómputo `GpuClusterDraw` **no empaqueta Terrain**: la normalización de los atributos de splat no está validada en ese empaquetador. En WebGPU el terreno sigue la ruta de dibujo directo con índice adaptado. **No implica clústeres compute de Terrain en GPU.**
6. `ViewDiagnostics` consulta los índices y posiciones efectivos para la vista Triangles; para Clusters usa páginas de Terrain, niveles residentes de lotes y particiones de dibujo directo. Una página mostrada no se reporta como draw call separado ni como descarte GPU si no lo es. No se altera ningún asset serializado.

## Estado de los View Modes

| Modo | Implementación evidenciable | Límite de alcance |
|---|---|---|
| Lit | Pipeline existente | Medición visual local pendiente |
| Unlit / Lighting Only | Pase de material temporal con iluminación suprimida o albedo neutro | Materiales personalizados complejos no equivalentes a descomposición del G-buffer |
| Triangles | Índices y posiciones seleccionados; colores ID cara | No equivale a shader específico de rasterización Nanite; no refleja descarte por alfa |
| Clusters | Páginas Terrain, lotes GPU y directo registrado | En dibujo directo una partición no implica selección o culling por GPU |
| LOD | Selección existente; se conserva el LOD heredado donde es propietario | Coste y cambio visible necesitan QA GPU |
| Culling / Light Complexity | Estadísticas existentes y luces candidatas conservadoras | No equivalen a cobertura de cada píxel ni coste GPU por luz |
| Shader · lecturas GLSL | Conteo estático de accesos a textura en shader fuente del WebGLProgram | **NO es Shader Complexity real por píxel**, ni tiempo GPU ni número de instrucciones ejecutadas |
| Indirect Lighting | Visualiza IBL y sondas al aislar luces directas | **ScreenBounce no cuenta con salida diagnóstica separada**; no equivale a Lumen |
| Depth / Normals | Pases del motor en modo editorial | No se inventa G-buffer almacenado |
| PerfMonitor | Temporizadores GPU existentes; contador de cielo en G001 | GPU timer depende de extensión y de validación local |

## Contratos de preservación

- No reemplazar el renderizador, simular métricas ni copiar código de Epic.
- Conservar materiales, texturas, atributos de Terrain (`splatA/splatB`), sombras, colisiones, físicas y proyectos persistidos.
- LOD histórico NO pasa a DEPRECATED por este Gate y permanece activo cuando sigue siendo propietario del índice.
- Editor/Play/Stop liberan páginas, workers, lotes y geometrías temporales. No se altera `package.json`, el formato de escena ni la implementación de nubes.
- `WEBGL_multi_draw` no es condición para participar: sirve únicamente para seleccionar el batch apropiado.
- Presupuesto directo CPU de índices: hasta 24 MiB globales; umbral de batch independiente de la elegibilidad. El modo diagnóstico puede incorporar buffers transitorios adicionales y necesita medición real.

## Contradicciones / no cumplido

1. No se demuestra paridad visual y temporal de todos los modos sin Electron WebGL2 real.
2. Shader Complexity real (coste por fragmento/overdraw) no se implementó. El conteo GLSL es un indicador limitado y expresamente rotulado como tal.
3. Iluminación indirecta de ScreenBounce/trace no está aislada como salida diagnóstica.
4. El empaquetador WebGPU no procesa Terrain como página compute sin un contrato de normalización de atributos y QA correspondiente; actualmente se consume el índice elegido por CPU.
5. Transparencia, geometría animada/skinned, instancing y materiales multimalla mantienen rutas existentes, no se declaran optimización por clúster validada.
6. No existen mediciones de FPS/VRAM o Player para esta corrección. El Gate **permanece abierto**, y el contrato integral **no debe marcarse como QA PASS funcional**.

## Próxima validación

Ejecutar en Zorin/Chromium: `node --test scripts/test-editor-native-clusters-corr001.mjs scripts/test-editor-viewmodes-s01-g001.mjs scripts/test-shader-source-metrics-corr001.mjs`, `node --test scripts/test-editor-viewmodes-electron-s01-g001.mjs`, `npm run electron`. Verificar Terrain tras edición, cubo, triángulo unitario, materiales, sombreado, registro permanente sin flags, Play/Stop y Compatibility. Adjuntar logs y capturas comparativas A/B.
