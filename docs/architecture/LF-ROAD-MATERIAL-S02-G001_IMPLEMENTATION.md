# LevelForge · LF-ROAD-MATERIAL-S02-G001 · Contrato implementado

**Fuente de verdad:** `LevelForge_EDITOR_DISTRIBUTION_CORR-001_FIX-001_SOURCE_BASELINE.zip`.  
**Estado:** implementado; QA de compilación/WebGL/Player pendiente. Gate NO CERRADO.

## Objetivo

Unificar el render de carretera con el mismo pipeline de `makePbrMaterial()` / `syncPbrMaterial()` que utilizan las primitivas, sin crear otra implementación de shaders ni alterar geometría, física, eventos, terreno o nodos.

## Esquema persistente

`road.props.slots.asphalt|center|lanes|side` conserva los campos antiguos `color`, `roughness`, `texture`, `tile`, `emissive`, `tintEnabled`. Se añaden opcionalmente `materialId`, `metallic`, `opacity`, `mat: {shader,mapping,params,physical}`. `materialId` apunta a un recurso estándar de `project.materials` (`Assets/Materials/*.material`). **No se migra ni modifica una carretera antigua por defecto.**

- **Carretera nueva:** la calzada adopta `{ color:'#ffffff', mat:{shader:'builtin:blockout',mapping:'object',params:{}} }`. Las líneas y aceras conservan su configuración de color inicial.
- **Slot local:** conserva sus campos, incluso las texturas antiguas. Los controles de Shader permiten elegir Blockout, Realista PBR o shaders del proyecto.
- **Slot compartido:** si `materialId` existe en `project.materials`, sus parámetros PBR prevalecen; los campos locales siguen guardados para un futuro desvínculo. Las ediciones del recurso notifican a las carreteras consumidoras.
- **Recurso ausente:** usa los valores locales y muestra advertencia, sin reasignar referencias.
- **Crear recurso:** crea un `.material` estándar con el aspecto del slot; imágenes antiguas se traducen a parámetros de Albedo y tamaño en el material nuevo.
- **Hacer local:** copia los parámetros del recurso al slot y lo desvincula; no afecta a los demás consumidores.

## Runtime

- `render/road-material.js` es un adaptador puro que resuelve el slot mediante `effectiveMaterialObject()` del sistema existente.
- `nodes/road.js` crea cuatro `MeshPhysicalMaterial`, usa `syncPbrMaterial()` y reaprovecha los recursos PBR; no crea un segundo shader.
- `lfBlockUV` se obtiene de las UV métricas longitudinales (`UV * tile`) sobre geometría existente. Se conserva la coordenada artística original; no requiere más triángulos ni recalcular física.
- `lfBlockSize` contiene ancho/longitud aproximados; el shader Blockout existente dibuja el patrón métrico por superficie. Las curvas siguen las UV de carretera.
- Con Textura local y shader `builtin:blockout` o `builtin:realista`, `uAlbedo/uTile` se alimentan con el Asset. Sin shader y con carretera heredada se conserva el mapa UV clásico y se fuerza look clásico para no imponer el shader global sobre datos antiguos.
- `scene/environment.js` incluye los cuatro materiales del nodo carretera en `refreshMaterials()`, necesario cuando terminan de cargar texturas/shaders.

## Exportación

El Player LevelForge consume los mismos nodos PBR y recursos. El exportador Godot, declarado obsoleto en su propio módulo, ahora resuelve color/metallic/rugosidad/Albedo desde el recurso para su glTF estático. **Los shaders GLSL de LevelForge (incluido el patrón numérico Blockout) no se traducen a Godot.** Se necesita bake de texturas específico para paridad visual en Godot; fuera del alcance.

## Riesgos y exclusiones

No se introduce pintura de carretera, máscaras, cambio de geometría, nuevos normal maps, nuevos shaders, ni modificaciones a Shift+A. Las modificaciones de geometría y colisiones anteriores se preservan. El shader Blockout no garantiza la misma lectura de texto en una carretera curva y una primitiva plana: validar visualmente las curvas con 1024×768 y sobre terreno.

## QA y evidencia

Ver `docs/qa/LF-ROAD-MATERIAL-S02-G001_QA.md`. Las pruebas Node focalizadas pasan **98/98** (14 nuevas), pero Vite/Three/WebGL no estaban disponibles en este entorno. No se ha validado la compilación del Editor ni del Player, ni la actualización visual en WebGL, ni la ejecución de Electron.

## Continuidad

El siguiente sprint de desarrollo del usuario es limpieza de Shift+A. `LF-ROAD-PAINT-S01-G001` seguirá separado, y debe consumir este contrato de slots y recursos sin duplicarlo.
