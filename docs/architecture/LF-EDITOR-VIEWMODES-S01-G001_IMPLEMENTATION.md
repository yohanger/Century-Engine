# LF-EDITOR-VIEWMODES-S01-G001 — Contrato implementado y diagnóstico de capacidades

**Estado:** implementado parcialmente; Node/estructura PASS; Electron, build y QA local pendientes. **No aprobado ni cerrado.**
**Autoridad:** Gate integral autorizado; SOURCE_BASELINE anterior `LF_CLOUD_EVOLUTION_S01_G001_CORR001_NATURAL_3D_CLOUD_MORPHOLOGY_SOURCE_BASELINE.zip`. Se preserva CA-002 y la arquitectura de nubes.

## 1. Auditoría comparada con Unreal

- Referencia UE4.0.1 aportada: `Engine/Source/Editor/UnrealEd/Private/EditorViewportCommands.cpp` (líneas 17–22: Lit, Unlit, Lighting Only, Light Complexity y Shader Complexity). `SLevelViewportToolBar.cpp` (menús del viewport y show flags). `ShowFlagsValues.inl` separa componentes de luz y post-proceso. `ShaderComplexityRendering.cpp` implementa un pase especializado con conteo de instrucciones de shader; **no equivale a colorear materiales arbitrariamente**.
- UE5.1 conectado, `Engine/Source/Editor/UnrealEd/Private/EditorViewportCommands.cpp` (comandos Nanite, Lumen, Virtual Shadow Maps y buffers); no atribuir estas capacidades a UE4.0.1 ni a LevelForge.
- Principios adoptados: selector editorial; estado efímero; contrato de capacidad; diagnóstico por datos reales; ningún shader o implementación copiada de Epic. Se respetan licencias.

## 2. Cadena propia contrastada

`store.view.mode` (solo sesión) → `ViewBar.vue` / `core/commands.js` → watcher `core/editor/keys.js` → `SceneGraph.applyView()` → `Viewport.viewMode` → `Viewport._draw()` → `ViewDiagnostics` / `LookPipeline`.

- Solo se diagnostica con `!playing && !drawEditorPreview`.
- Los overrides de materiales se aplican durante un dibujo real (`renderer.render(scene,camera)`), con restauración garantizada por `finally`. **Nunca se modifica la autoría de materiales o texturas**. Cada material derivado es cacheado y liberado al perder vigencia o al destruir el viewport.
- Lit conserva íntegro `LookPipeline`, incluyendo postprocesado configurado.
- Vistas de datos (Unlit, Lighting Only, Wireframe, Depth, Normals, Light candidates, LOD y Clusters si están disponibles) hacen un **pase editorial directo**: no equivale a medir la misma carga del render Lit. Se ocultan transitoriamente cielo, grid, gizmos y rayo, sin editar proyecto.
- Los shaders custom sin albedo uniforme derivable no garantizan equivalencia completa con Unlit y deben diagnosticarse como cobertura parcial.
- `PerfMonitor`: usa el GPU timer WebGL2 existente. `sky.onBeforeRender` y `sky.onAfterRender` separan `Cielo atmosférico` del coste de Escena cuando la GPU permite queries; si no, los valores GPU no se presentan. Esto **no demuestra que los 37,9 ms de la captura sean nubes**, hay que medirlo localmente.

## 3. Matriz de capacidad verificable

| Modo | Origen auténtico | Precisión y límite | Estado |
|---|---|---|---|
| Lit | LookPipeline y materiales de proyecto | Ruta real completa | Integrado |
| Unlit | MeshBasicMaterial transitorio con mapa/color fuente | Albedo de materiales estándar; shaders custom no totalmente recuperables | Integrado, cobertura parcial |
| Lighting Only | MeshStandardMaterial con albedo neutro, luces y normales | Iluminación directa y ambiente de Three; no aísla Lumen ni integra todos los materiales custom | Integrado, cobertura parcial |
| Wireframe | BufferGeometry realmente seleccionada por renderer | Topología de malla efectiva, no geometría potencial | Integrado |
| LOD | LodManager existente, cur, índices y geometría | Solo si LOD habilitado en Render; editor lo activa temporalmente con el mismo selector y lo restaura | Integrado condicionado |
| Light candidates | Luces activas e intersección conservadora con boundingSphere del objeto | **Estimación CPU / objeto**, no overdraw, complejidad por píxel ni tiempo de GPU | Integrado condicionado |
| Depth | MeshDepthMaterial sobre geometría efectiva, nuevo pase editorial | No pretende leer el G-buffer del proyecto | Integrado |
| Normals | MeshNormalMaterial sobre geometría efectiva, nuevo pase editorial | Espacio de vista; no lee un G-buffer del proyecto | Integrado |
| Clusters | ClusterMeshes residente, si WebGL2 + WEBGL_multi_draw + opción `clusterGeometry` y objetos aptos | Objetos sin clúster en gris; no prometer disponibilidad en Compatibility | Integrado condicionado |
| Shader Complexity | No hay contador de instrucciones o coste por fragmento accesible | **NO DISPONIBLE; Lit de respaldo etiquetado** | BLOQUEADO por instrumentación del shader |
| Indirect Lighting | WorldIrradiance/ScreenBouncePass no exponen buffer separado de debug para Editor | **NO DISPONIBLE; Lit de respaldo etiquetado** | BLOQUEADO por contrato de salida de GI |
| GPU Profiler | PerfMonitor + timer queries + introspección renderer.info | Resultado GPU auténtico cuando soportado; ninguna estimación se hace pasar por GPU | Extendido |

## 4. LOD editorial sin duplicación

En lugar de un nuevo selector se instancia `LodManager` **solo** al elegir LOD o Clusters compatibles, con `editorDiagnostics:true` y `batchStatic:false`. No se llama `Foliage.enterPlay` y no se mantiene simulación adicional. `update(camera)` usa el mismo algoritmo de distancia/error y malla. `detach()` restaura índices/geometrías, detiene worker y libera caché cuando se cambia de modo, escena o se entra en Play.

La importación de `lodmgr.js` es diferida para no introducir `?worker&inline` en el QA Node del editor. Tokens de generación evitan carreras asíncronas al cambiar de modo rápidamente. **Ninguna ruta de exportación del Player se modifica.**

## 5. Reglas y bloqueos

1. No hay segunda escena, segundo orquestador LOD ni nuevo renderer; se extienden capacidades reales.
2. No se usan los nombres «Nanite» o «Lumen» para fingir equivalencia con UE5.
3. Los modos deshabilitados no simulan salidas: se indica causa, el renderer retorna a Lit y el estado se expone en el profiler.
4. CPU, GPU, conteo de triángulos y estimaciones geométricas conservan denominación y procedencia distintas.
5. QA Electron/WebGL2, compilación y revisión visual en hardware objetivo son obligatorios para aprobación. La falta de dependencias locales no se interpreta como fallo del renderer.
6. Si un modo exige un nuevo contrato de datos de un subsistema, queda bloqueado en este Gate en vez de inventar un resultado. **El Gate integral no puede declararse CERRADO con esos puntos pendientes.**
