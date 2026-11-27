# LevelForge — LF-SHADER-GRAPH-S02-G001 · Shader Graph profesional y postprocesado

**Autorización exacta:** `Listo. LF-SHADER-GRAPH-S02-G001 autoriza comenzar` · 2026-10-26. El usuario agregó como requisito que el **trabajo con grafos tenga calidad profesional, usando Blender como referencia**.  
**Baseline de entrada:** `LevelForge_POST_S01_G002_SOURCE_BASELINE.zip` (784 archivos).  
**Estado:** IMPLEMENTADO con pruebas automatizadas PASS. **NO CERTIFICADO COMO PARIDAD COMPLETA CON BLENDER**, ni verificado en Electron/GPU/Player exportado.

## Decisiones arquitectónicas

- Extender el editor de grafos y compilador existentes (`ShaderGraphEditor.vue`, `ShaderPreview.vue`, `core/shadergraph/compile.js`, `nodes.js`), conservando el grafo y formato GLSL de materiales antiguos. No crear un editor de postprocesado paralelo.
- Dos destinos declarativos: **Material** (conserva `surface`/`vertex`) y **Post Processing** (genera el `fragmentShader` GLSL de pantalla completa para `ShaderPass` oficial Three.js). Los documentos antiguos sin `target` se interpretan como `material`.
- Los grafos post solo exponen entradas compatibles: `Scene Color`, UV, tiempo, propiedades y nodos matemáticos/colores. El compilador rechaza nodos de malla alcanzables desde la salida post. No se permiten texturas arbitrarias de propiedades en post: solo lectura de `tDiffuse`.
- Un perfil `.post` o `.profile` puede activar el efecto **Shader Graph personalizado**, seleccionar un grafo post y editar sus propiedades `float`, `color`, `bool` y `vec3`. Se mantiene la misma colección `project.shaders`, el mismo registro de perfiles y `LookPipeline`.
- El compositor puede añadir **un ShaderPass personalizado por perfil efectivo**, sin crear un renderizador alternativo. `uTime`, `uIntensity` y los uniforms del grafo se actualizan sin recompilaciones por cambios puramente numéricos. La vista previa de Shader Graph usa su propia escena de prueba y compositor, no sustituye el de LevelForge.
- Dos shaders distintos no pueden interpolar directamente sus programas GLSL: el cambio usa salida progresiva a intensidad cero y entrada progresiva del otro programa. No equivale a una mezcla simultánea pixel-a-pixel entre shaders. Los volúmenes y overrides reutilizan esta misma política.
- **Seguridad y estabilidad:** los errores estructurales de compilación impiden agregar el paso personalizado; NO se ha certificado el comportamiento ante todos los errores GLSL que solo detecta un driver WebGL. Shader Graph post muestra validación estructural en el editor, no verificación de GPU hasta el QA local.

## Herramientas de edición inspiradas en Blender

- [X] Interfaz única para Material / Post Processing, salidas diferenciadas.
- [X] Lienzo con zoom, paneo y encuadre de todos los nodos (`Home`) o de selección (`F`).
- [X] Búsqueda de nodos por nombre/categoría y creación contextual desde el grafo.
- [X] Selección múltiple, selección rectangular, movimiento conjunto y eliminación de grupo.
- [X] Copiar/pegar o duplicar nodos seleccionados y conservar las conexiones internas de los subgrafos copiados.
- [X] Reasignar conexiones, nodos `Reroute`, puertos tipados por color y diagnóstico asociado a nodos.
- [X] Historial Undo/Redo, edición de propiedades y GLSL generado visible.
- [X] Vista previa de materiales (esfera, cubo, plano) y vista previa post con `ShaderPass`.
- [ ] **PENDIENTE (NO FORMA PARTE DE ESTE GATE):** grupos de nodos anidados, frames/etiquetas de organización avanzadas, biblioteca de grupos reutilizables, auto-conexión al insertar nodos sobre cables, atajos y navegación con paridad 1:1 con Blender, depuración en GPU en vivo. La referencia Blender es una meta de calidad, no una certificación de equivalencia funcional.

## Archivos principales

