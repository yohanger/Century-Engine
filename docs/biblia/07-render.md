# Renderizado, perfiles y materiales

`src/engine/runtime/render/viewport.js` crea `THREE.WebGLRenderer`; `render/config.js` distingue Forward+, Mobile y Compatibility y declara backend WebGL por defecto. El código conserva una ruta alternativa WebGPU condicional durante Play (`webgpu-play.js`, `webgpu-post.js`), con causas explícitas de incompatibilidad y recuperación. No identificar el nombre de un perfil con un backend garantizado.

<pre>SceneGraph → Viewport → configuración / look / entorno
                      ├─ render WebGL
                      └─ backend alternativo condicional durante Play</pre>

`render/pbr.js`, `material-resource.js`, `model-material.js`, `native-maps.js`, `surface-detail.js`, `shaderlib.js` y `src/core/state/materials.js` separan la gestión de materiales compartidos y los materiales de modelos importados. `src/core/shadergraph/compile.js` y `nodes.js` mantienen compilación y catálogo de Shader Graph. El modelo de autoría no es la instancia GPU.

`render/profiles.js`, `look.js`, `look-passes.js`, `postvolumes.js`, `autoexposure.js` y `dof.js` participan en la composición visual. `src/engine/runtime/bake/` contiene trazado, planificación, protocolo Worker y publicación de iluminación horneada; `src/core/state/bake.js` orquesta la herramienta editorial. No prometer tiempos de frame por presencia de opciones.

**Impacto:** revisar diferencias de backend, materiales, shaders, sombras, render targets, disposal y memoria. Pruebas de iluminación, model-material y diagnóstico; paridad visual y GPU pendientes de ejecución.


## Cuantización PSX temporal
`render/config.js` normaliza `psxContinuous` (false por defecto). El viewport conserva una fase bidimensional en los uniforms PSX, la avanza una vez por fotograma renderizado y la pone a cero al desactivar. `render/pbr.js` desplaza la cuadrícula de cuantización antes de redondear y resta ese desplazamiento después. No muta vértices ni recompila programas por frame; conserva la ruta de materiales previamente compatible con snap (primitivas/mallas nativas). La propiedad se preserva al cambiar presets. Los perfiles de render no equivalen a backends: el fallback WebGPU a WebGL para PSX continúa vigente. La prueba Mesa/EGL del bloque GLSL aísla la cuantización; no acredita rendimiento GPU real ni el pipeline integrado.