- `src/core/shadergraph/nodes.js`, `compile.js`: nodos y compilación post/material.
- `src/components/ShaderGraphEditor.vue`: selección, marquee, copia/pega, shortcuts, nodo reroute, diagnóstico y cambio de destino.
- `src/components/ShaderPreview.vue`: vista previa con `EffectComposer`, `RenderPass` y `ShaderPass`.
- `src/components/ProfileEditor.vue`: efecto Shader Graph, grafo seleccionado y valores editables.
- `src/engine/runtime/render/profiles.js`, `postvolumes.js`, `look.js`, `viewport.js`: perfiles, mezclas de shader y actualización de uniformes.
- `src/engine/runtime/scene/environment.js`: entrega los documentos Shader Graph al viewport del Editor y Player.
- `src/core/state/shaders.js`, `src/core/levelpackage.js`, `src/components/ProjectPanel.vue`: creación por destino, persistencia, referencias y limpieza.
- `src/core/templates/renderParams.js`, `src/engine/runtime/render/pbr.js`: no ofrecen grafos post en los selectores de materiales PBR.

## Evidencia automatizada

- Pruebas específicas: `node --test scripts/test-shader-graph-s02-g001.mjs` → **36 PASS / 0 FAIL**. Cobertura: grafos nuevos y antiguos, terminales, GLSL generado, nodos de pantalla, nodos no autorizados, ciclos, propiedades, efectos de perfil, prioridades y puntos de integración en Editor/Runtime.
- Regresión del proyecto: `find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 | sort -z | xargs -0 node --test` → **1291 PASS / 0 FAIL / 18 SKIP**, 36 nuevos.
- La prueba opcional `test-starcat.mjs` se excluyó **por ausencia de `three` en `node_modules`**. Incluyéndola, falla por importación inexistente en el entorno, no por una aserción de funcionalidad.
- `node --check` de módulos JS modificados y bloques `<script setup>` de componentes Vue → **PASS de sintaxis JS**. No equivale a compilar el SFC ni ejecutar su template.
- `npm ci --offline --ignore-scripts --no-audit --no-fund` → **BLOQUEADO** (`ENOTCACHED` por paquete faltante). Sin `node_modules` o Vite: **NO VERIFICADO `npm run build`, Electron, WebGL o Player exportado**.

## QA manual obligatorio (Linux, Editor y Player)

- [ ] Ejecutar `npm ci` con acceso al registro de paquetes y `npm run build`; guardar logs.
- [ ] Abrir shader material legado, comprobar conexiones, compilar con WebGL y asignar a un objeto PBR sin cambios visuales no previstos.
- [ ] Crear Shader Graph de postprocesado desde Assets / Shaders y comprobar que usa salida Post Processing; realizar cambios de UV y color de pantalla.
- [ ] Validar creación contextual, navegación y búsqueda; seleccionar varios nodos, mover subgrafo, encuadrar selección y todo, copiar/pegar, duplicar, eliminar y deshacer/rehacer.
- [ ] Verificar que copiar un subgrafo mantiene sus enlaces internos y no copia el nodo maestro.
- [ ] Comprobar nodo Reroute, corrección de enlaces, ciclos y errores mostrados en UI.
- [ ] Editar un `.post` con efecto Shader Graph: conectar el grafo, probar parámetros float/color/bool/vec3, Antes/Después y guardar/reabrir.
- [ ] Asignar `.post` al GameManager, cámara y Spawn; probar resolución y override de eventos/scripts.
- [ ] Superponer PostProcessVolume y comprobar entradas/salidas con un efecto personalizado, incluido cambio entre dos shaders diferentes.
- [ ] Ejecutar escenas, cambio de cámara, cinemática y Player exportado; revisar errores GLSL reales en la consola WebGL.
- [ ] Validar Forward+, Mobile y Compatibility, FPS/VRAM en GPU modesta y pérdida/recreación de contexto WebGL.
- [ ] Exportar/importar `.lfproj` y `.levelpackage` que usen grafos post, preservar dependencias y detectar recursos ausentes.

## Riesgos / deuda explícita

- **No existe paridad total con Blender.** La interfaz y el alcance de nodos requieren evaluación de experiencia con usuario y eventual ampliación modular.
- La selección tipada en UI no es un sistema de inferencia/validación GLSL exhaustivo; combinaciones legales por puerto pueden no ser válidas para determinados operadores (ej. `dot` aplicado a escalares); confirmar compilación GPU en QA.
- No se ofrece grafo de composición de múltiples ShaderPass personalizados por perfil; solo un paso a la vez, con transición de intensidad al reemplazarlo.
- La vista previa post usa geometría de demostración, no la escena completa del proyecto; el editor de perfiles `.post` sí prueba sobre el visor real.
- Driver/GPU, compilación final y Player no verificados en este entorno. **No marcar estas tareas como PASS** hasta obtener evidencia local.
